import { readFileSync } from 'fs';
import { join } from 'path';
import verbs from '../data/verbs.json';
import {
  ALL_ADJECTIVE_FORMS,
  CLASS_FORMS,
  adjectiveKey,
  adjectiveList,
  adjectiveMap,
  alsoCorrectAdjectiveReadings,
  conjugateAdjective,
  conjugateAdjectiveReading,
  getAdjectiveHint,
  isLookalike,
  listAdjectiveDistractors,
  parseAdjectiveKey,
  practiceAdjectiveForms,
  type AdjectiveForm,
} from '../utils/adjectives';
import { countEligibleAdjectives, generateAdjectiveCard, generateAdjectiveQuestion } from '../utils/adjectivePractice';
import { getConjugationIndex } from '../utils/verbSearch';
import { generatePracticeQuestion, describeQuestion } from '../utils/practiceItems';
import type { VerbData } from '../utils/conjugate';

const KANA = /^[ぁ-ゖァ-ーー]+$/;

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// Ground truth written by hand, not computed by the engine: [display, reading].
const GROUND_TRUTH: Record<string, Partial<Record<AdjectiveForm, [string, string]>>> = {
  高い: {
    polite: ['高いです', 'たかいです'],
    negative: ['高くない', 'たかくない'],
    polite_negative: ['高くないです', 'たかくないです'],
    past: ['高かった', 'たかかった'],
    polite_past: ['高かったです', 'たかかったです'],
    past_negative: ['高くなかった', 'たかくなかった'],
    polite_past_negative: ['高くなかったです', 'たかくなかったです'],
    te: ['高くて', 'たかくて'],
    adverb: ['高く', 'たかく'],
    conditional_ba: ['高ければ', 'たかければ'],
    conditional_tara: ['高かったら', 'たかかったら'],
  },
  静か: {
    plain: ['静かだ', 'しずかだ'],
    before_noun: ['静かな', 'しずかな'],
    polite: ['静かです', 'しずかです'],
    negative: ['静かじゃない', 'しずかじゃない'],
    polite_negative: ['静かじゃないです', 'しずかじゃないです'],
    past: ['静かだった', 'しずかだった'],
    polite_past: ['静かでした', 'しずかでした'],
    past_negative: ['静かじゃなかった', 'しずかじゃなかった'],
    polite_past_negative: ['静かじゃなかったです', 'しずかじゃなかったです'],
    te: ['静かで', 'しずかで'],
    adverb: ['静かに', 'しずかに'],
    conditional_ba: ['静かなら', 'しずかなら'],
    conditional_tara: ['静かだったら', 'しずかだったら'],
  },
  だ: {
    polite: ['です', 'です'],
    negative: ['じゃない', 'じゃない'],
    polite_negative: ['じゃないです', 'じゃないです'],
    past: ['だった', 'だった'],
    polite_past: ['でした', 'でした'],
    past_negative: ['じゃなかった', 'じゃなかった'],
    polite_past_negative: ['じゃなかったです', 'じゃなかったです'],
    te: ['で', 'で'],
    conditional_ba: ['なら', 'なら'],
    conditional_tara: ['だったら', 'だったら'],
  },
  // Irregular: built on よ-, never on い-.
  いい: {
    polite: ['いいです', 'いいです'],
    negative: ['よくない', 'よくない'],
    polite_negative: ['よくないです', 'よくないです'],
    past: ['よかった', 'よかった'],
    polite_past: ['よかったです', 'よかったです'],
    past_negative: ['よくなかった', 'よくなかった'],
    polite_past_negative: ['よくなかったです', 'よくなかったです'],
    te: ['よくて', 'よくて'],
    adverb: ['よく', 'よく'],
    conditional_ba: ['よければ', 'よければ'],
    conditional_tara: ['よかったら', 'よかったら'],
  },
  かっこいい: {
    polite: ['かっこいいです', 'かっこいいです'],
    negative: ['かっこよくない', 'かっこよくない'],
    polite_negative: ['かっこよくないです', 'かっこよくないです'],
    past: ['かっこよかった', 'かっこよかった'],
    polite_past: ['かっこよかったです', 'かっこよかったです'],
    past_negative: ['かっこよくなかった', 'かっこよくなかった'],
    polite_past_negative: ['かっこよくなかったです', 'かっこよくなかったです'],
    te: ['かっこよくて', 'かっこよくて'],
    adverb: ['かっこよく', 'かっこよく'],
    conditional_ba: ['かっこよければ', 'かっこよければ'],
    conditional_tara: ['かっこよかったら', 'かっこよかったら'],
  },
  // Ends in いい and is REGULAR: a spelling rule would get this wrong.
  かわいい: {
    negative: ['かわいくない', 'かわいくない'],
    past: ['かわいかった', 'かわいかった'],
    te: ['かわいくて', 'かわいくて'],
    conditional_ba: ['かわいければ', 'かわいければ'],
  },
  同じ: {
    plain: ['同じだ', 'おなじだ'],
    before_noun: ['同じ', 'おなじ'],
    negative: ['同じじゃない', 'おなじじゃない'],
    adverb: ['同じように', 'おなじように'],
  },
  // A な-adjective that ends in い.
  きれい: {
    negative: ['きれいじゃない', 'きれいじゃない'],
    past: ['きれいだった', 'きれいだった'],
    before_noun: ['きれいな', 'きれいな'],
  },
  有名: {
    negative: ['有名じゃない', 'ゆうめいじゃない'],
    polite_past: ['有名でした', 'ゆうめいでした'],
  },
};

const ALSO_CORRECT: Record<string, Partial<Record<AdjectiveForm, string[]>>> = {
  高い: {
    polite_negative: ['たかくありません'],
    polite_past_negative: ['たかくありませんでした'],
  },
  静か: {
    negative: ['しずかではない'],
    polite_negative: ['しずかじゃありません', 'しずかではありません', 'しずかではないです'],
    past_negative: ['しずかではなかった'],
    polite_past_negative: ['しずかじゃありませんでした', 'しずかではありませんでした', 'しずかではなかったです'],
    conditional_ba: ['しずかならば', 'しずかであれば'],
  },
  同じ: { adverb: ['おなじく', 'おなじに'] },
};

// な-adjectives whose reading ends in い. Their class must stay な.
const LOOKALIKES = ['嫌い', 'きれい', '有名', '失礼', '一生懸命', '丁寧', '得意', 'あいまい', '冷静', '無礼', '詳細', 'ぞんざい', 'ドライ'];

const I_ENDINGS = {
  polite: 'です', negative: 'くない', polite_negative: 'くないです',
  past: 'かった', polite_past: 'かったです', past_negative: 'くなかった',
  polite_past_negative: 'くなかったです', te: 'くて', adverb: 'く',
  conditional_ba: 'ければ', conditional_tara: 'かったら',
};

const NA_ENDINGS = {
  plain: 'だ', before_noun: 'な', polite: 'です', negative: 'じゃない',
  polite_negative: 'じゃないです', past: 'だった', polite_past: 'でした',
  past_negative: 'じゃなかった', polite_past_negative: 'じゃなかったです',
  te: 'で', adverb: 'に', conditional_ba: 'なら', conditional_tara: 'だったら',
};

const COPULA_ENDINGS = {
  polite: 'です', negative: 'じゃない', polite_negative: 'じゃないです',
  past: 'だった', polite_past: 'でした', past_negative: 'じゃなかった',
  polite_past_negative: 'じゃなかったです', te: 'で',
  conditional_ba: 'なら', conditional_tara: 'だったら',
};

const EXPECTED_ENDINGS = { i: I_ENDINGS, na: NA_ENDINGS, copula: COPULA_ENDINGS };
const I_TWINS = ['真っ白', '真っ黒', '同じ', '意地悪', '気軽', '手軽', '真っ暗'];
const TAKES_NO = [
  'いろいろ', '無理', '特別', '正式', '完全', 'わずか', '適度', '得意', '独特', '必死',
  '平等', '高級', 'さかさま', '純粋', '垂直', '水平', '強気', '透明', '特殊', '皮肉',
  '真っ黒', '真っ白', '高度', '好調', '小柄', '孤独', '雑', '一様', '大柄', '肝心',
  '対等', '多忙', '無口', '良質', '急', '懸命', '余分', '自然', '不可欠', '大幅',
  '様々', '十分', '真っ赤', '真っ暗', '真っ青',
];

describe('adjective data', () => {
  it('has one copula and only い/な classes otherwise', () => {
    const classes = adjectiveList.map(([, d]) => d.class);
    expect(classes.filter(c => c === 'copula')).toHaveLength(1);
    expect(new Set(classes)).toEqual(new Set(['i', 'na', 'copula']));
  });

  it('gives every word a kana reading, a level, a gloss and one example', () => {
    for (const [word, data] of adjectiveList) {
      expect([word, KANA.test(data.reading)]).toEqual([word, true]);
      expect(['N5', 'N4', 'N3', 'N2', 'N1']).toContain(data.jlpt);
      expect(data.translation.trim().length).toBeGreaterThan(0);
      expect(data.examples).toHaveLength(1);
      expect(data.examples![0].ja.trim().length).toBeGreaterThan(0);
      expect(data.examples![0].en.trim().length).toBeGreaterThan(0);
    }
  });

  it('spells い-adjectives with a final い, and kana headwords as their reading', () => {
    for (const [word, data] of adjectiveList) {
      if (data.class === 'i') {
        expect([word, word.endsWith('い') && data.reading.endsWith('い')]).toEqual([word, true]);
      }
      if (KANA.test(word)) expect([word, data.reading]).toEqual([word, word]);
    }
  });

  it('has no duplicate top-level keys in the raw adjective JSON', () => {
    const raw = readFileSync(join(process.cwd(), 'src/data/adjectives.json'), 'utf8');
    const keys = Array.from(raw.matchAll(/^  ("(?:[^"\\]|\\.)+"): \{/gm), match => JSON.parse(match[1]));
    expect(keys).toEqual(Object.keys(adjectiveMap));
  });

  it('uses adj: keys to prevent collisions in learning data', () => {
    const verbKeys = new Set(Object.keys(verbs));
    for (const [word] of adjectiveList) {
      expect(adjectiveKey(word)).toBe(`adj:${word}`);
      expect(verbKeys.has(adjectiveKey(word))).toBe(false);
    }
  });

  it('pins the い-twins and the words that accept の before a noun', () => {
    expect(adjectiveList.filter(([, d]) => d.iTwin).map(([word]) => word).sort()).toEqual([...I_TWINS].sort());
    const acceptsNo = adjectiveList.filter(([, d]) => d.variants?.before_noun?.includes(d.reading + 'の'));
    expect(acceptsNo.map(([word]) => word).sort()).toEqual([...TAKES_NO].sort());
    for (const word of TAKES_NO) {
      expect(conjugateAdjective(word, adjectiveMap[word], 'before_noun').alsoCorrect)
        .toEqual([{ value: word + 'の', reading: adjectiveMap[word].reading + 'の' }]);
    }
  });

  it('has no kana spelling that duplicates a kanji entry of the same class', () => {
    const kanaHeads = new Set(adjectiveList.filter(([w]) => KANA.test(w)).map(([w, d]) => `${d.reading}:${d.class}`));
    const duplicates = adjectiveList
      .filter(([w, d]) => !KANA.test(w) && kanaHeads.has(`${d.reading}:${d.class}`))
      .map(([w]) => w);
    expect(duplicates).toEqual([]);
  });

  it('stores the look-alikes as な-adjectives and marks only いい and かっこいい irregular', () => {
    for (const word of LOOKALIKES) expect([word, adjectiveMap[word]?.class]).toEqual([word, 'na']);
    expect(adjectiveList.filter(([, d]) => d.irregular === 'ii').map(([w]) => w).sort()).toEqual(['いい', 'かっこいい']);
    expect(adjectiveMap['かわいい'].irregular).toBeUndefined();
    expect(adjectiveMap['いい加減'].class).toBe('na');
  });

  it('round-trips learning-data keys and rejects verb headwords', () => {
    expect(parseAdjectiveKey(adjectiveKey('高い'))).toBe('高い');
    expect(parseAdjectiveKey('食べる')).toBeNull();
    expect(parseAdjectiveKey('adj:食べる')).toBeNull();
  });
});

describe('adjective conjugation', () => {
  it('matches the hand-written ground truth', () => {
    for (const [word, forms] of Object.entries(GROUND_TRUTH)) {
      const data = adjectiveMap[word];
      for (const [form, [display, reading]] of Object.entries(forms) as [AdjectiveForm, [string, string]][]) {
        const result = conjugateAdjective(word, data, form);
        expect([word, form, result.value, result.reading]).toEqual([word, form, display, reading]);
      }
    }
  });

  it('lists exactly the also-correct variants', () => {
    for (const [word, forms] of Object.entries(ALSO_CORRECT)) {
      for (const [form, expected] of Object.entries(forms) as [AdjectiveForm, string[]][]) {
        expect([word, form, alsoCorrectAdjectiveReadings(adjectiveMap[word], form).sort()])
          .toEqual([word, form, [...expected].sort()]);
      }
    }
    expect(alsoCorrectAdjectiveReadings(adjectiveMap['高い'], 'negative')).toEqual([]);
  });

  it('gives each class exactly its own forms', () => {
    expect(CLASS_FORMS.i).not.toContain('plain');
    expect(CLASS_FORMS.i).not.toContain('before_noun');
    expect(CLASS_FORMS.copula).not.toContain('before_noun');
    expect(CLASS_FORMS.copula).not.toContain('adverb');
    expect(CLASS_FORMS.na).toEqual(expect.arrayContaining(ALL_ADJECTIVE_FORMS));
    expect(() => conjugateAdjectiveReading(adjectiveMap['高い'], 'before_noun')).toThrow();
  });

  it('builds every form of every word from the hand-written ending tables', () => {
    let checked = 0;
    for (const [word, data] of adjectiveList) {
      const endings = EXPECTED_ENDINGS[data.class];
      expect([...CLASS_FORMS[data.class]].sort()).toEqual(Object.keys(endings).sort());
      for (const [form, ending] of Object.entries(endings) as [AdjectiveForm, string][]) {
        const { value, reading } = conjugateAdjective(word, data, form);
        const attach = (head: string) => {
          if (data.class === 'copula') return ending;
          if (data.class === 'na' || form === 'polite') return head + ending;
          if (word === 'いい' || word === 'かっこいい') return head.slice(0, -2) + 'よ' + ending;
          return head.slice(0, -1) + ending;
        };
        const expected = word === '同じ'
          ? GROUND_TRUTH['同じ'][form] ?? [attach(word), attach(data.reading)]
          : [attach(word), attach(data.reading)];
        expect([word, form, value, reading]).toEqual([word, form, ...expected]);
        checked++;
      }
    }
    expect(checked).toBe(6632);
  });
});

describe('adjective quiz options', () => {
  const accepted = (data: typeof adjectiveMap[string], form: AdjectiveForm) =>
    new Set([conjugateAdjectiveReading(data, form), ...alsoCorrectAdjectiveReadings(data, form)]);
  const everyForm = (data: typeof adjectiveMap[string]) => {
    const out = new Set<string>([data.reading]);
    for (const f of CLASS_FORMS[data.class]) {
      out.add(conjugateAdjectiveReading(data, f));
      for (const v of alsoCorrectAdjectiveReadings(data, f)) out.add(v);
    }
    return out;
  };

  it('always offers three distinct wrong options that are never accepted answers', () => {
    let pairs = 0;
    for (const [word, data] of adjectiveList) {
      for (const form of practiceAdjectiveForms(data, ALL_ADJECTIVE_FORMS)) {
        const wrong = listAdjectiveDistractors(data, form);
        expect([word, form, wrong.length, new Set(wrong).size]).toEqual([word, form, 3, 3]);
        const ok = accepted(data, form);
        for (const option of wrong) {
          expect([word, form, option, ok.has(option)]).toEqual([word, form, option, false]);
          expect(KANA.test(option)).toBe(true);
        }
        pairs++;
      }
    }
    expect(pairs).toBeGreaterThan(5000);
  });

  it('never offers another real form of the word, except だ before a noun', () => {
    const offenders: string[] = [];
    for (const [word, data] of adjectiveList) {
      const real = everyForm(data);
      for (const form of practiceAdjectiveForms(data, ALL_ADJECTIVE_FORMS)) {
        for (const option of listAdjectiveDistractors(data, form)) {
          const allowed = form === 'before_noun' && option === data.reading + 'だ';
          if (real.has(option) && !allowed) offenders.push(`${word}:${form}:${option}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the よ- stem among the choices for both irregular adjectives', () => {
    for (const [word, yoStem] of [['いい', 'よ'], ['かっこいい', 'かっこよ']]) {
      const data = adjectiveMap[word];
      for (const form of practiceAdjectiveForms(data, ALL_ADJECTIVE_FORMS)) {
        const wrong = listAdjectiveDistractors(data, form);
        expect(wrong.some(option => option.startsWith(yoStem))).toBe(true);
        if (form === 'polite') expect(wrong.some(option => option.startsWith(data.reading))).toBe(true);
      }
    }
  });

  it('names each offered mistake when the learner picks it', () => {
    for (const [word, data] of adjectiveList) {
      for (const form of practiceAdjectiveForms(data, ALL_ADJECTIVE_FORMS)) {
        for (const option of listAdjectiveDistractors(data, form)) {
          expect(getAdjectiveHint(word, data, form, option)).toContain(`「${option}」`);
        }
      }
    }
  });

  it('excludes verb forms, bare な-adjective negatives and real い-adjective adverbs', () => {
    const verbForms = getConjugationIndex();
    for (const [word, data] of adjectiveList) {
      for (const form of practiceAdjectiveForms(data, ALL_ADJECTIVE_FORMS)) {
        for (const option of listAdjectiveDistractors(data, form)) {
          expect([word, form, option, verbForms.has(option)]).toEqual([word, form, option, false]);
          if (word === '同じ') expect(option.startsWith('おなじの')).toBe(false);
          if (data.class === 'na') expect([data.reading + 'ない', data.reading + 'ないです']).not.toContain(option);
          if (data.class === 'i' && form === 'adverb') expect(option).not.toMatch(/くに$|^おおいに$/);
          if (data.class === 'copula') expect(option).toMatch(/^(だ|で|じゃ)/);
        }
      }
    }
  });

  it('offers the classic mistakes', () => {
    expect(listAdjectiveDistractors(adjectiveMap['高い'], 'polite_past').slice(0, 3)).toContain('たかいでした');
    expect(listAdjectiveDistractors(adjectiveMap['きれい'], 'negative').slice(0, 3)).toContain('きれくない');
    expect(listAdjectiveDistractors(adjectiveMap['いい'], 'negative').slice(0, 3)).toContain('いくない');
    expect(listAdjectiveDistractors(adjectiveMap['同じ'], 'before_noun').slice(0, 3)).toContain('おなじな');
    expect(listAdjectiveDistractors(adjectiveMap['静か'], 'before_noun')).toEqual(expect.arrayContaining(['しずかの', 'しずかだ']));
    expect(listAdjectiveDistractors(adjectiveMap['高い'], 'negative')).toContain('たかいじゃない');
    expect(listAdjectiveDistractors(adjectiveMap['いい'], 'negative')).toContain('いいじゃない');
    expect(listAdjectiveDistractors(adjectiveMap['ドライ'], 'negative')).toContain('ドラくない');
    expect(listAdjectiveDistractors(adjectiveMap['だ'], 'polite_past_negative').slice(0, 3)).toContain('じゃないでした');
    // かわいい is regular, so the よ- form is never its answer and never its mistake.
    expect(conjugateAdjectiveReading(adjectiveMap['かわいい'], 'negative')).toBe('かわいくない');
  });

  it('never offers a real form of a twin word in the other class', () => {
    // 細かい has a な-twin 細か, so こまかに / こまかだった are real Japanese.
    const naEndings = ['だ', 'な', 'です', 'じゃない', 'じゃないです', 'だった', 'でした', 'じゃなかった', 'じゃなかったです', 'で', 'に', 'なら', 'だったら'];
    const iEndings = ['い', 'いです', ...Object.values(I_ENDINGS).filter(ending => ending !== 'です'),
      'くありません', 'くありませんでした'];
    const offenders: string[] = [];
    for (const [word, data] of adjectiveList) {
      for (const form of practiceAdjectiveForms(data, ALL_ADJECTIVE_FORMS)) {
        for (const option of listAdjectiveDistractors(data, form)) {
          if (data.class === 'i' && naEndings.some(e => option === data.reading.slice(0, -1) + e)) offenders.push(`${word}:${option}`);
          if (I_TWINS.includes(word) && iEndings.some(e => option === data.reading + e)) offenders.push(`${word}:${option}`);
        }
      }
    }
    expect(offenders).toEqual([]);
    expect(listAdjectiveDistractors(adjectiveMap['同じ'], 'adverb')).not.toContain('おなじく');
    expect(listAdjectiveDistractors(adjectiveMap['真っ白'], 'negative')).not.toContain('まっしろくない');
    expect(listAdjectiveDistractors(adjectiveMap['細かい'], 'adverb')).not.toContain('こまかに');
  });

  it('practices the Polite form of all 80 N5 adjectives and copula entries', () => {
    const n5 = adjectiveList.filter(([, data]) => data.jlpt === 'N5');
    expect(n5).toHaveLength(80);
    expect(countEligibleAdjectives(n5, ['polite'])).toBe(80);
    for (const entry of n5) {
      const question = generateAdjectiveQuestion(['polite'], () => 1, [entry], () => 0)!;
      const card = generateAdjectiveCard(['polite'], () => 1, [entry], () => 0)!;
      const expected = entry[0] === 'だ' ? 'です' : entry[1].reading + 'です';
      expect([question.form, question.correctAnswer, new Set(question.options).size]).toEqual(['polite', expected, 4]);
      expect([card.form, card.answer]).toEqual(['polite', expected]);
    }
  });
});

describe('adjective hints', () => {
  it('gives every form a hint that contains its answer', () => {
    for (const [word, data] of adjectiveList) {
      for (const form of CLASS_FORMS[data.class]) {
        const hint = getAdjectiveHint(word, data, form);
        expect(hint).not.toContain('also correct');
        expect([word, form, hint.includes(conjugateAdjectiveReading(data, form))]).toEqual([word, form, true]);
      }
    }
  });

  it('tells the learner a look-alike is a な-adjective on every form', () => {
    const lookalikes = adjectiveList.filter(([, d]) => isLookalike(d));
    expect(lookalikes.length).toBeGreaterThan(30);
    for (const [word, data] of lookalikes) {
      for (const form of CLASS_FORMS[data.class]) {
        expect(getAdjectiveHint(word, data, form)).toContain('な-adjective even though it ends in い');
      }
    }
  });

  it('explains the よ- rule for いい and keeps いい only in the polite form', () => {
    expect(getAdjectiveHint('いい', adjectiveMap['いい'], 'negative')).toContain('よ-');
    expect(getAdjectiveHint('いい', adjectiveMap['いい'], 'polite')).toContain('いいです');
  });

  it('uses the special rules for 同じ and identifies the final イ in ドライ', () => {
    expect(getAdjectiveHint('同じ', adjectiveMap['同じ'], 'before_noun')).toContain('takes no な before a noun');
    expect(getAdjectiveHint('同じ', adjectiveMap['同じ'], 'adverb')).toContain('同じ adds ように');
    expect(getAdjectiveHint('ドライ', adjectiveMap['ドライ'], 'negative')).toContain('ends in い (written イ)');
  });

  it('describes the rule without naming an unknown option', () => {
    const data = adjectiveMap['高い'];
    expect(getAdjectiveHint('高い', data, 'polite_past', 'たかかった'))
      .toBe(getAdjectiveHint('高い', data, 'polite_past'));
  });
});

describe('adjective practice generation', () => {
  const allAdjectives = adjectiveList;

  it('returns four distinct options with the answer in a uniform position', () => {
    const random = seeded(7);
    const positions = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) {
      const q = generateAdjectiveQuestion(ALL_ADJECTIVE_FORMS, () => 1, allAdjectives, random)!;
      expect(new Set(q.options).size).toBe(4);
      positions[q.options.indexOf(q.correctAnswer)]++;
    }
    for (const count of positions) {
      expect(count).toBeGreaterThan(850);
      expect(count).toBeLessThan(1150);
    }
  });

  it('returns null when no adjective has an active form', () => {
    expect(generateAdjectiveQuestion([], () => 1, allAdjectives)).toBeNull();
  });

  const verbEntries = Object.entries(verbs as Record<string, VerbData>);

  it('never asks an adjective while adjectives are off', () => {
    const random = seeded(3);
    for (let i = 0; i < 300; i++) {
      const item = generatePracticeQuestion({
        verbEntries, verbForms: ['masu', 'te'], adjectiveEntries: allAdjectives,
        adjectiveForms: ALL_ADJECTIVE_FORMS, adjectivesEnabled: false,
      }, () => 1, random);
      expect(item?.kind).toBe('verb');
    }
  });

  it('mixes both word classes when adjectives are on, with adjective learning keys', () => {
    const random = seeded(11);
    const kinds = { verb: 0, adjective: 0 };
    for (let i = 0; i < 600; i++) {
      const item = generatePracticeQuestion({
        verbEntries, verbForms: ['masu', 'te'], adjectiveEntries: allAdjectives,
        adjectiveForms: ALL_ADJECTIVE_FORMS, adjectivesEnabled: true,
      }, () => 1, random)!;
      kinds[item.kind]++;
      const view = describeQuestion(item);
      if (item.kind === 'adjective') expect(view.srKey).toBe(adjectiveKey(item.question.word));
      else expect(view.srKey).toBe(item.question.verb);
    }
    expect(kinds.adjective).toBeGreaterThan(60);
    expect(kinds.verb).toBeGreaterThan(300);
  });
});
