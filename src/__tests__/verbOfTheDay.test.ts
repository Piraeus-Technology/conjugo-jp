import { getVerbOfTheDay, getVerbOfTheDayForKey } from '../utils/verbOfTheDay';
import verbData from '../data/verbs.json';

const verbs = ['verb-0', 'verb-1', 'verb-2', 'verb-3', 'verb-4'];

describe('verb of the day', () => {
  it('pins a deterministic verb to each local date', () => {
    expect(getVerbOfTheDayForKey(verbs, '2026-07-26')).toBe('verb-4');
    expect(getVerbOfTheDayForKey(verbs, '2026-07-27')).toBe('verb-2');
    expect(getVerbOfTheDayForKey(verbs, '2026-12-31')).toBe('verb-0');
  });

  it('uses the local date when it differs from the UTC date', () => {
    class DateWithEarlierLocalDay extends Date {
      getFullYear() {
        return 2026;
      }

      getMonth() {
        return 6;
      }

      getDate() {
        return 26;
      }
    }

    const afterUtcMidnight = new DateWithEarlierLocalDay('2026-07-27T00:30:00.000Z');

    expect(Math.floor(afterUtcMidnight.getTime() / 86_400_000) % verbs.length).toBe(1);
    expect(getVerbOfTheDay(verbs, afterUtcMidnight)).toBe(getVerbOfTheDayForKey(verbs, '2026-07-26'));
  });

  it('rejects an empty verb list or malformed day key', () => {
    expect(() => getVerbOfTheDayForKey([], '2026-07-26')).toThrow('empty list');
    expect(() => getVerbOfTheDayForKey(verbs, 'July 26')).toThrow('Invalid local day key');
  });

  it('visits every verb once per cycle while breaking consecutive file order', () => {
    const entries = Object.keys(verbData);
    const start = Date.UTC(2026, 9, 7);
    const selections = Array.from({ length: entries.length }, (_, index) =>
      getVerbOfTheDayForKey(entries, new Date(start + index * 86400000).toISOString().slice(0, 10)),
    );
    expect(new Set(selections).size).toBe(entries.length);
    for (let index = 1; index < 7; index++) {
      expect(Math.abs(entries.indexOf(selections[index]) - entries.indexOf(selections[index - 1]))).toBeGreaterThan(1);
    }
    const nextCycle = new Date(start + entries.length * 86400000).toISOString().slice(0, 10);
    expect(getVerbOfTheDayForKey(entries, nextCycle)).toBe(selections[0]);
  });
});
