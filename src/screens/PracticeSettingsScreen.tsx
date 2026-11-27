import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { FORM_LABELS, FORM_GROUPS } from '../utils/conjugate';
import { ADJECTIVE_FORM_GROUPS, ADJECTIVE_FORM_LABELS } from '../utils/adjectives';
import {
  usePracticeSettingsStore,
  allForms,
  allLevels,
  allAdjectiveForms,
  beginnerAdjectiveForms,
} from '../store/practiceSettingsStore';
import type { PracticeSettingsParams, QuizStackParamList } from '../types/navigation';

type PracticeSettingsRouteParamList = {
  PracticeSettings: PracticeSettingsParams;
};

export default function PracticeSettingsScreen() {
  const colors = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<QuizStackParamList, 'PracticeSettings'>>();
  const route = useRoute<RouteProp<PracticeSettingsRouteParamList, 'PracticeSettings'>>();
  const mode = route.params.mode;

  const {
    activeForms, activeLevels,
    adjectivesEnabled, activeAdjectiveForms, adjectiveNoticeDismissed, loaded,
    loadPracticeSettings, toggleForm, toggleLevel,
    setActiveForms, setActiveLevels,
    setAdjectivesEnabled, toggleAdjectives, setActiveAdjectiveForms, toggleAdjectiveForm, dismissAdjectiveNotice,
  } = usePracticeSettingsStore();

  useEffect(() => {
    loadPracticeSettings();
  }, [loadPracticeSettings]);

  const allFormsSelected = activeForms.length === allForms.length;
  const allLevelsSelected = activeLevels.length === allLevels.length;
  const allAdjectiveFormsSelected = activeAdjectiveForms.length === allAdjectiveForms.length;

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.goBack();
  };

  // Map FORM_GROUPS to the settings format (exclude dictionary form)
  const formGroups = FORM_GROUPS.map(group => ({
    title: `${group.titleJa} — ${group.title}`,
    forms: group.forms
      .filter(f => f !== 'dictionary')
      .map(f => ({ key: f, label: `${FORM_LABELS[f].ja} (${FORM_LABELS[f].en})` })),
  })).filter(g => g.forms.length > 0);

  const adjectiveFormGroups = ADJECTIVE_FORM_GROUPS.map(group => ({
    title: `${group.titleJa} — ${group.title}`,
    forms: group.forms.map(f => ({ key: f, label: `${ADJECTIVE_FORM_LABELS[f].ja} (${ADJECTIVE_FORM_LABELS[f].en})` })),
  }));

  const renderCheckRow = (label: string, active: boolean, onPress: () => void, last: boolean, accessibilityLabel = label) => (
    <TouchableOpacity
      key={label}
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: active }}
    >
      <Text style={[styles.rowText, { color: colors.textPrimary }]}>{label}</Text>
      <Ionicons
        name={active ? 'checkmark-circle' : 'ellipse-outline'}
        size={24}
        color={active ? colors.primaryText : colors.uncheckedOutline}
      />
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* One-time note for learners who used the app before adjectives existed */}
      {loaded && !adjectiveNoticeDismissed && (
        <View
          style={[styles.noticeCard, { backgroundColor: colors.card, borderColor: colors.primaryText }]}
          accessibilityRole="summary"
        >
          <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>New: adjectives and だ/です</Text>
          <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
            Practice い-adjectives, な-adjectives and だ/です alongside your verbs.
          </Text>
          <View style={styles.noticeButtons}>
            <TouchableOpacity
              style={[styles.noticeButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setAdjectivesEnabled(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Turn on adjectives"
            >
              <Text style={styles.noticeButtonText}>Turn on</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.noticeButton, { borderColor: colors.textMuted, borderWidth: 1 }]}
              onPress={() => dismissAdjectiveNotice()}
              accessibilityRole="button"
              accessibilityLabel="Dismiss the adjectives note"
            >
              <Text style={[styles.noticeDismissText, { color: colors.textPrimary }]}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Forms */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Verb Forms</Text>
        <TouchableOpacity
          style={styles.selectAllButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveForms(allFormsSelected ? ['masu'] : [...allForms]);
          }}
          accessibilityRole="button"
          accessibilityLabel={allFormsSelected ? 'ます only' : 'Select all forms'}
        >
          <Text style={[styles.selectAllText, { color: colors.primaryText }]}>
            {allFormsSelected ? 'ます only' : 'Select All'}
          </Text>
        </TouchableOpacity>
      </View>
      {formGroups.map((group) => (
        <View key={group.title}>
          <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{group.title}</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {group.forms.map((item, i) => {
              const active = activeForms.includes(item.key);
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.row,
                    i < group.forms.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    toggleForm(item.key);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityLabel={item.label}
                  accessibilityState={{ checked: active }}
                >
                  <Text style={[styles.rowText, { color: colors.textPrimary }]}>{item.label}</Text>
                  <Ionicons
                    name={active ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={active ? colors.primaryText : colors.uncheckedOutline}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {/* Adjectives */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Adjectives</Text>
        {adjectivesEnabled && (
          <TouchableOpacity
            style={styles.selectAllButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveAdjectiveForms(allAdjectiveFormsSelected ? [...beginnerAdjectiveForms] : [...allAdjectiveForms]);
            }}
            accessibilityRole="button"
            accessibilityLabel={allAdjectiveFormsSelected ? 'Select recommended adjective forms' : 'Select all adjective forms'}
          >
            <Text style={[styles.selectAllText, { color: colors.primaryText }]}>
              {allAdjectiveFormsSelected ? 'Recommended forms' : 'Select All'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {renderCheckRow('Practice い/な-adjectives and だ/です', adjectivesEnabled, toggleAdjectives, true)}
      </View>
      {adjectivesEnabled && adjectiveFormGroups.map((group) => (
        <View key={group.title}>
          <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{group.title}</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {group.forms.map((item, i) => renderCheckRow(
              item.label,
              activeAdjectiveForms.includes(item.key),
              () => toggleAdjectiveForm(item.key),
              i === group.forms.length - 1,
              `Adjective form, ${item.label}`,
            ))}
          </View>
        </View>
      ))}

      {/* Levels */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>JLPT Levels</Text>
        <TouchableOpacity
          style={styles.selectAllButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveLevels(allLevelsSelected ? ['N5'] : [...allLevels]);
          }}
          accessibilityRole="button"
          accessibilityLabel={allLevelsSelected ? 'N5 only' : 'Select all JLPT levels'}
        >
          <Text style={[styles.selectAllText, { color: colors.primaryText }]}>
            {allLevelsSelected ? 'N5 only' : 'Select All'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {allLevels.map((level, i) => {
          const active = activeLevels.includes(level);
          return (
            <TouchableOpacity
              key={level}
              style={[
                styles.row,
                i < allLevels.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleLevel(level);
              }}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityLabel={`JLPT ${level}`}
              accessibilityState={{ checked: active }}
            >
              <Text style={[styles.rowText, { color: colors.textPrimary }]}>{level}</Text>
              <Ionicons
                name={active ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={active ? colors.primaryText : colors.uncheckedOutline}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Start button */}
      <TouchableOpacity
        style={[styles.startButton, { backgroundColor: colors.primary }]}
        onPress={handleStart}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={mode === 'quiz' ? 'Start quiz' : 'Start flashcards'}
      >
        <Ionicons name="play" size={20} color="#fff" />
        <Text style={styles.startButtonText}>
          {mode === 'quiz' ? 'Start Quiz' : 'Start Flashcards'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 40 },
  sectionHeader: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  sectionTitle: {
    flexShrink: 1,
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  selectAllText: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.medium,
  },
  selectAllButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  groupLabel: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  rowText: {
    flexShrink: 1,
    marginRight: spacing.sm,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.medium,
  },
  noticeCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  noticeTitle: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
  },
  noticeText: {
    fontSize: fonts.sizes.sm,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  noticeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  noticeButton: {
    maxWidth: '100%',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  noticeButtonText: {
    color: '#fff',
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
  },
  noticeDismissText: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  startButtonText: {
    color: '#fff',
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
  },
});
