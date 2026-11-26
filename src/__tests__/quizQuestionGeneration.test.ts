import verbsJson from '../data/verbs.json';
import { listQuizDistractors } from '../utils/quizDistractors';
import { generateQuestion } from '../utils/quizQuestion';
import { generateFlashcard } from '../utils/flashcardCard';
import { ALL_FORMS, conjugateReading, quizzableForms, type ConjugationForm, type VerbData } from '../utils/conjugate';

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

  it('offers the same verb in the requested form with other rules in single-form practice', () => {
    const question = generateQuestion(['te'], () => 1, [['買う', verbs['買う']]])!;
    expect(question.form).toBe('te');
    expect(new Set(question.options)).toEqual(new Set(['かって', 'かいて', 'かんで', 'かいで']));
    expect(question.options.every(option => /[てで]$/.test(option))).toBe(true);
  });

  it('fills a sparse honorific question using only alternative rules for that verb', () => {
    const pair: [string, VerbData] = ['ございます', verbs['ございます']];
    const question = generateQuestion(['masu'], () => 1, [pair])!;
    expect(new Set(question.options)).toEqual(new Set(['ございます', 'ございますます', 'ございまます', 'ございまします']));
    expect(question.options).not.toContain('ござります');
  });

  it('lists enough unique kana options for every quizzable verb and form without using any dictionary or reference form', () => {
    let checked = 0;
    for (const [verb, data] of entries) {
      const reference = new Set([data.reading, ...ALL_FORMS.map(form => conjugateReading(data, form))]);
      for (const form of quizzableForms(data, ALL_FORMS)) {
        const { primary, fallback } = listQuizDistractors(data, form);
        const options = [...primary, ...fallback];
        if (options.length < 3 || new Set(options).size !== options.length ||
            options.some(answer => reference.has(answer) || !/^[ぁ-ゖー]+$/.test(answer))) {
          throw new Error(`${verb} ${form} has unsuitable distractors: ${options.join(', ')}`);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(25_000);
  });

  it.each([
    ['食べる', 'potential', ['たべれる', 'たべれれる', 'たべえる']],
    ['見る', 'potential', ['みれる']],
    ['来る', 'potential', ['これる', 'これれる']],
    ['行く', 'potential', ['いけれる', 'いかれる']],
    ['飲む', 'causative_passive', ['のまされる']],
    ['食べる', 'causative_passive', ['たべさされる']],
    ['飲む', 'causative', ['のます']],
    ['食べる', 'causative', ['たべさす']],
    ['食べる', 'imperative', ['たべよ', 'たべれ', 'たべ']],
    ['くれる', 'imperative', ['くれろ', 'くれよ', 'くれれ']],
    ['する', 'imperative', ['せよ', 'せい', 'しよ']],
    ['勉強する', 'imperative', ['べんきょうせよ', 'べんきょうしよ']],
    ['来る', 'imperative', ['こよ', 'これ', 'きい']],
    ['行く', 'te', ['いいて', 'いて']],
    ['行く', 'ta', ['いいた', 'いた']],
    ['買う', 'ta', ['かうた']],
    ['書く', 'prohibitive', ['かきな']],
    ['起きる', 'prohibitive', ['おきな']],
    ['くださる', 'imperative', ['くだされ']],
    ['いらっしゃる', 'imperative', ['いらっしゃれ']],
    ['なさる', 'masu', ['なさります']],
    ['くださる', 'masu', ['くださります']],
    ['適する', 'nai', ['てきさない']],
    ['属する', 'nai', ['ぞくさない']],
  ] as [string, ConjugationForm, string[]][])('does not treat attested %s %s variants as wrong', (verb, form, accepted) => {
    const { primary, fallback } = listQuizDistractors(verbs[verb], form);
    for (const alternative of accepted) {
      expect([...primary, ...fallback]).not.toContain(alternative);
    }
  });
});
