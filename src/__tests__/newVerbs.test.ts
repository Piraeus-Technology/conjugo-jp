import verbsJson from '../data/verbs.json';
import n5 from '../data/formExamples.n5.json';
import n4 from '../data/formExamples.n4.json';
import n3 from '../data/formExamples.n3.json';
import {
  availableForms, conjugate, quizzableForms, ALL_FORMS, type ConjugationForm, type VerbData,
} from '../utils/conjugate';
import { searchVerbs } from '../utils/verbSearch';

const verbs = verbsJson as Record<string, VerbData>;

describe('N5–N3 example coverage', () => {
  it.each([['N5', n5], ['N4', n4], ['N3', n3]] as const)('gives every %s verb its example sentences', (level, file) => {
    const atLevel = Object.keys(verbs).filter(verb => verbs[verb].jlpt === level).sort();
    expect(Object.keys(file).sort()).toEqual(atLevel);
  });
});

describe('verbs added from the JLPT lists', () => {
  // Hand-written ground truth, not computed by the engine: [display, reading].
  const truth: [string, ConjugationForm, string, string][] = [
    ['消える', 'nai', '消えない', 'きえない'],
    ['渡す', 'te', '渡して', 'わたして'],
    ['吸う', 'masu', '吸います', 'すいます'],
    ['返す', 'potential', '返せる', 'かえせる'],
    ['上がる', 'ta', '上がった', 'あがった'],
    ['合う', 'causative', '合わせる', 'あわせる'],
    ['済む', 'causative', '済ませる', 'すませる'],
    ['行う', 'te', '行って', 'おこなって'],
    // う-special: 問うて, never 問って.
    ['問う', 'te', '問うて', 'とうて'],
    ['問う', 'ta', '問うた', 'とうた'],
    ['問う', 'conditional_tara', '問うたら', 'とうたら'],
    ['問う', 'masu', '問います', 'といます'],
  ];

  it.each(truth)('conjugates %s (%s) as %s', (verb, form, display, reading) => {
    const result = conjugate(verb, verbs[verb], form);
    expect([result.value, result.reading]).toEqual([display, reading]);
  });

  it('keeps homophones with different kanji as separate verbs', () => {
    for (const [a, b] of [['合う', '会う'], ['済む', '住む'], ['移る', '映る'], ['寄る', '拠る']]) {
      expect(verbs[a]).toBeDefined();
      expect(verbs[b]).toBeDefined();
      expect(verbs[a].reading).toBe(verbs[b].reading);
      expect(verbs[a].translation).not.toBe(verbs[b].translation);
    }
  });

  it('never quizzes a potential spelled like another verb', () => {
    for (const [verb, other] of [['止む', '止める'], ['建つ', '建てる'], ['溶く', '溶ける'], ['破る', '破れる'], ['片付く', '片付ける'], ['欠く', '欠ける'], ['添う', '添える']]) {
      expect([verb, conjugate(verb, verbs[verb], 'potential').value]).toEqual([verb, other]);
      expect([verb, quizzableForms(verbs[verb], ALL_FORMS).includes('potential')]).toEqual([verb, false]);
    }
  });

  it('hides the forms 違う does not have', () => {
    const shown = availableForms(verbs['違う'], ALL_FORMS);
    for (const form of ['potential', 'passive', 'volitional', 'imperative', 'prohibitive'] as ConjugationForm[]) {
      expect(shown).not.toContain(form);
    }
    expect(shown).toContain('nai');
  });

  it('finds the new verbs by romaji, and keeps English meanings ahead of romaji forms', () => {
    expect(searchVerbs('kieru')[0]).toMatchObject({ verb: '消える' });
    expect(searchVerbs('chigau')[0]).toMatchObject({ verb: '違う' });
    expect(searchVerbs('watasu')[0]).toMatchObject({ verb: '渡す' });
    // "make" is also the romaji imperative まけ of 巻く/蒔く/撒く.
    expect(searchVerbs('make')[0]).toMatchObject({ verb: '作る' });
  });
});
