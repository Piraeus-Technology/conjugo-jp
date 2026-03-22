import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import verbs from '../data/verbs.json';
import {
  conjugateReading,
  FORM_LABELS,
  ConjugationForm,
  VerbData,
} from '../utils/conjugate';
import { speak } from '../utils/speech';
import { useColors, fonts, spacing, radius } from '../utils/theme';

const verbEntries = Object.entries(verbs as Record<string, VerbData>);
const commonCount = Math.min(50, verbEntries.length);

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

function generateCard(): Card {
  const idx = Math.random() < 0.7
    ? Math.floor(Math.random() * commonCount)
    : Math.floor(Math.random() * verbEntries.length);
  const [verb, data] = verbEntries[idx];
  const form = flashcardForms[Math.floor(Math.random() * flashcardForms.length)];
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
  const [card, setCard] = useState<Card>(generateCard);
  const [flipped, setFlipped] = useState(false);
  const [count, setCount] = useState(0);
  const flipAnim = useRef(new Animated.Value(0)).current;

  const flip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (flipped) {
      Animated.timing(flipAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCard(generateCard());
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
            {card.verb} · {card.translation}
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
    top: spacing.lg,
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
});
