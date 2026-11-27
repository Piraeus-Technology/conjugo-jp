import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_FORMS, FORM_GROUPS } from '../utils/conjugate';
import type { ConjugationForm, JLPTLevel } from '../utils/conjugate';
import { ADJECTIVE_FORM_GROUPS } from '../utils/adjectives';
import type { AdjectiveForm } from '../utils/adjectives';
import { safeSetItem } from '../utils/safeStorage';
import { createStoreQueue } from '../utils/storeQueue';

interface PracticeSettingsSnapshot {
  activeForms: ConjugationForm[];
  activeLevels: JLPTLevel[];
  adjectivesEnabled: boolean;
  activeAdjectiveForms: AdjectiveForm[];
  adjectiveNoticeDismissed: boolean;
  pairsEnabled: boolean;
  pairNoticeDismissed: boolean;
}

interface PracticeSettingsStore extends PracticeSettingsSnapshot {
  loaded: boolean;
  loadError: boolean;
  loadPracticeSettings: () => Promise<void>;
  setActiveForms: (forms: ConjugationForm[]) => Promise<void>;
  setActiveLevels: (levels: JLPTLevel[]) => Promise<void>;
  toggleForm: (form: ConjugationForm) => Promise<void>;
  toggleLevel: (level: JLPTLevel) => Promise<void>;
  setAdjectivesEnabled: (enabled: boolean) => Promise<void>;
  toggleAdjectives: () => Promise<void>;
  setActiveAdjectiveForms: (forms: AdjectiveForm[]) => Promise<void>;
  toggleAdjectiveForm: (form: AdjectiveForm) => Promise<void>;
  dismissAdjectiveNotice: () => Promise<void>;
  setPairsEnabled: (enabled: boolean) => Promise<void>;
  togglePairs: () => Promise<void>;
  dismissPairNotice: () => Promise<void>;
  resetPracticeSettings: () => Promise<boolean>;
}

// Keep the settings model and the reference table on one source of truth.
const allForms: ConjugationForm[] = Array.from(new Set(
  FORM_GROUPS.flatMap(group => group.forms).filter(form => form !== 'dictionary'),
));
const allAdjectiveForms: AdjectiveForm[] = Array.from(new Set(
  ADJECTIVE_FORM_GROUPS.flatMap(group => group.forms),
));

const allLevels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
export const beginnerForms: ConjugationForm[] = ['masu', 'masu_negative', 'masu_past', 'te', 'ta', 'nai'];
export const beginnerLevels: JLPTLevel[] = ['N5', 'N4'];
export const beginnerAdjectiveForms: AdjectiveForm[] = ['polite', 'negative', 'polite_negative', 'past', 'polite_past', 'te'];

// These keys are written by 1.4.0 even when Practice Settings was never
// changed. App boot resolves this before navigation can create new activity.
const legacyKeys = [
  'verb_history', 'favorites', 'quiz_stats', 'sessions', 'flashcard_stats',
  'flashcardSessions', 'spaced_rep_weights', 'theme_mode', 'auto_tts',
];
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

function safeAdjectiveForms(forms: AdjectiveForm[]): AdjectiveForm[] {
  const valid = parseStoredSubset(forms, allAdjectiveForms);
  return valid.length > 0 ? valid : [...beginnerAdjectiveForms];
}

// A new install starts with adjectives and transitivity pairs on and never
// sees the "new" notes. Someone who already used the app keeps exactly the
// practice they had: each stays off until they turn it on, and a note says so.
function newInstallDefaults(): PracticeSettingsSnapshot {
  return {
    activeForms: [...beginnerForms],
    activeLevels: [...beginnerLevels],
    adjectivesEnabled: true,
    activeAdjectiveForms: [...beginnerAdjectiveForms],
    adjectiveNoticeDismissed: true,
    pairsEnabled: true,
    pairNoticeDismissed: true,
  };
}

function snapshot(state: PracticeSettingsSnapshot): PracticeSettingsSnapshot {
  return {
    activeForms: state.activeForms,
    activeLevels: state.activeLevels,
    adjectivesEnabled: state.adjectivesEnabled,
    activeAdjectiveForms: state.activeAdjectiveForms,
    adjectiveNoticeDismissed: state.adjectiveNoticeDismissed,
    pairsEnabled: state.pairsEnabled,
    pairNoticeDismissed: state.pairNoticeDismissed,
  };
}

export const usePracticeSettingsStore = create<PracticeSettingsStore>((set, get) => {
  // Persist the whole snapshot with one change applied, then publish it. The
  // change is computed inside the queue, from the state the previous queued
  // write left, so two quick toggles never overwrite each other.
  type Change = Partial<PracticeSettingsSnapshot> | null;
  const persist = async (
    change: Change | ((state: PracticeSettingsSnapshot) => Change),
    action: string,
  ) => {
    if (!get().loaded) {
      await get().loadPracticeSettings();
    }
    if (!get().loaded) {
      console.warn(`Skipping practice ${action}: store never loaded`);
      return;
    }
    return queue.enqueue(async () => {
      const current = snapshot(get());
      const resolved = typeof change === 'function' ? change(current) : change;
      if (!resolved) return;
      const next = { ...current, ...resolved };
      if (!(await safeSetItem('practiceSettings', JSON.stringify(next)))) {
        console.warn('Practice settings not persisted');
        return;
      }
      set(resolved);
    });
  };

  // Toggle one member of a list setting, never emptying it.
  function toggled<T>(list: T[], item: T): T[] | null {
    if (list.includes(item)) return list.length <= 1 ? null : list.filter(x => x !== item);
    return [...list, item];
  }

  return {
    ...newInstallDefaults(),
    loaded: false,
    loadError: false,

    loadPracticeSettings: async () => {
      if (get().loaded) return;
      set({ loadError: false });
      return queue.runLoad(async () => {
        if (get().loaded) return;
        try {
          const stored = await AsyncStorage.getItem('practiceSettings');
          if (stored === null) {
            const legacyValues = await Promise.all(legacyKeys.map(key => AsyncStorage.getItem(key)));
            const returning = legacyValues.some(value => value !== null);
            const initial: PracticeSettingsSnapshot = returning
              ? {
                activeForms: [...allForms],
                activeLevels: [...allLevels],
                adjectivesEnabled: false,
                activeAdjectiveForms: [...beginnerAdjectiveForms],
                adjectiveNoticeDismissed: false,
                pairsEnabled: false,
                pairNoticeDismissed: false,
              }
              : newInstallDefaults();
            if (!(await safeSetItem('practiceSettings', JSON.stringify(initial)))) {
              set({ loadError: true });
              return;
            }
            set({ ...initial, loaded: true, loadError: false });
            return;
          }
          const parsed = stored ? JSON.parse(stored) : {};
          const forms = parseStoredSubset(parsed?.activeForms, validForms);
          const levels = parseStoredSubset(parsed?.activeLevels, allLevels);
          const adjectiveForms = parseStoredSubset(parsed?.activeAdjectiveForms, allAdjectiveForms);
          set({
            activeForms: forms.length > 0 ? forms : [...allForms],
            activeLevels: levels.length > 0 ? levels : [...allLevels],
            // Settings saved before adjectives existed have none of these
            // fields: that learner keeps verbs only and sees the note.
            adjectivesEnabled: parsed?.adjectivesEnabled === true,
            activeAdjectiveForms: adjectiveForms.length > 0 ? adjectiveForms : [...beginnerAdjectiveForms],
            adjectiveNoticeDismissed: parsed?.adjectiveNoticeDismissed === true,
            // Likewise for settings saved before transitivity pairs existed.
            pairsEnabled: parsed?.pairsEnabled === true,
            pairNoticeDismissed: parsed?.pairNoticeDismissed === true,
            loaded: true,
            loadError: false,
          });
        } catch (e) {
          console.warn('Failed to load practice settings:', e);
          set({ loadError: true });
        }
      });
    },

    resetPracticeSettings: async () => {
      let reset = false;
      await queue.enqueue(async () => {
        const defaults = newInstallDefaults();
        if (!(await safeSetItem('practiceSettings', JSON.stringify(defaults)))) return;
        set({ ...defaults, loaded: true, loadError: false });
        reset = true;
      });
      return reset;
    },

    setActiveForms: (forms) => persist({ activeForms: safeForms(forms) }, 'form update'),

    setActiveLevels: (levels) => persist({ activeLevels: safeLevels(levels) }, 'level update'),

    toggleForm: (form) => persist(state => {
      const updated = toggled(state.activeForms, form);
      return updated && { activeForms: updated };
    }, 'form toggle'),

    toggleLevel: (level) => persist(state => {
      const updated = toggled(state.activeLevels, level);
      return updated && { activeLevels: updated };
    }, 'level toggle'),

    // Turning adjectives on also retires the "new" note.
    setAdjectivesEnabled: (enabled) => persist(
      enabled ? { adjectivesEnabled: true, adjectiveNoticeDismissed: true } : { adjectivesEnabled: false },
      'adjective toggle',
    ),

    toggleAdjectives: () => persist(
      state => state.adjectivesEnabled
        ? { adjectivesEnabled: false }
        : { adjectivesEnabled: true, adjectiveNoticeDismissed: true },
      'adjective toggle',
    ),

    setActiveAdjectiveForms: (forms) => persist(
      { activeAdjectiveForms: safeAdjectiveForms(forms) },
      'adjective form update',
    ),

    toggleAdjectiveForm: (form) => persist(state => {
      const updated = toggled(state.activeAdjectiveForms, form);
      return updated && { activeAdjectiveForms: updated };
    }, 'adjective form toggle'),

    dismissAdjectiveNotice: () => persist({ adjectiveNoticeDismissed: true }, 'notice dismissal'),

    // Turning pairs on also retires their "new" note.
    setPairsEnabled: (enabled) => persist(
      enabled ? { pairsEnabled: true, pairNoticeDismissed: true } : { pairsEnabled: false },
      'pair toggle',
    ),

    togglePairs: () => persist(
      state => state.pairsEnabled
        ? { pairsEnabled: false }
        : { pairsEnabled: true, pairNoticeDismissed: true },
      'pair toggle',
    ),

    dismissPairNotice: () => persist({ pairNoticeDismissed: true }, 'pair notice dismissal'),
  };
});

export function __resetPracticeSettingsStoreForTests() {
  queue.reset();
  usePracticeSettingsStore.setState({
    ...newInstallDefaults(),
    loaded: false,
    loadError: false,
  });
}

export { allForms, allLevels, allAdjectiveForms };
