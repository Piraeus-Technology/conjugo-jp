import { ALL_FORMS, conjugateReading, type ConjugationForm, type GodanRow, type VerbData } from './conjugate';
import { getStem, kanaRows, teFormRules } from './kana';

const godanRows = Object.keys(kanaRows) as GodanRow[];
const commonlyConfusedRows: Record<GodanRow, GodanRow[]> = {
  u: ['ru', 'ku', 'mu'],
  ku: ['gu', 'u', 'su'],
  gu: ['ku', 'mu', 'u'],
  su: ['tsu', 'ku', 'ru'],
  tsu: ['su', 'ru', 'mu'],
  nu: ['mu', 'bu', 'u'],
  bu: ['mu', 'nu', 'gu'],
  mu: ['bu', 'nu', 'ku'],
  ru: ['u', 'ku', 'mu'],
};

const waRowSuffix: Partial<Record<ConjugationForm, string>> = {
  nai: 'ない',
  nakatta: 'なかった',
  passive: 'れる',
  causative: 'せる',
  causative_passive: 'せられる',
};

const politeSuffix: Partial<Record<ConjugationForm, string>> = {
  masu: 'ます',
  masu_negative: 'ません',
  masu_past: 'ました',
  masu_past_negative: 'ませんでした',
};

const suruVariants: Partial<Record<ConjugationForm, string[]>> = {
  nai: ['さない', 'せない'],
  nakatta: ['さなかった', 'せなかった'],
  passive: ['せられる'],
  causative: ['さす', 'せさせる', 'せさす'],
  causative_passive: ['さされる', 'せさせられる', 'せさされる'],
  imperative: ['せよ', 'せい', 'しよ', 'せ', 'し'],
  conditional_ba: ['せば'],
  volitional: ['そう', 'せう', 'しょう'],
};

function usingIchidan(reading: string, data: VerbData, form: ConjugationForm): string {
  return conjugateReading({ ...data, reading, group: 'ichidan', overrides: undefined }, form);
}

function applySoundChange(stem: string, row: GodanRow, form: 'te' | 'ta' | 'conditional_tara'): string {
  if (form === 'te') return stem + teFormRules[row].te;
  return stem + teFormRules[row].ta + (form === 'conditional_tara' ? 'ら' : '');
}

function rowOrder(data: VerbData): GodanRow[] {
  const row = data.godanRow ?? 'ru';
  return [...new Set([row, ...commonlyConfusedRows[row], ...godanRows])];
}

function acceptedReadings(data: VerbData, form: ConjugationForm): Set<string> {
  // Other table forms can overlap the asked form in historical or colloquial
  // usage (for example the godan passive/potential). Keep all of them out.
  const blocked = new Set([data.reading, ...ALL_FORMS.map(f => conjugateReading(data, f))]);
  const stem = getStem(data.reading);
  const masuStem = conjugateReading(data, 'masu').slice(0, -2);
  if (form === 'potential') {
    const potential = conjugateReading(data, 'potential');
    blocked.add(potential.slice(0, -1) + 'れる'); // れ足す
    blocked.add(masuStem + 'える'); // ～得る
    blocked.add(masuStem + 'うる');
    if (data.group === 'ichidan') {
      blocked.add(stem + 'れる'); // ら抜き
      blocked.add(stem + 'れれる');
    }
  }
  if (form === 'causative' || form === 'causative_passive') {
    const causative = conjugateReading(data, 'causative');
    const base = causative.slice(0, -2);
    blocked.add(base + (form === 'causative' ? 'す' : 'される'));
  }
  if (form === 'imperative') {
    if (data.group === 'ichidan') {
      for (const ending of ['ろ', 'よ', 'れ']) blocked.add(stem + ending);
    }
    blocked.add(masuStem); // Bare continuative commands in dialects.
  }

  if (data.group === 'irregular' && data.reading.endsWith('する')) {
    const prefix = data.reading.slice(0, -2);
    for (const ending of suruVariants[form] ?? []) blocked.add(prefix + ending);
    // Single-kanji サ変 verbs may also inflect as a regular す verb.
    const godanSuru: VerbData = { ...data, reading: prefix + 'す', group: 'godan', godanRow: 'su', overrides: undefined };
    blocked.add(conjugateReading(godanSuru, form));
  }
  if (data.group === 'irregular' && data.reading.endsWith('くる')) {
    const prefix = data.reading.slice(0, -2);
    if (form === 'potential') {
      blocked.add(prefix + 'これる');
      blocked.add(prefix + 'これれる');
    }
    if (form === 'imperative') {
      for (const ending of ['こ', 'こよ', 'これ', 'きい']) blocked.add(prefix + ending);
    }
  }

  if (data.godanRow === 'ku' && /[いゆ]く$/.test(data.reading)) {
    // I-/yu-onbin and loss of the geminate are attested outside contemporary
    // standard Japanese for 行く. Avoid even the usual textbook decoy here.
    if (form === 'te' || form === 'ta' || form === 'conditional_tara') {
      blocked.add(applySoundChange(stem, 'ku', form));
      blocked.add(usingIchidan(data.reading, data, form));
    }
    const alternate = data.reading.slice(0, -2) + (data.reading.endsWith('いく') ? 'ゆく' : 'いく');
    blocked.add(conjugateReading({ ...data, reading: alternate, overrides: undefined }, form));
    if (form === 'volitional') blocked.add(stem + 'ごう');
    if (form === 'imperative') blocked.add(stem + 'げ');
  }
  if (data.godanRow === 'u') {
    if (form === 'te') blocked.add(stem + 'うて');
    if (form === 'ta') blocked.add(stem + 'うた');
    if (form === 'conditional_tara') blocked.add(stem + 'うたら');
  }

  if (data.godanRow === 'ru' && data.overrides?.masu && data.overrides.imperative) {
    // Historical ～ります and ～れ survive alongside the honorific forms.
    if (politeSuffix[form] || form === 'imperative') {
      blocked.add(conjugateReading({ ...data, overrides: undefined }, form));
    }
  }
  if (data.reading === 'ございます') {
    const gozaru: VerbData = { ...data, reading: 'ござる', godanRow: 'ru', overrides: undefined };
    blocked.add(conjugateReading(gozaru, form));
    const suffix = politeSuffix[form];
    if (suffix) blocked.add('ござん' + suffix.slice(1));
  }
  return blocked;
}

function wrongRules(data: VerbData, form: ConjugationForm): string[] {
  const stem = getStem(data.reading);
  const rows = rowOrder(data);
  const ichidan = usingIchidan(data.reading, data, form);

  if (form === 'dictionary' || form === 'prohibitive') return [];
  if (form === 'te' || form === 'ta' || form === 'conditional_tara') {
    if (data.group === 'irregular' && data.reading.endsWith('くる')) {
      const prefix = data.reading.slice(0, -2);
      return [ichidan, usingIchidan(prefix + 'こる', data, form), ...rows.map(row => applySoundChange(stem, row, form))];
    }
    const soundChanges = rows.map(row => applySoundChange(stem, row, form));
    return data.group === 'irregular' || (data.group === 'godan' && data.godanRow === 'ru')
      ? [ichidan, ...soundChanges]
      : [...soundChanges, ichidan];
  }

  const wrong = [ichidan];
  const waSuffix = data.godanRow === 'u' ? waRowSuffix[form] : undefined;
  if (waSuffix) wrong.push(stem + 'あ' + waSuffix);
  if (data.group === 'irregular' && /[すく]る$/.test(data.reading)) {
    const prefix = data.reading.slice(0, -2);
    const bases = data.reading.endsWith('する') ? ['し', 'せ', 'さ'] : ['く', 'き', 'こ'];
    for (const base of bases) wrong.push(usingIchidan(prefix + base + 'る', data, form));
  }
  if (data.reading === 'ございます' && politeSuffix[form]) {
    // Adding a second polite auxiliary or dropping part of the frozen form.
    return [data.reading + politeSuffix[form], ichidan];
  }
  for (const row of rows) {
    wrong.push(conjugateReading({ ...data, group: 'godan', godanRow: row, overrides: undefined }, form));
  }
  return wrong;
}

function fallbackRules(data: VerbData, form: ConjugationForm): string[] {
  const rows = rowOrder(data);
  const stem = getStem(data.reading);
  if (form === 'dictionary' || form === 'prohibitive') {
    // The plain ～な rule shares the dictionary base across all groups. Apply
    // it to the same stem with a misidentified dictionary ending. In particular,
    // avoid continuative + な, which is used for real prohibitives in some dialects.
    const ending = form === 'prohibitive' ? 'な' : '';
    return rows.map(row => stem + kanaRows[row].u + ending);
  }
  return rows.map(row => conjugateReading({ ...data, group: 'godan', godanRow: row, overrides: undefined }, form));
}

// Order candidates by how closely their rule matches the intended form. The
// quiz uses the first three and then shuffles them with the correct answer.
export function listQuizDistractors(data: VerbData, form: ConjugationForm): { primary: string[]; fallback: string[] } {
  const seen = acceptedReadings(data, form);
  const eligible = (answer: string) => {
    if (seen.has(answer)) return false;
    seen.add(answer);
    return true;
  };
  const primary = wrongRules(data, form).filter(eligible);
  const fallback = primary.length < 3 ? fallbackRules(data, form).filter(eligible) : [];
  return { primary, fallback };
}
