import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useQuizStore } from '../store/quizStore';
import { useSessionStore } from '../store/sessionStore';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function StatsScreen() {
  const colors = useColors();
  const { totalQuestions, totalCorrect, bestStreak, loadStats } = useQuizStore();
  const { sessions, loadSessions } = useSessionStore();
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  React.useEffect(() => {
    loadStats();
    loadSessions();
  }, []);

  // Aggregate sessions by day
  const dailyMap: Record<string, { total: number; correct: number }> = {};
  sessions.forEach(s => {
    const key = new Date(s.date).toLocaleDateString('en-CA');
    if (!dailyMap[key]) dailyMap[key] = { total: 0, correct: 0 };
    dailyMap[key].total += s.total;
    dailyMap[key].correct += s.correct;
  });

  // Today stats
  const todayStr = new Date().toLocaleDateString('en-CA');
  const todayData = dailyMap[todayStr];

  // Streak calculation
  let streak = 0;
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toLocaleDateString('en-CA');
  if (dailyMap[todayStr] || dailyMap[yesterdayStr]) {
    let checkDate = new Date();
    if (!dailyMap[todayStr]) checkDate.setDate(checkDate.getDate() - 1);
    while (true) {
      const key = checkDate.toLocaleDateString('en-CA');
      if (dailyMap[key]) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Calendar helpers
  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const monthName = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDay = new Date(calYear, calMonth, 1);
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const calendarWeeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) {
      calendarWeeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    calendarWeeks.push(week);
  }

  const getDayColor = (day: number) => {
    const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const data = dailyMap[key];
    if (!data) return null;
    const pct = Math.round((data.correct / data.total) * 100);
    if (pct >= 80) return { bg: '#E8F5E9', text: '#2E7D32' };
    if (pct >= 50) return { bg: '#FFF8E1', text: '#F57F17' };
    return { bg: '#FFEBEE', text: '#C62828' };
  };

  const getDayKey = (day: number) =>
    `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const prevMonth = () => {
    setCalendarDate(new Date(calYear, calMonth - 1, 1));
    setSelectedDay(null);
  };
  const nextMonth = () => {
    const now = new Date();
    const next = new Date(calYear, calMonth + 1, 1);
    if (next <= new Date(now.getFullYear(), now.getMonth() + 1, 1)) {
      setCalendarDate(next);
      setSelectedDay(null);
    }
  };

  const selectedData = selectedDay ? dailyMap[selectedDay] : null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* Streak */}
      {streak > 0 && (
        <View style={[styles.streakCard, { backgroundColor: colors.card }]}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={[styles.streakText, { color: colors.primary }]}>
            {streak} day streak
          </Text>
        </View>
      )}

      {/* All-time stats */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>All Time</Text>
      <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{totalQuestions}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Questions</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0}%
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Accuracy</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.accent || colors.primary }]}>{bestStreak}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Best Streak</Text>
          </View>
        </View>
      </View>

      {/* Today */}
      {todayData && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: spacing.lg }]}>Today</Text>
          <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{todayData.total}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Questions</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                  {Math.round((todayData.correct / todayData.total) * 100)}%
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Accuracy</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.textSecondary }]}>
                  {todayData.correct}/{todayData.total}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Score</Text>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Calendar */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: spacing.lg }]}>Activity</Text>
      <View style={[styles.calendarCard, { backgroundColor: colors.card }]}>
        {/* Month navigation */}
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.calendarMonth, { color: colors.textPrimary }]}>{monthName}</Text>
          <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Weekday headers */}
        <View style={styles.calendarRow}>
          {WEEKDAYS.map(d => (
            <Text key={d} style={[styles.weekdayLabel, { color: colors.textMuted }]}>{d}</Text>
          ))}
        </View>

        {/* Day grid */}
        {calendarWeeks.map((week, wi) => (
          <View key={wi} style={styles.calendarRow}>
            {week.map((day, di) => {
              if (day === null) {
                return <View key={di} style={styles.calendarCell} />;
              }
              const dayColor = getDayColor(day);
              const key = getDayKey(day);
              const isSelected = selectedDay === key;
              const isToday = key === todayStr;

              return (
                <TouchableOpacity
                  key={di}
                  style={[
                    styles.calendarCell,
                    dayColor && { backgroundColor: dayColor.bg },
                    isSelected && { borderWidth: 2, borderColor: colors.primary },
                    isToday && !dayColor && { borderWidth: 1, borderColor: colors.border },
                  ]}
                  onPress={() => {
                    if (dailyMap[key]) setSelectedDay(isSelected ? null : key);
                  }}
                  activeOpacity={dailyMap[key] ? 0.7 : 1}
                >
                  <Text style={[
                    styles.calendarDay,
                    { color: dayColor ? dayColor.text : colors.textPrimary },
                    !dayColor && { color: colors.textMuted },
                  ]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Selected day detail */}
        {selectedDay && selectedData && (
          <View style={[styles.selectedDetail, { borderTopColor: colors.divider }]}>
            <Text style={[styles.selectedDate, { color: colors.textPrimary }]}>
              {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
            <Text style={[styles.selectedStat, { color: colors.textSecondary }]}>
              {selectedData.correct}/{selectedData.total} · {Math.round((selectedData.correct / selectedData.total) * 100)}% accuracy
            </Text>
          </View>
        )}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#E8F5E9' }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>≥80%</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FFF8E1' }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>≥50%</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FFEBEE' }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>&lt;50%</Text>
        </View>
      </View>

      {/* Empty state */}
      {totalQuestions === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="bar-chart-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No stats yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Start a quiz to see your progress
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 40 },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  streakEmoji: { fontSize: 24 },
  streakText: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.bold },
  sectionTitle: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  statsCard: {
    borderRadius: radius.md,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold },
  statLabel: {
    fontSize: fonts.sizes.xs,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarCard: {
    borderRadius: radius.md,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  calendarMonth: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
  },
  calendarRow: {
    flexDirection: 'row',
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    marginBottom: spacing.xs,
  },
  calendarCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    margin: 2,
  },
  calendarDay: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.medium,
  },
  selectedDetail: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  selectedDate: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
  },
  selectedStat: {
    fontSize: fonts.sizes.sm,
    marginTop: 4,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: fonts.sizes.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.bold,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: fonts.sizes.md,
    marginTop: spacing.sm,
  },
});
