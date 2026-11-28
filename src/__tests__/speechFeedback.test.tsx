import React from 'react';
import { Animated, AppState, Platform } from 'react-native';
import { act, render } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import SpeechIndicator from '../components/SpeechIndicator';
import { getSpeechFeedback, speak, stopSpeech } from '../utils/speech';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-speech', () => ({
  stop: jest.fn().mockResolvedValue(undefined),
  speak: jest.fn(),
  getAvailableVoicesAsync: jest.fn().mockResolvedValue([]),
  isSpeakingAsync: jest.fn().mockResolvedValue(false),
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, right: 0, bottom: 34, left: 0 }),
}));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});

afterEach(() => {
  act(stopSpeech);
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('shows pronunciation immediately, hides it from assistive technology, and expires a silent request', async () => {
  const screen = render(<SpeechIndicator />);
  act(() => speak('あく'));
  expect(Speech.speak).not.toHaveBeenCalled();
  expect(screen.getByText('あく', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByText('あく')).toBeNull();
  const view = screen.UNSAFE_getByType(Animated.View);
  expect(view.props.pointerEvents).toBe('none');
  expect(view.props.importantForAccessibility).toBe('no-hide-descendants');
  expect(view.props.style[1].top).toBe(111);

  await act(async () => jest.advanceTimersByTime(2500));
  expect(Speech.speak).toHaveBeenCalledWith('あく', expect.objectContaining({ language: 'ja-JP', rate: 0.85 }));
  expect(screen.queryByText('あく', { includeHiddenElements: true })).toBeNull();
});

it('clears feedback even when the engine starts but the finish and playback checks never return', async () => {
  jest.mocked(Speech.isSpeakingAsync).mockImplementationOnce(() => new Promise(() => {}));
  await act(async () => speak('たべる'));
  act(() => jest.mocked(Speech.speak).mock.calls[0][1]?.onStart?.());
  await act(async () => jest.advanceTimersByTime(2500));
  expect(getSpeechFeedback()?.text).toBe('たべる');
  await act(async () => jest.advanceTimersByTime(12500));
  expect(getSpeechFeedback()).toBeNull();
});

it('cancels a pending request and prevents stale speech callbacks from hiding a newer request', async () => {
  let finishOldStop!: () => void;
  jest.mocked(Speech.stop).mockImplementationOnce(() => new Promise<void>(resolve => { finishOldStop = resolve; }));
  await act(async () => {
    speak('あく');
    speak('のむ');
  });
  await act(async () => finishOldStop());
  expect(Speech.speak).toHaveBeenCalledTimes(1);
  expect(getSpeechFeedback()?.text).toBe('のむ');

  const oldCallbacks = jest.mocked(Speech.speak).mock.calls[0][1];
  await act(async () => speak('はなす'));
  act(() => oldCallbacks?.onDone?.());
  await act(async () => jest.advanceTimersByTime(1200));
  expect(getSpeechFeedback()?.text).toBe('はなす');
  act(stopSpeech);
  expect(getSpeechFeedback()).toBeNull();
});

it('lingers briefly on normal completion and clears immediately when the app backgrounds', async () => {
  const screen = render(<SpeechIndicator />);
  await act(async () => speak('みる'));
  const latest = jest.mocked(Speech.speak).mock.calls[0][1];
  act(() => latest?.onDone?.());
  expect(screen.getByText('みる', { includeHiddenElements: true })).toBeTruthy();
  act(() => jest.advanceTimersByTime(1200));
  expect(screen.queryByText('みる', { includeHiddenElements: true })).toBeNull();

  await act(async () => speak('よむ'));
  act(() => jest.mocked(AppState.addEventListener).mock.calls[0][1]('background'));
  expect(screen.queryByText('よむ', { includeHiddenElements: true })).toBeNull();
  expect(Speech.stop).toHaveBeenCalledTimes(3);
});

it('speaks on Android with bare ja, no voice ID, and no voice query even when the voice list is empty', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  await act(async () => speak('あく'));
  expect(Speech.getAvailableVoicesAsync).not.toHaveBeenCalled();
  expect(Speech.speak).toHaveBeenCalledTimes(1);
  expect(Speech.speak).toHaveBeenCalledWith('あく', expect.objectContaining({ language: 'ja', rate: 0.85 }));
  expect(jest.mocked(Speech.speak).mock.calls[0][1]).not.toHaveProperty('voice');
});
