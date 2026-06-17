import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';

interface ThemeStore {
  isDark: boolean;
  loaded: boolean;
  loadError: boolean;
  loadTheme: () => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const queue = createStoreQueue();

export const useThemeStore = create<ThemeStore>((set, get) => ({
  isDark: false,
  loaded: false,
  loadError: false,

  loadTheme: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('theme_mode');
        set({ isDark: stored === 'dark', loaded: true, loadError: false });
      } catch (e) {
        console.warn('Failed to load theme:', e);
        set({ loadError: true });
      }
    });
  },

  toggleTheme: async () => {
    if (!get().loaded) {
      await get().loadTheme();
    }
    if (!get().loaded) {
      console.warn('Skipping theme toggle: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const newIsDark = !get().isDark;
      const persisted = await safeSetItem('theme_mode', newIsDark ? 'dark' : 'light');
      if (!persisted) {
        console.warn('Theme preference not persisted');
        return;
      }
      set({ isDark: newIsDark });
    });
  },
}));

export function __resetThemeStoreForTests() {
  queue.reset();
  useThemeStore.setState({ isDark: false, loaded: false, loadError: false });
}
