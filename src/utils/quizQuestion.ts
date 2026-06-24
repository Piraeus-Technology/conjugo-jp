import verbs from '../data/verbs.json';
import {
  conjugateReading,
  ConjugationForm,
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

  const wrongAnswers = new Set<string>();

  for (const f of pool) {
    if (f === form) continue;
    const wrong = conjugateReading(data, f);
    if (wrong !== correctAnswer) {
      wrongAnswers.add(wrong);
    }
  }

  addSameFormDistractors(wrongAnswers, verbEntries, form, correctAnswer, 6);
  if (wrongAnswers.size < 3) {
    addSameFormDistractors(wrongAnswers, allVerbEntries, form, correctAnswer, 6);
  }

  const wrongArray = Array.from(wrongAnswers);
  const selected: string[] = [];
  while (selected.length < 3 && wrongArray.length > 0) {
    const idx = Math.floor(Math.random() * wrongArray.length);
    selected.push(wrongArray.splice(idx, 1)[0]);
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
