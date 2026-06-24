import { ConjugationForm } from './conjugate';
import n5 from '../data/formExamples.n5.json';

// Per-(verb, form) example sentences (Japanese only). A form is intentionally
// absent when no natural example exists for that verb (e.g. the potential of
// ある, or a "suffering passive" that no native speaker would say).
export type ExampleMap = Record<string, Partial<Record<ConjugationForm, string>>>;

// Add more JLPT levels here as they are generated; lookups fall through in order.
const datasets: ExampleMap[] = [n5 as ExampleMap];

export function getExampleSentence(verb: string, form: ConjugationForm): string | undefined {
  for (const ds of datasets) {
    const sentence = ds[verb]?.[form];
    if (sentence) return sentence;
  }
  return undefined;
}
