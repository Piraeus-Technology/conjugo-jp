import { quizzableForms, ALL_FORMS, ConjugationForm, VerbData } from '../utils/conjugate';
import verbsJson from '../data/verbs.json';

const verbs = verbsJson as Record<string, VerbData>;

describe('quizzableForms', () => {
  it('drops the non-existent forms of ある (no あれる/あらせる/...)', () => {
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

  it('reduces ございます to its polite/te/ta forms only', () => {
    const q = quizzableForms(verbs['ございます'], ALL_FORMS);
    expect(q).toContain('masu');
    expect(q).toContain('te');
    expect(q).toContain('ta');
    for (const f of ['nai', 'potential', 'imperative', 'volitional'] as ConjugationForm[]) {
      expect(q).not.toContain(f);
    }
  });

  it('leaves ordinary verbs untouched', () => {
    expect(quizzableForms(verbs['食べる'], ALL_FORMS)).toEqual(ALL_FORMS);
    expect(verbs['食べる'].excludeForms).toBeUndefined();
  });

  it('falls back to the full set rather than returning empty', () => {
    const onlyExcluded: ConjugationForm[] = ['potential'];
    expect(quizzableForms(verbs['ある'], onlyExcluded)).toEqual(onlyExcluded);
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
