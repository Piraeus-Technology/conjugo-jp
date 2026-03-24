import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ConjugationForm, JLPTLevel } from '../utils/conjugate';

interface PracticeSettingsStore {
  activeForms: ConjugationForm[];
  activeLevels: JLPTLevel[];
  loaded: boolean;
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

export const usePracticeSettingsStore = create<PracticeSettingsStore>((set, get) => ({
  activeForms: [...allForms],
  activeLevels: [...allLevels],
  loaded: false,

  loadPracticeSettings: async () => {
    try {
      const stored = await AsyncStorage.getItem('practiceSettings');
      if (stored) {
        const parsed = JSON.parse(stored);
        set({
          activeForms: parsed.activeForms || [...allForms],
          activeLevels: parsed.activeLevels || [...allLevels],
          loaded: true,
        });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  setActiveForms: async (forms) => {
    set({ activeForms: forms });
    const stored = await AsyncStorage.getItem('practiceSettings');
    const settings = stored ? JSON.parse(stored) : {};
    settings.activeForms = forms;
    await AsyncStorage.setItem('practiceSettings', JSON.stringify(settings));
  },

  setActiveLevels: async (levels) => {
    set({ activeLevels: levels });
    const stored = await AsyncStorage.getItem('practiceSettings');
    const settings = stored ? JSON.parse(stored) : {};
    settings.activeLevels = levels;
    await AsyncStorage.setItem('practiceSettings', JSON.stringify(settings));
  },

  toggleForm: async (form) => {
    const current = get().activeForms;
    let updated: ConjugationForm[];
    if (current.includes(form)) {
      if (current.length <= 1) return;
      updated = current.filter(f => f !== form);
    } else {
      updated = [...current, form];
    }
    set({ activeForms: updated });
    const stored = await AsyncStorage.getItem('practiceSettings');
    const settings = stored ? JSON.parse(stored) : {};
    settings.activeForms = updated;
    await AsyncStorage.setItem('practiceSettings', JSON.stringify(settings));
  },

  toggleLevel: async (level) => {
    const current = get().activeLevels;
    let updated: JLPTLevel[];
    if (current.includes(level)) {
      if (current.length <= 1) return;
      updated = current.filter(l => l !== level);
    } else {
      updated = [...current, level];
    }
    set({ activeLevels: updated });
    const stored = await AsyncStorage.getItem('practiceSettings');
    const settings = stored ? JSON.parse(stored) : {};
    settings.activeLevels = updated;
    await AsyncStorage.setItem('practiceSettings', JSON.stringify(settings));
  },
}));

export { allForms, allLevels };
