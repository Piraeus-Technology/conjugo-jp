import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';

// Lifetime flashcard aggregate, mirroring quizStore. Kept separate from the
// day-keyed flashcardSessionStore (capped at 365 days) so "all time" totals
// don't silently become a rolling-year window.
interface FlashcardStats {
  totalReviewed: number;
  totalCorrect: number;
  loaded: boolean;
  loadError: boolean;
  loadStats: () => Promise<void>;
  recordReview: (correct: boolean) => Promise<void>;
  resetStats: () => Promise<boolean>;
}

const queue = createStoreQueue();

async function seedStatsFromSessions(): Promise<{ totalReviewed: number; totalCorrect: number }> {
  const totals = { totalReviewed: 0, totalCorrect: 0 };
  const stored = await AsyncStorage.getItem('flashcardSessions');
  if (stored === null) return totals;

  const sessions = JSON.parse(stored);
  if (!Array.isArray(sessions)) throw new Error('Invalid flashcard session history');

  for (const session of sessions) {
    if (!session || !Number.isSafeInteger(session.reviewed) || !Number.isSafeInteger(session.correct) ||
        session.correct < 0 || session.reviewed < session.correct) {
      throw new Error('Invalid flashcard session counts');
    }
    totals.totalReviewed += session.reviewed;
    totals.totalCorrect += session.correct;
  }
  if (!Number.isSafeInteger(totals.totalReviewed)) throw new Error('Invalid flashcard history total');
  return totals;
}

export const useFlashcardStatsStore = create<FlashcardStats>((set, get) => ({
  totalReviewed: 0,
  totalCorrect: 0,
  loaded: false,
  loadError: false,

  loadStats: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('flashcard_stats');
        if (stored) {
          const data = JSON.parse(stored);
          set({ ...data, loaded: true, loadError: false });
        } else {
          const seeded = await seedStatsFromSessions();
          const persisted = await safeSetItem('flashcard_stats', JSON.stringify(seeded));
          if (!persisted) {
            console.warn('Failed to persist seeded flashcard stats');
          }
          set({ ...seeded, loaded: true, loadError: false });
        }
      } catch (e) {
        console.warn('Failed to load flashcard stats:', e);
        set({ loadError: true });
      }
    });
  },

  recordReview: async (correct: boolean) => {
    if (!get().loaded) {
      await get().loadStats();
    }
    if (!get().loaded) {
      console.warn('Skipping flashcard stat persistence: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const state = get();
      const updated = {
        totalReviewed: state.totalReviewed + 1,
        totalCorrect: state.totalCorrect + (correct ? 1 : 0),
      };
      const persisted = await safeSetItem('flashcard_stats', JSON.stringify(updated));
      if (!persisted) {
        console.warn('Failed to persist flashcard stats');
        return;
      }
      set(updated);
    });
  },

  resetStats: async (): Promise<boolean> => {
    if (!get().loaded) {
      await get().loadStats();
    }
    if (!get().loaded) {
      console.warn('Skipping flashcard stats reset: store never loaded');
      return false;
    }
    let cleared = false;
    await queue.enqueue(async () => {
      const removed = await safeRemoveItem('flashcard_stats');
      if (!removed) {
        console.warn('Failed to reset flashcard stats');
        return;
      }
      set({ totalReviewed: 0, totalCorrect: 0, loaded: true, loadError: false });
      cleared = true;
    });
    return cleared;
  },
}));

export function __resetFlashcardStatsStoreForTests() {
  queue.reset();
  useFlashcardStatsStore.setState({
    totalReviewed: 0,
    totalCorrect: 0,
    loaded: false,
    loadError: false,
  });
}
