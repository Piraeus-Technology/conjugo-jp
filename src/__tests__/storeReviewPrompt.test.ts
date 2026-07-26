import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import {
  __resetStoreReviewPromptForTests,
  getStoreReviewMarkerKey,
  maybeRequestStoreReview,
} from '../utils/storeReviewPrompt';

const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
}));

jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  requestReview: jest.fn(() => Promise.resolve()),
}));

const earnedContext = {
  appVersion: '1.4.0',
  newStreak: 10,
  totalQuestionsAtVisitStart: 49,
  answersThisVisitBeforeCurrent: 0,
  sessionDays: ['2026-07-24', '2026-07-25'],
  currentDay: '2026-07-26',
};

describe('store-review prompt policy', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockStorage.clear();
    jest.clearAllMocks();
    __resetStoreReviewPromptForTests();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('does not request a review before both engagement thresholds are met', async () => {
    await expect(maybeRequestStoreReview({
      ...earnedContext,
      totalQuestionsAtVisitStart: 48,
    })).resolves.toBe(false);
    await expect(maybeRequestStoreReview({
      ...earnedContext,
      sessionDays: ['2026-07-25'],
    })).resolves.toBe(false);
    await expect(maybeRequestStoreReview({
      ...earnedContext,
      newStreak: 11,
    })).resolves.toBe(false);

    expect(StoreReview.isAvailableAsync).not.toHaveBeenCalled();
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });

  it('counts the current answer and current day at the exact threshold', async () => {
    await expect(maybeRequestStoreReview(earnedContext)).resolves.toBe(true);

    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
    expect(mockStorage.get(getStoreReviewMarkerKey('1.4.0'))).toBe('true');
  });

  it('does not request a version already marked in persistent storage', async () => {
    mockStorage.set(getStoreReviewMarkerKey('1.4.0'), 'true');

    await expect(maybeRequestStoreReview(earnedContext)).resolves.toBe(false);

    expect(StoreReview.isAvailableAsync).not.toHaveBeenCalled();
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });

  it('does not prompt when the app version is absent', async () => {
    await expect(maybeRequestStoreReview({
      ...earnedContext,
      appVersion: undefined,
    })).resolves.toBe(false);

    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });

  it('does not consume the version when the native API is unavailable', async () => {
    jest.mocked(StoreReview.isAvailableAsync)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(maybeRequestStoreReview(earnedContext)).resolves.toBe(false);
    await expect(maybeRequestStoreReview(earnedContext)).resolves.toBe(true);

    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('keeps an in-memory guard when marker persistence fails', async () => {
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));

    await expect(maybeRequestStoreReview(earnedContext)).resolves.toBe(true);
    await expect(maybeRequestStoreReview(earnedContext)).resolves.toBe(false);

    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });
});
