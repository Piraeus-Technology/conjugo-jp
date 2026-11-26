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

const RETRY_DELAY_MS = 5000;

// Stamp answers synchronously and keep each delta visible until the session
// store is about to publish the corresponding persisted totals.
export function useSessionAutosave({ save, readResetCount }: {
  save: (delta: SessionDelta, beforePublish: () => void) => Promise<void>;
  readResetCount?: () => number;
}) {
  const nav = useNavigation();
  const options = React.useRef({ save, readResetCount });
  options.current = { save, readResetCount };
  const progress = React.useRef({ resetCount: 0, days: new Map<string, SessionDelta>() });
  const saveQueue = React.useRef<Promise<void>>(Promise.resolve());
  const retryTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = React.useRef(true);
  const [, refresh] = React.useReducer((value: number) => value + 1, 0);

  const getPending = React.useCallback(() => {
    const resetCount = options.current.readResetCount?.() ?? 0;
    if (progress.current.resetCount !== resetCount) {
      progress.current = { resetCount, days: new Map() };
    }
    return progress.current.days;
  }, []);

  const clearRetry = React.useCallback(() => {
    if (retryTimer.current !== null) clearTimeout(retryTimer.current);
    retryTimer.current = null;
  }, []);

  const saveNow = React.useCallback((): Promise<void> => {
    clearRetry();
    const run = async () => {
      const pending = getPending();
      let failed = false;
      for (const delta of [...pending.values()]) {
        if (pending !== getPending()) break;
        try {
          await options.current.save(delta, () => {
            const latest = pending.get(delta.day)!;
            if (latest.count === delta.count) {
              pending.delete(delta.day);
            } else {
              pending.set(delta.day, {
                ...latest,
                count: latest.count - delta.count,
                correct: latest.correct - delta.correct,
              });
            }
          });
          if (mounted.current) refresh();
        } catch (error) {
          if (pending !== getPending()) break;
          failed = true;
          console.warn('Failed to save session:', error);
        }
      }
      if (failed && mounted.current && getPending().size > 0 && retryTimer.current === null) {
        retryTimer.current = setTimeout(() => { void saveNow(); }, RETRY_DELAY_MS);
      } else if (getPending().size === 0) {
        clearRetry();
      }
    };
    const next = saveQueue.current.then(run, run);
    saveQueue.current = next.catch(() => undefined);
    return next;
  }, [getPending, clearRetry]);

  const recordProgress = React.useCallback((correct: boolean, bestStreak = 0) => {
    const day = getTodayKey();
    const pending = getPending();
    const current = pending.get(day);
    pending.set(day, {
      day,
      count: (current?.count ?? 0) + 1,
      correct: (current?.correct ?? 0) + (correct ? 1 : 0),
      bestStreak: Math.max(current?.bestStreak ?? 0, bestStreak),
    });
    refresh();
    void saveNow();
  }, [getPending, saveNow]);

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

  const today = getPending().get(getTodayKey());
  return {
    unsavedCount: today?.count ?? 0,
    unsavedCorrect: today?.correct ?? 0,
    recordProgress,
  };
}
