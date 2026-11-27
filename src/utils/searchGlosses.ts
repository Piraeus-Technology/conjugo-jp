// A translation can list several meanings and include examples or objects
// in parentheses, as in "to take (someone) along".
export function searchGlosses(translation: string): string[] {
  const normalized = translation.normalize('NFKC').toLowerCase();
  return [normalized, ...normalized.replace(/\([^)]*\)/g, '').split(/[,;]/)]
    .map(gloss => gloss.trim().replace(/^to\s+/, '').replace(/\s+/g, ' '))
    .filter(Boolean);
}

export function normalizeGlossQuery(query: string): string {
  return query.trim().replace(/^to\s+/, '').replace(/\s+/g, ' ');
}
