import React, { useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';

import verbs from '../data/verbs.json';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useFavoritesStore } from '../store/favoritesStore';
import { conjugate, FORM_GROUPS, VerbData } from '../utils/conjugate';
import { speak } from '../utils/speech';

export default function ConjugationScreen() {
  const colors = useColors();
  const route = useRoute<any>();
  const verb: string = route.params.verb;
  const highlightForm: string | undefined = route.params?.highlightForm;
  const verbData = (verbs as Record<string, VerbData>)[verb];
  const { isFavorite, toggleFavorite, loadFavorites } = useFavoritesStore();
  const scrollRef = useRef<ScrollView>(null);
  const highlightY = useRef<number | null>(null);

  React.useEffect(() => {
    loadFavorites();
  }, []);

  const highlightRef = useRef<View>(null);
  const scrollContentRef = useRef<View>(null);

  if (!verbData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.textPrimary }}>Verb not found</Text>
      </View>
    );
  }

  const groupLabel = verbData.group === 'godan' ? '五段' : verbData.group === 'ichidan' ? '一段' : '不規則';

  return (
    <ScrollView ref={scrollRef} style={[styles.container, { backgroundColor: colors.bg }]}>
      <View ref={scrollContentRef}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.verb, { color: colors.primary }]}>{verb}</Text>
            <Text style={[styles.reading, { color: colors.textSecondary }]}>{verbData.reading}</Text>
          </View>
          <TouchableOpacity onPress={() => toggleFavorite(verb)}>
            <Ionicons
              name={isFavorite(verb) ? 'heart' : 'heart-outline'}
              size={28}
              color={isFavorite(verb) ? colors.accent : colors.textMuted}
            />
          </TouchableOpacity>
        </View>
        <Text style={[styles.translation, { color: colors.textPrimary }]}>{verbData.translation}</Text>
        <View style={styles.metaRow}>
          <View style={[styles.tag, { backgroundColor: colors.pillBg }]}>
            <Text style={[styles.tagText, { color: colors.textSecondary }]}>{groupLabel}</Text>
          </View>
          <View style={[styles.tag, { backgroundColor: colors.pillBg }]}>
            <Text style={[styles.tagText, { color: colors.textSecondary }]}>{verbData.jlpt}</Text>
          </View>
          <TouchableOpacity onPress={() => speak(verb)} style={styles.speakButton}>
            <Ionicons name="volume-medium" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Conjugation Groups */}
      {FORM_GROUPS.map((group) => (
        <View key={group.title} style={styles.groupSection}>
          <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>
            {group.title} ({group.titleJa})
          </Text>
          <View style={[styles.groupCard, { backgroundColor: colors.card }]}>
            {group.forms.map((form) => {
              const result = conjugate(verb, verbData, form);
              const isHighlighted = form === highlightForm && highlightForm !== 'dictionary';
              return (
                <TouchableOpacity
                  key={form}
                  ref={isHighlighted ? highlightRef as any : undefined}
                  onLayout={isHighlighted ? () => {
                    setTimeout(() => {
                      if (highlightRef.current && scrollContentRef.current) {
                        highlightRef.current.measureLayout(
                          scrollContentRef.current as any,
                          (_x, y) => {
                            scrollRef.current?.scrollTo({ y: Math.max(0, y - 150), animated: true });
                          },
                          () => {},
                        );
                      }
                    }, 400);
                  } : undefined}
                  style={[
                    styles.formRow,
                    { borderBottomColor: colors.divider },
                    isHighlighted && { backgroundColor: colors.primary + '15' },
                  ]}
                  onPress={() => speak(result.reading)}
                  activeOpacity={0.7}
                >
                  <View style={styles.formLabel}>
                    <Text style={[styles.formLabelJa, { color: colors.textMuted }]}>{result.labelJa}</Text>
                    <Text style={[styles.formLabelEn, { color: colors.textMuted }]}>{result.labelEn}</Text>
                  </View>
                  <View style={styles.formValue}>
                    {result.value !== result.reading ? (
                      <>
                        <Text style={[styles.formText, { color: colors.textPrimary }]}>{result.value}</Text>
                        <Text style={[styles.formReading, { color: colors.textMuted }]}>{result.reading}</Text>
                      </>
                    ) : (
                      <Text style={[styles.formText, { color: colors.textPrimary }]}>{result.reading}</Text>
                    )}
                  </View>
                  <Ionicons name="volume-medium-outline" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {/* Examples */}
      {verbData.examples && verbData.examples.length > 0 && (
        <View style={styles.groupSection}>
          <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>Examples (例文)</Text>
          <View style={[styles.groupCard, { backgroundColor: colors.card }]}>
            {verbData.examples.map((ex, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.exampleRow, { borderBottomColor: colors.divider }]}
                onPress={() => speak(ex.ja)}
                activeOpacity={0.7}
              >
                <View style={styles.exampleText}>
                  <Text style={[styles.exampleJa, { color: colors.textPrimary }]}>{ex.ja}</Text>
                  <Text style={[styles.exampleEn, { color: colors.textSecondary }]}>{ex.en}</Text>
                </View>
                <Ionicons name="volume-medium-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={{ height: spacing.xl }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: spacing.lg,
    margin: spacing.md,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  verb: { fontSize: fonts.sizes.hero, fontWeight: fonts.weights.bold },
  reading: { fontSize: fonts.sizes.lg, marginTop: spacing.xs },
  translation: { fontSize: fonts.sizes.lg, marginTop: spacing.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.sm },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  tagText: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.medium },
  speakButton: { marginLeft: 'auto' },
  groupSection: { marginTop: spacing.md, paddingHorizontal: spacing.md },
  groupTitle: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    marginBottom: spacing.sm,
  },
  groupCard: {
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  formLabel: { width: 100 },
  formLabelJa: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.medium },
  formLabelEn: { fontSize: 10 },
  formValue: { flex: 1 },
  formText: { fontSize: fonts.sizes.lg },
  formReading: { fontSize: fonts.sizes.sm, marginTop: 2 },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exampleText: { flex: 1 },
  exampleJa: { fontSize: fonts.sizes.md },
  exampleEn: { fontSize: fonts.sizes.sm, marginTop: 2 },
});
