import { quizzableForms, ALL_FORMS, ConjugationForm, VerbData } from '../utils/conjugate';
import { addSameFormDistractors, chooseQuizzableEntry, VerbEntry } from '../utils/practiceSelection';
import verbsJson from '../data/verbs.json';

const verbs = verbsJson as Record<string, VerbData>;

const honorificExcludeForms: ConjugationForm[] = [
  'potential',
  'passive',
  'causative',
  'causative_passive',
  'volitional',
];

// Spontaneous/stative verbs: no command/intent, and their potential is itself
// (できる/見える/聞こえる) or collides with another verb (分かる→分かれる).
const stativeExcludeForms: ConjugationForm[] = [
  'potential',
  'passive',
  'causative',
  'causative_passive',
  'volitional',
  'imperative',
  'prohibitive',
];

const expectedExcludeForms: Record<string, ConjugationForm[]> = {
  'ある': [
    'potential',
    'passive',
    'causative',
    'causative_passive',
    'volitional',
    'imperative',
    'prohibitive',
  ],
  'ございます': [
    'dictionary',
    'nai',
    'nakatta',
    'potential',
    'passive',
    'causative',
    'causative_passive',
    'imperative',
    'prohibitive',
    'volitional',
    'conditional_ba',
  ],
  'なさる': honorificExcludeForms,
  'くださる': honorificExcludeForms,
  'いらっしゃる': honorificExcludeForms,
  'おっしゃる': honorificExcludeForms,
  '仰る': honorificExcludeForms,
  // 分かる keeps causative (分からせる "make understand" is real)
  '分かる': ['potential', 'passive', 'causative_passive', 'volitional', 'imperative', 'prohibitive'],
  'できる': stativeExcludeForms,
  '出来る': stativeExcludeForms,
  '見える': stativeExcludeForms,
  '聞こえる': stativeExcludeForms,
  '要る': stativeExcludeForms,
  'みえる': stativeExcludeForms,
  'きこえる': stativeExcludeForms,
  '足りる': stativeExcludeForms,
  '似る': stativeExcludeForms,
  '異なる': stativeExcludeForms,
  '適する': stativeExcludeForms,
  '属する': stativeExcludeForms,
};

describe('quizzableForms', () => {
  it('has the exact expected excludeForms lists for special verbs', () => {
    for (const [verb, excludeForms] of Object.entries(expectedExcludeForms)) {
      expect(verbs[verb].excludeForms).toEqual(excludeForms);
    }
  });

  it('drops excluded forms of ある (no あれる/あらせる/...; no rare あろう drill)', () => {
    const q = quizzableForms(verbs['ある'], ALL_FORMS);
    for (const f of ['potential', 'passive', 'causative', 'volitional', 'imperative'] as ConjugationForm[]) {
      expect(q).not.toContain(f);
    }
    expect(q).toContain('masu');
    expect(q).toContain('conditional_ba');
  });

  it('keeps honorific imperatives but drops their potential/passive/causative', () => {
    const q = quizzableForms(verbs['くださる'], ALL_FORMS);
    expect(q).toContain('imperative'); // ください is real
    expect(q).toContain('masu');
    for (const f of ['potential', 'passive', 'causative', 'volitional'] as ConjugationForm[]) {
      expect(q).not.toContain(f);
    }
  });

  it('reduces ございます to its polite/te/ta/tara forms only', () => {
    const q = quizzableForms(verbs['ございます'], ALL_FORMS);
    expect(q).toEqual([
      'masu',
      'masu_negative',
      'masu_past',
      'masu_past_negative',
      'te',
      'ta',
      'conditional_tara',
    ]);
  });

  it('drops spontaneous/stative potential/imperative/prohibitive but 分かる keeps causative', () => {
    const wakaru = quizzableForms(verbs['分かる'], ALL_FORMS);
    expect(wakaru).not.toContain('potential'); // 分かれる collides with 分かれる (to split)
    expect(wakaru).not.toContain('imperative');
    expect(wakaru).not.toContain('prohibitive');
    expect(wakaru).toContain('causative'); // 分からせる is real
    for (const v of ['できる', '見える', '聞こえる', '要る', 'みえる', 'きこえる', '足りる', '似る', '異なる', '適する', '属する']) {
      const q = quizzableForms(verbs[v], ALL_FORMS);
      expect(q).not.toContain('potential');
      expect(q).not.toContain('imperative');
      expect(q).not.toContain('prohibitive');
      expect(q).toContain('masu');
    }
  });

  it('leaves ordinary verbs untouched', () => {
    expect(quizzableForms(verbs['食べる'], ALL_FORMS)).toEqual(ALL_FORMS);
    expect(verbs['食べる'].excludeForms).toBeUndefined();
  });

  it('returns empty when every active form is excluded', () => {
    const onlyExcluded: ConjugationForm[] = ['potential'];
    expect(quizzableForms(verbs['ある'], onlyExcluded)).toEqual([]);
  });

  it('re-picks a verb with an allowed active form after excluded-only choices', () => {
    const entries: VerbEntry[] = [
      ['ある', verbs['ある']],
      ['ございます', verbs['ございます']],
      ['食べる', verbs['食べる']],
    ];
    let calls = 0;
    const selection = chooseQuizzableEntry(
      entries,
      ['potential'],
      () => entries[Math.min(calls++, entries.length - 1)],
      3,
    );
    expect(selection?.entry[0]).toBe('食べる');
    expect(selection?.forms).toEqual(['potential']);
  });

  it('returns null when no verb has an allowed active form', () => {
    const entries: VerbEntry[] = [
      ['ある', verbs['ある']],
      ['ございます', verbs['ございます']],
    ];
    const selection = chooseQuizzableEntry(entries, ['potential'], () => entries[0], 3);
    expect(selection).toBeNull();
  });

  it('never adds same-form distractors from verbs where that form is excluded', () => {
    const entries: VerbEntry[] = [
      ['ある', verbs['ある']],
      ['ございます', verbs['ございます']],
      ['食べる', verbs['食べる']],
    ];
    const wrongAnswers = new Set<string>();
    addSameFormDistractors(
      wrongAnswers,
      entries,
      'potential',
      'のめる',
      3,
      () => 0,
      3,
    );
    expect(Array.from(wrongAnswers)).toEqual(['たべられる']);
  });

  it('every excludeForms value is a valid conjugation form', () => {
    const valid = new Set<string>(ALL_FORMS);
    for (const data of Object.values(verbs)) {
      for (const f of data.excludeForms ?? []) {
        expect(valid.has(f)).toBe(true);
      }
    }
  });
});
