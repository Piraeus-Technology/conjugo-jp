import React from 'react';
import { AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getTodayKey } from '../utils/dayKey';

interface SessionDelta {
  count: number;
  correct: number;
  bestStreak: number;
  day: string;
}

// Stamp each answer synchronously, rather than attributing a whole batch to
// its first answer or flush time. All days and save triggers share one queue.
export function useSessionAutosave({ save }: {
  save: (delta: SessionDelta) => Promise<void>;
}) {
  const nav = useNavigation();
  const saveRef = React.useRef(save);
  saveRef.current = save;
  const pending = React.useRef(new Map<string, SessionDelta>());
  const saveQueue = React.useRef<Promise<void>>(Promise.resolve());
  const mounted = React.useRef(true);
  const [, refresh] = React.useReducer((value: number) => value + 1, 0);

  const recordProgress = React.useCallback((correct: boolean, bestStreak = 0) => {
    const day = getTodayKey();
    const current = pending.current.get(day);
    pending.current.set(day, {
      day,
      count: (current?.count ?? 0) + 1,
      correct: (current?.correct ?? 0) + (correct ? 1 : 0),
      bestStreak: Math.max(current?.bestStreak ?? 0, bestStreak),
    });
    refresh();
  }, []);

  const saveNow = React.useCallback(() => {
    const run = async () => {
      const batches = [...pending.current.values()];
      // Claim every snapshot before awaiting any write, so new answers on a
      // later day cannot be erased when that day's snapshot starts saving.
      // Claim before store updates also prevents counting saved totals twice.
      pending.current.clear();
      for (const delta of batches) {
        try {
          await saveRef.current(delta);
        } catch (error) {
          const newer = pending.current.get(delta.day);
          pending.current.set(delta.day, {
            day: delta.day,
            count: delta.count + (newer?.count ?? 0),
            correct: delta.correct + (newer?.correct ?? 0),
            bestStreak: Math.max(delta.bestStreak, newer?.bestStreak ?? 0),
          });
          console.warn('Failed to save session:', error);
        }
        if (mounted.current) refresh();
      }
    };
    const next = saveQueue.current.then(run, run);
    saveQueue.current = next.catch(() => undefined);
    return next;
  }, []);

  React.useEffect(() => {
    mounted.current = true;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') void saveNow();
    });
    return () => {
      mounted.current = false;
      sub.remove();
      void saveNow();
    };
  }, [saveNow]);

  React.useEffect(() => nav.addListener('blur', () => { void saveNow(); }), [nav, saveNow]);

  const today = pending.current.get(getTodayKey());
  return {
    unsavedCount: today?.count ?? 0,
    unsavedCorrect: today?.correct ?? 0,
    recordProgress,
  };
}
