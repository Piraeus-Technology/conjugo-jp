import { getVerbOfTheDay, getVerbOfTheDayForKey } from '../utils/verbOfTheDay';

const verbs = ['verb-0', 'verb-1', 'verb-2', 'verb-3', 'verb-4'];

describe('verb of the day', () => {
  it('pins a deterministic verb to each local date', () => {
    expect(getVerbOfTheDayForKey(verbs, '2026-07-26')).toBe('verb-0');
    expect(getVerbOfTheDayForKey(verbs, '2026-07-27')).toBe('verb-1');
    expect(getVerbOfTheDayForKey(verbs, '2026-12-31')).toBe('verb-3');
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
    expect(getVerbOfTheDay(verbs, afterUtcMidnight)).toBe('verb-0');
  });

  it('rejects an empty verb list or malformed day key', () => {
    expect(() => getVerbOfTheDayForKey([], '2026-07-26')).toThrow('empty list');
    expect(() => getVerbOfTheDayForKey(verbs, 'July 26')).toThrow('Invalid local day key');
  });
});
