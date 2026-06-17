import { romajiToHiragana } from '../utils/kana';

describe('romajiToHiragana', () => {
  test('handles double n as ん instead of small tsu', () => {
    expect(romajiToHiragana('annai')).toBe('あんない');
    expect(romajiToHiragana('kanna')).toBe('かんな');
  });
});
