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
  useFavoritesStore: (selector: (value: { clearFavorites: () => Promise<boolean> }) => unknown) =>
    selector({ clearFavorites: () => mockClearFavorites() }),
}));
jest.mock('../store/historyStore', () => ({
  useHistoryStore: (selector: (value: { clearHistory: () => Promise<boolean> }) => unknown) =>
    selector({ clearHistory: () => mockClearHistory() }),
}));
jest.mock('../store/quizStore', () => ({
  useQuizStore: (selector: (value: { resetStats: () => Promise<boolean> }) => unknown) =>
    selector({ resetStats: () => mockResetQuizStats() }),
}));
jest.mock('../store/sessionStore', () => ({
  useSessionStore: (selector: (value: { clearSessions: () => Promise<boolean> }) => unknown) =>
    selector({ clearSessions: () => mockClearQuizSessions() }),
}));
jest.mock('../store/flashcardStatsStore', () => ({
  useFlashcardStatsStore: (selector: (value: { resetStats: () => Promise<boolean> }) => unknown) =>
    selector({ resetStats: () => mockResetFlashcardStats() }),
}));
jest.mock('../store/flashcardSessionStore', () => ({
  useFlashcardSessionStore: (selector: (value: { clearSessions: () => Promise<boolean> }) => unknown) =>
    selector({ clearSessions: () => mockClearFlashcardSessions() }),
}));
jest.mock('../store/spacedRepStore', () => ({
  useSpacedRepStore: (selector: (value: { resetWeights: () => Promise<boolean> }) => unknown) =>
    selector({ resetWeights: () => mockResetWeights() }),
}));

describe('FeedbackScreen', () => {
  const originalPlatform = Platform.OS;
  const resetActions = [
    mockClearFavorites,
    mockClearHistory,
    mockResetQuizStats,
    mockClearQuizSessions,
    mockResetFlashcardStats,
    mockClearFlashcardSessions,
    mockResetWeights,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    resetActions.forEach(reset => reset.mockResolvedValue(true));
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

  it('names Google Play when both Android store links fail', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('No store handler'));
    const alert = jest.spyOn(Alert, 'alert');
    const screen = render(<FeedbackScreen />);

    fireEvent.press(screen.getByLabelText('Rate ConjuGo JP on Google Play'));

    await waitFor(() => expect(alert).toHaveBeenCalledWith(
      'Google Play Unavailable',
      'Could not open the Google Play listing.',
    ));
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

    for (const reset of resetActions) {
      expect(reset).toHaveBeenCalledTimes(1);
    }
    expect(alert).toHaveBeenLastCalledWith('Learning data reset');
  });

  it('reports a partial reset without claiming full success', async () => {
    mockResetWeights.mockResolvedValue(false);
    const alert = jest.spyOn(Alert, 'alert');
    const screen = render(<FeedbackScreen />);

    fireEvent.press(screen.getByLabelText('Reset all learning data'));
    const resetButton = alert.mock.calls[0][2]?.find(button => button.text === 'Reset');
    await act(async () => {
      await resetButton?.onPress?.();
    });

    expect(alert).toHaveBeenLastCalledWith(
      'Reset incomplete',
      expect.stringContaining('adaptive weights'),
    );
    expect(alert).not.toHaveBeenCalledWith('Learning data reset');
  });

  it('distinguishes a total reset failure from partial failure', async () => {
    resetActions.forEach(reset => reset.mockResolvedValue(false));
    const alert = jest.spyOn(Alert, 'alert');
    const screen = render(<FeedbackScreen />);

    fireEvent.press(screen.getByLabelText('Reset all learning data'));
    const resetButton = alert.mock.calls[0][2]?.find(button => button.text === 'Reset');
    await act(async () => {
      await resetButton?.onPress?.();
    });

    expect(alert).toHaveBeenLastCalledWith(
      'Reset failed',
      expect.stringContaining('No learning data was cleared'),
    );
    expect(alert).not.toHaveBeenCalledWith('Learning data reset');
  });
});
