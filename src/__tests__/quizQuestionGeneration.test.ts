import verbsJson from '../data/verbs.json';
import { generateQuestion } from '../utils/quizQuestion';
import type { ConjugationForm, VerbData } from '../utils/conjugate';

const entries = Object.entries(verbsJson as Record<string, VerbData>);

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
});
