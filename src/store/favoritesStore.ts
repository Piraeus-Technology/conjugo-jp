import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeSetItem } from '../utils/safeStorage';
import { createStoreQueue, parseStoredStringArray } from '../utils/storeQueue';

interface FavoritesStore {
  favorites: string[];
  loaded: boolean;
  loadError: boolean;
  loadFavorites: () => Promise<void>;
  toggleFavorite: (verb: string) => Promise<void>;
  isFavorite: (verb: string) => boolean;
}

const queue = createStoreQueue();

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  favorites: [],
  loaded: false,
  loadError: false,

  loadFavorites: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('favorites');
        set({ favorites: parseStoredStringArray(stored), loaded: true, loadError: false });
      } catch (e) {
        console.warn('Failed to load favorites:', e);
        set({ loadError: true });
      }
    });
  },

  toggleFavorite: async (verb: string) => {
    if (!get().loaded) {
      await get().loadFavorites();
    }
    if (!get().loaded) {
      console.warn('Skipping favorite toggle: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const current = get().favorites;
      const updated = current.includes(verb)
        ? current.filter((v) => v !== verb)
        : [verb, ...current];
      const persisted = await safeSetItem('favorites', JSON.stringify(updated));
      if (!persisted) {
        console.warn('Failed to persist favorites');
        return;
      }
      set({ favorites: updated });
    });
  },

  isFavorite: (verb: string) => {
    return get().favorites.includes(verb);
  },
}));

export function __resetFavoritesStoreForTests() {
  queue.reset();
  useFavoritesStore.setState({ favorites: [], loaded: false, loadError: false });
}
