import AsyncStorage from '@react-native-async-storage/async-storage';
import verbsJson from '../data/verbs.json';
import { ALL_FORMS, conjugate, type VerbData } from '../utils/conjugate';
import {
  PAIR_BLANK,
  buildPairQuestion,
  pairKey,
  pairList,
  parsePairKey,
  partnersOf,
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

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe('transitivity pair data', () => {
  it('pairs an intransitive verb with a transitive one, both in the verb list, each pair once', () => {
    const keys = pairList.map(([key]) => key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const [, pair] of pairList) {
      expect([pair.intransitive, verbs[pair.intransitive]?.transitive]).toEqual([pair.intransitive, false]);
      expect([pair.transitive, verbs[pair.transitive]?.transitive]).toEqual([pair.transitive, true]);
    }
  });

  // The particle is the cue the learner reads: no を at all on the
  // intransitive side (so no path を like 橋を渡る), a を object on the other.
  it('gives each side one blank and the particle cue that decides it', () => {
    for (const [key, pair] of pairList) {
      for (const [side, sentence] of [['intransitive', pair.intransitiveSentence], ['transitive', pair.transitiveSentence]] as const) {
        expect([key, side, sentence.ja.split(PAIR_BLANK).length]).toEqual([key, side, 2]);
        expect([key, side, ALL_FORMS.includes(sentence.form)]).toEqual([key, side, true]);
        expect([key, side, /[。！？]$/.test(sentence.ja), sentence.en.length > 0]).toEqual([key, side, true, true]);
        expect([key, side, sentence.ja.includes('を')]).toEqual([key, side, side === 'transitive']);
      }
    }
  });

  it('offers two different answers for every sentence', () => {
    for (const [entryKey, pair] of pairList) {
      for (const sentence of [pair.intransitiveSentence, pair.transitiveSentence]) {
        const a = conjugate(pair.intransitive, verbs[pair.intransitive], sentence.form).reading;
        const b = conjugate(pair.transitive, verbs[pair.transitive], sentence.form).reading;
        expect([entryKey, sentence.form, a === b]).toEqual([entryKey, sentence.form, false]);
      }
    }
  });
});

describe('transitivity pair questions', () => {
  const doorPair = pairList.find(([, pair]) => pair.intransitive === '開く' && pair.transitive === '開ける')!;

  it('asks 開く for a が sentence and 開ける for a を sentence', () => {
    // Hand-written ground truth, not computed by the engine.
    expect(buildPairQuestion(doorPair, 'intransitive', false)).toMatchObject({
      prompt: '風でドアが＿＿＿。',
      filled: '風でドアが開いた。',
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

  it('keys learning data by the pair and names both verbs in the explanation', () => {
    const view = describeQuestion({ kind: 'pair', question: buildPairQuestion(doorPair, 'transitive', false) });
    expect(view.srKey).toBe('pair:開く/開ける');
    expect(parsePairKey(view.srKey)?.transitive).toBe('開ける');
    expect(view.hint).toContain('開ける (他動詞');
    expect(view.hint).toContain('開く (自動詞');
    expect(view.pairSentence?.english).toBe('It was hot, so I opened the window.');
  });

  it('lists each verb\'s partners, including a verb with two', () => {
    expect(partnersOf('開ける')).toEqual([{ verb: '開く', transitive: false }]);
    expect(partnersOf('起こす').map(p => p.verb).sort()).toEqual(['起きる', '起こる']);
    expect(partnersOf('食べる')).toEqual([]);
  });

  it('shows a weak pair by both verbs in the stats', () => {
    const insights = buildPracticeInsights({ [pairKey({ intransitive: '開く', transitive: '開ける' })]: 2 });
    expect(insights.weakVerbs.map(w => [w.verb, w.reading])).toEqual([['開く／開ける', 'あく／あける']]);
  });
});

describe('pairs in the practice mix', () => {
  const verbEntries = Object.entries(verbs).filter(([, d]) => d.jlpt === 'N5');
  const base: PracticePool = {
    verbEntries, verbForms: ['masu', 'ta'], adjectiveEntries: [], adjectiveForms: [], adjectivesEnabled: false,
  };

  // The verb path draws from Math.random itself, so seed that for both runs.
  function run(pool: PracticePool): string[] {
    jest.spyOn(Math, 'random').mockImplementation(seeded(7));
    try {
      return Array.from({ length: 200 }, () => {
        const item = generatePracticeQuestion(pool, () => 1)!;
        return `${item.kind}:${describeQuestion(item).srKey}:${describeQuestion(item).correctAnswer}`;
      });
    } finally {
      jest.restoreAllMocks();
    }
  }

  it('leaves practice exactly as it was when pairs are off', () => {
    const before = run(base);
    expect(run({ ...base, pairEntries: pairList, pairsEnabled: false })).toEqual(before);
    expect(before.every(item => item.startsWith('verb:'))).toBe(true);
  });

  it('mixes pair questions in when pairs are on', () => {
    const random = seeded(3);
    const pool = { ...base, pairEntries: pairList.filter(([, d]) => d.jlpt === 'N5'), pairsEnabled: true };
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

  it('keeps pairs off for someone whose settings predate them, and shows the note', async () => {
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
