import verbs from '../data/verbs.json';
import type { VerbData } from './conjugate';
import { adjectiveMap, parseAdjectiveKey } from './adjectives';
import { pairLabel, parsePairKey } from './pairs';
import { DEFAULT_WEIGHT, decayWeight } from './spacedRepetition';

// jp spaced-repetition weights are keyed by the bare verb (the verbs.json
// kanji key), adj:<headword> for adjectives or pair:<intr>/<tr> for
// transitivity pairs, not by verb::tense::person like
// conjugo-es. So the only insight we can derive is which words the user
// struggles with most — there is no form/person dimension in the key to rank.
const verbMap = verbs as Record<string, VerbData>;

const WEAK_VERB_LIMIT = 5;
// A word sits at the default weight (1) until answered; weights climb above 1
// on misses and fall below on correct answers. Only weights > 1 are "weak".
// Weights are decayed to `now` before filtering. A weight slightly above 1
// can still appear here even when it rounds to 1.0 for display.

export interface WeakVerb {
  key: string; // spaced-repetition key
  verb: string; // headword shown to the learner
  reading: string;
  weight: number;
}

export interface PracticeInsights {
  weakVerbs: WeakVerb[];
}

function lookup(key: string): { verb: string; reading: string } | null {
  if (verbMap[key]) return { verb: key, reading: verbMap[key].reading };
  const adjective = parseAdjectiveKey(key);
  if (adjective) return { verb: adjective, reading: adjectiveMap[adjective].reading };
  const pair = parsePairKey(key);
  if (!pair) return null;
  const label = pairLabel(pair);
  return { verb: label.words, reading: label.readings };
}

export function buildPracticeInsights(
  weights: Record<string, number>,
  lastPracticedAt: Record<string, number> = {},
  now: number = Date.now(),
): PracticeInsights {
  const weakVerbs = Object.entries(weights)
    .map(([key, weight]) => ({
      key,
      word: lookup(key),
      weight: decayWeight(weight, lastPracticedAt[key], now),
    }))
    .filter(({ word, weight }) => weight > DEFAULT_WEIGHT && word !== null)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, WEAK_VERB_LIMIT)
    .map(({ key, word, weight }) => ({ key, verb: word!.verb, reading: word!.reading, weight }));

  return { weakVerbs };
}
