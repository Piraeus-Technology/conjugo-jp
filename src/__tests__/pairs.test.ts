import AsyncStorage from '@react-native-async-storage/async-storage';
import verbsJson from '../data/verbs.json';
import { ALL_FORMS, conjugate, type JLPTLevel, type VerbData } from '../utils/conjugate';
import {
  PAIR_BLANK,
  buildPairQuestion,
  isPairEligible,
  pairKey,
  pairList,
  parsePairKey,
  partnersOf,
  type PairSide,
} from '../utils/pairs';
import { describeQuestion, generatePracticeQuestion, type PracticePool } from '../utils/practiceItems';
import { buildPracticeInsights } from '../utils/practiceInsights';
import {
  __resetPracticeSettingsStoreForTests,
  usePracticeSettingsStore,
} from '../store/practiceSettingsStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const verbs = verbsJson as Record<string, VerbData>;
const sides = ['intransitive', 'transitive'] as const;

// Pin each reviewed sentence so a wording change requires rechecking the reason.
const potentialCollisions: Record<string, [sentence: string, reason: string]> = {
  '開く/開ける intransitive': ['誰もいない部屋で、風にあおられてドアが{}。', 'The gust directly opens the door in an empty room. There is no person whose ability is being described.'],
  '売れる/売る transitive': ['使わなくなった本を、週末のフリーマーケットで{}ください。', 'The request asks someone to sell the books. 売れてください cannot request the ability to sell.'],
  '切れる/切る transitive': ['折り紙に使う紙を、正方形に{}あります。', 'The squares are the result of cutting the paper. The potential 切れて cannot denote that completed preparation with てある.'],
  '立つ/立てる intransitive': ['玄関に大きな石像が{}いる。', 'A stone statue stands in the entryway. It has no physical capacity to stand up.'],
  'つく/つける intransitive': ['人が近づくと、玄関の明かりが自動で{}。', 'A person approaching triggers the light to come on. 自動で describes that event and there is no agent for the potential of つく.'],
  '付く/つける intransitive': ['シャツにカレーのしみが{}。', 'Curry stains the shirt. The stain cannot manage to attach itself.'],
  '届く/届ける intransitive': ['昨日、母から荷物が{}。', 'The parcel arrives from someone. It cannot manage to reach something and 母から supplies its origin.'],
  '取れる/取る transitive': ['棚の上の箱を{}ください。', 'The request is to get the box down. 取れてください cannot request the ability to reach it.'],
  '脱げる/脱ぐ transitive': ['家に入る前に靴を{}ください。', 'Removing shoes before entry is the requested action. 脱げてください cannot ask someone to be able to take them off.'],
  '浮かぶ/浮かべる intransitive': ['空に白い雲が{}いる。', 'Clouds hang in the sky. They cannot exercise an ability to float.'],
  '折れる/折る transitive': ['まず、この折り紙を三角形に{}ください。', 'The first instruction is to fold the paper into a triangle. 折れてください cannot request the ability to fold it.'],
  '片付く/片付ける intransitive': ['やっと部屋が{}。', 'The room is finally tidy. A room cannot manage to become tidy and the potential of 片付く takes no object.'],
  '叶う/叶える intransitive': ['長年の夢が{}。', 'The dream came true. The dream cannot exercise an ability to be realized.'],
  '沈む/沈める intransitive': ['夕日が海に{}。', 'The setting sun goes below the horizon. The sun has no ability to sink itself into the sea.'],
  '育つ/育てる intransitive': ['庭のトマトが大きく{}。', 'The tomatoes grew large. The plants do not exercise an ability to grow large.'],
  '建つ/建てる intransitive': ['駅前に新しいビルが{}。', 'The building went up in front of the station. The building cannot manage to rise on its own.'],
  '続く/続ける intransitive': ['この雨があさってまで{}。', 'The forecast says how long the rain lasts. The rain has no capacity to choose or manage to continue.'],
  '並ぶ/並べる intransitive': ['棚に色とりどりの花瓶が{}いる。', 'The vases are standing in a row. They cannot line up on their own.'],
  '焼ける/焼く transitive': ['お客さんが来る前に、庭のグリルで肉を{}あります。', 'The meat is grilled in advance. The potential 焼けて cannot describe the result of that preparation with てある.'],
  '割れる/割る transitive': ['このボウルに卵を二つ{}ください。', 'The instruction is to crack two eggs into the bowl. 割れてください cannot request the ability to crack eggs.'],
  '落ち着く/落ち着ける intransitive': ['日が暮れると、外の騒ぎがようやく{}。', 'The commotion died down after dark. The noise itself cannot manage to calm down.'],
  '進む/進める intransitive': ['工事が予定どおりに{}。', 'The work progressed on schedule. Construction work cannot exercise the ability to advance.'],
  '縮む/縮める intransitive': ['洗濯したら、セーターが{}。', 'The wash shrank the sweater. The sweater cannot exercise an ability to shrink.'],
  '解ける/解く transitive': ['荷物のひもを{}あるから、すぐに箱を開けられます。', 'The string was untied in advance. The potential 解けて cannot describe the result of untying it with てある.'],
  '抜ける/抜く transitive': ['植え替えの前に、花壇の雑草を全部{}あります。', 'The weeds were pulled in advance. The potential 抜けて cannot describe the result of pulling them with てある.'],
  '向く/向ける intransitive': ['この部屋の窓が全部、南に{}いる。', 'The windows face south as part of the building. They cannot manage to orient themselves.'],
  '剥ける/剥く transitive': ['りんごの皮を{}ください。', 'The speaker wants the apple peeled. 剥けてください cannot request the ability to peel it.'],
  '破れる/破る transitive': ['いらない紙を半分に{}ください。', 'The speaker asks for the paper to be torn. 破れてください cannot request the ability to tear it.'],
  '緩む/緩める intransitive': ['古い椅子のねじが{}。', 'The screw came loose. The screw cannot manage to loosen itself.'],
  '痛む/痛める intransitive': ['雨の日は古い傷が{}。', 'The old wound aches in rainy weather. Aching is a symptom and 痛む has no ability reading here.'],
  '傾く/傾ける intransitive': ['地震のあと、家が少し{}いる。', 'The house is leaning after an earthquake. It cannot exercise the ability to tilt.'],
  '裂ける/裂く transitive': ['ひもにするために、布を細長く{}あります。', 'The cloth is already in strips. The potential 裂けて cannot express the result of tearing it with てある.'],
  '揃う/揃える intransitive': ['注文した部品がやっと全部{}。', 'All the parts are finally present. They cannot manage to assemble themselves.'],
  '整う/整える intransitive': ['出発の準備が{}。', 'The preparations are complete. Preparations cannot manage to become ready.'],
  '和らぐ/和らげる intransitive': ['春になって、寒さが{}。', 'The cold eased in spring. The weather cannot exercise an ability to soften.'],
};

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe('transitivity pair data', () => {
  it('lists each pair once with an intransitive first verb and a transitive second verb', () => {
    const keys = pairList.map(([key]) => key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const [, pair] of pairList) {
      expect([pair.intransitive, verbs[pair.intransitive]?.transitive]).toEqual([pair.intransitive, false]);
      expect([pair.transitive, verbs[pair.transitive]?.transitive]).toEqual([pair.transitive, true]);
    }
  });

  it('gives each prompt one blank, a valid form, a translation, and a cue from the sentence', () => {
    for (const [key, pair] of pairList) {
      for (const [side, sentence] of [['intransitive', pair.intransitiveSentence], ['transitive', pair.transitiveSentence]] as const) {
        expect([key, side, sentence.ja.split(PAIR_BLANK).length]).toEqual([key, side, 2]);
        expect([key, side, ALL_FORMS.includes(sentence.form)]).toEqual([key, side, true]);
        expect([key, side, /[。！？]$/.test(sentence.ja), sentence.en.length > 0]).toEqual([key, side, true, true]);
        expect([key, side, sentence.ja.includes(sentence.cue)]).toEqual([key, side, true]);
      }
    }
  });

  it('uses a が cue and no を in intransitive prompts and a を cue in transitive prompts', () => {
    for (const [key, pair] of pairList) {
      expect([key, pair.intransitiveSentence.cue.endsWith('が'), pair.intransitiveSentence.ja.includes('を')])
        .toEqual([key, true, false]);
      expect([key, pair.transitiveSentence.cue.endsWith('を')]).toEqual([key, true]);
    }
  });

  it('offers two different answers for every sentence', () => {
    for (const entry of pairList) {
      for (const side of sides) {
        for (const swap of [false, true]) {
          const question = buildPairQuestion(entry, side, swap);
          expect([entry[0], side, swap, question.options.length, new Set(question.options).size])
            .toEqual([entry[0], side, swap, 2, 2]);
          expect(question.options[Number((side === 'transitive') !== swap)]).toBe(question.correctAnswer);
        }
      }
    }
  });

  it('accounts for every wrong option matching the right verb’s potential in the prompt’s form', () => {
    const collisions: [string, string][] = [];
    for (const entry of pairList) {
      const [, pair] = entry;
      for (const side of sides) {
        const headword = pair[side];
        const question = buildPairQuestion(entry, side, false);
        const wrongOption = question.options[side === 'intransitive' ? 1 : 0];
        const potential = conjugate(headword, verbs[headword], 'potential').reading;
        const potentialInForm = conjugate(
          potential,
          { reading: potential, group: 'ichidan', translation: '', jlpt: verbs[headword].jlpt },
          question.form,
        );
        if (wrongOption === potentialInForm.reading) {
          const sentence = side === 'intransitive' ? pair.intransitiveSentence : pair.transitiveSentence;
          collisions.push([`${pair.intransitive}/${pair.transitive} ${side}`, sentence.ja]);
        }
      }
    }
    expect(collisions.sort()).toEqual(Object.entries(potentialCollisions).map(([id, [sentence]]) => [id, sentence]).sort());
  });
});

describe('transitivity pair questions', () => {
  const doorPair = pairList.find(([, pair]) => pair.intransitive === '開く' && pair.transitive === '開ける')!;

  it('asks 開く for a が sentence and 開ける for a を sentence', () => {
    // Hand-written ground truth, not computed by the engine.
    expect(buildPairQuestion(doorPair, 'intransitive', false)).toMatchObject({
      prompt: '誰もいない部屋で、風にあおられてドアが＿＿＿。',
      filled: '誰もいない部屋で、風にあおられてドアが開いた。',
      correctAnswer: 'あいた',
      options: ['あいた', 'あけた'],
    });
    expect(buildPairQuestion(doorPair, 'transitive', true)).toMatchObject({
      prompt: '暑いので窓を＿＿＿。',
      filled: '暑いので窓を開けた。',
      correctAnswer: 'あけた',
      options: ['あけた', 'あいた'],
    });
  });

  it.each([['intransitive', 'ドアが'], ['transitive', '窓を']] as const)('names the %s cue and both verbs and keys learning data by the pair', (side: PairSide, cue) => {
    const view = describeQuestion({ kind: 'pair', question: buildPairQuestion(doorPair, side, false) });
    expect(view.srKey).toBe('pair:開く/開ける');
    expect(parsePairKey(view.srKey)?.transitive).toBe('開ける');
    expect(view.hint).toContain(`「${cue}」`);
    expect(view.hint).toContain('開ける (他動詞');
    expect(view.hint).toContain('開く (自動詞');
  });

  it('lists each verb\'s partners, including a verb with two', () => {
    expect(partnersOf('開ける')).toEqual([{ verb: '開く', reading: 'あく', translation: 'to open (intransitive)', transitive: false }]);
    expect(partnersOf('起こす').map(p => p.verb).sort()).toEqual(['起きる', '起こる']);
    expect(partnersOf('食べる')).toEqual([]);
    expect(partnersOf('みえる')).toEqual(partnersOf('見える'));
    expect(partnersOf('きこえる')).toEqual(partnersOf('聞こえる'));
  });

  it('shows a weak pair by both verbs in the stats', () => {
    const insights = buildPracticeInsights({ [pairKey({ intransitive: '開く', transitive: '開ける' })]: 2 });
    expect(insights.weakVerbs.map(w => [w.verb, w.reading])).toEqual([['開く／開ける', 'あく／あける']]);
  });

  it('omits a duplicate kana reading and skips pairs in flashcard insights', () => {
    const weights = { 'pair:つく/つける': 2, '開く': 1.5 };
    expect(buildPracticeInsights(weights).weakVerbs[0]).toMatchObject({ verb: 'つく／つける', reading: '' });
    expect(buildPracticeInsights(weights, {}, Date.now(), false).weakVerbs.map(word => word.verb)).toEqual(['開く']);
  });
});

describe('pairs in the practice mix', () => {
  const verbEntries = Object.entries(verbs).filter(([, d]) => d.jlpt === 'N5');
  const base: PracticePool = {
    verbEntries, verbForms: ['masu', 'ta'], adjectiveEntries: [], adjectiveForms: [], adjectivesEnabled: false,
  };

  // The verb path draws from Math.random itself, so seed that for both runs.
  function run(pool: PracticePool) {
    const random = jest.spyOn(Math, 'random').mockImplementation(seeded(7));
    try {
      const draws = Array.from({ length: 200 }, () => {
        const item = generatePracticeQuestion(pool, () => 1)!;
        return `${item.kind}:${describeQuestion(item).srKey}:${describeQuestion(item).correctAnswer}`;
      });
      expect(draws.every(item => item.startsWith('verb:'))).toBe(true);
      return { draws, randomCalls: random.mock.calls.length };
    } finally {
      jest.restoreAllMocks();
    }
  }

  it('adds no pair draws and consumes no extra randomness when pairs are off', () => {
    expect(run({ ...base, pairEntries: pairList, pairsEnabled: false })).toEqual(run(base));
  });

  it.each<[JLPTLevel[], number]>([[['N5'], 33], [['N5', 'N4'], 83], [['N1'], 30]])(
    'includes pairs from either member’s level for %j',
    (levels, count) => {
      const eligible = pairList.filter(([, pair]) => isPairEligible(pair, levels));
      expect(eligible).toHaveLength(count);
      expect(eligible.map(([key]) => key)).toContain(levels.includes('N1') ? 'pair:寝る/寝かせる' : 'pair:開く/開ける');
    },
  );

  it('mixes pair questions in when pairs are on', () => {
    const random = seeded(3);
    const pool = { ...base, pairEntries: pairList.filter(([, pair]) => isPairEligible(pair, ['N5'])), pairsEnabled: true };
    let pairs = 0;
    for (let i = 0; i < 400; i++) {
      const item = generatePracticeQuestion(pool, () => 1, random)!;
      if (item.kind === 'pair') {
        pairs++;
        expect(item.question.options).toContain(item.question.correctAnswer);
        expect(item.question.options).toHaveLength(2);
      }
    }
    expect(pairs).toBeGreaterThan(40);
    expect(pairs).toBeLessThan(200);
  });
});

describe('pair practice settings', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    __resetPracticeSettingsStoreForTests();
  });

  it('turns pairs on for a new install without the note', async () => {
    await usePracticeSettingsStore.getState().loadPracticeSettings();
    expect(usePracticeSettingsStore.getState()).toMatchObject({ pairsEnabled: true, pairNoticeDismissed: true });
  });

  it('keeps pairs off with the notice pending until an existing learner enables them', async () => {
    await AsyncStorage.setItem('practiceSettings', JSON.stringify({
      activeForms: ['masu'], activeLevels: ['N5'], adjectivesEnabled: true, adjectiveNoticeDismissed: true,
    }));
    await usePracticeSettingsStore.getState().loadPracticeSettings();
    expect(usePracticeSettingsStore.getState()).toMatchObject({ pairsEnabled: false, pairNoticeDismissed: false });
    await usePracticeSettingsStore.getState().setPairsEnabled(true);
    expect(JSON.parse((await AsyncStorage.getItem('practiceSettings'))!)).toMatchObject({
      pairsEnabled: true, pairNoticeDismissed: true, adjectivesEnabled: true,
    });
  });
});
