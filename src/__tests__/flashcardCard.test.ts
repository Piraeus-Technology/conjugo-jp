import verbsJson from '../data/verbs.json';
import type { VerbData } from '../utils/conjugate';
import { generateFlashcard } from '../utils/flashcardCard';

const verbs = verbsJson as Record<string, VerbData>;

describe('generateFlashcard', () => {
  const entries: [string, VerbData][] = [
    ['食べる', verbs['食べる']],
    ['行く', verbs['行く']],
  ];

  it('uses adaptive weights when choosing the next card', () => {
    const card = generateFlashcard(
      entries,
      ['masu'],
      verb => verb === '行く' ? 5 : 1,
      () => 0.5,
    );

    expect(card?.verb).toBe('行く');
    expect(card?.form).toBe('masu');
  });

  it('returns null when the requested form is unavailable for every verb', () => {
    const card = generateFlashcard(
      [['ある', verbs['ある']]],
      ['potential'],
      () => 1,
    );

    expect(card).toBeNull();
  });
});
