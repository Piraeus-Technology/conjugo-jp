import { conjugate, conjugateReading, ConjugationForm, VerbData } from '../utils/conjugate';
import { getExampleSentence } from '../utils/formExamples';
import n5 from '../data/formExamples.n5.json';
import n4 from '../data/formExamples.n4.json';
import n3 from '../data/formExamples.n3.json';
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

const n3dataset = n3 as Record<string, Partial<Record<ConjugationForm, string>>>;
const n3ExpectedCountsByForm: Partial<Record<ConjugationForm, number>> = {
  masu: 380,
  te: 379,
  ta: 378,
  nai: 380,
  potential: 269,
  passive: 222,
  causative: 278,
  conditional_ba: 376,
  conditional_tara: 377,
  volitional: 277,
  imperative: 258,
};

const n3IntentionalOmissions: [string, ConjugationForm][] = [
  ['得る', 'causative'],
  ['含む', 'potential'],
  ['含む', 'causative'],
  ['含む', 'volitional'],
  ['含む', 'imperative'],
  ['抱える', 'passive'],
  ['眠る', 'passive'],
  ['戦う', 'passive'],
  ['勝つ', 'passive'],
  ['負ける', 'potential'],
  ['負ける', 'passive'],
  ['負ける', 'volitional'],
  ['負ける', 'imperative'],
  ['揺れる', 'potential'],
  ['揺れる', 'passive'],
  ['揺れる', 'causative'],
  ['揺れる', 'volitional'],
  ['揺れる', 'imperative'],
  ['沈む', 'potential'],
  ['沈む', 'passive'],
  ['沈む', 'causative'],
  ['沈む', 'volitional'],
  ['沈む', 'imperative'],
  ['浮かぶ', 'potential'],
  ['浮かぶ', 'passive'],
  ['浮かぶ', 'causative'],
  ['浮かぶ', 'volitional'],
  ['浮かぶ', 'imperative'],
  ['響く', 'potential'],
  ['響く', 'passive'],
  ['響く', 'volitional'],
  ['響く', 'imperative'],
  ['輝く', 'potential'],
  ['輝く', 'passive'],
  ['輝く', 'volitional'],
  ['輝く', 'imperative'],
  ['匂う', 'potential'],
  ['匂う', 'passive'],
  ['匂う', 'volitional'],
  ['匂う', 'imperative'],
  ['成功する', 'potential'],
  ['成功する', 'passive'],
  ['成功する', 'imperative'],
  ['失敗する', 'potential'],
  ['失敗する', 'passive'],
  ['失敗する', 'volitional'],
  ['失敗する', 'imperative'],
  ['完成する', 'potential'],
  ['完成する', 'passive'],
  ['完成する', 'volitional'],
  ['完成する', 'imperative'],
  ['影響する', 'potential'],
  ['影響する', 'causative'],
  ['影響する', 'volitional'],
  ['影響する', 'imperative'],
  ['存在する', 'potential'],
  ['存在する', 'passive'],
  ['存在する', 'causative'],
  ['存在する', 'volitional'],
  ['存在する', 'imperative'],
  ['活動する', 'passive'],
  ['戻る', 'passive'],
  ['戻る', 'causative'],
  ['進む', 'potential'],
  ['進む', 'causative'],
  ['気付く', 'imperative'],
  ['重なる', 'potential'],
  ['重なる', 'passive'],
  ['重なる', 'causative'],
  ['重なる', 'volitional'],
  ['重なる', 'imperative'],
  ['伸びる', 'potential'],
  ['伸びる', 'passive'],
  ['伸びる', 'causative'],
  ['伸びる', 'volitional'],
  ['伸びる', 'imperative'],
  ['伸ばす', 'passive'],
  ['繋がる', 'potential'],
  ['繋がる', 'passive'],
  ['繋がる', 'causative'],
  ['繋がる', 'volitional'],
  ['繋がる', 'imperative'],
  ['過ぎる', 'potential'],
  ['過ぎる', 'passive'],
  ['過ぎる', 'causative'],
  ['過ぎる', 'volitional'],
  ['過ぎる', 'imperative'],
  ['預かる', 'passive'],
  ['従う', 'passive'],
  ['当たる', 'potential'],
  ['当たる', 'passive'],
  ['当たる', 'causative'],
  ['当たる', 'volitional'],
  ['温まる', 'potential'],
  ['温まる', 'passive'],
  ['温まる', 'causative'],
  ['温まる', 'imperative'],
  ['冷める', 'potential'],
  ['冷める', 'passive'],
  ['冷める', 'causative'],
  ['冷める', 'volitional'],
  ['冷める', 'imperative'],
  ['暮らす', 'passive'],
  ['暮らす', 'imperative'],
  ['叶う', 'potential'],
  ['叶う', 'passive'],
  ['叶う', 'causative'],
  ['叶う', 'volitional'],
  ['叶う', 'imperative'],
  ['悔やむ', 'potential'],
  ['悔やむ', 'causative'],
  ['悔やむ', 'volitional'],
  ['悔やむ', 'imperative'],
  ['抜く', 'potential'],
  ['抜ける', 'potential'],
  ['抜ける', 'passive'],
  ['抜ける', 'causative'],
  ['抜ける', 'volitional'],
  ['抜ける', 'imperative'],
  ['干る', 'potential'],
  ['干る', 'passive'],
  ['干る', 'causative'],
  ['干る', 'volitional'],
  ['干る', 'imperative'],
  ['散る', 'potential'],
  ['散る', 'passive'],
  ['散る', 'causative'],
  ['散る', 'volitional'],
  ['散る', 'imperative'],
  ['染まる', 'potential'],
  ['染まる', 'passive'],
  ['染まる', 'causative'],
  ['染まる', 'volitional'],
  ['染まる', 'imperative'],
  ['積もる', 'potential'],
  ['積もる', 'passive'],
  ['積もる', 'causative'],
  ['積もる', 'volitional'],
  ['積もる', 'imperative'],
  ['汚れる', 'potential'],
  ['汚れる', 'passive'],
  ['汚れる', 'causative'],
  ['汚れる', 'volitional'],
  ['汚れる', 'imperative'],
  ['溜まる', 'potential'],
  ['溜まる', 'passive'],
  ['溜まる', 'causative'],
  ['溜まる', 'volitional'],
  ['溜まる', 'imperative'],
  ['驚かす', 'causative'],
  ['沸く', 'potential'],
  ['沸く', 'passive'],
  ['沸く', 'causative'],
  ['沸く', 'volitional'],
  ['沸く', 'imperative'],
  ['映る', 'potential'],
  ['映る', 'passive'],
  ['映る', 'causative'],
  ['映る', 'volitional'],
  ['映る', 'imperative'],
  ['外れる', 'potential'],
  ['外れる', 'passive'],
  ['外れる', 'causative'],
  ['外れる', 'volitional'],
  ['外れる', 'imperative'],
  ['沿う', 'potential'],
  ['沿う', 'passive'],
  ['沿う', 'causative'],
  ['沿う', 'volitional'],
  ['沿う', 'imperative'],
  ['我慢する', 'passive'],
  ['集中する', 'passive'],
  ['緊張する', 'potential'],
  ['緊張する', 'passive'],
  ['満足する', 'passive'],
  ['後悔する', 'potential'],
  ['後悔する', 'passive'],
  ['後悔する', 'volitional'],
  ['後悔する', 'imperative'],
  ['独立する', 'passive'],
  ['成長する', 'passive'],
  ['成長する', 'imperative'],
  ['加わる', 'passive'],
  ['加わる', 'causative'],
  ['加わる', 'imperative'],
  ['向く', 'passive'],
  ['向く', 'volitional'],
  ['逃す', 'potential'],
  ['逃す', 'passive'],
  ['逃す', 'causative'],
  ['逃す', 'volitional'],
  ['広がる', 'potential'],
  ['広がる', 'passive'],
  ['広がる', 'causative'],
  ['広がる', 'volitional'],
  ['広がる', 'imperative'],
  ['深まる', 'potential'],
  ['深まる', 'passive'],
  ['深まる', 'causative'],
  ['深まる', 'volitional'],
  ['深まる', 'imperative'],
  ['回る', 'passive'],
  ['回る', 'causative'],
  ['目立つ', 'potential'],
  ['目立つ', 'passive'],
  ['目立つ', 'volitional'],
  ['目立つ', 'imperative'],
  ['申す', 'potential'],
  ['申す', 'passive'],
  ['申す', 'causative'],
  ['申す', 'volitional'],
  ['申す', 'imperative'],
  ['いただく', 'passive'],
  ['いただく', 'causative'],
  ['いただく', 'imperative'],
  ['ご覧になる', 'passive'],
  ['ご覧になる', 'causative'],
  ['ご覧になる', 'volitional'],
  ['ご覧になる', 'imperative'],
  ['召し上がる', 'potential'],
  ['召し上がる', 'passive'],
  ['召し上がる', 'causative'],
  ['召し上がる', 'volitional'],
  ['痛む', 'potential'],
  ['痛む', 'passive'],
  ['痛む', 'causative'],
  ['痛む', 'volitional'],
  ['痛む', 'imperative'],
  ['落ち着く', 'passive'],
  ['引き返す', 'passive'],
  ['引き返す', 'causative'],
  ['乗り換える', 'passive'],
  ['当てはまる', 'potential'],
  ['当てはまる', 'passive'],
  ['当てはまる', 'causative'],
  ['当てはまる', 'volitional'],
  ['当てはまる', 'imperative'],
  ['盛り上がる', 'potential'],
  ['盛り上がる', 'passive'],
  ['盛り上がる', 'causative'],
  ['盛り上がる', 'imperative'],
  ['飛び出す', 'passive'],
  ['飛び出す', 'causative'],
  ['騒がせる', 'potential'],
  ['騒がせる', 'passive'],
  ['騒がせる', 'causative'],
  ['突き当たる', 'potential'],
  ['突き当たる', 'passive'],
  ['突き当たる', 'causative'],
  ['突き当たる', 'volitional'],
  ['突き当たる', 'imperative'],
  ['食べ過ぎる', 'potential'],
  ['食べ過ぎる', 'passive'],
  ['食べ過ぎる', 'causative'],
  ['食べ過ぎる', 'volitional'],
  ['食べ過ぎる', 'imperative'],
  ['飲み過ぎる', 'potential'],
  ['飲み過ぎる', 'passive'],
  ['飲み過ぎる', 'causative'],
  ['飲み過ぎる', 'volitional'],
  ['飲み過ぎる', 'imperative'],
  ['立ち上がる', 'passive'],
  ['思い込む', 'potential'],
  ['思い込む', 'passive'],
  ['思い込む', 'volitional'],
  ['思い込む', 'imperative'],
  ['申し上げる', 'passive'],
  ['申し上げる', 'causative'],
  ['申し上げる', 'imperative'],
  ['おる', 'te'],
  ['おる', 'ta'],
  ['おる', 'nai'],
  ['おる', 'potential'],
  ['おる', 'passive'],
  ['おる', 'causative'],
  ['おる', 'conditional_ba'],
  ['おる', 'conditional_tara'],
  ['おる', 'volitional'],
  ['おる', 'imperative'],
  ['拝見する', 'passive'],
  ['拝見する', 'causative'],
  ['拝見する', 'imperative'],
  ['睨む', 'potential'],
  ['睨む', 'causative'],
  ['頷く', 'passive'],
  ['微笑む', 'potential'],
  ['微笑む', 'passive'],
  ['微笑む', 'causative'],
  ['微笑む', 'imperative'],
  ['膨らむ', 'potential'],
  ['膨らむ', 'passive'],
  ['膨らむ', 'causative'],
  ['膨らむ', 'volitional'],
  ['膨らむ', 'imperative'],
  ['縮む', 'potential'],
  ['縮む', 'passive'],
  ['縮む', 'causative'],
  ['縮む', 'volitional'],
  ['縮む', 'imperative'],
  ['膨らませる', 'causative'],
  ['閃く', 'potential'],
  ['閃く', 'passive'],
  ['閃く', 'causative'],
  ['閃く', 'volitional'],
  ['閃く', 'imperative'],
  ['惚れる', 'potential'],
  ['惚れる', 'passive'],
  ['惚れる', 'volitional'],
  ['惚れる', 'imperative'],
  ['甦る', 'potential'],
  ['甦る', 'passive'],
  ['甦る', 'volitional'],
  ['甦る', 'imperative'],
  ['弾む', 'potential'],
  ['弾む', 'passive'],
  ['弾む', 'volitional'],
  ['弾む', 'imperative'],
  ['売り切れる', 'potential'],
  ['売り切れる', 'passive'],
  ['売り切れる', 'causative'],
  ['売り切れる', 'volitional'],
  ['売り切れる', 'imperative'],
  ['入り込む', 'imperative'],
  ['行き詰まる', 'potential'],
  ['行き詰まる', 'passive'],
  ['行き詰まる', 'causative'],
  ['行き詰まる', 'volitional'],
  ['行き詰まる', 'imperative'],
  ['付き合う', 'passive'],
  ['枯れる', 'potential'],
  ['枯れる', 'passive'],
  ['枯れる', 'volitional'],
  ['枯れる', 'imperative'],
  ['腐る', 'potential'],
  ['腐る', 'passive'],
  ['腐る', 'volitional'],
  ['腐る', 'imperative'],
  ['凍る', 'potential'],
  ['凍る', 'passive'],
  ['凍る', 'volitional'],
  ['凍る', 'imperative'],
  ['溶ける', 'potential'],
  ['溶ける', 'passive'],
  ['溶ける', 'causative'],
  ['溶ける', 'volitional'],
  ['溶ける', 'imperative'],
  ['明ける', 'potential'],
  ['明ける', 'passive'],
  ['明ける', 'causative'],
  ['明ける', 'volitional'],
  ['明ける', 'imperative'],
  ['暮れる', 'potential'],
  ['暮れる', 'passive'],
  ['暮れる', 'causative'],
  ['暮れる', 'volitional'],
  ['暮れる', 'imperative'],
  ['居眠りする', 'potential'],
  ['居眠りする', 'passive'],
  ['居眠りする', 'volitional'],
  ['居眠りする', 'imperative'],
  ['油断する', 'potential'],
  ['油断する', 'passive'],
  ['油断する', 'volitional'],
  ['油断する', 'imperative'],
  ['辿り着く', 'passive'],
  ['辿り着く', 'causative'],
  ['差し掛かる', 'potential'],
  ['差し掛かる', 'passive'],
  ['差し掛かる', 'causative'],
  ['差し掛かる', 'volitional'],
  ['差し掛かる', 'imperative'],
  ['着替える', 'passive'],
  ['浮き上がる', 'potential'],
  ['浮き上がる', 'passive'],
  ['浮き上がる', 'causative'],
  ['浮き上がる', 'volitional'],
  ['浮き上がる', 'imperative'],
  ['発足する', 'passive'],
  ['発足する', 'volitional'],
  ['発足する', 'imperative'],
  ['対立する', 'potential'],
  ['対立する', 'passive'],
  ['対立する', 'volitional'],
  ['対立する', 'imperative'],
  ['協力する', 'passive'],
  ['競争する', 'passive'],
  ['参る', 'potential'],
  ['参る', 'passive'],
  ['参る', 'causative'],
  ['存じる', 'ta'],
  ['存じる', 'potential'],
  ['存じる', 'passive'],
  ['存じる', 'causative'],
  ['存じる', 'conditional_ba'],
  ['存じる', 'conditional_tara'],
  ['存じる', 'volitional'],
  ['存じる', 'imperative'],
  ['溢れ出す', 'potential'],
  ['溢れ出す', 'passive'],
  ['溢れ出す', 'causative'],
  ['溢れ出す', 'volitional'],
  ['溢れ出す', 'imperative'],
  ['切り抜ける', 'passive'],
  ['張り切る', 'potential'],
  ['張り切る', 'passive'],
  ['振り向く', 'potential'],
  ['打ち勝つ', 'passive'],
  ['立ち止まる', 'passive'],
  ['出会う', 'passive'],
  ['出会う', 'causative'],
  ['出会う', 'imperative'],
  ['噛み締める', 'passive'],
  ['起き上がる', 'passive'],
  ['締まる', 'potential'],
  ['締まる', 'passive'],
  ['締まる', 'causative'],
  ['締まる', 'volitional'],
  ['締まる', 'imperative'],
  ['緩む', 'potential'],
  ['緩む', 'passive'],
  ['緩む', 'causative'],
  ['緩む', 'volitional'],
  ['緩む', 'imperative'],
  ['栄える', 'potential'],
  ['栄える', 'passive'],
  ['栄える', 'causative'],
  ['栄える', 'volitional'],
  ['栄える', 'imperative'],
  ['錆びる', 'potential'],
  ['錆びる', 'passive'],
  ['錆びる', 'causative'],
  ['錆びる', 'volitional'],
  ['錆びる', 'imperative'],
  ['納得する', 'passive'],
  ['納得する', 'volitional'],
  ['納得する', 'imperative'],
  ['察する', 'potential'],
  ['察する', 'passive'],
  ['察する', 'causative'],
  ['察する', 'imperative'],
  ['適する', 'conditional_tara'],
  ['思い至る', 'potential'],
  ['思い至る', 'passive'],
  ['思い至る', 'causative'],
  ['思い至る', 'volitional'],
  ['思い至る', 'imperative'],
  ['立ち回る', 'passive'],
  ['立ち直る', 'passive'],
  ['立ちはだかる', 'potential'],
  ['立ちはだかる', 'passive'],
  ['立ちはだかる', 'causative'],
  ['立ちはだかる', 'volitional'],
  ['立ちはだかる', 'imperative'],
  ['擦れ違う', 'passive'],
  ['擦れ違う', 'causative'],
  ['擦れ違う', 'volitional'],
  ['擦れ違う', 'imperative'],
  ['言い争う', 'volitional'],
  ['言い争う', 'imperative'],
  ['入れ替わる', 'potential'],
  ['入れ替わる', 'passive'],
  ['入れ替わる', 'causative'],
  ['入れ替わる', 'volitional'],
  ['入れ替わる', 'imperative'],
  ['吹き出す', 'potential'],
  ['吹き出す', 'passive'],
  ['吹き出す', 'causative'],
  ['吹き出す', 'volitional'],
  ['吹き出す', 'imperative'],
  ['見出す', 'causative'],
  ['見出す', 'volitional'],
  ['見出す', 'imperative'],
  ['講演する', 'passive'],
  ['講演する', 'imperative'],
  ['合意する', 'passive'],
  ['合意する', 'imperative'],
  ['決裂する', 'potential'],
  ['決裂する', 'passive'],
  ['決裂する', 'causative'],
  ['決裂する', 'volitional'],
  ['決裂する', 'imperative'],
  ['妥結する', 'potential'],
  ['妥結する', 'passive'],
  ['妥結する', 'causative'],
  ['妥結する', 'volitional'],
  ['妥結する', 'imperative'],
  ['所有する', 'volitional'],
  ['所有する', 'imperative'],
  ['譲り合う', 'passive'],
  ['剥ける', 'potential'],
  ['剥ける', 'passive'],
  ['剥ける', 'causative'],
  ['剥ける', 'volitional'],
  ['剥ける', 'imperative'],
  ['すくむ', 'potential'],
  ['すくむ', 'passive'],
  ['すくむ', 'causative'],
  ['すくむ', 'volitional'],
  ['すくむ', 'imperative'],
  ['ずれる', 'potential'],
  ['ずれる', 'passive'],
  ['ずれる', 'causative'],
  ['ずれる', 'volitional'],
  ['ずれる', 'imperative'],
  ['はみ出す', 'potential'],
  ['はみ出す', 'passive'],
  ['はみ出す', 'causative'],
  ['はみ出す', 'volitional'],
  ['はみ出す', 'imperative'],
  ['のめり込む', 'potential'],
  ['のめり込む', 'passive'],
  ['のめり込む', 'causative'],
  ['のめり込む', 'imperative'],
  ['のさばる', 'potential'],
  ['のさばる', 'passive'],
  ['のさばる', 'causative'],
  ['のさばる', 'volitional'],
  ['のさばる', 'imperative'],
  ['ぼやく', 'potential'],
  ['ぼやく', 'passive'],
  ['ぼやく', 'causative'],
  ['ぼやく', 'conditional_ba'],
  ['ぼやく', 'imperative'],
  ['たかる', 'potential'],
  ['たかる', 'volitional'],
  ['たかる', 'imperative'],
  ['ぐずる', 'potential'],
  ['ぐずる', 'passive'],
  ['ぐずる', 'causative'],
  ['ぐずる', 'volitional'],
  ['ぐずる', 'imperative'],
  ['すがる', 'passive'],
  ['すがる', 'imperative'],
  ['まごつく', 'potential'],
  ['まごつく', 'passive'],
  ['まごつく', 'causative'],
  ['まごつく', 'volitional'],
  ['まごつく', 'imperative'],
  ['たじろぐ', 'potential'],
  ['たじろぐ', 'passive'],
  ['たじろぐ', 'causative'],
  ['たじろぐ', 'volitional'],
  ['たじろぐ', 'imperative'],
  ['うろつく', 'volitional'],
  ['うろつく', 'imperative'],
  ['志す', 'passive'],
  ['志す', 'causative'],
  ['見届ける', 'passive'],
  ['分かち合う', 'passive'],
  ['語り合う', 'passive'],
  ['語り合う', 'imperative'],
  ['認め合う', 'passive'],
  ['認め合う', 'imperative'],
  ['補い合う', 'passive'],
  ['補い合う', 'imperative'],
  ['高め合う', 'passive'],
  ['競い合う', 'passive'],
  ['支持する', 'imperative'],
  ['物足りる', 'masu'],
  ['物足りる', 'te'],
  ['物足りる', 'ta'],
  ['物足りる', 'potential'],
  ['物足りる', 'passive'],
  ['物足りる', 'causative'],
  ['物足りる', 'conditional_ba'],
  ['物足りる', 'conditional_tara'],
  ['物足りる', 'volitional'],
  ['物足りる', 'imperative'],
  ['恥じる', 'potential'],
  ['恥じる', 'passive'],
  ['恥じる', 'imperative'],
  ['恥じらう', 'potential'],
  ['恥じらう', 'passive'],
  ['恥じらう', 'causative'],
  ['恥じらう', 'conditional_ba'],
  ['恥じらう', 'volitional'],
  ['恥じらう', 'imperative'],
  ['損なう', 'potential'],
  ['損なう', 'causative'],
  ['損なう', 'imperative'],
  ['損ねる', 'potential'],
  ['損ねる', 'passive'],
  ['損ねる', 'causative'],
  ['損ねる', 'volitional'],
  ['損ねる', 'imperative'],
  ['余る', 'potential'],
  ['余る', 'passive'],
  ['余る', 'volitional'],
  ['余る', 'imperative'],
];

describe('N3 form example sentences', () => {
  const entries: [string, ConjugationForm, string][] = [];
  for (const [verb, forms] of Object.entries(n3dataset)) {
    for (const [form, sentence] of Object.entries(forms)) {
      entries.push([verb, form as ConjugationForm, sentence as string]);
    }
  }

  it('covers a non-trivial number of sentences', () => {
    expect(entries.length).toBeGreaterThan(3000);
  });

  it('matches the expected count by form', () => {
    const counts: Partial<Record<ConjugationForm, number>> = {};
    for (const [, form] of entries) {
      counts[form] = (counts[form] || 0) + 1;
    }
    expect(counts).toEqual(n3ExpectedCountsByForm);
  });

  it('only references N3 verbs that exist', () => {
    for (const verb of Object.keys(n3dataset)) {
      expect(verbs[verb]).toBeDefined();
      expect(verbs[verb].jlpt).toBe('N3');
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

  it('generates no examples for N3 excludeForms forms', () => {
    expectExcludedFormsAbsent('N3', n3dataset);
  });

  it('omits only intentional non-exclude N3 forms', () => {
    expect(nonExcludeOmissions('N3', n3dataset)).toEqual(n3IntentionalOmissions);
  });
});
