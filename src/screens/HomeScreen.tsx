import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Fuse from 'fuse.js';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import verbs from '../data/verbs.json';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { useHistoryStore } from '../store/historyStore';
import { romajiToHiragana } from '../utils/kana';
import type { RootStackParamList } from '../types/navigation';
import type { VerbData, VerbGroup } from '../utils/conjugate';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const verbList = Object.entries(verbs as Record<string, VerbData>);

// Build search index
const searchData = verbList.map(([verb, data]) => ({
  verb,
  reading: data.reading,
  translation: data.translation,
  jlpt: data.jlpt,
  group: data.group,
}));

const fuse = new Fuse(searchData, {
  keys: [
    { name: 'verb', weight: 3 },
    { name: 'reading', weight: 2 },
    { name: 'translation', weight: 1 },
  ],
  threshold: 0.3,
  ignoreLocation: true,
});

const groupColors: Record<VerbGroup, { bg: string; text: string; label: string }> = {
  godan: { bg: '', text: '', label: '五段' },
  ichidan: { bg: '', text: '', label: '一段' },
  irregular: { bg: '', text: '', label: '不規則' },
};

function getVerbOfTheDay(): [string, VerbData] {
  const dayIndex = Math.floor(Date.now() / 86400000) % verbList.length;
  return verbList[dayIndex];
}

export default function HomeScreen() {
  const colors = useColors();
  const navigation = useNavigation<NavProp>();
  const { history, loadHistory, addToHistory, removeFromHistory } = useHistoryStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    // Convert romaji to hiragana for search
    const hiraganaQuery = romajiToHiragana(query.trim());
    // Search with both original and hiragana
    const results1 = fuse.search(query.trim());
    const results2 = hiraganaQuery !== query.trim() ? fuse.search(hiraganaQuery) : [];
    // Merge and deduplicate
    const seen = new Set<string>();
    const merged = [];
    for (const r of [...results1, ...results2]) {
      if (!seen.has(r.item.verb)) {
        seen.add(r.item.verb);
        merged.push(r);
      }
    }
    return merged.slice(0, 20);
  }, [query]);

  const handleVerbPress = useCallback((verb: string) => {
    addToHistory(verb);
    navigation.navigate('Conjugation', { verb });
  }, [navigation]);

  const [vodVerb, vodData] = getVerbOfTheDay();

  const groupTagColors = {
    godan: { bg: colors.godanTag, text: colors.godanTagText },
    ichidan: { bg: colors.ichidanTag, text: colors.ichidanTagText },
    irregular: { bg: colors.irregularTag, text: colors.irregularTagText },
  };

  const renderVerbItem = ({ item }: { item: typeof searchData[0] }) => {
    const tagColor = groupTagColors[item.group as VerbGroup];
    return (
      <TouchableOpacity
        style={[styles.resultItem, { backgroundColor: colors.card }]}
        onPress={() => handleVerbPress(item.verb)}
        activeOpacity={0.7}
      >
        <View style={styles.resultLeft}>
          <Text style={[styles.resultVerb, { color: colors.textPrimary }]}>{item.verb}</Text>
          <Text style={[styles.resultReading, { color: colors.textSecondary }]}>{item.reading}</Text>
        </View>
        <View style={styles.resultRight}>
          <Text style={[styles.resultTranslation, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.translation}
          </Text>
          <View style={styles.tagRow}>
            <View style={[styles.tag, { backgroundColor: tagColor.bg }]}>
              <Text style={[styles.tagText, { color: tagColor.text }]}>
                {groupColors[item.group as VerbGroup].label}
              </Text>
            </View>
            <View style={[styles.tag, { backgroundColor: colors.pillBg }]}>
              <Text style={[styles.tagText, { color: colors.textMuted }]}>{item.jlpt}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.searchBg }]}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search verbs (kanji, hiragana, romaji, English)..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {query.trim() ? (
        <FlatList
          data={results.map((r) => r.item)}
          keyExtractor={(item) => item.verb}
          renderItem={renderVerbItem}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.homeContent}>
          {/* Verb of the Day */}
          <TouchableOpacity
            style={[styles.vodCard, { backgroundColor: colors.card }]}
            onPress={() => handleVerbPress(vodVerb)}
            activeOpacity={0.7}
          >
            <Text style={[styles.vodLabel, { color: colors.textMuted }]}>Verb of the Day</Text>
            <Text style={[styles.vodVerb, { color: colors.primary }]}>{vodVerb}</Text>
            <Text style={[styles.vodReading, { color: colors.textSecondary }]}>{vodData.reading}</Text>
            <Text style={[styles.vodTranslation, { color: colors.textPrimary }]}>{vodData.translation}</Text>
          </TouchableOpacity>

          {/* Recent history */}
          {history.length > 0 && (
            <View style={styles.historySection}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Recent</Text>
              {history.slice(0, 10).map((verb) => {
                const data = (verbs as Record<string, VerbData>)[verb];
                if (!data) return null;
                return (
                  <TouchableOpacity
                    key={verb}
                    style={[styles.historyItem, { backgroundColor: colors.card }]}
                    onPress={() => handleVerbPress(verb)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.historyLeft}>
                      <Text style={[styles.historyVerb, { color: colors.textPrimary }]}>{verb}</Text>
                      <Text style={[styles.historyReading, { color: colors.textMuted }]}>{data.reading}</Text>
                    </View>
                    <Text style={[styles.historyTranslation, { color: colors.textSecondary }]} numberOfLines={1}>
                      {data.translation}
                    </Text>
                    <TouchableOpacity
                      onPress={() => removeFromHistory(verb)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: fonts.sizes.md },
  listContent: { paddingHorizontal: spacing.md },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  resultLeft: { marginRight: spacing.md },
  resultVerb: { fontSize: fonts.sizes.xl, fontWeight: fonts.weights.bold },
  resultReading: { fontSize: fonts.sizes.sm, marginTop: 2 },
  resultRight: { flex: 1, alignItems: 'flex-end' },
  resultTranslation: { fontSize: fonts.sizes.sm, marginBottom: 4 },
  tagRow: { flexDirection: 'row', gap: spacing.xs },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  tagText: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.medium },
  homeContent: { paddingHorizontal: spacing.md },
  vodCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  vodLabel: { fontSize: fonts.sizes.sm, marginBottom: spacing.sm },
  vodVerb: { fontSize: fonts.sizes.hero, fontWeight: fonts.weights.bold },
  vodReading: { fontSize: fonts.sizes.lg, marginTop: spacing.xs },
  vodTranslation: { fontSize: fonts.sizes.md, marginTop: spacing.sm },
  historySection: { marginTop: spacing.lg },
  sectionTitle: { fontSize: fonts.sizes.sm, fontWeight: fonts.weights.semibold, marginBottom: spacing.sm },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  historyLeft: { marginRight: spacing.md },
  historyVerb: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.semibold },
  historyReading: { fontSize: fonts.sizes.xs },
  historyTranslation: { flex: 1, fontSize: fonts.sizes.sm },
});
