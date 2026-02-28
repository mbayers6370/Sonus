// Core vocabulary word structure
export interface WordMetadata {
  frequencyRank?: number;
  strokeCount?: number;
  tonePattern?: string; // e.g. "3", "4-1", "2-3-4"
  difficultyWeight?: number; // relative weighting for scheduling/review
  grammarTags?: string[]; // e.g. ["question-particle", "classifier"]
  dependencies?: string[]; // word ids that should be introduced first
}

export interface Word {
  id: string;
  simp: string;
  trad: string;
  pinyin: string;
  reading?: string; // neutral pronunciation alias (e.g. pinyin/romaji)
  pronunciation?: string; // explicit cross-language pronunciation field
  tags?: string[] | null;
  pinyinNum?: string; // canonical storage: syllables with tone numbers, e.g. "bei3 jing1"
  variants?: string[]; // alternative real-world forms, e.g. ["星期日"] for preferred "星期天"
  preferred?: boolean; // preferred teaching/display form when variants exist
  mw?: string[]; // common measure words for nouns, e.g. ["个", "张", "本"]
  pos: string; // Part of speech: V, N, Adj, etc.
  en: string;
  defs: string[];
  meta?: WordMetadata;
  isReview?: boolean;
  reviewReason?: string;
  sourceUnitId?: string;
  promptType?: QuizPromptType;
  isReattempt?: boolean;
  reattemptOfWordId?: string;
  reattemptQueued?: boolean;
  example?: {
    zh?: string;
    en?: string;
    pinyin?: string;
    reading?: string;
    pronunciation?: string;
  };
}

export type ConfidenceLevel = 'sure' | 'unsure';

export type QuizPromptType =
  | 'hanzi_to_en'
  | 'en_to_hanzi'
  | 'audio_to_meaning'
  | 'cloze'
  | 'speak_from_en';

export interface WordReviewState {
  nextReviewAt: string;
  consecutiveCorrect: number;
  totalCorrect: number;
  totalWrong: number;
  lastReviewedAt: string | null;
  lastResult: 'correct' | 'wrong' | null;
  lastConfidence: ConfidenceLevel | null;
  promptCursor: number;
  sourceUnitId?: string | null;
}

// Lesson mode types
export type LessonMode = 'intro' | 'quiz' | 'speak' | 'apply';

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

export interface BandUnitData {
  id?: string;
  title?: string;
  description?: string;
  band?: number;
  targetWords: number;
  allocatedWords: number;
  words: Word[];
  pedagogy?: {
    prerequisites?: string[]; // unit ids
    lexicalDensityTarget?: number; // target % of new words per lesson
    grammarFocus?: string[]; // e.g. ["comparatives", "question words"]
  };
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
  sections?: Array<{
    id: string;
    title: string;
    subtitle?: string;
    unitIds: string[];
  }>;
  units: BandUnitData[] | Record<string, BandUnitData>;
  curriculum?: {
    prerequisites?: Record<string, string[]>;
    lessonControls?: {
      maxDefsPerWord?: number;
      maxWordsPerLesson?: number;
    };
  };
}

export interface SpeakComponentScore {
  matched: number;
  total: number;
  percent: number;
  pass: boolean;
}

export interface SpeakDimensionScore extends SpeakComponentScore {
  key: string;
  label: string;
}

export interface SpeakBreakdown {
  heardText: string;
  targetPinyin: string;
  detectedPinyin: string;
  language?: string;
  dimensions?: SpeakDimensionScore[];
  source: 'hanzi-map' | 'latin' | 'unresolved' | 'no-speech';
  initial: SpeakComponentScore;
  final: SpeakComponentScore;
  tone: SpeakComponentScore;
}

export interface ResumeCheckpoint {
  bandId: string;
  unitId: string;
  lessonIndex: number;
  lessonMode: LessonMode;
  lessonWordIndex: number;
  activeLesson: ActiveLesson;
  quizResultsByIndex: Record<number, boolean>;
  speakResultsByIndex: Record<number, boolean>;
  speakBreakdownByIndex: Record<number, SpeakBreakdown>;
}

// App state
export interface AppState {
  selectedLanguage: string | null;
  currentLevel: LessonBand | null;
  streak: number;
  levelProgress: { [key: string]: number };
  lessonProgress: {
    [lessonKey: string]: {
      introViewed: boolean;
      quizScore: number | null;
      speakScore: number | null;
      speakAllCorrect: boolean; // legacy compatibility flag
      completed: boolean; // instructional pass complete
      mastered: boolean; // retrieval mastery pass complete
    };
  };
  completedLevels: string[];
  unlockedLevels: string[];

  // Lesson state
  activeLesson: ActiveLesson | null;
  lessonMode: LessonMode;
  lessonWordIndex: number;
  quizResultsByIndex: Record<number, boolean>;
  speakResultsByIndex: Record<number, boolean>;
  speakBreakdownByIndex: Record<number, SpeakBreakdown>;
  lastActiveDate: string | null;
  resumeCheckpoint: ResumeCheckpoint | null;
  resumeCheckpointByLanguage: Record<string, ResumeCheckpoint>;

  // Band data cache
  activeBandId: string | null;
  activeBandData: BandData | null;
  activeUnitId: string | null;
  unitsMode: 'units' | 'lessons';
  wordReview: Record<string, WordReviewState>;
  recentMisses: string[];
  dailySetDate: string | null;
  dailySetWordIds: string[];
}
