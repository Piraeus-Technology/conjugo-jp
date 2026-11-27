import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import verbs from '../data/verbs.json';
import { useColors, fonts, spacing, radius } from '../utils/theme';
import { usePracticeSettingsStore } from '../store/practiceSettingsStore';
import { useHistoryStore } from '../store/historyStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { verbList } from '../utils/verbSearch';
import {
  browseAdjectives,
  searchWords,
  type AdjectiveGroup,
  type WordSearchResult,
} from '../utils/wordSearch';
import { adjectiveKey, adjectiveMap, parseAdjectiveKey } from '../utils/adjectives';
import { useTodayKey } from '../hooks/useTodayKey';
import { getDailyVerbPool, getVerbOfTheDayForKey } from '../utils/verbOfTheDay';
import type { SearchStackParamList } from '../types/navigation';
import { VerbData, VerbGroup, JLPTLevel } from '../utils/conjugate';

type NavProp = NativeStackNavigationProp<SearchStackParamList>;
type WordGroup = VerbGroup | AdjectiveGroup;

const groupLabels: Record<WordGroup, string> = {
  godan: '五段',
  ichidan: '一段',
  irregular: '不規則',
  'i-adjective': 'い形容詞',
  'na-adjective': 'な形容詞',
  copula: 'だ・です',
};

const groupAccessibilityLabels: Record<WordGroup, string> = {
  godan: 'Godan verb',
  ichidan: 'Ichidan verb',
  irregular: 'Irregular verb',
  'i-adjective': 'い-adjective',
  'na-adjective': 'な-adjective',
  copula: 'Copula',
};

const levelFilters: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
const groupFilters: { value: WordGroup; label: string }[] = [
  { value: 'godan', label: '五段 (Godan)' },
  { value: 'ichidan', label: '一段 (Ichidan)' },
  { value: 'irregular', label: '不規則 (Irregular)' },
  { value: 'i-adjective', label: 'い形容詞 (i-adj.)' },
  { value: 'na-adjective', label: 'な形容詞 (na-adj.)' },
  { value: 'copula', label: 'だ・です (Copula)' },
];
const transitivityFilters: { value: boolean; label: string }[] = [
  { value: true, label: '他動詞 (Trans.)' },
  { value: false, label: '自動詞 (Intr.)' },
];

export default function HomeScreen() {
  const colors = useColors();
  const navigation = useNavigation<NavProp>();
  const { history, loadHistory, addToHistory, removeFromHistory } = useHistoryStore();
  const { favorites, loadFavorites, toggleFavorite } = useFavoritesStore();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<JLPTLevel[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<WordGroup[]>([]);
  const [selectedTransitivity, setSelectedTransitivity] = useState<boolean[]>([]);

  useEffect(() => {
    loadHistory();
    loadFavorites();
  }, [loadHistory, loadFavorites]);

  useEffect(() => {
    if (!query.trim()) {
      setDebouncedQuery('');
      return;
    }
    const timeout = setTimeout(() => setDebouncedQuery(query), 120);
    return () => clearTimeout(timeout);
  }, [query]);

  const hasActiveFilters = selectedLevels.length > 0 || selectedGroups.length > 0 || selectedTransitivity.length > 0;

  const toggleLevel = useCallback((level: JLPTLevel) => {
    setSelectedLevels(current =>
      current.includes(level) ? current.filter(item => item !== level) : [...current, level]
    );
  }, []);

  const toggleGroup = useCallback((group: WordGroup) => {
    setSelectedGroups(current =>
      current.includes(group) ? current.filter(item => item !== group) : [...current, group]
    );
  }, []);

  const toggleTransitivity = useCallback((value: boolean) => {
    setSelectedTransitivity(current =>
      current.includes(value) ? current.filter(item => item !== value) : [...current, value]
    );
  }, []);

  const passesFilters = useCallback((item: { jlpt?: string; group?: string; transitive?: boolean }) => {
    const matchesLevel = selectedLevels.length === 0 || selectedLevels.includes(item.jlpt as JLPTLevel);
    const matchesGroup = selectedGroups.length === 0 || selectedGroups.includes(item.group as WordGroup);
    const matchesTransitivity = selectedTransitivity.length === 0 ||
      (item.transitive !== undefined && selectedTransitivity.includes(item.transitive));
    return matchesLevel && matchesGroup && matchesTransitivity;
  }, [selectedLevels, selectedGroups, selectedTransitivity]);

  const filteredVerbResults = useMemo((): WordSearchResult[] => {
    if (!hasActiveFilters) return [];
    const verbRows: WordSearchResult[] = verbList
      .filter(([, data]) => passesFilters(data))
      .map(([verb, data]) => ({
        kind: 'verb',
        verb,
        reading: data.reading,
        translation: data.translation,
        jlpt: data.jlpt,
        group: data.group,
        transitive: data.transitive,
        matchType: 'verb',
      }));
    return [...verbRows, ...browseAdjectives(passesFilters)];
  }, [hasActiveFilters, passesFilters]);

  const results = useMemo((): WordSearchResult[] => {
    if (!query.trim()) return filteredVerbResults;
    if (!debouncedQuery.trim()) return [];
    return searchWords(debouncedQuery, passesFilters);
  }, [query, debouncedQuery, filteredVerbResults, passesFilters]);

  const handleVerbPress = useCallback((verb: string, highlightForm?: string) => {
    addToHistory(verb);
    navigation.navigate('Conjugation', { verb, highlightForm });
  }, [addToHistory, navigation]);

  const handleAdjectivePress = useCallback((word: string, highlightForm?: string) => {
    addToHistory(adjectiveKey(word));
    navigation.navigate('Adjective', { word, highlightForm });
  }, [addToHistory, navigation]);

  const handleResultPress = useCallback((item: WordSearchResult) => {
    if (item.kind === 'adjective') handleAdjectivePress(item.verb, item.matchForm);
    else handleVerbPress(item.verb, item.matchForm);
  }, [handleAdjectivePress, handleVerbPress]);

  const vodDayKey = useTodayKey();
  const activeLevels = usePracticeSettingsStore(state => state.activeLevels);
  const dailyVerbPool = useMemo(() => getDailyVerbPool(verbList, activeLevels), [activeLevels]);
  const [vodVerb, vodData] = useMemo(
    () => getVerbOfTheDayForKey(dailyVerbPool, vodDayKey),
    [dailyVerbPool, vodDayKey],
  );

  const groupTagColors: Record<WordGroup, { bg: string; text: string }> = {
    godan: { bg: colors.godanTag, text: colors.godanTagText },
    ichidan: { bg: colors.ichidanTag, text: colors.ichidanTagText },
    irregular: { bg: colors.irregularTag, text: colors.irregularTagText },
    'i-adjective': { bg: colors.pillBg, text: colors.pillText },
    'na-adjective': { bg: colors.pillBg, text: colors.pillText },
    copula: { bg: colors.pillBg, text: colors.pillText },
  };

  const getLevelTagColors = (level: string) => {
    switch (level) {
      case 'N5': return { bg: colors.n5Bg, text: colors.n5Text };
      case 'N4': return { bg: colors.n4Bg, text: colors.n4Text };
      case 'N3': return { bg: colors.n3Bg, text: colors.n3Text };
      case 'N2': return { bg: colors.n2Bg, text: colors.n2Text };
      case 'N1': return { bg: colors.n1Bg, text: colors.n1Text };
      default: return { bg: colors.pillBg, text: colors.textMuted };
    }
  };

  const getTransitivityColors = (transitive: boolean) => transitive
    ? { bg: colors.transitiveBg, text: colors.transitiveText, label: '他動詞' }
    : { bg: colors.intransitiveBg, text: colors.intransitiveText, label: '自動詞' };

  const renderFilterChip = (
    key: string,
    label: string,
    active: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={key}
      style={[
        styles.filterChip,
        {
          backgroundColor: active ? colors.pillActiveBg : colors.pillBg,
          borderColor: active ? colors.pillActiveBg : colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Filter by ${label}`}
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.filterChipText, { color: active ? colors.pillActiveText : colors.pillText }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderDeleteAction = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });
    return (
      <View style={styles.deleteAction}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
        </Animated.View>
      </View>
    );
  };

  const renderVerbItem = ({ item }: { item: WordSearchResult }) => {
    const tagColor = groupTagColors[item.group as WordGroup];
    const levelTagColor = getLevelTagColors(item.jlpt);
    return (
      <TouchableOpacity
        style={[styles.resultItem, { backgroundColor: colors.card }]}
        onPress={() => handleResultPress(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.verb}, ${item.reading}, ${item.translation}, ${groupAccessibilityLabels[item.group as WordGroup]}`}
        accessibilityHint={item.matchDetail || 'Opens the conjugation table'}
      >
        <View style={styles.resultLeft}>
          <Text style={[styles.resultVerb, { color: colors.textPrimary }]}>{item.verb}</Text>
          <Text style={[styles.resultReading, { color: colors.textSecondary }]}>{item.reading}</Text>
        </View>
        <View style={styles.resultRight}>
          <Text style={[styles.resultTranslation, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.translation}
          </Text>
          {item.matchType === 'conjugation' && item.matchDetail && (
            <Text style={[styles.matchDetail, { color: colors.primaryText }]} numberOfLines={1}>
              {item.matchDetail}
            </Text>
          )}
          <View style={styles.tagRow}>
            <View style={[styles.tag, { backgroundColor: tagColor.bg }]}>
              <Text style={[styles.tagText, { color: tagColor.text }]}>
                {groupLabels[item.group as WordGroup]}
              </Text>
            </View>
            <View style={[styles.tag, { backgroundColor: levelTagColor.bg }]}>
              <Text style={[styles.tagText, { color: levelTagColor.text }]}>{item.jlpt}</Text>
            </View>
            {item.transitive !== undefined && (() => {
              const transitivity = getTransitivityColors(item.transitive);
              return (
                <View style={[styles.tag, { backgroundColor: transitivity.bg }]}>
                  <Text
                    style={[styles.tagText, { color: transitivity.text }]}
                    accessibilityLabel={item.transitive ? 'Transitive verb' : 'Intransitive verb'}
                  >
                    {transitivity.label}
                  </Text>
                </View>
              );
            })()}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Favorites and history hold verb headwords and adj:<headword> keys.
  const renderSwipeableRow = (key: string, type: 'favorite' | 'history') => {
    const adjective = parseAdjectiveKey(key);
    const data = adjective
      ? adjectiveMap[adjective]
      : (verbs as Record<string, VerbData>)[key];
    if (!data) return null;
    const verb = adjective ?? key;

    const handleSwipeDelete = () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (type === 'favorite') {
        toggleFavorite(key);
      } else {
        removeFromHistory(key);
      }
    };

    return (
      <Swipeable
        key={key + type}
        renderRightActions={renderDeleteAction}
        onSwipeableOpen={handleSwipeDelete}
        overshootRight={false}
      >
        <TouchableOpacity
          style={[styles.historyItem, { backgroundColor: colors.bg }]}
          onPress={() => (adjective ? handleAdjectivePress(adjective) : handleVerbPress(verb))}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={`${verb}, ${data.reading}, ${data.translation}`}
          accessibilityHint="Opens conjugation table"
          accessibilityActions={type === 'history' ? [{ name: 'remove', label: 'Remove from Recent' }] : undefined}
          onAccessibilityAction={type === 'history' ? event => {
            if (event.nativeEvent.actionName === 'remove') handleSwipeDelete();
          } : undefined}
        >
          <View style={styles.historyLeft}>
            <Text style={[styles.historyVerb, { color: colors.textPrimary }]}>{verb}</Text>
            <Text style={[styles.historyReading, { color: colors.textMuted }]}>{data.reading}</Text>
          </View>
          <Text style={[styles.historyTranslation, { color: colors.textSecondary }]} numberOfLines={1}>
            {data.translation}
          </Text>
          {type === 'favorite' ? (
            <Ionicons name="heart" size={16} color={colors.accent} style={{ marginLeft: 8 }} />
          ) : (
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 8 }} />
          )}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const vodLevelTagColor = getLevelTagColors(vodData.jlpt);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.searchBg }]}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search verbs & adjectives (kanji, kana, romaji, English)..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Search Japanese verbs and adjectives"
          accessibilityHint="Search by kanji, hiragana, romaji, English, or conjugated form"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContent}
        style={styles.filterScroll}
      >
        {levelFilters.map(level =>
          renderFilterChip(level, level, selectedLevels.includes(level), () => toggleLevel(level))
        )}
        {groupFilters.map(group =>
          renderFilterChip(group.value, group.label, selectedGroups.includes(group.value), () => toggleGroup(group.value))
        )}
        {transitivityFilters.map(t =>
          renderFilterChip(t.label, t.label, selectedTransitivity.includes(t.value), () => toggleTransitivity(t.value))
        )}
      </ScrollView>

      {query.trim() || hasActiveFilters ? (
        <FlatList
          data={results}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          keyExtractor={(item) => item.kind + item.verb + item.matchType}
          renderItem={renderVerbItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={query.trim() !== debouncedQuery.trim() ? null : (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No matching words</Text>
          )}
        />
      ) : (
        <ScrollView style={styles.homeContent}>
          {/* Verb of the Day */}
          <TouchableOpacity
            style={[styles.vodCard, { backgroundColor: colors.card }]}
            onPress={() => handleVerbPress(vodVerb)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Verb of the Day: ${vodVerb}, ${vodData.reading}, ${vodData.translation}, JLPT ${vodData.jlpt}`}
            accessibilityHint="Opens conjugation table"
          >
            <Text style={[styles.vodLabel, { color: colors.textMuted }]}>Verb of the Day</Text>
            <Text style={[styles.vodVerb, { color: colors.primaryText }]}>{vodVerb}</Text>
            <Text style={[styles.vodReading, { color: colors.textSecondary }]}>{vodData.reading}</Text>
            <Text style={[styles.vodTranslation, { color: colors.textPrimary }]}>{vodData.translation}</Text>
            <View style={styles.vodBadgeRow}>
              <View style={[styles.vodBadge, { backgroundColor: groupTagColors[vodData.group].bg }]}>
                <Text style={[styles.vodBadgeText, { color: groupTagColors[vodData.group].text }]}>
                  {groupLabels[vodData.group]}
                </Text>
              </View>
              <View style={[styles.vodBadge, { backgroundColor: vodLevelTagColor.bg }]}>
                <Text style={[styles.vodBadgeText, { color: vodLevelTagColor.text }]}>
                  {vodData.jlpt}
                </Text>
              </View>
              {vodData.transitive !== undefined && (() => {
                const transitivity = getTransitivityColors(vodData.transitive);
                return (
                  <View style={[styles.vodBadge, { backgroundColor: transitivity.bg }]}>
                    <Text
                      style={[styles.vodBadgeText, { color: transitivity.text }]}
                      accessibilityLabel={vodData.transitive ? 'Transitive verb' : 'Intransitive verb'}
                    >
                      {transitivity.label}
                    </Text>
                  </View>
                );
              })()}
            </View>
          </TouchableOpacity>

          {/* Favorites */}
          {favorites.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Favorites</Text>
              {favorites.map((verb) => renderSwipeableRow(verb, 'favorite'))}
            </View>
          )}

          {/* Recent history */}
          {history.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Recent</Text>
              {history.slice(0, 10).map((verb) => renderSwipeableRow(verb, 'history'))}
            </View>
          )}

          {/* Empty state */}
          {favorites.length === 0 && history.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.heroEmoji}>📖</Text>
              <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>ConjuGo JP</Text>
              <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
                Search for any Japanese verb, adjective or conjugation
              </Text>
            </View>
          )}

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      )}
    </View>
  );
}

export const styles = StyleSheet.create({
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
  filterScroll: {
    maxHeight: 48,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  filterContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    alignItems: 'center',
  },
  filterChip: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterChipText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
  },
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
  resultTranslation: { fontSize: fonts.sizes.sm, marginBottom: 2 },
  matchDetail: { fontSize: fonts.sizes.xs, fontStyle: 'italic', marginBottom: 4 },
  tagRow: { flexDirection: 'row', gap: spacing.xs },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  tagText: { fontSize: fonts.sizes.xs, fontWeight: fonts.weights.medium },
  homeContent: { flex: 1, paddingHorizontal: spacing.md },
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
  vodBadgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  vodBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  vodBadgeText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
  },
  section: { marginTop: spacing.lg },
  sectionTitle: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  historyLeft: { marginRight: spacing.md },
  historyVerb: { fontSize: fonts.sizes.lg, fontWeight: fonts.weights.semibold },
  historyReading: { fontSize: fonts.sizes.xs },
  historyTranslation: { flex: 1, fontSize: fonts.sizes.sm },
  emptyText: { textAlign: 'center', marginTop: spacing.xl, fontSize: fonts.sizes.md },
  emptyContainer: { alignItems: 'center', paddingTop: spacing.xl },
  heroEmoji: { fontSize: 48 },
  heroTitle: { fontSize: fonts.sizes.hero, fontWeight: fonts.weights.bold, marginTop: spacing.md },
  heroSubtitle: { fontSize: fonts.sizes.md, marginTop: spacing.xs },
  deleteAction: {
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
});
