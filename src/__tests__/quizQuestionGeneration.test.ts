import verbsJson from '../data/verbs.json';
import { generateQuestion } from '../utils/quizQuestion';
import { ALL_FORMS, type ConjugationForm, type VerbData } from '../utils/conjugate';

const verbs = verbsJson as Record<string, VerbData>;
const entries = Object.entries(verbs);

describe('generateQuestion', () => {
  it('produces exactly four options for a normal quizzable question', () => {
    const question = generateQuestion(['masu'], () => 1, entries);

    expect(question).not.toBeNull();
    expect(question?.options).toHaveLength(4);
    expect(new Set(question?.options).size).toBe(4);
    expect(question?.options).toContain(question?.correctAnswer);
  });

  it('returns null when filters leave no quizzable question', () => {
    expect(generateQuestion(['masu'], () => 1, [])).toBeNull();
    expect(generateQuestion([] as ConjugationForm[], () => 1, entries)).toBeNull();
  });

  it('uses all quizzable forms of the same verb in single-form practice', () => {
    const allowedForms: ConjugationForm[] = ['dictionary', 'masu', 'te', 'nai'];
    const data: VerbData = {
      ...verbs['食べる'],
      excludeForms: ALL_FORMS.filter(form => !allowedForms.includes(form)),
      unavailableForms: ['potential'],
    };

    const question = generateQuestion(['dictionary'], () => 1, [['食べる', data]]);

    expect(question?.form).toBe('dictionary');
    expect(new Set(question?.options)).toEqual(new Set([
      'たべる',
      'たべます',
      'たべて',
      'たべない',
    ]));
  });

  it('keeps same-verb distractors and fills remaining slots from other verbs', () => {
    const data: VerbData = {
      ...verbs['食べる'],
      excludeForms: ALL_FORMS.filter(form => !['dictionary', 'masu'].includes(form)),
    };

    const question = generateQuestion(
      ['dictionary'],
      () => 1,
      [['食べる', data]],
    );

    expect(question?.options).toHaveLength(4);
    expect(new Set(question?.options).size).toBe(4);
    expect(question?.options).toContain('たべます');
    expect(question?.options.filter(option => !['たべる', 'たべます'].includes(option))).toHaveLength(2);
  });
});
