import React from 'react';
import {
  Alert,
  Linking,
  Platform,
  Share,
} from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import FeedbackScreen from '../screens/FeedbackScreen';

const mockClearFavorites = jest.fn();
const mockClearHistory = jest.fn();
const mockResetQuizStats = jest.fn();
const mockClearQuizSessions = jest.fn();
const mockResetFlashcardStats = jest.fn();
const mockClearFlashcardSessions = jest.fn();
const mockResetWeights = jest.fn();

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.2.0' } }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock('../utils/tipJar', () => ({
  useTipJar: () => ({
    products: [],
    loading: false,
    unavailable: false,
    unsupported: false,
    tip: jest.fn(),
  }),
}));
jest.mock('../store/themeStore', () => {
  const state = {
    isDark: false,
    autoTTS: false,
    toggleTheme: jest.fn(),
    toggleAutoTTS: jest.fn(),
  };
  return {
    useThemeStore: (selector?: (value: typeof state) => unknown) =>
      selector ? selector(state) : state,
  };
});
jest.mock('../store/favoritesStore', () => ({
  useFavoritesStore: (selector: (value: { clearFavorites: () => void }) => unknown) =>
    selector({ clearFavorites: () => mockClearFavorites() }),
}));
jest.mock('../store/historyStore', () => ({
  useHistoryStore: (selector: (value: { clearHistory: () => void }) => unknown) =>
    selector({ clearHistory: () => mockClearHistory() }),
}));
jest.mock('../store/quizStore', () => ({
  useQuizStore: (selector: (value: { resetStats: () => void }) => unknown) =>
    selector({ resetStats: () => mockResetQuizStats() }),
}));
jest.mock('../store/sessionStore', () => ({
  useSessionStore: (selector: (value: { clearSessions: () => void }) => unknown) =>
    selector({ clearSessions: () => mockClearQuizSessions() }),
}));
jest.mock('../store/flashcardStatsStore', () => ({
  useFlashcardStatsStore: (selector: (value: { resetStats: () => void }) => unknown) =>
    selector({ resetStats: () => mockResetFlashcardStats() }),
}));
jest.mock('../store/flashcardSessionStore', () => ({
  useFlashcardSessionStore: (selector: (value: { clearSessions: () => void }) => unknown) =>
    selector({ clearSessions: () => mockClearFlashcardSessions() }),
}));
jest.mock('../store/spacedRepStore', () => ({
  useSpacedRepStore: (selector: (value: { resetWeights: () => void }) => unknown) =>
    selector({ resetWeights: () => mockResetWeights() }),
}));

describe('FeedbackScreen', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('uses Android store wording and falls back to the Play web listing', async () => {
    const openUrl = jest.spyOn(Linking, 'openURL')
      .mockRejectedValueOnce(new Error('No market handler'))
      .mockResolvedValueOnce(undefined);
    const screen = render(<FeedbackScreen />);

    fireEvent.press(screen.getByLabelText('Rate ConjuGo JP on Google Play'));

    await waitFor(() => expect(openUrl).toHaveBeenNthCalledWith(
      2,
      'https://play.google.com/store/apps/details?id=com.piraeus.conjugojp',
    ));
    expect(screen.getByText('Rate us on Google Play')).toBeTruthy();
  });

  it('shares a tappable platform store link and derives the app version', () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    const screen = render(<FeedbackScreen />);

    fireEvent.press(screen.getByLabelText('Share ConjuGo JP'));

    expect(share).toHaveBeenCalledWith({
      message: expect.stringContaining('https://play.google.com/store/apps/details?id=com.piraeus.conjugojp'),
    });
    expect(screen.getByText('ConjuGo JP v1.2.0')).toBeTruthy();
  });

  it('requires confirmation before clearing every category of learning data', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const screen = render(<FeedbackScreen />);

    fireEvent.press(screen.getByLabelText('Reset all learning data'));
    const buttons = alert.mock.calls[0][2];
    const resetButton = buttons?.find(button => button.text === 'Reset');
    await act(async () => {
      await resetButton?.onPress?.();
    });

    for (const reset of [
      mockClearFavorites,
      mockClearHistory,
      mockResetQuizStats,
      mockClearQuizSessions,
      mockResetFlashcardStats,
      mockClearFlashcardSessions,
      mockResetWeights,
    ]) {
      expect(reset).toHaveBeenCalledTimes(1);
    }
  });
});
