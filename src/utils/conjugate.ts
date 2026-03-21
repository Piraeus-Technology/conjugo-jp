import { kanaRows, teFormRules, getStem } from './kana';

export type VerbGroup = 'godan' | 'ichidan' | 'irregular';
export type GodanRow = 'u' | 'ku' | 'gu' | 'su' | 'tsu' | 'nu' | 'bu' | 'mu' | 'ru';
export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export type ConjugationForm =
  | 'dictionary'
  | 'masu'
  | 'masu_negative'
  | 'masu_past'
  | 'masu_past_negative'
  | 'te'
  | 'ta'
  | 'nai'
  | 'nakatta'
  | 'potential'
  | 'passive'
  | 'causative'
  | 'causative_passive'
  | 'imperative'
  | 'prohibitive'
  | 'conditional_ba'
  | 'conditional_tara'
  | 'volitional';

export const FORM_LABELS: Record<ConjugationForm, { ja: string; en: string }> = {
  dictionary: { ja: '辞書形', en: 'Dictionary' },
  masu: { ja: 'ます形', en: 'Polite' },
  masu_negative: { ja: 'ません', en: 'Polite Negative' },
  masu_past: { ja: 'ました', en: 'Polite Past' },
  masu_past_negative: { ja: 'ませんでした', en: 'Polite Past Neg.' },
  te: { ja: 'て形', en: 'Te-form' },
  ta: { ja: 'た形', en: 'Ta-form (Past)' },
  nai: { ja: 'ない形', en: 'Negative' },
  nakatta: { ja: 'なかった', en: 'Past Negative' },
  potential: { ja: '可能形', en: 'Potential' },
  passive: { ja: '受身形', en: 'Passive' },
  causative: { ja: '使役形', en: 'Causative' },
  causative_passive: { ja: '使役受身形', en: 'Causative Passive' },
  imperative: { ja: '命令形', en: 'Imperative' },
  prohibitive: { ja: '禁止形', en: 'Prohibitive' },
  conditional_ba: { ja: 'ば形', en: 'Conditional (ba)' },
  conditional_tara: { ja: 'たら形', en: 'Conditional (tara)' },
  volitional: { ja: '意向形', en: 'Volitional' },
};

export const ALL_FORMS: ConjugationForm[] = Object.keys(FORM_LABELS) as ConjugationForm[];

export interface VerbExample {
  ja: string;
  en: string;
}

export interface VerbData {
  reading: string;
  group: VerbGroup;
  godanRow?: GodanRow;
  translation: string;
  jlpt: JLPTLevel;
  transitive?: boolean;
  examples?: VerbExample[];
  overrides?: Partial<Record<ConjugationForm, string>>;
}

export interface ConjugationResult {
  form: ConjugationForm;
  labelJa: string;
  labelEn: string;
  value: string;
  reading: string;
}

// Form groupings for display
export const FORM_GROUPS = [
  {
    title: 'Basic',
    titleJa: '基本',
    forms: ['dictionary', 'masu', 'te', 'ta'] as ConjugationForm[],
  },
  {
    title: 'Negative',
    titleJa: '否定',
    forms: ['nai', 'nakatta', 'masu_negative', 'masu_past_negative'] as ConjugationForm[],
  },
  {
    title: 'Potential / Passive / Causative',
    titleJa: '可能・受身・使役',
    forms: ['potential', 'passive', 'causative', 'causative_passive'] as ConjugationForm[],
  },
  {
    title: 'Conditional / Volitional',
    titleJa: '条件・意向',
    forms: ['conditional_ba', 'conditional_tara', 'volitional'] as ConjugationForm[],
  },
  {
    title: 'Imperative',
    titleJa: '命令',
    forms: ['imperative', 'prohibitive'] as ConjugationForm[],
  },
];

function conjugateGodanReading(reading: string, row: GodanRow, form: ConjugationForm): string {
  const stem = getStem(reading);
  const rowKana = kanaRows[row];

  switch (form) {
    case 'dictionary':
      return reading;
    case 'masu':
      return stem + rowKana.i + 'ます';
    case 'masu_negative':
      return stem + rowKana.i + 'ません';
    case 'masu_past':
      return stem + rowKana.i + 'ました';
    case 'masu_past_negative':
      return stem + rowKana.i + 'ませんでした';
    case 'te':
      return stem + teFormRules[row].te;
    case 'ta':
      return stem + teFormRules[row].ta;
    case 'nai':
      return stem + (row === 'u' ? 'わ' : rowKana.a) + 'ない';
    case 'nakatta':
      return stem + (row === 'u' ? 'わ' : rowKana.a) + 'なかった';
    case 'potential':
      return stem + rowKana.e + 'る';
    case 'passive':
      return stem + (row === 'u' ? 'わ' : rowKana.a) + 'れる';
    case 'causative':
      return stem + (row === 'u' ? 'わ' : rowKana.a) + 'せる';
    case 'causative_passive':
      return stem + (row === 'u' ? 'わ' : rowKana.a) + 'せられる';
    case 'imperative':
      return stem + rowKana.e;
    case 'prohibitive':
      return reading + 'な';
    case 'conditional_ba':
      return stem + rowKana.e + 'ば';
    case 'conditional_tara':
      return stem + teFormRules[row].ta + 'ら';
    case 'volitional':
      return stem + rowKana.o + 'う';
    default:
      return reading;
  }
}

function conjugateIchidanReading(reading: string, form: ConjugationForm): string {
  const stem = getStem(reading);

  switch (form) {
    case 'dictionary':
      return reading;
    case 'masu':
      return stem + 'ます';
    case 'masu_negative':
      return stem + 'ません';
    case 'masu_past':
      return stem + 'ました';
    case 'masu_past_negative':
      return stem + 'ませんでした';
    case 'te':
      return stem + 'て';
    case 'ta':
      return stem + 'た';
    case 'nai':
      return stem + 'ない';
    case 'nakatta':
      return stem + 'なかった';
    case 'potential':
      return stem + 'られる';
    case 'passive':
      return stem + 'られる';
    case 'causative':
      return stem + 'させる';
    case 'causative_passive':
      return stem + 'させられる';
    case 'imperative':
      return stem + 'ろ';
    case 'prohibitive':
      return reading + 'な';
    case 'conditional_ba':
      return stem + 'れば';
    case 'conditional_tara':
      return stem + 'たら';
    case 'volitional':
      return stem + 'よう';
    default:
      return reading;
  }
}

// Irregular verb conjugation tables
const suruForms: Record<ConjugationForm, string> = {
  dictionary: 'する',
  masu: 'します',
  masu_negative: 'しません',
  masu_past: 'しました',
  masu_past_negative: 'しませんでした',
  te: 'して',
  ta: 'した',
  nai: 'しない',
  nakatta: 'しなかった',
  potential: 'できる',
  passive: 'される',
  causative: 'させる',
  causative_passive: 'させられる',
  imperative: 'しろ',
  prohibitive: 'するな',
  conditional_ba: 'すれば',
  conditional_tara: 'したら',
  volitional: 'しよう',
};

const kuruForms: Record<ConjugationForm, string> = {
  dictionary: 'くる',
  masu: 'きます',
  masu_negative: 'きません',
  masu_past: 'きました',
  masu_past_negative: 'きませんでした',
  te: 'きて',
  ta: 'きた',
  nai: 'こない',
  nakatta: 'こなかった',
  potential: 'こられる',
  passive: 'こられる',
  causative: 'こさせる',
  causative_passive: 'こさせられる',
  imperative: 'こい',
  prohibitive: 'くるな',
  conditional_ba: 'くれば',
  conditional_tara: 'きたら',
  volitional: 'こよう',
};

function conjugateIrregularReading(reading: string, form: ConjugationForm, overrides?: Partial<Record<ConjugationForm, string>>): string {
  // Check overrides first
  if (overrides && overrides[form]) {
    return overrides[form]!;
  }

  // Handle する and compound する verbs
  if (reading === 'する' || reading.endsWith('する')) {
    const prefix = reading.slice(0, -2);
    return prefix + suruForms[form];
  }

  // Handle 来る (くる)
  if (reading === 'くる' || reading.endsWith('くる')) {
    const prefix = reading.slice(0, -2);
    return prefix + kuruForms[form];
  }

  // Fallback for other irregulars with overrides
  if (overrides && overrides[form]) {
    return overrides[form]!;
  }

  return reading;
}

export function conjugateReading(verb: VerbData, form: ConjugationForm): string {
  // Check overrides first (works for any verb group)
  if (verb.overrides && verb.overrides[form]) {
    return verb.overrides[form]!;
  }

  switch (verb.group) {
    case 'godan':
      return conjugateGodanReading(verb.reading, verb.godanRow!, form);
    case 'ichidan':
      return conjugateIchidanReading(verb.reading, form);
    case 'irregular':
      return conjugateIrregularReading(verb.reading, form, verb.overrides);
    default:
      return verb.reading;
  }
}

// Build the display form with kanji where possible
// For now, return the reading (hiragana) — kanji display can be enhanced later
export function conjugate(verb: string, verbData: VerbData, form: ConjugationForm): ConjugationResult {
  const reading = conjugateReading(verbData, form);
  const labels = FORM_LABELS[form];

  // For dictionary form, use the original verb (with kanji)
  const value = form === 'dictionary' ? verb : reading;

  return {
    form,
    labelJa: labels.ja,
    labelEn: labels.en,
    value,
    reading,
  };
}

export function conjugateAll(verb: string, verbData: VerbData): ConjugationResult[] {
  return ALL_FORMS.map((form) => conjugate(verb, verbData, form));
}
