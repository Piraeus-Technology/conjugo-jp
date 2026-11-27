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
    for (const query of ['たべる', 'taberu', 'eat', 'する', 'かく', 'miru', 'のむ', '行った', 'easy', 'cold', 'fine', 'open', 'nara', 'こい', 'かって']) {
      const verbsOnly = searchWords(query).flatMap(result => {
        if (result.kind !== 'verb') return [];
        const { kind: _kind, ...verb } = result;
        return [verb];
      });
      expect(verbsOnly).toEqual(searchVerbs(query));
    }
    expect(searchWords('たべる')[0]).toMatchObject({ kind: 'verb', verb: '食べる' });
  });

  it('ranks dictionary forms before conjugations and exact glosses before partial matches', () => {
    const open = searchWords('open');
    expect(open[0]).toMatchObject({ kind: 'verb', verb: '開ける' });
    expect(open.slice(0, 3)).toContainEqual(expect.objectContaining({ kind: 'adjective', verb: '露骨' }));
    expect(searchWords('こい').slice(0, 2)).toMatchObject([
      { kind: 'adjective', verb: '濃い' },
      { kind: 'verb', verb: '来る', matchForm: 'imperative' },
    ]);
    expect(searchWords('かって').slice(0, 3)).toMatchObject([
      { kind: 'adjective', verb: '勝手' },
      { kind: 'verb', verb: '買う', matchForm: 'te' },
      { kind: 'verb', verb: '勝つ', matchForm: 'te' },
    ]);
    const partial = searchWords('ope');
    expect(partial.findIndex(row => row.verb === '露骨')).toBeGreaterThan(searchVerbs('ope').length - 1);
    expect(searchWords('nara')[0]).toMatchObject({ kind: 'adjective', verb: 'だ', matchForm: 'conditional_ba' });
  });

  it.each([
    ['mijika', '短い'], ['mijika', '身近'], ['chikarazuyoi', '力強い'],
    ['chikarazuyokatta', '力強い'], ['kokorozuyoi', '心強い'],
    ['sumaato', 'スマート'], ['yuniiku', 'ユニーク'], ['ruuzu', 'ルーズ'], ['taimurii', 'タイムリー'],
  ])('finds %s as %s with Hepburn or a long vowel', (query, word) => {
    expect(searchWords(query)).toContainEqual(expect.objectContaining({ kind: 'adjective', verb: word }));
  });

  it('applies the word-class filters to adjectives', () => {
    const godanOnly = searchWords('たかい', item => item.group === 'godan');
    expect(godanOnly.some(r => r.kind === 'adjective')).toBe(false);
    const iOnly = searchWords('たかい', item => item.group === 'i-adjective');
    expect(iOnly.every(r => r.kind === 'adjective' && r.group === 'i-adjective')).toBe(true);
    expect(iOnly[0].verb).toBe('高い');
  });
});
