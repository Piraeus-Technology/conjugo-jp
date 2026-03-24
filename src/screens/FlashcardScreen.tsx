import React, { useState, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import verbs from '../data/verbs.json';
import {
  conjugateReading,
  FORM_LABELS,
  ConjugationForm,
  VerbData,
  JLPTLevel,
} from '../utils/conjugate';
import { speak } from '../utils/speech';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { usePracticeSettingsStore } from '../store/practiceSettingsStore';

const allVerbEntries = Object.entries(verbs as Record<string, VerbData>);
const jlptLevels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

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

function generateCard(entries: [string, VerbData][], forms: ConjugationForm[]): Card {
  const verbEntries = entries.length > 0 ? entries : allVerbEntries;
  const activeForms = forms.length > 0 ? forms : flashcardForms;
  const commonCount = Math.min(200, verbEntries.length);
  const idx = Math.random() < 0.7
    ? Math.floor(Math.random() * commonCount)
    : Math.floor(Math.random() * verbEntries.length);
  const [verb, data] = verbEntries[idx];
  const form = activeForms[Math.floor(Math.random() * activeForms.length)];
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
  const navigation = useNavigation<any>();
  const { activeForms, activeLevels, loaded: settingsLoaded, loadPracticeSettings } = usePracticeSettingsStore();
  const filteredEntries = useMemo(() =>
    allVerbEntries.filter(([, d]) => activeLevels.includes(d.jlpt as JLPTLevel)),
    [activeLevels]
  );
  const [card, setCard] = useState<Card>(() => generateCard(allVerbEntries, flashcardForms));
  const [flipped, setFlipped] = useState(false);
  const [count, setCount] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const sessionStart = useRef(Date.now());

  useEffect(() => {
    loadPracticeSettings();
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('PracticeSettings', { mode: 'flashcards' })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 }}
        >
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Forms</Text>
          <Ionicons name="options-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  const formatDuration = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const handleEndSession = () => {
    setShowResults(true);
  };

  const handleNewSession = () => {
    setShowResults(false);
    setCount(0);
    sessionStart.current = Date.now();
    setCard(generateCard(filteredEntries, activeForms));
    setFlipped(false);
    flipAnim.setValue(0);
  };

  const flip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (flipped) {
      Animated.timing(flipAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCard(generateCard(filteredEntries, activeForms));
        setFlipped(false);
        setCount(c => c + 1);
      });
    } else {
      setFlipped(true);
      Animated.timing(flipAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, 0],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  const formLabel = FORM_LABELS[card.form];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.counter, { color: colors.textMuted }]}>
        {count} cards reviewed
      </Text>

      <TouchableOpacity
        style={styles.cardContainer}
        onPress={flip}
        activeOpacity={0.95}
      >
        {/* Front */}
        <Animated.View style={[styles.card, { backgroundColor: colors.card, opacity: frontOpacity }]}>
          <Text style={[styles.formLabel, { color: colors.textMuted }]}>
            {formLabel.ja} — {formLabel.en}
          </Text>
          <Text style={[styles.verbText, { color: colors.primary }]}>
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
        <Animated.View style={[styles.card, styles.cardBack, { backgroundColor: colors.primary + '10', opacity: backOpacity }]}>
          <Text style={[styles.formLabel, { color: colors.textMuted }]}>
            {formLabel.ja} — {formLabel.en}
          </Text>
          <Text style={[styles.answerText, { color: colors.primary }]}>
            {card.answer}
          </Text>
          <Text style={[styles.contextText, { color: colors.textSecondary }]}>
            {card.verb} · {card.reading}
          </Text>
          <Text style={[styles.answerTranslation, { color: colors.textMuted }]}>
            {card.translation}
          </Text>
          <TouchableOpacity
            style={[styles.speakButton, { backgroundColor: colors.primary }]}
            onPress={(e) => {
              e.stopPropagation?.();
              speak(card.answer);
            }}
          >
            <Ionicons name="volume-medium" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.tapHint, { color: colors.textMuted }]}>
            Tap for next card
          </Text>
        </Animated.View>
      </TouchableOpacity>

      {/* End session button */}
      {count > 0 && (
        <TouchableOpacity
          style={[styles.endSessionButton, { borderColor: colors.border }]}
          onPress={handleEndSession}
          activeOpacity={0.7}
        >
          <Text style={[styles.endSessionText, { color: colors.textMuted }]}>End Session</Text>
        </TouchableOpacity>
      )}

      {/* Results modal */}
      <Modal visible={showResults} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowResults(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.primary }]}>Session Complete!</Text>
            <View style={styles.modalStats}>
              <View style={styles.modalStatItem}>
                <Text style={[styles.modalStatValue, { color: colors.primary }]}>{count}</Text>
                <Text style={[styles.modalStatLabel, { color: colors.textMuted }]}>Cards</Text>
              </View>
              <View style={styles.modalStatItem}>
                <Text style={[styles.modalStatValue, { color: colors.textSecondary }]}>
                  {formatDuration(Date.now() - sessionStart.current)}
                </Text>
                <Text style={[styles.modalStatLabel, { color: colors.textMuted }]}>Time</Text>
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

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  counter: {
    fontSize: fonts.sizes.sm,
    position: 'absolute',
    top: spacing.sm,
  },
  cardContainer: {
    width: width - spacing.lg * 2,
    height: 360,
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
  },
  cardBack: {
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  formLabel: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  verbText: {
    fontSize: 36,
    fontWeight: fonts.weights.bold,
    marginBottom: spacing.xs,
  },
  readingText: {
    fontSize: fonts.sizes.lg,
    marginBottom: spacing.xs,
  },
  translationText: {
    fontSize: fonts.sizes.md,
    fontStyle: 'italic',
  },
  answerText: {
    fontSize: 42,
    fontWeight: fonts.weights.bold,
    marginBottom: spacing.xs,
  },
  answerTranslation: {
    fontSize: fonts.sizes.md,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  contextText: {
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.lg,
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
  endSessionButton: {
    position: 'absolute',
    bottom: spacing.lg + 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  endSessionText: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.medium,
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
    marginBottom: spacing.lg,
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
