import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type {
  AppState,
  LessonBand,
  BandData,
  ActiveLesson,
  LessonMode,
  Word,
  SpeakBreakdown,
} from '../types/lesson.types';
import { getUnitMetadata } from '../data/unitMetadata';
import { appendReviewWords } from '../lib/reviewInjection';
import { trackEvent } from '../lib/analytics';
import { sliceWordsForLesson } from '../lib/lessonChunks';
import { makeLessonKey } from '../lib/lessonProgress';

interface AppContextType {
  state: AppState;
  selectLanguage: (langId: string | null) => void;
  selectLevel: (level: LessonBand | null) => Promise<void>;
  startLesson: (unitId: string, lessonIndex: number) => void;
  openLessonPath: (bandId: string, unitId: string, lessonIndex: number) => Promise<boolean>;
  setLessonMode: (mode: LessonMode) => void;
  nextWord: () => void;
  prevWord: () => void;
  recordQuizResult: (lessonIndex: number, isCorrect: boolean) => void;
  recordSpeakResult: (lessonIndex: number, isCorrect: boolean, breakdown?: SpeakBreakdown) => void;
  completeLessonProgress: () => void;
  exitLesson: () => void;
  restartLesson: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = 'sonus-app-state';
const ALL_LEVEL_IDS = [
  'intro',
  'band1',
  'band2',
  'band3',
  'band4',
  'band5',
  'band6',
  'band7',
  'band8',
  'band9',
  'advanced',
  'n5',
  'n4',
  'n3',
  'n2',
  'n1',
  'topik1-1',
  'topik1-2',
  'topik2-3',
  'topik2-4',
  'topik2-5',
  'topik2-6',
  'a1',
  'a2',
  'b1',
  'b2',
  'c1',
  'c2',
] as const;

function resolveBandDataId(bandId: string) {
  if (bandId === 'band7' || bandId === 'band8' || bandId === 'band9' || bandId === 'advanced') {
    return 'band7-9';
  }
  return bandId;
}

function resolveUnitIdForBand(bandId: string, unitId: string) {
  if (bandId === 'band2' && unitId === 'b2-directions') {
    return 'b2-places';
  }
  return unitId;
}

function formatUnitLabel(unitId: string) {
  return unitId
    .replace(/^[a-z]\d+-/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function shuffleWords<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getCoreWordStats(words: Word[], resultsByIndex: Record<number, boolean>) {
  const coreIndexes = words
    .map((word, index) => ({ word, index }))
    .filter(({ word }) => !word.isReview)
    .map(({ index }) => index);
  const total = coreIndexes.length;
  const correct = coreIndexes.filter((index) => Boolean(resultsByIndex[index])).length;
  return { total, correct };
}

function normalizeLessonProgressKeys(progress: AppState['lessonProgress']) {
  const next: AppState['lessonProgress'] = {};
  for (const [key, value] of Object.entries(progress || {})) {
    const parts = key.split(':');
    if (parts.length !== 3) {
      next[key] = value;
      continue;
    }
    const [bandId, rawUnitId, lessonIndex] = parts;
    const unitId = resolveUnitIdForBand(bandId, rawUnitId);
    if (bandId !== 'unknown-band') {
      next[`${bandId}:${unitId}:${lessonIndex}`] = value;
      continue;
    }

    const match = unitId.match(/^b(\d+)-/i);
    if (match) {
      const inferredBandId = `band${match[1]}`;
      next[`${inferredBandId}:${unitId}:${lessonIndex}`] = value;
      continue;
    }

    next[key] = value;
  }
  return next;
}

function getPracticeModeFromUnit(unitId: string): LessonMode | null {
  if (/listening$/i.test(unitId)) return 'quiz';
  if (/speaking$/i.test(unitId)) return 'speak';
  return null;
}

function isPracticeUnit(unitId: string) {
  return getPracticeModeFromUnit(unitId) !== null;
}

function buildPracticeWordPool(bandData: BandData, count: number): Word[] {
  const sampleUnitId = Object.keys(bandData.units || {}).find((unitId) => unitId !== '_unallocated');
  const unitStem = sampleUnitId ? sampleUnitId.split('-')[0] : `b${bandData.band}`;
  const bandUnitPrefix = `${unitStem}-`;
  // Build a deterministic pool for skill labs from real band vocab only
  // (exclude synthetic units such as listening/speaking and unallocated slots).
  const pool = Object.entries(bandData.units)
    .filter(
      ([unitId]) =>
        unitId.startsWith(bandUnitPrefix) &&
        unitId !== '_unallocated' &&
        !isPracticeUnit(unitId)
    )
    .flatMap(([, unit]) => unit.words || []);
  const uniqueById = new Map(pool.map((word) => [word.id, word]));
  return shuffleWords(Array.from(uniqueById.values()))
    .slice(0, Math.max(0, count))
    .map((word) => ({ ...word, isReview: false }));
}

type ReviewQueueItem = {
  wordId: string;
};

type ReviewQueueResponse = {
  queue: ReviewQueueItem[];
};

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://127.0.0.1:4000';

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function envNumber(name: string, fallback: number) {
  const raw = import.meta.env[name] as string | undefined;
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

const REVIEW_INJECT_MAX = clampNumber(
  Math.floor(envNumber('VITE_REVIEW_INJECT_MAX', 2)),
  0,
  10
);
const REVIEW_INJECT_PROBABILITY = clampNumber(
  envNumber('VITE_REVIEW_INJECT_PROBABILITY', 0.65),
  0,
  1
);

async function fetchReviewWordIds(limit = 30): Promise<string[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 700);

  try {
    const response = await fetch(`${API_BASE_URL}/v1/me/review-queue?limit=${limit}`, {
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as ReviewQueueResponse;
    return (payload.queue || []).map((item) => item.wordId).filter(Boolean);
  } catch {
    return [];
  } finally {
    window.clearTimeout(timer);
  }
}

async function saveCurrentLessonPath(
  currentBandId: string,
  currentUnitId: string,
  currentLessonIdx: number
) {
  try {
    await fetch(`${API_BASE_URL}/v1/me/progress/current`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentBandId,
        currentUnitId,
        currentLessonIdx,
      }),
    });
  } catch {
    // Offline mode should not block lesson flow.
  }
}

const initialState: AppState = {
  selectedLanguage: null,
  currentLevel: null,
  streak: 0,
  levelProgress: {},
  lessonProgress: {},
  completedLevels: [],
  unlockedLevels: [...ALL_LEVEL_IDS],
  activeLesson: null,
  lessonMode: 'intro',
  lessonWordIndex: 0,
  quizResultsByIndex: {},
  speakResultsByIndex: {},
  speakBreakdownByIndex: {},
  lastActiveDate: null,
  resumeCheckpoint: null,
  activeBandId: null,
  activeBandData: null,
  activeUnitId: null,
  unitsMode: 'units',
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<AppState>;
        return {
          ...initialState,
          ...parsed,
          unlockedLevels: Array.from(
            new Set([...(parsed.unlockedLevels || []), ...ALL_LEVEL_IDS])
          ),
          lessonProgress: normalizeLessonProgressKeys(parsed.lessonProgress || {}),
        };
      } catch {
        return initialState;
      }
    }
    return initialState;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Refresh active band payload after localStorage hydration so unit/data edits
  // are reflected without requiring a manual level re-select.
  useEffect(() => {
    if (!state.activeBandId) return;

    let cancelled = false;
    const activeBandId = state.activeBandId;
    const dataBandId = resolveBandDataId(activeBandId);

    void fetch(`/data/zh/${dataBandId}.json`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as BandData;
      })
      .then((bandData) => {
        if (!bandData || cancelled) return;
        setState((prev) => {
          if (prev.activeBandId !== activeBandId) return prev;
          return {
            ...prev,
            activeBandData: bandData,
          };
        });
      })
      .catch(() => {
        // Keep existing in-memory data if refresh fails.
      });

    return () => {
      cancelled = true;
    };
  }, [state.activeBandId]);

  const selectLanguage = (langId: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedLanguage: langId,
      currentLevel: null,
      activeBandId: null,
      activeBandData: null,
      activeLesson: null,
      lessonMode: 'intro',
      lessonWordIndex: 0,
      quizResultsByIndex: {},
      speakResultsByIndex: {},
      speakBreakdownByIndex: {},
      resumeCheckpoint: null,
    }));
  };

  const selectLevel = async (level: LessonBand | null) => {
    if (!level) {
      setState((prev) => ({
        ...prev,
        currentLevel: null,
        activeBandId: null,
        activeBandData: null,
      }));
      return;
    }

    try {
      const dataBandId = resolveBandDataId(level.id);
      const response = await fetch(`/data/zh/${dataBandId}.json`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to load ${level.id}`);
      const bandData: BandData = await response.json();

      setState((prev) => ({
        ...prev,
        currentLevel: level,
        activeBandId: level.id,
        activeBandData: bandData,
      }));
    } catch (error) {
      console.error('Failed to load band data:', error);
      alert('Could not load vocabulary data');
    }
  };

  const openLessonPath = async (bandId: string, unitId: string, lessonIndex: number): Promise<boolean> => {
    try {
      const resolvedUnitId = resolveUnitIdForBand(bandId, unitId);
      const dataBandId = resolveBandDataId(bandId);
      const response = await fetch(`/data/zh/${dataBandId}.json`, { cache: 'no-store' });
      if (!response.ok) return false;
      const bandData: BandData = await response.json();
      const unit = bandData.units[resolvedUnitId];
      if (!unit) return false;

      const resumeCheckpoint = state.resumeCheckpoint;
      const canResumeSameLesson =
        Boolean(resumeCheckpoint) &&
        resumeCheckpoint?.bandId === bandId &&
        resolveUnitIdForBand(resumeCheckpoint?.bandId ?? '', resumeCheckpoint?.unitId ?? '') ===
          resolvedUnitId &&
        resumeCheckpoint?.lessonIndex === lessonIndex;

      if (canResumeSameLesson && resumeCheckpoint) {
        setState((prev) => ({
          ...prev,
          activeBandId: bandId,
          activeBandData: bandData,
          activeUnitId: resolvedUnitId,
          activeLesson: resumeCheckpoint.activeLesson,
          lessonMode: resumeCheckpoint.lessonMode,
          lessonWordIndex: resumeCheckpoint.lessonWordIndex,
          quizResultsByIndex: resumeCheckpoint.quizResultsByIndex,
          speakResultsByIndex: resumeCheckpoint.speakResultsByIndex,
          speakBreakdownByIndex: resumeCheckpoint.speakBreakdownByIndex,
        }));
        trackEvent('lesson_resumed', {
          bandId,
          unitId: resolvedUnitId,
          lessonIndex,
          wordIndex: resumeCheckpoint.lessonWordIndex,
          mode: resumeCheckpoint.lessonMode,
        });
        return true;
      }

      const practiceMode = getPracticeModeFromUnit(resolvedUnitId);
      const words = unit.words;
      const lessonChunk =
        practiceMode && words.length === 0
          // Practice units do not own word lists; they sample from band vocab.
          ? buildPracticeWordPool(bandData, 12)
          : sliceWordsForLesson(words, lessonIndex);
      if (!lessonChunk.length) return false;

      let lessonWords: Word[] = shuffleWords(lessonChunk).map((word) => ({
        ...word,
        isReview: false,
      }));

      const reviewWordIds = await fetchReviewWordIds(30);
      if (!practiceMode && reviewWordIds.length > 0) {
        const lessonWordIds = new Set(lessonWords.map((w) => w.id));
        const allBandWords = Object.values(bandData.units).flatMap((nextUnit) => nextUnit.words);
        const byId = new Map(allBandWords.map((w) => [w.id, w]));
        const reviewCandidates = reviewWordIds
          .map((id) => byId.get(id))
          .filter((w): w is Word => Boolean(w) && !lessonWordIds.has((w as Word).id));
        lessonWords = appendReviewWords(
          lessonWords,
          reviewCandidates,
          REVIEW_INJECT_MAX,
          REVIEW_INJECT_PROBABILITY
        );
      }

      const metadata = getUnitMetadata(bandId, resolvedUnitId);
      const newLesson: ActiveLesson = {
        unitId: resolvedUnitId,
        unitName: metadata?.name ?? formatUnitLabel(resolvedUnitId),
        unitOrder: metadata?.order,
        lessonIndex,
        words: lessonWords,
      };

      setState((prev) => ({
        ...prev,
        activeBandId: bandId,
        activeBandData: bandData,
        activeUnitId: resolvedUnitId,
        activeLesson: newLesson,
        lessonMode: practiceMode ?? 'intro',
        lessonWordIndex: 0,
        quizResultsByIndex: {},
        speakResultsByIndex: {},
        speakBreakdownByIndex: {},
        resumeCheckpoint: null,
      }));
      void saveCurrentLessonPath(bandId, resolvedUnitId, lessonIndex);
      trackEvent('lesson_started', {
        bandId,
        unitId: resolvedUnitId,
        lessonIndex,
        totalWords: lessonWords.length,
        reviewWords: lessonWords.filter((w) => Boolean(w.isReview)).length,
      });
      return true;
    } catch {
      return false;
    }
  };

  const startLesson = (unitId: string, lessonIndex: number) => {
    void (async () => {
      const { activeBandData, activeBandId } = state;
      if (!activeBandData || !activeBandData.units[unitId] || !activeBandId) {
        alert('No vocab loaded for this unit yet.');
        return;
      }
      await openLessonPath(activeBandId, unitId, lessonIndex);
    })();
  };

  const setLessonMode = (mode: LessonMode) => {
    setState((prev) => ({
      ...prev,
      lessonMode: mode,
      lessonWordIndex: 0,
      quizResultsByIndex: mode === 'quiz' ? {} : prev.quizResultsByIndex,
      speakResultsByIndex: mode === 'speak' ? {} : prev.speakResultsByIndex,
      speakBreakdownByIndex: mode === 'speak' ? {} : prev.speakBreakdownByIndex,
    }));
  };

  const nextWord = () => {
    const { activeLesson, lessonWordIndex } = state;
    if (!activeLesson) return;

    if (lessonWordIndex >= activeLesson.words.length - 1) {
      // Move past the final word so completion screen routing can render.
      setState((prev) => ({
        ...prev,
        lessonWordIndex: prev.activeLesson ? prev.activeLesson.words.length : prev.lessonWordIndex,
      }));
      completeLessonProgress();
      return;
    }

    setState((prev) => ({
      ...prev,
      lessonWordIndex: prev.lessonWordIndex + 1,
    }));
  };

  const prevWord = () => {
    setState((prev) => ({
      ...prev,
      lessonWordIndex: Math.max(0, prev.lessonWordIndex - 1),
    }));
  };

  const recordQuizResult = (lessonIndex: number, isCorrect: boolean) => {
    setState((prev) => ({
      ...prev,
      quizResultsByIndex: {
        ...prev.quizResultsByIndex,
        [lessonIndex]: isCorrect,
      },
    }));
  };

  const recordSpeakResult = (lessonIndex: number, isCorrect: boolean, breakdown?: SpeakBreakdown) => {
    setState((prev) => {
      const nextBreakdownByIndex = breakdown
        ? {
            ...prev.speakBreakdownByIndex,
            [lessonIndex]: breakdown,
          }
        : prev.speakBreakdownByIndex;

      return {
        ...prev,
        speakResultsByIndex: {
          ...prev.speakResultsByIndex,
          [lessonIndex]: isCorrect,
        },
        speakBreakdownByIndex: nextBreakdownByIndex,
      };
    });
  };

  const completeLessonProgress = () => {
    const { activeLesson, streak, lastActiveDate, lessonMode } = state;
    if (!activeLesson) return;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    let newStreak = streak;
    if (lastActiveDate !== today) {
      if (lastActiveDate === yesterday) {
        newStreak = streak + 1;
      } else {
        newStreak = 1;
      }
    }

    setState((prev) => {
      const bandId = prev.activeBandId || 'unknown-band';
      const lessonKey = makeLessonKey(bandId, activeLesson.unitId, activeLesson.lessonIndex);
      const existing = prev.lessonProgress[lessonKey] || {
        introViewed: false,
        quizScore: null as number | null,
        speakAllCorrect: false,
        completed: false,
      };

      let nextIntroViewed = existing.introViewed;
      let nextQuizScore = existing.quizScore;
      let nextSpeakAllCorrect = existing.speakAllCorrect;

      if (lessonMode === 'intro') {
        nextIntroViewed = true;
      } else if (lessonMode === 'quiz') {
        const { total, correct } = getCoreWordStats(activeLesson.words, prev.quizResultsByIndex);
        nextQuizScore = total > 0 ? Math.round((correct / total) * 100) : 0;
      } else if (lessonMode === 'speak') {
        const { total, correct } = getCoreWordStats(activeLesson.words, prev.speakResultsByIndex);
        nextSpeakAllCorrect = total > 0 && correct === total;
      }

      const completed =
        nextIntroViewed && (nextQuizScore ?? 0) >= 90 && nextSpeakAllCorrect;

      return {
        ...prev,
        streak: newStreak,
        lastActiveDate: today,
        resumeCheckpoint: null,
        lessonProgress: {
          ...prev.lessonProgress,
          [lessonKey]: {
            introViewed: nextIntroViewed,
            quizScore: nextQuizScore,
            speakAllCorrect: nextSpeakAllCorrect,
            completed,
          },
        },
      };
    });
    trackEvent('lesson_completed', {
      unitId: activeLesson.unitId,
      lessonIndex: activeLesson.lessonIndex,
      totalWords: activeLesson.words.length,
    });
  };

  const restartLesson = () => {
    setState((prev) => ({
      ...prev,
      lessonWordIndex: 0,
      lessonMode: 'intro',
      quizResultsByIndex: {},
      speakResultsByIndex: {},
      speakBreakdownByIndex: {},
      resumeCheckpoint: null,
    }));
  };

  const exitLesson = () => {
    setState((prev) => ({
      ...prev,
      resumeCheckpoint:
        prev.activeLesson &&
        prev.activeBandId &&
        (prev.lessonWordIndex > 0 ||
          prev.lessonMode !== 'intro' ||
          Object.keys(prev.quizResultsByIndex).length > 0 ||
          Object.keys(prev.speakResultsByIndex).length > 0)
          ? {
              bandId: prev.activeBandId,
              unitId: prev.activeLesson.unitId,
              lessonIndex: prev.activeLesson.lessonIndex,
              lessonMode: prev.lessonMode,
              lessonWordIndex: prev.lessonWordIndex,
              activeLesson: prev.activeLesson,
              quizResultsByIndex: prev.quizResultsByIndex,
              speakResultsByIndex: prev.speakResultsByIndex,
              speakBreakdownByIndex: prev.speakBreakdownByIndex,
            }
          : prev.resumeCheckpoint,
      activeLesson: null,
      lessonWordIndex: 0,
      lessonMode: 'intro',
      quizResultsByIndex: {},
      speakResultsByIndex: {},
      speakBreakdownByIndex: {},
    }));
  };

  const value: AppContextType = {
    state,
    selectLanguage,
    selectLevel,
    startLesson,
    openLessonPath,
    setLessonMode,
    nextWord,
    prevWord,
    recordQuizResult,
    recordSpeakResult,
    completeLessonProgress,
    exitLesson,
    restartLesson,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
