import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { safeSetItem } from './safeStorage';

const STORE_REVIEW_MARKER_PREFIX = 'store_review_requested:';
const attemptedVersions = new Set<string>();
const pendingVersions = new Set<string>();

interface StoreReviewPromptContext {
  appVersion?: string | null;
  newStreak: number;
  totalQuestionsAtVisitStart: number;
  answersThisVisitBeforeCurrent: number;
  sessionDays: readonly string[];
  currentDay: string;
}

export function getStoreReviewMarkerKey(version: string): string {
  return `${STORE_REVIEW_MARKER_PREFIX}${version}`;
}

export function isStoreReviewEarned({
  newStreak,
  totalQuestionsAtVisitStart,
  answersThisVisitBeforeCurrent,
  sessionDays,
  currentDay,
}: Omit<StoreReviewPromptContext, 'appVersion'>): boolean {
  if (newStreak !== 10) return false;

  const totalQuestionsAfterAnswer =
    totalQuestionsAtVisitStart + answersThisVisitBeforeCurrent + 1;
  if (totalQuestionsAfterAnswer < 50) return false;

  const practiceDays = new Set([...sessionDays, currentDay]);
  return practiceDays.size >= 3;
}

export async function maybeRequestStoreReview(
  context: StoreReviewPromptContext,
): Promise<boolean> {
  const version = context.appVersion?.trim();
  if (!version || !isStoreReviewEarned(context)) return false;
  if (attemptedVersions.has(version) || pendingVersions.has(version)) return false;

  pendingVersions.add(version);
  try {
    const markerKey = getStoreReviewMarkerKey(version);
    try {
      if (await AsyncStorage.getItem(markerKey)) {
        attemptedVersions.add(version);
        return false;
      }
    } catch (e) {
      // Fail closed when the marker cannot be read; otherwise a transient
      // storage failure could repeat a request from an earlier app session.
      console.warn('Failed to read store-review marker:', e);
      return false;
    }

    let available = false;
    try {
      available = await StoreReview.isAvailableAsync();
    } catch {
      return false;
    }
    if (!available) return false;

    // Guard this version in memory before any further await. Persistence is
    // attempted before invoking the native API, so a request that never
    // settles cannot defer the marker write.
    attemptedVersions.add(version);
    await safeSetItem(markerKey, 'true');

    try {
      await StoreReview.requestReview();
    } catch {
      // The marker represents a native request attempt, not a displayed or
      // completed review, neither of which the platform API exposes.
    }
    return true;
  } finally {
    pendingVersions.delete(version);
  }
}

export function __resetStoreReviewPromptForTests(): void {
  attemptedVersions.clear();
  pendingVersions.clear();
}
