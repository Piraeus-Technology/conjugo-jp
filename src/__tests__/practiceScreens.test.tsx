import React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessibilityInfo, Animated, AppState, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import ConjugationScreen from '../screens/ConjugationScreen';
import FlashcardScreen from '../screens/FlashcardScreen';
import { __resetFlashcardStatsStoreForTests } from '../store/flashcardStatsStore';
import { __resetFlashcardSessionStoreForTests } from '../store/flashcardSessionStore';
import { __resetHistoryStoreForTests, useHistoryStore } from '../store/historyStore';
import { useThemeStore } from '../store/themeStore';
import { maybeRequestStoreReview } from '../utils/storeReviewPrompt';
import { speak, stopSpeech } from '../utils/speech';
import PracticeSettingsScreen from '../screens/PracticeSettingsScreen';
import QuizScreen from '../screens/QuizScreen';
import { __resetPracticeSettingsStoreForTests, allForms, allLevels, usePracticeSettingsStore } from '../store/practiceSettingsStore';
import { __resetQuizStoreForTests, useQuizStore } from '../store/quizStore';
import { __resetSessionStoreForTests } from '../store/sessionStore';
import { __resetSpacedRepStoreForTests, useSpacedRepStore } from '../store/spacedRepStore';
import verbs from '../data/verbs.json';
import adjectives from '../data/adjectives.json';
import type { AdjectiveData } from '../utils/adjectives';

let mockRouteParams: { verb?: string; highlightForm?: string; mode?: string };
const mockNavigation = { setOptions: jest.fn(), push: jest.fn(), addListener: () => jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
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
  ImpactFeedbackStyle: { Light: 'Light' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('../utils/storeReviewPrompt', () => ({ maybeRequestStoreReview: jest.fn() }));
jest.mock('../utils/speech', () => ({ speak: jest.fn(), stopSpeech: jest.fn() }));
jest.mock('../utils/flashcardCard', () => ({ generateFlashcard: jest.fn() }));
jest.mock('../utils/quizQuestion', () => ({ generateQuestion: jest.fn() }));
// These screens' verb expectations stay deterministic: with no eligible
// adjectives the practice pool always takes the verb path.
jest.mock('../utils/adjectivePractice', () => ({
  countEligibleAdjectives: jest.fn(() => 0),
  generateAdjectiveQuestion: jest.fn(() => null),
  generateAdjectiveCard: jest.fn(() => null),
}));

const question = {
  verb: '食べる', reading: 'たべる', translation: 'to eat', form: 'masu' as const,
  correctAnswer: 'たべます', options: ['たべます', 'たべる', 'たべない', 'たべた'], verbData: verbs['食べる'],
};

// Pairs are their own switch, on for a new install. These screen tests drive
// verb and adjective questions, so they run with no pairs unless one sets them.
jest.mock('../utils/pairs', () => ({ ...jest.requireActual('../utils/pairs'), pairList: [] }));
const mockedPairList = (): unknown[] => jest.requireMock('../utils/pairs').pairList;

beforeEach(async () => {
  await AsyncStorage.clear();
  mockedPairList().length = 0;
  mockRouteParams = { verb: '開く' };
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  jest.clearAllMocks();
  __resetQuizStoreForTests();
  __resetFlashcardSessionStoreForTests();
  __resetFlashcardStatsStoreForTests();
  __resetHistoryStoreForTests();
  __resetSessionStoreForTests();
  __resetPracticeSettingsStoreForTests();
  __resetSpacedRepStoreForTests();
  const { generateQuestion } = jest.requireMock('../utils/quizQuestion');
  generateQuestion.mockReturnValue(question);
  const { generateFlashcard } = jest.requireMock('../utils/flashcardCard');
  generateFlashcard.mockReturnValue({ ...question, answer: question.correctAnswer });
});

afterEach(() => jest.restoreAllMocks());

async function ready(component: React.ReactElement) {
  const screen = render(component);
  await act(async () => { await Promise.resolve(); });
  return screen;
}

it('keeps answer options, the wrong-answer explanation, and Next inside expanding scroll content', async () => {
  const screen = await ready(<QuizScreen />);
  await act(async () => fireEvent.press(screen.getByLabelText('Answer: たべる')));
  const scroll = screen.UNSAFE_getByType(ScrollView);
  expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({ flexGrow: 1, flexShrink: 0 });
  for (const label of [/^Answer:/, /Show conjugation rule/, /Next question/]) {
    for (const node of screen.getAllByLabelText(label)) {
      let parent = node.parent;
      while (parent && parent !== scroll) parent = parent.parent;
      expect(parent).toBe(scroll);
    }
  }
});

it('never starts speech from the hidden flashcard answer control', async () => {
  const screen = await ready(<FlashcardScreen />);
  const hidden = screen.getByLabelText('Play pronunciation of たべます', { includeHiddenElements: true });
  expect(screen.queryByLabelText('Play pronunciation of たべます')).toBeNull();
  fireEvent.press(hidden, { stopPropagation: jest.fn() });
  expect(speak).not.toHaveBeenCalled();
});

it.each(['missed', 'got it'])('stops flashcard speech when the card is graded %s', async (grade) => {
  const animation = jest.spyOn(Animated, 'timing').mockReturnValue({
    start: (complete) => complete?.({ finished: true }),
    stop: jest.fn(),
    reset: jest.fn(),
  });
  try {
    const screen = await ready(<FlashcardScreen />);
    fireEvent.press(screen.getByLabelText(/^Tap to reveal /));
    fireEvent.press(screen.getByLabelText('Play pronunciation of たべます'), { stopPropagation: jest.fn() });
    expect(speak).toHaveBeenCalledWith('たべます');
    await act(async () => fireEvent.press(screen.getByLabelText('Mark card as ' + grade)));
    expect(stopSpeech).toHaveBeenCalledTimes(1);
  } finally {
    animation.mockRestore();
  }
});

it('speaks the displayed kana あく when the 開く header button is pressed', async () => {
  const screen = await ready(<ConjugationScreen />);
  fireEvent.press(screen.getByLabelText('Play pronunciation of 開く'));
  expect(speak).toHaveBeenCalledWith('あく');
});

it('restarts a streak of eight and the review baseline after resetting learning data', async () => {
  const screen = await ready(<QuizScreen />);
  async function answer() {
    await act(async () => fireEvent.press(screen.getByLabelText('Answer: たべます')));
    fireEvent.press(screen.getByLabelText('Next question'));
  }
  for (let i = 0; i < 8; i++) await answer();
  expect(useQuizStore.getState()).toMatchObject({ totalQuestions: 8, bestStreak: 8 });

  await act(async () => { await useQuizStore.getState().resetStats(); });
  await answer();
  expect(useQuizStore.getState()).toMatchObject({ totalQuestions: 1, totalCorrect: 1, bestStreak: 1 });
  expect(maybeRequestStoreReview).not.toHaveBeenCalled();

  for (let i = 0; i < 9; i++) await answer();
  expect(maybeRequestStoreReview).toHaveBeenCalledTimes(1);
  expect(maybeRequestStoreReview).toHaveBeenCalledWith(expect.objectContaining({
    newStreak: 10, totalQuestionsAtVisitStart: 0, answersThisVisitBeforeCurrent: 9,
  }));
});

it('exposes each flashcard face separately with its translation and keeps grading hidden until the flip', async () => {
  const screen = await ready(<FlashcardScreen />);
  const front = screen.getByRole('button', { name: /^Tap to reveal/ });
  expect(front.props.accessibilityLabel).toContain('to eat');
  expect(front.props.accessibilityLabel).not.toContain('たべます');
  expect(screen.queryByRole('button', { name: /^Mark card/ })).toBeNull();

  fireEvent.press(front);
  const back = screen.getByLabelText(/Answer: たべます.*to eat/);
  const speakButton = screen.getByRole('button', { name: 'Play pronunciation of たべます' });
  for (let node = speakButton.parent; node; node = node.parent) {
    expect(node).not.toBe(back);
  }
  expect(screen.queryByRole('button', { name: /^Tap to reveal/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Mark card as missed' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Mark card as got it' })).toBeEnabled();
});

it('guards Next before an answer and announces which option was correct', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  try {
    const screen = await ready(<QuizScreen />);
    const { generateQuestion } = jest.requireMock('../utils/quizQuestion');
    const hidden = screen.UNSAFE_getAllByType(TouchableOpacity)
      .find(node => node.props.accessibilityLabel === 'Next question')!;
    expect(screen.queryByRole('button', { name: 'Next question' })).toBeNull();
    act(() => hidden.props.onPress());
    expect(generateQuestion).toHaveBeenCalledTimes(1);

    await act(async () => fireEvent.press(screen.getByLabelText('Answer: たべる')));
    expect(announce).toHaveBeenCalledWith('Incorrect. Correct answer: たべます');
    expect(screen.getByRole('button', { name: 'Answer: たべます, correct' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Answer: たべる, incorrect. Correct answer: たべます' })).toBeSelected();
    fireEvent.press(screen.getByRole('button', { name: 'Next question' }));
    await act(async () => fireEvent.press(screen.getByLabelText('Answer: たべます')));
    expect(announce).toHaveBeenLastCalledWith('Correct');
  } finally {
    announce.mockRestore();
  }
});

it('scrolls to a highlighted form once and cancels a pending scroll on unmount', async () => {
  mockRouteParams.highlightForm = 'masu';
  const measureLayout = jest.spyOn(View.prototype, 'measureLayout')
    .mockImplementation((_parent, reply) => {
      if (typeof reply === 'function') reply(0, 250, 0, 0);
    });
  const load = () => ready(<ConjugationScreen />);
  jest.useFakeTimers();
  try {
    const screen = await load();
    const row = () => screen.getByLabelText(/^ます形, .*開きます/);
    const group = screen.getByLabelText('Basic conjugation group');
    fireEvent(row(), 'layout');
    act(() => jest.advanceTimersByTime(400));
    expect(measureLayout).toHaveBeenCalledTimes(1);
    fireEvent.press(group);
    fireEvent.press(group);
    fireEvent(row(), 'layout');
    act(() => jest.advanceTimersByTime(400));
    expect(measureLayout).toHaveBeenCalledTimes(1);
    screen.unmount();

    const reopened = await load();
    const schedule = jest.spyOn(global, 'setTimeout');
    const cancel = jest.spyOn(global, 'clearTimeout');
    fireEvent(reopened.getByLabelText(/^ます形, .*開きます/), 'layout');
    const index = schedule.mock.calls.map(([, delay]) => delay).lastIndexOf(400);
    expect(index).toBeGreaterThanOrEqual(0);
    reopened.unmount();
    expect(cancel).toHaveBeenCalledWith(schedule.mock.results[index].value);
    schedule.mockRestore();
    cancel.mockRestore();
  } finally {
    jest.useRealTimers();
  }
});

it('offers the ます-only and N5-only practice settings by name', async () => {
  mockRouteParams = { mode: 'quiz' };
  usePracticeSettingsStore.setState({ activeForms: [...allForms], activeLevels: [...allLevels], loaded: true });
  const screen = await ready(<PracticeSettingsScreen />);
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'ます only' })));
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'N5 only' })));
  expect(usePracticeSettingsStore.getState()).toMatchObject({ activeForms: ['masu'], activeLevels: ['N5'] });
});

it.each(['focused', 'blurred', 'backgrounded'])('waits for the flip and gates flashcard auto-play while %s', async (mode) => {
  const timing = Animated.timing;
  let finish!: () => void;
  jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
    if (config.duration !== 300) return timing(value, config);
    return { start: complete => { finish = () => complete?.({ finished: true }); }, stop: jest.fn(), reset: jest.fn() };
  });
  const previousAppState = AppState.currentState;
  AppState.currentState = 'active';
  useThemeStore.setState({ autoTTS: true });
  try {
    const screen = await ready(<FlashcardScreen />);
    const focus = jest.mocked(useFocusEffect).mock.calls[0][0];
    const blur = focus();
    fireEvent.press(screen.getByRole('button', { name: /^Tap to reveal/ }));
    expect(speak).not.toHaveBeenCalled();
    if (mode === 'blurred' && typeof blur === 'function') blur();
    if (mode === 'backgrounded') {
      for (const [, listener] of jest.mocked(AppState.addEventListener).mock.calls) listener('background');
    }
    act(finish);
    if (mode === 'focused') expect(speak).toHaveBeenCalledWith('たべます');
    else expect(speak).not.toHaveBeenCalled();
  } finally {
    AppState.currentState = previousAppState;
    act(() => useThemeStore.setState({ autoTTS: false }));
  }
});

it('asks a transitivity pair as a sentence, then shows the whole sentence and both verbs', async () => {
  const { pairList } = jest.requireActual('../utils/pairs');
  mockedPairList().push(...pairList.filter(([, pair]: [string, { intransitive: string }]) => pair.intransitive === '開く'));
  // 0 draws a pair, its intransitive sentence, and reverses the two options.
  jest.spyOn(Math, 'random').mockReturnValue(0);
  const screen = await ready(<QuizScreen />);
  expect(screen.getByText('誰もいない部屋で、風にあおられてドアが＿＿＿。')).toBeTruthy();
  expect(screen.getByLabelText('誰もいない部屋で、風にあおられてドアが空欄。')).toBeTruthy();
  expect(screen.getByText('自動詞・他動詞 — Transitive or intransitive?')).toBeTruthy();
  expect(screen.queryByText('The wind blew the door open in an empty room.')).toBeNull();
  await act(async () => fireEvent.press(screen.getByLabelText('Answer: あけた')));
  expect(screen.getByText('誰もいない部屋で、風にあおられてドアが開いた。')).toBeTruthy();
  expect(screen.getByText('The wind blew the door open in an empty room.')).toBeTruthy();
  expect(screen.getByText('開く（あく） (自動詞) to open (intransitive)')).toBeTruthy();
  expect(screen.getByText('開ける（あける） (他動詞) to open (something)')).toBeTruthy();
  expect(screen.getByLabelText('Explain this verb choice')).toBeTruthy();
  expect(screen.getByText(/「ドアが」 marks the subject/)).toBeTruthy();
  await waitFor(() => expect(useSpacedRepStore.getState().weights['pair:開く/開ける']).toBeGreaterThan(1));
});

it('shows partner readings and meanings and records the opened partner in Recent', async () => {
  mockRouteParams = { verb: 'かかる' };
  const screen = await ready(<ConjugationScreen />);
  expect(screen.getByText('他動詞: 掛ける（かける）')).toBeTruthy();
  expect(screen.getByText('to make (a phone call)')).toBeTruthy();
  expect(screen.getByText('to hang up, to hang from')).toBeTruthy();

  const partner = screen.getByRole('button', { name: /Open 掛ける, かける/ });
  await act(async () => fireEvent.press(partner));
  expect(mockNavigation.push).toHaveBeenCalledWith('Conjugation', { verb: '掛ける' });
  expect(useHistoryStore.getState().history[0]).toBe('掛ける');
});

describe('adjective practice', () => {
  const takai = (adjectives as Record<string, AdjectiveData>)['高い'];
  afterEach(() => {
    const mocked = jest.requireMock('../utils/adjectivePractice');
    mocked.countEligibleAdjectives.mockReturnValue(0);
    mocked.generateAdjectiveQuestion.mockReturnValue(null);
    mocked.generateAdjectiveCard.mockReturnValue(null);
  });

  it.each([
    ['たかいでした', 'adds the past of です to the dictionary form'],
    ['たかかったでした', 'marks the past twice with かった and でした'],
    ['たかいかったです', 'keeps the final い when adding かったです'],
  ])('explains the picked 高い Polite Past mistake %s and records the adjective key', async (picked, reason) => {
    const mocked = jest.requireMock('../utils/adjectivePractice');
    mocked.countEligibleAdjectives.mockReturnValue(100000);
    mocked.generateAdjectiveQuestion.mockReturnValue({
      word: '高い', reading: 'たかい', translation: takai.translation, form: 'polite_past',
      correctAnswer: 'たかかったです',
      options: ['たかかったです', 'たかいでした', 'たかかったでした', 'たかいかったです'],
      data: takai,
    });
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const screen = await ready(<QuizScreen />);
    expect(screen.getByText('高い')).toBeTruthy();
    expect(screen.getByText('丁寧過去形 — Polite Past')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByLabelText(`Answer: ${picked}`)));
    expect(screen.getByText(`「${picked}」 ${reason}. Drop the final い and add かったです → たかかったです.`)).toBeTruthy();
    await waitFor(() => expect(useSpacedRepStore.getState().weights['adj:高い']).toBeGreaterThan(1));
    expect(useSpacedRepStore.getState().weights['高い']).toBeUndefined();
  });

  it.each(['しずかじゃないです', 'しずかだじゃないです'])('reveals the full variant set after answering %s', async picked => {
    const mocked = jest.requireMock('../utils/adjectivePractice');
    mocked.countEligibleAdjectives.mockReturnValue(100000);
    const data = (adjectives as Record<string, AdjectiveData>)['静か'];
    mocked.generateAdjectiveQuestion.mockReturnValue({
      word: '静か', reading: 'しずか', translation: data.translation, form: 'polite_negative',
      correctAnswer: 'しずかじゃないです',
      options: ['しずかじゃないです', 'しずかだじゃないです', 'しずかなじゃないです', 'しずかでじゃないです'],
      data,
    });
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const screen = await ready(<QuizScreen />);
    const reveal = 'Also correct: しずかじゃありません、しずかではありません、しずかではないです';
    expect(screen.queryByText(reveal)).toBeNull();
    await act(async () => fireEvent.press(screen.getByLabelText(`Answer: ${picked}`)));
    expect(screen.getByText(reveal)).toBeTruthy();
  });

  it('lets the longest adjective answer wrap even when its result icon is visible', async () => {
    const mocked = jest.requireMock('../utils/adjectivePractice');
    mocked.countEligibleAdjectives.mockReturnValue(100000);
    const data = (adjectives as Record<string, AdjectiveData>)['一生懸命'];
    const answer = 'いっしょうけんめいじゃなかったです';
    mocked.generateAdjectiveQuestion.mockReturnValue({
      word: '一生懸命', reading: data.reading, translation: data.translation, form: 'polite_past_negative',
      correctAnswer: answer, options: [answer, 'いっしょうけんめいじゃないでした'], data,
    });
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const screen = await ready(<QuizScreen />);
    await act(async () => fireEvent.press(screen.getByLabelText(`Answer: ${answer}`)));
    const option = screen.getByText(answer);
    expect(option.props.numberOfLines).toBeUndefined();
    expect(option.props.adjustsFontSizeToFit).toBeUndefined();
    expect(StyleSheet.flatten(option.props.style)).toMatchObject({ flexShrink: 1, textAlign: 'center' });
  });

  it('shows the also-correct forms on the back of an adjective card', async () => {
    const mocked = jest.requireMock('../utils/adjectivePractice');
    mocked.countEligibleAdjectives.mockReturnValue(100000);
    mocked.generateAdjectiveCard.mockReturnValue({
      word: '高い', reading: 'たかい', translation: takai.translation, form: 'polite_negative',
      answer: 'たかくないです', alsoCorrect: ['たかくありません'], data: takai,
    });
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const screen = await ready(<FlashcardScreen />);
    fireEvent.press(screen.getByLabelText(/^Tap to reveal /));
    expect(screen.getByText('Also correct: たかくありません')).toBeTruthy();
    expect(screen.getByLabelText(/Answer: たかくないです\. Also correct: たかくありません\./)).toBeTruthy();
  });
});
