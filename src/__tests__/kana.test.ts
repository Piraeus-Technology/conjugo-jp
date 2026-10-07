import { romajiToHiragana } from '../utils/kana';

describe('romajiToHiragana', () => {
  test('supports Hepburn and IME variants without changing existing spellings', () => {
    const cases: Record<string, string> = {
      setchisuru: 'せっちする', hatchuusuru: 'はっちゅうする', matcha: 'まっちゃ',
      gambaru: 'がんばる', shimpai: 'しんぱい', sampo: 'さんぽ', gamma: 'がんま',
      sya: 'しゃ', syu: 'しゅ', syo: 'しょ', tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ',
      jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ', zya: 'じゃ', zyu: 'じゅ', zyo: 'じょ',
      cya: 'ちゃ', cyu: 'ちゅ', cyo: 'ちょ', dya: 'ぢゃ', dyu: 'ぢゅ', dyo: 'ぢょ',
      syi: 'し', sye: 'しぇ', tyi: 'ち', tye: 'ちぇ', jyi: 'じ', jye: 'じぇ', zyi: 'じ', zye: 'じぇ',
      tyotto: 'ちょっと', jyuu: 'じゅう', ganbaru: 'がんばる', settisuru: 'せっちする',
      kitte: 'きって', nn: 'んん', annai: 'あんない', kanna: 'かんな',
    };
    for (const [romaji, kana] of Object.entries(cases)) expect(romajiToHiragana(romaji)).toBe(kana);
  });

  test('handles double n as ん instead of small tsu', () => {
    expect(romajiToHiragana('annai')).toBe('あんない');
    expect(romajiToHiragana('kanna')).toBe('かんな');
  });
});
