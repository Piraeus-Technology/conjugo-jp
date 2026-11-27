import Fuse from 'fuse.js';
import { searchReadings } from './kana';
import { MAX_SEARCH_RESULTS } from './constants';
import { searchVerbs, type SearchResult } from './verbSearch';
import {
  ADJECTIVE_FORM_LABELS,
  adjectiveForms,
  adjectiveList,
  conjugateAdjective,
  type AdjectiveClass,
  type AdjectiveData,
  type AdjectiveForm,
} from './adjectives';

// Search across verbs and adjectives. Verb results come from searchVerbs
// unchanged and keep their order; adjectives are added around them.

export type AdjectiveGroup = 'i-adjective' | 'na-adjective' | 'copula';

export const ADJECTIVE_GROUP: Record<AdjectiveClass, AdjectiveGroup> = {
  i: 'i-adjective',
  na: 'na-adjective',
  copula: 'copula',
};

export interface AdjectiveSearchResult {
  kind: 'adjective';
  /** The adjective's headword. Named `verb` so result rows share one shape. */
  verb: string;
  reading: string;
  translation: string;
  jlpt: string;
  group: AdjectiveGroup;
  transitive?: undefined;
  matchType: 'verb' | 'conjugation';
  matchDetail?: string;
  matchForm?: AdjectiveForm;
}

export type WordSearchResult = (SearchResult & { kind: 'verb' }) | AdjectiveSearchResult;

const toHiragana = (text: string) =>
  text.replace(/[ァ-ヶ]/g, kana => String.fromCharCode(kana.charCodeAt(0) - 0x60));

interface AdjectiveIndexItem {
  word: string;
  data: AdjectiveData;
}

const adjectiveItems = adjectiveList.map(([word, data]) => ({
  verb: word,
  reading: data.reading,
  translation: data.translation,
}));

const adjectiveFuse = new Fuse(adjectiveItems, {
  keys: [
    { name: 'verb', weight: 3 },
    { name: 'reading', weight: 2 },
    { name: 'translation', weight: 1 },
  ],
  threshold: 0.3,
  ignoreLocation: true,
});

interface FormMatch extends AdjectiveIndexItem {
  form: AdjectiveForm | null; // null = the dictionary form
  shown: string;
}

let formIndex: Map<string, FormMatch[]> | null = null;

// Every form of every adjective, including the also-correct variants, keyed by
// reading (also folded to hiragana) and by kanji display.
function getFormIndex(): Map<string, FormMatch[]> {
  if (formIndex) return formIndex;
  const index = new Map<string, FormMatch[]>();
  const add = (key: string, match: FormMatch) => {
    const list = index.get(key) ?? [];
    if (!list.some(m => m.word === match.word && m.form === match.form)) list.push(match);
    index.set(key, list);
  };
  for (const [word, data] of adjectiveList) {
    for (const key of new Set([word, data.reading, toHiragana(data.reading)])) {
      add(key, { word, data, form: null, shown: data.reading });
    }
    for (const form of adjectiveForms(data)) {
      const result = conjugateAdjective(word, data, form);
      const spellings = [
        { value: result.value, reading: result.reading },
        ...result.alsoCorrect,
      ];
      for (const spelling of spellings) {
        const match = { word, data, form, shown: spelling.reading };
        for (const key of new Set([spelling.value, spelling.reading, toHiragana(spelling.reading)])) add(key, match);
      }
    }
  }
  formIndex = index;
  return index;
}

function toResult(word: string, data: AdjectiveData, form: AdjectiveForm | null, shown?: string): AdjectiveSearchResult {
  const base: AdjectiveSearchResult = {
    kind: 'adjective',
    verb: word,
    reading: data.reading,
    translation: data.translation,
    jlpt: data.jlpt,
    group: ADJECTIVE_GROUP[data.class],
    matchType: 'verb',
  };
  if (!form) return base;
  const label = ADJECTIVE_FORM_LABELS[form];
  return {
    ...base,
    matchType: 'conjugation',
    matchDetail: `「${shown}」— ${label.ja} (${label.en})`,
    matchForm: form,
  };
}

const beginnerFirst = (a: { jlpt: string; reading: string }, b: { jlpt: string; reading: string }) =>
  b.jlpt.localeCompare(a.jlpt) || a.reading.length - b.reading.length;

function glossMatches(translation: string, q: string): boolean {
  return translation
    .toLowerCase()
    .split(/[;,]/)
    .map(part => part.replace(/\(.*?\)/g, '').trim())
    .includes(q);
}

export function searchAdjectives(
  query: string,
  passesFilters: (item: WordSearchResult) => boolean = () => true,
): { strong: AdjectiveSearchResult[]; weak: AdjectiveSearchResult[] } {
  const q = query.trim().normalize('NFKC').toLowerCase();
  const strong: AdjectiveSearchResult[] = [];
  const weak: AdjectiveSearchResult[] = [];
  if (!q) return { strong, weak };
  const seen = new Set<string>();
  const push = (list: AdjectiveSearchResult[], item: AdjectiveSearchResult) => {
    if (seen.has(item.verb) || !passesFilters(item)) return;
    seen.add(item.verb);
    list.push(item);
  };

  const { exact, prefixes } = searchReadings(q);
  const index = getFormIndex();
  for (const key of new Set([q, ...exact])) {
    for (const match of index.get(key) ?? []) push(strong, toResult(match.word, match.data, match.form, match.shown));
  }
  for (const [word, data] of adjectiveList) {
    if (glossMatches(data.translation, q)) push(strong, toResult(word, data, null));
  }

  if (prefixes.length) {
    adjectiveList
      .filter(([, data]) => prefixes.some(prefix => toHiragana(data.reading).startsWith(prefix)))
      .sort(([, a], [, b]) => beginnerFirst(a, b))
      .forEach(([word, data]) => push(weak, toResult(word, data, null)));
  }
  for (const { item } of adjectiveFuse.search(q)) {
    const data = adjectiveList.find(([word]) => word === item.verb)![1];
    push(weak, toResult(item.verb, data, null));
  }
  return { strong, weak };
}

export function searchWords(
  query: string,
  passesFilters: (item: WordSearchResult) => boolean = () => true,
): WordSearchResult[] {
  const verbs: WordSearchResult[] = searchVerbs(query, item => passesFilters({ ...item, kind: 'verb' }))
    .map(item => ({ ...item, kind: 'verb' as const }));
  const { strong, weak } = searchAdjectives(query, passesFilters);
  return [...strong, ...verbs, ...weak].slice(0, MAX_SEARCH_RESULTS);
}

// Adjectives that pass the browse filters, beginner levels first.
export function browseAdjectives(passesFilters: (item: WordSearchResult) => boolean): AdjectiveSearchResult[] {
  return adjectiveList
    .map(([word, data]) => toResult(word, data, null))
    .filter(passesFilters);
}
