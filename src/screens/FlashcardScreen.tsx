import React, { useState, useRef, useMemo, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  AppState,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import type { AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import verbs from '../data/verbs.json';
import { VerbData, JLPTLevel } from '../utils/conjugate';
import { adjectiveList } from '../utils/adjectives';
import {
  describeCard,
  generatePracticeCard,
  type PracticeCard,
  type PracticePool,
} from '../utils/practiceItems';
import { speak, stopSpeech } from '../utils/speech';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { usePracticeSettingsStore } from '../store/practiceSettingsStore';
import { useFlashcardSessionStore } from '../store/flashcardSessionStore';
import { useFlashcardStatsStore } from '../store/flashcardStatsStore';
import { useSpacedRepStore } from '../store/spacedRepStore';
import { useThemeStore } from '../store/themeStore';
import { useSessionAutosave } from '../hooks/useSessionAutosave';
import { useTodayKey } from '../hooks/useTodayKey';
import type { FlashcardStackParamList } from '../types/navigation';

const allVerbEntries = Object.entries(verbs as Record<string, VerbData>);

export default function FlashcardScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<FlashcardStackParamList, 'FlashcardMain'>>();
  const {
    activeForms,
    activeLevels,
    adjectivesEnabled,
    activeAdjectiveForms,
    loaded: settingsLoaded,
    loadError: settingsLoadError,
    loadPracticeSettings,
  } = usePracticeSettingsStore();
  const { sessions, loadSessions, saveSession } = useFlashcardSessionStore();
  const { loadStats, recordReview } = useFlashcardStatsStore();
  const {
    loaded: weightsLoaded,
    loadError: weightsLoadError,
    loadWeights,
    getWeight,
    recordResult,
  } = useSpacedRepStore();
  const { autoTTS } = useThemeStore();
  const pool = useMemo((): PracticePool => ({
    verbEntries: allVerbEntries.filter(([, d]) => activeLevels.includes(d.jlpt as JLPTLevel)),
    verbForms: activeForms,
    adjectiveEntries: adjectiveList.filter(([, d]) => activeLevels.includes(d.jlpt)),
    adjectiveForms: activeAdjectiveForms,
    adjectivesEnabled,
  }), [activeLevels, activeForms, activeAdjectiveForms, adjectivesEnabled]);
  const [card, setCard] = useState<PracticeCard | null>(null);
  const view = useMemo(() => (card ? describeCard(card) : null), [card]);
  const [flipped, setFlipped] = useState(false);
  const [flipAnim] = useState(() => new Animated.Value(0));
  const isAnimating = useRef(false);
  const hasGradedCard = useRef(false);
  const speechGate = useRef({
    focused: true,
    appState: AppState.currentState as AppStateStatus,
  });

  useEffect(() => {
    loadPracticeSettings();
    loadSessions();
    loadStats();
    loadWeights();
  }, [loadPracticeSettings, loadSessions, loadStats, loadWeights]);

  useFocusEffect(useCallback(() => {
    speechGate.current.focused = true;
    return () => {
      speechGate.current.focused = false;
      stopSpeech();
    };
  }, []));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      speechGate.current.appState = state;
    });
    return () => sub.remove();
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('PracticeSettings', { mode: 'flashcards' })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Open form and level settings"
        >
          <Text style={{ color: colors.primaryText, fontSize: 14, fontWeight: '600' }}>Forms</Text>
          <Ionicons name="options-outline" size={18} color={colors.primaryText} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  useEffect(() => {
    if (!settingsLoaded || !weightsLoaded) return;
    flipAnim.stopAnimation(() => {
      flipAnim.setValue(0);
      isAnimating.current = false;
      hasGradedCard.current = false;
      setFlipped(false);
      setCard(generatePracticeCard(pool, getWeight));
    });
  }, [settingsLoaded, weightsLoaded, pool, flipAnim, getWeight]);

  const flipToFront = () => {
    isAnimating.current = true;
    Animated.timing(flipAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        isAnimating.current = false;
        hasGradedCard.current = false;
        return;
      }
      setCard(generatePracticeCard(pool, getWeight));
      setFlipped(false);
      isAnimating.current = false;
      hasGradedCard.current = false;
    });
  };

  const flip = () => {
    if (!view || isAnimating.current || flipped) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlipped(true);
    isAnimating.current = true;
    Animated.timing(flipAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      isAnimating.current = false;
      if (
        autoTTS &&
        speechGate.current.focused &&
        speechGate.current.appState === 'active'
      ) {
        speak(view.answer);
      }
    });
  };

  const handleGotIt = () => {
    // Synchronous ref guard: flipped is stale state during the flip-back
    // animation, so a rapid double-tap would otherwise record the card twice.
    if (!view || !flipped || hasGradedCard.current) return;
    hasGradedCard.current = true;
    stopSpeech();
    setFlipped(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    recordProgress(true);
    recordReview(true).catch(() => {});
    recordResult(view.srKey, true).catch(() => {});
    flipToFront();
  };

  const handleMissed = () => {
    if (!view || !flipped || hasGradedCard.current) return;
    hasGradedCard.current = true;
    stopSpeech();
    setFlipped(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    recordProgress(false);
    recordReview(false).catch(() => {});
    recordResult(view.srKey, false).catch(() => {});
    flipToFront();
  };

  const { unsavedCount, unsavedCorrect, recordProgress } = useSessionAutosave({
    readResetCount: () => useFlashcardSessionStore.getState().resetCount,
    save: async ({ count, correct, day }, beforePublish) => {
      // Finish an in-flight lifetime seed before it can read this new review
      // from daily storage. recordReview accounts for the new review itself.
      if (!useFlashcardStatsStore.getState().loaded) await loadStats();
      if (!(await saveSession({ reviewed: count, correct }, day, beforePublish))) {
        throw new Error('flashcard session save failed');
      }
    },
  });

  // Today's cumulative totals plus any unsaved in-memory progress.
  const todayKey = useTodayKey();
  const todaySession = sessions.find(s => s.day === todayKey);
  const reviewed = (todaySession?.reviewed || 0) + unsavedCount;
  const correct = (todaySession?.correct || 0) + unsavedCorrect;

  const frontRotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  if ((settingsLoadError && !settingsLoaded) || (weightsLoadError && !weightsLoaded)) return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={{ color: colors.textMuted, fontSize: fonts.sizes.md, textAlign: 'center' }}>
        Couldn&apos;t load flashcard data.
      </Text>
      <TouchableOpacity
        style={[styles.retryButton, { backgroundColor: colors.primary }]}
        onPress={() => {
          loadPracticeSettings();
          loadWeights();
        }}
        accessibilityRole="button"
        accessibilityLabel="Retry loading flashcard data"
      >
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  if (!settingsLoaded || !weightsLoaded) return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={{ color: colors.textMuted, fontSize: fonts.sizes.md }}>Loading flashcards…</Text>
    </View>
  );

  if (!view) return (
    <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ color: colors.textMuted, fontSize: fonts.sizes.md }}>No matching words</Text>
    </View>
  );

  const formLabel = view.formLabel;
  const exampleSentence = view.example;
  const alsoCorrect = view.alsoCorrect.length > 0 ? `Also correct: ${view.alsoCorrect.join('、')}` : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Today's score bar */}
      <View style={[styles.scoreBar, { backgroundColor: colors.card }]}>
        <View style={styles.scoreRow}>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreValue, { color: colors.primaryText }]}>{reviewed}</Text>
            <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Reviewed</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreValue, { color: colors.successText }]}>{correct}</Text>
            <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Got It</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreValue, { color: colors.errorText }]}>{reviewed - correct}</Text>
            <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Missed</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreValue, { color: colors.textSecondary }]}>
              {reviewed > 0 ? Math.round((correct / reviewed) * 100) : 0}%
            </Text>
            <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Accuracy</Text>
          </View>
        </View>
      </View>

      <View style={styles.practiceArea}>
        <View style={[styles.cardContainer, { width: width - spacing.lg * 2 }]}>
          {/* Front */}
          <Animated.View
            pointerEvents={flipped ? 'none' : 'auto'}
            accessibilityElementsHidden={flipped}
            importantForAccessibility={flipped ? 'no-hide-descendants' : 'auto'}
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                transform: [{ perspective: 1000 }, { rotateY: frontRotateY }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.frontContent}
              onPress={flip}
              activeOpacity={0.95}
              accessibilityRole="button"
              accessibilityLabel={`Tap to reveal ${formLabel.en} (${formLabel.ja}) form of ${view.headword}, ${view.reading}, ${view.translation}.${formLabel.meaning ? ` Meaning: ${formLabel.meaning}` : ''}`}
              accessibilityHint="Flips the card to reveal the answer"
            >
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                {formLabel.ja} — {formLabel.en}
              </Text>
              {formLabel.meaning ? (
                <Text style={[styles.formHint, { color: colors.textSecondary }]}>
                  {formLabel.meaning}
                </Text>
              ) : null}
              <Text
                style={[styles.verbText, { color: colors.primaryText }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {view.headword}
              </Text>
              <Text style={[styles.readingText, { color: colors.textSecondary }]}>
                {view.reading}
              </Text>
              <Text style={[styles.translationText, { color: colors.textSecondary }]}>
                {view.translation}
              </Text>
              <Text style={[styles.tapHint, { color: colors.textMuted }]}>
                Tap to reveal
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Back */}
          <Animated.View
            pointerEvents={flipped ? 'auto' : 'none'}
            accessibilityElementsHidden={!flipped}
            importantForAccessibility={flipped ? 'auto' : 'no-hide-descendants'}
            style={[
              styles.card,
              styles.cardBack,
              {
                backgroundColor: colors.flashcardBack,
                borderColor: colors.practiceBorder,
                transform: [{ perspective: 1000 }, { rotateY: backRotateY }],
              },
            ]}
          >
            <ScrollView
              style={styles.cardScroll}
              contentContainerStyle={styles.cardScrollContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              <View
                style={styles.backContent}
                accessible
                accessibilityLabel={`${formLabel.ja}, ${formLabel.en}${formLabel.meaning ? `, ${formLabel.meaning}` : ''}. Answer: ${view.answer}.${alsoCorrect ? ` ${alsoCorrect}.` : ''} ${view.headword}, ${view.translation}${exampleSentence ? `. Example: ${exampleSentence}` : ''}`}
                accessibilityHint="Use Got it or Missed to grade this card"
              >
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                  {formLabel.ja} — {formLabel.en}
                </Text>
                {formLabel.meaning ? (
                  <Text style={[styles.formHint, { color: colors.textSecondary }]}>
                    {formLabel.meaning}
                  </Text>
                ) : null}
                <Text
                  style={[styles.answerText, { color: colors.primaryText }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {view.answer}
                </Text>
                {alsoCorrect && (
                  <Text style={[styles.alsoCorrectText, { color: colors.textSecondary }]}>
                    {alsoCorrect}
                  </Text>
                )}
                <Text style={[styles.contextText, { color: colors.textSecondary }]}>
                  {view.headword}
                </Text>
                <Text style={[styles.answerTranslation, { color: colors.textMuted }]}>
                  {view.translation}
                </Text>
                {exampleSentence && (
                  <>
                    <View style={[styles.exampleDivider, { backgroundColor: colors.border }]} />
                    <Text style={[styles.exampleLabel, { color: colors.textMuted }]}>
                      Example
                    </Text>
                    <Text style={[styles.exampleText, { color: colors.textSecondary }]}>
                      {exampleSentence}
                    </Text>
                  </>
                )}
              </View>
              <TouchableOpacity
                style={[styles.speakButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  if (flipped && !hasGradedCard.current) speak(view.answer);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Play pronunciation of ${view.answer}`}
              >
                <Ionicons name="volume-medium" size={20} color="#fff" />
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>

        {/* Got it / Missed buttons */}
        <View
          style={[styles.buttonRow, { opacity: flipped ? 1 : 0 }]}
          pointerEvents={flipped ? 'auto' : 'none'}
          accessibilityElementsHidden={!flipped}
          importantForAccessibility={flipped ? 'auto' : 'no-hide-descendants'}
        >
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.errorBg, borderColor: colors.errorText }]}
            onPress={handleMissed}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Mark card as missed"
            disabled={!flipped}
            accessibilityState={{ disabled: !flipped }}
          >
            <Ionicons name="close" size={20} color={colors.errorText} />
            <Text style={[styles.actionButtonText, { color: colors.errorText }]}>Missed</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.successBg, borderColor: colors.successText }]}
            onPress={handleGotIt}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Mark card as got it"
            disabled={!flipped}
            accessibilityState={{ disabled: !flipped }}
          >
            <Ionicons name="checkmark" size={20} color={colors.successText} />
            <Text style={[styles.actionButtonText, { color: colors.successText }]}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  scoreBar: {
    alignSelf: 'stretch',
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-around' },
  scoreItem: { alignItems: 'center' },
  scoreValue: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.bold },
  scoreLabel: { fontSize: fonts.sizes.xs, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  practiceArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  cardContainer: {
    flex: 1,
    minHeight: 280,
    maxHeight: 520,
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    backfaceVisibility: 'hidden',
  },
  frontContent: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  cardBack: {
    borderWidth: 2,
  },
  backContent: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  cardScroll: {
    alignSelf: 'stretch',
  },
  cardScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  formLabel: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    letterSpacing: 1,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  formHint: {
    fontSize: fonts.sizes.xs,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  verbText: {
    fontSize: 36,
    fontWeight: fonts.weights.bold,
    marginBottom: spacing.xs,
    textAlign: 'center',
    // Full width so adjustsFontSizeToFit has a bound to shrink within
    // (in a centered column it would otherwise overflow instead of scaling).
    alignSelf: 'stretch',
  },
  readingText: {
    fontSize: fonts.sizes.lg,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  translationText: {
    fontSize: fonts.sizes.md,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  answerText: {
    fontSize: 42,
    fontWeight: fonts.weights.bold,
    marginBottom: spacing.xs,
    textAlign: 'center',
    // Full width so adjustsFontSizeToFit has a bound to shrink within.
    alignSelf: 'stretch',
  },
  answerTranslation: {
    fontSize: fonts.sizes.md,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  alsoCorrectText: {
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  contextText: {
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  exampleDivider: {
    height: StyleSheet.hairlineWidth,
    width: '50%',
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  exampleLabel: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  exampleText: {
    fontSize: fonts.sizes.md,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  speakButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  tapHint: {
    fontSize: fonts.sizes.xs,
    position: 'absolute',
    bottom: spacing.lg,
  },
  buttonRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.xl, borderRadius: radius.md, borderWidth: 1.5 },
  actionButtonText: { fontSize: fonts.sizes.md, fontWeight: fonts.weights.bold },
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
  },
});
