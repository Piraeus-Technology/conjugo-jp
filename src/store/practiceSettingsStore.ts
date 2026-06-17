import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_FORMS } from '../utils/conjugate';
import type { ConjugationForm, JLPTLevel } from '../utils/conjugate';
import { safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';

interface PracticeSettingsStore {
  activeForms: ConjugationForm[];
  activeLevels: JLPTLevel[];
  loaded: boolean;
  loadError: boolean;
  loadPracticeSettings: () => Promise<void>;
  setActiveForms: (forms: ConjugationForm[]) => Promise<void>;
  setActiveLevels: (levels: JLPTLevel[]) => Promise<void>;
  toggleForm: (form: ConjugationForm) => Promise<void>;
  toggleLevel: (level: JLPTLevel) => Promise<void>;
}

const allForms: ConjugationForm[] = [
  'masu', 'te', 'ta', 'nai', 'nakatta',
  'masu_negative', 'masu_past', 'masu_past_negative',
  'potential', 'passive', 'causative', 'causative_passive',
  'conditional_ba', 'conditional_tara', 'volitional',
  'imperative', 'prohibitive',
];

const allLevels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
const validForms: ConjugationForm[] = [...ALL_FORMS];

const queue = createStoreQueue();

function parseStoredSubset<T>(value: unknown, valid: T[]): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is T => valid.includes(item as T));
}

function safeForms(forms: ConjugationForm[]): ConjugationForm[] {
  const valid = parseStoredSubset(forms, validForms);
  return valid.length > 0 ? valid : ['masu'];
}

function safeLevels(levels: JLPTLevel[]): JLPTLevel[] {
  const valid = parseStoredSubset(levels, allLevels);
  return valid.length > 0 ? valid : ['N5'];
}

export const usePracticeSettingsStore = create<PracticeSettingsStore>((set, get) => ({
  activeForms: [...allForms],
  activeLevels: [...allLevels],
  loaded: false,
  loadError: false,

  loadPracticeSettings: async () => {
    if (get().loaded) return;
    set({ loadError: false });
    return queue.runLoad(async () => {
      if (get().loaded) return;
      try {
        const stored = await AsyncStorage.getItem('practiceSettings');
        const parsed = stored ? JSON.parse(stored) : {};
        const forms = parseStoredSubset(parsed?.activeForms, validForms);
        const levels = parseStoredSubset(parsed?.activeLevels, allLevels);
        set({
          activeForms: forms.length > 0 ? forms : [...allForms],
          activeLevels: levels.length > 0 ? levels : [...allLevels],
          loaded: true,
          loadError: false,
        });
      } catch (e) {
        console.warn('Failed to load practice settings:', e);
        set({ loadError: true });
      }
    });
  },

  setActiveForms: async (forms) => {
    if (!get().loaded) {
      await get().loadPracticeSettings();
    }
    if (!get().loaded) {
      console.warn('Skipping practice form update: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const nextForms = safeForms(forms);
      const nextLevels = get().activeLevels;
      const persisted = await safeSetItem(
        'practiceSettings',
        JSON.stringify({ activeForms: nextForms, activeLevels: nextLevels }),
      );
      if (!persisted) {
        console.warn('Practice settings not persisted');
        return;
      }
      set({ activeForms: nextForms });
    });
  },

  setActiveLevels: async (levels) => {
    if (!get().loaded) {
      await get().loadPracticeSettings();
    }
    if (!get().loaded) {
      console.warn('Skipping practice level update: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const nextForms = get().activeForms;
      const nextLevels = safeLevels(levels);
      const persisted = await safeSetItem(
        'practiceSettings',
        JSON.stringify({ activeForms: nextForms, activeLevels: nextLevels }),
      );
      if (!persisted) {
        console.warn('Practice settings not persisted');
        return;
      }
      set({ activeLevels: nextLevels });
    });
  },

  toggleForm: async (form) => {
    if (!get().loaded) {
      await get().loadPracticeSettings();
    }
    if (!get().loaded) {
      console.warn('Skipping practice form toggle: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const current = get().activeForms;
      const levels = get().activeLevels;
      let updated: ConjugationForm[];
      if (current.includes(form)) {
        if (current.length <= 1) return;
        updated = current.filter(f => f !== form);
      } else {
        updated = [...current, form];
      }
      const persisted = await safeSetItem(
        'practiceSettings',
        JSON.stringify({ activeForms: updated, activeLevels: levels }),
      );
      if (!persisted) {
        console.warn('Practice settings not persisted');
        return;
      }
      set({ activeForms: updated });
    });
  },

  toggleLevel: async (level) => {
    if (!get().loaded) {
      await get().loadPracticeSettings();
    }
    if (!get().loaded) {
      console.warn('Skipping practice level toggle: store never loaded');
      return;
    }
    return queue.enqueue(async () => {
      const current = get().activeLevels;
      const forms = get().activeForms;
      let updated: JLPTLevel[];
      if (current.includes(level)) {
        if (current.length <= 1) return;
        updated = current.filter(l => l !== level);
      } else {
        updated = [...current, level];
      }
      const persisted = await safeSetItem(
        'practiceSettings',
        JSON.stringify({ activeForms: forms, activeLevels: updated }),
      );
      if (!persisted) {
        console.warn('Practice settings not persisted');
        return;
      }
      set({ activeLevels: updated });
    });
  },
}));

export function __resetPracticeSettingsStoreForTests() {
  queue.reset();
  usePracticeSettingsStore.setState({
    activeForms: [...allForms],
    activeLevels: [...allLevels],
    loaded: false,
    loadError: false,
  });
}

export { allForms, allLevels };
