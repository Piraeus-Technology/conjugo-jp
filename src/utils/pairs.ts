import pairsJson from '../data/pairs.json';
import verbsJson from '../data/verbs.json';
import { conjugate, type ConjugationForm, type JLPTLevel, type VerbData } from './conjugate';

// Each pair has one sentence per member, with both options in the sentence's form.

export type PairSide = 'intransitive' | 'transitive';

export interface PairSentence {
  form: ConjugationForm;
  /** The sentence with {} where the verb goes. */
  ja: string;
  en: string;
  cue: string;
  cueNote?: string;
}

export interface PairData {
  /** The first member. 着る is transitive even though it occupies this position. */
  intransitive: string;
  transitive: string;
  intransitiveSentence: PairSentence;
  transitiveSentence: PairSentence;
}

/** [spaced-repetition key, pair] */
export type PairEntry = [string, PairData];

export const PAIR_BLANK = '{}';
export const PAIR_PROMPT_BLANK = '＿＿＿';
const PAIR_KEY_PREFIX = 'pair:';

const verbMap = verbsJson as Record<string, VerbData>;
const pairData = pairsJson as PairData[];

export function pairKey(pair: Pick<PairData, 'intransitive' | 'transitive'>): string {
  return `${PAIR_KEY_PREFIX}${pair.intransitive}/${pair.transitive}`;
}

export function isPairEligible(pair: PairData, levels: readonly JLPTLevel[]): boolean {
  return levels.includes(verbMap[pair.intransitive].jlpt) || levels.includes(verbMap[pair.transitive].jlpt);
}

export const pairList: PairEntry[] = pairData.map(pair => [pairKey(pair), pair]);
const pairByKey = new Map(pairList);

export function parsePairKey(key: string): PairData | null {
  return pairByKey.get(key) ?? null;
}

export interface PairMember {
  verb: string;
  reading: string;
  translation: string;
  transitive: boolean;
}

function member(verb: string): PairMember {
  const { reading, translation, transitive } = verbMap[verb];
  return { verb, reading, translation, transitive: transitive === true };
}

const partnerIndex = new Map<string, PairMember[]>();
function addPartner(verb: string, partner: string) {
  partnerIndex.set(verb, [...(partnerIndex.get(verb) ?? []), member(partner)]);
}

for (const [, { intransitive, transitive }] of pairList) {
  addPartner(intransitive, transitive);
  addPartner(transitive, intransitive);
}

const kanaTwins = new Map([['みえる', '見える'], ['きこえる', '聞こえる']]);

/** The verbs that form a pair with this one (起こす has two). */
export function partnersOf(verb: string): PairMember[] {
  return partnerIndex.get(kanaTwins.get(verb) ?? verb) ?? [];
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
  cue: string;
  cueNote?: string;
  correctAnswer: string;
  options: string[];
  intransitive: PairMember;
  transitive: PairMember;
}

function pickPair(
  entries: readonly PairEntry[],
  getWeight: (key: string) => number,
  random: () => number,
): PairEntry | null {
  if (entries.length === 0) return null;
  const weights = entries.map(([key]) => Math.max(0.01, getWeight(key)));
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
    prompt: sentence.ja.replace(PAIR_BLANK, PAIR_PROMPT_BLANK),
    filled: sentence.ja.replace(PAIR_BLANK, correct.value),
    english: sentence.en,
    cue: sentence.cue,
    cueNote: sentence.cueNote,
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
  const isTransitiveSide = question.side === 'transitive';
  const answer = isTransitiveSide ? question.transitive : question.intransitive;
  const other = isTransitiveSide ? question.intransitive : question.transitive;
  const note = question.cueNote ?? (isTransitiveSide
    ? 'marks the direct object of the action in this sentence.'
    : 'marks the subject whose action or state the sentence describes.');
  return `「${question.cue}」 ${note} Use ${answer.verb} (${pairMemberLabel(answer)}). `
    + `${other.verb} (${pairMemberLabel(other)}) means “${other.translation}”.`;
}

export function pairMemberLabel(member: PairMember): string {
  return member.transitive ? '他動詞' : '自動詞';
}

/** "開く／開ける" for stats and labels. */
export function pairLabel(pair: Pick<PairData, 'intransitive' | 'transitive'>): { words: string; readings: string } {
  const words = `${pair.intransitive}／${pair.transitive}`;
  const readings = `${verbMap[pair.intransitive].reading}／${verbMap[pair.transitive].reading}`;
  return { words, readings: words === readings ? '' : readings };
}
