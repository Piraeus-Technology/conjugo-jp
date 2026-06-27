import {
  conjugate,
  conjugateReading,
  getConjugationHint,
  ConjugationForm,
  GodanRow,
  VerbData,
} from '../utils/conjugate';

// Helper to make verb data concise in tests
function godan(reading: string, row: GodanRow, overrides?: Partial<Record<ConjugationForm, string>>): VerbData {
  return { reading, group: 'godan', godanRow: row, translation: '', jlpt: 'N5', overrides };
}

function ichidan(reading: string): VerbData {
  return { reading, group: 'ichidan', translation: '', jlpt: 'N5' };
}

function irregular(reading: string, overrides?: Partial<Record<ConjugationForm, string>>): VerbData {
  return { reading, group: 'irregular', translation: '', jlpt: 'N5', overrides };
}

describe('Godan verb conjugation', () => {
  // 書く (kaku) - ku row
  const kaku = godan('かく', 'ku');

  test('dictionary form', () => {
    expect(conjugateReading(kaku, 'dictionary')).toBe('かく');
  });

  test('masu form', () => {
    expect(conjugateReading(kaku, 'masu')).toBe('かきます');
  });

  test('te form', () => {
    expect(conjugateReading(kaku, 'te')).toBe('かいて');
  });

  test('ta form', () => {
    expect(conjugateReading(kaku, 'ta')).toBe('かいた');
  });

  test('nai form', () => {
    expect(conjugateReading(kaku, 'nai')).toBe('かかない');
  });

  test('nakatta form', () => {
    expect(conjugateReading(kaku, 'nakatta')).toBe('かかなかった');
  });

  test('potential form', () => {
    expect(conjugateReading(kaku, 'potential')).toBe('かける');
  });

  test('passive form', () => {
    expect(conjugateReading(kaku, 'passive')).toBe('かかれる');
  });

  test('causative form', () => {
    expect(conjugateReading(kaku, 'causative')).toBe('かかせる');
  });

  test('imperative form', () => {
    expect(conjugateReading(kaku, 'imperative')).toBe('かけ');
  });

  test('conditional ba form', () => {
    expect(conjugateReading(kaku, 'conditional_ba')).toBe('かけば');
  });

  test('conditional tara form', () => {
    expect(conjugateReading(kaku, 'conditional_tara')).toBe('かいたら');
  });

  test('volitional form', () => {
    expect(conjugateReading(kaku, 'volitional')).toBe('かこう');
  });

  test('prohibitive form', () => {
    expect(conjugateReading(kaku, 'prohibitive')).toBe('かくな');
  });
});

describe('Godan te/ta-form sound changes by row', () => {
  test('ku row: 書く → かいて/かいた', () => {
    const v = godan('かく', 'ku');
    expect(conjugateReading(v, 'te')).toBe('かいて');
    expect(conjugateReading(v, 'ta')).toBe('かいた');
  });

  test('iku compounds use 行く te/ta irregular forms', () => {
    const v = godan('もっていく', 'ku');
    expect(conjugateReading(v, 'te')).toBe('もっていって');
    expect(conjugateReading(v, 'ta')).toBe('もっていった');
    expect(conjugateReading(v, 'conditional_tara')).toBe('もっていったら');
  });

  test('gu row: 泳ぐ → およいで/およいだ', () => {
    const v = godan('およぐ', 'gu');
    expect(conjugateReading(v, 'te')).toBe('およいで');
    expect(conjugateReading(v, 'ta')).toBe('およいだ');
  });

  test('su row: 話す → はなして/はなした', () => {
    const v = godan('はなす', 'su');
    expect(conjugateReading(v, 'te')).toBe('はなして');
    expect(conjugateReading(v, 'ta')).toBe('はなした');
  });

  test('tsu row: 待つ → まって/まった', () => {
    const v = godan('まつ', 'tsu');
    expect(conjugateReading(v, 'te')).toBe('まって');
    expect(conjugateReading(v, 'ta')).toBe('まった');
  });

  test('nu row: 死ぬ → しんで/しんだ', () => {
    const v = godan('しぬ', 'nu');
    expect(conjugateReading(v, 'te')).toBe('しんで');
    expect(conjugateReading(v, 'ta')).toBe('しんだ');
  });

  test('bu row: 遊ぶ → あそんで/あそんだ', () => {
    const v = godan('あそぶ', 'bu');
    expect(conjugateReading(v, 'te')).toBe('あそんで');
    expect(conjugateReading(v, 'ta')).toBe('あそんだ');
  });

  test('mu row: 読む → よんで/よんだ', () => {
    const v = godan('よむ', 'mu');
    expect(conjugateReading(v, 'te')).toBe('よんで');
    expect(conjugateReading(v, 'ta')).toBe('よんだ');
  });

  test('ru row: 帰る → かえって/かえった', () => {
    const v = godan('かえる', 'ru');
    expect(conjugateReading(v, 'te')).toBe('かえって');
    expect(conjugateReading(v, 'ta')).toBe('かえった');
  });

  test('u row: 買う → かって/かった', () => {
    const v = godan('かう', 'u');
    expect(conjugateReading(v, 'te')).toBe('かって');
    expect(conjugateReading(v, 'ta')).toBe('かった');
  });
});

describe('Godan u-row special nai form (わ not あ)', () => {
  test('買う → かわない (not かあない)', () => {
    const v = godan('かう', 'u');
    expect(conjugateReading(v, 'nai')).toBe('かわない');
  });

  test('会う → あわない', () => {
    const v = godan('あう', 'u');
    expect(conjugateReading(v, 'nai')).toBe('あわない');
  });
});

describe('Ichidan verb conjugation', () => {
  const taberu = ichidan('たべる');

  test('dictionary form', () => {
    expect(conjugateReading(taberu, 'dictionary')).toBe('たべる');
  });

  test('masu form', () => {
    expect(conjugateReading(taberu, 'masu')).toBe('たべます');
  });

  test('te form', () => {
    expect(conjugateReading(taberu, 'te')).toBe('たべて');
  });

  test('ta form', () => {
    expect(conjugateReading(taberu, 'ta')).toBe('たべた');
  });

  test('nai form', () => {
    expect(conjugateReading(taberu, 'nai')).toBe('たべない');
  });

  test('potential form', () => {
    expect(conjugateReading(taberu, 'potential')).toBe('たべられる');
  });

  test('passive form', () => {
    expect(conjugateReading(taberu, 'passive')).toBe('たべられる');
  });

  test('causative form', () => {
    expect(conjugateReading(taberu, 'causative')).toBe('たべさせる');
  });

  test('imperative form', () => {
    expect(conjugateReading(taberu, 'imperative')).toBe('たべろ');
  });

  test('conditional ba form', () => {
    expect(conjugateReading(taberu, 'conditional_ba')).toBe('たべれば');
  });

  test('volitional form', () => {
    expect(conjugateReading(taberu, 'volitional')).toBe('たべよう');
  });
});

describe('Irregular verb する', () => {
  const suru = irregular('する');

  test('masu form', () => {
    expect(conjugateReading(suru, 'masu')).toBe('します');
  });

  test('te form', () => {
    expect(conjugateReading(suru, 'te')).toBe('して');
  });

  test('nai form', () => {
    expect(conjugateReading(suru, 'nai')).toBe('しない');
  });

  test('potential form', () => {
    expect(conjugateReading(suru, 'potential')).toBe('できる');
  });

  test('passive form', () => {
    expect(conjugateReading(suru, 'passive')).toBe('される');
  });

  test('causative form', () => {
    expect(conjugateReading(suru, 'causative')).toBe('させる');
  });

  test('imperative form', () => {
    expect(conjugateReading(suru, 'imperative')).toBe('しろ');
  });

  test('volitional form', () => {
    expect(conjugateReading(suru, 'volitional')).toBe('しよう');
  });

  test('conditional ba form', () => {
    expect(conjugateReading(suru, 'conditional_ba')).toBe('すれば');
  });
});

describe('Irregular verb 来る', () => {
  const kuru = irregular('くる');

  test('masu form', () => {
    expect(conjugateReading(kuru, 'masu')).toBe('きます');
  });

  test('te form', () => {
    expect(conjugateReading(kuru, 'te')).toBe('きて');
  });

  test('nai form', () => {
    expect(conjugateReading(kuru, 'nai')).toBe('こない');
  });

  test('potential form', () => {
    expect(conjugateReading(kuru, 'potential')).toBe('こられる');
  });

  test('imperative form', () => {
    expect(conjugateReading(kuru, 'imperative')).toBe('こい');
  });

  test('volitional form', () => {
    expect(conjugateReading(kuru, 'volitional')).toBe('こよう');
  });

  test('kanji forms keep 来 for shifted readings', () => {
    expect(conjugate('来る', kuru, 'masu').value).toBe('来ます');
    expect(conjugate('来る', kuru, 'nai').value).toBe('来ない');
  });
});

describe('Compound する verbs', () => {
  const benkyouSuru = irregular('べんきょうする');

  test('masu form', () => {
    expect(conjugateReading(benkyouSuru, 'masu')).toBe('べんきょうします');
  });

  test('te form', () => {
    expect(conjugateReading(benkyouSuru, 'te')).toBe('べんきょうして');
  });

  test('nai form', () => {
    expect(conjugateReading(benkyouSuru, 'nai')).toBe('べんきょうしない');
  });
});

describe('Special verb: 行く (iku) irregular te-form', () => {
  const iku = godan('いく', 'ku', { te: 'いって', ta: 'いった', conditional_tara: 'いったら' });

  test('te form override: いって (not いいて)', () => {
    expect(conjugateReading(iku, 'te')).toBe('いって');
  });

  test('ta form override: いった (not いいた)', () => {
    expect(conjugateReading(iku, 'ta')).toBe('いった');
  });

  test('masu form (regular): いきます', () => {
    expect(conjugateReading(iku, 'masu')).toBe('いきます');
  });
});

describe('〜ゆく compounds (成り行く) use the irregular 行く te/ta', () => {
  // No overrides: the engine must detect the ゆく reading of 行く, not apply the
  // regular godan-ku rule (which would give the wrong なりゆいて / なりゆいた).
  const nariyuku = godan('なりゆく', 'ku');

  test('te form: なりゆって (not なりゆいて)', () => {
    expect(conjugateReading(nariyuku, 'te')).toBe('なりゆって');
  });

  test('ta form: なりゆった (not なりゆいた)', () => {
    expect(conjugateReading(nariyuku, 'ta')).toBe('なりゆった');
  });

  test('conditional_tara: なりゆったら', () => {
    expect(conjugateReading(nariyuku, 'conditional_tara')).toBe('なりゆったら');
  });

  test('masu form (regular): なりゆきます', () => {
    expect(conjugateReading(nariyuku, 'masu')).toBe('なりゆきます');
  });
});

describe('Special verb: ある negative override', () => {
  const aru = godan('ある', 'ru', { nai: 'ない', nakatta: 'なかった' });

  test('nai form override: ない (not あらない)', () => {
    expect(conjugateReading(aru, 'nai')).toBe('ない');
  });

  test('nakatta override: なかった', () => {
    expect(conjugateReading(aru, 'nakatta')).toBe('なかった');
  });
});

describe('Conjugation rule hints', () => {
  test('godan ku te-form mentions the row rule and 行く exception', () => {
    const v = godan('かく', 'ku');
    expect(getConjugationHint(v, 'te')).toContain('く → replace with いて');
    expect(getConjugationHint(v, 'te')).toContain('行く is the exception');
  });

  test('godan u-row negative uses わ', () => {
    const v = godan('かう', 'u');
    expect(getConjugationHint(v, 'nai')).toBe('Godan う-verbs: negative replaces う with わ + ない.');
  });

  test('ichidan masu form explains the dropped る stem', () => {
    const v = ichidan('たべる');
    expect(getConjugationHint(v, 'masu')).toBe('Ichidan: drop る, add ます.');
  });

  test('irregular する potential uses できる', () => {
    const v = irregular('する');
    expect(getConjugationHint(v, 'potential')).toBe('する → できる (irregular).');
  });

  test('irregular くる negative uses こない', () => {
    const v = irregular('くる');
    expect(getConjugationHint(v, 'nai')).toBe('くる → こない (irregular).');
  });
});
