import React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { getTodayKey } from '../utils/dayKey';
import PracticeStatsView, { type PracticeStatsLabels } from '../components/PracticeStatsView';

jest.mock(
  '@react-native-async-storage/async-storage',
  // The package ships this CommonJS mock as its supported Jest integration.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
const mockAddListener = jest.fn();
const mockNavigation = { addListener: mockAddListener };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation }));

const labels: PracticeStatsLabels = {
  countLabel: 'Questions',
  daysLabel: 'Days',
  loadingText: 'Loading stats...',
  errorText: 'Could not load stats.',
  retryAccessibilityLabel: 'Retry loading stats',
  emptyIcon: 'bar-chart-outline',
  emptySubtitle: 'Start a quiz to see your progress',
};

const commonProps = {
  sessions: [],
  sessionsLoaded: true,
  sessionsLoadError: false,
  weights: {},
  weightsLoaded: true,
  weightsLoadError: false,
  onRetry: jest.fn(),
  labels,
};

describe('PracticeStatsView', () => {
  beforeEach(() => {
    mockAddListener.mockClear().mockReturnValue(jest.fn());
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  });
  afterEach(() => jest.restoreAllMocks());

  it('refreshes today and the current month on foregrounding and focus', () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date(2026, 9, 31, 23, 59));
      const listener = jest.mocked(AppState.addEventListener);
      const screen = render(<PracticeStatsView {...commonProps} sessions={[{ day: '2026-10-31', count: 1, correct: 1 }]} />);
      expect(screen.getByText('October 2026')).toBeTruthy();
      expect(screen.getByText('Today')).toBeTruthy();

      jest.setSystemTime(new Date(2026, 10, 1, 1));
      act(() => listener.mock.calls[0][1]('active'));
      expect(screen.getByText('November 2026')).toBeTruthy();
      expect(screen.queryByText('Today')).toBeNull();

      jest.setSystemTime(new Date(2026, 11, 1, 1));
      act(() => mockAddListener.mock.calls[0][1]());
      expect(screen.getByText('December 2026')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('replaces zero-filled dashboards with the empty state', () => {
    const screen = render(<PracticeStatsView {...commonProps} />);

    expect(screen.getByText('No stats yet')).toBeTruthy();
    expect(screen.queryByText('All Time')).toBeNull();
    expect(screen.queryByText('Activity')).toBeNull();
  });

  it('dims and disables forward navigation on the current month', () => {
    const screen = render(<PracticeStatsView {...commonProps} sessions={[{ day: getTodayKey(), count: 1, correct: 1 }]} />);
    const next = () => screen.getByRole('button', { name: 'Next month' });
    expect(next()).toBeDisabled();
    expect(next()).toHaveStyle({ opacity: 0.45 });
    fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    expect(next()).toBeEnabled();
    fireEvent.press(next());
    expect(next()).toBeDisabled();
  });

  it('surfaces weight storage failures and retries them', () => {
    const onRetry = jest.fn();
    const screen = render(
      <PracticeStatsView
        {...commonProps}
        weightsLoaded={false}
        weightsLoadError
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText(labels.errorText)).toBeTruthy();
    fireEvent.press(screen.getByLabelText(labels.retryAccessibilityLabel));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
