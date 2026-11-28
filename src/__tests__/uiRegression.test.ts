import { existsSync } from 'fs';
import { join } from 'path';
import { AppState, FlatList, ScrollView, StyleSheet } from 'react-native';
import React from 'react';
import { act, fireEvent, isHiddenFromAccessibility, render, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Ionicons from '@expo/vector-icons/Ionicons';
import HomeScreen, { styles as homeStyles } from '../screens/HomeScreen';
import { getConjugationIndex } from '../utils/verbSearch';
import { themes } from '../utils/theme';
import { usePracticeSettingsStore } from '../store/practiceSettingsStore';
import { useHistoryStore } from '../store/historyStore';
import { useFavoritesStore } from '../store/favoritesStore';
import verbs from '../data/verbs.json';

const mockNavigate = jest.fn();
const mockNavigation = { navigate: mockNavigate, addListener: () => jest.fn() };

jest.mock(
  '@react-native-async-storage/async-storage',
  // The package ships this CommonJS mock as its supported Jest integration.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light' },
  NotificationFeedbackType: { Success: 'Success' },
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

function renderHome() {
  return render(React.createElement(GestureHandlerRootView, null, React.createElement(HomeScreen)));
}

function relativeLuminance(hex: string): number {
  const channels = hex
    .replace('#', '')
    .match(/.{2}/g)!
    .map(channel => parseInt(channel, 16) / 255)
    .map(channel => channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('UI regression guards', () => {
  beforeEach(() => {
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  });
  afterEach(() => jest.restoreAllMocks());

  it('announces the daily verb JLPT level to screen readers', async () => {
    const screen = renderHome();
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByLabelText(/^Verb of the Day: .*, JLPT N[1-5]$/)).toBeTruthy();
  });

  it('reaches だ/です through a filter and includes its class in the row name', async () => {
    const screen = renderHome();
    const chip = screen.getByRole('button', { name: 'Filter by だ・です (Copula)' });
    await act(async () => fireEvent.press(chip));
    expect(screen.getByRole('button', { name: /^だ, だ, .*Copula$/ })).toBeTruthy();
  });

  it('updates the daily verb from the selected practice levels', () => {
    const levels = usePracticeSettingsStore.getState().activeLevels;
    const screen = renderHome();
    try {
      act(() => usePracticeSettingsStore.setState({ activeLevels: ['N1'] }));
      expect(screen.getByRole('button', { name: /^Verb of the Day: .*, JLPT N1$/ })).toBeTruthy();
      act(() => usePracticeSettingsStore.setState({ activeLevels: ['N5'] }));
      expect(screen.getByRole('button', { name: /^Verb of the Day: .*, JLPT N5$/ })).toBeTruthy();
    } finally {
      act(() => usePracticeSettingsStore.setState({ activeLevels: levels }));
    }
  });

  it('opens favorites beyond the first ten', async () => {
    const favorites = Object.keys(verbs).slice(0, 11);
    useFavoritesStore.setState({ favorites, loaded: true });
    const screen = renderHome();
    const verb = favorites[10];
    const data = verbs[verb as keyof typeof verbs];
    fireEvent.press(screen.getByLabelText(`${verb}, ${data.reading}, ${data.translation}`));
    expect(mockNavigate).toHaveBeenCalledWith('Conjugation', { verb, highlightForm: undefined });
    screen.unmount();
    useFavoritesStore.setState({ favorites: [], loaded: true });
  });

  it('lets assistive technology remove a Recent entry without a swipe', async () => {
    useHistoryStore.setState({ history: ['食べる'], loaded: true });
    const screen = renderHome();
    const row = screen.getByRole('button', { name: '食べる, たべる, to eat' });
    expect(row.props.accessibilityActions).toEqual([{ name: 'remove', label: 'Remove from Recent' }]);
    await act(async () => fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'remove' } }));
    expect(useHistoryStore.getState().history).toEqual([]);
    expect(screen.queryByText('Recent')).toBeNull();
  });

  it('hides closed swipe actions and removes both kinds of saved row on open', async () => {
    const savedFavorites = useFavoritesStore.getState().favorites;
    const savedHistory = useHistoryStore.getState().history;
    useFavoritesStore.setState({ favorites: ['飲む'], loaded: true });
    useHistoryStore.setState({ history: ['食べる'], loaded: true });
    const screen = renderHome();
    try {
      await act(async () => fireEvent.press(screen.getByRole('button', { name: '食べる, たべる, to eat' })));
      expect(mockNavigate).toHaveBeenCalledWith('Conjugation', { verb: '食べる', highlightForm: undefined });
      const icons = screen.UNSAFE_getAllByType(Ionicons).filter(icon => icon.props.name === 'trash-outline');
      expect(icons).toHaveLength(2);
      for (const icon of icons) {
        expect(isHiddenFromAccessibility(icon)).toBe(true);
        let panel = icon.parent;
        while (panel && (typeof panel.type !== 'string' || !panel.props.accessibilityElementsHidden)) {
          panel = panel.parent;
        }
        expect(panel).toHaveStyle({ opacity: 0 });
      }

      const rows = screen.UNSAFE_getAllByType(ReanimatedSwipeable);
      expect(rows).toHaveLength(2);
      await act(async () => rows.forEach(row => row.props.onSwipeableOpen('left')));
      expect(useFavoritesStore.getState().favorites).toEqual([]);
      expect(useHistoryStore.getState().history).toEqual([]);
    } finally {
      screen.unmount();
      useFavoritesStore.setState({ favorites: savedFavorites });
      useHistoryStore.setState({ history: savedHistory });
    }
  });

  it('passes handled taps through both search scroll containers and dismisses on a results drag', async () => {
    const screen = renderHome();
    const chipStrip = screen.UNSAFE_getAllByType(ScrollView).find(view => view.props.horizontal);
    expect(chipStrip?.props.keyboardShouldPersistTaps).toBe('handled');
    fireEvent.press(screen.getByLabelText('Filter by N5'));
    const results = screen.UNSAFE_getByType(FlatList);
    expect(results.props.keyboardShouldPersistTaps).toBe('handled');
    expect(results.props.keyboardDismissMode).toBe('on-drag');
    await act(async () => { await Promise.resolve(); });
  });

  it.each([false, true])('shows the empty message only after debounce with a filter active: %s', async (filter) => {
    const screen = renderHome();
    if (filter) fireEvent.press(screen.getByLabelText('Filter by N5'));
    const search = screen.getByLabelText('Search Japanese verbs and adjectives');
    fireEvent.changeText(search, '🦉');
    expect(screen.queryByText('No matching words')).toBeNull();
    await waitFor(() => expect(screen.getByText('No matching words')).toBeTruthy());
    fireEvent.changeText(search, '食べる');
    expect(screen.queryByText('No matching words')).toBeNull();
  });

  it('finds N1 suru verbs after filtering rather than truncating them first', async () => {
    const screen = renderHome();
    fireEvent.press(screen.getByLabelText('Filter by N1'));
    fireEvent.changeText(screen.getByLabelText('Search Japanese verbs and adjectives'), 'する');
    await waitFor(() => expect(screen.getByText('寄与する')).toBeTruthy());
    expect(screen.queryByText('No matching words')).toBeNull();
  });

  it.each(['light', 'dark'] as const)('keeps themed text and interactive outlines legible in %s mode', mode => {
    const colors = themes[mode];
    const surfaces = [colors.bg, colors.card, colors.searchBg, colors.flashcardBack];
    for (const textColor of [colors.textPrimary, colors.textMuted, colors.textSecondary, colors.primaryText]) {
      for (const surface of surfaces) {
        expect(contrastRatio(textColor, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
    const textPairs = [
      ['#FFFFFF', colors.primary], [colors.accent, colors.card],
      [colors.pillText, colors.pillBg], [colors.pillActiveText, colors.pillActiveBg],
      [colors.textSecondary, colors.pillBg],
      [colors.godanTagText, colors.godanTag], [colors.ichidanTagText, colors.ichidanTag],
      [colors.irregularTagText, colors.irregularTag],
      [colors.transitiveText, colors.transitiveBg], [colors.intransitiveText, colors.intransitiveBg],
      [colors.successText, colors.successBg], [colors.errorText, colors.errorBg],
      [colors.successText, colors.card], [colors.errorText, colors.card], [colors.errorText, colors.bg],
      [colors.calHighText, colors.calHigh], [colors.calMidText, colors.calMid], [colors.calLowText, colors.calLow],
      [colors.n5Text, colors.n5Bg], [colors.n4Text, colors.n4Bg], [colors.n3Text, colors.n3Bg],
      [colors.n2Text, colors.n2Bg], [colors.n1Text, colors.n1Bg], [colors.tabActive, colors.bg],
      [colors.speechIndicatorText, colors.speechIndicatorBg],
    ];
    for (const [text, surface] of textPairs) {
      expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(colors.uncheckedOutline, colors.card)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(colors.practiceBorder, colors.card)).toBeGreaterThanOrEqual(1.7);
    expect(contrastRatio(colors.practiceBorder, colors.flashcardBack)).toBeGreaterThanOrEqual(1.7);
  });

  it('keeps search filter chips at least 44 points tall', () => {
    expect(StyleSheet.flatten(homeStyles.filterChip)?.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('excludes unavailable forms from search but retains valid quiz exclusions', () => {
    const index = getConjugationIndex();
    expect(index.get('あれる') ?? []).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ verb: 'ある', form: 'potential' }),
    ]));
    expect(index.get('うけられる') ?? []).toEqual(expect.arrayContaining([
      expect.objectContaining({ verb: '受ける', form: 'passive' }),
    ]));
  });

  it('keeps the large design source outside the bundled assets directory', () => {
    expect(existsSync(join(process.cwd(), 'assets/icon-source.png'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'design/icon-source.png'))).toBe(true);
  });
});
