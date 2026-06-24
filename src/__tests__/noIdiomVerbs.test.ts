import verbsJson from '../data/verbs.json';

const verbs = verbsJson as Record<string, unknown>;

// A "phrase idiom" is a multi-word expression (noun + particle + verb), e.g.
// 清水の舞台から飛び降りる or 本領を発揮する. You can't meaningfully drill the
// conjugation of a whole phrase, so they don't belong in the verb list. The
// detector: an object particle を (never inside a single verb), or a particle
// with kanji on BOTH sides (noun…particle…verb).
const KANJI = /[一-鿿]/;
function isPhraseIdiom(key: string): boolean {
  if (key.includes('を')) return true;
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
// that conjugate normally and learners actually use.
const ALLOWED_IDIOMS = new Set([
  '間に合う',
  '気をつける',
  '気に入る',
  '身に付ける',
  '溜息をつく',
  '支障をきたす',
  '腑に落ちる',
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
});
