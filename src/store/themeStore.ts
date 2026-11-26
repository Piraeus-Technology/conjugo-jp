import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';

type ThemeChoice = 'light' | 'dark';

interface ThemeStore {
  isDark: boolean;
  systemIsDark: boolean;
  choice: ThemeChoice | null;
  autoTTS: boolean;
  loaded: boolean;
  loadError: boolean;
  loadTheme: () => Promise<void>;
  syncSystemTheme: (isDark: boolean) => void;
  toggleTheme: () => Promise<void>;
  toggleAutoTTS: () => Promise<void>;
}

const queue = createStoreQueue();

export const useThemeStore = create<ThemeStore>((set, get) => ({
  isDark: false,
  systemIsDark: false,
  choice: null,
  autoTTS: false,
  loaded: false,
  loadError: false,

  loadTheme: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      const [theme, tts] = await Promise.allSettled([
        AsyncStorage.getItem('theme_mode'),
        AsyncStorage.getItem('auto_tts'),
      ]);
      const saved = theme.status === 'fulfilled' ? theme.value : null;
      const choice = saved === 'dark' || saved === 'light' ? saved : null;
      const loadError = theme.status === 'rejected' || tts.status === 'rejected';
      if (theme.status === 'rejected') console.warn('Failed to load theme:', theme.reason);
      if (tts.status === 'rejected') console.warn('Failed to load auto-play preference:', tts.reason);
      // App gates its first render on loaded, so use the available preferences
      // and system defaults even when one of the reads fails.
      set(state => ({
        choice,
        isDark: choice === null ? state.systemIsDark : choice === 'dark',
        autoTTS: tts.status === 'fulfilled' && tts.value === 'true',
        loaded: true,
        loadError,
      }));
    });
  },

  syncSystemTheme: (systemIsDark) => set(state => ({
    systemIsDark,
    isDark: state.choice === null ? systemIsDark : state.choice === 'dark',
  })),

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
      const choice = newIsDark ? 'dark' : 'light';
      const persisted = await safeSetItem('theme_mode', choice);
      if (!persisted) {
        console.warn('Theme preference not persisted');
        return;
      }
      set({ choice, isDark: newIsDark });
    });
  },

  toggleAutoTTS: async () => {
    if (!get().loaded) {
      await get().loadTheme();
    }
    if (!get().loaded) {
      console.warn('Skipping auto-play toggle: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const newAutoTTS = !get().autoTTS;
      const persisted = await safeSetItem('auto_tts', newAutoTTS ? 'true' : 'false');
      if (!persisted) {
        console.warn('Auto-play preference not persisted');
        return;
      }
      set({ autoTTS: newAutoTTS });
    });
  },
}));

export function __resetThemeStoreForTests() {
  queue.reset();
  useThemeStore.setState({ isDark: false, systemIsDark: false, choice: null, autoTTS: false, loaded: false, loadError: false });
}
