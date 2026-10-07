import { dateToDayKey } from './dayKey';

const MS_PER_DAY = 86_400_000;
const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const permutations = new Map<number, number[]>();

function shuffledIndices(length: number): number[] {
  const cached = permutations.get(length);
  if (cached) return cached;
  const indices = Array.from({ length }, (_, index) => index);
  let seed = (0x9e3779b9 ^ length) >>> 0;
  for (let index = length - 1; index > 0; index--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const other = Math.floor((seed / 0x100000000) * (index + 1));
    [indices[index], indices[other]] = [indices[other], indices[index]];
  }
  permutations.set(length, indices);
  return indices;
}

export function getVerbOfTheDayForKey<T>(entries: readonly T[], dayKey: string): T {
  if (entries.length === 0) {
    throw new Error('Cannot select a verb of the day from an empty list');
  }

  const match = DAY_KEY_PATTERN.exec(dayKey);
  if (!match) {
    throw new Error(`Invalid local day key: ${dayKey}`);
  }

  const [, year, month, day] = match;
  // The timezone decision has already been made when the local day key was
  // created. Date.UTC only turns those calendar components into a stable day
  // ordinal without applying the runtime's timezone a second time.
  const dayNumber = Math.floor(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
  ) / MS_PER_DAY);
  const dayIndex = ((dayNumber % entries.length) + entries.length) % entries.length;
  return entries[shuffledIndices(entries.length)[dayIndex]];
}

export function getVerbOfTheDay<T>(entries: readonly T[], date: Date): T {
  return getVerbOfTheDayForKey(entries, dateToDayKey(date));
}
