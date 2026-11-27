import pairsJson from '../data/pairs.json';
import verbsJson from '../data/verbs.json';
import { conjugate, type ConjugationForm, type JLPTLevel, type VerbData } from './conjugate';
import { practiceBaseWeights } from './practiceSelection';

// Transitive/intransitive pairs (自動詞・他動詞). Each pair has one sentence per
// side with a blank; the learner picks which member fills it, both offered in
// the sentence's form. The particle is the cue: an intransitive sentence has no
// を at all, a transitive one has a を object.

export type PairSide = 'intransitive' | 'transitive';

export interface PairSentence {
  form: ConjugationForm;
  /** The sentence with {} where the verb goes. */
  ja: string;
  en: string;
}

export interface PairData {
  intransitive: string;
  transitive: string;
  intransitiveSentence: PairSentence;
  transitiveSentence: PairSentence;
}

/** [spaced-repetition key, pair] with the level used for practice weighting. */
export type PairEntry = [string, PairData & { jlpt: JLPTLevel }];

export const PAIR_BLANK = '{}';
const PROMPT_BLANK = '＿＿＿';
const PAIR_KEY_PREFIX = 'pair:';
const LEVEL_RANK: Record<JLPTLevel, number> = { N5: 5, N4: 4, N3: 3, N2: 2, N1: 1 };

const verbMap = verbsJson as Record<string, VerbData>;
const pairData = pairsJson as PairData[];

export function pairKey(pair: Pick<PairData, 'intransitive' | 'transitive'>): string {
  return `${PAIR_KEY_PREFIX}${pair.intransitive}/${pair.transitive}`;
}

// A pair is practised at its easier member's level: the contrast is learnable
// as soon as the learner knows one side (曲がる N5 / 曲げる N2 is an N5 pair).
function pairLevel(pair: PairData): JLPTLevel {
  const levels = [verbMap[pair.intransitive].jlpt, verbMap[pair.transitive].jlpt] as JLPTLevel[];
  return levels.reduce((a, b) => (LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a));
}

export const pairList: PairEntry[] = pairData.map(pair => [pairKey(pair), { ...pair, jlpt: pairLevel(pair) }]);
const pairByKey = new Map(pairList);

export function parsePairKey(key: string): PairData | null {
  return pairByKey.get(key) ?? null;
}

export interface Partner {
  verb: string;
  transitive: boolean;
}

const partnerIndex = new Map<string, Partner[]>();
for (const [, pair] of pairList) {
  const add = (verb: string, partner: Partner) => {
    partnerIndex.set(verb, [...(partnerIndex.get(verb) ?? []), partner]);
  };
  add(pair.intransitive, { verb: pair.transitive, transitive: true });
  add(pair.transitive, { verb: pair.intransitive, transitive: false });
}

/** The verbs that form a transitivity pair with this one (起こす has two). */
export function partnersOf(verb: string): Partner[] {
  return partnerIndex.get(verb) ?? [];
}

export interface PairMember {
  verb: string;
  reading: string;
  translation: string;
}

export interface PairQuestion {
  key: string;
  side: PairSide;
  form: ConjugationForm;
  /** The sentence with a visible blank. */
  prompt: string;
  /** The sentence completed with the correct verb, in kanji. */
  filled: string;
  english: string;
  correctAnswer: string;
  options: string[];
  intransitive: PairMember;
  transitive: PairMember;
}

function member(verb: string): PairMember {
  const data = verbMap[verb];
  return { verb, reading: data.reading, translation: data.translation };
}

// Same weighting as verb practice: a per-level base share times the learner's
// spaced-repetition weight for that pair.
function pickPair(
  entries: readonly PairEntry[],
  getWeight: (key: string) => number,
  random: () => number,
): PairEntry | null {
  if (entries.length === 0) return null;
  const base = practiceBaseWeights(entries);
  const weights = entries.map(([key], index) => Math.max(0.01, getWeight(key)) * base[index]);
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < entries.length; index++) {
    roll -= weights[index];
    if (roll <= 0) return entries[index];
  }
  return entries[entries.length - 1];
}

export function buildPairQuestion(entry: PairEntry, side: PairSide, swap: boolean): PairQuestion {
  const [key, pair] = entry;
  const sentence = side === 'intransitive' ? pair.intransitiveSentence : pair.transitiveSentence;
  const intransitiveForm = conjugate(pair.intransitive, verbMap[pair.intransitive], sentence.form);
  const transitiveForm = conjugate(pair.transitive, verbMap[pair.transitive], sentence.form);
  const correct = side === 'intransitive' ? intransitiveForm : transitiveForm;
  const options = [intransitiveForm.reading, transitiveForm.reading];
  if (swap) options.reverse();
  return {
    key,
    side,
    form: sentence.form,
    prompt: sentence.ja.replace(PAIR_BLANK, PROMPT_BLANK),
    filled: sentence.ja.replace(PAIR_BLANK, correct.value),
    english: sentence.en,
    correctAnswer: correct.reading,
    options,
    intransitive: member(pair.intransitive),
    transitive: member(pair.transitive),
  };
}

export function generatePairQuestion(
  entries: readonly PairEntry[],
  getWeight: (key: string) => number,
  random: () => number = Math.random,
): PairQuestion | null {
  const entry = pickPair(entries, getWeight, random);
  if (!entry) return null;
  const side: PairSide = random() < 0.5 ? 'intransitive' : 'transitive';
  return buildPairQuestion(entry, side, random() < 0.5);
}

export function getPairHint(question: PairQuestion): string {
  const intr = `${question.intransitive.verb} (自動詞, ${question.intransitive.translation})`;
  const tr = `${question.transitive.verb} (他動詞, ${question.transitive.translation})`;
  return question.side === 'transitive'
    ? `This sentence has an object marked with を, something someone acts on, so it takes the transitive verb ${tr}. `
      + `Without a を object, the thing changes by itself: ${intr}.`
    : `This sentence has no を object: the subject changes or acts by itself, so it takes the intransitive verb ${intr}. `
      + `With a を object, someone acts on it: ${tr}.`;
}

/** "開く／開ける" for stats and labels. */
export function pairLabel(pair: Pick<PairData, 'intransitive' | 'transitive'>): { words: string; readings: string } {
  return {
    words: `${pair.intransitive}／${pair.transitive}`,
    readings: `${verbMap[pair.intransitive].reading}／${verbMap[pair.transitive].reading}`,
  };
}
