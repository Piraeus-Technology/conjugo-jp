import { AppState, type AppStateStatus } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useSessionAutosave } from '../hooks/useSessionAutosave';

let mockBlur = () => {};
const mockNavigation = {
  addListener: jest.fn((_event: string, callback: () => void) => {
    mockBlur = callback;
    return jest.fn();
  }),
};
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation }));

test('dates each answer across midnight, serializes saves, and retries without losing newer answers', async () => {
  jest.useFakeTimers();
  let appStateChanged: (state: AppStateStatus) => void = () => {};
  const appState = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
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
  const save = jest.fn(async (delta: typeof persisted[number]) => {
    activeWrites++;
    maxWrites = Math.max(maxWrites, activeWrites);
    try {
      if (++writes === 1) await firstWrite;
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
    expect(save).toHaveBeenLastCalledWith({ day: '2026-10-07', count: 1, correct: 1, bestStreak: 1 });
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
    appState.mockRestore();
    warn.mockRestore();
    jest.useRealTimers();
  }
});
