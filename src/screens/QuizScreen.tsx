import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, fonts, spacing } from '../utils/theme';

export default function QuizScreen() {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.textPrimary }]}>Quiz</Text>
      <Text style={[styles.subtext, { color: colors.textSecondary }]}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold },
  subtext: { fontSize: fonts.sizes.md, marginTop: spacing.sm },
});
