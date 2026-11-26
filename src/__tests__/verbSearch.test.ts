import { MAX_SEARCH_RESULTS } from '../utils/constants';
import { searchVerbs } from '../utils/verbSearch';

describe('verb search', () => {
  it('ranks complete and unfinished romaji reading prefixes among the first ten results', () => {
    const targets = {
      tabe: '食べる', hana: '話す', nara: '習う', kake: 'かける', sake: '避ける', make: '負ける',
      nom: '飲む', kak: '書く', asob: '遊ぶ', ik: '行く', mats: '待つ',
    };
    for (const [query, verb] of Object.entries(targets)) {
      expect(searchVerbs(query).slice(0, 10).map(row => row.verb)).toContain(verb);
    }
  });

  it('includes the pre-ます stem and caps results using the shared limit', () => {
    expect(searchVerbs('nomi').map(row => row.verb)).toContain('飲む');
    expect(searchVerbs('kai').map(row => row.verb)).toContain('買う');
    expect(searchVerbs('する')).toHaveLength(MAX_SEARCH_RESULTS);
  });

  it('matches hiragana, katakana, Hepburn variants, and optional moraic n separators', () => {
    const targets = {
      たべ: ['食べる'], タベル: ['食べる'], ノム: ['飲む'],
      tsuzukeru: ['続ける'], tsudzukeru: ['続ける'], kizuku: ['築く', '気付く'], kidzuku: ['気付く'],
      katazukeru: ['片付ける'], katadzukeru: ['片付ける'], chijimu: ['縮む'],
      honyakusuru: ['翻訳する'], "hon'yakusuru": ['翻訳する'],
    };
    for (const [query, verbs] of Object.entries(targets)) {
      const limit = /^[ァ-ヶ]/.test(query) ? 1 : 3;
      expect(searchVerbs(query).slice(0, limit).map(row => row.verb)).toEqual(expect.arrayContaining(verbs));
    }
  });

  it('keeps exact conjugations and English headwords near the top', () => {
    expect(searchVerbs('tabemasu')[0]).toMatchObject({ verb: '食べる', matchForm: 'masu' });
    expect(searchVerbs('itta').slice(0, 3).map(row => row.verb)).toEqual(['行く', '言う', '要る']);
    const english = {
      eat: '食べる', drink: '飲む', go: '行く', come: '来る', see: '見る', write: '書く', read: '読む',
      buy: '買う', make: '作る', do: 'する', run: '走る', speak: '話す', 'to eat': '食べる',
      sleep: '寝る', wait: '待つ', use: '使う', open: '開ける', give: 'あげる', know: '知る',
      say: '言う', meet: '会う', play: '遊ぶ', study: '勉強する',
    };
    for (const [query, verb] of Object.entries(english)) {
      expect(searchVerbs(query).slice(0, 3).map(row => row.verb)).toContain(verb);
    }
  });
});
