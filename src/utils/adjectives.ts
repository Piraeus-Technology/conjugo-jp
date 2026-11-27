import adjectives from '../data/adjectives.json';
import type { JLPTLevel, VerbExample } from './conjugate';

// い-adjectives, な-adjectives and the copula だ/です. They live beside the verb
// engine rather than inside it: verbs keep their 18-form set, and nothing here
// changes how a verb conjugates, is quizzed or is searched.

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

// Shown in the table, never practised: the answer is the headword plus です and
// no realistic wrong rule produces three distinct mistakes for it.
const NOT_PRACTISED: Record<AdjectiveClass, AdjectiveForm[]> = {
  i: ['polite'],
  na: [],
  copula: ['polite'],
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
  const skip = NOT_PRACTISED[data.class];
  return CLASS_FORMS[data.class].filter(form => active.includes(form) && !skip.includes(form));
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

// Every reading of this word that is grammatical somewhere, so none of them can
// be offered as a wrong option. Includes forms the app does not teach.
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
  return data.class === 'na' && data.reading.endsWith('い');
}

// The one mistake the "Why?" hint names, which is therefore always offered.
export function hintedAdjectiveMistake(data: AdjectiveData, form: AdjectiveForm): string | undefined {
  requireForm(data, form);
  const r = data.reading;
  if (data.class === 'i') {
    if (data.irregular === 'ii' && form !== 'polite') {
      return r.slice(0, -1) + I_ENDINGS[form as keyof typeof I_ENDINGS];
    }
    if (form === 'polite_past') return r + 'でした';
    if (form === 'polite_past_negative') return iBaseReading(data) + 'くないでした';
    return undefined;
  }
  if (data.class === 'copula') {
    return form === 'polite_past_negative' ? 'じゃないでした' : undefined;
  }
  if (data.overrides?.before_noun && form === 'before_noun') return r + 'な';
  if (isLookalike(data) && form in I_ENDINGS) {
    return r.slice(0, -1) + I_ENDINGS[form as keyof typeof I_ENDINGS];
  }
  if (form === 'before_noun') return r + 'の';
  if (form === 'polite') return r + 'だです';
  if (form === 'polite_past_negative') return r + 'じゃないでした';
  return undefined;
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
    polite: [b + 'くです', r + 'だです', r + 'ます'],
    negative: [r + 'じゃない', r + 'くない', b + 'ない'],
    polite_negative: [r + 'じゃないです', r + 'じゃありません', r + 'くないです'],
    past: [r + 'だった', r + 'かった', b + 'くた'],
    polite_past: [r + 'でした', b + 'かったでした', r + 'かったです'],
    past_negative: [r + 'じゃなかった', b + 'くないかった', r + 'くなかった'],
    polite_past_negative: [b + 'くないでした', r + 'じゃなかったです', b + 'くなかったでした', r + 'じゃありませんでした'],
    te: [r + 'で', r + 'て', b + 'くで', b + 'て'],
    adverb: [r + 'に', r + 'く', b + 'くに'],
    conditional_ba: [r + 'ければ', b + 'かれば', r + 'れば', b + 'くれば'],
    conditional_tara: [r + 'だったら', r + 'かったら', b + 'くたら', b + 'たら'],
  };
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
    plain: [...plusI, r + 'なだ', r + 'の', r + 'のだ'],
    // 〜だ is the plain form, but "だ before a noun" is the classic mistake here
    // and can never be read as the form that describes a noun.
    before_noun: [r + 'の', r + 'だ', ...plusI, r + 'だの'],
    polite: [r + 'だです', r + 'なです', r + 'のです', ...(data.iTwin ? [] : [r + 'いです'])],
    negative: [r + 'ない', r + 'だじゃない', r + 'なじゃない'],
    polite_negative: [r + 'だじゃないです', r + 'なじゃないです', r + 'ないです'],
    past: [r + 'なだった', r + 'のだった', r + 'だだった'],
    polite_past: [r + 'だったでした', r + 'なでした', r + 'だでした'],
    past_negative: [r + 'じゃないだった', r + 'じゃないかった', r + 'だじゃなかった'],
    polite_past_negative: [r + 'じゃないでした', r + 'じゃなかったでした', r + 'だじゃなかったです'],
    te: [r + 'だで', r + 'て', r + 'なで'],
    adverb: [r + 'なに', r + 'だに', r + 'のに'],
    conditional_ba: [r + 'だなら', r + 'れば', r + 'なれば'],
    conditional_tara: [r + 'なったら', r + 'だたら', r + 'なだったら'],
  };
  const named = data.overrides?.before_noun && form === 'before_noun' ? [r + 'な'] : [];
  return [...named, ...asI, ...keepI, ...byForm[form]];
}

function copulaCandidates(form: AdjectiveForm): string[] {
  const byForm: Partial<Record<AdjectiveForm, string[]>> = {
    polite: ['だです', 'でです', 'だます'],
    negative: ['だじゃない', 'だない', 'じゃないだ', 'くない'],
    polite_negative: ['だじゃないです', 'だないです', 'じゃないだです'],
    past: ['だた', 'だだった', 'かった'],
    polite_past: ['だでした', 'だったでした', 'でしたです'],
    past_negative: ['じゃないだった', 'じゃないかった', 'だじゃなかった', 'くなかった'],
    polite_past_negative: ['じゃないでした', 'じゃなかったでした', 'だじゃなかったです'],
    te: ['だて', 'だで', 'て', 'くて'],
    conditional_ba: ['だなら', 'だれば', 'ければ', 'だば'],
    conditional_tara: ['だたら', 'だだったら', 'かったら'],
  };
  return byForm[form] ?? [];
}

// Wrong options for a question, closest mistakes first. Every option is the
// same form of the same word built with a wrong rule, so no option can be ruled
// out from its stem. The quiz takes the first three.
export function listAdjectiveDistractors(data: AdjectiveData, form: AdjectiveForm): string[] {
  requireForm(data, form);
  const blocked = grammaticalReadings(data);
  const candidates = data.class === 'i'
    ? iCandidates(data, form)
    : data.class === 'na'
      ? naCandidates(data, form)
      : copulaCandidates(form);
  const hinted = hintedAdjectiveMistake(data, form);
  const ordered = hinted ? [hinted, ...candidates] : candidates;
  const out: string[] = [];
  for (const candidate of ordered) {
    if (!candidate || blocked.has(candidate) || out.includes(candidate)) continue;
    out.push(candidate);
  }
  if (out.length < 3) {
    // Last resort: another form of the same word. It is never an also-correct
    // variant of the asked form, so it is still unambiguously wrong.
    const answer = conjugateAdjectiveReading(data, form);
    const accepted = new Set([answer, ...alsoCorrectAdjectiveReadings(data, form)]);
    for (const other of CLASS_FORMS[data.class]) {
      if (out.length >= 3) break;
      const reading = conjugateAdjectiveReading(data, other);
      if (!accepted.has(reading) && !out.includes(reading)) out.push(reading);
    }
  }
  return out;
}

function hintRule(headword: string, data: AdjectiveData, form: AdjectiveForm, answer: string): string {
  const mistake = hintedAdjectiveMistake(data, form);
  const not = mistake ? `, not ${mistake}` : '';
  if (data.class === 'i') {
    if (data.irregular === 'ii') {
      if (form === 'polite') return `${headword} keeps いい in the polite form: ${answer}.`;
      return `${headword} is irregular: every form except ${headword} and ${headword}です is built on よ-. Use ${answer}${not}.`;
    }
    switch (form) {
      case 'polite': return `い-adjectives keep い and add です: ${answer}.`;
      case 'negative': return `い-adjectives: drop い and add くない → ${answer}.`;
      case 'polite_negative': return `い-adjectives: drop い and add くないです → ${answer} (くありません is also correct).`;
      case 'past': return `い-adjectives: drop い and add かった → ${answer}.`;
      case 'polite_past': return `い-adjectives don't take でした. Drop い and add かったです → ${answer}${not}.`;
      case 'past_negative': return `い-adjectives: drop い and add くなかった → ${answer}.`;
      case 'polite_past_negative': return `い-adjectives: drop い and add くなかったです → ${answer}${not} (くありませんでした is also correct).`;
      case 'te': return `い-adjectives: drop い and add くて → ${answer}.`;
      case 'adverb': return `い-adjectives: drop い and add く → ${answer}.`;
      case 'conditional_ba': return `い-adjectives: drop い and add ければ → ${answer}.`;
      case 'conditional_tara': return `い-adjectives: drop い and add かったら → ${answer}.`;
      default: return `Use the い-adjective endings: ${answer}.`;
    }
  }

  if (data.class === 'copula') {
    switch (form) {
      case 'polite': return 'だ becomes です in polite speech.';
      case 'negative': return `だ → ${answer} (ではない is also correct).`;
      case 'polite_negative': return `だ → ${answer} (じゃありません and ではありません are also correct).`;
      case 'past': return `だ → ${answer}.`;
      case 'polite_past': return `だ → ${answer}, the past of です.`;
      case 'past_negative': return `だ → ${answer} (ではなかった is also correct).`;
      case 'polite_past_negative': return `だ → ${answer}${not} (じゃありませんでした is also correct).`;
      case 'te': return `だ → ${answer}.`;
      case 'conditional_ba': return `だ → ${answer} (ならば and であれば are also correct).`;
      case 'conditional_tara': return `だ → ${answer}.`;
      default: return `だ → ${answer}.`;
    }
  }

  if (data.overrides?.before_noun && form === 'before_noun') {
    return `${headword} takes no な before a noun: ${answer}${not} (${headword}本).`;
  }
  const lookalike = isLookalike(data)
    ? `${headword} is a な-adjective even though it ends in い. `
    : '';
  switch (form) {
    case 'plain': return `${lookalike}な-adjectives add だ in the plain form → ${answer}.`;
    case 'before_noun': return `${lookalike}な-adjectives take な before a noun → ${answer}${not}.`;
    case 'polite': return `${lookalike}な-adjectives add です directly → ${answer}${not}.`;
    case 'negative': return `${lookalike}な-adjectives add じゃない → ${answer}${not} (ではない is also correct).`;
    case 'polite_negative': return `${lookalike}な-adjectives add じゃないです → ${answer}${not} (じゃありません is also correct).`;
    case 'past': return `${lookalike}な-adjectives add だった → ${answer}${not}.`;
    case 'polite_past': return `${lookalike}な-adjectives add でした → ${answer}${not}.`;
    case 'past_negative': return `${lookalike}な-adjectives add じゃなかった → ${answer}${not} (ではなかった is also correct).`;
    case 'polite_past_negative': return `${lookalike}な-adjectives add じゃなかったです → ${answer}${not} (じゃありませんでした is also correct).`;
    case 'te': return `${lookalike}な-adjectives add で → ${answer}${not}.`;
    case 'adverb': return `${lookalike}な-adjectives add に → ${answer}${not}.`;
    case 'conditional_ba': return `${lookalike}な-adjectives add なら → ${answer}${not} (ならば is also correct).`;
    case 'conditional_tara': return `${lookalike}な-adjectives add だったら → ${answer}${not}.`;
    default: return `${lookalike}Use the な-adjective endings → ${answer}.`;
  }
}

export function getAdjectiveHint(headword: string, data: AdjectiveData, form: AdjectiveForm): string {
  return hintRule(headword, data, form, conjugateAdjectiveReading(data, form));
}
