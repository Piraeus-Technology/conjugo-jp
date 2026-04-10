import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FlashcardSession {
  day: string; // 'YYYY-MM-DD'
  reviewed: number;
  correct: number;
}

interface FlashcardSessionStore {
  sessions: FlashcardSession[];
  loaded: boolean;
  loadSessions: () => Promise<void>;
  saveSession: (session: Omit<FlashcardSession, 'day'>) => Promise<void>;
  clearSessions: () => Promise<void>;
}

function getTodayKey(): string {
  return new Date().toLocaleDateString('en-CA');
}

export const useFlashcardSessionStore = create<FlashcardSessionStore>((set, get) => ({
  sessions: [],
  loaded: false,

  loadSessions: async () => {
    try {
      const stored = await AsyncStorage.getItem('flashcardSessions');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Migrate old format (date: timestamp) to new format (day: 'YYYY-MM-DD')
        const dayMap: Record<string, FlashcardSession> = {};
        for (const s of parsed) {
          const day = s.day || new Date(s.date).toLocaleDateString('en-CA');
          if (dayMap[day]) {
            dayMap[day].reviewed += s.reviewed;
            dayMap[day].correct += s.correct;
          } else {
            dayMap[day] = { day, reviewed: s.reviewed, correct: s.correct };
          }
        }
        const sessions = Object.values(dayMap).sort((a, b) => b.day.localeCompare(a.day));
        set({ sessions, loaded: true });
        await AsyncStorage.setItem('flashcardSessions', JSON.stringify(sessions));
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  saveSession: async (session) => {
    const today = getTodayKey();
    const current = get().sessions;
    const existingIndex = current.findIndex(s => s.day === today);

    let updated: FlashcardSession[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = {
        day: today,
        reviewed: updated[existingIndex].reviewed + session.reviewed,
        correct: updated[existingIndex].correct + session.correct,
      };
    } else {
      updated = [{ ...session, day: today }, ...current].slice(0, 365);
    }

    set({ sessions: updated });
    await AsyncStorage.setItem('flashcardSessions', JSON.stringify(updated));
  },

  clearSessions: async () => {
    set({ sessions: [] });
    await AsyncStorage.removeItem('flashcardSessions');
  },
}));
