import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render } from '@testing-library/react-native';
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
    expect(usePracticeSettingsStore.getState()).toMatchObject({
      activeForms: beginnerForms,
      adjectivesEnabled: true,
      activeAdjectiveForms: beginnerAdjectiveForms,
    });
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
  it('records an adjective under its own key and leaves verb weights untouched', async () => {
    await AsyncStorage.setItem('spaced_rep_weights', JSON.stringify({ 飲む: 3, 食べる: 0.5 }));
    await useSpacedRepStore.getState().loadWeights();
    await useSpacedRepStore.getState().recordResult(adjectiveKey('高い'), false);
    const { weights } = useSpacedRepStore.getState();
    expect(weights).toMatchObject({ 飲む: 3, 食べる: 0.5 });
    expect(weights[adjectiveKey('高い')]).toBeGreaterThan(1);
    expect(weights['高い']).toBeUndefined();
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
    expect(screen.getByRole('checkbox', { name: '否定形 (Negative)' })).toBeTruthy();
  });

  it('shows no note once dismissed and hides the adjective forms while adjectives are off', () => {
    mockRouteParams = { mode: 'flashcards' };
    usePracticeSettingsStore.setState({ loaded: true, adjectivesEnabled: false, adjectiveNoticeDismissed: true });
    const screen = render(<PracticeSettingsScreen />);
    expect(screen.queryByRole('button', { name: 'Turn on adjectives' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: '否定形 (Negative)' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Practise い/な-adjectives and だ/です' })).toBeTruthy();
  });
});

describe('adjective detail screen', () => {
  it('shows each form with its also-correct variants and favorites the adjective key', async () => {
    mockRouteParams = { word: '静か', highlightForm: 'negative' };
    useFavoritesStore.setState({ favorites: [], loaded: true });
    const screen = render(<AdjectiveScreen />);
    expect(screen.getByText('な形容詞')).toBeTruthy();
    expect(screen.getByText('静かじゃない')).toBeTruthy();
    expect(screen.getByText('Also: 静かではない')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Add 静か to favorites' })));
    expect(useFavoritesStore.getState().favorites).toEqual([adjectiveKey('静か')]);
  });

  it('explains a look-alike in its note', () => {
    mockRouteParams = { word: 'きれい' };
    const screen = render(<AdjectiveScreen />);
    expect(screen.getByText('な-adjective although it ends in い.')).toBeTruthy();
  });
});
