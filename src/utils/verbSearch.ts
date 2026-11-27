import Fuse from 'fuse.js';
import verbs from '../data/verbs.json';
import { expandKanaLongVowels, foldHepburn, searchReadings } from './kana';
import { normalizeGlossQuery, searchGlosses } from './searchGlosses';
import { MAX_SEARCH_RESULTS } from './constants';
import {
  availableForms, conjugateReading, deriveKanjiForm, ALL_FORMS, FORM_LABELS,
  type VerbData, type ConjugationForm,
} from './conjugate';

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

const exactGlosses = new Map<string, typeof searchData>();
for (const item of searchData) {
  for (const gloss of new Set(searchGlosses(item.translation))) {
    const matches = exactGlosses.get(gloss) ?? [];
    matches.push(item);
    exactGlosses.set(gloss, matches);
  }
}

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
      };
      const hepburn = expandKanaLongVowels(foldHepburn(reading));
      if (hepburn !== reading) {
        const aliases = hepburnAliases.get(hepburn) ?? [];
        aliases.push(match);
        hepburnAliases.set(hepburn, aliases);
      }
      const alternateSpellings = data.searchAliases?.map(alias => deriveKanjiForm(alias, data.reading, reading)) ?? [];
      for (const key of new Set([reading, kanji, ...alternateSpellings])) {
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
  passesFilters?: (item: SearchResult) => boolean,
): SearchResult[] {
  return searchVerbsWithExactMatches(query, passesFilters).results;
}

interface VerbMatches {
  results: SearchResult[];
  dictionaryCount: number;
  glossCount: number;
  exactCount: number;
}

export function searchVerbsWithExactMatches(
  query: string,
  passesFilters: (item: SearchResult) => boolean = () => true,
): VerbMatches {
  const q = query.trim().normalize('NFKC').toLowerCase();
  if (!q) return { results: [], dictionaryCount: 0, glossCount: 0, exactCount: 0 };
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
    if (match.form === 'dictionary') {
      addVerb({ verb: match.verb, reading: match.reading, translation: match.translation, jlpt, group, transitive });
      return;
    }
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

  const fuzzy = fuse.search(q);
  function addVerb(item: typeof searchData[number]) {
    add({ ...item, matchType: 'verb' });
  }

  const exactForms = [...new Set([...exact, q])].flatMap(key => [
    ...(byForm.get(key) ?? []),
    ...(isRomaji ? hepburnAliases.get(key) ?? [] : []),
  ]);
  const levels = (match: ConjMatch) => (verbs as Record<string, VerbData>)[match.verb].jlpt;
  exactForms.filter(match => match.form === 'dictionary')
    .sort((a, b) => levels(b).localeCompare(levels(a)) || Number(b.verb === q) - Number(a.verb === q))
    .forEach(addForm);
  const dictionaryCount = Math.min(results.length, MAX_SEARCH_RESULTS);

  const glosses = exactGlosses.get(normalizeGlossQuery(q)) ?? [];
  // Keep Fuse's relative order where it found the same glosses, including the
  // long-standing ordering of entries with identical English translations.
  const remainingGlosses = new Set(glosses);
  for (const { item } of fuzzy) {
    if (remainingGlosses.delete(item)) addVerb(item);
  }
  remainingGlosses.forEach(addVerb);
  const glossCount = Math.min(results.length, MAX_SEARCH_RESULTS);

  exactForms.filter(match => match.form !== 'dictionary').forEach(addForm);
  const exactCount = Math.min(results.length, MAX_SEARCH_RESULTS);
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
  return { results: results.slice(0, MAX_SEARCH_RESULTS), dictionaryCount, glossCount, exactCount };
}
