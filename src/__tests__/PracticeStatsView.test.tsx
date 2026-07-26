import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import PracticeStatsView, { type PracticeStatsLabels } from '../components/PracticeStatsView';

jest.mock(
  '@react-native-async-storage/async-storage',
  // The package ships this CommonJS mock as its supported Jest integration.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

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
  it('replaces zero-filled dashboards with the empty state', () => {
    const screen = render(<PracticeStatsView {...commonProps} />);

    expect(screen.getByText('No stats yet')).toBeTruthy();
    expect(screen.queryByText('All Time')).toBeNull();
    expect(screen.queryByText('Activity')).toBeNull();
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
