import Fuse from 'fuse.js';
import { expandKanaLongVowels, foldHepburn, searchReadings } from './kana';
import { normalizeGlossQuery, searchGlosses } from './searchGlosses';
import { MAX_SEARCH_RESULTS } from './constants';
import { searchVerbsWithExactMatches, type SearchResult } from './verbSearch';
import {
  ADJECTIVE_FORM_LABELS,
  adjectiveForms,
  adjectiveList,
  adjectiveMap,
  conjugateAdjective,
  type AdjectiveClass,
  type AdjectiveData,
  type AdjectiveForm,
} from './adjectives';


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

const romajiAlias = (hiragana: string) => expandKanaLongVowels(foldHepburn(hiragana));

interface AdjectiveIndexItem {
  word: string;
  data: AdjectiveData;
}

const adjectiveItems = adjectiveList.map(([word, data]) => ({
  verb: word,
  reading: data.reading,
  translation: data.translation,
}));

const adjectiveGlosses = new Map(adjectiveList.map(([word, data]) => [word, searchGlosses(data.translation)]));

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
const romajiAliases = new Map<string, FormMatch[]>();

// Every form of every adjective, including the also-correct variants, keyed by
// reading (also folded to hiragana) and by kanji display.
function getFormIndex(): Map<string, FormMatch[]> {
  if (formIndex) return formIndex;
  const index = new Map<string, FormMatch[]>();
  const add = (map: Map<string, FormMatch[]>, key: string, match: FormMatch) => {
    const list = map.get(key) ?? [];
    if (!list.some(m => m.word === match.word && m.form === match.form)) list.push(match);
    map.set(key, list);
  };
  const addSpelling = (value: string, reading: string, match: FormMatch) => {
    const hiragana = toHiragana(reading);
    for (const key of new Set([value, reading, hiragana])) add(index, key, match);
    const alias = romajiAlias(hiragana);
    if (alias !== hiragana) add(romajiAliases, alias, match);
  };
  for (const [word, data] of adjectiveList) {
    addSpelling(word, data.reading, { word, data, form: null, shown: data.reading });
    for (const form of adjectiveForms(data)) {
      const result = conjugateAdjective(word, data, form);
      const spellings = [
        { value: result.value, reading: result.reading },
        ...result.alsoCorrect,
      ];
      for (const spelling of spellings) {
        const match = { word, data, form, shown: spelling.reading };
        addSpelling(spelling.value, spelling.reading, match);
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

interface AdjectiveMatches {
  dictionary: AdjectiveSearchResult[];
  gloss: AdjectiveSearchResult[];
  strong: AdjectiveSearchResult[];
  weak: AdjectiveSearchResult[];
}

export function searchAdjectives(
  query: string,
  passesFilters: (item: WordSearchResult) => boolean = () => true,
): AdjectiveMatches {
  const q = query.trim().normalize('NFKC').toLowerCase();
  const strong: AdjectiveSearchResult[] = [];
  const weak: AdjectiveSearchResult[] = [];
  const dictionary: AdjectiveSearchResult[] = [];
  const gloss: AdjectiveSearchResult[] = [];
  if (!q) return { dictionary, gloss, strong, weak };
  const seen = new Set<string>();
  const push = (list: AdjectiveSearchResult[], item: AdjectiveSearchResult) => {
    if (seen.has(item.verb) || !passesFilters(item)) return;
    seen.add(item.verb);
    list.push(item);
  };

  const { exact, prefixes } = searchReadings(q);
  const isRomaji = /^[a-z']+$/.test(q);
  const index = getFormIndex();
  const exactForms = [...new Set([q, ...exact])].flatMap(key => [
    ...(index.get(key) ?? []),
    ...(isRomaji ? romajiAliases.get(key) ?? [] : []),
  ]);
  for (const match of exactForms) {
    if (!match.form) push(dictionary, toResult(match.word, match.data, null));
  }
  const glossQuery = normalizeGlossQuery(q);
  for (const [word, data] of adjectiveList) {
    if (adjectiveGlosses.get(word)?.includes(glossQuery)) push(gloss, toResult(word, data, null));
  }
  for (const match of exactForms) {
    if (match.form) push(strong, toResult(match.word, match.data, match.form, match.shown));
  }

  if (prefixes.length) {
    adjectiveList
      .filter(([, data]) => {
        const reading = toHiragana(data.reading);
        return prefixes.some(prefix => reading.startsWith(prefix) ||
          (isRomaji && romajiAlias(reading).startsWith(prefix)));
      })
      .sort(([, a], [, b]) => beginnerFirst(a, b))
      .forEach(([word, data]) => push(weak, toResult(word, data, null)));
  }
  for (const { item } of adjectiveFuse.search(q)) {
    push(weak, toResult(item.verb, adjectiveMap[item.verb], null));
  }
  return { dictionary, gloss, strong, weak };
}

export function searchWords(
  query: string,
  passesFilters: (item: WordSearchResult) => boolean = () => true,
): WordSearchResult[] {
  const { results, dictionaryCount, glossCount, exactCount } = searchVerbsWithExactMatches(
    query, item => passesFilters({ ...item, kind: 'verb' }),
  );
  const verbs = results.map(item => ({ ...item, kind: 'verb' as const }));
  const { dictionary, gloss, strong, weak } = searchAdjectives(query, passesFilters);
  const q = query.trim().normalize('NFKC').toLowerCase();
  const exactAdjectives = [
    ...dictionary.sort((a, b) => b.jlpt.localeCompare(a.jlpt) || Number(b.verb === q) - Number(a.verb === q)),
    ...gloss.sort(beginnerFirst),
    ...strong.sort(beginnerFirst),
  ].slice(0, MAX_SEARCH_RESULTS);
  const combined: WordSearchResult[] = [...verbs];

  // Insert adjectives after verbs of the same or an easier level within each
  // match tier. Preserve the relative order of verb rows.
  for (const adjective of [...exactAdjectives].reverse()) {
    const [start, end] = dictionary.includes(adjective) ? [0, dictionaryCount]
      : gloss.includes(adjective) ? [dictionaryCount, glossCount] : [glossCount, exactCount];
    let index = end;
    while (index > start && (
      verbs[index - 1].jlpt < adjective.jlpt ||
      (start === 0 && dictionary.includes(adjective) && verbs[index - 1].jlpt === adjective.jlpt &&
        adjective.verb === q && verbs[index - 1].verb !== q)
    )) index--;
    combined.splice(index, 0, adjective);
  }
  return [...combined, ...weak.slice(0, MAX_SEARCH_RESULTS - exactAdjectives.length)];

}

// Adjectives that pass the browse filters, in data file order.
export function browseAdjectives(passesFilters: (item: WordSearchResult) => boolean): AdjectiveSearchResult[] {
  return adjectiveList
    .map(([word, data]) => toResult(word, data, null))
    .filter(passesFilters);
}
