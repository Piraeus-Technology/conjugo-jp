import adjectives from '../data/adjectives.json';
import { getConjugationIndex } from './verbSearch';
import type { JLPTLevel, VerbExample } from './conjugate';

// い-adjectives, な-adjectives and the copula だ/です. They live beside the verb
// engine. The combined word search indexes adjective forms alongside verbs.

export type AdjectiveClass = 'i' | 'na' | 'copula';

export type AdjectiveForm =
  | 'plain'
  | 'before_noun'
  | 'polite'
  | 'negative'
  | 'polite_negative'
  | 'past'
  | 'polite_past'
  | 'past_negative'
  | 'polite_past_negative'
  | 'te'
  | 'adverb'
  | 'conditional_ba'
  | 'conditional_tara';

export const ADJECTIVE_FORM_LABELS: Record<AdjectiveForm, { ja: string; en: string; meaning?: string }> = {
  plain: { ja: '普通形', en: 'Plain (だ)' },
  before_noun: { ja: '連体形', en: 'Before a Noun', meaning: 'describing a noun' },
  polite: { ja: '丁寧形', en: 'Polite' },
  negative: { ja: '否定形', en: 'Negative' },
  polite_negative: { ja: '丁寧否定形', en: 'Polite Negative' },
  past: { ja: '過去形', en: 'Past' },
  polite_past: { ja: '丁寧過去形', en: 'Polite Past' },
  past_negative: { ja: '過去否定形', en: 'Past Negative' },
  polite_past_negative: { ja: '丁寧過去否定形', en: 'Polite Past Neg.' },
  te: { ja: 'て形', en: 'Te-form', meaning: 'connective and' },
  adverb: { ja: '連用形', en: 'Adverb', meaning: 'how something is done' },
  conditional_ba: { ja: '仮定形', en: 'Conditional', meaning: 'if' },
  conditional_tara: { ja: 'たら形', en: 'Conditional (tara)', meaning: 'when / if' },
};

export const ALL_ADJECTIVE_FORMS = Object.keys(ADJECTIVE_FORM_LABELS) as AdjectiveForm[];

export const ADJECTIVE_CLASS_LABELS: Record<AdjectiveClass, { ja: string; en: string }> = {
  i: { ja: 'い形容詞', en: 'い-adjective' },
  na: { ja: 'な形容詞', en: 'な-adjective' },
  copula: { ja: 'だ・です', en: 'Copula' },
};

// The forms each class has. The dictionary form is the prompt, so it is never
// asked: for an い-adjective and the copula that is also the plain form.
export const CLASS_FORMS: Record<AdjectiveClass, AdjectiveForm[]> = {
  i: [
    'polite', 'negative', 'polite_negative', 'past', 'polite_past', 'past_negative',
    'polite_past_negative', 'te', 'adverb', 'conditional_ba', 'conditional_tara',
  ],
  na: [
    'plain', 'before_noun', 'polite', 'negative', 'polite_negative', 'past', 'polite_past',
    'past_negative', 'polite_past_negative', 'te', 'adverb', 'conditional_ba', 'conditional_tara',
  ],
  copula: [
    'polite', 'negative', 'polite_negative', 'past', 'polite_past', 'past_negative',
    'polite_past_negative', 'te', 'conditional_ba', 'conditional_tara',
  ],
};

export const ADJECTIVE_FORM_GROUPS: { title: string; titleJa: string; forms: AdjectiveForm[] }[] = [
  { title: 'Basic', titleJa: '基本', forms: ['plain', 'polite', 'past', 'polite_past'] },
  { title: 'Negative', titleJa: '否定', forms: ['negative', 'polite_negative', 'past_negative', 'polite_past_negative'] },
  { title: 'Connecting', titleJa: '接続', forms: ['before_noun', 'te', 'adverb'] },
  { title: 'Conditional', titleJa: '条件', forms: ['conditional_ba', 'conditional_tara'] },
];

export interface AdjectiveData {
  reading: string;
  class: AdjectiveClass;
  translation: string;
  jlpt: JLPTLevel;
  examples?: VerbExample[];
  note?: string;
  // 'ii': いい and its compounds build every form except the dictionary and
  // polite forms on よ-. Stored, never inferred: かわいい also ends in いい and is
  // regular.
  irregular?: 'ii';
  // Readings that replace the regular form for this word (同じ before a noun).
  overrides?: Partial<Record<AdjectiveForm, string>>;
  // Readings that are also correct for this word, beyond its class's variants.
  variants?: Partial<Record<AdjectiveForm, string[]>>;
  // A な-adjective that also exists as an い-adjective (真っ白 / 真っ白い), so
  // い-endings are real words here and must never be offered as mistakes.
  iTwin?: boolean;
}

export type AdjectiveEntry = [string, AdjectiveData];

export const adjectiveMap = adjectives as Record<string, AdjectiveData>;
export const adjectiveList: AdjectiveEntry[] = Object.entries(adjectiveMap);

// Learning data (spaced repetition, history, favorites) is keyed by the verb
// headword for verbs. Adjectives get their own namespace so the two can never
// share an entry, and no verb key changes.
const ADJECTIVE_KEY_PREFIX = 'adj:';

export function adjectiveKey(headword: string): string {
  return ADJECTIVE_KEY_PREFIX + headword;
}

export function parseAdjectiveKey(key: string): string | null {
  if (!key.startsWith(ADJECTIVE_KEY_PREFIX)) return null;
  const headword = key.slice(ADJECTIVE_KEY_PREFIX.length);
  return adjectiveMap[headword] ? headword : null;
}

const I_ENDINGS: Record<Exclude<AdjectiveForm, 'plain' | 'before_noun' | 'polite'>, string> = {
  negative: 'くない',
  polite_negative: 'くないです',
  past: 'かった',
  polite_past: 'かったです',
  past_negative: 'くなかった',
  polite_past_negative: 'くなかったです',
  te: 'くて',
  adverb: 'く',
  conditional_ba: 'ければ',
  conditional_tara: 'かったら',
};

const NA_ENDINGS: Record<AdjectiveForm, string> = {
  plain: 'だ',
  before_noun: 'な',
  polite: 'です',
  negative: 'じゃない',
  polite_negative: 'じゃないです',
  past: 'だった',
  polite_past: 'でした',
  past_negative: 'じゃなかった',
  polite_past_negative: 'じゃなかったです',
  te: 'で',
  adverb: 'に',
  conditional_ba: 'なら',
  conditional_tara: 'だったら',
};

const I_VARIANTS: Partial<Record<AdjectiveForm, string[]>> = {
  polite_negative: ['くありません'],
  polite_past_negative: ['くありませんでした'],
};

const NA_VARIANTS: Partial<Record<AdjectiveForm, string[]>> = {
  negative: ['ではない'],
  polite_negative: ['じゃありません', 'ではありません', 'ではないです'],
  past_negative: ['ではなかった'],
  polite_past_negative: ['じゃありませんでした', 'ではありませんでした', 'ではなかったです'],
  conditional_ba: ['ならば', 'であれば'],
};

export function adjectiveForms(data: AdjectiveData): AdjectiveForm[] {
  return CLASS_FORMS[data.class];
}

// The forms of a word that practice may ask, given the forms the learner chose.
export function practiceAdjectiveForms(data: AdjectiveData, active: readonly AdjectiveForm[]): AdjectiveForm[] {
  return CLASS_FORMS[data.class].filter(form => active.includes(form));
}

function hasForm(data: AdjectiveData, form: AdjectiveForm): boolean {
  return CLASS_FORMS[data.class].includes(form);
}

// Reading of the part an い-adjective's endings attach to: 高い → たか, いい → よ.
function iBaseReading(data: AdjectiveData): string {
  return data.irregular === 'ii' ? data.reading.slice(0, -2) + 'よ' : data.reading.slice(0, -1);
}

function iBaseDisplay(headword: string, data: AdjectiveData): string {
  return data.irregular === 'ii' ? headword.slice(0, -2) + 'よ' : headword.slice(0, -1);
}

function stemReading(data: AdjectiveData): string {
  return data.class === 'copula' ? '' : data.reading;
}

function stemDisplay(headword: string, data: AdjectiveData): string {
  return data.class === 'copula' ? '' : headword;
}

function requireForm(data: AdjectiveData, form: AdjectiveForm) {
  if (!hasForm(data, form)) {
    throw new Error(`${data.class} adjective has no ${form} form`);
  }
}

export function conjugateAdjectiveReading(data: AdjectiveData, form: AdjectiveForm): string {
  requireForm(data, form);
  const override = data.overrides?.[form];
  if (override) return override;
  if (data.class === 'i') {
    if (form === 'polite') return data.reading + 'です';
    return iBaseReading(data) + I_ENDINGS[form as keyof typeof I_ENDINGS];
  }
  return stemReading(data) + NA_ENDINGS[form];
}

// Readings that are also correct for this form. Shown beside the asked answer,
// and never offered as a wrong option.
export function alsoCorrectAdjectiveReadings(data: AdjectiveData, form: AdjectiveForm): string[] {
  requireForm(data, form);
  const own = data.variants?.[form] ?? [];
  const classVariants = data.class === 'i'
    ? (I_VARIANTS[form] ?? []).map(ending => iBaseReading(data) + ending)
    : (NA_VARIANTS[form] ?? []).map(ending => stemReading(data) + ending);
  return [...new Set([...own, ...classVariants])];
}

function displayFor(headword: string, data: AdjectiveData, reading: string): string {
  if (data.class === 'i') {
    if (reading === data.reading + 'です') return headword + 'です';
    const base = iBaseReading(data);
    if (reading.startsWith(base)) return iBaseDisplay(headword, data) + reading.slice(base.length);
    return reading;
  }
  const stem = stemReading(data);
  if (reading.startsWith(stem)) return stemDisplay(headword, data) + reading.slice(stem.length);
  return reading;
}

export interface AdjectiveConjugation {
  form: AdjectiveForm;
  labelJa: string;
  labelEn: string;
  value: string;
  reading: string;
  alsoCorrect: { value: string; reading: string }[];
}

export function conjugateAdjective(headword: string, data: AdjectiveData, form: AdjectiveForm): AdjectiveConjugation {
  const reading = conjugateAdjectiveReading(data, form);
  const labels = ADJECTIVE_FORM_LABELS[form];
  return {
    form,
    labelJa: labels.ja,
    labelEn: labels.en,
    value: displayFor(headword, data, reading),
    reading,
    alsoCorrect: alsoCorrectAdjectiveReadings(data, form).map(variant => ({
      value: displayFor(headword, data, variant),
      reading: variant,
    })),
  };
}

// Block other taught forms and common related forms so options test the rule
// for the question. Before a Noun deliberately tests the misuse of plain だ.
function grammaticalReadings(data: AdjectiveData): Set<string> {
  const out = new Set<string>([data.reading]);
  for (const form of CLASS_FORMS[data.class]) {
    out.add(conjugateAdjectiveReading(data, form));
    for (const variant of alsoCorrectAdjectiveReadings(data, form)) out.add(variant);
  }
  const r = data.reading;
  if (data.class === 'i') {
    const base = iBaseReading(data);
    for (const extra of [r + 'なら', r + 'の', r + 'んです', base + 'さ', base + 'そう', base + 'すぎる']) out.add(extra);
    if (data.irregular === 'ii') {
      const yoi = r.slice(0, -2) + 'よい';
      for (const extra of [yoi, yoi + 'です', yoi + 'なら']) out.add(extra);
    }
  } else {
    const stem = stemReading(data);
    const extras = data.class === 'copula'
      ? ['でない', 'であった', 'である', 'でございます', 'だろう', 'でしょう', 'でしたら', 'だったです']
      : ['なの', 'なら', 'さ', 'そう', 'でしたら', 'だったです', 'だな', 'だね', 'だよ', 'なる', 'でない', 'である'];
    for (const ending of extras) out.add(stem + ending);
  }
  return out;
}

// True for a な-adjective that a learner could mistake for an い-adjective
// because its reading ends in い (きれい, 有名). Read from the stored class.
export function isLookalike(data: AdjectiveData): boolean {
  return data.class === 'na' && /[いイ]$/.test(data.reading);
}

function iCandidates(data: AdjectiveData, form: AdjectiveForm): string[] {
  const r = data.reading;
  const b = iBaseReading(data);
  const lead = data.irregular === 'ii' && form !== 'polite'
    ? [r.slice(0, -1) + I_ENDINGS[form as keyof typeof I_ENDINGS]]
    : [];
  // No な-ending is ever put on the bare stem: several い-adjectives have a
  // な-twin (細かい / 細か, 暖かい / 暖か), whose 細かに or 暖かだった is real.
  const byForm: Record<AdjectiveForm, string[]> = {
    plain: [],
    before_noun: [],
    polite: [r + 'だです', b + 'くです', r + 'ます', r + 'いです'],
    negative: [r + 'じゃない', b + 'ない', r + 'くない', b + 'くじゃない', b + 'かない'],
    polite_negative: [b + 'くないだです', r + 'じゃないです', r + 'じゃありません', r + 'くないです'],
    past: [b + 'くた', r + 'だった', r + 'かった', b + 'かた'],
    polite_past: [r + 'でした', b + 'かったでした', r + 'かったです', b + 'かったます'],
    past_negative: [b + 'くないかった', r + 'じゃなかった', r + 'くなかった', b + 'くなかた'],
    polite_past_negative: [b + 'くないでした', r + 'じゃなかったです', b + 'くなかったでした', r + 'じゃありませんでした'],
    te: [b + 'くで', r + 'で', r + 'て', b + 'くって', b + 'て'],
    adverb: [r + 'に', b + 'くく', r + 'く', b + 'っく', b + 'くってに'],
    conditional_ba: [b + 'かれば', r + 'ければ', r + 'れば', b + 'くれば', b + 'くければ'],
    conditional_tara: [b + 'くたら', r + 'だったら', r + 'かったら', b + 'たら', b + 'かたら'],
  };
  if (form === 'adverb' && r === 'おおい') {
    // 大いに is a real adverb with the same reading.
    return byForm.adverb.slice(1);
  }
  return [...lead, ...byForm[form]];
}

function naCandidates(data: AdjectiveData, form: AdjectiveForm): string[] {
  const r = data.reading;
  // Treating the word as an い-adjective. For a look-alike that means dropping
  // its final い (きれい → きれくない); for any other な-adjective, adding the い
  // endings straight on (静か → 静かくない).
  const iBase = isLookalike(data) ? r.slice(0, -1) : r;
  const iEnding = !data.iTwin && form in I_ENDINGS ? I_ENDINGS[form as keyof typeof I_ENDINGS] : undefined;
  const asI = iEnding ? [iBase + iEnding] : [];
  const keepI = iEnding && isLookalike(data) ? [r + iEnding] : [];
  const plusI = data.iTwin ? [] : [r + 'い'];
  const byForm: Record<AdjectiveForm, string[]> = {
    plain: [...plusI, r + 'なだ', r + 'だだ', r + 'でだ'],
    before_noun: [r + 'の', r + 'だ', ...plusI, r + 'でな', r + 'なな'],
    polite: [r + 'だです', r + 'なです', r + 'でです', ...(data.iTwin ? [] : [r + 'いです'])],
    negative: [r + 'だじゃない', r + 'なじゃない', r + 'でじゃない'],
    polite_negative: [r + 'だじゃないです', r + 'なじゃないです', r + 'でじゃないです'],
    past: [r + 'なだった', r + 'のだった', r + 'だだった', r + 'でだった'],
    polite_past: [r + 'だったでした', r + 'なでした', r + 'だでした'],
    past_negative: [r + 'じゃないだった', r + 'じゃないかった', r + 'だじゃなかった'],
    polite_past_negative: [r + 'じゃないでした', r + 'じゃなかったでした', r + 'だじゃなかったです'],
    te: [r + 'だで', r + 'て', r + 'なで', r + 'でて'],
    adverb: [r + 'なに', r + 'だに', r + 'にく', r + 'でに'],
    conditional_ba: [r + 'だなら', r + 'れば', r + 'なれば', r + 'になら'],
    conditional_tara: [r + 'なったら', r + 'だたら', r + 'なだったら', r + 'でたら'],
  };
  const named = data.overrides?.before_noun && form === 'before_noun' ? [r + 'な'] : [];
  return [...named, ...asI, ...keepI, ...byForm[form]];
}

function copulaCandidates(form: AdjectiveForm): string[] {
  const byForm: Partial<Record<AdjectiveForm, string[]>> = {
    polite: ['だです', 'でです', 'ですだ'],
    negative: ['だじゃない', 'だない', 'じゃないだ'],
    polite_negative: ['だじゃないです', 'だないです', 'じゃないだです'],
    past: ['だた', 'だだった', 'だかった'],
    polite_past: ['だでした', 'だったでした', 'でしたです'],
    past_negative: ['じゃないだった', 'じゃないかった', 'だじゃなかった'],
    polite_past_negative: ['じゃないでした', 'じゃなかったでした', 'だじゃなかったです'],
    te: ['だて', 'だで', 'ですて'],
    conditional_ba: ['だなら', 'だれば', 'だければ', 'だば'],
    conditional_tara: ['だたら', 'だだったら', 'だかったら'],
  };
  return byForm[form] ?? [];
}

// Keep the closest available mistakes and filter out readings that are valid
// here or collide with verb forms. Every candidate is built for the asked form.
export function listAdjectiveDistractors(data: AdjectiveData, form: AdjectiveForm): string[] {
  requireForm(data, form);
  const blocked = grammaticalReadings(data);
  if (form === 'before_noun') blocked.delete(data.reading + 'だ');
  const verbForms = getConjugationIndex();
  const candidates = data.class === 'i'
    ? iCandidates(data, form)
    : data.class === 'na'
      ? naCandidates(data, form)
      : copulaCandidates(form);
  return [...new Set(candidates)].filter(candidate => (
    !blocked.has(candidate) &&
    !verbForms.has(candidate) &&
    !(data.overrides?.before_noun && candidate.startsWith(data.reading + 'の'))
  )).slice(0, 3);
}

function hintRule(headword: string, data: AdjectiveData, form: AdjectiveForm, answer: string): string {
  if (data.class === 'i') {
    if (form === 'polite') return `い-adjectives keep the final い and add です → ${answer}.`;
    if (data.irregular === 'ii') {
      const stem = iBaseReading(data);
      return `Use the ${stem}- stem and add ${I_ENDINGS[form as keyof typeof I_ENDINGS]} → ${answer}.`;
    }
    return `Drop the final い and add ${I_ENDINGS[form as keyof typeof I_ENDINGS]} → ${answer}.`;
  }

  if (data.class === 'copula') {
    return form === 'polite' ? 'だ becomes です in polite speech.' : `Change だ to ${answer}.`;
  }

  if (data.overrides?.before_noun && form === 'before_noun') {
    return `${headword} takes no な before a noun → ${answer} (${headword}本).`;
  }
  if (data.overrides?.adverb && form === 'adverb') {
    return `${headword} adds ように to form its adverb → ${answer}.`;
  }
  const finalI = data.reading.endsWith('イ') ? 'い (written イ)' : 'い';
  const lookalike = isLookalike(data)
    ? `${headword} is a な-adjective even though it ends in ${finalI}. `
    : '';
  return `${lookalike}な-adjectives add ${NA_ENDINGS[form]} → ${answer}.`;
}

function explainAdjectiveMistake(data: AdjectiveData, form: AdjectiveForm, picked: string): string {
  const r = data.reading;
  if (data.class === 'i' && form === 'polite_past') {
    if (picked === r + 'でした') return 'adds the past of です to the dictionary form';
    if (picked === iBaseReading(data) + 'かったでした') return 'marks the past twice with かった and でした';
    if (picked === r + 'かったです') return 'keeps the final い when adding かったです';
  }
  if (form === 'before_noun' && picked === r + 'だ') return 'uses the sentence-ending だ before a noun';
  return 'applies a different ending';
}

export function getAdjectiveHint(
  headword: string, data: AdjectiveData, form: AdjectiveForm, picked?: string,
): string {
  const rule = hintRule(headword, data, form, conjugateAdjectiveReading(data, form));
  if (picked && listAdjectiveDistractors(data, form).includes(picked)) {
    return `「${picked}」 ${explainAdjectiveMistake(data, form, picked)}. ${rule}`;
  }
  return rule;
}
