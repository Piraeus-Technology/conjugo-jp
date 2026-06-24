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

// `meaning` is an optional plain-English gloss, shown only where the English
// label is grammar jargon a learner may not know (Volitional, Potential, …).
// Self-explanatory forms (Polite, Past Negative, …) omit it so the card doesn't
// just repeat the label.
export const FORM_LABELS: Record<ConjugationForm, { ja: string; en: string; meaning?: string }> = {
  dictionary: { ja: '辞書形', en: 'Dictionary' },
  masu: { ja: 'ます形', en: 'Polite' },
  masu_negative: { ja: 'ません', en: 'Polite Negative' },
  masu_past: { ja: 'ました', en: 'Polite Past' },
  masu_past_negative: { ja: 'ませんでした', en: 'Polite Past Neg.' },
  te: { ja: 'て形', en: 'Te-form', meaning: 'connective and / please' },
  ta: { ja: 'た形', en: 'Ta-form (Past)' },
  nai: { ja: 'ない形', en: 'Negative' },
  nakatta: { ja: 'なかった', en: 'Past Negative' },
  potential: { ja: '可能形', en: 'Potential', meaning: 'can / be able to' },
  passive: { ja: '受身形', en: 'Passive', meaning: 'is done to / is -ed' },
  causative: { ja: '使役形', en: 'Causative', meaning: 'make / let someone do' },
  causative_passive: { ja: '使役受身形', en: 'Causative Passive', meaning: 'is made to do' },
  imperative: { ja: '命令形', en: 'Imperative', meaning: 'command to do it' },
  prohibitive: { ja: '禁止形', en: 'Prohibitive', meaning: 'do not do it' },
  conditional_ba: { ja: 'ば形', en: 'Conditional (ba)', meaning: 'if' },
  conditional_tara: { ja: 'たら形', en: 'Conditional (tara)', meaning: 'when / if' },
  volitional: { ja: '意向形', en: 'Volitional', meaning: "let's / I'll" },
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
  // Forms that either don't exist naturally for this verb or aren't useful quiz
  // targets (e.g. ある has no potential あれる; あろう is real but too formal).
  excludeForms?: ConjugationForm[];
}

// Filter a set of practice forms down to the ones worth quizzing for a verb,
// dropping any in its excludeForms. Returns an empty array when no active forms
// are quizzable, so callers can pick a different verb instead.
export function quizzableForms(verb: VerbData, forms: ConjugationForm[]): ConjugationForm[] {
  if (!verb.excludeForms || verb.excludeForms.length === 0) return forms;
  const excluded = new Set(verb.excludeForms);
  return forms.filter((f) => !excluded.has(f));
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

  // 行く and 〜いく compounds: irregular te/ta/tara (って/った/ったら, not いて/いた)
  if (row === 'ku' && reading.endsWith('いく')) {
    if (form === 'te') return stem + 'って';
    if (form === 'ta') return stem + 'った';
    if (form === 'conditional_tara') return stem + 'ったら';
  }

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

function godanEnding(row: GodanRow): string {
  return kanaRows[row].u;
}

function godanAStem(row: GodanRow): string {
  return row === 'u' ? 'わ' : kanaRows[row].a;
}

function godanKuException(form: ConjugationForm): string {
  if (form === 'te') return ' (行く is the exception → いって).';
  if (form === 'ta') return ' (行く is the exception → いった).';
  if (form === 'conditional_tara') return ' (行く is the exception → いったら).';
  return '';
}

function getGodanConjugationHint(verb: VerbData, form: ConjugationForm): string {
  const row = verb.godanRow || 'ru';
  const ending = godanEnding(row);
  const iStem = kanaRows[row].i;
  const eStem = kanaRows[row].e;
  const oStem = kanaRows[row].o;
  const aStem = godanAStem(row);
  const negativeStem = row === 'u' ? 'う with わ' : `${ending} with ${aStem}`;

  switch (form) {
    case 'dictionary':
      return `Godan dictionary form keeps the verb ending in the う-row kana ${ending}.`;
    case 'masu':
      return `Godan verbs ending in ${ending}: replace ${ending} with ${iStem} + ます.`;
    case 'masu_negative':
      return `Godan polite negative: replace ${ending} with ${iStem} + ません.`;
    case 'masu_past':
      return `Godan polite past: replace ${ending} with ${iStem} + ました.`;
    case 'masu_past_negative':
      return `Godan polite past negative: replace ${ending} with ${iStem} + ませんでした.`;
    case 'te':
      return `Godan verbs ending in ${ending} → replace with ${teFormRules[row].te}.${row === 'ku' ? godanKuException(form) : ''}`;
    case 'ta':
      return `Godan past plain form follows the te-form sound change: ${ending} → ${teFormRules[row].ta}.${row === 'ku' ? godanKuException(form) : ''}`;
    case 'nai':
      return `Godan ${ending}-verbs: negative replaces ${negativeStem} + ない.`;
    case 'nakatta':
      return `Godan past negative replaces ${negativeStem} + なかった.`;
    case 'potential':
      return `Godan potential: replace ${ending} with ${eStem} + る.`;
    case 'passive':
      return `Godan passive: replace ${negativeStem} + れる.`;
    case 'causative':
      return `Godan causative: replace ${negativeStem} + せる.`;
    case 'causative_passive':
      return `Godan causative-passive: replace ${negativeStem} + せられる.`;
    case 'imperative':
      return `Godan imperative: replace ${ending} with the え-row kana ${eStem}.`;
    case 'prohibitive':
      return 'Godan prohibitive keeps the dictionary form and adds な.';
    case 'conditional_ba':
      return `Godan ば conditional: replace ${ending} with ${eStem} + ば.`;
    case 'conditional_tara':
      return `Godan たら conditional: make the た-form (${ending} → ${teFormRules[row].ta}) and add ら.${row === 'ku' ? godanKuException(form) : ''}`;
    case 'volitional':
      return `Godan volitional: replace ${ending} with ${oStem} + う.`;
    default:
      return 'Use the godan row ending to shift the final kana for this form.';
  }
}

function getIchidanConjugationHint(form: ConjugationForm): string {
  switch (form) {
    case 'dictionary':
      return 'Ichidan dictionary form keeps the final る.';
    case 'masu':
      return 'Ichidan: drop る, add ます.';
    case 'masu_negative':
      return 'Ichidan polite negative: drop る, add ません.';
    case 'masu_past':
      return 'Ichidan polite past: drop る, add ました.';
    case 'masu_past_negative':
      return 'Ichidan polite past negative: drop る, add ませんでした.';
    case 'te':
      return 'Ichidan te-form: drop る, add て.';
    case 'ta':
      return 'Ichidan past plain form: drop る, add た.';
    case 'nai':
      return 'Ichidan negative: drop る, add ない.';
    case 'nakatta':
      return 'Ichidan past negative: drop る, add なかった.';
    case 'potential':
      return 'Ichidan potential: drop る, add られる.';
    case 'passive':
      return 'Ichidan passive: drop る, add られる.';
    case 'causative':
      return 'Ichidan causative: drop る, add させる.';
    case 'causative_passive':
      return 'Ichidan causative-passive: drop る, add させられる.';
    case 'imperative':
      return 'Ichidan imperative: drop る, add ろ.';
    case 'prohibitive':
      return 'Ichidan prohibitive keeps the dictionary form and adds な.';
    case 'conditional_ba':
      return 'Ichidan ば conditional: drop る, add れば.';
    case 'conditional_tara':
      return 'Ichidan たら conditional: drop る, add たら.';
    case 'volitional':
      return 'Ichidan volitional: drop る, add よう.';
    default:
      return 'Ichidan forms use the stem made by dropping the final る.';
  }
}

function getIrregularConjugationHint(verb: VerbData, form: ConjugationForm): string {
  if (verb.overrides && verb.overrides[form]) {
    return `This form is irregular: use ${verb.overrides[form]}.`;
  }

  if (verb.reading === 'くる' || verb.reading.endsWith('くる')) {
    const target = kuruForms[form];
    switch (form) {
      case 'dictionary':
        return '来る is irregular; memorize the dictionary form くる.';
      case 'masu':
      case 'masu_negative':
      case 'masu_past':
      case 'masu_past_negative':
      case 'te':
      case 'ta':
      case 'nai':
      case 'nakatta':
      case 'potential':
      case 'passive':
      case 'causative':
      case 'causative_passive':
      case 'imperative':
      case 'prohibitive':
      case 'conditional_ba':
      case 'conditional_tara':
      case 'volitional':
        return `くる → ${target} (irregular).`;
      default:
        return '来る conjugates irregularly.';
    }
  }

  if (verb.reading === 'する' || verb.reading.endsWith('する')) {
    const target = suruForms[form];
    switch (form) {
      case 'dictionary':
        return 'する is irregular; compound する verbs keep the noun/base + する.';
      case 'masu':
      case 'masu_negative':
      case 'masu_past':
      case 'masu_past_negative':
      case 'te':
      case 'ta':
      case 'nai':
      case 'nakatta':
      case 'potential':
      case 'passive':
      case 'causative':
      case 'causative_passive':
      case 'imperative':
      case 'prohibitive':
      case 'conditional_ba':
      case 'conditional_tara':
      case 'volitional':
        return `する → ${target} (irregular).`;
      default:
        return 'する conjugates irregularly.';
    }
  }

  return 'This verb uses an irregular conjugation pattern for this form.';
}

export function getConjugationHint(verb: VerbData, form: ConjugationForm): string {
  switch (verb.group) {
    case 'godan':
      return getGodanConjugationHint(verb, form);
    case 'ichidan':
      return getIchidanConjugationHint(form);
    case 'irregular':
      return getIrregularConjugationHint(verb, form);
    default:
      return 'Review the verb group and apply its conjugation pattern.';
  }
}

// Build the display form with kanji where possible
// For now, return the reading (hiragana) — kanji display can be enhanced later
// Derive kanji conjugated form from verb kanji + reading + conjugated reading
// e.g., verb=飲む, reading=のむ, conjugated=のみます → 飲みます
export function deriveKanjiForm(verb: string, reading: string, conjugated: string): string {
  if (conjugated === reading) return verb; // dictionary form

  if (verb === '来る' && reading === 'くる') {
    if (/^[きこく]/.test(conjugated)) return '来' + conjugated.slice(1);
  }
  if (verb.endsWith('来る') && reading.endsWith('くる')) {
    const pv = verb.slice(0, -2), pr = reading.slice(0, -2);
    const suf = conjugated.slice(pr.length);
    if (/^[きこく]/.test(suf)) return pv + '来' + suf.slice(1);
  }

  let sharedSuffix = 0;
  for (let i = 1; i <= Math.min(verb.length, reading.length); i++) {
    if (verb[verb.length - i] === reading[reading.length - i]) {
      sharedSuffix = i;
    } else {
      break;
    }
  }
  if (sharedSuffix === 0) return conjugated;
  const kanjiStem = verb.slice(0, verb.length - sharedSuffix);
  const readingStem = reading.slice(0, reading.length - sharedSuffix);
  if (conjugated.startsWith(readingStem)) {
    return kanjiStem + conjugated.slice(readingStem.length);
  }
  return conjugated;
}


export function conjugate(verb: string, verbData: VerbData, form: ConjugationForm): ConjugationResult {
  const reading = conjugateReading(verbData, form);
  const labels = FORM_LABELS[form];
  const value = deriveKanjiForm(verb, verbData.reading, reading);

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
