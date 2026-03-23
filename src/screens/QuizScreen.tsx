import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
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
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useQuizStore } from '../store/quizStore';
import { useSpacedRepStore } from '../store/spacedRepStore';
import { useSessionStore } from '../store/sessionStore';

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
  const { totalQuestions, totalCorrect, bestStreak, loadStats, recordAnswer } = useQuizStore();
  const { loaded: weightsLoaded, loadWeights, recordResult, getWeight } = useSpacedRepStore();
  const [activeForms, setActiveForms] = useState<ConjugationForm[]>(quizzableForms.map(f => f.key));
  const [activeLevels, setActiveLevels] = useState<JLPTLevel[]>([...jlptLevels]);
  const { sessions, loadSessions, saveSession } = useSessionStore();
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
    loadSessions();
  }, []);

  const filteredEntries = useMemo(() =>
    allVerbEntries.filter(([, d]) => activeLevels.includes(d.jlpt as JLPTLevel)),
    [activeLevels]
  );

  useEffect(() => {
    if (weightsLoaded && activeForms.length > 0 && filteredEntries.length > 0) {
      setQuestion(generateQuestion(activeForms, getWeight, filteredEntries));
      setSelectedAnswer(null);
    }
  }, [weightsLoaded, activeForms, activeLevels]);

  const isCorrect = selectedAnswer === question?.correctAnswer;
  const answered = selectedAnswer !== null;
  const allFormsSelected = activeForms.length === quizzableForms.length;
  const allLevelsSelected = activeLevels.length === jlptLevels.length;

  const toggleForm = (form: ConjugationForm) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveForms(prev => {
      if (prev.includes(form)) {
        if (prev.length <= 1) return prev;
        return prev.filter(f => f !== form);
      }
      return [...prev, form];
    });
  };

  const toggleAllForms = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (allFormsSelected) {
      setActiveForms(['masu']);
    } else {
      setActiveForms(quizzableForms.map(f => f.key));
    }
  };

  const toggleLevel = (level: JLPTLevel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveLevels(prev => {
      if (prev.includes(level)) {
        if (prev.length <= 1) return prev;
        return prev.filter(l => l !== level);
      }
      return [...prev, level];
    });
  };

  const toggleAllLevels = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (allLevelsSelected) {
      setActiveLevels(['N5']);
    } else {
      setActiveLevels([...jlptLevels]);
    }
  };

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

  const formatDuration = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
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
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* JLPT level chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ key: 'all', label: 'All' }, ...jlptLevels.map(l => ({ key: l, label: l }))]}
        keyExtractor={(item) => 'jlpt-' + item.key}
        contentContainerStyle={styles.chipBar}
        renderItem={({ item }) => {
          const isAll = item.key === 'all';
          const active = isAll ? allLevelsSelected : activeLevels.includes(item.key as JLPTLevel);
          return (
            <TouchableOpacity
              style={[
                styles.chip,
                active
                  ? { backgroundColor: colors.accent, borderColor: colors.accent }
                  : { backgroundColor: 'transparent', borderColor: colors.border, borderStyle: 'dashed' as const },
              ]}
              onPress={() => isAll ? toggleAllLevels() : toggleLevel(item.key as JLPTLevel)}
            >
              <Text style={[
                styles.chipText,
                { color: active ? '#fff' : colors.textMuted },
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Form filter chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ key: 'all' as ConjugationForm, label: 'All' }, ...quizzableForms]}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.chipBar}
        renderItem={({ item }) => {
          const isAll = item.key === 'all';
          const active = isAll ? allFormsSelected : activeForms.includes(item.key);
          return (
            <TouchableOpacity
              style={[
                styles.chip,
                active
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: 'transparent', borderColor: colors.border, borderStyle: 'dashed' as const },
              ]}
              onPress={() => isAll ? toggleAllForms() : toggleForm(item.key)}
            >
              <Text style={[
                styles.chipText,
                { color: active ? '#fff' : colors.textMuted },
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Session score bar */}
      <View style={[styles.scoreBar, { backgroundColor: colors.card }]}>
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

      {/* All-time stats */}
      {totalQuestions > 0 && (
        <View style={[styles.allTimeBar, { borderColor: colors.divider }]}>
          <Text style={[styles.allTimeText, { color: colors.textMuted }]}>
            All-time: {totalCorrect}/{totalQuestions} ({Math.round((totalCorrect / totalQuestions) * 100)}%) · Best streak: {bestStreak}
          </Text>
        </View>
      )}

      {/* Question */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionLabel, { color: colors.textMuted }]}>
          {formLabel.ja} — {formLabel.en}
        </Text>
        <Text style={[styles.questionVerb, { color: colors.primary }]}>
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
            <Text style={[styles.optionText, { color: getOptionTextColor(option) }]}>
              {option}
            </Text>
            {answered && option === question.correctAnswer && (
              <Ionicons name="checkmark-circle" size={22} color="#4CAF50" />
            )}
            {answered && option === selectedAnswer && !isCorrect && option !== question.correctAnswer && (
              <Ionicons name="close-circle" size={22} color="#E53935" />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Next button */}
      {answered && (
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: colors.primary }]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>Next</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      )}

      {/* End session button */}
      {sessionTotal > 0 && (
        <TouchableOpacity
          style={[styles.endSessionButton, { borderColor: colors.border }]}
          onPress={handleEndSession}
          activeOpacity={0.7}
        >
          <Text style={[styles.endSessionText, { color: colors.textMuted }]}>세션 종료</Text>
        </TouchableOpacity>
      )}

      {/* Session history */}
      {sessions.length > 0 && sessionTotal === 0 && (
        <View style={styles.historySection}>
          <Text style={[styles.historyTitle, { color: colors.textSecondary }]}>지난 세션</Text>
          {sessions.slice(0, 5).map((s, i) => (
            <View key={i} style={[styles.historyRow, { backgroundColor: colors.card }]}>
              <Text style={[styles.historyDate, { color: colors.textMuted }]}>
                {new Date(s.date).toLocaleDateString('ko-KR')}
              </Text>
              <Text style={[styles.historyStat, { color: colors.textPrimary }]}>
                {s.correct}/{s.total} ({Math.round((s.correct / s.total) * 100)}%)
              </Text>
              <Text style={[styles.historyStat, { color: colors.textMuted }]}>
                {formatDuration(s.durationMs)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Results modal */}
      <Modal visible={showResults} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowResults(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.primary }]}>세션 완료!</Text>
            <View style={styles.modalStats}>
              <View style={styles.modalStatItem}>
                <Text style={[styles.modalStatValue, { color: colors.primary }]}>
                  {sessionScore}/{sessionTotal}
                </Text>
                <Text style={[styles.modalStatLabel, { color: colors.textMuted }]}>점수</Text>
              </View>
              <View style={styles.modalStatItem}>
                <Text style={[styles.modalStatValue, { color: colors.accent }]}>
                  {sessionTotal > 0 ? Math.round((sessionScore / sessionTotal) * 100) : 0}%
                </Text>
                <Text style={[styles.modalStatLabel, { color: colors.textMuted }]}>정확도</Text>
              </View>
              <View style={styles.modalStatItem}>
                <Text style={[styles.modalStatValue, { color: colors.textSecondary }]}>
                  {bestSessionStreak}
                </Text>
                <Text style={[styles.modalStatLabel, { color: colors.textMuted }]}>최고 연속</Text>
              </View>
            </View>
            <Text style={[styles.modalDuration, { color: colors.textMuted }]}>
              {formatDuration(Date.now() - sessionStart.current)}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={handleNewSession}
            >
              <Text style={styles.modalButtonText}>새 세션</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 40 },
  chipBar: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
  },
  scoreBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  scoreItem: {
    alignItems: 'center',
  },
  allTimeBar: {
    borderTopWidth: 1,
    marginHorizontal: spacing.md,
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
  },
  allTimeText: {
    fontSize: fonts.sizes.xs,
    textAlign: 'center',
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
    marginBottom: spacing.xl,
  },
  questionLabel: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  questionVerb: {
    fontSize: 36,
    fontWeight: fonts.weights.bold,
    marginBottom: spacing.xs,
  },
  questionReading: {
    fontSize: fonts.sizes.lg,
    marginBottom: spacing.xs,
  },
  questionTranslation: {
    fontSize: fonts.sizes.md,
    fontStyle: 'italic',
  },
  optionsContainer: {
    gap: spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  optionText: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.semibold,
    flex: 1,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
  },
  endSessionButton: {
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  endSessionText: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.medium,
  },
  historySection: {
    marginTop: spacing.lg,
  },
  historyTitle: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  historyDate: {
    fontSize: fonts.sizes.sm,
    flex: 1,
  },
  historyStat: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    marginLeft: spacing.md,
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
  modalDuration: {
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.lg,
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
