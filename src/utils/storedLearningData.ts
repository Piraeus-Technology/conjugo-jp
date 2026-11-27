export function isStoredCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function requireStoredCounts(total: unknown, correct: unknown): void {
  if (!isStoredCount(total) || !isStoredCount(correct) || correct > total) {
    throw new Error('Invalid learning data counts');
  }
}
