import { conjugate, conjugateReading, ConjugationForm, VerbData } from '../utils/conjugate';
import { getExampleSentence } from '../utils/formExamples';
import n5 from '../data/formExamples.n5.json';
import n4 from '../data/formExamples.n4.json';
import verbsJson from '../data/verbs.json';

const verbs = verbsJson as Record<string, VerbData>;
const dataset = n5 as Record<string, Partial<Record<ConjugationForm, string>>>;
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
});

const n4dataset = n4 as Record<string, Partial<Record<ConjugationForm, string>>>;
const n4ExpectedCountsByForm: Partial<Record<ConjugationForm, number>> = {
  masu: 173,
  te: 173,
  ta: 173,
  nai: 173,
  potential: 125,
  passive: 112,
  causative: 147,
  conditional_ba: 172,
  conditional_tara: 173,
  volitional: 134,
  imperative: 148,
};

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

  it('generates no examples for excludeForms forms', () => {
    // 見える/聞こえる/足りる have excludeForms — those forms get no example.
    expect(n4dataset['見える']?.['potential']).toBeUndefined();
    expect(getExampleSentence('見える', 'potential')).toBeUndefined();
  });
});
