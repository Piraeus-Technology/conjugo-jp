import { conjugateReading, type ConjugationForm, type VerbData } from './conjugate';
import { chooseQuizzableEntry, createPracticePicker } from './practiceSelection';
import { listQuizDistractors } from './quizDistractors';

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
  const selection = chooseQuizzableEntry(
    verbEntries, activeForms, createPracticePicker(verbEntries, getWeight),
  );
  if (!selection) return null;

  const [verb, data] = selection.entry;
  const pool = selection.forms;
  const form = pool[Math.floor(Math.random() * pool.length)];
  const correctAnswer = conjugateReading(data, form);

  const { primary, fallback } = listQuizDistractors(data, form);
  const options = [correctAnswer, ...[...primary, ...fallback].slice(0, 3)];
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
