export type SharedLexeme = {
  id: string;
  lang: string;
  term: string;
  en: string;
  defs?: string[];
  pos?: string;
  reading?: string;
  pronunciation?: string;
  scripts?: {
    primary?: string;
    secondary?: string;
    tertiary?: string;
  };
};

// Backward-compatible Mandarin-first shape still used by parts of the app.
// Keep this while migrating call-sites to SharedLexeme.
export type SharedWord = {
  id: string;
  simp: string;
  trad: string;
  pinyin: string;
  reading?: string;
  pronunciation?: string;
  pos: string;
  en: string;
  defs: string[];
};

export type SharedUserProgress = {
  streak: number;
  lastActiveDate: string | null;
  currentBandId: string | null;
  currentUnitId: string | null;
  currentLessonIdx: number | null;
};
