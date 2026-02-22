import { useEffect, useState } from 'react';
import { BookOpen, Flag, Flame } from 'lucide-react';
import BottomNav from './BottomNav';
import { loadWordLookup, type WordLookup } from '../lib/wordLookup';
import GlassHeader from './GlassHeader';
import { apiFetch } from '../lib/apiClient';
import { getUnitMetadata, getUnitsForBand, isCheckpointUnitId, isPracticeUnitId } from '../data/unitMetadata';
import { useApp } from '../contexts/AppContext';
import { getLessonRanges } from '../lib/lessonChunks';
import { QUIZ_PASS_PERCENT, SPEAK_PASS_PERCENT } from '../lib/passCriteria';
import { getLessonCompletionCountForDay } from '../lib/activityLedger';

type Progress = {
  streak: number;
  lastActiveDate: string | null;
  currentBandId: string | null;
  currentUnitId: string | null;
  currentLessonIdx: number | null;
};

type NeedsWorkItem = {
  wordId: string;
  totalMisses: number;
  reasons: string[];
  pronunciationRisk: number;
  missedQuizCount: number;
  mispronounceCount: number;
};

type ProgressEvent = {
  eventType?: string;
  createdAt?: string;
};

interface ProfileProgressScreenProps {
  onGoHome: () => void;
  onGoProfile: () => void;
}

function localDayKeyFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function inferUnitFromLessonProgress(
  bandId: string | null,
  lessonProgress: Record<string, unknown>
) {
  if (!bandId) return null;
  const unitIds = new Set<string>();
  for (const key of Object.keys(lessonProgress || {})) {
    const [keyBandId, keyUnitId] = key.split(':');
    if (keyBandId === bandId && keyUnitId) {
      unitIds.add(keyUnitId);
    }
  }
  const orderedCoreUnits = getUnitsForBand(bandId)
    .filter((unit) => !isCheckpointUnitId(unit.id) && !isPracticeUnitId(unit.id))
    .map((unit) => unit.id);
  const latestStarted = orderedCoreUnits.filter((unitId) => unitIds.has(unitId)).at(-1);
  return latestStarted ?? null;
}

function inferLessonCountFromProgress(
  bandId: string | null,
  unitId: string,
  lessonProgress: Record<string, unknown>
) {
  if (!bandId) return 0;
  let maxSeen = -1;
  for (const key of Object.keys(lessonProgress || {})) {
    const [keyBandId, keyUnitId, keyLessonIdx] = key.split(':');
    if (keyBandId !== bandId || keyUnitId !== unitId) continue;
    const idx = Number(keyLessonIdx);
    if (Number.isFinite(idx)) maxSeen = Math.max(maxSeen, idx);
  }
  return maxSeen + 1;
}

const ROWS_PER_PAGE = 2;
const LESSON_UNLOCK_PASS_PERCENT = 85;
const isInstructionalComplete = (quizScore: number | null | undefined, speakScore: number | null | undefined) =>
  (quizScore ?? 0) >= QUIZ_PASS_PERCENT && (speakScore ?? 0) >= SPEAK_PASS_PERCENT;

function getNeedsWorkColumns(width: number) {
  if (width >= 1024) return 4;
  if (width >= 640) return 3;
  return 2;
}

export default function ProfileProgressScreen({ onGoHome, onGoProfile }: ProfileProgressScreenProps) {
  const { state } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [backendOffline, setBackendOffline] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [sevenDayActivity, setSevenDayActivity] = useState<Array<{ dayKey: string; active: boolean; lessonsCompleted?: number }>>([]);
  const [needsWork, setNeedsWork] = useState<NeedsWorkItem[]>([]);
  const [wordLookup, setWordLookup] = useState<WordLookup>({});
  const [visibleRows, setVisibleRows] = useState(ROWS_PER_PAGE);
  const [needsWorkColumns, setNeedsWorkColumns] = useState(() =>
    typeof window === 'undefined' ? 4 : getNeedsWorkColumns(window.innerWidth)
  );

  const load = async () => {
    setError(null);
    setBackendOffline(false);
    try {
      const [progressResponse, needsWorkResponse] = await Promise.all([
        apiFetch('/v1/me/progress'),
        apiFetch('/v1/me/needs-work?limit=40&minTotalMisses=3'),
      ]);
      if (!progressResponse.ok) throw new Error('Failed to load progress');
      const json = (await progressResponse.json()) as {
        progress: Progress;
        sevenDayActivity?: Array<{ dayKey: string; active: boolean; lessonsCompleted?: number }>;
        recentEvents?: ProgressEvent[];
      };
      setProgress(json.progress);
      const recentEvents = Array.isArray(json.recentEvents) ? json.recentEvents : [];
      const fallbackLessonCompletionsByDay = new Map<string, number>();
      for (const event of recentEvents) {
        if (event?.eventType !== 'lesson_completed') continue;
        if (!event.createdAt) continue;
        const parsed = new Date(event.createdAt);
        if (Number.isNaN(parsed.getTime())) continue;
        const dayKey = localDayKeyFromDate(parsed);
        fallbackLessonCompletionsByDay.set(dayKey, (fallbackLessonCompletionsByDay.get(dayKey) ?? 0) + 1);
      }
      const normalizedActivity = (json.sevenDayActivity || []).map((day) => ({
        ...day,
        lessonsCompleted: Math.max(
          getLessonCompletionCountForDay(day.dayKey),
          typeof day.lessonsCompleted === 'number'
            ? day.lessonsCompleted
            : (fallbackLessonCompletionsByDay.get(day.dayKey) ?? 0)
        ),
      }));
      setSevenDayActivity(normalizedActivity);

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
      setSevenDayActivity([]);
      setNeedsWork([]);
    }
  };

  useEffect(() => {
    void load();
    void (async () => {
      const lookup = await loadWordLookup();
      setWordLookup(lookup);
    })();
  }, []);

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
  const effectiveBandId =
    progress?.currentBandId ??
    state.resumeCheckpoint?.bandId ??
    state.activeBandId ??
    state.currentLevel?.id ??
    null;
  const inferredUnitId = inferUnitFromLessonProgress(effectiveBandId, state.lessonProgress || {});
  const coreUnits = effectiveBandId
    ? getUnitsForBand(effectiveBandId).filter(
      (unit) => !isCheckpointUnitId(unit.id) && !isPracticeUnitId(unit.id)
    )
    : [];
  const activeBandDataForMetrics =
    effectiveBandId && state.activeBandId === effectiveBandId ? state.activeBandData : null;
  const unitLessonCount = (unitId: string) => {
    if (activeBandDataForMetrics) {
      const words = Array.isArray(activeBandDataForMetrics.units)
        ? (activeBandDataForMetrics.units.find((entry) => entry?.id === unitId)?.words || [])
        : (activeBandDataForMetrics.units?.[unitId]?.words || []);
      return getLessonRanges(words.length, 10).length;
    }
    return inferLessonCountFromProgress(effectiveBandId, unitId, state.lessonProgress || {});
  };
  const completedLessons = effectiveBandId
    ? Object.entries(state.lessonProgress || {}).filter(([key, progressEntry]) => {
      const entry = progressEntry as {
        completed?: boolean;
        quizScore?: number | null;
        speakScore?: number | null;
      };
      const [bandId, unitId] = key.split(':');
      if (bandId !== effectiveBandId) return false;
      if (!entry?.completed && !isInstructionalComplete(entry?.quizScore, entry?.speakScore)) return false;
      if (unitId === 'daily-review') return false;
      if (isCheckpointUnitId(unitId) || isPracticeUnitId(unitId)) return false;
      return true;
    }).length
    : 0;

  const currentPath = (() => {
    if (!effectiveBandId || coreUnits.length === 0) return { unitId: inferredUnitId, lessonIdx: null as number | null };
    for (const unit of coreUnits) {
      const total = unitLessonCount(unit.id);
      if (total <= 0) continue;
      for (let lessonIdx = 0; lessonIdx < total; lessonIdx += 1) {
        const key = `${effectiveBandId}:${unit.id}:${lessonIdx}`;
        const score = state.lessonProgress[key]?.quizScore ?? 0;
        if (score < LESSON_UNLOCK_PASS_PERCENT) {
          return { unitId: unit.id, lessonIdx };
        }
      }
    }
    const lastUnit = coreUnits[coreUnits.length - 1];
    const lastUnitLessons = lastUnit ? unitLessonCount(lastUnit.id) : 0;
    return {
      unitId: lastUnit?.id ?? inferredUnitId,
      lessonIdx: lastUnitLessons > 0 ? lastUnitLessons - 1 : null,
    };
  })();

  const lessonsBeforeCurrent = coreUnits
    .slice(0, Math.max(0, coreUnits.findIndex((unit) => unit.id === currentPath.unitId)))
    .reduce((sum, unit) => {
      if (activeBandDataForMetrics) {
        const words = Array.isArray(activeBandDataForMetrics.units)
          ? (activeBandDataForMetrics.units.find((entry) => entry?.id === unit.id)?.words || [])
          : (activeBandDataForMetrics.units?.[unit.id]?.words || []);
        return sum + getLessonRanges(words.length, 10).length;
      }
      return sum + inferLessonCountFromProgress(effectiveBandId, unit.id, state.lessonProgress || {});
    }, 0);
  const lessonsCompletedDisplay = Math.max(completedLessons, lessonsBeforeCurrent + Math.max(currentPath.lessonIdx ?? 0, 0));
  const currentUnitMeta =
    effectiveBandId && currentPath.unitId
      ? getUnitMetadata(effectiveBandId, currentPath.unitId)
      : null;
  const currentLessonNumber =
    typeof currentPath.lessonIdx === 'number' && currentPath.lessonIdx >= 0
      ? currentPath.lessonIdx + 1
      : null;
  const currentUnitAndLesson = currentPath.unitId
    ? `${currentUnitMeta?.name ?? 'Current Unit'}${currentLessonNumber ? ` · Lesson ${currentLessonNumber}` : ''}`
    : 'Not started';
  const calendarDays = sevenDayActivity.length
    ? sevenDayActivity
    : Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(Date.now() - (6 - idx) * 86_400_000);
      const dayKey = localDayKeyFromDate(date);
      const ledgerCount = getLessonCompletionCountForDay(dayKey);
      return { dayKey, active: ledgerCount > 0, lessonsCompleted: ledgerCount };
    });
  const todayActivity = calendarDays[calendarDays.length - 1];
  const streakDisplay = Math.max(progress?.streak ?? 0, (todayActivity?.lessonsCompleted ?? 0) > 0 ? 1 : 0, 1);

  return (
    <div className="min-h-screen page-shell px-6 with-bottom-nav">
      <GlassHeader title="Progress" />

      <div className="space-y-4 max-w-6xl mx-auto text-center">
        {backendOffline && (
          <div className="bg-white border border-border rounded-2xl p-4 text-sm text-text-med">
            Backend appears offline. Showing cached/empty progress.
          </div>
        )}

        {error && (
          <div className="bg-white border border-[#C2410C] rounded-2xl p-4 text-sm text-[#C2410C]">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <div className="bg-[#C2410C] text-white border border-[#C2410C]/90 rounded-3xl p-5 shadow-[0_20px_40px_-28px_rgba(194,65,12,0.40)] flex flex-col items-center justify-center">
            <div className="inline-flex items-center gap-2 mb-3 rounded-full border border-white/28 bg-white/12 px-3 py-1 justify-center">
              <Flame className="w-4 h-4 text-white" />
              <span className="text-xs font-mono uppercase tracking-wider text-white">Current Streak</span>
            </div>
            <div className="text-4xl font-semibold text-white leading-none">
              {streakDisplay}
            </div>
            <div className="text-sm text-white/85 mt-1">day streak</div>
          </div>

          <div className="bg-white border border-border rounded-3xl p-5">
            <h3 className="font-semibold text-text-dark mb-3">Words To Work On</h3>
            {needsWork.length === 0 ? (
              <div className="text-sm text-text-med">No words currently in your needs-work list.</div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {visibleNeedsWork.map((item) => (
                    <div
                      key={item.wordId}
                      className="border border-border rounded-xl p-2 bg-[#FBFBF9] min-h-[116px] sm:min-h-[124px] flex flex-col items-center justify-center text-center"
                    >
                      {wordLookup[item.wordId] ? (
                        <div>
                          <div className="secondary-font text-2xl text-text-dark leading-none">
                            {wordLookup[item.wordId].simp}
                          </div>
                          <div className="text-xs text-text-med mt-1">{wordLookup[item.wordId].pinyin}</div>
                          <div className="text-xs text-text-light mt-0.5">{wordLookup[item.wordId].en}</div>
                        </div>
                      ) : <div className="text-xs text-text-med">Word</div>}
                      <div className="mt-1 text-xs text-[#C2410C] font-semibold">
                        {item.totalMisses} misses
                      </div>
                    </div>
                  ))}
                </div>
                {hasMoreNeedsWork && (
                  <button
                    onClick={() => setVisibleRows((prev) => prev + ROWS_PER_PAGE)}
                    className="mt-3 text-sm font-medium text-[#186E95] hover:opacity-80"
                  >
                    Show more ({needsWork.length})
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="bg-[#3E5648] text-white border border-[#3E5648]/90 rounded-3xl p-5 shadow-[0_20px_40px_-28px_rgba(62,86,72,0.36)]">
          <h3 className="font-semibold text-white mb-2">Activity (Last 7 Days)</h3>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {calendarDays.map((day) => {
              const labelDate = new Date(`${day.dayKey}T12:00:00`);
              const weekday = labelDate.toLocaleDateString(undefined, { weekday: 'short' });
              const dayNumber = labelDate.toLocaleDateString(undefined, { day: 'numeric' });
              const completedLessons = Math.max(0, day.lessonsCompleted ?? 0);
              const hasCompletedLessons = completedLessons > 0;
              const visibleDots = Math.min(completedLessons, 10);
              const overflowDots = Math.max(0, completedLessons - visibleDots);
              return (
                <div
                  key={day.dayKey}
                  className={`rounded-lg sm:rounded-xl border px-1.5 py-1.5 sm:p-2 text-center backdrop-blur-sm transition-colors ${
                    hasCompletedLessons
                      ? 'border-white/35 bg-white/20'
                      : 'border-white/20 bg-white/10'
                  }`}
                >
                  <div className="h-9 sm:h-10 mb-0.5 sm:mb-1 flex items-center justify-center gap-1">
                    <div className="flex max-w-[56px] flex-wrap items-center justify-center gap-1">
                      {Array.from({ length: visibleDots }).map((_, idx) => (
                        <span
                          key={`${day.dayKey}-dot-${idx}`}
                          className={`h-1.5 w-1.5 rounded-full ${hasCompletedLessons ? 'bg-white' : 'bg-white/55'}`}
                        />
                      ))}
                    </div>
                    {overflowDots > 0 && (
                      <span className={`text-[9px] font-mono ${hasCompletedLessons ? 'text-white/90' : 'text-white/75'}`}>
                        +{overflowDots}
                      </span>
                    )}
                  </div>
                  <div className={`text-[9px] sm:text-[10px] font-mono uppercase tracking-wider ${hasCompletedLessons ? 'text-white' : 'text-white/80'}`}>
                    {weekday}
                  </div>
                  <div className={`text-xs sm:text-sm font-semibold mt-0.5 ${hasCompletedLessons ? 'text-white' : 'text-white/85'}`}>
                    {dayNumber}
                  </div>
                  {completedLessons > 0 && (
                    <div className="mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] font-mono uppercase tracking-wide text-white/80">
                      {`${completedLessons} lesson${completedLessons === 1 ? '' : 's'}`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-[#186E95] text-white border border-[#186E95]/90 rounded-3xl p-5 shadow-[0_20px_40px_-28px_rgba(24,110,149,0.38)]">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="inline-flex items-center rounded-full px-3 py-1 bg-white/14 border border-white/28 text-[10px] uppercase tracking-[0.2em] font-mono text-white/90">
              Progress Metrics
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/28 bg-white/10 p-3 sm:col-span-2">
              <div className="inline-flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider font-mono text-white/90">
                <BookOpen className="w-3.5 h-3.5" />
                Lessons Completed
              </div>
              <div className="text-2xl font-semibold text-white mt-2 leading-none">{lessonsCompletedDisplay}</div>
            </div>
            <div className="rounded-xl border border-white/28 bg-white/12 p-3 sm:col-span-2">
              <div className="inline-flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider font-mono text-white/90">
                <Flag className="w-3.5 h-3.5" />
                Current Unit + Lesson
              </div>
              <div className="text-sm font-semibold text-white mt-2 leading-tight">{currentUnitAndLesson}</div>
            </div>
          </div>
        </div>

      </div>

      <BottomNav active="profile" onHome={onGoHome} onProfile={onGoProfile} />
    </div>
  );
}
