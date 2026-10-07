import {
  ConjugationForm,
  VerbData,
  conjugateReading,
  quizzableForms,
} from './conjugate';

export type VerbEntry = [string, VerbData];

// Every verb in a level has the same base chance, independent of file order.
// Inverse-square-root weighting eases the larger levels' population bias
// without assigning equal shares to levels (which would over-weight N5).
export function practiceBaseWeights(entries: VerbEntry[]): number[] {
  const counts = new Map<string, number>();
  for (const [, data] of entries) counts.set(data.jlpt, (counts.get(data.jlpt) ?? 0) + 1);
  return entries.map(([, data]) => 1 / Math.sqrt(counts.get(data.jlpt)!));
}

export function createPracticePicker(
  entries: VerbEntry[],
  getWeight: (verb: string) => number,
): () => VerbEntry | undefined {
  const weights = practiceBaseWeights(entries).map((base, index) =>
    base * Math.max(0.01, getWeight(entries[index][0])),
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return () => {
    let roll = Math.random() * total;
    for (let index = 0; index < entries.length; index++) {
      roll -= weights[index];
      if (roll <= 0) return entries[index];
    }
    return entries[entries.length - 1];
  };
}

export interface QuizzableEntrySelection {
  entry: VerbEntry;
  forms: ConjugationForm[];
}

export function chooseQuizzableEntry(
  entries: VerbEntry[],
  forms: ConjugationForm[],
  chooseEntry: () => VerbEntry | undefined,
  maxAttempts = Math.max(20, entries.length * 2),
): QuizzableEntrySelection | null {
  if (entries.length === 0 || forms.length === 0) return null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const entry = chooseEntry();
    if (!entry) continue;
    const allowedForms = quizzableForms(entry[1], forms);
    if (allowedForms.length > 0) {
      return { entry, forms: allowedForms };
    }
  }

  for (const entry of entries) {
    const allowedForms = quizzableForms(entry[1], forms);
    if (allowedForms.length > 0) {
      return { entry, forms: allowedForms };
    }
  }

  return null;
}

export function isFormQuizzableForVerb(verb: VerbData, form: ConjugationForm): boolean {
  return quizzableForms(verb, [form]).length > 0;
}

export function addSameFormDistractors(
  wrongAnswers: Set<string>,
  entries: VerbEntry[],
  form: ConjugationForm,
  correctAnswer: string,
  targetSize: number,
  chooseIndex: (length: number) => number = (length) => Math.floor(Math.random() * length),
  maxAttempts = Math.max(20, entries.length * 2),
): void {
  if (entries.length === 0 || wrongAnswers.size >= targetSize) return;

  const addEntry = (entry: VerbEntry) => {
    const [, otherData] = entry;
    if (!isFormQuizzableForVerb(otherData, form)) return;
    const wrong = conjugateReading(otherData, form);
    if (wrong !== correctAnswer) {
      wrongAnswers.add(wrong);
    }
  };

  for (let attempt = 0; attempt < maxAttempts && wrongAnswers.size < targetSize; attempt++) {
    const entry = entries[chooseIndex(entries.length)];
    if (entry) addEntry(entry);
  }

  for (const entry of entries) {
    if (wrongAnswers.size >= targetSize) return;
    addEntry(entry);
  }
}
