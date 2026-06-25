import { conjugate, conjugateReading, ConjugationForm, VerbData } from '../utils/conjugate';
import { getExampleSentence } from '../utils/formExamples';
import n5 from '../data/formExamples.n5.json';
import n4 from '../data/formExamples.n4.json';
import verbsJson from '../data/verbs.json';

const verbs = verbsJson as Record<string, VerbData>;
const dataset = n5 as Record<string, Partial<Record<ConjugationForm, string>>>;
const exampleForms: ConjugationForm[] = [
  'masu',
  'te',
  'ta',
  'nai',
  'potential',
  'passive',
  'causative',
  'conditional_ba',
  'conditional_tara',
  'volitional',
  'imperative',
];

function expectExcludedFormsAbsent(
  level: VerbData['jlpt'],
  examples: Record<string, Partial<Record<ConjugationForm, string>>>,
) {
  for (const [verb, data] of Object.entries(verbs)) {
    if (data.jlpt !== level) continue;
    for (const form of data.excludeForms || []) {
      expect(examples[verb]?.[form]).toBeUndefined();
      expect(getExampleSentence(verb, form)).toBeUndefined();
    }
  }
}

function nonExcludeOmissions(
  level: VerbData['jlpt'],
  examples: Record<string, Partial<Record<ConjugationForm, string>>>,
): [string, ConjugationForm][] {
  const omissions: [string, ConjugationForm][] = [];
  for (const verb of Object.keys(examples)) {
    const data = verbs[verb];
    if (!data || data.jlpt !== level) continue;
    const excluded = new Set(data.excludeForms || []);
    for (const form of exampleForms) {
      if (!excluded.has(form) && !examples[verb]?.[form]) {
        omissions.push([verb, form]);
      }
    }
  }
  return omissions;
}

const expectedCountsByForm: Partial<Record<ConjugationForm, number>> = {
  masu: 120,
  te: 120,
  ta: 120,
  nai: 119,
  potential: 96,
  passive: 70,
  causative: 99,
  conditional_ba: 118,
  conditional_tara: 120,
  volitional: 97,
  imperative: 99,
};

const intentionalOmissions: [string, ConjugationForm][] = [
  ['ある', 'potential'],
  ['ある', 'passive'],
  ['ある', 'causative'],
  ['ある', 'volitional'],
  ['ある', 'imperative'],
  ['遊ぶ', 'passive'],
  ['泳ぐ', 'passive'],
  ['渡る', 'passive'],
  ['鳴る', 'passive'],
  ['止まる', 'passive'],
  ['困る', 'passive'],
  ['頑張る', 'passive'],
  ['結婚する', 'passive'],
  ['電話する', 'passive'],
  ['洗濯する', 'passive'],
  ['勉強する', 'passive'],
  ['料理する', 'passive'],
  ['答える', 'passive'],
  ['鳴る', 'causative'],
  ['飛ぶ', 'causative'],
  ['動く', 'causative'],
  ['なくす', 'causative'],
  ['差し上げる', 'causative'],
  ['つく', 'volitional'],
  ['つく', 'imperative'],
  ['困る', 'imperative'],
  ['疲れる', 'imperative'],
  ['差し上げる', 'imperative'],
  ['くださる', 'imperative'],
  ['くれる', 'imperative'],
];

describe('N5 form example sentences', () => {
  const entries: [string, ConjugationForm, string][] = [];
  for (const [verb, forms] of Object.entries(dataset)) {
    for (const [form, sentence] of Object.entries(forms)) {
      entries.push([verb, form as ConjugationForm, sentence as string]);
    }
  }

  it('covers a non-trivial number of sentences', () => {
    expect(entries.length).toBeGreaterThan(1000);
  });

  it('matches the expected count by form', () => {
    const counts: Partial<Record<ConjugationForm, number>> = {};
    for (const [, form] of entries) {
      counts[form] = (counts[form] || 0) + 1;
    }
    expect(counts).toEqual(expectedCountsByForm);
  });

  it('only references verbs that exist in the verb list', () => {
    for (const verb of Object.keys(dataset)) {
      expect(verbs[verb]).toBeDefined();
    }
  });

  it('each sentence contains its exact conjugated form (kanji or kana)', () => {
    const offenders: string[] = [];
    for (const [verb, form, sentence] of entries) {
      const data = verbs[verb];
      const kanji = conjugate(verb, data, form).value;
      const kana = conjugateReading(data, form);
      if (!sentence.includes(kanji) && !sentence.includes(kana)) {
        offenders.push(`${verb}:${form} -> "${sentence}" (expected ${kanji}/${kana})`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('getExampleSentence returns dataset entries and undefined for omitted forms', () => {
    expect(getExampleSentence('食べる', 'volitional')).toContain('食べよう');
    for (const [verb, form] of intentionalOmissions) {
      expect(dataset[verb]?.[form]).toBeUndefined();
      expect(getExampleSentence(verb, form)).toBeUndefined();
    }
    // Unknown verb -> undefined, never throws.
    expect(getExampleSentence('存在しない動詞', 'masu')).toBeUndefined();
  });

  it('generates no examples for N5 excludeForms forms', () => {
    expectExcludedFormsAbsent('N5', dataset);
  });
});

const n4dataset = n4 as Record<string, Partial<Record<ConjugationForm, string>>>;
const n4ExpectedCountsByForm: Partial<Record<ConjugationForm, number>> = {
  masu: 173,
  te: 173,
  ta: 173,
  nai: 173,
  potential: 120,
  passive: 102,
  causative: 143,
  conditional_ba: 173,
  conditional_tara: 173,
  volitional: 131,
  imperative: 145,
};

const n4IntentionalOmissions: [string, ConjugationForm][] = [
  ['届く', 'potential'],
  ['届く', 'passive'],
  ['届く', 'volitional'],
  ['変わる', 'passive'],
  ['変わる', 'causative'],
  ['集まる', 'passive'],
  ['落ちる', 'potential'],
  ['落ちる', 'passive'],
  ['落ちる', 'causative'],
  ['落ちる', 'volitional'],
  ['壊れる', 'potential'],
  ['壊れる', 'passive'],
  ['壊れる', 'causative'],
  ['壊れる', 'volitional'],
  ['直る', 'potential'],
  ['直る', 'passive'],
  ['直る', 'causative'],
  ['直る', 'volitional'],
  ['間に合う', 'potential'],
  ['間に合う', 'passive'],
  ['間に合う', 'volitional'],
  ['間に合う', 'imperative'],
  ['続く', 'potential'],
  ['続く', 'passive'],
  ['続く', 'volitional'],
  ['続く', 'imperative'],
  ['増える', 'potential'],
  ['増える', 'passive'],
  ['増える', 'causative'],
  ['増える', 'volitional'],
  ['減る', 'potential'],
  ['減る', 'passive'],
  ['減る', 'causative'],
  ['減る', 'volitional'],
  ['決まる', 'potential'],
  ['決まる', 'volitional'],
  ['込む', 'potential'],
  ['込む', 'passive'],
  ['込む', 'causative'],
  ['込む', 'volitional'],
  ['込む', 'imperative'],
  ['向かう', 'passive'],
  ['触る', 'passive'],
  ['急ぐ', 'passive'],
  ['並ぶ', 'potential'],
  ['並ぶ', 'passive'],
  ['卒業する', 'passive'],
  ['故障する', 'potential'],
  ['故障する', 'passive'],
  ['故障する', 'volitional'],
  ['故障する', 'imperative'],
  ['出発する', 'passive'],
  ['到着する', 'passive'],
  ['賛成する', 'passive'],
  ['反対する', 'passive'],
  ['努力する', 'passive'],
  ['生活する', 'passive'],
  ['引っ越す', 'passive'],
  ['悲しむ', 'potential'],
  ['悲しむ', 'volitional'],
  ['悲しむ', 'imperative'],
  ['迷う', 'potential'],
  ['迷う', 'passive'],
  ['迷う', 'volitional'],
  ['迷う', 'imperative'],
  ['治る', 'potential'],
  ['治る', 'passive'],
  ['治る', 'causative'],
  ['治る', 'volitional'],
  ['濡れる', 'potential'],
  ['濡れる', 'passive'],
  ['濡れる', 'volitional'],
  ['濡れる', 'imperative'],
  ['願う', 'causative'],
  ['遅れる', 'potential'],
  ['遅れる', 'passive'],
  ['遅れる', 'volitional'],
  ['遅れる', 'imperative'],
  ['間違える', 'imperative'],
  ['慣れる', 'passive'],
  ['似合う', 'potential'],
  ['似合う', 'passive'],
  ['似合う', 'causative'],
  ['似合う', 'volitional'],
  ['似合う', 'imperative'],
  ['驚く', 'potential'],
  ['驚く', 'volitional'],
  ['起こる', 'potential'],
  ['起こる', 'passive'],
  ['起こる', 'causative'],
  ['起こる', 'volitional'],
  ['倒れる', 'potential'],
  ['倒れる', 'causative'],
  ['倒れる', 'volitional'],
  ['受かる', 'potential'],
  ['受かる', 'passive'],
  ['受かる', 'volitional'],
  ['感動する', 'passive'],
  ['乾く', 'potential'],
  ['乾く', 'passive'],
  ['乾く', 'causative'],
  ['乾く', 'volitional'],
  ['光る', 'potential'],
  ['光る', 'passive'],
  ['光る', 'volitional'],
  ['太る', 'passive'],
  ['痩せる', 'passive'],
  ['ぶつかる', 'potential'],
  ['ぶつかる', 'causative'],
  ['すれ違う', 'passive'],
  ['すれ違う', 'volitional'],
  ['気をつける', 'passive'],
  ['震える', 'potential'],
  ['震える', 'passive'],
  ['震える', 'volitional'],
  ['震える', 'imperative'],
  ['騙される', 'potential'],
  ['騙される', 'passive'],
  ['騙される', 'causative'],
  ['騙される', 'volitional'],
  ['騙される', 'imperative'],
  ['転がる', 'potential'],
  ['転がる', 'passive'],
  ['浮かべる', 'passive'],
  ['思い付く', 'passive'],
  ['気に入る', 'potential'],
  ['気に入る', 'volitional'],
  ['気に入る', 'imperative'],
  ['役立つ', 'potential'],
  ['役立つ', 'passive'],
  ['役立つ', 'causative'],
  ['役立つ', 'volitional'],
  ['役立つ', 'imperative'],
  ['間違う', 'potential'],
  ['間違う', 'imperative'],
  ['見つかる', 'potential'],
  ['見つかる', 'passive'],
  ['見つかる', 'causative'],
  ['見つかる', 'volitional'],
  ['生まれる', 'potential'],
  ['生まれる', 'passive'],
  ['生まれる', 'causative'],
  ['育つ', 'potential'],
  ['育つ', 'passive'],
  ['育つ', 'causative'],
  ['咲く', 'potential'],
  ['咲く', 'passive'],
  ['咲く', 'volitional'],
  ['混む', 'potential'],
  ['混む', 'causative'],
  ['混む', 'volitional'],
  ['混む', 'imperative'],
  ['訪れる', 'passive'],
  ['訪れる', 'imperative'],
  ['片寄る', 'potential'],
  ['片寄る', 'passive'],
  ['片寄る', 'volitional'],
  ['片寄る', 'imperative'],
  ['怒る', 'potential'],
  ['怒る', 'imperative'],
  ['こぼす', 'potential'],
  ['こぼす', 'volitional'],
  ['こぼす', 'imperative'],
  ['こぼれる', 'potential'],
  ['こぼれる', 'passive'],
  ['こぼれる', 'volitional'],
  ['こぼれる', 'imperative'],
  ['すべる', 'passive'],
  ['つまずく', 'potential'],
  ['つまずく', 'passive'],
  ['つまずく', 'volitional'],
  ['つまずく', 'imperative'],
  ['はしゃぐ', 'passive'],
  ['折る', 'potential'],
  ['割る', 'potential'],
];

describe('N4 form example sentences', () => {
  const entries: [string, ConjugationForm, string][] = [];
  for (const [verb, forms] of Object.entries(n4dataset)) {
    for (const [form, sentence] of Object.entries(forms)) {
      entries.push([verb, form as ConjugationForm, sentence as string]);
    }
  }

  it('covers a non-trivial number of sentences', () => {
    expect(entries.length).toBeGreaterThan(1500);
  });

  it('matches the expected count by form', () => {
    const counts: Partial<Record<ConjugationForm, number>> = {};
    for (const [, form] of entries) {
      counts[form] = (counts[form] || 0) + 1;
    }
    expect(counts).toEqual(n4ExpectedCountsByForm);
  });

  it('only references N4 verbs that exist', () => {
    for (const verb of Object.keys(n4dataset)) {
      expect(verbs[verb]).toBeDefined();
      expect(verbs[verb].jlpt).toBe('N4');
    }
  });

  it('each sentence contains its exact conjugated form (kanji or kana)', () => {
    const offenders: string[] = [];
    for (const [verb, form, sentence] of entries) {
      const data = verbs[verb];
      const kanji = conjugate(verb, data, form).value;
      const kana = conjugateReading(data, form);
      if (!sentence.includes(kanji) && !sentence.includes(kana)) {
        offenders.push(`${verb}:${form} -> "${sentence}" (expected ${kanji}/${kana})`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('generates no examples for N4 excludeForms forms', () => {
    expectExcludedFormsAbsent('N4', n4dataset);
  });

  it('omits only intentional non-exclude N4 forms', () => {
    expect(nonExcludeOmissions('N4', n4dataset)).toEqual(n4IntentionalOmissions);
  });
});
