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
    const safe = forms.length > 0 ? forms : ['masu' as ConjugationForm];
    const levels = get().activeLevels;
    set({ activeForms: safe });
    try { await AsyncStorage.setItem('practiceSettings', JSON.stringify({ activeForms: safe, activeLevels: levels })); } catch {}
  },

  setActiveLevels: async (levels) => {
    const safe = levels.length > 0 ? levels : ['N5' as JLPTLevel];
    const forms = get().activeForms;
    set({ activeLevels: safe });
    try { await AsyncStorage.setItem('practiceSettings', JSON.stringify({ activeForms: forms, activeLevels: safe })); } catch {}
  },

  toggleForm: async (form) => {
    const current = get().activeForms;
    const levels = get().activeLevels;
    let updated: ConjugationForm[];
    if (current.includes(form)) {
      if (current.length <= 1) return;
      updated = current.filter(f => f !== form);
    } else {
      updated = [...current, form];
    }
    set({ activeForms: updated });
    try { await AsyncStorage.setItem('practiceSettings', JSON.stringify({ activeForms: updated, activeLevels: levels })); } catch {}
  },

  toggleLevel: async (level) => {
    const current = get().activeLevels;
    const forms = get().activeForms;
    let updated: JLPTLevel[];
    if (current.includes(level)) {
      if (current.length <= 1) return;
      updated = current.filter(l => l !== level);
    } else {
      updated = [...current, level];
    }
    set({ activeLevels: updated });
    try { await AsyncStorage.setItem('practiceSettings', JSON.stringify({ activeForms: forms, activeLevels: updated })); } catch {}
  },
}));

export { allForms, allLevels };
