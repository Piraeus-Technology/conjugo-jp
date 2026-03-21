import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MAX_HISTORY_SIZE } from '../utils/constants';

interface HistoryStore {
  history: string[];
  loaded: boolean;
  loadHistory: () => Promise<void>;
  addToHistory: (verb: string) => Promise<void>;
  removeFromHistory: (verb: string) => Promise<void>;
  clearHistory: () => Promise<void>;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  history: [],
  loaded: false,

  loadHistory: async () => {
    try {
      const stored = await AsyncStorage.getItem('verb_history');
      if (stored) {
        set({ history: JSON.parse(stored), loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch (e) {
      console.warn('Failed to load history:', e);
      set({ loaded: true });
    }
  },

  addToHistory: async (verb: string) => {
    const current = get().history.filter((v) => v !== verb);
    const updated = [verb, ...current].slice(0, MAX_HISTORY_SIZE);
    set({ history: updated });
    await AsyncStorage.setItem('verb_history', JSON.stringify(updated));
  },

  removeFromHistory: async (verb: string) => {
    const updated = get().history.filter((v) => v !== verb);
    set({ history: updated });
    await AsyncStorage.setItem('verb_history', JSON.stringify(updated));
  },

  clearHistory: async () => {
    set({ history: [] });
    await AsyncStorage.removeItem('verb_history');
  },
}));
