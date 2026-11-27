import {
  FORM_LABELS,
  getConjugationHint,
  quizzableForms,
  type ConjugationForm,
  type VerbData,
} from './conjugate';
import { generateQuestion, type Question } from './quizQuestion';
import { generateFlashcard, type Flashcard } from './flashcardCard';
import { getExampleSentence } from './formExamples';
import {
  ADJECTIVE_FORM_LABELS,
  adjectiveKey,
  alsoCorrectAdjectiveReadings,
  getAdjectiveHint,
  type AdjectiveEntry,
  type AdjectiveForm,
} from './adjectives';
import {
  countEligibleAdjectives,
  generateAdjectiveCard,
  generateAdjectiveQuestion,
  type AdjectiveCard,
  type AdjectiveQuestion,
} from './adjectivePractice';
import { generatePairQuestion, getPairHint, pairMemberLabel, type PairEntry, type PairMember, type PairQuestion } from './pairs';

// One practice pool covering verbs and, when the learner has them on,
// adjectives and (quiz only) transitivity pairs. With both off, practice takes
// exactly the verb path it always has.
export interface PracticePool {
  verbEntries: [string, VerbData][];
  verbForms: ConjugationForm[];
  adjectiveEntries: AdjectiveEntry[];
  adjectiveForms: AdjectiveForm[];
  adjectivesEnabled: boolean;
  pairEntries?: PairEntry[];
  pairsEnabled?: boolean;
}

export type PracticeQuestion =
  | { kind: 'verb'; question: Question }
  | { kind: 'adjective'; question: AdjectiveQuestion }
  | { kind: 'pair'; question: PairQuestion };

export type PracticeCard =
  | { kind: 'verb'; card: Flashcard }
  | { kind: 'adjective'; card: AdjectiveCard };

function usesAdjectives(pool: PracticePool): boolean {
  return pool.adjectivesEnabled && pool.adjectiveForms.length > 0 && pool.adjectiveEntries.length > 0;
}

function countEligibleVerbs(pool: PracticePool): number {
  let verbs = 0;
  for (const [, data] of pool.verbEntries) {
    if (quizzableForms(data, pool.verbForms).length > 0) verbs++;
  }
  return verbs;
}

// Draw a word class in proportion to how many eligible words each has.
function drawAdjective(pool: PracticePool, random: () => number): boolean {
  if (!usesAdjectives(pool)) return false;
  const adjectives = countEligibleAdjectives(pool.adjectiveEntries, pool.adjectiveForms);
  if (adjectives === 0) return false;
  const verbs = countEligibleVerbs(pool);
  if (verbs === 0) return true;
  return random() < adjectives / (adjectives + verbs);
}

function usesPairs(pool: PracticePool): boolean {
  return pool.pairsEnabled === true && (pool.pairEntries?.length ?? 0) > 0;
}

// A pair is drawn in proportion too, counting as two words because it drills
// two verbs. With pairs off this draws nothing, so practice is unchanged.
function drawPair(pool: PracticePool, random: () => number): boolean {
  if (!usesPairs(pool)) return false;
  const pairs = 2 * pool.pairEntries!.length;
  const adjectives = usesAdjectives(pool) ? countEligibleAdjectives(pool.adjectiveEntries, pool.adjectiveForms) : 0;
  const others = countEligibleVerbs(pool) + adjectives;
  if (others === 0) return true;
  return random() < pairs / (pairs + others);
}

export function generatePracticeQuestion(
  pool: PracticePool,
  getWeight: (key: string) => number,
  random: () => number = Math.random,
): PracticeQuestion | null {
  if (drawPair(pool, random)) {
    const question = generatePairQuestion(pool.pairEntries!, getWeight, random);
    if (question) return { kind: 'pair', question };
  }
  if (drawAdjective(pool, random)) {
    const question = generateAdjectiveQuestion(pool.adjectiveForms, getWeight, pool.adjectiveEntries, random);
    if (question) return { kind: 'adjective', question };
  }
  const verbQuestion = generateQuestion(pool.verbForms, getWeight, pool.verbEntries);
  if (verbQuestion) return { kind: 'verb', question: verbQuestion };
  if (usesAdjectives(pool)) {
    const question = generateAdjectiveQuestion(pool.adjectiveForms, getWeight, pool.adjectiveEntries, random);
    if (question) return { kind: 'adjective', question };
  }
  if (usesPairs(pool)) {
    const question = generatePairQuestion(pool.pairEntries!, getWeight, random);
    if (question) return { kind: 'pair', question };
  }
  return null;
}

export function generatePracticeCard(
  pool: PracticePool,
  getWeight: (key: string) => number,
  random: () => number = Math.random,
): PracticeCard | null {
  if (drawAdjective(pool, random)) {
    const card = generateAdjectiveCard(pool.adjectiveForms, getWeight, pool.adjectiveEntries, random);
    if (card) return { kind: 'adjective', card };
  }
  const verbCard = generateFlashcard(pool.verbEntries, pool.verbForms, getWeight);
  if (verbCard) return { kind: 'verb', card: verbCard };
  if (usesAdjectives(pool)) {
    const card = generateAdjectiveCard(pool.adjectiveForms, getWeight, pool.adjectiveEntries, random);
    if (card) return { kind: 'adjective', card };
  }
  return null;
}

export interface FormLabel {
  ja: string;
  en: string;
  meaning?: string;
}

export interface QuestionView {
  headword: string;
  reading: string;
  translation: string;
  formLabel: FormLabel;
  correctAnswer: string;
  alsoCorrect: string[];
  options: string[];
  hint: string;
  /** Spaced-repetition key: the bare headword for verbs, adj:<headword> or pair:<intr>/<tr> otherwise. */
  srKey: string;
  /** Present for a transitivity pair: the sentence replaces the headword. */
  pairSentence?: {
    prompt: string;
    filled: string;
    english: string;
    intransitive: string;
    transitive: string;
  };
}

export const PAIR_FORM_LABEL: FormLabel = { ja: '自動詞・他動詞', en: 'Transitive or intransitive?' };

function describePairMember(member: PairMember): string {
  const word = member.verb === member.reading ? member.verb : `${member.verb}（${member.reading}）`;
  return `${word} (${pairMemberLabel(member)}) ${member.translation}`;
}

export function describeQuestion(item: PracticeQuestion, selectedAnswer?: string): QuestionView {
  if (item.kind === 'pair') {
    const q = item.question;
    return {
      headword: q.prompt,
      reading: '',
      translation: '',
      formLabel: PAIR_FORM_LABEL,
      correctAnswer: q.correctAnswer,
      alsoCorrect: [],
      options: q.options,
      hint: getPairHint(q),
      srKey: q.key,
      pairSentence: {
        prompt: q.prompt,
        filled: q.filled,
        english: q.english,
        intransitive: describePairMember(q.intransitive),
        transitive: describePairMember(q.transitive),
      },
    };
  }
  if (item.kind === 'verb') {
    const q = item.question;
    return {
      headword: q.verb,
      reading: q.reading,
      translation: q.translation,
      formLabel: FORM_LABELS[q.form],
      correctAnswer: q.correctAnswer,
      alsoCorrect: [],
      options: q.options,
      hint: getConjugationHint(q.verbData, q.form, q.verb),
      srKey: q.verb,
    };
  }
  const q = item.question;
  return {
    headword: q.word,
    reading: q.reading,
    translation: q.translation,
    formLabel: ADJECTIVE_FORM_LABELS[q.form],
    correctAnswer: q.correctAnswer,
    options: q.options,
    hint: getAdjectiveHint(q.word, q.data, q.form, selectedAnswer),
    alsoCorrect: alsoCorrectAdjectiveReadings(q.data, q.form),
    srKey: adjectiveKey(q.word),
  };
}

export interface CardView {
  headword: string;
  reading: string;
  translation: string;
  formLabel: FormLabel;
  answer: string;
  alsoCorrect: string[];
  example?: string;
  srKey: string;
}

export function describeCard(item: PracticeCard): CardView {
  if (item.kind === 'verb') {
    const c = item.card;
    return {
      headword: c.verb,
      reading: c.reading,
      translation: c.translation,
      formLabel: FORM_LABELS[c.form],
      answer: c.answer,
      alsoCorrect: [],
      example: getExampleSentence(c.verb, c.form),
      srKey: c.verb,
    };
  }
  const c = item.card;
  return {
    headword: c.word,
    reading: c.reading,
    translation: c.translation,
    formLabel: ADJECTIVE_FORM_LABELS[c.form],
    answer: c.answer,
    alsoCorrect: c.alsoCorrect,
    example: c.data.examples?.[0]?.ja,
    srKey: adjectiveKey(c.word),
  };
}
