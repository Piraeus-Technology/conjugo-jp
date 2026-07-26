import { dateToDayKey } from './dayKey';

const MS_PER_DAY = 86_400_000;
const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

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
  return entries[dayIndex];
}

export function getVerbOfTheDay<T>(entries: readonly T[], date: Date): T {
  return getVerbOfTheDayForKey(entries, dateToDayKey(date));
}
