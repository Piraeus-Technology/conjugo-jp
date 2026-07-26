import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeRemoveItem, safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';
import {
  DEFAULT_WEIGHT,
  applyVerbResult,
  decayWeight,
  parseStoredWeights,
  serializeWeights,
  type VerbWeightMap,
} from '../utils/spacedRepetition';

interface SpacedRepStore {
  weights: VerbWeightMap;
  /** Epoch ms of the last answer per verb; drives time decay. */
  lastPracticedAt: VerbWeightMap;
  loaded: boolean;
  loadError: boolean;
  loadWeights: () => Promise<void>;
  recordResult: (verb: string, correct: boolean) => Promise<void>;
  getWeight: (verb: string) => number;
  resetWeights: () => Promise<boolean>;
}

const STORAGE_KEY = 'spaced_rep_weights';

const queue = createStoreQueue();

export const useSpacedRepStore = create<SpacedRepStore>((set, get) => ({
  weights: {},
  lastPracticedAt: {},
  loaded: false,
  loadError: false,

  loadWeights: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const { weights, lastPracticedAt } = parseStoredWeights(stored, Date.now());
        set({ weights, lastPracticedAt, loaded: true, loadError: false });
      } catch (e) {
        console.warn('Failed to load spaced rep weights:', e);
        set({ loadError: true });
      }
    });
  },

  recordResult: async (verb: string, correct: boolean) => {
    if (!get().loaded) {
      await get().loadWeights();
    }
    if (!get().loaded) {
      console.warn('Skipping spaced rep result persistence: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const state = get();
      const next = applyVerbResult(
        { weights: state.weights, lastPracticedAt: state.lastPracticedAt },
        verb,
        correct,
        Date.now(),
      );
      const persisted = await safeSetItem(STORAGE_KEY, serializeWeights(next));
      if (!persisted) {
        console.warn('Failed to persist spaced rep weights');
        return;
      }
      set({ weights: next.weights, lastPracticedAt: next.lastPracticedAt });
    });
  },

  getWeight: (verb: string) => {
    const { weights, lastPracticedAt } = get();
    const stored = weights[verb];
    if (!Number.isFinite(stored)) return DEFAULT_WEIGHT;
    return decayWeight(stored, lastPracticedAt[verb], Date.now());
  },

  resetWeights: async (): Promise<boolean> => {
    if (!get().loaded) {
      await get().loadWeights();
    }
    if (!get().loaded) {
      console.warn('Skipping spaced rep reset: store never loaded');
      return false;
    }
    let cleared = false;
    await queue.enqueue(async () => {
      const removed = await safeRemoveItem(STORAGE_KEY);
      if (!removed) {
        console.warn('Failed to reset spaced rep weights');
        return;
      }
      set({ weights: {}, lastPracticedAt: {}, loaded: true, loadError: false });
      cleared = true;
    });
    return cleared;
  },
}));

export function __resetSpacedRepStoreForTests() {
  queue.reset();
  useSpacedRepStore.setState({
    weights: {},
    lastPracticedAt: {},
    loaded: false,
    loadError: false,
  });
}
