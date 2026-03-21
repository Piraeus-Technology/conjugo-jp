import verbs from '../data/verbs.json';

type VerbEntry = {
  reading: string;
  group: string;
  godanRow?: string;
  translation: string;
  jlpt: string;
  overrides?: Record<string, string>;
  examples?: Array<{ ja: string; en: string }>;
};

const verbEntries = Object.entries(verbs) as [string, VerbEntry][];

describe('Verb data integrity', () => {
  test('has verbs', () => {
    expect(verbEntries.length).toBeGreaterThan(0);
  });

  test('all verbs have required fields', () => {
    for (const [verb, data] of verbEntries) {
      expect(data.reading).toBeTruthy();
      expect(['godan', 'ichidan', 'irregular']).toContain(data.group);
      expect(data.translation).toBeTruthy();
      expect(['N5', 'N4', 'N3', 'N2', 'N1']).toContain(data.jlpt);
    }
  });

  test('all godan verbs have godanRow', () => {
    const validRows = ['u', 'ku', 'gu', 'su', 'tsu', 'nu', 'bu', 'mu', 'ru'];
    for (const [verb, data] of verbEntries) {
      if (data.group === 'godan') {
        expect(validRows).toContain(data.godanRow);
      }
    }
  });

  test('godan verb readings end with u-row kana', () => {
    const uRowKana = 'うくぐすつぬぶむる';
    for (const [verb, data] of verbEntries) {
      if (data.group === 'godan') {
        const lastKana = data.reading[data.reading.length - 1];
        expect(uRowKana).toContain(lastKana);
      }
    }
  });

  test('ichidan verb readings end with る', () => {
    for (const [verb, data] of verbEntries) {
      if (data.group === 'ichidan') {
        expect(data.reading.endsWith('る')).toBe(true);
      }
    }
  });

  test('irregular verbs end with する or くる', () => {
    for (const [verb, data] of verbEntries) {
      if (data.group === 'irregular') {
        const endsCorrectly = data.reading.endsWith('する') || data.reading.endsWith('くる');
        expect(endsCorrectly).toBe(true);
      }
    }
  });

  test('no duplicate verbs', () => {
    const keys = Object.keys(verbs);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });
});
