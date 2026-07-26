import verbs from '../data/verbs.json';
import {
  ALL_FORMS,
  conjugateReading,
  ConjugationForm,
  quizzableForms,
  VerbData,
} from './conjugate';
import { addSameFormDistractors, chooseQuizzableEntry } from './practiceSelection';

const allVerbEntries = Object.entries(verbs as Record<string, VerbData>);

export interface Question {
  verb: string;
  reading: string;
  translation: string;
  form: ConjugationForm;
  correctAnswer: string;
  options: string[];
  verbData: VerbData;
}

function takeRandom(values: string[], count: number): string[] {
  const remaining = [...values];
  const selected: string[] = [];
  while (selected.length < count && remaining.length > 0) {
    const idx = Math.floor(Math.random() * remaining.length);
    selected.push(remaining.splice(idx, 1)[0]);
  }
  return selected;
}

export function generateQuestion(
  activeForms: ConjugationForm[],
  getWeight: (verb: string) => number,
  filteredEntries: [string, VerbData][],
): Question | null {
  const verbEntries = filteredEntries;
  const commonCount = Math.min(200, verbEntries.length);
  const selection = chooseQuizzableEntry(verbEntries, activeForms, () => {
    const candidates: number[] = [];
    for (let i = 0; i < 10; i++) {
      if (Math.random() < 0.7) {
        candidates.push(Math.floor(Math.random() * commonCount));
      } else {
        candidates.push(Math.floor(Math.random() * verbEntries.length));
      }
    }
    const verbIndex = candidates.reduce((best, idx) => {
      const bestWeight = getWeight(verbEntries[best][0]);
      const thisWeight = getWeight(verbEntries[idx][0]);
      return thisWeight > bestWeight ? idx : best;
    }, candidates[0]);
    return verbEntries[verbIndex];
  });
  if (!selection) return null;

  const [verb, data] = selection.entry;
  const pool = selection.forms;
  const form = pool[Math.floor(Math.random() * pool.length)];
  const correctAnswer = conjugateReading(data, form);

  // Active forms decide what may be asked. Distractors may use any other
  // quizzable form of this verb so single-form practice still tests
  // conjugation instead of making the answer identifiable by its stem.
  const sameVerbAnswers = new Set<string>();
  for (const f of quizzableForms(data, ALL_FORMS)) {
    if (f === form) continue;
    const wrong = conjugateReading(data, f);
    if (wrong !== correctAnswer) {
      sameVerbAnswers.add(wrong);
    }
  }

  const selected = takeRandom(Array.from(sameVerbAnswers), 3);

  if (selected.length < 3) {
    // Preserve every available same-verb distractor, then fill only the
    // remaining slots with the asked form from other quizzable verbs.
    const fallbackAnswers = new Set(selected);
    addSameFormDistractors(fallbackAnswers, verbEntries, form, correctAnswer, 6);
    if (fallbackAnswers.size < 3) {
      addSameFormDistractors(fallbackAnswers, allVerbEntries, form, correctAnswer, 6);
    }
    const selectedSet = new Set(selected);
    const fallbackPool = Array.from(fallbackAnswers).filter(answer => !selectedSet.has(answer));
    selected.push(...takeRandom(fallbackPool, 3 - selected.length));
  }

  const options = [correctAnswer, ...selected];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return {
    verb,
    reading: data.reading,
    translation: data.translation,
    form,
    correctAnswer,
    options,
    verbData: data,
  };
}
