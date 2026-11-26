import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated, ScrollView, StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import ConjugationScreen from '../screens/ConjugationScreen';
import FlashcardScreen from '../screens/FlashcardScreen';
import { __resetFlashcardStatsStoreForTests } from '../store/flashcardStatsStore';
import { __resetFlashcardSessionStoreForTests } from '../store/flashcardSessionStore';
import { maybeRequestStoreReview } from '../utils/storeReviewPrompt';
import { speak, stopSpeech } from '../utils/speech';
import QuizScreen from '../screens/QuizScreen';
import { __resetPracticeSettingsStoreForTests } from '../store/practiceSettingsStore';
import { __resetQuizStoreForTests, useQuizStore } from '../store/quizStore';
import { __resetSessionStoreForTests } from '../store/sessionStore';
import { __resetSpacedRepStoreForTests } from '../store/spacedRepStore';
import verbs from '../data/verbs.json';

const mockNavigation = { setOptions: jest.fn(), addListener: () => jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useFocusEffect: jest.fn(),
  useRoute: () => ({ params: { verb: '開く' } }),
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

const question = {
  verb: '食べる', reading: 'たべる', translation: 'to eat', form: 'masu' as const,
  correctAnswer: 'たべます', options: ['たべます', 'たべる', 'たべない', 'たべた'], verbData: verbs['食べる'],
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  __resetQuizStoreForTests();
  __resetFlashcardSessionStoreForTests();
  __resetFlashcardStatsStoreForTests();
  __resetSessionStoreForTests();
  __resetPracticeSettingsStoreForTests();
  __resetSpacedRepStoreForTests();
  const { generateQuestion } = jest.requireMock('../utils/quizQuestion');
  generateQuestion.mockReturnValue(question);
  const { generateFlashcard } = jest.requireMock('../utils/flashcardCard');
  generateFlashcard.mockReturnValue({ ...question, answer: question.correctAnswer });
});

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
