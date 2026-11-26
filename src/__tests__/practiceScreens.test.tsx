import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScrollView, StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import QuizScreen from '../screens/QuizScreen';
import { __resetPracticeSettingsStoreForTests } from '../store/practiceSettingsStore';
import { __resetQuizStoreForTests } from '../store/quizStore';
import { __resetSessionStoreForTests } from '../store/sessionStore';
import { __resetSpacedRepStoreForTests } from '../store/spacedRepStore';
import verbs from '../data/verbs.json';

const mockNavigation = { setOptions: jest.fn(), addListener: () => jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useFocusEffect: jest.fn(),
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
jest.mock('../utils/speech', () => ({ speak: jest.fn(), stopSpeech: jest.fn() }));
jest.mock('../utils/quizQuestion', () => ({ generateQuestion: jest.fn() }));

const question = {
  verb: '食べる', reading: 'たべる', translation: 'to eat', form: 'masu' as const,
  correctAnswer: 'たべます', options: ['たべます', 'たべる', 'たべない', 'たべた'], verbData: verbs['食べる'],
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  __resetQuizStoreForTests();
  __resetSessionStoreForTests();
  __resetPracticeSettingsStoreForTests();
  __resetSpacedRepStoreForTests();
  const { generateQuestion } = jest.requireMock('../utils/quizQuestion');
  generateQuestion.mockReturnValue(question);
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
