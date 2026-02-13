// Core vocabulary word structure
export interface Word {
  id: string;
  simp: string;
  trad: string;
  pinyin: string;
  pos: string; // Part of speech: V, N, Adj, etc.
  en: string;
  defs: string[];
  isReview?: boolean;
}

// Lesson mode types
export type LessonMode = 'intro' | 'quiz' | 'speak';

// Active lesson state
export interface ActiveLesson {
  unitId: string;
  unitName?: string;
  unitOrder?: number;
  lessonIndex: number;
  words: Word[];
}

// Unit structure
export interface Unit {
  id: string;
  icon: string;
  name: string;
  hanzi: string;
  words: number;
}

// Band/Level structure
export interface LessonBand {
  id: string;
  band: number;
  name: string;
  title: string;
  subtitle: string;
  wordCount: number;
  wordRange: string;
  color: string;
  description: string;
  units: Unit[];
}

// Language structure
export interface Language {
  id: string;
  name: string;
  native: string;
  framework: string;
  track: string;
  icon: string;
  available: boolean;
}

// Band data from JSON files
export interface BandData {
  language: string;
  source: string;
  bandId: string;
  band: number;
  wordCount: number;
  availableWords: number;
  unallocatedWords: number;
  units: {
    [unitId: string]: {
      targetWords: number;
      allocatedWords: number;
      words: Word[];
    };
  };
}

// App state
export interface AppState {
  selectedLanguage: string | null;
  currentLevel: LessonBand | null;
  streak: number;
  levelProgress: { [key: string]: number };
  completedLevels: string[];
  unlockedLevels: string[];

  // Lesson state
  activeLesson: ActiveLesson | null;
  lessonMode: LessonMode;
  lessonWordIndex: number;
  lastActiveDate: string | null;

  // Band data cache
  activeBandId: string | null;
  activeBandData: BandData | null;
  activeUnitId: string | null;
  unitsMode: 'units' | 'lessons';
}
