import verbsJson from '../data/verbs.json';
import { generateQuestion } from '../utils/quizQuestion';
import { generateFlashcard } from '../utils/flashcardCard';
import { ALL_FORMS, type ConjugationForm, type VerbData } from '../utils/conjugate';

const verbs = verbsJson as Record<string, VerbData>;
const entries = Object.entries(verbs);

describe('generateQuestion', () => {
  it('balances both practice modes without file-order bias and still raises weak verbs', () => {
    let seed = 20261007;
    const random = jest.spyOn(Math, 'random').mockImplementation(() => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    });
    try {
      const pickers = [
        (pool: [string, VerbData][], weight: (verb: string) => number) => generateQuestion(['masu'], weight, pool),
        (pool: [string, VerbData][], weight: (verb: string) => number) => generateFlashcard(pool, ['masu'], weight),
      ];
      for (const pick of pickers) {
        const levels: Record<string, number> = {};
        for (let i = 0; i < 5000; i++) {
          const level = verbs[pick(entries, () => 1)!.verb].jlpt;
          levels[level] = (levels[level] ?? 0) + 1;
        }
        expect(Object.keys(levels)).toHaveLength(5);
        expect(Math.max(...Object.values(levels)) / 5000).toBeLessThan(0.3);

        const n1 = entries.filter(([, data]) => data.jlpt === 'N1');
        const first = new Set(n1.slice(0, 200).map(([verb]) => verb));
        for (const pool of [n1, [...n1].reverse()]) {
          let count = 0;
          for (let i = 0; i < 3000; i++) if (first.has(pick(pool, () => 1)!.verb)) count++;
          expect(Math.abs(count / 3000 - 200 / n1.length)).toBeLessThan(0.04);
        }

        const pair: [string, VerbData][] = [['食べる', verbs['食べる']], ['行く', verbs['行く']]];
        let weakCount = 0;
        for (let i = 0; i < 500; i++) {
          if (pick(pair, verb => verb === '行く' ? 5 : 1)!.verb === '行く') weakCount++;
        }
        expect(weakCount / 500).toBeGreaterThan(0.75);
      }
    } finally {
      random.mockRestore();
    }
  });

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
