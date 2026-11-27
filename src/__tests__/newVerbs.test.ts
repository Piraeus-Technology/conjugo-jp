import verbsJson from '../data/verbs.json';
import n5 from '../data/formExamples.n5.json';
import n4 from '../data/formExamples.n4.json';
import n3 from '../data/formExamples.n3.json';
import n2 from '../data/formExamples.n2.json';
import n1 from '../data/formExamples.n1.json';
import {
  availableForms, conjugate, quizzableForms, ALL_FORMS, type ConjugationForm, type VerbData,
} from '../utils/conjugate';
import { searchWords } from '../utils/wordSearch';

const verbs = verbsJson as Record<string, VerbData>;

describe('form example coverage', () => {
  it.each([['N5', n5], ['N4', n4], ['N3', n3], ['N2', n2], ['N1', n1]] as const)(
    'gives every %s verb at least one non-empty form example in its level file',
    (level, file) => {
      const atLevel = Object.keys(verbs).filter(verb => verbs[verb].jlpt === level).sort();
      expect(Object.keys(file).sort()).toEqual(atLevel);
      for (const [word, forms] of Object.entries(file)) {
        const hasSentence = Object.values(forms).some(sentence =>
          typeof sentence === 'string' && sentence.trim().length > 0);
        expect([word, hasSentence]).toEqual([word, true]);
      }
    },
  );
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
    ['愛する', 'potential', '愛せる', 'あいせる'],
    ['達する', 'causative', '達させる', 'たっさせる'],
    ['罰する', 'passive', '罰せられる', 'ばっせられる'],
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

  it('accounts for every potential spelled like another headword as excluded, natural, or inherited', () => {
    // The pair partners added 痛める, 脱げる and 休める: 痛む's 痛める ("can ache")
    // is unnatural, while 脱げる and 休める are everyday potentials.
    const excluded = ['分かる', '含む', '止む', '片付く', '欠く', '建つ', '痛む'];
    const natural = ['立つ', '切る', '売る', '解く', '裂く', '取る', '焼く', '折る', '割る', '破る', '溶く', '添う', '脱ぐ', '休む'];
    const inherited = [
      'する', '入る', '届く', '続く', '込む', '触る', '並ぶ', '沈む', '浮かぶ', '退く',
      '進む', '叶う', '抜く', '整う', '傾く', '挫く', '開く', 'つく', '向く', '廃る',
      '落ち着く', '和らぐ', '揃う', '縮む', '間違う', '育つ', '緩む', '繋ぐ', '弾く', '剥く', '嗜む',
    ];
    const collisions = Object.entries(verbs).flatMap(([word, data]) => {
      const potential = conjugate(word, data, 'potential').value;
      return potential !== word && Object.prototype.hasOwnProperty.call(verbs, potential) ? [word] : [];
    });
    expect(collisions.sort()).toEqual([...excluded, ...natural, ...inherited].sort());
    for (const [expected, group] of [[false, excluded], [true, natural]] as const) {
      for (const word of group) {
        expect([word, quizzableForms(verbs[word], ALL_FORMS).includes('potential')]).toEqual([word, expected]);
      }
    }
  });

  it.each([
    ['かぶる', 'かぶれる', true],
    ['炊く', '炊ける', true],
    ['苦しむ', '苦しめる', false],
    ['付く', '付ける', false],
    ['構う', '構える', false],
  ])('keeps the expected practice status for %s → %s', (word, potential, offered) => {
    expect(conjugate(word, verbs[word], 'potential').value).toBe(potential);
    expect(quizzableForms(verbs[word], ALL_FORMS).includes('potential')).toBe(offered);
  });

  it.each(['亡くなる', '済む', '優れる', '劣る', '基づく', '次ぐ'])(
    'excludes the stative potential of %s from practice',
    word => {
      expect(quizzableForms(verbs[word], ALL_FORMS)).not.toContain('potential');
    },
  );

  it('keeps every form of 連れる available to practice', () => {
    expect(quizzableForms(verbs['連れる'], ALL_FORMS)).toEqual(ALL_FORMS);
  });

  it('hides all seven unavailable 違う forms from reference tables and practice', () => {
    const data = verbs['違う'];
    const hidden = ['potential', 'passive', 'causative', 'causative_passive', 'imperative', 'prohibitive', 'volitional'];
    expect(ALL_FORMS.filter(form => !availableForms(data, ALL_FORMS).includes(form))).toEqual(hidden);
    expect(ALL_FORMS.filter(form => !quizzableForms(data, ALL_FORMS).includes(form))).toEqual(hidden);
  });
});

describe('exact search ranking', () => {
  it.each([
    '止める', '立てる', '知らせる', '折れる', '焼ける', '割れる', '済ませる', '売れる',
    '切れる', '破れる', '解ける', '取れる', '含める', '裂ける', 'くだらない',
  ])('ranks the dictionary spelling %s first', query => {
    expect(searchWords(query)[0]).toMatchObject({ verb: query, matchType: 'verb' });
  });

  it.each([
    ['すませる', '済ませる'], ['sumaseru', '済ませる'], ['はれる', '晴れる'], ['さす', '差す'],
    ['よる', '寄る'], ['すむ', '住む'], ['うつる', '移る'], ['おさえる', '抑える'], ['はく', '履く'],
    ['kieru', '消える'], ['chigau', '違う'], ['watasu', '渡す'], ['chekkusuru', 'チェックする'],
  ])('ranks an exact reading first for %s', (query, word) => {
    expect(searchWords(query)[0]).toMatchObject({ verb: word, matchType: 'verb' });
  });

  it.each([
    ['とける', '溶ける', '解ける', '解く'],
    ['さける', '避ける', '裂ける', '裂く'],
  ])('shows both dictionary matches for %s ahead of the conjugation', (query, first, second, conjugated) => {
    expect(searchWords(query).slice(0, 3)).toMatchObject([
      { verb: first, matchType: 'verb' }, { verb: second, matchType: 'verb' },
      { verb: conjugated, matchType: 'conjugation' },
    ]);
  });

  it.each([
    ['take', '取る', ['炊く', '焚く']],
    ['sue', '訴える', ['吸う']],
    ['wake', '覚める', ['沸く', '湧く']],
    ['take along', '連れる', []],
    ['wake up', '起きる', []],
    ['wake up', '覚める', []],
    ['give a ride', '乗せる', []],
    ['make', '作る', ['巻く', '蒔く', '撒く']],
  ] as const)('finds the %s gloss for %s ahead of matching romaji forms', (query, word, lower) => {
    const hits = searchWords(query);
    const rank = hits.findIndex(hit => hit.verb === word && hit.matchType === 'verb');
    expect(rank).toBeGreaterThanOrEqual(0);
    expect(rank).toBeLessThan(3);
    for (const conjugated of lower) {
      expect(hits.findIndex(hit => hit.verb === conjugated)).toBeGreaterThan(rank);
    }
  });

  it.each([
    ['被る', 'かぶる', 'verb'], ['被った', 'かぶる', 'conjugation'],
    ['着く', 'つく', 'verb'], ['着いた', 'つく', 'conjugation'],
    ['辞める', 'やめる', 'verb'], ['辞めた', 'やめる', 'conjugation'],
    ['無くす', 'なくす', 'verb'], ['無くした', 'なくす', 'conjugation'],
  ])('looks up %s as an alternate spelling for %s', (query, word, matchType) => {
    expect(searchWords(query)[0]).toMatchObject({ verb: word, matchType });
  });
});
