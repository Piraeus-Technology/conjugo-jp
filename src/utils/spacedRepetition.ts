// Pure spaced-repetition maths. Deliberately free of zustand and AsyncStorage
// so pure-logic consumers (practiceInsights, tests) don't transitively pull in
// a native module.

export interface VerbWeightMap {
  [verb: string]: number;
}

export const DEFAULT_WEIGHT = 1;
export const MIN_WEIGHT = 0.2;
export const MAX_WEIGHT = 5;

// A verb's weight relaxes halfway back to DEFAULT_WEIGHT every half-life it
// goes unpractised. Without this, a mastered verb pinned at MIN_WEIGHT would
// never resurface and a verb missed once would stay inflated forever — the
// selection would be adaptive but not *spaced*.
export const WEIGHT_HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export function clampWeight(weight: number): number {
  return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, weight));
}

/**
 * The effective weight of a verb at `now`, given when it was last practised.
 * Pure — callers pass the clock so this stays testable.
 */
export function decayWeight(
  weight: number,
  lastPracticedAt: number | undefined,
  now: number,
  halfLifeMs: number = WEIGHT_HALF_LIFE_MS,
): number {
  if (!Number.isFinite(weight)) return DEFAULT_WEIGHT;
  if (
    lastPracticedAt === undefined ||
    !Number.isFinite(lastPracticedAt) ||
    lastPracticedAt <= 0 ||
    !Number.isFinite(halfLifeMs) ||
    halfLifeMs <= 0
  ) {
    return clampWeight(weight);
  }

  const elapsed = now - lastPracticedAt;
  if (elapsed <= 0) return clampWeight(weight);

  const remaining = Math.pow(0.5, elapsed / halfLifeMs);
  return clampWeight(DEFAULT_WEIGHT + (weight - DEFAULT_WEIGHT) * remaining);
}

export interface VerbWeightState {
  weights: VerbWeightMap;
  lastPracticedAt: VerbWeightMap;
}

/**
 * Apply an answer to a verb. The stored weight is decayed to `now` *before*
 * the correct/incorrect multiplier, so a month-stale weight doesn't compound.
 */
export function applyVerbResult(
  current: VerbWeightState,
  verb: string,
  correct: boolean,
  now: number,
  halfLifeMs: number = WEIGHT_HALF_LIFE_MS,
): VerbWeightState {
  const stored = current.weights[verb];
  const effective = decayWeight(
    Number.isFinite(stored) ? stored : DEFAULT_WEIGHT,
    current.lastPracticedAt[verb],
    now,
    halfLifeMs,
  );

  return {
    weights: {
      ...current.weights,
      [verb]: clampWeight(correct ? effective * 0.7 : effective * 1.5),
    },
    lastPracticedAt: { ...current.lastPracticedAt, [verb]: now },
  };
}

function parseNumberMap(value: unknown): VerbWeightMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: VerbWeightMap = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'number' && Number.isFinite(entry)) out[key] = entry;
  }
  return out;
}

export const SPACED_REP_SCHEMA_VERSION = 2;

/**
 * Reads both schemas. v1 was a bare `{ verb: weight }` map with no timestamps;
 * those entries are stamped as practised at `migratedAt` so an upgrade
 * preserves every learned weight and simply starts the decay clock from the
 * upgrade, rather than silently resetting everyone to DEFAULT_WEIGHT.
 */
export function parseStoredWeights(stored: string | null, migratedAt: number): VerbWeightState {
  if (!stored) return { weights: {}, lastPracticedAt: {} };

  const parsed = JSON.parse(stored) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { weights: {}, lastPracticedAt: {} };
  }

  const record = parsed as Record<string, unknown>;
  if (record.version === SPACED_REP_SCHEMA_VERSION) {
    const weights = parseNumberMap(record.weights);
    const lastPracticedAt = parseNumberMap(record.lastPracticedAt);
    // Drop timestamps with no surviving weight so the two maps can't drift.
    for (const key of Object.keys(lastPracticedAt)) {
      if (!(key in weights)) delete lastPracticedAt[key];
    }
    return { weights, lastPracticedAt };
  }

  const weights = parseNumberMap(record);
  const lastPracticedAt: VerbWeightMap = {};
  for (const key of Object.keys(weights)) lastPracticedAt[key] = migratedAt;
  return { weights, lastPracticedAt };
}

export function serializeWeights(state: VerbWeightState): string {
  return JSON.stringify({
    version: SPACED_REP_SCHEMA_VERSION,
    weights: state.weights,
    lastPracticedAt: state.lastPracticedAt,
  });
}
