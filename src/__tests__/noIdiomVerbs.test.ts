import verbsJson from '../data/verbs.json';

const verbs = verbsJson as Record<string, unknown>;

// A "phrase idiom" is a multi-word expression (noun + particle + verb), e.g.
// 清水の舞台から飛び降りる or 本領を発揮する. You can't meaningfully drill the
// conjugation of a whole phrase, so they don't belong in the verb list. The
// detector flags: an object particle を (never inside a single verb); a particle
// with kanji on BOTH sides (noun…particle…verb); or a 〜にする/〜になる ending
// (the verb is kana する/なる, which escapes the kanji-both-sides check).
// It's a regression guard, not a complete idiom classifier — と/で-particle
// idioms are removed by hand and not covered here.
const KANJI = /[一-鿿]/;
function isPhraseIdiom(key: string): boolean {
  if (key.includes('を')) return true;
  if (/(に|へ)(する|なる)$/.test(key) && [...key].length > 3) return true;
  for (const p of ['から', 'まで', 'より']) {
    const i = key.indexOf(p);
    if (i > 0 && KANJI.test(key[i - 1])) return true;
  }
  for (const p of ['に', 'が', 'の', 'へ', 'は']) {
    let i = key.indexOf(p);
    while (i !== -1) {
      if (KANJI.test(key.slice(0, i)) && KANJI.test(key.slice(i + 1))) return true;
      i = key.indexOf(p, i + 1);
    }
  }
  return false;
}

// Lexicalized expressions kept on purpose — common, dictionary-headword verbs
// that conjugate normally and learners actually use. ご覧になる is the honorific
// of 見る (kept alongside なさる/くださる/いらっしゃる); 気に入る's 入る reads いる,
// not はいる, so it isn't the standalone 入る.
const ALLOWED_IDIOMS = new Set([
  '間に合う',
  '気をつける',
  '気に入る',
  '身に付ける',
  'ご覧になる',
]);

describe('verb list contains no phrase idioms', () => {
  it('flags no idiom keys outside the allowlist', () => {
    const offenders = Object.keys(verbs).filter(
      (k) => isPhraseIdiom(k) && !ALLOWED_IDIOMS.has(k),
    );
    expect(offenders).toEqual([]);
  });

  it('keeps the allowlisted lexicalized expressions', () => {
    for (const k of ALLOWED_IDIOMS) {
      expect(verbs[k]).toBeDefined();
    }
  });

  it('only uses the nu godan row for 死ぬ-family verbs', () => {
    const invalidNuRowKeys = Object.entries(
      verbsJson as Record<string, { godanRow?: string }>,
    )
      .filter(
        ([key, data]) =>
          data.godanRow === 'nu' && key !== '死ぬ' && !key.endsWith('死ぬ'),
      )
      .map(([key]) => key);

    expect(invalidNuRowKeys).toEqual([]);
  });
});
