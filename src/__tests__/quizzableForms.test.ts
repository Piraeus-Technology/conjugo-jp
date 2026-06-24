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
