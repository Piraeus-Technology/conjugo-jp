import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import * as StoreReview from 'expo-store-review';
import { speak } from '../utils/speech';
import verbs from '../data/verbs.json';
import {
  conjugateReading,
  FORM_LABELS,
  ConjugationForm,
  VerbData,
  JLPTLevel,
} from '../utils/conjugate';
import { useNavigation } from '@react-navigation/native';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useQuizStore } from '../store/quizStore';
import { useSpacedRepStore } from '../store/spacedRepStore';
import { useSessionStore } from '../store/sessionStore';
import { usePracticeSettingsStore } from '../store/practiceSettingsStore';

const allVerbEntries = Object.entries(verbs as Record<string, VerbData>);
const jlptLevels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

const quizzableForms: { key: ConjugationForm; label: string }[] = [
  { key: 'masu', label: 'ます' },
  { key: 'te', label: 'て形' },
  { key: 'ta', label: 'た形' },
  { key: 'nai', label: 'ない' },
  { key: 'potential', label: '可能' },
  { key: 'passive', label: '受身' },
  { key: 'causative', label: '使役' },
  { key: 'conditional_ba', label: 'ば形' },
  { key: 'conditional_tara', label: 'たら形' },
  { key: 'volitional', label: '意向' },
  { key: 'imperative', label: '命令' },
];

interface Question {
  verb: string;
  reading: string;
  translation: string;
  form: ConjugationForm;
  correctAnswer: string;
  options: string[];
}

function generateQuestion(
  activeForms: ConjugationForm[],
  getWeight: (verb: string) => number,
  filteredEntries: [string, VerbData][],
): Question {
  const verbEntries = filteredEntries.length > 0 ? filteredEntries : allVerbEntries;
  // Weighted random verb selection with bias toward common verbs
  const commonCount = Math.min(200, verbEntries.length);
  const candidates: number[] = [];
  for (let i = 0; i < 10; i++) {
    if (Math.random() < 0.7) {
      candidates.push(Math.floor(Math.random() * commonCount));
    } else {
      candidates.push(Math.floor(Math.random() * verbEntries.length));
    }
  }
  const verbIndex = candidates.reduce((best, idx) => {
    const bestWeight = getWeight(verbEntries[best][0]);
    const thisWeight = getWeight(verbEntries[idx][0]);
    return thisWeight > bestWeight ? idx : best;
  }, candidates[0]);

  const [verb, data] = verbEntries[verbIndex];
  const form = activeForms[Math.floor(Math.random() * activeForms.length)];
  const correctAnswer = conjugateReading(data, form);

  // Generate wrong answers
  const wrongAnswers = new Set<string>();

  // Same verb, different forms
  for (const f of activeForms) {
    if (f === form) continue;
    const wrong = conjugateReading(data, f);
    if (wrong !== correctAnswer) {
      wrongAnswers.add(wrong);
    }
  }

  // Same form, different verbs
  for (let i = 0; i < 20 && wrongAnswers.size < 6; i++) {
    const [, otherData] = verbEntries[Math.floor(Math.random() * verbEntries.length)];
    const wrong = conjugateReading(otherData, form);
    if (wrong !== correctAnswer) {
      wrongAnswers.add(wrong);
    }
  }

  const wrongArray = Array.from(wrongAnswers);
  const selected: string[] = [];
  while (selected.length < 3 && wrongArray.length > 0) {
    const idx = Math.floor(Math.random() * wrongArray.length);
    selected.push(wrongArray.splice(idx, 1)[0]);
  }

  // Fallback if not enough wrong answers
  while (selected.length < 3) {
    const [, otherData] = allVerbEntries[Math.floor(Math.random() * allVerbEntries.length)];
    const wrong = conjugateReading(otherData, form);
    if (wrong !== correctAnswer && !selected.includes(wrong)) {
      selected.push(wrong);
    }
  }

  const options = [correctAnswer, ...selected];
  // Shuffle
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return {
    verb,
    reading: data.reading,
    translation: data.translation,
    form,
    correctAnswer,
    options,
  };
}

export default function QuizScreen() {
  const colors = useColors();
  const navigation = useNavigation<any>();
  const { totalQuestions, totalCorrect, bestStreak, loadStats, recordAnswer } = useQuizStore();
  const { loaded: weightsLoaded, loadWeights, recordResult, getWeight } = useSpacedRepStore();
  const { activeForms, activeLevels, loaded: settingsLoaded, loadPracticeSettings } = usePracticeSettingsStore();
  const { saveSession } = useSessionStore();
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [sessionScore, setSessionScore] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestSessionStreak, setBestSessionStreak] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const sessionStart = useRef(Date.now());

  useEffect(() => {
    loadStats();
    loadWeights();
    loadPracticeSettings();
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('PracticeSettings', { mode: 'quiz' })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 }}
        >
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Forms</Text>
          <Ionicons name="options-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  const filteredEntries = useMemo(() =>
    allVerbEntries.filter(([, d]) => activeLevels.includes(d.jlpt as JLPTLevel)),
    [activeLevels]
  );

  useEffect(() => {
    if (weightsLoaded && settingsLoaded && activeForms.length > 0 && filteredEntries.length > 0) {
      setQuestion(generateQuestion(activeForms, getWeight, filteredEntries));
      setSelectedAnswer(null);
    }
  }, [weightsLoaded, settingsLoaded, activeForms, activeLevels]);

  const isCorrect = selectedAnswer === question?.correctAnswer;
  const answered = selectedAnswer !== null;

  const handleAnswer = (answer: string) => {
    if (answered || !question) return;
    setSelectedAnswer(answer);
    setSessionTotal(t => t + 1);

    const correct = answer === question.correctAnswer;
    if (correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSessionScore(s => s + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestSessionStreak) setBestSessionStreak(newStreak);
      recordAnswer(true, newStreak);
      if (newStreak === 10) {
        StoreReview.isAvailableAsync().then((available) => {
          if (available) StoreReview.requestReview();
        });
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setStreak(0);
      recordAnswer(false, 0);
    }
    recordResult(question.verb, correct);
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuestion(generateQuestion(activeForms, getWeight, filteredEntries));
    setSelectedAnswer(null);
  };

  const handleEndSession = () => {
    if (sessionTotal > 0) {
      saveSession({
        total: sessionTotal,
        correct: sessionScore,
        streak: bestSessionStreak,
        durationMs: Date.now() - sessionStart.current,
      });
    }
    setShowResults(true);
  };

  const handleNewSession = () => {
    setShowResults(false);
    setSessionScore(0);
    setSessionTotal(0);
    setStreak(0);
    setBestSessionStreak(0);
    sessionStart.current = Date.now();
    setQuestion(generateQuestion(activeForms, getWeight, filteredEntries));
    setSelectedAnswer(null);
  };

  const getOptionStyle = (option: string) => {
    if (!answered || !question) {
      return { backgroundColor: colors.card, borderColor: colors.border };
    }
    if (option === question.correctAnswer) {
      return { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' };
    }
    if (option === selectedAnswer && !isCorrect) {
      return { backgroundColor: '#FFEBEE', borderColor: '#E53935' };
    }
    return { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.4 };
  };

  const getOptionTextColor = (option: string) => {
    if (!answered || !question) return colors.textPrimary;
    if (option === question.correctAnswer) return '#2E7D32';
    if (option === selectedAnswer && !isCorrect) return '#C62828';
    return colors.textMuted;
  };

  if (!question) return (
    <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ color: colors.textMuted, fontSize: fonts.sizes.md }}>No matching verbs</Text>
    </View>
  );

  const formLabel = FORM_LABELS[question.form];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.content}>
        {/* Session score bar */}
        <View style={[styles.scoreCard, { backgroundColor: colors.card }]}>
          <View style={styles.scoreRow}>
            <View style={styles.scoreItem}>
              <Text style={[styles.scoreValue, { color: colors.primary }]}>{sessionScore}/{sessionTotal}</Text>
              <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Session</Text>
            </View>
            <View style={styles.scoreItem}>
              <Text style={[styles.scoreValue, { color: colors.accent }]}>{streak}</Text>
              <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Streak</Text>
            </View>
            <View style={styles.scoreItem}>
              <Text style={[styles.scoreValue, { color: colors.textSecondary }]}>
                {sessionTotal > 0 ? Math.round((sessionScore / sessionTotal) * 100) : 0}%
              </Text>
              <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Accuracy</Text>
            </View>
          </View>
          {totalQuestions > 0 && (
            <Text style={[styles.allTimeText, { color: colors.textMuted }]}>
              All-time: {totalCorrect}/{totalQuestions} ({Math.round((totalCorrect / totalQuestions) * 100)}%) · Best streak: {bestStreak}
            </Text>
          )}
        </View>

        {/* Question — fills remaining space */}
        <View style={styles.questionContainer}>
          <Text style={[styles.questionLabel, { color: colors.textMuted }]}>
            {formLabel.ja} — {formLabel.en}
          </Text>
          <Text
            style={[styles.questionVerb, { color: colors.primary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {question.verb}
          </Text>
          <Text style={[styles.questionReading, { color: colors.textSecondary }]}>
            {question.reading}
          </Text>
          <Text style={[styles.questionTranslation, { color: colors.textSecondary }]}>
            {question.translation}
          </Text>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {question.options.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.optionButton, getOptionStyle(option)]}
              onPress={() => handleAnswer(option)}
              activeOpacity={answered ? 1 : 0.7}
              disabled={answered}
            >
              <Text
                style={[styles.optionText, { color: getOptionTextColor(option) }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {option}
              </Text>
              {answered && option === question.correctAnswer && (
                <Ionicons name="checkmark-circle" size={22} color="#4CAF50" style={{ marginLeft: 8 }} />
              )}
              {answered && option === selectedAnswer && !isCorrect && option !== question.correctAnswer && (
                <Ionicons name="close-circle" size={22} color="#E53935" style={{ marginLeft: 8 }} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Next + End Session — same row */}
        <View style={[styles.bottomRow, { opacity: answered ? 1 : 0 }]} pointerEvents={answered ? 'auto' : 'none'}>
          <TouchableOpacity
            style={[styles.bottomButton, { backgroundColor: colors.primary }]}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={styles.bottomButtonText}>Next</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
          {sessionTotal > 0 && (
            <TouchableOpacity
              style={[styles.bottomButton, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
              onPress={handleEndSession}
              activeOpacity={0.7}
            >
              <Text style={[styles.bottomButtonText, { color: colors.textMuted }]}>End</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results modal */}
      <Modal visible={showResults} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowResults(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.primary }]}>Session Complete!</Text>
            <View style={styles.modalStats}>
              <View style={styles.modalStatItem}>
                <Text style={[styles.modalStatValue, { color: colors.primary }]}>
                  {sessionScore}/{sessionTotal}
                </Text>
                <Text style={[styles.modalStatLabel, { color: colors.textMuted }]}>Score</Text>
              </View>
              <View style={styles.modalStatItem}>
                <Text style={[styles.modalStatValue, { color: colors.accent }]}>
                  {sessionTotal > 0 ? Math.round((sessionScore / sessionTotal) * 100) : 0}%
                </Text>
                <Text style={[styles.modalStatLabel, { color: colors.textMuted }]}>Accuracy</Text>
              </View>
              <View style={styles.modalStatItem}>
                <Text style={[styles.modalStatValue, { color: colors.textSecondary }]}>
                  {bestSessionStreak}
                </Text>
                <Text style={[styles.modalStatLabel, { color: colors.textMuted }]}>Best Streak</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={handleNewSession}
            >
              <Text style={styles.modalButtonText}>New Session</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    justifyContent: 'space-between',
  },
  scoreCard: {
    padding: spacing.md,
    borderRadius: radius.md,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  scoreItem: {
    alignItems: 'center',
  },
  allTimeText: {
    fontSize: fonts.sizes.xs,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  scoreValue: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.bold,
  },
  scoreLabel: {
    fontSize: fonts.sizes.xs,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionLabel: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  questionVerb: {
    fontSize: 32,
    fontWeight: fonts.weights.bold,
    marginBottom: 2,
  },
  questionReading: {
    fontSize: fonts.sizes.lg,
    marginBottom: 2,
  },
  questionTranslation: {
    fontSize: fonts.sizes.sm,
    fontStyle: 'italic',
  },
  optionsContainer: {
    gap: spacing.xs,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  optionText: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.semibold,
  },
  bottomRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bottomButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  bottomButtonText: {
    color: '#fff',
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.bold,
    marginBottom: spacing.lg,
  },
  modalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: spacing.md,
  },
  modalStatItem: {
    alignItems: 'center',
  },
  modalStatValue: {
    fontSize: 28,
    fontWeight: fonts.weights.bold,
  },
  modalStatLabel: {
    fontSize: fonts.sizes.xs,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
  },
});
