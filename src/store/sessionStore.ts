import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Session {
  date: number;
  total: number;
  correct: number;
  streak: number;
  durationMs: number;
}

interface SessionStore {
  sessions: Session[];
  loaded: boolean;
  loadSessions: () => Promise<void>;
  saveSession: (session: Omit<Session, 'date'>) => Promise<void>;
  clearSessions: () => Promise<void>;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  loaded: false,

  loadSessions: async () => {
    try {
      const stored = await AsyncStorage.getItem('sessions');
      if (stored) {
        set({ sessions: JSON.parse(stored), loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  saveSession: async (session) => {
    const updated = [{ ...session, date: Date.now() }, ...get().sessions].slice(0, 50);
    set({ sessions: updated });
    await AsyncStorage.setItem('sessions', JSON.stringify(updated));
  },

  clearSessions: async () => {
    set({ sessions: [] });
    await AsyncStorage.removeItem('sessions');
  },
}));
