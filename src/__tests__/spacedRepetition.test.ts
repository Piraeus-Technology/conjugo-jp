import {
  DEFAULT_WEIGHT,
  MAX_WEIGHT,
  MIN_WEIGHT,
  WEIGHT_HALF_LIFE_MS,
  applyVerbResult,
  decayWeight,
  parseStoredWeights,
  serializeWeights,
} from '../utils/spacedRepetition';

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

describe('decayWeight', () => {
  test('is a no-op the moment a verb is practised', () => {
    expect(decayWeight(5, NOW, NOW)).toBe(5);
    expect(decayWeight(0.2, NOW, NOW)).toBe(0.2);
  });

  test('relaxes halfway to the default over one half-life', () => {
    expect(decayWeight(5, NOW - WEIGHT_HALF_LIFE_MS, NOW)).toBeCloseTo(3, 5);
    expect(decayWeight(0.2, NOW - WEIGHT_HALF_LIFE_MS, NOW)).toBeCloseTo(0.6, 5);
  });

  test('converges on the default rather than crossing it', () => {
    const farFuture = NOW + 3650 * DAY;
    expect(decayWeight(MAX_WEIGHT, NOW, farFuture)).toBeCloseTo(DEFAULT_WEIGHT, 5);
    expect(decayWeight(MIN_WEIGHT, NOW, farFuture)).toBeCloseTo(DEFAULT_WEIGHT, 5);
  });

  test('a mastered verb becomes eligible again instead of parking at the floor', () => {
    // The regression this whole change exists to prevent.
    const mastered = MIN_WEIGHT;
    expect(decayWeight(mastered, NOW, NOW)).toBe(MIN_WEIGHT);
    expect(decayWeight(mastered, NOW - 28 * DAY, NOW)).toBeGreaterThan(mastered);
    expect(decayWeight(mastered, NOW - 90 * DAY, NOW)).toBeGreaterThan(0.9);
  });

  test('falls back to the default for unusable input', () => {
    expect(decayWeight(Number.NaN, NOW, NOW)).toBe(DEFAULT_WEIGHT);
    expect(decayWeight(3, undefined, NOW)).toBe(3);
    expect(decayWeight(3, 0, NOW)).toBe(3);
    expect(decayWeight(3, Number.NaN, NOW)).toBe(3);
  });

  test('ignores a clock that has gone backwards', () => {
    expect(decayWeight(5, NOW, NOW - 10 * DAY)).toBe(5);
  });
});

describe('applyVerbResult', () => {
  const empty = { weights: {}, lastPracticedAt: {} };

  test('a first correct answer moves below the default and stamps the clock', () => {
    const next = applyVerbResult(empty, '書く', true, NOW);
    expect(next.weights.書く).toBeCloseTo(0.7, 5);
    expect(next.lastPracticedAt.書く).toBe(NOW);
  });

  test('a first miss moves above the default', () => {
    expect(applyVerbResult(empty, '書く', false, NOW).weights.書く).toBeCloseTo(1.5, 5);
  });

  test('decays before applying the multiplier, so stale weights do not compound', () => {
    const stale = { weights: { 書く: 5 }, lastPracticedAt: { 書く: NOW - WEIGHT_HALF_LIFE_MS } };
    // Decayed to 3 first, then halved-ish by the correct multiplier — not 5 * 0.7.
    expect(applyVerbResult(stale, '書く', true, NOW).weights.書く).toBeCloseTo(2.1, 5);
  });

  test('respects the clamps', () => {
    const hot = { weights: { 書く: MAX_WEIGHT }, lastPracticedAt: { 書く: NOW } };
    expect(applyVerbResult(hot, '書く', false, NOW).weights.書く).toBe(MAX_WEIGHT);
    const cold = { weights: { 書く: MIN_WEIGHT }, lastPracticedAt: { 書く: NOW } };
    expect(applyVerbResult(cold, '書く', true, NOW).weights.書く).toBe(MIN_WEIGHT);
  });

  test('does not mutate the input', () => {
    const state = { weights: { 書く: 2 }, lastPracticedAt: { 書く: NOW } };
    applyVerbResult(state, '書く', true, NOW + DAY);
    expect(state).toEqual({ weights: { 書く: 2 }, lastPracticedAt: { 書く: NOW } });
  });

  test('leaves other verbs untouched', () => {
    const state = { weights: { 書く: 2, 見る: 3 }, lastPracticedAt: { 書く: NOW, 見る: NOW } };
    const next = applyVerbResult(state, '書く', true, NOW);
    expect(next.weights.見る).toBe(3);
    expect(next.lastPracticedAt.見る).toBe(NOW);
  });
});

describe('parseStoredWeights', () => {
  test('migrates the v1 bare map, preserving weights', () => {
    const parsed = parseStoredWeights(JSON.stringify({ 書く: 4, 見る: 0.2 }), NOW);
    expect(parsed.weights).toEqual({ 書く: 4, 見る: 0.2 });
    expect(parsed.lastPracticedAt).toEqual({ 書く: NOW, 見る: NOW });
  });

  test('round-trips v2', () => {
    const state = { weights: { 書く: 4 }, lastPracticedAt: { 書く: NOW } };
    expect(parseStoredWeights(serializeWeights(state), NOW + DAY)).toEqual(state);
  });

  test('drops non-numeric and corrupt entries', () => {
    const parsed = parseStoredWeights(
      JSON.stringify({ version: 2, weights: { 書く: 4, bad: 'x', worse: null }, lastPracticedAt: {} }),
      NOW,
    );
    expect(parsed.weights).toEqual({ 書く: 4 });
  });

  test('drops timestamps whose weight did not survive', () => {
    const parsed = parseStoredWeights(
      JSON.stringify({ version: 2, weights: {}, lastPracticedAt: { 書く: NOW } }),
      NOW,
    );
    expect(parsed.lastPracticedAt).toEqual({});
  });

  test('returns empty state for missing or non-object payloads', () => {
    expect(parseStoredWeights(null, NOW)).toEqual({ weights: {}, lastPracticedAt: {} });
    expect(parseStoredWeights('[1,2,3]', NOW)).toEqual({ weights: {}, lastPracticedAt: {} });
    expect(parseStoredWeights('"nope"', NOW)).toEqual({ weights: {}, lastPracticedAt: {} });
  });
});
