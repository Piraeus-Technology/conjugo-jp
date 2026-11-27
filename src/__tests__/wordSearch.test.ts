import { searchVerbs } from '../utils/verbSearch';
import { searchWords } from '../utils/wordSearch';

describe('searching verbs and adjectives together', () => {
  it.each([
    ['たかくなかった', '高い', 'past_negative'],
    ['高くなかった', '高い', 'past_negative'],
    ['しずかじゃない', '静か', 'negative'],
    ['静かではありません', '静か', 'polite_negative'],
    ['よかった', 'いい', 'past'],
    ['きれいじゃない', 'きれい', 'negative'],
    ['かっこよくて', 'かっこいい', 'te'],
    ['でした', 'だ', 'polite_past'],
  ])('finds the adjective from its form %s', (query, word, form) => {
    const [first] = searchWords(query);
    expect(first).toMatchObject({ kind: 'adjective', verb: word, matchType: 'conjugation', matchForm: form });
  });

  it('finds an adjective by headword, kana, romaji and English', () => {
    for (const query of ['高い', 'たかい', 'takai', 'expensive']) {
      expect(searchWords(query).some(r => r.kind === 'adjective' && r.verb === '高い')).toBe(true);
    }
    expect(searchWords('はんさむ')[0]).toMatchObject({ kind: 'adjective', verb: 'ハンサム' });
  });

  it('keeps every verb result in the order searchVerbs gives it', () => {
    for (const query of ['たべる', 'taberu', 'eat', 'する', 'かく', 'miru', 'のむ', '行った', 'open']) {
      const verbsOnly = searchWords(query).filter(r => r.kind === 'verb').map(r => r.verb);
      const expected = searchVerbs(query).map(r => r.verb);
      expect(expected.slice(0, verbsOnly.length)).toEqual(verbsOnly);
    }
    expect(searchWords('たべる')[0]).toMatchObject({ kind: 'verb', verb: '食べる' });
  });

  it('applies the word-class filters to adjectives', () => {
    const godanOnly = searchWords('たかい', item => item.group === 'godan');
    expect(godanOnly.some(r => r.kind === 'adjective')).toBe(false);
    const iOnly = searchWords('たかい', item => item.group === 'i-adjective');
    expect(iOnly.every(r => r.kind === 'adjective' && r.group === 'i-adjective')).toBe(true);
    expect(iOnly[0].verb).toBe('高い');
  });
});
