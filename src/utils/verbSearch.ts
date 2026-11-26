import Fuse from 'fuse.js';
import verbs from '../data/verbs.json';
import { searchReadings } from './kana';
import { MAX_SEARCH_RESULTS } from './constants';
import {
  availableForms, conjugateReading, deriveKanjiForm, ALL_FORMS, FORM_LABELS,
  type VerbData, type ConjugationForm,
} from './conjugate';

function foldHepburn(reading: string): string {
  return reading.replace(/づ/g, 'ず').replace(/ぢ/g, 'じ');
}

export const verbList = Object.entries(verbs as Record<string, VerbData>);

// Build search index
const searchData = verbList.map(([verb, data]) => ({
  verb,
  reading: data.reading,
  translation: data.translation,
  jlpt: data.jlpt,
  group: data.group,
  transitive: data.transitive,
}));

const fuse = new Fuse(searchData, {
  keys: [
    { name: 'verb', weight: 3 },
    { name: 'reading', weight: 2 },
    { name: 'translation', weight: 1 },
  ],
  threshold: 0.3,
  ignoreLocation: true,
});

// Lazy-built conjugation index — only created on first conjugated form search
interface ConjMatch {
  verb: string;
  reading: string;
  translation: string;
  form: ConjugationForm;
  conjugated: string;
  conjugatedKanji: string;
}

const hepburnAliases = new Map<string, ConjMatch[]>();
let conjugationIndex: Map<string, ConjMatch[]> | null = null;

export function getConjugationIndex(): Map<string, ConjMatch[]> {
  if (conjugationIndex) return conjugationIndex;
  conjugationIndex = new Map();
  verbList.forEach(([verb, data]) => {
    availableForms(data, ALL_FORMS).forEach((form) => {
      const reading = conjugateReading(data, form);
      const kanji = deriveKanjiForm(verb, data.reading, reading);
      const match: ConjMatch = {
        verb,
        reading: data.reading,
        translation: data.translation,
        form,
        conjugated: reading,
        conjugatedKanji: kanji,
      };
      const hepburn = foldHepburn(reading);
      if (hepburn !== reading) {
        const aliases = hepburnAliases.get(hepburn) ?? [];
        aliases.push(match);
        hepburnAliases.set(hepburn, aliases);
      }
      for (const key of new Set([reading, kanji])) {
        const current = conjugationIndex!.get(key) ?? [];
        current.push(match);
        conjugationIndex!.set(key, current);
      }
    });
  });
  return conjugationIndex;
}

export interface SearchResult {
  verb: string;
  reading: string;
  translation: string;
  jlpt: string;
  group: string;
  transitive?: boolean;
  matchType: 'verb' | 'conjugation';
  matchDetail?: string;
  matchForm?: ConjugationForm;
}

const beginnerFirst = (a: typeof searchData[number], b: typeof searchData[number]) =>
  b.jlpt.localeCompare(a.jlpt) || a.reading.length - b.reading.length;

export function searchVerbs(
  query: string,
  passesFilters: (item: SearchResult) => boolean = () => true,
): SearchResult[] {
  const q = query.trim().normalize('NFKC').toLowerCase();
  if (!q) return [];
  const isRomaji = /^[a-z']+$/.test(q);
  const { exact, prefixes } = searchReadings(q);
  const byForm = getConjugationIndex();
  const seen = new Set<string>();
  const results: SearchResult[] = [];

  function add(item: SearchResult) {
    if (!seen.has(item.verb) && passesFilters(item)) {
      seen.add(item.verb);
      results.push(item);
    }
  }

  function addForm(match: ConjMatch) {
    const { jlpt, group, transitive } = (verbs as Record<string, VerbData>)[match.verb];
    const label = FORM_LABELS[match.form];
    add({
      verb: match.verb,
      reading: match.reading,
      translation: match.translation,
      jlpt, group, transitive,
      matchType: 'conjugation',
      matchDetail: `「${match.conjugated}」— ${label.ja} (${label.en})`,
      matchForm: match.form,
    });
  }

  const exactKeys = new Set([...exact, q]);
  for (const key of exactKeys) {
    for (const match of byForm.get(key) ?? []) addForm(match);
    if (isRomaji) {
      for (const match of hepburnAliases.get(key) ?? []) addForm(match);
    }
  }

  const fuzzy = fuse.search(q);
  function addVerb(item: typeof searchData[number]) {
    add({ ...item, matchType: 'verb' });
  }

  // Preserve strong English matches when a word is also a reading prefix.
  for (const { item } of fuzzy) {
    const gloss = item.translation.toLowerCase();
    if (gloss === q || gloss === `to ${q}`) addVerb(item);
  }

  const matchingReadings = searchData.filter(item =>
    prefixes.some(prefix => item.reading.startsWith(prefix) ||
      (isRomaji && foldHepburn(item.reading).startsWith(prefix))),
  ).sort(beginnerFirst);
  for (const item of matchingReadings) addVerb(item);

  // The pre-ます stem can differ from the dictionary reading.
  if (prefixes.length && results.length < MAX_SEARCH_RESULTS) {
    const matchingStems = searchData.filter(item => {
      if (seen.has(item.verb)) return false;
      const stem = conjugateReading((verbs as Record<string, VerbData>)[item.verb], 'masu').slice(0, -2);
      return prefixes.some(prefix => stem.startsWith(prefix));
    }).sort(beginnerFirst);
    for (const item of matchingStems) addVerb(item);
  }

  for (const { item } of fuzzy) addVerb(item);
  for (const key of exact) {
    if (key === q) continue;
    for (const { item } of fuse.search(key)) addVerb(item);
  }
  return results.slice(0, MAX_SEARCH_RESULTS);
}
