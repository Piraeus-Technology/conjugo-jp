import * as Speech from 'expo-speech';
import type { Voice } from 'expo-speech';
import { Platform } from 'react-native';

const START_TIMEOUT_MS = 2500;
const POLL_INTERVAL_MS = 1000;
const MAX_FEEDBACK_MS = 15_000;
const MIN_VISIBLE_MS = 1200;
const LINGER_AFTER_END_MS = 400;

interface AndroidVoice extends Voice {
  isInstalled?: boolean;
  isAvailableOffline?: boolean;
}

interface SpeechFeedback {
  id: number;
  text: string;
}

let speechToken = 0;
let feedback: SpeechFeedback | null = null;
let playbackCheck: ReturnType<typeof setTimeout> | undefined;
let deadline: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

export function subscribeToSpeechFeedback(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getSpeechFeedback(): SpeechFeedback | null {
  return feedback;
}

function showFeedback(value: SpeechFeedback | null) {
  if (feedback === value) return;
  feedback = value;
  for (const listener of listeners) listener();
}

function clearTimers() {
  clearTimeout(playbackCheck);
  clearTimeout(deadline);
  playbackCheck = undefined;
  deadline = undefined;
}

function hideFeedback() {
  clearTimers();
  showFeedback(null);
}

async function stopNativeSpeech() {
  try {
    await Speech.stop();
  } catch {
    // Some devices have no active speech engine.
  }
}

export function speak(text: string) {
  const id = ++speechToken;
  const visibleSince = Date.now();
  let ended = false;
  let probeVersion = 0;
  clearTimers();
  showFeedback({ id, text });
  function hideIfCurrent() {
    if (feedback?.id === id) hideFeedback();
  }
  deadline = setTimeout(hideIfCurrent, MAX_FEEDBACK_MS);

  function checkPlaybackAfter(delay: number) {
    clearTimeout(playbackCheck);
    const version = ++probeVersion;
    playbackCheck = setTimeout(async () => {
      let speaking = false;
      try {
        speaking = await Speech.isSpeakingAsync();
      } catch {
        // Treat a failed playback check as an idle engine.
      }
      if (ended || feedback?.id !== id || version !== probeVersion) return;
      if (speaking) checkPlaybackAfter(POLL_INTERVAL_MS);
      else hideIfCurrent();
    }, delay);
  }

  function finish() {
    if (ended || id !== speechToken) return;
    ended = true;
    if (feedback?.id !== id) return;
    clearTimers();
    deadline = setTimeout(hideIfCurrent, Math.max(MIN_VISIBLE_MS - (Date.now() - visibleSince), LINGER_AFTER_END_MS));
  }

  function reportError(error: unknown) {
    if (id !== speechToken) return;
    console.warn('Speech playback failed:', error);
    finish();
  }

  checkPlaybackAfter(START_TIMEOUT_MS);
  void stopNativeSpeech().then(async () => {
    if (id !== speechToken) return;
    let voice: string | undefined;
    const isAndroid = Platform.OS === 'android';
    if (isAndroid) {
      const voices: AndroidVoice[] = await Speech.getAvailableVoicesAsync();
      if (id !== speechToken) return;
      const japanese = voices.filter(voice =>
        voice.isInstalled !== false && /^ja(?:-|$)/i.test(voice.language),
      );
      voice = (japanese.find(voice => voice.isAvailableOffline)
        ?? japanese.find(voice => voice.language === 'ja-JP')
        ?? japanese[0])?.identifier;
      if (!voice) {
        reportError(new Error('No Japanese voice is available.'));
        return;
      }
    }
    Speech.speak(text, {
      // Expo's Android locale parser accepts a language subtag; the ID selects the actual voice.
      ...(isAndroid ? { language: 'ja', voice } : { language: 'ja-JP' }),
      rate: 0.85,
      onStart: () => {
        if (!ended && feedback?.id === id) checkPlaybackAfter(START_TIMEOUT_MS);
      },
      onDone: finish,
      onStopped: finish,
      onError: reportError,
    });
  }).catch(reportError);
}

export function stopSpeech() {
  speechToken++;
  hideFeedback();
  void stopNativeSpeech();
}
