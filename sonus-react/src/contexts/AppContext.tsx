import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AppState, LessonBand, BandData, ActiveLesson, LessonMode, Word } from '../types/lesson.types';
import { getUnitMetadata } from '../data/unitMetadata';
import { appendReviewWords } from '../lib/reviewInjection';
import { trackEvent } from '../lib/analytics';

interface AppContextType {
  state: AppState;
  selectLanguage: (langId: string | null) => void;
  selectLevel: (level: LessonBand | null) => Promise<void>;
  startLesson: (unitId: string, lessonIndex: number) => void;
  openLessonPath: (bandId: string, unitId: string, lessonIndex: number) => Promise<boolean>;
  setLessonMode: (mode: LessonMode) => void;
  nextWord: () => void;
  prevWord: () => void;
  completeLessonProgress: () => void;
  exitLesson: () => void;
  restartLesson: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = 'sonus-app-state';

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
  completedLevels: [],
  unlockedLevels: ['intro', 'band1'],
  activeLesson: null,
  lessonMode: 'intro',
  lessonWordIndex: 0,
  lastActiveDate: null,
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
        return { ...initialState, ...JSON.parse(saved) };
      } catch {
        return initialState;
      }
    }
    return initialState;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

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
      const response = await fetch(`/data/zh/${level.id}.json`);
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
      const response = await fetch(`/data/zh/${bandId}.json`);
      if (!response.ok) return false;
      const bandData: BandData = await response.json();
      const unit = bandData.units[unitId];
      if (!unit) return false;

      const words = unit.words;
      const chunkSize = 10;
      const start = lessonIndex * chunkSize;
      const lessonChunk = words.slice(start, start + chunkSize);
      if (!lessonChunk.length) return false;

      const lessonWords: Word[] = shuffleWords(lessonChunk).map((word) => ({
        ...word,
        isReview: false,
      }));

      const reviewWordIds = await fetchReviewWordIds(30);
      if (reviewWordIds.length > 0) {
        const lessonWordIds = new Set(lessonWords.map((w) => w.id));
        const allBandWords = Object.values(bandData.units).flatMap((nextUnit) => nextUnit.words);
        const byId = new Map(allBandWords.map((w) => [w.id, w]));
        const reviewCandidates = reviewWordIds
          .map((id) => byId.get(id))
          .filter((w): w is Word => Boolean(w) && !lessonWordIds.has((w as Word).id));
        const nextWords = appendReviewWords(
          lessonWords,
          reviewCandidates,
          REVIEW_INJECT_MAX,
          REVIEW_INJECT_PROBABILITY
        );
        lessonWords.length = 0;
        lessonWords.push(...nextWords);
      }

      const metadata = getUnitMetadata(bandId, unitId);
      const newLesson: ActiveLesson = {
        unitId,
        unitName: metadata?.name ?? formatUnitLabel(unitId),
        unitOrder: metadata?.order,
        lessonIndex,
        words: lessonWords,
      };

      setState((prev) => ({
        ...prev,
        activeBandId: bandId,
        activeBandData: bandData,
        activeUnitId: unitId,
        activeLesson: newLesson,
        lessonMode: 'intro',
        lessonWordIndex: 0,
      }));
      void saveCurrentLessonPath(bandId, unitId, lessonIndex);
      trackEvent('lesson_started', {
        bandId,
        unitId,
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

  const completeLessonProgress = () => {
    const { activeLesson, streak, lastActiveDate } = state;
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

    setState((prev) => ({
      ...prev,
      streak: newStreak,
      lastActiveDate: today,
    }));
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
    }));
  };

  const exitLesson = () => {
    setState((prev) => ({
      ...prev,
      activeLesson: null,
      lessonWordIndex: 0,
      lessonMode: 'intro',
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
