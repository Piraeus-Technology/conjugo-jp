import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FavoritesStore {
  favorites: string[];
  loaded: boolean;
  loadFavorites: () => Promise<void>;
  toggleFavorite: (verb: string) => Promise<void>;
  isFavorite: (verb: string) => boolean;
}

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  favorites: [],
  loaded: false,

  loadFavorites: async () => {
    try {
      const stored = await AsyncStorage.getItem('favorites');
      if (stored) {
        set({ favorites: JSON.parse(stored), loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch (e) {
      console.warn('Failed to load favorites:', e);
      set({ loaded: true });
    }
  },

  toggleFavorite: async (verb: string) => {
    const current = get().favorites;
    const updated = current.includes(verb)
      ? current.filter((v) => v !== verb)
      : [verb, ...current];
    set({ favorites: updated });
    await AsyncStorage.setItem('favorites', JSON.stringify(updated));
  },

  isFavorite: (verb: string) => {
    return get().favorites.includes(verb);
  },
}));
