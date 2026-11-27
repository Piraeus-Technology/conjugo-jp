import { practiceBaseWeights } from './practiceSelection';
import {
  adjectiveKey,
  alsoCorrectAdjectiveReadings,
  conjugateAdjectiveReading,
  listAdjectiveDistractors,
  practiceAdjectiveForms,
  type AdjectiveData,
  type AdjectiveEntry,
  type AdjectiveForm,
} from './adjectives';

export interface AdjectiveQuestion {
  word: string;
  reading: string;
  translation: string;
  form: AdjectiveForm;
  correctAnswer: string;
  options: string[];
  data: AdjectiveData;
}

export interface AdjectiveCard {
  word: string;
  reading: string;
  translation: string;
  form: AdjectiveForm;
  answer: string;
  alsoCorrect: string[];
  data: AdjectiveData;
}

interface Selection {
  entry: AdjectiveEntry;
  forms: AdjectiveForm[];
}

export function countEligibleAdjectives(
  entries: readonly AdjectiveEntry[],
  activeForms: readonly AdjectiveForm[],
): number {
  let count = 0;
  for (const [, data] of entries) {
    if (practiceAdjectiveForms(data, activeForms).length > 0) count++;
  }
  return count;
}

// Same weighting as verb practice: a per-level base share times the learner's
// spaced-repetition weight for that word.
function pickAdjective(
  entries: readonly AdjectiveEntry[],
  activeForms: readonly AdjectiveForm[],
  getWeight: (key: string) => number,
  random: () => number,
): Selection | null {
  const base = practiceBaseWeights(entries);
  const eligible: { selection: Selection; weight: number }[] = [];
  let total = 0;
  entries.forEach((entry, index) => {
    const forms = practiceAdjectiveForms(entry[1], activeForms);
    if (forms.length === 0) return;
    const weight = Math.max(0.01, getWeight(adjectiveKey(entry[0]))) * base[index];
    total += weight;
    eligible.push({ selection: { entry, forms }, weight });
  });
  if (eligible.length === 0) return null;
  let roll = random() * total;
  for (const candidate of eligible) {
    roll -= candidate.weight;
    if (roll <= 0) return candidate.selection;
  }
  return eligible[eligible.length - 1].selection;
}

export function generateAdjectiveQuestion(
  activeForms: readonly AdjectiveForm[],
  getWeight: (key: string) => number,
  entries: readonly AdjectiveEntry[],
  random: () => number = Math.random,
): AdjectiveQuestion | null {
  const selection = pickAdjective(entries, activeForms, getWeight, random);
  if (!selection) return null;
  const [word, data] = selection.entry;
  const form = selection.forms[Math.floor(random() * selection.forms.length)];
  const correctAnswer = conjugateAdjectiveReading(data, form);
  const options = [correctAnswer, ...listAdjectiveDistractors(data, form).slice(0, 3)];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { word, reading: data.reading, translation: data.translation, form, correctAnswer, options, data };
}

export function generateAdjectiveCard(
  activeForms: readonly AdjectiveForm[],
  getWeight: (key: string) => number,
  entries: readonly AdjectiveEntry[],
  random: () => number = Math.random,
): AdjectiveCard | null {
  const selection = pickAdjective(entries, activeForms, getWeight, random);
  if (!selection) return null;
  const [word, data] = selection.entry;
  const form = selection.forms[Math.floor(random() * selection.forms.length)];
  return {
    word,
    reading: data.reading,
    translation: data.translation,
    form,
    answer: conjugateAdjectiveReading(data, form),
    alsoCorrect: alsoCorrectAdjectiveReadings(data, form),
    data,
  };
}
