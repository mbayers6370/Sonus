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
  ConfidenceLevel,
  QuizPromptType,
  WordReviewState,
} from '../types/lesson.types';
import {
  getUnitMetadata,
  getUnitsForBand,
  isCheckpointUnitId,
  isPracticeUnitId,
  parseCheckpointIndex,
} from '../data/unitMetadata';
import { appendReviewWords } from '../lib/reviewInjection';
import { trackEvent } from '../lib/analytics';
import { getLessonRanges, sliceWordsForLesson } from '../lib/lessonChunks';
import { makeLessonKey } from '../lib/lessonProgress';
import { QUIZ_PASS_PERCENT, SPEAK_PASS_PERCENT } from '../lib/passCriteria';
import {
  resolveBandDataId,
  resolveUnitIdForBand,
  isMandarinBandId,
  isMandarinBandLocked,
  nextBandId,
} from '../lib/bandIds';
import {
  todayKey,
  isDue,
  plusDays,
  scheduleDaysForCorrectStreak,
  applyConfidenceAdjustment,
  pickQuizPromptType,
  getCoreWordStats,
} from '../lib/reviewScheduler';
import {
  normalizeLessonProgressKeys,
  mergeLessonProgress,
  buildLessonProgressFromRecentEvents,
} from '../lib/lessonProgressState';
import type { ProgressEventEnvelope } from '../lib/lessonProgressState';
import { apiFetch } from '../lib/apiClient';
import { getMockIdentity } from '../lib/authSession';
import { useAuth } from './AuthContext';

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
  queueLessonReattempt: (lessonIndex: number, word: Word) => void;
  recordWordOutcome: (
    word: Word,
    isCorrect: boolean,
    confidence: ConfidenceLevel,
    mode: 'quiz' | 'speak'
  ) => void;
  generateDailyReviewSet: (bandId?: string) => Promise<boolean>;
  getPromptTypeForWord: (wordId: string, mode: 'quiz' | 'speak') => QuizPromptType;
  completeLessonProgress: () => void;
  exitLesson: () => void;
  restartLesson: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'sonus-app-state';
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
const LESSON_UNLOCK_PASS_PERCENT = 85;
const BAND_UNLOCK_PASS_PERCENT = 90;
const APPLY_PROMPT_COUNT = 12;
const DAILY_REVIEW_WORD_COUNT = 5;
const QA_UNLOCK_ALL_EMAILS = new Set(['qa-admin-f8n2x7r1@sonus.test']);
const hasLessonUnlockCredit = (
  status: { completed?: boolean; quizScore?: number | null; speakScore?: number | null } | undefined
) =>
  Boolean(
    status?.completed ||
    ((status?.quizScore ?? 0) >= QUIZ_PASS_PERCENT && (status?.speakScore ?? 0) >= SPEAK_PASS_PERCENT) ||
    (status?.quizScore ?? 0) >= LESSON_UNLOCK_PASS_PERCENT
  );

function resolveStateStorageKey() {
  const { userId, email } = getMockIdentity();
  const scope = (userId || email || 'anon')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_');
  return `${STORAGE_KEY_PREFIX}:${scope}`;
}

function defaultUnlockedLevelIds() {
  const base = ALL_LEVEL_IDS.filter((id) => !/^band\d+$/i.test(id) && id !== 'advanced');
  return Array.from(new Set([...base, 'band1']));
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

type UnitRecord = {
  id: string;
  words: Word[];
};

function canonicalUnitKey(id: string) {
  return id
    .replace(/^[a-z]\d+-u\d+-/i, '')
    .replace(/^[a-z]\d+-/i, '');
}

function getBandUnits(bandData: BandData): UnitRecord[] {
  if (Array.isArray(bandData.units)) {
    return bandData.units
      .map((unit) => {
        const maybeUnit = unit as { id?: string; words?: Word[] } | null;
        if (!maybeUnit?.id) return null;
        return {
          id: maybeUnit.id,
          words: maybeUnit.words || [],
        };
      })
      .filter((unit): unit is UnitRecord => Boolean(unit));
  }

  return Object.entries(bandData.units || {})
    .map(([id, unit]) => ({
      id,
      words: unit?.words || [],
    }));
}

function getBandUnitById(bandData: BandData, unitId: string): UnitRecord | null {
  const units = getBandUnits(bandData);
  const direct = units.find((unit) => unit.id === unitId);
  if (direct) return direct;
  // Support canonical matching so equivalent ids can merge split/macro units.
  const targetKey = canonicalUnitKey(unitId);
  const matched = units.filter((unit) => canonicalUnitKey(unit.id) === targetKey);
  if (!matched.length) return null;
  return {
    id: unitId,
    words: matched.flatMap((unit) => unit.words || []),
  };
}

function getBandWordMap(bandData: BandData) {
  const map = new Map<string, Word>();
  const sourceUnitByWordId = new Map<string, string>();

  for (const unit of getBandUnits(bandData)) {
    for (const word of unit.words || []) {
      map.set(word.id, word);
      sourceUnitByWordId.set(word.id, unit.id);
    }
  }

  return { map, sourceUnitByWordId };
}


function getPracticeModeFromUnit(unitId: string): LessonMode | null {
  if (/listening$/i.test(unitId)) return 'quiz';
  if (/speaking$/i.test(unitId)) return 'speak';
  return null;
}

function isPracticeDataUnit(unitId: string) {
  return getPracticeModeFromUnit(unitId) !== null;
}

function buildPracticeWordPool(bandData: BandData, count: number): Word[] {
  const units = getBandUnits(bandData);
  const sampleUnitId = units.find((unit) => unit.id !== '_unallocated')?.id;
  const unitStem = sampleUnitId ? sampleUnitId.split('-')[0] : `b${bandData.band}`;
  const bandUnitPrefix = `${unitStem}-`;
  // Build a deterministic pool for skill labs from real band vocab only
  // (exclude synthetic units such as listening/speaking and unallocated slots).
  const pool = units
    .filter(
      (unit) =>
        unit.id.startsWith(bandUnitPrefix) &&
        unit.id !== '_unallocated' &&
        !isPracticeDataUnit(unit.id)
    )
    .flatMap((unit) => unit.words || []);
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

type ApplySentence = {
  id: string;
  wordId: string;
  zh: string;
  en: string;
  pinyin?: string;
  py?: string;
  strictUnitOnly?: boolean;
};

type ApplyBandPayload = {
  language?: string;
  bandId?: string;
  units?: Record<string, ApplySentence[]>;
};

const applySentenceCache = new Map<string, Record<string, ApplySentence[]>>();

function isApplySentence(value: unknown): value is ApplySentence {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.wordId === 'string' &&
    typeof candidate.zh === 'string' &&
    typeof candidate.en === 'string'
  );
}

function normalizeApplyUnits(value: unknown): Record<string, ApplySentence[]> {
  if (!value || typeof value !== 'object') return {};
  const rawUnits = value as Record<string, unknown>;
  const normalized: Record<string, ApplySentence[]> = {};

  for (const [unitId, entries] of Object.entries(rawUnits)) {
    if (!Array.isArray(entries)) continue;
    normalized[unitId] = entries.filter(isApplySentence);
  }

  return normalized;
}

async function fetchApplyPayload(path: string) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) return null;
  return (await response.json()) as ApplyBandPayload;
}

async function fetchApplySentenceMap(bandId: string, forceRefresh = false) {
  if (!forceRefresh && applySentenceCache.has(bandId)) {
    return applySentenceCache.get(bandId) || {};
  }
  try {
    const cacheBuster = forceRefresh ? `?v=${Date.now()}` : '';
    const payload =
      (await fetchApplyPayload(`/data/zh/${bandId}-apply.json${cacheBuster}`)) ||
      (await fetchApplyPayload(`/data/zh/${bandId}.apply.json${cacheBuster}`));
    if (!payload) {
      applySentenceCache.set(bandId, {});
      return {};
    }
    const units = normalizeApplyUnits(payload.units);
    applySentenceCache.set(bandId, units);
    return units;
  } catch {
    applySentenceCache.set(bandId, {});
    return {};
  }
}

async function fetchReviewWordIds(limit = 30): Promise<string[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 700);

  try {
    const response = await apiFetch(`/v1/me/review-queue?limit=${limit}`, {
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
    await apiFetch('/v1/me/progress/current', {
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

type LessonCompletionSnapshot = {
  bandId: string;
  unitId: string;
  lessonIndex: number;
  introViewed: boolean;
  quizScore: number | null;
  speakScore: number | null;
  speakAllCorrect: boolean;
  completed: boolean;
  mastered: boolean;
};

type ProgressCompletionEventType = 'lesson_completed' | 'apply_completed';

const LESSON_SNAPSHOT_OUTBOX_KEY_PREFIX = 'sonus.lesson_snapshot_outbox';

type QueuedLessonCompletionSnapshot = LessonCompletionSnapshot & {
  eventType: ProgressCompletionEventType;
  queuedAt: string;
};

function readQueuedLessonSnapshots() {
  const { userId, email } = getMockIdentity();
  const scope = (userId || email || 'anon').toLowerCase().replace(/[^a-z0-9._-]/g, '_');
  const storageKey = `${LESSON_SNAPSHOT_OUTBOX_KEY_PREFIX}:${scope}`;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [] as QueuedLessonCompletionSnapshot[];
    const parsed = JSON.parse(raw) as QueuedLessonCompletionSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as QueuedLessonCompletionSnapshot[];
  }
}

function writeQueuedLessonSnapshots(items: QueuedLessonCompletionSnapshot[]) {
  const { userId, email } = getMockIdentity();
  const scope = (userId || email || 'anon').toLowerCase().replace(/[^a-z0-9._-]/g, '_');
  const storageKey = `${LESSON_SNAPSHOT_OUTBOX_KEY_PREFIX}:${scope}`;
  try {
    if (!items.length) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    // Keep only newest 200 snapshots to avoid unbounded localStorage growth.
    window.localStorage.setItem(storageKey, JSON.stringify(items.slice(-200)));
  } catch {
    // Ignore localStorage failures.
  }
}

function queueLessonSnapshot(
  snapshot: LessonCompletionSnapshot,
  eventType: ProgressCompletionEventType = 'lesson_completed'
) {
  const existing = readQueuedLessonSnapshots();
  const key = makeLessonKey(snapshot.bandId, snapshot.unitId, snapshot.lessonIndex);
  const filtered = existing.filter(
    (item) => makeLessonKey(item.bandId, item.unitId, item.lessonIndex) !== key
  );
  filtered.push({
    ...snapshot,
    eventType,
    queuedAt: new Date().toISOString(),
  });
  writeQueuedLessonSnapshots(filtered);
}

async function saveLessonCompletionSnapshot(
  snapshot: LessonCompletionSnapshot,
  eventType: ProgressCompletionEventType = 'lesson_completed'
) {
  try {
    const response = await apiFetch('/v1/me/progress/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        streakDelta: 0,
        payloadJson: snapshot,
      }),
    });
    if (!response.ok) {
      queueLessonSnapshot(snapshot, eventType);
    }
  } catch {
    // Offline mode should not block lesson flow.
    queueLessonSnapshot(snapshot, eventType);
  }
}

async function flushQueuedLessonSnapshots() {
  const queued = readQueuedLessonSnapshots();
  if (!queued.length) return;

  const remaining: QueuedLessonCompletionSnapshot[] = [];
  for (const snapshot of queued) {
    try {
      const response = await apiFetch('/v1/me/progress/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: snapshot.eventType || 'lesson_completed',
          streakDelta: 0,
          payloadJson: {
            bandId: snapshot.bandId,
            unitId: snapshot.unitId,
            lessonIndex: snapshot.lessonIndex,
            introViewed: snapshot.introViewed,
            quizScore: snapshot.quizScore,
            speakScore: snapshot.speakScore,
            speakAllCorrect: snapshot.speakAllCorrect,
            completed: snapshot.completed,
            mastered: snapshot.mastered,
          },
        }),
      });
      if (!response.ok) {
        remaining.push(snapshot);
      }
    } catch {
      remaining.push(snapshot);
    }
  }

  writeQueuedLessonSnapshots(remaining);
}

const initialState: AppState = {
  selectedLanguage: null,
  currentLevel: null,
  streak: 0,
  levelProgress: {},
  lessonProgress: {},
  completedLevels: [],
  unlockedLevels: defaultUnlockedLevelIds(),
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
  wordReview: {},
  recentMisses: [],
  dailySetDate: null,
  dailySetWordIds: [],
};

function loadPersistedState(storageKey = resolveStateStorageKey()): AppState {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return initialState;
    const parsed = JSON.parse(saved) as Partial<AppState>;
    const parsedUnlocked = Array.isArray(parsed.unlockedLevels)
      ? parsed.unlockedLevels.filter((levelId): levelId is string => typeof levelId === 'string')
      : [];
    const preservedNonMandarin = parsedUnlocked.filter((levelId) => !isMandarinBandId(levelId));
    const preservedBandOne = parsedUnlocked.filter((levelId) => levelId === 'band1');
    return {
      ...initialState,
      ...parsed,
      unlockedLevels: Array.from(new Set([...defaultUnlockedLevelIds(), ...preservedNonMandarin, ...preservedBandOne])),
      lessonProgress: normalizeLessonProgressKeys(parsed.lessonProgress || {}),
      wordReview: parsed.wordReview || {},
      recentMisses: parsed.recentMisses || [],
      dailySetDate: parsed.dailySetDate || null,
      dailySetWordIds: parsed.dailySetWordIds || [],
    };
  } catch {
    return initialState;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, email: authEmail } = useAuth();
  const [storageKey, setStorageKey] = useState<string>(() => resolveStateStorageKey());
  const [state, setState] = useState<AppState>(() => loadPersistedState(resolveStateStorageKey()));

  const buildSnapshotForActiveLesson = (
    lessonState: AppState,
    nextQuizResultsByIndex: Record<number, boolean>,
    nextSpeakResultsByIndex: Record<number, boolean>,
    forceIntroViewed = false
  ): LessonCompletionSnapshot | null => {
    const activeLesson = lessonState.activeLesson;
    const bandId = lessonState.activeBandId;
    if (!activeLesson || !bandId) return null;

    const lessonKey = makeLessonKey(bandId, activeLesson.unitId, activeLesson.lessonIndex);
    const existing = lessonState.lessonProgress[lessonKey] || {
      introViewed: false,
      quizScore: null as number | null,
      speakScore: null as number | null,
      speakAllCorrect: false,
      completed: false,
      mastered: false,
    };

    const quizStats = getCoreWordStats(activeLesson.words, nextQuizResultsByIndex);
    const speakStats = getCoreWordStats(activeLesson.words, nextSpeakResultsByIndex);
    const nextQuizScore = quizStats.total > 0 ? Math.round((quizStats.correct / quizStats.total) * 100) : existing.quizScore;
    const nextSpeakScore = speakStats.total > 0 ? Math.round((speakStats.correct / speakStats.total) * 100) : existing.speakScore;
    const nextSpeakAllCorrect = speakStats.total > 0 ? speakStats.correct === speakStats.total : existing.speakAllCorrect;
    const isCheckpoint = isCheckpointUnitId(activeLesson.unitId);
    const completedByScores = isCheckpoint
      ? (nextQuizScore ?? 0) >= QUIZ_PASS_PERCENT
      : (nextQuizScore ?? 0) >= QUIZ_PASS_PERCENT && (nextSpeakScore ?? 0) >= SPEAK_PASS_PERCENT;

    return {
      bandId,
      unitId: activeLesson.unitId,
      lessonIndex: activeLesson.lessonIndex,
      introViewed:
        forceIntroViewed ||
        existing.introViewed ||
        Object.keys(nextQuizResultsByIndex).length > 0 ||
        Object.keys(nextSpeakResultsByIndex).length > 0,
      quizScore: nextQuizScore,
      speakScore: nextSpeakScore,
      speakAllCorrect: nextSpeakAllCorrect,
      completed: existing.completed || completedByScores,
      mastered: existing.mastered,
    };
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Ignore storage failures (private mode/quota) to avoid startup crashes.
    }
  }, [state, storageKey]);

  useEffect(() => {
    const nextStorageKey = resolveStateStorageKey();
    if (nextStorageKey === storageKey) return;
    setStorageKey(nextStorageKey);
    setState(loadPersistedState(nextStorageKey));
  }, [authStatus, storageKey]);

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

  useEffect(() => {
    if (authStatus !== 'signed_in') return;
    let cancelled = false;

    void (async () => {
      await flushQueuedLessonSnapshots();
      try {
        const response = await apiFetch('/v1/me/progress');
        if (!response.ok) return;
        const payload = (await response.json()) as {
          progress?: {
            streak?: number;
            lastActiveDate?: string | null;
            currentBandId?: string | null;
            currentUnitId?: string | null;
            currentLessonIdx?: number | null;
          };
          lessonProgress?: AppState['lessonProgress'];
          recentEvents?: ProgressEventEnvelope[];
        };
        if (cancelled) return;

        setState((prev) => {
          const snapshotProgress = normalizeLessonProgressKeys(payload.lessonProgress || {});
          const eventProgress = normalizeLessonProgressKeys(
            buildLessonProgressFromRecentEvents(payload.recentEvents)
          );
          const serverProgress = mergeLessonProgress(snapshotProgress, eventProgress);
          const nextLessonProgress = mergeLessonProgress(prev.lessonProgress, serverProgress);

          return {
            ...prev,
            streak: Math.max(prev.streak, payload.progress?.streak ?? 0),
            lastActiveDate: payload.progress?.lastActiveDate ?? prev.lastActiveDate,
            lessonProgress: nextLessonProgress,
          };
        });
      } catch {
        // Keep local state when backend sync is unavailable.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, storageKey]);

  useEffect(() => {
    if (authStatus !== 'signed_in') return;
    const email = (authEmail || '').trim().toLowerCase();
    if (!QA_UNLOCK_ALL_EMAILS.has(email)) return;

    setState((prev) => ({
      ...prev,
      unlockedLevels: Array.from(new Set([...prev.unlockedLevels, ...ALL_LEVEL_IDS])),
    }));
  }, [authStatus, authEmail]);

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

    if (state.selectedLanguage === 'zh' && isMandarinBandLocked(level.id, state.unlockedLevels)) {
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
      if (state.selectedLanguage === 'zh' && isMandarinBandLocked(bandId, state.unlockedLevels)) {
        return false;
      }
      const resolvedUnitId = resolveUnitIdForBand(bandId, unitId);
      const dataBandId = resolveBandDataId(bandId);
      const response = await fetch(`/data/zh/${dataBandId}.json`, { cache: 'no-store' });
      if (!response.ok) return false;
      const bandData: BandData = await response.json();
      const checkpointIndex = parseCheckpointIndex(resolvedUnitId);
      const isCheckpointQuiz = checkpointIndex !== null;
      const practiceMode = getPracticeModeFromUnit(resolvedUnitId);
      const unit = getBandUnitById(bandData, resolvedUnitId);
      const words = unit?.words || [];
      const coreLessonCount = getLessonRanges(words.length, 10).length;
      const isApplyLesson =
        !practiceMode &&
        !isCheckpointQuiz &&
        coreLessonCount > 0 &&
        lessonIndex === coreLessonCount;
      let lessonChunk: Word[] = [];
      // Unlock checks are score-based so users can continue where they left off
      // without requiring completed flags from older session states.
      const hasLessonPassedThreshold = (targetUnitId: string, targetLessonIndex: number) => {
        const key = makeLessonKey(bandId, targetUnitId, targetLessonIndex);
        return hasLessonUnlockCredit(state.lessonProgress[key]);
      };
      const coreUnitIds = getUnitsForBand(bandId)
        .filter((meta) => !isPracticeUnitId(meta.id) && !isCheckpointUnitId(meta.id))
        .map((meta) => resolveUnitIdForBand(bandId, meta.id))
        .filter((unitIdValue, idx, arr) => arr.indexOf(unitIdValue) === idx)
        .filter((unitIdValue) => Boolean(getBandUnitById(bandData, unitIdValue)?.words?.length));
      const unitLessonCount = (targetUnitId: string) => {
        const targetUnit = getBandUnitById(bandData, targetUnitId);
        return getLessonRanges((targetUnit?.words || []).length, 10).length;
      };
      const hasUnitPassedThreshold = (targetUnitId: string) => {
        const lessons = unitLessonCount(targetUnitId);
        if (lessons === 0) return false;
        for (let lessonIdx = 0; lessonIdx < lessons; lessonIdx += 1) {
          if (!hasLessonPassedThreshold(targetUnitId, lessonIdx)) return false;
        }
        return true;
      };
      const hasCheckpointPassedThreshold = (targetCheckpointId: string) =>
        hasLessonPassedThreshold(targetCheckpointId, 0);
      const unlockedByUnitId = new Map<string, boolean>();
      if (coreUnitIds.length > 0) unlockedByUnitId.set(coreUnitIds[0], true);
      for (let coreIdx = 1; coreIdx < coreUnitIds.length; coreIdx += 1) {
        const previousCore = coreUnitIds[coreIdx - 1];
        let unlocked = Boolean(unlockedByUnitId.get(previousCore)) && hasUnitPassedThreshold(previousCore);
        if (unlocked && coreIdx % 4 === 0) {
          unlocked = hasCheckpointPassedThreshold(`checkpoint-${coreIdx / 4}`);
        }
        unlockedByUnitId.set(coreUnitIds[coreIdx], unlocked);
      }
      for (const checkpointMeta of getUnitsForBand(bandId).filter((meta) => isCheckpointUnitId(meta.id))) {
        const idx = parseCheckpointIndex(checkpointMeta.id);
        if (!idx) {
          unlockedByUnitId.set(checkpointMeta.id, false);
          continue;
        }
        const start = (idx - 1) * 4;
        const end = Math.min(coreUnitIds.length, idx * 4);
        const covered = coreUnitIds.slice(start, end);
        unlockedByUnitId.set(checkpointMeta.id, covered.length > 0 && covered.every((unitIdValue) => hasUnitPassedThreshold(unitIdValue)));
      }
      for (const practiceMeta of getUnitsForBand(bandId).filter((meta) => isPracticeUnitId(meta.id))) {
        unlockedByUnitId.set(practiceMeta.id, coreUnitIds.length > 0);
      }
      if (!(unlockedByUnitId.get(resolvedUnitId) ?? false)) {
        return false;
      }
      if (!practiceMode && !isCheckpointQuiz) {
        if (lessonIndex > 0 && !isApplyLesson && !hasLessonPassedThreshold(resolvedUnitId, lessonIndex - 1)) {
          return false;
        }
      } else if (lessonIndex !== 0) {
        return false;
      }

      if (isCheckpointQuiz && checkpointIndex) {
        const baseUnits = getUnitsForBand(bandId)
          .filter((meta) => !isPracticeUnitId(meta.id) && !isCheckpointUnitId(meta.id))
          .sort((a, b) => a.order - b.order);
        const coveredUnits = baseUnits.slice(0, checkpointIndex * 4).map((meta) => meta.id);
        const pool = coveredUnits.flatMap((coveredUnitId) => {
          const covered = getBandUnitById(bandData, coveredUnitId);
          return covered?.words || [];
        });
        const uniquePool = Array.from(new Map(pool.map((word) => [word.id, word])).values());
        // Scale checkpoint size with covered vocab so it remains meaningful:
        // ~25% sample, bounded to avoid fatigue.
        const checkpointBaseSize = Math.max(
          16,
          Math.min(32, Math.round(uniquePool.length * 0.25))
        );
        lessonChunk = shuffleWords(uniquePool).slice(0, Math.min(uniquePool.length, checkpointBaseSize));
      } else {
        if (!unit) return false;
        // Apply lessons override examples with curated sentence prompts.
        const applySentenceByUnit = isApplyLesson ? await fetchApplySentenceMap(bandId, true) : {};
        const applySentences = applySentenceByUnit[resolvedUnitId] || [];
        const applyByWordId = new Map(
          applySentences
            .filter((item) => Boolean(item.wordId) && Boolean(item.zh?.trim()) && Boolean(item.en?.trim()))
            .map((item) => [item.wordId, item])
        );
        const applyFallbackByWord = words
          .filter((word) => Boolean(word.example?.zh?.trim()) && Boolean(word.example?.en?.trim()))
          .map((word) => ({
            ...word,
            example: {
              zh: word.example?.zh?.trim() || '',
              en: word.example?.en?.trim() || '',
              pinyin: word.example?.pinyin?.trim() || undefined,
            },
          }));
        const applyWordsFromMap: Word[] = [];
        for (const word of words) {
          const applySentence = applyByWordId.get(word.id);
          if (!applySentence) continue;
          applyWordsFromMap.push({
            ...word,
            example: {
              zh: applySentence.zh,
              en: applySentence.en,
              pinyin: applySentence.pinyin?.trim() || applySentence.py?.trim() || undefined,
            },
          });
        }
        const buildPracticePoolFromCurrentUnit = () => {
          const resumeUnitId =
            state.resumeCheckpoint?.bandId === bandId && state.resumeCheckpoint?.unitId
              ? resolveUnitIdForBand(bandId, state.resumeCheckpoint.unitId)
              : null;
          const activeUnitId =
            state.activeBandId === bandId && state.activeUnitId
              ? resolveUnitIdForBand(bandId, state.activeUnitId)
              : null;
          const latestUnlockedCoreUnitId = coreUnitIds.filter((id) => Boolean(unlockedByUnitId.get(id))).at(-1) || null;
          const sourceUnitId =
            (resumeUnitId && coreUnitIds.includes(resumeUnitId) ? resumeUnitId : null) ||
            (activeUnitId && coreUnitIds.includes(activeUnitId) ? activeUnitId : null) ||
            latestUnlockedCoreUnitId ||
            coreUnitIds[0];
          if (!sourceUnitId) return buildPracticeWordPool(bandData, 5);

          const sourceUnit = getBandUnitById(bandData, sourceUnitId);
          const sourceWords = sourceUnit?.words || [];
          const lessonCount = getLessonRanges(sourceWords.length, 10).length;
          const unlockedLessonIndexes: number[] = [];
          for (let idx = 0; idx < lessonCount; idx += 1) {
            if (idx === 0 || hasLessonPassedThreshold(sourceUnitId, idx - 1)) {
              unlockedLessonIndexes.push(idx);
            } else {
              break;
            }
          }
          const pool = unlockedLessonIndexes.flatMap((idx) =>
            sliceWordsForLesson(sourceWords, idx, 10)
          );
          const uniqueById = Array.from(new Map(pool.map((word) => [word.id, word])).values());
          if (!uniqueById.length) return buildPracticeWordPool(bandData, 5);
          return shuffleWords(uniqueById)
            .slice(0, 5)
            .map((word) => ({ ...word, sourceUnitId, isReview: false }));
        };

        lessonChunk =
          isApplyLesson
            ? shuffleWords(
                // Prefer curated apply JSON prompts; fall back to embedded examples
                // when a unit has no mapped apply entries.
                applyWordsFromMap.length > 0 ? applyWordsFromMap : applyFallbackByWord
              ).slice(0, APPLY_PROMPT_COUNT)
          : practiceMode
            ? buildPracticePoolFromCurrentUnit()
            : sliceWordsForLesson(words, lessonIndex);
      }
      if (!lessonChunk.length) return false;

      const targetLessonKey = makeLessonKey(bandId, resolvedUnitId, lessonIndex);
      const targetLessonStatus = state.lessonProgress[targetLessonKey];
      const isMasterySessionTarget = Boolean(targetLessonStatus?.completed && !targetLessonStatus?.mastered);

      const resumeCheckpoint = state.resumeCheckpoint;
      const resumeWords = resumeCheckpoint?.activeLesson?.words || [];
      const hasValidResumeWords =
        Boolean(resumeWords.length) &&
        (resumeCheckpoint?.lessonWordIndex ?? 0) >= 0 &&
        (resumeCheckpoint?.lessonWordIndex ?? 0) < resumeWords.length;
      const hasLegacyReattemptWords = resumeWords.some(
        (word) => Boolean(word.isReattempt) || Boolean(word.reattemptOfWordId)
      );
      const isResumeLengthValid =
        resumeWords.length >= lessonChunk.length && resumeWords.length <= lessonChunk.length + 3;
      const canResumeSameLesson =
        Boolean(resumeCheckpoint) &&
        hasValidResumeWords &&
        !hasLegacyReattemptWords &&
        !isCheckpointQuiz &&
        !isApplyLesson &&
        isResumeLengthValid &&
        resumeCheckpoint?.bandId === bandId &&
        resolveUnitIdForBand(resumeCheckpoint?.bandId ?? '', resumeCheckpoint?.unitId ?? '') ===
          resolvedUnitId &&
        resumeCheckpoint?.lessonIndex === lessonIndex;

      // Resume only normal lessons with a compatible word list shape.
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

      const { map: allWordById, sourceUnitByWordId } = getBandWordMap(bandData);
      const lessonWordsBase: Word[] = shuffleWords(lessonChunk).map((word) => ({
        ...word,
        sourceUnitId: resolvedUnitId,
        isReview: false,
      }));
      const lessonWordIds = new Set(lessonWordsBase.map((w) => w.id));
      let lessonWords = [...lessonWordsBase];

      if (!practiceMode && !isApplyLesson && !isMasterySessionTarget) {
        const reviewWordIds = await fetchReviewWordIds(40);
        const checkpointCoveredUnitIds =
          isCheckpointQuiz && checkpointIndex
            ? new Set(
                getUnitsForBand(bandId)
                  .filter((meta) => !isPracticeUnitId(meta.id) && !isCheckpointUnitId(meta.id))
                  .sort((a, b) => a.order - b.order)
                  .slice(0, checkpointIndex * 4)
                  .map((meta) => meta.id)
              )
            : null;
        const includeCandidateUnit = (sourceUnit: string | undefined) => {
          if (!sourceUnit) return false;
          if (checkpointCoveredUnitIds) return checkpointCoveredUnitIds.has(sourceUnit);
          return sourceUnit !== resolvedUnitId;
        };
        const needsWorkCandidates = reviewWordIds
          .filter((wordId) => !lessonWordIds.has(wordId))
          .map((wordId) => {
            const sourceUnitId = sourceUnitByWordId.get(wordId);
            const base = allWordById.get(wordId);
            if (!base || !includeCandidateUnit(sourceUnitId)) return null;
            return {
              ...base,
              sourceUnitId,
              isReview: true,
              reviewReason: 'Needs reinforcement from weak queue',
            } as Word;
          })
          .filter((word): word is Word => Boolean(word));

        const reviewCandidates = shuffleWords(needsWorkCandidates);
        const shouldInjectReviewWords = !isCheckpointQuiz;
        // Inject a small number of needs-work words without replacing core lesson content.
        lessonWords = shouldInjectReviewWords
          ? appendReviewWords(lessonWordsBase, reviewCandidates, 3, 1)
          : [...lessonWordsBase];
      }

      if (isApplyLesson) {
        // Apply mode must remain unit-only; never include review/retest overlays.
        lessonWords = lessonWords
          .filter((word) => (word.sourceUnitId || resolvedUnitId) === resolvedUnitId)
          .map((word) => ({
            ...word,
            sourceUnitId: resolvedUnitId,
            isReview: false,
            reviewReason: undefined,
            isReattempt: false,
            reattemptOfWordId: undefined,
            reattemptQueued: false,
          }));
      }

      const metadata = getUnitMetadata(bandId, resolvedUnitId);
      const newLesson: ActiveLesson = {
        unitId: resolvedUnitId,
        unitName: isApplyLesson
          ? `${metadata?.name ?? formatUnitLabel(resolvedUnitId)} · Apply`
          : (metadata?.name ?? formatUnitLabel(resolvedUnitId)),
        unitOrder: metadata?.order,
        lessonIndex,
        words: lessonWords,
      };

      setState((prev) => {
        const nextWordReview = { ...prev.wordReview };
        // Ensure every known word has review metadata for spaced scheduling.
        for (const [wordId] of allWordById.entries()) {
          if (nextWordReview[wordId]) continue;
          const sourceUnitId = sourceUnitByWordId.get(wordId) || null;
          nextWordReview[wordId] = {
            nextReviewAt: plusDays(0),
            consecutiveCorrect: 0,
            totalCorrect: 0,
            totalWrong: 0,
            lastReviewedAt: null,
            lastResult: null,
            lastConfidence: null,
            promptCursor: 0,
            sourceUnitId,
          };
        }

        return {
          ...prev,
          wordReview: nextWordReview,
          activeBandId: bandId,
          activeBandData: bandData,
          activeUnitId: resolvedUnitId,
          activeLesson: newLesson,
          lessonMode: isApplyLesson ? 'apply' : (isCheckpointQuiz ? 'quiz' : (practiceMode ?? 'intro')),
          lessonWordIndex: 0,
          quizResultsByIndex: {},
          speakResultsByIndex: {},
          speakBreakdownByIndex: {},
          resumeCheckpoint: null,
        };
      });
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
      const isCheckpoint = isCheckpointUnitId(unitId);
      if (!activeBandData || (!isCheckpoint && !getBandUnitById(activeBandData, unitId)) || !activeBandId) {
        alert('No vocab loaded for this unit yet.');
        return;
      }
      await openLessonPath(activeBandId, unitId, lessonIndex);
    })();
  };

  const setLessonMode = (mode: LessonMode) => {
    let snapshot: LessonCompletionSnapshot | null = null;
    setState((prev) => {
      const next = {
        ...prev,
        lessonMode: mode,
        activeLesson: prev.activeLesson,
        lessonWordIndex: 0,
        quizResultsByIndex: mode === 'quiz' ? {} : prev.quizResultsByIndex,
        speakResultsByIndex: mode === 'speak' ? {} : prev.speakResultsByIndex,
        speakBreakdownByIndex: mode === 'speak' ? {} : prev.speakBreakdownByIndex,
      };
      if (mode !== 'intro' && mode !== 'apply') {
        snapshot = buildSnapshotForActiveLesson(next, next.quizResultsByIndex, next.speakResultsByIndex, true);
      }
      return next;
    });
    if (snapshot) {
      void saveLessonCompletionSnapshot(snapshot);
    }
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
    let snapshot: LessonCompletionSnapshot | null = null;
    setState((prev) => {
      const nextQuizResultsByIndex = {
        ...prev.quizResultsByIndex,
        [lessonIndex]: isCorrect,
      };
      const next = {
        ...prev,
        quizResultsByIndex: nextQuizResultsByIndex,
      };
      snapshot = buildSnapshotForActiveLesson(
        next,
        nextQuizResultsByIndex,
        prev.speakResultsByIndex
      );
      return next;
    });
    if (snapshot) {
      void saveLessonCompletionSnapshot(snapshot);
    }
  };

  const recordSpeakResult = (lessonIndex: number, isCorrect: boolean, breakdown?: SpeakBreakdown) => {
    let snapshot: LessonCompletionSnapshot | null = null;
    setState((prev) => {
      const nextBreakdownByIndex = breakdown
        ? {
            ...prev.speakBreakdownByIndex,
            [lessonIndex]: breakdown,
          }
        : prev.speakBreakdownByIndex;
      const nextSpeakResultsByIndex = {
        ...prev.speakResultsByIndex,
        [lessonIndex]: isCorrect,
      };
      const next = {
        ...prev,
        speakResultsByIndex: nextSpeakResultsByIndex,
        speakBreakdownByIndex: nextBreakdownByIndex,
      };
      snapshot = buildSnapshotForActiveLesson(
        next,
        prev.quizResultsByIndex,
        nextSpeakResultsByIndex
      );

      return next;
    });
    if (snapshot) {
      void saveLessonCompletionSnapshot(snapshot);
    }
  };

  const queueLessonReattempt = (lessonIndex: number, word: Word) => {
    setState((prev) => {
      if (!prev.activeLesson) return prev;
      const sourceWord = prev.activeLesson.words[lessonIndex];
      if (!sourceWord || sourceWord.reattemptQueued) return prev;
      // Reinsert a quick retest later in the same lesson sequence.
      const delay = 5 + Math.floor(Math.random() * 6);
      const insertAt = Math.min(prev.activeLesson.words.length, lessonIndex + delay + 1);
      const clone: Word = {
        ...word,
        isReview: true,
        isReattempt: true,
        reattemptOfWordId: word.id,
        reviewReason: 'Quick re-test to reinforce correction from an earlier miss.',
      };
      const nextWords = [...prev.activeLesson.words];
      nextWords.splice(insertAt, 0, clone);
      nextWords[lessonIndex] = {
        ...sourceWord,
        reattemptQueued: true,
      };
      return {
        ...prev,
        activeLesson: {
          ...prev.activeLesson,
          words: nextWords,
        },
      };
    });
  };

  const recordWordOutcome = (
    word: Word,
    isCorrect: boolean,
    confidence: ConfidenceLevel,
    mode: 'quiz' | 'speak'
  ) => {
    const now = new Date().toISOString();
    setState((prev) => {
      const existing: WordReviewState = prev.wordReview[word.id] || {
        nextReviewAt: now,
        consecutiveCorrect: 0,
        totalCorrect: 0,
        totalWrong: 0,
        lastReviewedAt: null,
        lastResult: null,
        lastConfidence: null,
        promptCursor: 0,
        sourceUnitId: word.sourceUnitId || prev.activeLesson?.unitId || null,
      };

      let consecutiveCorrect = existing.consecutiveCorrect;
      let totalCorrect = existing.totalCorrect;
      let totalWrong = existing.totalWrong;
      let nextReviewAt = existing.nextReviewAt;

      if (!isCorrect) {
        // Wrong answers reset streak and pull the next review window closer.
        consecutiveCorrect = 0;
        totalWrong += 1;
        nextReviewAt = plusDays(1);
      } else {
        // Correct answers expand the spacing interval based on streak/confidence.
        consecutiveCorrect = Math.min(existing.consecutiveCorrect + 1, 3);
        totalCorrect += 1;
        const baseDays = scheduleDaysForCorrectStreak(consecutiveCorrect);
        const adjustedDays = applyConfidenceAdjustment(baseDays, consecutiveCorrect, confidence);
        nextReviewAt = plusDays(adjustedDays);
      }

      const nextReview: WordReviewState = {
        ...existing,
        nextReviewAt,
        consecutiveCorrect,
        totalCorrect,
        totalWrong,
        lastReviewedAt: now,
        lastResult: isCorrect ? 'correct' : 'wrong',
        lastConfidence: confidence,
        promptCursor: existing.promptCursor + (mode === 'quiz' || mode === 'speak' ? 1 : 0),
        sourceUnitId: existing.sourceUnitId || word.sourceUnitId || prev.activeLesson?.unitId || null,
      };

      const recentMisses = !isCorrect
        ? [word.id, ...prev.recentMisses.filter((id) => id !== word.id)].slice(0, 80)
        : prev.recentMisses;

      return {
        ...prev,
        wordReview: {
          ...prev.wordReview,
          [word.id]: nextReview,
        },
        recentMisses,
      };
    });
  };

  const getPromptTypeForWord = (wordId: string, mode: 'quiz' | 'speak') => {
    const cursor = state.wordReview[wordId]?.promptCursor || 0;
    return pickQuizPromptType(cursor, mode);
  };

  const generateDailyReviewSet = async (bandId?: string): Promise<boolean> => {
    const targetBandId = bandId || state.activeBandId || state.currentLevel?.id || 'band1';
    const dataBandId = resolveBandDataId(targetBandId);

    try {
      const response = await fetch(`/data/zh/${dataBandId}.json`, { cache: 'no-store' });
      if (!response.ok) return false;
      const bandData: BandData = await response.json();
      const { map: wordById, sourceUnitByWordId } = getBandWordMap(bandData);
      const nowMs = Date.now();
      const today = todayKey();
      const coreUnitIds = getUnitsForBand(targetBandId)
        .filter((meta) => !isPracticeUnitId(meta.id) && !isCheckpointUnitId(meta.id))
        .map((meta) => resolveUnitIdForBand(targetBandId, meta.id))
        .filter((unitIdValue, idx, arr) => arr.indexOf(unitIdValue) === idx)
        .filter((unitIdValue) => Boolean(getBandUnitById(bandData, unitIdValue)?.words?.length));
      const fallbackUnitId = coreUnitIds[0];

      const resumeUnitId =
        state.resumeCheckpoint?.bandId === targetBandId && state.resumeCheckpoint?.unitId
          ? resolveUnitIdForBand(targetBandId, state.resumeCheckpoint.unitId)
          : null;
      const activeUnitId =
        state.activeBandId === targetBandId && state.activeUnitId
          ? resolveUnitIdForBand(targetBandId, state.activeUnitId)
          : null;
      const candidateUnitId =
        (resumeUnitId && !isPracticeUnitId(resumeUnitId) && !isCheckpointUnitId(resumeUnitId) && resumeUnitId !== 'daily-review'
          ? resumeUnitId
          : null) ||
        (activeUnitId && !isPracticeUnitId(activeUnitId) && !isCheckpointUnitId(activeUnitId) && activeUnitId !== 'daily-review'
          ? activeUnitId
          : null) ||
        fallbackUnitId;
      if (!candidateUnitId) return false;
      const candidateUnit = getBandUnitById(bandData, candidateUnitId);
      if (!candidateUnit) return false;
      const unitLessonCount = getLessonRanges(candidateUnit.words.length, 10).length;
      if (unitLessonCount === 0) return false;
      const hasLessonPassedThreshold = (targetLessonIndex: number) => {
        const key = makeLessonKey(targetBandId, candidateUnitId, targetLessonIndex);
        return hasLessonUnlockCredit(state.lessonProgress[key]);
      };
      const unlockedLessonIndexes: number[] = [];
      for (let lessonIdx = 0; lessonIdx < unitLessonCount; lessonIdx += 1) {
        if (lessonIdx === 0 || hasLessonPassedThreshold(lessonIdx - 1)) {
          unlockedLessonIndexes.push(lessonIdx);
        } else {
          break;
        }
      }
      const candidateWordIds = new Set<string>();
      for (const lessonIdx of unlockedLessonIndexes) {
        for (const word of sliceWordsForLesson(candidateUnit.words, lessonIdx, 10)) {
          candidateWordIds.add(word.id);
        }
      }
      if (!candidateWordIds.size) return false;

      const due = Object.entries(state.wordReview)
        .filter(([wordId, review]) => isDue(review.nextReviewAt, nowMs) && candidateWordIds.has(wordId) && wordById.has(wordId))
        .sort((a, b) => Date.parse(a[1].nextReviewAt) - Date.parse(b[1].nextReviewAt))
        .map(([wordId]) => wordId);

      const recentMisses = state.recentMisses.filter((wordId) => candidateWordIds.has(wordId) && wordById.has(wordId));

      const agingStrong = Object.entries(state.wordReview)
        .filter(([wordId, review]) => candidateWordIds.has(wordId) && wordById.has(wordId) && review.consecutiveCorrect >= 3)
        .sort((a, b) => {
          const aTime = Date.parse(a[1].lastReviewedAt || '1970-01-01T00:00:00.000Z');
          const bTime = Date.parse(b[1].lastReviewedAt || '1970-01-01T00:00:00.000Z');
          return aTime - bTime;
        })
        .map(([wordId]) => wordId);

      const picks: string[] = [];
      const seen = new Set<string>();
      // Fill daily sets in priority order: due -> recent misses -> aging strong -> random backfill.
      for (const wordId of due) {
        if (picks.length >= DAILY_REVIEW_WORD_COUNT) break;
        if (seen.has(wordId)) continue;
        seen.add(wordId);
        picks.push(wordId);
      }
      for (const wordId of recentMisses) {
        if (picks.length >= DAILY_REVIEW_WORD_COUNT) break;
        if (seen.has(wordId)) continue;
        seen.add(wordId);
        picks.push(wordId);
      }
      for (const wordId of agingStrong) {
        if (picks.length >= DAILY_REVIEW_WORD_COUNT) break;
        if (seen.has(wordId)) continue;
        seen.add(wordId);
        picks.push(wordId);
      }

      if (picks.length < DAILY_REVIEW_WORD_COUNT) {
        for (const wordId of shuffleWords(Array.from(candidateWordIds))) {
          if (picks.length >= DAILY_REVIEW_WORD_COUNT) break;
          if (seen.has(wordId)) continue;
          seen.add(wordId);
          picks.push(wordId);
        }
      }

      const words = picks
        .map((wordId) => {
          const base = wordById.get(wordId);
          if (!base) return null;
          const sourceUnitId = sourceUnitByWordId.get(wordId);
          return {
            ...base,
            sourceUnitId,
            isReview: true,
            reviewReason: 'Daily spaced retrieval set',
          } as Word;
        })
        .filter((word): word is Word => Boolean(word));

      if (!words.length) return false;

      setState((prev) => ({
        ...prev,
        activeBandId: targetBandId,
        activeBandData: bandData,
        activeUnitId: 'daily-review',
        activeLesson: {
          unitId: 'daily-review',
          unitName: 'Daily Review',
          lessonIndex: 0,
          words,
        },
        lessonMode: 'quiz',
        lessonWordIndex: 0,
        quizResultsByIndex: {},
        speakResultsByIndex: {},
        speakBreakdownByIndex: {},
        resumeCheckpoint: null,
        dailySetDate: today,
        dailySetWordIds: picks,
      }));

      trackEvent('daily_set_started', {
        bandId: targetBandId,
        totalWords: words.length,
      });
      return true;
    } catch {
      return false;
    }
  };

  const completeLessonProgress = () => {
    const { activeLesson, streak, lastActiveDate, lessonMode } = state;
    if (!activeLesson) return;
    const nextCurrentPathRef: {
      current: { bandId: string; unitId: string; lessonIdx: number } | null;
    } = { current: null };
    const completionSnapshotRef: { current: LessonCompletionSnapshot | null } = { current: null };
    const isCheckpointQuizUnit = isCheckpointUnitId(activeLesson.unitId);
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
        speakScore: null as number | null,
        speakAllCorrect: false,
        completed: false,
        mastered: false,
      };

      let nextIntroViewed = existing.introViewed;
      let nextQuizScore = existing.quizScore;
      let nextSpeakScore = existing.speakScore ?? null;
      let nextSpeakAllCorrect = existing.speakAllCorrect;
      let nextMastered = existing.mastered;

      if (lessonMode === 'intro') {
        nextIntroViewed = true;
      } else if (lessonMode === 'apply') {
        nextIntroViewed = true;
        nextQuizScore = 100;
        nextSpeakScore = 100;
        nextSpeakAllCorrect = true;
        nextMastered = true;
      } else if (lessonMode === 'quiz') {
        const { total, correct } = getCoreWordStats(activeLesson.words, prev.quizResultsByIndex);
        nextQuizScore = total > 0 ? Math.round((correct / total) * 100) : 0;
      } else if (lessonMode === 'speak') {
        const { total, correct } = getCoreWordStats(activeLesson.words, prev.speakResultsByIndex);
        nextSpeakScore = total > 0 ? Math.round((correct / total) * 100) : 0;
        nextSpeakAllCorrect = total > 0 && correct === total;
      }

      const computedCompleted = isCheckpointQuizUnit
        ? (nextQuizScore ?? 0) >= QUIZ_PASS_PERCENT
        : (nextQuizScore ?? 0) >= QUIZ_PASS_PERCENT &&
          (nextSpeakScore ?? 0) >= SPEAK_PASS_PERCENT;
      const completed = existing.completed || computedCompleted;

      const isMasteryAttempt = existing.completed && !existing.mastered;
      if (lessonMode === 'apply') {
        nextMastered = true;
      } else if (
        isMasteryAttempt &&
        lessonMode === 'speak' &&
        !isCheckpointQuizUnit &&
        (nextQuizScore ?? 0) >= QUIZ_PASS_PERCENT &&
        (nextSpeakScore ?? 0) >= SPEAK_PASS_PERCENT
      ) {
        nextMastered = true;
      }
      const masteryJustAchieved = !existing.mastered && nextMastered;

      const nextLessonProgress = {
        ...prev.lessonProgress,
        [lessonKey]: {
          introViewed: nextIntroViewed,
          quizScore: nextQuizScore,
          speakScore: nextSpeakScore,
          speakAllCorrect: nextSpeakAllCorrect,
          completed,
          mastered: nextMastered,
        },
      };
      completionSnapshotRef.current = {
        bandId,
        unitId: activeLesson.unitId,
        lessonIndex: activeLesson.lessonIndex,
        introViewed: nextIntroViewed,
        quizScore: nextQuizScore,
        speakScore: nextSpeakScore,
        speakAllCorrect: nextSpeakAllCorrect,
        completed,
        mastered: nextMastered,
      };

      let nextUnlockedLevels = prev.unlockedLevels;
      // Band unlocks are computed from per-lesson quiz thresholds across core units.
      if (state.selectedLanguage === 'zh' && /^band\d+$/i.test(bandId) && prev.activeBandData) {
        const coreUnits = getUnitsForBand(bandId)
          .filter((unit) => !isPracticeUnitId(unit.id) && !isCheckpointUnitId(unit.id))
          .map((unit) => resolveUnitIdForBand(bandId, unit.id));
        const lessonTotals = coreUnits.reduce(
          (acc, resolvedUnitId) => {
            const unit = getBandUnitById(prev.activeBandData!, resolvedUnitId);
            const lessonRanges = getLessonRanges((unit?.words || []).length, 10);
            if (!lessonRanges.length) return acc;
            for (let lessonIdx = 0; lessonIdx < lessonRanges.length; lessonIdx += 1) {
              acc.total += 1;
              const key = makeLessonKey(bandId, resolvedUnitId, lessonIdx);
              const score = nextLessonProgress[key]?.quizScore ?? 0;
              if (score >= LESSON_UNLOCK_PASS_PERCENT) acc.passed += 1;
            }
            return acc;
          },
          { passed: 0, total: 0 }
        );
        const bandProgressPercent =
          lessonTotals.total > 0 ? Math.round((lessonTotals.passed / lessonTotals.total) * 100) : 0;
        if (bandProgressPercent >= BAND_UNLOCK_PASS_PERCENT) {
          const unlocks = new Set(prev.unlockedLevels);
          const upcoming = nextBandId(bandId);
          if (upcoming) unlocks.add(upcoming);
          if (bandId === 'band9') unlocks.add('advanced');
          nextUnlockedLevels = Array.from(unlocks);
        }
      }

      const resolvedUnitId = resolveUnitIdForBand(bandId, activeLesson.unitId);
      if (
        prev.activeBandData &&
        !isPracticeUnitId(resolvedUnitId) &&
        !isCheckpointUnitId(resolvedUnitId) &&
        resolvedUnitId !== 'daily-review'
      ) {
        const unit = getBandUnitById(prev.activeBandData, resolvedUnitId);
        const lessonRanges = getLessonRanges((unit?.words || []).length, 10);
        if (lessonRanges.length > 0) {
          let latestUnlockedLessonIndex = 0;
          for (let lessonIdx = 1; lessonIdx < lessonRanges.length; lessonIdx += 1) {
            const priorKey = makeLessonKey(bandId, resolvedUnitId, lessonIdx - 1);
            const priorPassed = hasLessonUnlockCredit(nextLessonProgress[priorKey]);
            if (!priorPassed) break;
            latestUnlockedLessonIndex = lessonIdx;
          }
          nextCurrentPathRef.current = {
            bandId,
            unitId: resolvedUnitId,
            lessonIdx: latestUnlockedLessonIndex,
          };
        }
      }

      return {
        ...prev,
        streak: newStreak,
        lastActiveDate: today,
        resumeCheckpoint: null,
        unlockedLevels: nextUnlockedLevels,
        wordReview: (() => {
          if (!masteryJustAchieved || lessonMode === 'intro') return prev.wordReview;

          const resultByIndex =
            lessonMode === 'quiz' ? prev.quizResultsByIndex : prev.speakResultsByIndex;
          const boostAtMs = Date.now() + 7 * 86400000;
          const relearnAtIso = plusDays(1);
          const boosted = { ...prev.wordReview };

          activeLesson.words.forEach((word, index) => {
            if (word.isReview) return;
            const isCorrect = Boolean(resultByIndex[index]);
            const existingWord: WordReviewState = boosted[word.id] || {
              nextReviewAt: plusDays(0),
              consecutiveCorrect: 0,
              totalCorrect: 0,
              totalWrong: 0,
              lastReviewedAt: null,
              lastResult: null,
              lastConfidence: null,
              promptCursor: 0,
              sourceUnitId: activeLesson.unitId,
            };

            if (isCorrect) {
              const currentTs = Date.parse(existingWord.nextReviewAt);
              const mergedTs = Number.isFinite(currentTs)
                ? Math.max(currentTs, boostAtMs)
                : boostAtMs;
              boosted[word.id] = {
                ...existingWord,
                nextReviewAt: new Date(mergedTs).toISOString(),
                consecutiveCorrect: Math.max(existingWord.consecutiveCorrect, 2),
              };
              return;
            }

            boosted[word.id] = {
              ...existingWord,
              nextReviewAt: relearnAtIso,
              consecutiveCorrect: 0,
            };
          });

          return boosted;
        })(),
        lessonProgress: nextLessonProgress,
      };
    });
    if (completionSnapshotRef.current?.completed) {
      trackEvent('lesson_completed', {
        unitId: activeLesson.unitId,
        lessonIndex: activeLesson.lessonIndex,
        totalWords: activeLesson.words.length,
      });
    }
    if (nextCurrentPathRef.current) {
      void saveCurrentLessonPath(
        nextCurrentPathRef.current.bandId,
        nextCurrentPathRef.current.unitId,
        nextCurrentPathRef.current.lessonIdx
      );
    }
    if (completionSnapshotRef.current) {
      const eventType: ProgressCompletionEventType =
        lessonMode === 'apply' ? 'apply_completed' : 'lesson_completed';
      void saveLessonCompletionSnapshot(completionSnapshotRef.current, eventType);
    }
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
    queueLessonReattempt,
    recordWordOutcome,
    generateDailyReviewSet,
    getPromptTypeForWord,
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
