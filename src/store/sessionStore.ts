import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Session {
  day: string; // 'YYYY-MM-DD'
  total: number;
  correct: number;
  streak: number;
}

interface SessionStore {
  sessions: Session[];
  loaded: boolean;
  loadSessions: () => Promise<void>;
  saveSession: (session: Omit<Session, 'day'>) => Promise<void>;
  clearSessions: () => Promise<void>;
}

function getTodayKey(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  loaded: false,

  loadSessions: async () => {
    try {
      const stored = await AsyncStorage.getItem('sessions');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Migrate old format (date: timestamp) to new format (day: 'YYYY-MM-DD')
        const dayMap: Record<string, Session> = {};
        for (const s of parsed) {
          const day = s.day || new Date(s.date).toLocaleDateString('en-CA');
          if (dayMap[day]) {
            dayMap[day].total += s.total;
            dayMap[day].correct += s.correct;
            dayMap[day].streak = Math.max(dayMap[day].streak, s.streak || 0);
          } else {
            dayMap[day] = { day, total: s.total, correct: s.correct, streak: s.streak || 0 };
          }
        }
        const sessions = Object.values(dayMap).sort((a, b) => b.day.localeCompare(a.day));
        set({ sessions, loaded: true });
        await AsyncStorage.setItem('sessions', JSON.stringify(sessions));
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
      updated = [{ ...session, day: today }, ...current].slice(0, 365);
    }

    set({ sessions: updated });
    await AsyncStorage.setItem('sessions', JSON.stringify(updated));
  },

  clearSessions: async () => {
    set({ sessions: [] });
    await AsyncStorage.removeItem('sessions');
  },
}));
