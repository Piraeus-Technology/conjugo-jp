import AsyncStorage from '@react-native-async-storage/async-storage';
import { __resetSessionStoreForTests, useSessionStore } from '../store/sessionStore';
import { getTodayKey } from '../utils/dayKey';
import { AppState, type AppStateStatus } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useSessionAutosave } from '../hooks/useSessionAutosave';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

let mockBlur = () => {};
const mockNavigation = {
  addListener: jest.fn((_event: string, callback: () => void) => {
    mockBlur = callback;
    return jest.fn();
  }),
};
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation }));

beforeEach(() => {
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});

afterEach(() => jest.restoreAllMocks());

test('dates each answer across midnight, serializes saves, and retries without losing newer answers', async () => {
  jest.useFakeTimers();
  let appStateChanged: (state: AppStateStatus) => void = () => {};
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    appStateChanged = callback;
    return { remove: jest.fn() };
  });
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  let rejectFirst!: (error: Error) => void;
  const firstWrite = new Promise<void>((_resolve, reject) => { rejectFirst = reject; });
  const persisted: { day: string; count: number; correct: number; bestStreak: number }[] = [];
  let writes = 0;
  let activeWrites = 0;
  let maxWrites = 0;
  const save = jest.fn(async (delta: typeof persisted[number], beforePublish: () => void) => {
    activeWrites++;
    maxWrites = Math.max(maxWrites, activeWrites);
    try {
      if (++writes === 1) await firstWrite;
      beforePublish();
      persisted.push(delta);
    } finally {
      activeWrites--;
    }
  });
  const hook = renderHook(() => useSessionAutosave({ save }));
  try {
    jest.setSystemTime(new Date(2026, 9, 7, 23, 59));
    act(() => hook.result.current.recordProgress(true, 1));
    jest.setSystemTime(new Date(2026, 9, 8, 0, 1));
    act(() => hook.result.current.recordProgress(false));
    expect(hook.result.current.unsavedCount).toBe(1);
    expect(hook.result.current.unsavedCorrect).toBe(0);

    await act(async () => { mockBlur(); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith({ day: '2026-10-07', count: 1, correct: 1, bestStreak: 1 }, expect.any(Function));
    // The second day's snapshot is already queued. A new answer must survive
    // both that snapshot's write and the first day's failed write.
    act(() => hook.result.current.recordProgress(true, 1));
    jest.setSystemTime(new Date(2026, 9, 9, 1));
    await act(async () => {
      appStateChanged('background');
      rejectFirst(new Error('temporary write failure'));
    });
    expect(maxWrites).toBe(1);
    expect(save).toHaveBeenCalledTimes(4);
    expect(persisted.filter(delta => delta.day === '2026-10-07')).toEqual([
      { day: '2026-10-07', count: 1, correct: 1, bestStreak: 1 },
    ]);
    const secondDay = persisted.filter(delta => delta.day === '2026-10-08');
    expect(secondDay.reduce((sum, delta) => sum + delta.count, 0)).toBe(2);
    expect(secondDay.reduce((sum, delta) => sum + delta.correct, 0)).toBe(1);
    expect(persisted.every(delta => delta.day !== '2026-10-09')).toBe(true);
    await act(async () => { mockBlur(); appStateChanged('inactive'); });
    expect(save).toHaveBeenCalledTimes(4);
  } finally {
    await act(async () => { hook.unmount(); });
    warn.mockRestore();
    jest.useRealTimers();
  }
});

function useQuizSessionScore() {
  const sessions = useSessionStore(state => state.sessions);
  const autosave = useSessionAutosave({
    readResetCount: () => useSessionStore.getState().resetCount,
    save: async ({ day, count, correct, bestStreak }, beforePublish) => {
      const saved = await useSessionStore.getState().saveSession(
        { total: count, correct, streak: bestStreak }, day, beforePublish,
      );
      if (!saved) throw new Error('could not save');
    },
  });
  const today = sessions.find(session => session.day === getTodayKey());
  return {
    grade: autosave.recordProgress,
    score: [(today?.total ?? 0) + autosave.unsavedCount, (today?.correct ?? 0) + autosave.unsavedCorrect],
  };
}

test('persists immediately without dropping or double-counting answers during the write', async () => {
  await AsyncStorage.clear();
  __resetSessionStoreForTests();
  await useSessionStore.getState().loadSessions();
  let finishWrite!: () => void;
  const write = new Promise<void>(resolve => { finishWrite = resolve; });
  const storeWrite = AsyncStorage.setItem;
  const setItem = jest.mocked(storeWrite);
  const original = setItem.getMockImplementation()!;
  setItem.mockImplementationOnce(async (key, value) => {
    await write;
    return original(key, value);
  });
  const recorded: number[][] = [];
  const hook = renderHook(() => {
    const state = useQuizSessionScore();
    recorded.push(state.score);
    return state;
  });

  await act(async () => hook.result.current.grade(true, 1));
  expect(setItem).toHaveBeenCalledWith('sessions', expect.stringContaining('"total":1'));
  expect(useSessionStore.getState().sessions).toEqual([]);
  expect(hook.result.current.score).toEqual([1, 1]);

  await act(async () => hook.result.current.grade(false));
  expect(hook.result.current.score).toEqual([2, 1]);
  const afterSecondAnswer = recorded.length;
  await act(async () => finishWrite());

  expect(recorded.slice(afterSecondAnswer).length).toBeGreaterThan(0);
  expect(recorded.slice(afterSecondAnswer).every(score => score[0] === 2 && score[1] === 1)).toBe(true);
  expect(JSON.parse((await AsyncStorage.getItem('sessions'))!)).toEqual([
    { day: getTodayKey(), total: 2, correct: 1, streak: 1 },
  ]);
});

test('retries a failed foreground answer and discards pending answers on explicit reset', async () => {
  await AsyncStorage.clear();
  __resetSessionStoreForTests();
  await useSessionStore.getState().loadSessions();
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.useFakeTimers();
  try {
    const hook = renderHook(useQuizSessionScore);
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('temporary write error'));
    await act(async () => hook.result.current.grade(true, 1));
    expect(hook.result.current.score).toEqual([1, 1]);
    expect(await AsyncStorage.getItem('sessions')).toBeNull();
    await act(async () => jest.advanceTimersByTime(5000));
    expect(useSessionStore.getState().sessions[0]).toMatchObject({ total: 1, correct: 1 });

    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('temporary write error'));
    await act(async () => hook.result.current.grade(false));
    await act(async () => { expect(await useSessionStore.getState().clearSessions()).toBe(true); });
    await act(async () => { jest.advanceTimersByTime(5000); mockBlur(); });
    expect(hook.result.current.score).toEqual([0, 0]);
    expect(await AsyncStorage.getItem('sessions')).toBeNull();
    hook.unmount();
  } finally {
    warn.mockRestore();
    jest.useRealTimers();
  }
});
