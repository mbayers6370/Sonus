import { useEffect, useMemo, useState } from 'react';
import BottomNav from './BottomNav';
import { loadWordLookup, type WordLookup } from '../lib/wordLookup';
import GlassHeader from './GlassHeader';
import { apiFetch } from '../lib/apiClient';
import { formatUnitNameForDisplay, getUnitMetadata, getUnitsForBand, isCheckpointUnitId, isPracticeUnitId } from '../data/unitMetadata';
import { useApp } from '../contexts/AppContext';
import { QUIZ_PASS_PERCENT, SPEAK_PASS_PERCENT } from '../lib/passCriteria';
import { normalizeLanguageId } from '../lib/languageRuntime';
import { getTrackedEvents } from '../lib/analytics';
import { makeLessonKey } from '../lib/lessonProgress';
import type { SharedLexeme, SharedUserProgress } from '../../../shared/contracts';

type Progress = SharedUserProgress;

type NeedsWorkItem = {
  wordId: string;
  totalMisses: number;
  reasons: string[];
  pronunciationRisk: number;
  missedQuizCount: number;
  mispronounceCount: number;
  lexeme?: SharedLexeme;
};

interface ProfileProgressScreenProps {
  onGoHome: () => void;
  onGoProfile: () => void;
}

function inferUnitFromLessonProgress(
  bandId: string | null,
  lessonProgress: Record<string, unknown>,
  bandData?: { units?: Array<{ id?: string }> | Record<string, { id?: string }> } | null
) {
  if (!bandId) return null;
  const unitIds = new Set<string>();
  for (const key of Object.keys(lessonProgress || {})) {
    const [keyBandId, keyUnitId] = key.split(':');
    if (keyBandId === bandId && keyUnitId) {
      unitIds.add(keyUnitId);
    }
  }
  const orderedCoreUnits = getUnitsForBand(bandId, bandData)
    .filter((unit) => !isCheckpointUnitId(unit.id) && !isPracticeUnitId(unit.id))
    .map((unit) => unit.id);
  const latestStarted = orderedCoreUnits.filter((unitId) => unitIds.has(unitId)).at(-1);
  return latestStarted ?? null;
}

function inferLatestLessonIdxForUnit(
  bandId: string | null,
  unitId: string | null,
  lessonProgress: Record<string, unknown>
) {
  if (!bandId || !unitId) return null;
  let maxSeen = -1;
  for (const key of Object.keys(lessonProgress || {})) {
    const [keyBandId, keyUnitId, keyLessonIdx] = key.split(':');
    if (keyBandId !== bandId || keyUnitId !== unitId) continue;
    const idx = Number(keyLessonIdx);
    if (Number.isFinite(idx)) maxSeen = Math.max(maxSeen, idx);
  }
  return maxSeen >= 0 ? maxSeen : null;
}

function formatUnitFallbackLabel(unitId: string | null | undefined) {
  const value = (unitId || '').trim();
  if (!value) return 'Unit #';
  const match = value.match(/(\d+)(?!.*\d)/);
  if (match) return `Unit ${match[1]}`;
  return 'Unit #';
}

const ROWS_PER_PAGE = 2;
const isInstructionalComplete = (quizScore: number | null | undefined, speakScore: number | null | undefined) =>
  (quizScore ?? 0) >= QUIZ_PASS_PERCENT && (speakScore ?? 0) >= SPEAK_PASS_PERCENT;

function toLocalDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateCurrentCompletionStreak(completedDayKeys: Set<string>) {
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (completedDayKeys.has(toLocalDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getNeedsWorkColumns(width: number) {
  if (width >= 1024) return 4;
  if (width >= 640) return 3;
  return 2;
}

function bandMatchesLanguage(bandId: string | null | undefined, languageId: string | null) {
  if (!bandId || !languageId) return false;
  if (languageId === 'ja') return /^n[1-5]$/i.test(bandId);
  return true;
}

function isInternalWordIdLike(value: string, wordId: string) {
  const normalized = value.trim().toLowerCase();
  const normalizedWordId = wordId.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === normalizedWordId) return true;
  return /^(?:[ln]\d+[-_][a-z0-9]+|[a-z]+[-_]\d+[a-z0-9_-]*)$/i.test(normalized);
}

function safeDisplayValue(value: string | null | undefined, wordId: string) {
  const normalized = (value || '').trim();
  if (!normalized) return '';
  if (isInternalWordIdLike(normalized, wordId)) return '';
  return normalized;
}

function toNeedsWorkCard(
  item: NeedsWorkItem,
  fallbackLookup: WordLookup
) {
  if (item.lexeme) {
    const reading = safeDisplayValue(
      item.lexeme.reading ||
      item.lexeme.pronunciation ||
      item.lexeme.scripts?.secondary ||
      '',
      item.wordId
    );
    const lexemeTerm = safeDisplayValue(item.lexeme.term, item.wordId);
    const lexemeEn = safeDisplayValue(item.lexeme.en, item.wordId);
    const fallback = fallbackLookup[item.wordId];
    return {
      term: lexemeTerm || fallback?.simp || 'Word',
      reading,
      en: lexemeEn || safeDisplayValue(fallback?.en || '', item.wordId),
    };
  }

  const fallback = fallbackLookup[item.wordId];
  return {
    term: safeDisplayValue(fallback?.simp || '', item.wordId) || 'Word',
    reading: safeDisplayValue(
      fallback?.pronunciation || fallback?.reading || fallback?.transliteration || '',
      item.wordId
    ),
    en: safeDisplayValue(fallback?.en || '', item.wordId),
  };
}

export default function ProfileProgressScreen({ onGoHome, onGoProfile }: ProfileProgressScreenProps) {
  const { state } = useApp();
  const languageId = normalizeLanguageId(state.selectedLanguage);
  const [error, setError] = useState<string | null>(null);
  const [backendOffline, setBackendOffline] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [needsWork, setNeedsWork] = useState<NeedsWorkItem[]>([]);
  const [wordLookup, setWordLookup] = useState<WordLookup>({});
  const [visibleRows, setVisibleRows] = useState(ROWS_PER_PAGE);
  const [needsWorkColumns, setNeedsWorkColumns] = useState(() =>
    typeof window === 'undefined' ? 4 : getNeedsWorkColumns(window.innerWidth)
  );

  useEffect(() => {
    const load = async () => {
      setError(null);
      setBackendOffline(false);
      try {
        const [progressResponse, needsWorkResponse] = await Promise.all([
          apiFetch('/v1/me/progress'),
          apiFetch(
            `/v1/me/needs-work?limit=40&minTotalMisses=1&shape=lexeme&language=${encodeURIComponent(languageId)}`
          ),
        ]);
        if (!progressResponse.ok) throw new Error('Failed to load progress');
        const json = (await progressResponse.json()) as {
          progress: Progress;
        };
        setProgress(json.progress);

        if (needsWorkResponse.ok) {
          const weakJson = (await needsWorkResponse.json()) as { needsWork: NeedsWorkItem[] };
          setNeedsWork(weakJson.needsWork || []);
        } else {
          setNeedsWork([]);
        }
      } catch {
        setBackendOffline(true);
        setError(null);
        setProgress({
          streak: 0,
          lastActiveDate: null,
          currentBandId: null,
          currentUnitId: null,
          currentLessonIdx: null,
        });
        setNeedsWork([]);
      }
    };

    void load();
    void (async () => {
      const lookup = await loadWordLookup(languageId);
      setWordLookup(lookup);
    })();
  }, [languageId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateColumns = () => {
      setNeedsWorkColumns(getNeedsWorkColumns(window.innerWidth));
    };

    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  useEffect(() => {
    setVisibleRows(ROWS_PER_PAGE);
  }, [needsWork.length]);

  const visibleNeedsWorkCount = Math.min(needsWork.length, visibleRows * needsWorkColumns);
  const visibleNeedsWork = needsWork.slice(0, visibleNeedsWorkCount);
  const hasMoreNeedsWork = visibleNeedsWorkCount < needsWork.length;
  const languageScopedProgressBandId =
    bandMatchesLanguage(progress?.currentBandId, languageId)
      ? progress?.currentBandId
      : null;
  const languageScopedResumeBandId =
    bandMatchesLanguage(state.resumeCheckpoint?.bandId, languageId)
      ? state.resumeCheckpoint?.bandId
      : null;
  const languageScopedActiveBandId =
    bandMatchesLanguage(state.activeBandId, languageId)
      ? state.activeBandId
      : null;
  const languageScopedCurrentLevelBandId =
    bandMatchesLanguage(state.currentLevel?.id, languageId)
      ? state.currentLevel?.id
      : null;
  const languageScopedProgressUnitId =
    languageScopedProgressBandId ? progress?.currentUnitId : null;
  const languageScopedProgressLessonIdx =
    languageScopedProgressBandId ? progress?.currentLessonIdx : null;
  const effectiveBandId =
    languageScopedProgressBandId ??
    languageScopedResumeBandId ??
    languageScopedActiveBandId ??
    languageScopedCurrentLevelBandId ??
    null;
  const activeBandDataForMetrics =
    effectiveBandId && state.activeBandId === effectiveBandId ? state.activeBandData : null;
  const inferredUnitId = inferUnitFromLessonProgress(
    effectiveBandId,
    state.lessonProgress || {},
    activeBandDataForMetrics
  );
  const completedLessons = Object.entries(state.lessonProgress || {}).filter(([key, progressEntry]) => {
      const entry = progressEntry as {
        completed?: boolean;
        quizScore?: number | null;
        speakScore?: number | null;
      };
      const [bandId, unitId] = key.split(':');
      if (!bandMatchesLanguage(bandId, languageId)) return false;
      if (!entry?.completed && !isInstructionalComplete(entry?.quizScore, entry?.speakScore)) return false;
      if (unitId === 'daily-review') return false;
      if (isCheckpointUnitId(unitId) || isPracticeUnitId(unitId)) return false;
      return true;
    }).length;
  const masteriesCompleted = Object.entries(state.lessonProgress || {}).filter(([key, progressEntry]) => {
      const entry = progressEntry as {
        mastered?: boolean;
      };
      const [bandId, unitId] = key.split(':');
      if (!bandMatchesLanguage(bandId, languageId)) return false;
      if (unitId === 'daily-review') return false;
      if (isCheckpointUnitId(unitId) || isPracticeUnitId(unitId)) return false;
      return Boolean(entry?.mastered);
    }).length;
  const effectiveUnitId =
    languageScopedProgressUnitId ??
    state.resumeCheckpoint?.unitId ??
    state.activeUnitId ??
    state.activeLesson?.unitId ??
    inferredUnitId ??
    null;
  const fallbackLessonIdx =
    inferLatestLessonIdxForUnit(effectiveBandId, effectiveUnitId, state.lessonProgress || {});
  const effectiveLessonIdx =
    typeof languageScopedProgressLessonIdx === 'number'
      ? languageScopedProgressLessonIdx
      : (state.resumeCheckpoint?.lessonIndex ?? state.activeLesson?.lessonIndex ?? fallbackLessonIdx);
  const lastQuizScore = useMemo(() => {
    const getEntry = (bandId: string, unitId: string, lessonIndex: number) => {
      const key = makeLessonKey(bandId, unitId, lessonIndex);
      return state.lessonProgress[key] as {
        completed?: boolean;
        quizScore?: number | null;
        speakScore?: number | null;
      } | undefined;
    };

    const isCompletedWithScore = (
      entry:
        | {
            completed?: boolean;
            quizScore?: number | null;
            speakScore?: number | null;
          }
        | undefined
    ) =>
      Boolean(entry) &&
      (Boolean(entry?.completed) || isInstructionalComplete(entry?.quizScore, entry?.speakScore)) &&
      typeof entry?.quizScore === 'number' &&
      !Number.isNaN(entry.quizScore);

    if (effectiveBandId && effectiveUnitId && typeof effectiveLessonIdx === 'number' && effectiveLessonIdx >= 0) {
      const currentEntry = getEntry(effectiveBandId, effectiveUnitId, effectiveLessonIdx);
      if (isCompletedWithScore(currentEntry)) {
        return Math.round(currentEntry!.quizScore as number);
      }
      for (let lessonIndex = effectiveLessonIdx - 1; lessonIndex >= 0; lessonIndex -= 1) {
        const previousEntry = getEntry(effectiveBandId, effectiveUnitId, lessonIndex);
        if (isCompletedWithScore(previousEntry)) {
          return Math.round(previousEntry!.quizScore as number);
        }
      }
    }

    const fallbackCandidates = Object.entries(state.lessonProgress || {})
      .map(([key, progressEntry]) => {
        const [bandId, unitId, lessonIndexRaw] = key.split(':');
        const entry = progressEntry as {
          completed?: boolean;
          quizScore?: number | null;
          speakScore?: number | null;
        };
        const lessonIndex = Number(lessonIndexRaw);
        if (!bandMatchesLanguage(bandId, languageId)) return null;
        if (unitId === 'daily-review') return null;
        if (isCheckpointUnitId(unitId) || isPracticeUnitId(unitId)) return null;
        if (!isCompletedWithScore(entry)) return null;
        if (!Number.isFinite(lessonIndex)) return null;
        return {
          lessonIndex,
          score: Math.round(entry.quizScore as number),
        };
      })
      .filter((value): value is { lessonIndex: number; score: number } => Boolean(value))
      .sort((a, b) => b.lessonIndex - a.lessonIndex);

    return fallbackCandidates[0]?.score ?? 0;
  }, [effectiveBandId, effectiveLessonIdx, effectiveUnitId, languageId, state.lessonProgress]);

  const lessonsCompletedDisplay = completedLessons;
  const currentUnitMeta =
    effectiveBandId && effectiveUnitId
      ? getUnitMetadata(effectiveBandId, effectiveUnitId, activeBandDataForMetrics)
      : null;
  const currentLessonNumber =
    typeof effectiveLessonIdx === 'number' && effectiveLessonIdx >= 0
      ? effectiveLessonIdx + 1
      : null;
  const currentUnitAndLesson = effectiveUnitId
    ? `${formatUnitNameForDisplay(currentUnitMeta?.name) || formatUnitFallbackLabel(effectiveUnitId)}${currentLessonNumber ? ` · Lesson ${currentLessonNumber}` : ''}`
    : 'Not started';
  const completedDayKeys = useMemo(() => {
    const keys = new Set<string>();
    const events = getTrackedEvents();
    for (const event of events) {
      if (event.name !== 'lesson_completed') continue;
      const ts = new Date(event.timestamp);
      if (Number.isNaN(ts.getTime())) continue;
      ts.setHours(0, 0, 0, 0);
      keys.add(toLocalDayKey(ts));
    }
    return keys;
  }, []);
  const streakDisplay = useMemo(
    () => calculateCurrentCompletionStreak(completedDayKeys),
    [completedDayKeys]
  );
  const prioritizedNeedsWork = [...needsWork].sort((a, b) => {
    const aWeight = a.totalMisses * 3 + a.mispronounceCount * 2 + a.missedQuizCount + a.pronunciationRisk;
    const bWeight = b.totalMisses * 3 + b.mispronounceCount * 2 + b.missedQuizCount + b.pronunciationRisk;
    return bWeight - aWeight;
  });
  const topNeedsWork = prioritizedNeedsWork.slice(0, 5);

  return (
    <div className="min-h-screen page-shell px-6 with-bottom-nav">
      <GlassHeader title="Progress" hideLogoOnMobile />

      <div className="mx-auto max-w-6xl space-y-6">
        {backendOffline && (
          <div className="bg-white border border-[rgba(15,102,96,0.35)] rounded-2xl p-4 text-sm text-text-med">
            Backend appears offline. Showing cached/empty progress.
          </div>
        )}

        {error && (
          <div className="bg-white border border-[var(--sonus-palette-rust)] rounded-2xl p-4 text-sm text-[var(--sonus-palette-rust)]">
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="rounded-3xl border p-5 text-center sm:p-6 sm:text-left shadow-[0_20px_48px_-40px_rgba(15,23,42,0.28)] lg:col-span-12 bg-[var(--sonus-palette-green)] border-[rgba(255,255,255,0.26)]">
            <h2 className="main-font text-[2rem] leading-none text-white sm:text-[2.2rem]">Progress Overview</h2>
            <p className="mt-3 max-w-2xl text-sm text-[rgba(255,255,255,0.86)]">
              This report summarizes active-path completion, study streak, and intervention priorities for the current study track.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.1)] p-3 text-center sm:text-left">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[rgba(255,255,255,0.74)]">Current Unit + Lesson</p>
                <p className="mt-1.5 text-sm font-semibold text-white">{currentUnitAndLesson}</p>
              </div>
              <div className="rounded-2xl border border-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.1)] p-3 text-center sm:text-left">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[rgba(255,255,255,0.74)]">Review Queue Size</p>
                <p className="mt-1.5 text-sm font-semibold text-white">{needsWork.length} tracked words</p>
              </div>
              <div className="rounded-2xl border border-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.1)] p-3 text-center sm:text-left">
                <div className="inline-flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-[rgba(255,255,255,0.74)] sm:justify-start">
                  Lessons Completed
                </div>
                <p className="mt-1 text-2xl font-semibold leading-none text-white">{lessonsCompletedDisplay}</p>
              </div>
              <div className="rounded-2xl border border-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.1)] p-3 text-center sm:text-left">
                <div className="inline-flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-[rgba(255,255,255,0.74)] sm:justify-start">
                  Study Streak
                </div>
                <p className="mt-1 text-2xl font-semibold leading-none text-white">{streakDisplay}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="rounded-3xl border border-[rgba(15,102,96,0.45)] bg-white p-5 text-center sm:p-6 sm:text-left shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)] lg:col-span-7">
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#0F6660]">Diagnostic Breakdown</p>
                <h3 className="mt-1 text-xl font-semibold text-text-dark">Performance Summary</h3>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-[rgba(15,102,96,0.30)] bg-[#FBFBF9] p-3.5 text-center sm:text-left min-h-[112px] flex flex-col justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#0F6660]">Quiz Review Misses</p>
                <p className="mt-1 text-2xl font-semibold leading-none text-text-dark">
                  {needsWork.reduce((sum, item) => sum + item.missedQuizCount, 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-[rgba(15,102,96,0.30)] bg-[#FBFBF9] p-3.5 text-center sm:text-left min-h-[112px] flex flex-col justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#0F6660]">Speech Review Misses</p>
                <p className="mt-1 text-2xl font-semibold leading-none text-text-dark">
                  {needsWork.reduce((sum, item) => sum + item.mispronounceCount, 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-[rgba(15,102,96,0.30)] bg-[#FBFBF9] p-3.5 text-center sm:text-left min-h-[112px] flex flex-col justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#0F6660]">Masteries Completed</p>
                <p className="mt-1 text-2xl font-semibold leading-none text-text-dark">{masteriesCompleted}</p>
              </div>
              <div className="rounded-2xl border border-[rgba(15,102,96,0.30)] bg-[#FBFBF9] p-3.5 text-center sm:text-left min-h-[112px] flex flex-col justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#0F6660]">Last Quiz Score</p>
                <p className="mt-1 text-2xl font-semibold leading-none text-text-dark">{lastQuizScore}%</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[rgba(15,102,96,0.45)] bg-white p-5 text-center sm:p-6 sm:text-left shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)] lg:col-span-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#0F6660]">Priority Queue</p>
            <h3 className="mt-1 text-xl font-semibold text-text-dark">Top Review Words</h3>
            <div className="mt-4 space-y-2">
              {topNeedsWork.length === 0 ? (
                <p className="text-sm text-text-med">No words currently in your intervention queue.</p>
              ) : (
                topNeedsWork.map((item) => {
                  const card = toNeedsWorkCard(item, wordLookup);
                  return (
                    <div key={item.wordId} className="rounded-xl border border-[rgba(15,102,96,0.30)] bg-[#FBFBF9] px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="secondary-font text-[1.35rem] leading-none text-text-dark">{card.term}</p>
                          {card.reading ? <p className="mt-1 text-xs text-text-med">{card.reading}</p> : null}
                        </div>
                        <span className="rounded-full border border-[var(--sonus-palette-rust)]/22 bg-[rgba(194,65,12,0.08)] px-2 py-0.5 text-[11px] font-semibold text-[#9A3412]">
                          {item.totalMisses}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[rgba(15,102,96,0.45)] bg-white p-5 text-center sm:p-6 sm:text-left shadow-[0_16px_36px_-30px_rgba(15,23,42,0.24)]">
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#0F6660]">Full Queue</p>
              <h3 className="mt-1 text-xl font-semibold text-text-dark">All Tracked Review Items</h3>
            </div>
            <p className="text-xs text-text-light">{needsWork.length} tracked entries</p>
          </div>

          <div className="mt-4">
            {needsWork.length === 0 ? (
              <div className="text-sm text-text-med">No words currently in your needs-work list.</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {visibleNeedsWork.map((item) => {
                    const card = toNeedsWorkCard(item, wordLookup);
                    return (
                      <div
                        key={item.wordId}
                        className="rounded-2xl border border-[rgba(15,102,96,0.30)] bg-[#FBFBF9] p-3 text-center sm:text-left min-h-[124px] flex flex-col justify-between"
                      >
                        <div>
                          <div className="secondary-font text-[1.55rem] leading-none text-text-dark">
                            {card.term}
                          </div>
                          {card.reading ? (
                            <div className="mt-1 text-xs text-text-med">{card.reading}</div>
                          ) : null}
                          {card.en ? (
                            <div className="mt-0.5 text-xs text-text-light">{card.en}</div>
                          ) : null}
                        </div>
                        <div className="mt-3 inline-flex items-center rounded-full border border-[var(--sonus-palette-rust)]/22 bg-[rgba(194,65,12,0.08)] px-2 py-0.5 text-[11px] font-semibold text-[#9A3412]">
                          {item.totalMisses} misses
                        </div>
                      </div>
                    );
                  })}
                </div>
                {hasMoreNeedsWork && (
                  <button
                    onClick={() => setVisibleRows((prev) => prev + ROWS_PER_PAGE)}
                    className="mx-auto mt-4 inline-flex items-center rounded-xl border border-[var(--sonus-palette-blue)]/26 bg-white px-3 py-1.5 text-sm font-medium text-[var(--sonus-palette-blue)] hover:bg-[rgba(19,87,119,0.05)] sm:mx-0"
                  >
                    Show more
                  </button>
                )}
              </>
            )}
          </div>
        </section>

      </div>

      <BottomNav active="profile" onHome={onGoHome} onProfile={onGoProfile} />
    </div>
  );
}
