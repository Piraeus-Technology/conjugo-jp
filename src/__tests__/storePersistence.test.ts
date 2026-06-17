import AsyncStorage from '@react-native-async-storage/async-storage';
import { __resetFavoritesStoreForTests, useFavoritesStore } from '../store/favoritesStore';
import { __resetHistoryStoreForTests, useHistoryStore } from '../store/historyStore';
import {
  __resetPracticeSettingsStoreForTests,
  allForms,
  allLevels,
  usePracticeSettingsStore,
} from '../store/practiceSettingsStore';
import { __resetQuizStoreForTests, useQuizStore } from '../store/quizStore';
import { __resetSpacedRepStoreForTests, useSpacedRepStore } from '../store/spacedRepStore';
import { __resetThemeStoreForTests, useThemeStore } from '../store/themeStore';

const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
}));

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('store persistence hardening', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockStorage.clear();
    jest.clearAllMocks();
    __resetFavoritesStoreForTests();
    __resetHistoryStoreForTests();
    __resetPracticeSettingsStoreForTests();
    __resetQuizStoreForTests();
    __resetSpacedRepStoreForTests();
    __resetThemeStoreForTests();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test('favorite write after failed load refuses to clobber disk', async () => {
    mockStorage.set('favorites', JSON.stringify(['書く', '飲む']));
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk locked'));

    await useFavoritesStore.getState().toggleFavorite('見る');

    expect(mockStorage.get('favorites')).toBe(JSON.stringify(['書く', '飲む']));
    expect(useFavoritesStore.getState()).toMatchObject({
      favorites: [],
      loaded: false,
      loadError: true,
    });
  });

  test('favorite toggle waits for in-flight load and preserves loaded values', async () => {
    mockStorage.set('favorites', JSON.stringify(['書く']));
    const load = deferred<string | null>();
    jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() => load.promise);

    const loadPromise = useFavoritesStore.getState().loadFavorites();
    const togglePromise = useFavoritesStore.getState().toggleFavorite('飲む');

    load.resolve(JSON.stringify(['書く']));
    await Promise.all([loadPromise, togglePromise]);

    expect(useFavoritesStore.getState().favorites).toEqual(['飲む', '書く']);
    expect(mockStorage.get('favorites')).toBe(JSON.stringify(['飲む', '書く']));
  });

  test('history add/remove writes serialize in order', async () => {
    await useHistoryStore.getState().loadHistory();
    await Promise.all([
      useHistoryStore.getState().addToHistory('書く'),
      useHistoryStore.getState().addToHistory('飲む'),
      useHistoryStore.getState().removeFromHistory('書く'),
    ]);

    expect(useHistoryStore.getState().history).toEqual(['飲む']);
    expect(mockStorage.get('verb_history')).toBe(JSON.stringify(['飲む']));
  });

  test('quiz answer after failed load refuses to clobber stats', async () => {
    mockStorage.set('quiz_stats', JSON.stringify({ totalQuestions: 20, totalCorrect: 15, bestStreak: 6 }));
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk locked'));

    await useQuizStore.getState().recordAnswer(true, 1);

    expect(JSON.parse(mockStorage.get('quiz_stats')!)).toEqual({
      totalQuestions: 20,
      totalCorrect: 15,
      bestStreak: 6,
    });
    expect(useQuizStore.getState()).toMatchObject({ loaded: false, loadError: true });
  });

  test('spaced repetition result stays bare-verb and recovers after transient load failure', async () => {
    mockStorage.set('spaced_rep_weights', JSON.stringify({ 書く: 4 }));
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('transient'));

    await useSpacedRepStore.getState().recordResult('書く', false);
    expect(useSpacedRepStore.getState()).toMatchObject({ loaded: false, loadError: true });
    expect(JSON.parse(mockStorage.get('spaced_rep_weights')!)).toEqual({ 書く: 4 });

    await useSpacedRepStore.getState().recordResult('書く', false);

    expect(useSpacedRepStore.getState()).toMatchObject({
      loaded: true,
      loadError: false,
      weights: { 書く: 5 },
    });
    expect(JSON.parse(mockStorage.get('spaced_rep_weights')!)).toEqual({ 書く: 5 });
  });

  test('practice settings drops unknown persisted values and refills empty subsets', async () => {
    mockStorage.set(
      'practiceSettings',
      JSON.stringify({ activeForms: ['te', 'bogus_form'], activeLevels: [] }),
    );

    await usePracticeSettingsStore.getState().loadPracticeSettings();

    expect(usePracticeSettingsStore.getState().activeForms).toEqual(['te']);
    expect(usePracticeSettingsStore.getState().activeLevels).toEqual(allLevels);
  });

  test('practice settings write failure leaves in-memory state unchanged', async () => {
    await usePracticeSettingsStore.getState().loadPracticeSettings();
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));

    await usePracticeSettingsStore.getState().setActiveForms(['te']);

    expect(usePracticeSettingsStore.getState().activeForms).toEqual(allForms);
    expect(mockStorage.get('practiceSettings')).toBeUndefined();
  });

  test('theme load failure leaves loaded false and toggle refuses to write', async () => {
    mockStorage.set('theme_mode', 'dark');
    jest.mocked(AsyncStorage.getItem).mockRejectedValue(new Error('disk locked'));

    await useThemeStore.getState().toggleTheme();

    expect(useThemeStore.getState()).toMatchObject({
      isDark: false,
      loaded: false,
      loadError: true,
    });
    expect(mockStorage.get('theme_mode')).toBe('dark');
  });
});
