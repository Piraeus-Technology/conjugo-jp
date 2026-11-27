import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import {
  __resetPracticeSettingsStoreForTests,
  allForms,
  allLevels,
  beginnerAdjectiveForms,
  beginnerForms,
  beginnerLevels,
  usePracticeSettingsStore,
} from '../store/practiceSettingsStore';
import { __resetSpacedRepStoreForTests, useSpacedRepStore } from '../store/spacedRepStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { adjectiveKey } from '../utils/adjectives';
import { __resetSessionStoreForTests, useSessionStore } from '../store/sessionStore';
import { __resetFlashcardSessionStoreForTests, useFlashcardSessionStore } from '../store/flashcardSessionStore';
import PracticeSettingsScreen from '../screens/PracticeSettingsScreen';
import AdjectiveScreen from '../screens/AdjectiveScreen';

let mockRouteParams: Record<string, string | undefined> = {};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), setOptions: jest.fn(), addListener: () => jest.fn() }),
  useFocusEffect: jest.fn(),
  useRoute: () => ({ params: mockRouteParams }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('../utils/speech', () => ({ speak: jest.fn(), stopSpeech: jest.fn() }));

const stored = async () => JSON.parse((await AsyncStorage.getItem('practiceSettings'))!);

beforeEach(async () => {
  await AsyncStorage.clear();
  __resetPracticeSettingsStoreForTests();
  __resetSpacedRepStoreForTests();
  __resetSessionStoreForTests();
  __resetFlashcardSessionStoreForTests();
});

describe('adjective practice settings', () => {
  it('turns adjectives on for a new install and never shows it the note', async () => {
    await usePracticeSettingsStore.getState().loadPracticeSettings();
    expect(usePracticeSettingsStore.getState()).toMatchObject({
      activeForms: beginnerForms,
      activeLevels: beginnerLevels,
      adjectivesEnabled: true,
      activeAdjectiveForms: beginnerAdjectiveForms,
      adjectiveNoticeDismissed: true,
    });
    expect(await stored()).toMatchObject({ adjectivesEnabled: true, adjectiveNoticeDismissed: true });
  });

  it('keeps a 1.4.0 learner on verbs only and shows the note', async () => {
    await AsyncStorage.setItem('quiz_stats', '{}');
    await usePracticeSettingsStore.getState().loadPracticeSettings();
    expect(usePracticeSettingsStore.getState()).toMatchObject({
      activeForms: allForms,
      activeLevels: allLevels,
      adjectivesEnabled: false,
      adjectiveNoticeDismissed: false,
    });
  });

  it('loads settings saved by 1.4.2 unchanged, with adjectives off, and does not rewrite them', async () => {
    const chosen = JSON.stringify({ activeForms: ['te', 'potential'], activeLevels: ['N2', 'N1'] });
    await AsyncStorage.setItem('practiceSettings', chosen);
    await usePracticeSettingsStore.getState().loadPracticeSettings();
    expect(usePracticeSettingsStore.getState()).toMatchObject({
      activeForms: ['te', 'potential'],
      activeLevels: ['N2', 'N1'],
      adjectivesEnabled: false,
      adjectiveNoticeDismissed: false,
    });
    expect(await AsyncStorage.getItem('practiceSettings')).toBe(chosen);
  });

  it('turning adjectives on keeps the verb choices and retires the note', async () => {
    await AsyncStorage.setItem('practiceSettings', JSON.stringify({ activeForms: ['te'], activeLevels: ['N3'] }));
    await usePracticeSettingsStore.getState().loadPracticeSettings();
    await usePracticeSettingsStore.getState().setAdjectivesEnabled(true);
    expect(await stored()).toEqual({
      activeForms: ['te'],
      activeLevels: ['N3'],
      adjectivesEnabled: true,
      activeAdjectiveForms: beginnerAdjectiveForms,
      adjectiveNoticeDismissed: true,
      // Settings that predate pairs keep them off, with their note pending.
      pairsEnabled: false,
      pairNoticeDismissed: false,
    });
  });

  it('keeps the note dismissed across a reload', async () => {
    await AsyncStorage.setItem('practiceSettings', JSON.stringify({ activeForms: ['te'], activeLevels: ['N3'] }));
    await usePracticeSettingsStore.getState().loadPracticeSettings();
    await usePracticeSettingsStore.getState().dismissAdjectiveNotice();
    __resetPracticeSettingsStoreForTests();
    await usePracticeSettingsStore.getState().loadPracticeSettings();
    expect(usePracticeSettingsStore.getState()).toMatchObject({ adjectiveNoticeDismissed: true, adjectivesEnabled: false });
  });

  it('resets to the beginner set, adjectives included', async () => {
    await AsyncStorage.setItem('practiceSettings', JSON.stringify({ activeForms: ['te'], activeLevels: ['N3'] }));
    await usePracticeSettingsStore.getState().loadPracticeSettings();
    expect(await usePracticeSettingsStore.getState().resetPracticeSettings()).toBe(true);
    const defaults = {
      activeForms: beginnerForms,
      activeLevels: beginnerLevels,
      adjectivesEnabled: true,
      activeAdjectiveForms: beginnerAdjectiveForms,
      adjectiveNoticeDismissed: true,
      pairsEnabled: true,
      pairNoticeDismissed: true,
    };
    expect(usePracticeSettingsStore.getState()).toMatchObject(defaults);
    expect(await stored()).toEqual(defaults);
  });

  it('applies two quick toggles in a row without losing either', async () => {
    await usePracticeSettingsStore.getState().loadPracticeSettings();
    const { toggleAdjectiveForm, toggleForm } = usePracticeSettingsStore.getState();
    await Promise.all([toggleAdjectiveForm('adverb'), toggleAdjectiveForm('before_noun'), toggleForm('potential'), toggleForm('passive')]);
    const state = usePracticeSettingsStore.getState();
    expect(state.activeAdjectiveForms).toEqual(expect.arrayContaining(['adverb', 'before_noun']));
    expect(state.activeForms).toEqual(expect.arrayContaining(['potential', 'passive']));
    expect((await stored()).activeAdjectiveForms).toEqual(state.activeAdjectiveForms);
  });

  it('never empties the adjective form list', async () => {
    await usePracticeSettingsStore.getState().loadPracticeSettings();
    await usePracticeSettingsStore.getState().setActiveAdjectiveForms(['te']);
    await usePracticeSettingsStore.getState().toggleAdjectiveForm('te');
    expect(usePracticeSettingsStore.getState().activeAdjectiveForms).toEqual(['te']);
  });
});

describe('adjective learning data', () => {
  it('preserves 1.4.2 verb weights, timestamps and sessions before and after an adjective answer', async () => {
    const weights = { 飲む: 3, 食べる: 0.5 };
    const lastPracticedAt = { 飲む: 1735689600000, 食べる: 1735776000000 };
    const sessions = [
      { day: '2025-01-02', total: 12, correct: 8, streak: 6 },
      { day: '2025-01-01', total: 7, correct: 4, streak: 2 },
    ];
    const flashcardSessions = [
      { day: '2025-01-02', reviewed: 9, correct: 7 },
      { day: '2025-01-01', reviewed: 10, correct: 5 },
    ];
    const storedWeights = { version: 2, weights, lastPracticedAt };
    await AsyncStorage.multiSet([
      ['spaced_rep_weights', JSON.stringify(storedWeights)],
      ['sessions', JSON.stringify(sessions)],
      ['flashcardSessions', JSON.stringify(flashcardSessions)],
    ]);
    await Promise.all([
      useSpacedRepStore.getState().loadWeights(),
      useSessionStore.getState().loadSessions(),
      useFlashcardSessionStore.getState().loadSessions(),
    ]);
    const checkSessions = async () => {
      expect(useSessionStore.getState().sessions).toEqual(sessions);
      expect(useFlashcardSessionStore.getState().sessions).toEqual(flashcardSessions);
      expect(await AsyncStorage.getItem('sessions')).toBe(JSON.stringify(sessions));
      expect(await AsyncStorage.getItem('flashcardSessions')).toBe(JSON.stringify(flashcardSessions));
    };
    expect(useSpacedRepStore.getState().weights).toEqual(weights);
    expect(useSpacedRepStore.getState().lastPracticedAt).toEqual(lastPracticedAt);
    expect(await AsyncStorage.getItem('spaced_rep_weights')).toBe(JSON.stringify(storedWeights));
    await checkSessions();

    const key = adjectiveKey('高い');
    const answerTime = 1735862400000;
    const now = jest.spyOn(Date, 'now').mockReturnValue(answerTime);
    try {
      await useSpacedRepStore.getState().recordResult(key, false);
    } finally {
      now.mockRestore();
    }
    const { weights: updatedWeights, lastPracticedAt: updatedTimestamps } = useSpacedRepStore.getState();
    expect(updatedWeights[key]).toBeGreaterThan(1);
    expect(updatedWeights).toEqual({ ...weights, [key]: updatedWeights[key] });
    expect(updatedTimestamps).toEqual({ ...lastPracticedAt, [key]: answerTime });
    expect(JSON.parse((await AsyncStorage.getItem('spaced_rep_weights'))!)).toEqual({
      version: 2, weights: updatedWeights, lastPracticedAt: updatedTimestamps,
    });
    await checkSessions();
  });
});

describe('practice settings screen', () => {
  it('offers existing learners a one-time note that turns adjectives on', async () => {
    mockRouteParams = { mode: 'quiz' };
    usePracticeSettingsStore.setState({ loaded: true, adjectivesEnabled: false, adjectiveNoticeDismissed: false });
    const screen = render(<PracticeSettingsScreen />);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Turn on adjectives' })));
    expect(usePracticeSettingsStore.getState()).toMatchObject({ adjectivesEnabled: true, adjectiveNoticeDismissed: true });
    expect(screen.queryByRole('button', { name: 'Turn on adjectives' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Adjective form, 否定形 (Negative)' })).toBeTruthy();
  });

  it('persists both taps when the adjective switch is tapped twice before rendering', async () => {
    mockRouteParams = { mode: 'quiz' };
    await AsyncStorage.setItem('practiceSettings', JSON.stringify({ activeForms: ['te'], activeLevels: ['N3'] }));
    await usePracticeSettingsStore.getState().loadPracticeSettings();
    const setItem = jest.mocked(AsyncStorage.setItem);
    setItem.mockClear();
    const screen = render(<PracticeSettingsScreen />);
    const toggle = screen.getByRole('checkbox', { name: 'Practice い/な-adjectives and だ/です' });
    await act(async () => {
      fireEvent.press(toggle);
      fireEvent.press(toggle);
    });
    await waitFor(() => expect(setItem).toHaveBeenCalledTimes(2));
    expect(setItem.mock.calls.map(([, value]) => JSON.parse(value).adjectivesEnabled)).toEqual([true, false]);
    expect(await stored()).toMatchObject({ adjectivesEnabled: false, adjectiveNoticeDismissed: true });
    expect(toggle).not.toBeChecked();
  });

  it('names verb and adjective forms separately for screen readers', () => {
    mockRouteParams = { mode: 'quiz' };
    usePracticeSettingsStore.setState({ loaded: true, adjectivesEnabled: true });
    const screen = render(<PracticeSettingsScreen />);
    expect(screen.getByLabelText('て形 (Te-form)')).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Adjective form, て形 (Te-form)' })).toBeChecked();
  });

  it('shows no note once dismissed and hides the adjective forms while adjectives are off', () => {
    mockRouteParams = { mode: 'flashcards' };
    usePracticeSettingsStore.setState({ loaded: true, adjectivesEnabled: false, adjectiveNoticeDismissed: true });
    const screen = render(<PracticeSettingsScreen />);
    expect(screen.queryByRole('button', { name: 'Turn on adjectives' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Adjective form, 否定形 (Negative)' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Practice い/な-adjectives and だ/です' })).toBeTruthy();
  });
});

describe('adjective detail screen', () => {
  it('shows each form with its also-correct variants and favorites the adjective key', async () => {
    mockRouteParams = { word: '静か', highlightForm: 'negative' };
    useFavoritesStore.setState({ favorites: [], loaded: true });
    const screen = render(<AdjectiveScreen />);
    expect(screen.getByText('な形容詞')).toBeTruthy();
    const forms = [
      '静かだ', '静かな', '静かです', '静かじゃない', '静かじゃないです', '静かだった',
      '静かでした', '静かじゃなかった', '静かじゃなかったです', '静かで', '静かに',
      '静かなら', '静かだったら',
    ];
    const rows = screen.getAllByRole('button', { name: /: 静か.*, reading しずか/ });
    expect(rows).toHaveLength(forms.length);
    for (const form of forms) expect(screen.getByText(form, { exact: true })).toBeTruthy();
    expect(screen.getByText('Also: 静かではない')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Add 静か to favorites' })));
    expect(useFavoritesStore.getState().favorites).toEqual([adjectiveKey('静か')]);
  });

  it.each(['きれい', 'ドライ'])('explains %s in its look-alike note', word => {
    mockRouteParams = { word };
    const screen = render(<AdjectiveScreen />);
    expect(screen.getByText('な-adjective although it ends in い.')).toBeTruthy();
  });
});
