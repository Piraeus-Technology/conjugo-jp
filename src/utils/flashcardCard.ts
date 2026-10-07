import {
  conjugateReading,
  quizzableForms,
  type ConjugationForm,
  type VerbData,
} from './conjugate';
import { practiceBaseWeights } from './practiceSelection';

export interface Flashcard {
  verb: string;
  reading: string;
  translation: string;
  form: ConjugationForm;
  answer: string;
}

interface EligibleEntry {
  entry: [string, VerbData];
  forms: ConjugationForm[];
  weight: number;
}

export function generateFlashcard(
  entries: [string, VerbData][],
  activeForms: ConjugationForm[],
  getWeight: (verb: string) => number,
  random: () => number = Math.random,
): Flashcard | null {
  const eligible: EligibleEntry[] = [];
  let totalWeight = 0;

  const baseWeights = practiceBaseWeights(entries);

  entries.forEach((entry, index) => {
    const forms = quizzableForms(entry[1], activeForms);
    if (forms.length === 0) return;
    const weight = Math.max(0.01, getWeight(entry[0])) * baseWeights[index];
    totalWeight += weight;
    eligible.push({ entry, forms, weight });
  });

  if (eligible.length === 0) return null;

  let roll = random() * totalWeight;
  let selected = eligible[eligible.length - 1];
  for (const candidate of eligible) {
    roll -= candidate.weight;
    if (roll <= 0) {
      selected = candidate;
      break;
    }
  }

  const [verb, data] = selected.entry;
  const form = selected.forms[Math.floor(random() * selected.forms.length)];
  return {
    verb,
    reading: data.reading,
    translation: data.translation,
    form,
    answer: conjugateReading(data, form),
  };
}
