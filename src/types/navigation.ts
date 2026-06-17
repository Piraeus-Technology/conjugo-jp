export type PracticeSettingsParams = { mode: 'quiz' | 'flashcards' };

export type SearchStackParamList = {
  SearchHome: undefined;
  Conjugation: { verb: string; highlightForm?: string };
};

export type QuizStackParamList = {
  QuizMain: undefined;
  PracticeSettings: PracticeSettingsParams;
};

export type FlashcardStackParamList = {
  FlashcardMain: undefined;
  PracticeSettings: PracticeSettingsParams;
};

export type MoreStackParamList = {
  MoreMain: undefined;
  Stats: undefined;
  FlashcardStats: undefined;
};
