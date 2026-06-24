import React, { useState, useRef, useMemo, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  AppState,
  useWindowDimensions,
} from 'react-native';
import type { AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import verbs from '../data/verbs.json';
import {
  conjugateReading,
  FORM_LABELS,
  ConjugationForm,
  VerbData,
  JLPTLevel,
} from '../utils/conjugate';
import { getExampleSentence } from '../utils/formExamples';
import { chooseQuizzableEntry } from '../utils/practiceSelection';
import { speak, stopSpeech } from '../utils/speech';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { usePracticeSettingsStore } from '../store/practiceSettingsStore';
import { useFlashcardSessionStore } from '../store/flashcardSessionStore';
import { useSpacedRepStore } from '../store/spacedRepStore';
import { useThemeStore } from '../store/themeStore';
import { useSessionAutosave } from '../hooks/useSessionAutosave';
import { getTodayKey } from '../utils/dayKey';
import type { FlashcardStackParamList } from '../types/navigation';

const allVerbEntries = Object.entries(verbs as Record<string, VerbData>);

const flashcardForms: ConjugationForm[] = [
  'masu', 'te', 'ta', 'nai', 'potential', 'passive',
  'causative', 'conditional_ba', 'conditional_tara', 'volitional', 'imperative',
];

interface Card {
  verb: string;
  reading: string;
  translation: string;
  form: ConjugationForm;
  answer: string;
}

function generateCard(entries: [string, VerbData][], forms: ConjugationForm[]): Card | null {
  const verbEntries = entries.length > 0 ? entries : allVerbEntries;
  const activeForms = forms.length > 0 ? forms : flashcardForms;
  const commonCount = Math.min(200, verbEntries.length);
  const selection = chooseQuizzableEntry(verbEntries, activeForms, () => {
    const idx = Math.random() < 0.7
      ? Math.floor(Math.random() * commonCount)
      : Math.floor(Math.random() * verbEntries.length);
    return verbEntries[idx];
  });
  if (!selection) return null;
  const [verb, data] = selection.entry;
  const pool = selection.forms;
  const form = pool[Math.floor(Math.random() * pool.length)];
  const answer = conjugateReading(data, form);
  return {
    verb,
    reading: data.reading,
    translation: data.translation,
    form,
    answer,
  };
}

export default function FlashcardScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<FlashcardStackParamList, 'FlashcardMain'>>();
  const { activeForms, activeLevels, loaded: settingsLoaded, loadPracticeSettings } = usePracticeSettingsStore();
  const { sessions, loadSessions, saveSession } = useFlashcardSessionStore();
  const { recordResult } = useSpacedRepStore();
  const { autoTTS } = useThemeStore();
  const filteredEntries = useMemo(() =>
    allVerbEntries.filter(([, d]) => activeLevels.includes(d.jlpt as JLPTLevel)),
    [activeLevels]
  );
  const [card, setCard] = useState<Card | null>(() => generateCard(allVerbEntries, flashcardForms));
  const [flipped, setFlipped] = useState(false);
  // This-visit answers (monotonic); persisted as deltas by useSessionAutosave.
  const [newReviewed, setNewReviewed] = useState(0);
  const [newCorrect, setNewCorrect] = useState(0);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);
  const speechGate = useRef({
    focused: true,
    appState: AppState.currentState as AppStateStatus,
  });

  useEffect(() => {
    loadPracticeSettings();
    loadSessions();
  }, []);

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
      if (state === 'background' || state === 'inactive') {
        stopSpeech();
      }
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
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Forms</Text>
          <Ionicons name="options-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  const flipToFront = () => {
    isAnimating.current = true;
    Animated.timing(flipAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setCard(generateCard(filteredEntries, activeForms));
      setFlipped(false);
      isAnimating.current = false;
    });
  };

  const flip = () => {
    if (!card || isAnimating.current || flipped) return;
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
        speak(card.answer);
      }
    });
  };

  const handleGotIt = () => {
    // The flipped gate also guards re-entry: the buttons stay tappable during
    // the flip-back animation, and a double-tap would record the card twice.
    if (!card || !flipped) return;
    setFlipped(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewReviewed(r => r + 1);
    setNewCorrect(c => c + 1);
    recordResult(card.verb, true).catch(() => {});
    flipToFront();
  };

  const handleMissed = () => {
    if (!card || !flipped) return;
    setFlipped(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setNewReviewed(r => r + 1);
    recordResult(card.verb, false).catch(() => {});
    flipToFront();
  };

  // Auto-save new answers on blur / background / unmount (delta-based).
  const { unsavedCount, unsavedCorrect } = useSessionAutosave({
    count: newReviewed,
    correct: newCorrect,
    save: async ({ count, correct }) => {
      if (!(await saveSession({ reviewed: count, correct }))) {
        throw new Error('flashcard session save failed');
      }
    },
  });

  // Today's cumulative totals plus any unsaved in-memory progress.
  const todaySession = sessions.find(s => s.day === getTodayKey());
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

  if (!card) return (
    <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ color: colors.textMuted, fontSize: fonts.sizes.md }}>No matching verbs</Text>
    </View>
  );

  const formLabel = FORM_LABELS[card.form];
  const exampleSentence = getExampleSentence(card.verb, card.form);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Today's score bar */}
      <View style={[styles.scoreBar, { backgroundColor: colors.card }]}>
        <View style={styles.scoreRow}>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreValue, { color: colors.primary }]}>{reviewed}</Text>
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
        <TouchableOpacity
          style={[styles.cardContainer, { width: width - spacing.lg * 2 }]}
          onPress={flip}
          activeOpacity={0.95}
          accessibilityRole="button"
          accessibilityLabel={flipped
            ? `${card.verb}, ${card.reading}, ${formLabel.en}${formLabel.meaning ? `, ${formLabel.meaning}` : ''}. Answer: ${card.answer}${exampleSentence ? `. Example: ${exampleSentence}` : ''}`
            : `Tap to reveal ${formLabel.en} form of ${card.verb}, ${card.reading}.${formLabel.meaning ? ` Meaning: ${formLabel.meaning}` : ''}`}
          accessibilityHint={flipped ? 'Use Got it or Missed to grade this card' : 'Flips the card to reveal the answer'}
          accessibilityState={{ disabled: flipped }}
        >
          {/* Front */}
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                transform: [{ perspective: 1000 }, { rotateY: frontRotateY }],
              },
            ]}
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
              style={[styles.verbText, { color: colors.primary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {card.verb}
            </Text>
            <Text style={[styles.readingText, { color: colors.textSecondary }]}>
              {card.reading}
            </Text>
            <Text style={[styles.translationText, { color: colors.textSecondary }]}>
              {card.translation}
            </Text>
            <Text style={[styles.tapHint, { color: colors.textMuted }]}>
              Tap to reveal
            </Text>
          </Animated.View>

          {/* Back */}
          <Animated.View
            style={[
              styles.card,
              styles.cardBack,
              {
                backgroundColor: colors.primary + '10',
                transform: [{ perspective: 1000 }, { rotateY: backRotateY }],
              },
            ]}
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
              style={[styles.answerText, { color: colors.primary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {card.answer}
            </Text>
            <Text style={[styles.contextText, { color: colors.textSecondary }]}>
              {card.verb}
            </Text>
            <Text style={[styles.answerTranslation, { color: colors.textMuted }]}>
              {card.translation}
            </Text>
            {exampleSentence && (
              <>
                <Text style={[styles.exampleLabel, { color: colors.textMuted }]}>
                  Example
                </Text>
                <Text style={[styles.exampleText, { color: colors.textSecondary }]}>
                  {exampleSentence}
                </Text>
              </>
            )}
            <TouchableOpacity
              style={[styles.speakButton, { backgroundColor: colors.primary }]}
              onPress={(e) => {
                e.stopPropagation?.();
                speak(card.answer);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Play pronunciation of ${card.answer}`}
            >
              <Ionicons name="volume-medium" size={20} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>

        {/* Got it / Missed buttons */}
        <View style={[styles.buttonRow, { opacity: flipped ? 1 : 0 }]} pointerEvents={flipped ? 'auto' : 'none'}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.errorBg, borderColor: colors.errorText }]}
            onPress={handleMissed}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Mark card as missed"
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
    height: 400,
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.05)',
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
  contextText: {
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  exampleLabel: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
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
});
