import { conjugateReading, ConjugationForm, VerbData } from '../utils/conjugate';
import verbsJson from '../data/verbs.json';

const verbs = verbsJson as Record<string, VerbData>;

// The honorific godan verbs (くださる/なさる/いらっしゃる/おっしゃる) take an
// irregular い-stem in the polite forms and an い imperative, not the regular
// り-stem / れ that the godan rules would produce. くれる is the one ichidan verb
// whose imperative is くれ, not くれろ. ございます is a frozen polite form.
const cases: [string, ConjugationForm, string][] = [
  // くれる: only the imperative is irregular.
  ['くれる', 'imperative', 'くれ'],
  ['くれる', 'masu', 'くれます'], // regular forms still fine

  ['くださる', 'masu', 'くださいます'],
  ['くださる', 'masu_negative', 'くださいません'],
  ['くださる', 'masu_past', 'くださいました'],
  ['くださる', 'masu_past_negative', 'くださいませんでした'],
  ['くださる', 'imperative', 'ください'],

  ['なさる', 'masu_negative', 'なさいません'],
  ['なさる', 'masu_past', 'なさいました'],
  ['なさる', 'imperative', 'なさい'],

  ['いらっしゃる', 'masu_negative', 'いらっしゃいません'],
  ['いらっしゃる', 'imperative', 'いらっしゃい'],

  ['おっしゃる', 'masu_past', 'おっしゃいました'],
  ['おっしゃる', 'imperative', 'おっしゃい'],
  ['仰る', 'imperative', 'おっしゃい'],

  ['ございます', 'masu_negative', 'ございません'],
  ['ございます', 'masu_past', 'ございました'],
  ['ございます', 'masu_past_negative', 'ございませんでした'],
];

describe('honorific / irregular verb overrides', () => {
  it.each(cases)('%s %s -> %s', (verb, form, expected) => {
    expect(verbs[verb]).toBeDefined();
    expect(conjugateReading(verbs[verb], form)).toBe(expected);
  });

  it('does not regress the regular ichidan imperative (e.g. 食べろ)', () => {
    expect(conjugateReading(verbs['食べる'], 'imperative')).toBe('たべろ');
  });
});
