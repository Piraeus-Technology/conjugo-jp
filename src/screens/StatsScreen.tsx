import React from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useSpacedRepStore } from '../store/spacedRepStore';
import PracticeStatsView, { DayCounts } from '../components/PracticeStatsView';

export default function StatsScreen() {
  const {
    sessions,
    loaded: sessionsLoaded,
    loadError: sessionsLoadError,
    loadSessions,
  } = useSessionStore();
  const {
    weights,
    loaded: weightsLoaded,
    loadError: weightsLoadError,
    loadWeights,
  } = useSpacedRepStore();

  React.useEffect(() => {
    loadSessions();
    loadWeights();
  }, [loadSessions, loadWeights]);

  const dayCounts: DayCounts[] = React.useMemo(
    () => sessions.map(s => ({ day: s.day, count: s.total, correct: s.correct })),
    [sessions],
  );

  return (
    <PracticeStatsView
      sessions={dayCounts}
      sessionsLoaded={sessionsLoaded}
      sessionsLoadError={sessionsLoadError}
      weights={weights}
      weightsLoaded={weightsLoaded}
      weightsLoadError={weightsLoadError}
      onRetry={() => {
        loadSessions();
        loadWeights();
      }}
      labels={{
        countLabel: 'Questions',
        daysLabel: 'Days',
        loadingText: 'Loading stats...',
        errorText: 'Could not load stats.',
        retryAccessibilityLabel: 'Retry loading stats',
        emptyIcon: 'bar-chart-outline',
        emptySubtitle: 'Start a quiz to see your progress',
      }}
    />
  );
}
