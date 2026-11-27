import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MAX_DAILY_SESSIONS } from '../utils/constants';
import { getTodayKey, normalizeStoredDayKey, timestampToDayKey } from '../utils/dayKey';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { isStoredCount, requireStoredCounts } from '../utils/storedLearningData';
import { createStoreQueue } from '../utils/storeQueue';

export interface Session {
  day: string; // 'YYYY-MM-DD'
  total: number;
  correct: number;
  streak: number;
}

interface SessionStore {
  sessions: Session[];
  loaded: boolean;
  resetCount: number;
  loadError: boolean;
  loadSessions: () => Promise<void>;
  saveSession: (session: Omit<Session, 'day'>, day?: string, beforePublish?: () => void) => Promise<boolean>;
  clearSessions: () => Promise<boolean>;
}

const queue = createStoreQueue();

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  resetCount: 0,
  loaded: false,
  loadError: false,

  loadSessions: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('sessions');
        if (stored !== null) {
          const parsed = JSON.parse(stored);
          if (!Array.isArray(parsed)) throw new Error('Invalid session history');
          const dayMap = new Map<string, Session>();
          let didMigrate = false;
          for (const s of parsed) {
            requireStoredCounts(s?.total, s?.correct);
            if (s.streak !== undefined && !isStoredCount(s.streak)) throw new Error('Invalid session streak');
            let day: string;
            if (typeof s.day === 'string' && s.day) {
              day = normalizeStoredDayKey(s.day);
              if (day !== s.day) didMigrate = true;
            } else if (s.day === undefined && typeof s.date === 'number' && Number.isFinite(new Date(s.date).getTime())) {
              didMigrate = true;
              day = timestampToDayKey(s.date);
            } else {
              throw new Error('Invalid session date');
            }
            const existing = dayMap.get(day);
            if (existing) {
              didMigrate = true;
              existing.total += s.total;
              existing.correct += s.correct;
              requireStoredCounts(existing.total, existing.correct);
              existing.streak = Math.max(existing.streak, s.streak || 0);
            } else {
              dayMap.set(day, { day, total: s.total, correct: s.correct, streak: s.streak ?? 0 });
            }
          }
          const sessions = [...dayMap.values()].sort((a, b) => b.day.localeCompare(a.day));
          set({ sessions, loaded: true, loadError: false });
          if (didMigrate) {
            await safeSetItem('sessions', JSON.stringify(sessions));
          }
        } else {
          set({ loaded: true, loadError: false });
        }
      } catch (e) {
        console.warn('Failed to load sessions:', e);
        set({ loadError: true });
      }
    });
  },

  saveSession: async (session, day, beforePublish): Promise<boolean> => {
    const { resetCount } = get();
    if (!get().loaded) {
      await get().loadSessions();
    }
    if (!get().loaded) {
      console.warn('Skipping quiz session save: store never loaded');
      return false;
    }
    let ok = false;
    await queue.enqueue(async () => {
      if (get().resetCount !== resetCount) return;
      const today = day ?? getTodayKey();
      const current = get().sessions;
      const existingIndex = current.findIndex(s => s.day === today);

      let updated: Session[];
      if (existingIndex >= 0) {
        updated = [...current];
        updated[existingIndex] = {
          day: today,
          total: updated[existingIndex].total + session.total,
          correct: updated[existingIndex].correct + session.correct,
          streak: Math.max(updated[existingIndex].streak, session.streak),
        };
      } else {
        updated = [{ ...session, day: today }, ...current];
      }
      updated.sort((a, b) => b.day.localeCompare(a.day));
      updated = updated.slice(0, MAX_DAILY_SESSIONS);

      const persisted = await safeSetItem('sessions', JSON.stringify(updated));
      if (!persisted) {
        console.warn('Failed to persist quiz session');
        return;
      }
      beforePublish?.();
      set({ sessions: updated });
      ok = true;
    });
    return ok;
  },

  clearSessions: async (): Promise<boolean> => {
    let cleared = false;
    await queue.enqueue(async () => {
      const removed = await safeRemoveItem('sessions');
      if (!removed) {
        console.warn('Failed to clear quiz sessions');
        return;
      }
      set(state => ({ sessions: [], loaded: true, loadError: false, resetCount: state.resetCount + 1 }));
      cleared = true;
    });
    return cleared;
  },
}));

export function __resetSessionStoreForTests() {
  queue.reset();
  useSessionStore.setState({ sessions: [], resetCount: 0, loaded: false, loadError: false });
}
