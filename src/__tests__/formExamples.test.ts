import { conjugate, conjugateReading, ConjugationForm, VerbData } from '../utils/conjugate';
import { getExampleSentence } from '../utils/formExamples';
import n5 from '../data/formExamples.n5.json';
import verbsJson from '../data/verbs.json';

const verbs = verbsJson as Record<string, VerbData>;
const dataset = n5 as Record<string, Partial<Record<ConjugationForm, string>>>;

describe('N5 form example sentences', () => {
  const entries: [string, ConjugationForm, string][] = [];
  for (const [verb, forms] of Object.entries(dataset)) {
    for (const [form, sentence] of Object.entries(forms)) {
      entries.push([verb, form as ConjugationForm, sentence as string]);
    }
  }

  it('covers a non-trivial number of sentences', () => {
    expect(entries.length).toBeGreaterThan(1000);
  });

  it('only references verbs that exist in the verb list', () => {
    for (const verb of Object.keys(dataset)) {
      expect(verbs[verb]).toBeDefined();
    }
  });

  it('each sentence contains its exact conjugated form (kanji or kana)', () => {
    const offenders: string[] = [];
    for (const [verb, form, sentence] of entries) {
      const data = verbs[verb];
      const kanji = conjugate(verb, data, form).value;
      const kana = conjugateReading(data, form);
      if (!sentence.includes(kanji) && !sentence.includes(kana)) {
        offenders.push(`${verb}:${form} -> "${sentence}" (expected ${kanji}/${kana})`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('getExampleSentence returns dataset entries and undefined for omitted forms', () => {
    expect(getExampleSentence('食べる', 'volitional')).toContain('食べよう');
    // ある has no natural potential — intentionally omitted.
    expect(getExampleSentence('ある', 'potential')).toBeUndefined();
    // Unknown verb -> undefined, never throws.
    expect(getExampleSentence('存在しない動詞', 'masu')).toBeUndefined();
  });
});
