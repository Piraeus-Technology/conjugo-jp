// Kana row shift table for godan verb conjugation
// Maps the godanRow to kana for each vowel row
export const kanaRows: Record<string, Record<string, string>> = {
  u:   { a: 'わ', i: 'い', u: 'う', e: 'え', o: 'お' },
  ku:  { a: 'か', i: 'き', u: 'く', e: 'け', o: 'こ' },
  gu:  { a: 'が', i: 'ぎ', u: 'ぐ', e: 'げ', o: 'ご' },
  su:  { a: 'さ', i: 'し', u: 'す', e: 'せ', o: 'そ' },
  tsu: { a: 'た', i: 'ち', u: 'つ', e: 'て', o: 'と' },
  nu:  { a: 'な', i: 'に', u: 'ぬ', e: 'ね', o: 'の' },
  bu:  { a: 'ば', i: 'び', u: 'ぶ', e: 'べ', o: 'ぼ' },
  mu:  { a: 'ま', i: 'み', u: 'む', e: 'め', o: 'も' },
  ru:  { a: 'ら', i: 'り', u: 'る', e: 'れ', o: 'ろ' },
};

// Te-form and ta-form sound changes for godan verbs
export const teFormRules: Record<string, { te: string; ta: string }> = {
  ku:  { te: 'いて', ta: 'いた' },
  gu:  { te: 'いで', ta: 'いだ' },
  su:  { te: 'して', ta: 'した' },
  tsu: { te: 'って', ta: 'った' },
  ru:  { te: 'って', ta: 'った' },
  u:   { te: 'って', ta: 'った' },
  nu:  { te: 'んで', ta: 'んだ' },
  bu:  { te: 'んで', ta: 'んだ' },
  mu:  { te: 'んで', ta: 'んだ' },
};

// Extract the stem from a reading by removing the last kana
export function getStem(reading: string): string {
  return reading.slice(0, -1);
}

// Get the kanji stem (everything except the last character of the reading mapped to the verb)
// For verbs like 食べる (たべる), kanji stem = 食べ, kana ending = る
// For verbs like 書く (かく), kanji stem = 書, kana ending = く
export function getKanjiStem(verb: string, reading: string): string {
  // Find how many trailing kana the verb has that match the reading
  let matchLen = 0;
  for (let i = 1; i <= Math.min(verb.length, reading.length); i++) {
    if (verb[verb.length - i] === reading[reading.length - i]) {
      matchLen = i;
    } else {
      break;
    }
  }
  // The kanji part is everything before the matching kana tail
  // We need to remove the last kana (the conjugating character)
  if (matchLen <= 1) {
    // Only the last char matches (e.g., 書く -> く matches)
    return verb.slice(0, -1);
  }
  // Multiple chars match (e.g., 食べる -> べる matches)
  return verb.slice(0, -(matchLen)) + reading.slice(reading.length - matchLen, -1);
}

// Romaji to hiragana conversion table
const romajiMap: [string, string][] = [
  ['sha', 'しゃ'], ['shi', 'し'], ['shu', 'しゅ'], ['sho', 'しょ'],
  ['cha', 'ちゃ'], ['chi', 'ち'], ['chu', 'ちゅ'], ['cho', 'ちょ'],
  ['tsu', 'つ'],
  ['ja', 'じゃ'], ['ji', 'じ'], ['ju', 'じゅ'], ['jo', 'じょ'],
  ['nya', 'にゃ'], ['nyu', 'にゅ'], ['nyo', 'にょ'],
  ['hya', 'ひゃ'], ['hyu', 'ひゅ'], ['hyo', 'ひょ'],
  ['mya', 'みゃ'], ['myu', 'みゅ'], ['myo', 'みょ'],
  ['rya', 'りゃ'], ['ryu', 'りゅ'], ['ryo', 'りょ'],
  ['gya', 'ぎゃ'], ['gyu', 'ぎゅ'], ['gyo', 'ぎょ'],
  ['bya', 'びゃ'], ['byu', 'びゅ'], ['byo', 'びょ'],
  ['pya', 'ぴゃ'], ['pyu', 'ぴゅ'], ['pyo', 'ぴょ'],
  ['kya', 'きゃ'], ['kyu', 'きゅ'], ['kyo', 'きょ'],
  ['ka', 'か'], ['ki', 'き'], ['ku', 'く'], ['ke', 'け'], ['ko', 'こ'],
  ['sa', 'さ'], ['si', 'し'], ['su', 'す'], ['se', 'せ'], ['so', 'そ'],
  ['ta', 'た'], ['ti', 'ち'], ['tu', 'つ'], ['te', 'て'], ['to', 'と'],
  ['na', 'な'], ['ni', 'に'], ['nu', 'ぬ'], ['ne', 'ね'], ['no', 'の'],
  ['ha', 'は'], ['hi', 'ひ'], ['hu', 'ふ'], ['fu', 'ふ'], ['he', 'へ'], ['ho', 'ほ'],
  ['ma', 'ま'], ['mi', 'み'], ['mu', 'む'], ['me', 'め'], ['mo', 'も'],
  ['ya', 'や'], ['yu', 'ゆ'], ['yo', 'よ'],
  ['ra', 'ら'], ['ri', 'り'], ['ru', 'る'], ['re', 'れ'], ['ro', 'ろ'],
  ['wa', 'わ'], ['wi', 'ゐ'], ['we', 'ゑ'], ['wo', 'を'],
  ['ga', 'が'], ['gi', 'ぎ'], ['gu', 'ぐ'], ['ge', 'げ'], ['go', 'ご'],
  ['za', 'ざ'], ['zi', 'じ'], ['zu', 'ず'], ['ze', 'ぜ'], ['zo', 'ぞ'],
  ['da', 'だ'], ['di', 'ぢ'], ['du', 'づ'], ['de', 'で'], ['do', 'ど'],
  ['ba', 'ば'], ['bi', 'び'], ['bu', 'ぶ'], ['be', 'べ'], ['bo', 'ぼ'],
  ['pa', 'ぱ'], ['pi', 'ぴ'], ['pu', 'ぷ'], ['pe', 'ぺ'], ['po', 'ぽ'],
  ['a', 'あ'], ['i', 'い'], ['u', 'う'], ['e', 'え'], ['o', 'お'],
  ['n', 'ん'],
];

export function romajiToHiragana(input: string): string {
  let result = '';
  let remaining = input.toLowerCase();

  while (remaining.length > 0) {
    // Handle double consonant (っ)
    if (remaining.length >= 2 && remaining[0] === remaining[1] && 'bcdfghjklmpqrstvwxyz'.includes(remaining[0])) {
      result += 'っ';
      remaining = remaining.slice(1);
      continue;
    }

    let matched = false;
    for (const [romaji, kana] of romajiMap) {
      if (remaining.startsWith(romaji)) {
        result += kana;
        remaining = remaining.slice(romaji.length);
        matched = true;
        break;
      }
    }

    if (!matched) {
      result += remaining[0];
      remaining = remaining.slice(1);
    }
  }

  return result;
}
