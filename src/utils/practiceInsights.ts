import verbs from '../data/verbs.json';
import type { VerbData } from './conjugate';
import { DEFAULT_WEIGHT, decayWeight } from './spacedRepetition';

// jp spaced-repetition weights are keyed by the bare verb (the verbs.json
// kanji key), not by verb::tense::person like conjugo-es. So the only insight
// we can derive is which verbs the user struggles with most — there is no
// form/person dimension in the key to rank.
const verbMap = verbs as Record<string, VerbData>;

const WEAK_VERB_LIMIT = 5;
// A verb sits at the default weight (1) until answered; weights climb above 1
// on misses and fall below on correct answers. Only weights > 1 are "weak".
// Weights are decayed to `now` first so this list agrees with what selection
// actually favours — a verb missed months ago has relaxed back toward 1 and is
// no longer a weak area.

export interface WeakVerb {
  verb: string; // kanji key
  reading: string;
  weight: number;
}

export interface PracticeInsights {
  weakVerbs: WeakVerb[];
}

export function buildPracticeInsights(
  weights: Record<string, number>,
  lastPracticedAt: Record<string, number> = {},
  now: number = Date.now(),
): PracticeInsights {
  const weakVerbs = Object.entries(weights)
    .map(([verb, weight]) => ({
      verb,
      weight: decayWeight(weight, lastPracticedAt[verb], now),
    }))
    .filter(({ verb, weight }) => weight > DEFAULT_WEIGHT && verbMap[verb])
    .sort((a, b) => b.weight - a.weight)
    .slice(0, WEAK_VERB_LIMIT)
    .map(({ verb, weight }) => ({
      verb,
      reading: verbMap[verb].reading,
      weight,
    }));

  return { weakVerbs };
}
