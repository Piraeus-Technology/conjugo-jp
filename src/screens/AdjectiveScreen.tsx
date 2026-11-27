import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useFavoritesStore } from '../store/favoritesStore';
import {
  ADJECTIVE_CLASS_LABELS,
  ADJECTIVE_FORM_GROUPS,
  adjectiveForms,
  adjectiveKey,
  adjectiveMap,
  conjugateAdjective,
} from '../utils/adjectives';
import { speak, stopSpeech } from '../utils/speech';
import type { SearchStackParamList } from '../types/navigation';

export default function AdjectiveScreen() {
  const colors = useColors();
  const route = useRoute<RouteProp<SearchStackParamList, 'Adjective'>>();
  const word = route.params.word;
  const highlightForm = route.params.highlightForm;
  const data = adjectiveMap[word];
  const { isFavorite, toggleFavorite, loadFavorites } = useFavoritesStore();
  const scrollRef = useRef<ScrollView>(null);
  const scrollContentRef = useRef<View>(null);
  const highlightRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didScrollToHighlight = useRef(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  React.useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  useFocusEffect(useCallback(() => () => stopSpeech(), []));

  React.useLayoutEffect(() => {
    didScrollToHighlight.current = false;
    return () => {
      if (highlightTimer.current !== null) clearTimeout(highlightTimer.current);
      highlightTimer.current = null;
    };
  }, [word, highlightForm]);

  const scheduleHighlight = () => {
    if (didScrollToHighlight.current || highlightTimer.current !== null) return;
    highlightTimer.current = setTimeout(() => {
      highlightTimer.current = null;
      if (!highlightRef.current || !scrollContentRef.current) return;
      const row = highlightRef.current;
      row.measureLayout(
        scrollContentRef.current,
        (_x, y) => {
          if (didScrollToHighlight.current || highlightRef.current !== row) return;
          didScrollToHighlight.current = true;
          scrollRef.current?.scrollTo({ y: Math.max(0, y - 150), animated: true });
        },
        () => {},
      );
    }, 400);
  };

  if (!data) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.textPrimary }}>Word not found</Text>
      </View>
    );
  }

  const key = adjectiveKey(word);
  const favorited = isFavorite(key);
  const classLabel = ADJECTIVE_CLASS_LABELS[data.class];
  const forms = adjectiveForms(data);
  const levelTagColor = (() => {
    switch (data.jlpt) {
      case 'N5': return { bg: colors.n5Bg, text: colors.n5Text };
      case 'N4': return { bg: colors.n4Bg, text: colors.n4Text };
      case 'N3': return { bg: colors.n3Bg, text: colors.n3Text };
      case 'N2': return { bg: colors.n2Bg, text: colors.n2Text };
      case 'N1': return { bg: colors.n1Bg, text: colors.n1Text };
      default: return { bg: colors.pillBg, text: colors.textSecondary };
    }
  })();
  const toggleGroup = (title: string) => {
    setCollapsedGroups(current => ({ ...current, [title]: !current[title] }));
  };

  return (
    <ScrollView ref={scrollRef} style={[styles.container, { backgroundColor: colors.bg }]}>
      <View ref={scrollContentRef}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <View style={styles.headerTop}>
            <View style={styles.wordRow}>
              <Text style={[styles.word, { color: colors.primaryText }]}>{word}</Text>
              <TouchableOpacity
                onPress={() => speak(data.reading)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={`Play pronunciation of ${word}`}
              >
                <Ionicons name="volume-medium" size={22} color={colors.primaryText} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => toggleFavorite(key)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={favorited ? `Remove ${word} from favorites` : `Add ${word} to favorites`}
              accessibilityState={{ selected: favorited }}
            >
              <Ionicons
                name={favorited ? 'heart' : 'heart-outline'}
                size={28}
                color={favorited ? colors.accent : colors.textMuted}
              />
            </TouchableOpacity>
          </View>
          <Text style={[styles.reading, { color: colors.textSecondary }]}>{data.reading}</Text>
          <Text style={[styles.translation, { color: colors.textPrimary }]}>{data.translation}</Text>
          <View style={styles.metaRow}>
            <View style={[styles.tag, { backgroundColor: colors.pillBg }]}>
              <Text style={[styles.tagText, { color: colors.textSecondary }]} accessibilityLabel={classLabel.en}>
                {classLabel.ja}
              </Text>
            </View>
            <View style={[styles.tag, { backgroundColor: levelTagColor.bg }]}>
              <Text style={[styles.tagText, { color: levelTagColor.text }]}>{data.jlpt}</Text>
            </View>
          </View>
          {data.note && (
            <Text style={[styles.note, { color: colors.textSecondary, borderTopColor: colors.divider }]}>
              {data.note}
            </Text>
          )}
        </View>

        {ADJECTIVE_FORM_GROUPS.map((group) => {
          const groupForms = group.forms.filter(form => forms.includes(form));
          if (groupForms.length === 0) return null;
          const isCollapsed = !!collapsedGroups[group.title];
          return (
            <View key={group.title} style={styles.groupSection}>
              <TouchableOpacity
                style={styles.groupHeader}
                onPress={() => toggleGroup(group.title)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${group.title} forms`}
                accessibilityHint={isCollapsed ? 'Expands this group' : 'Collapses this group'}
                accessibilityState={{ expanded: !isCollapsed }}
              >
                <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>
                  {group.title} ({group.titleJa})
                </Text>
                <Ionicons name={isCollapsed ? 'chevron-down' : 'chevron-up'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
              {!isCollapsed && (
                <View style={[styles.groupCard, { backgroundColor: colors.card }]}>
                  {groupForms.map((form) => {
                    const result = conjugateAdjective(word, data, form);
                    const isHighlighted = form === highlightForm;
                    const also = result.alsoCorrect.map(v => v.value).join('、');
                    return (
                      <TouchableOpacity
                        key={form}
                        ref={isHighlighted ? highlightRef : undefined}
                        onLayout={isHighlighted ? scheduleHighlight : undefined}
                        style={[
                          styles.formRow,
                          { borderBottomColor: colors.divider },
                          isHighlighted && { backgroundColor: colors.primaryText + '15' },
                        ]}
                        onPress={() => speak(result.reading)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${result.labelJa}, ${result.labelEn}: ${result.value}${result.value !== result.reading ? `, reading ${result.reading}` : ''}${also ? `. Also correct: ${also}` : ''}`}
                        accessibilityHint="Plays pronunciation"
                      >
                        <View style={styles.formLabel}>
                          <Text style={[styles.formLabelJa, { color: colors.textMuted }]}>{result.labelJa}</Text>
                          <Text style={[styles.formLabelEn, { color: colors.textMuted }]}>{result.labelEn}</Text>
                        </View>
                        <View style={styles.formValue}>
                          <Text style={[styles.formText, { color: colors.textPrimary }]}>{result.value}</Text>
                          {result.value !== result.reading && (
                            <Text style={[styles.formReading, { color: colors.textMuted }]}>{result.reading}</Text>
                          )}
                          {also ? (
                            <Text style={[styles.alsoText, { color: colors.textSecondary }]}>Also: {also}</Text>
                          ) : null}
                        </View>
                        <Ionicons name="volume-medium-outline" size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {data.examples && data.examples.length > 0 && (
          <View style={styles.groupSection}>
            <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>Examples (例文)</Text>
            <View style={[styles.groupCard, { backgroundColor: colors.card }]}>
              {data.examples.map((ex, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.exampleRow, { borderBottomColor: colors.divider }]}
                  onPress={() => speak(ex.ja)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Example sentence: ${ex.ja}. ${ex.en}`}
                  accessibilityHint="Plays pronunciation"
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
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  word: { fontSize: fonts.sizes.hero, fontWeight: fonts.weights.bold, flexShrink: 1 },
  reading: { fontSize: fonts.sizes.lg, marginTop: spacing.xs },
  translation: { fontSize: fonts.sizes.lg, marginTop: spacing.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.sm },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  tagText: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.medium },
  note: {
    fontSize: fonts.sizes.sm,
    lineHeight: 20,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  groupSection: { marginTop: spacing.md, paddingHorizontal: spacing.md },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  groupTitle: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.semibold },
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
  formLabel: { width: 110 },
  formLabelJa: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.medium },
  formLabelEn: { fontSize: 10 },
  formValue: { flex: 1 },
  formText: { fontSize: fonts.sizes.lg },
  formReading: { fontSize: fonts.sizes.sm, marginTop: 2 },
  alsoText: { fontSize: fonts.sizes.xs, marginTop: 2 },
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
