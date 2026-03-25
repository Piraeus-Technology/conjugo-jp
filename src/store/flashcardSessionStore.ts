import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FlashcardSession {
  date: number;
  reviewed: number;
  correct: number;
}

interface FlashcardSessionStore {
  sessions: FlashcardSession[];
  loaded: boolean;
  loadSessions: () => Promise<void>;
  saveSession: (session: Omit<FlashcardSession, 'date'>) => Promise<void>;
}

export const useFlashcardSessionStore = create<FlashcardSessionStore>((set, get) => ({
  sessions: [],
  loaded: false,

  loadSessions: async () => {
    try {
      const stored = await AsyncStorage.getItem('flashcardSessions');
      if (stored) set({ sessions: JSON.parse(stored), loaded: true });
      else set({ loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  saveSession: async (session) => {
    const updated = [{ ...session, date: Date.now() }, ...get().sessions].slice(0, 100);
    set({ sessions: updated });
    await AsyncStorage.setItem('flashcardSessions', JSON.stringify(updated));
  },
}));
