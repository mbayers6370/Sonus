import { useEffect, useState } from 'react';
import { BookOpen, Flag, Flame } from 'lucide-react';
import BottomNav from './BottomNav';
import { loadWordLookup, type WordLookup } from '../lib/wordLookup';
import GlassHeader from './GlassHeader';
import { apiFetch } from '../lib/apiClient';
import { getUnitMetadata, getUnitsForBand, isCheckpointUnitId, isPracticeUnitId } from '../data/unitMetadata';
import { useApp } from '../contexts/AppContext';
import { getLessonRanges } from '../lib/lessonChunks';

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

interface ProfileProgressScreenProps {
  onGoHome: () => void;
  onGoProfile: () => void;
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
  const [sevenDayActivity, setSevenDayActivity] = useState<Array<{ dayKey: string; active: boolean }>>([]);
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
        sevenDayActivity?: Array<{ dayKey: string; active: boolean }>;
      };
      setProgress(json.progress);
      setSevenDayActivity(json.sevenDayActivity || []);

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
  const effectiveUnitId =
    progress?.currentUnitId ??
    state.resumeCheckpoint?.unitId ??
    state.activeUnitId ??
    state.activeLesson?.unitId ??
    inferredUnitId ??
    null;
  const effectiveLessonIdx =
    typeof progress?.currentLessonIdx === 'number'
      ? progress.currentLessonIdx
      : (state.resumeCheckpoint?.lessonIndex ?? state.activeLesson?.lessonIndex ?? null);
  const coreUnits = effectiveBandId
    ? getUnitsForBand(effectiveBandId).filter(
      (unit) => !isCheckpointUnitId(unit.id) && !isPracticeUnitId(unit.id)
    )
    : [];
  const currentCoreUnitIndex =
    effectiveUnitId
      ? coreUnits.findIndex((unit) => unit.id === effectiveUnitId)
      : -1;
  const activeBandDataForMetrics =
    effectiveBandId && state.activeBandId === effectiveBandId ? state.activeBandData : null;
  const lessonsBeforeCurrent = currentCoreUnitIndex > 0
    ? coreUnits.slice(0, currentCoreUnitIndex).reduce((sum, unit) => {
      if (activeBandDataForMetrics) {
        const words = Array.isArray(activeBandDataForMetrics.units)
          ? (activeBandDataForMetrics.units.find((entry) => entry?.id === unit.id)?.words || [])
          : (activeBandDataForMetrics.units?.[unit.id]?.words || []);
        return sum + getLessonRanges(words.length, 10).length;
      }
      return sum + inferLessonCountFromProgress(effectiveBandId, unit.id, state.lessonProgress || {});
    }, 0)
    : 0;
  const lessonsCompleted = lessonsBeforeCurrent + Math.max(typeof effectiveLessonIdx === 'number' ? effectiveLessonIdx : 0, 0);
  const currentUnitMeta =
    effectiveBandId && effectiveUnitId
      ? getUnitMetadata(effectiveBandId, effectiveUnitId)
      : null;
  const currentLessonNumber =
    typeof effectiveLessonIdx === 'number' && effectiveLessonIdx >= 0
      ? effectiveLessonIdx + 1
      : null;
  const currentUnitAndLesson = effectiveUnitId
    ? `${currentUnitMeta?.name ?? 'Current Unit'}${currentLessonNumber ? ` · Lesson ${currentLessonNumber}` : ''}`
    : 'Not started';
  const calendarDays = sevenDayActivity.length
    ? sevenDayActivity
    : Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(Date.now() - (6 - idx) * 86_400_000);
      const dayKey = date.toISOString().slice(0, 10);
      return { dayKey, active: false };
    });
  const todayActivity = calendarDays[calendarDays.length - 1];
  const streakDisplay = Math.max(progress?.streak ?? 0, todayActivity?.active ? 1 : 0, 1);

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
              return (
                <div
                  key={day.dayKey}
                  className={`rounded-lg sm:rounded-xl border px-1.5 py-1.5 sm:p-2 text-center backdrop-blur-sm transition-colors ${
                    day.active
                      ? 'border-white/35 bg-white/20'
                      : 'border-white/20 bg-white/10'
                  }`}
                >
                  <div className={`text-[9px] sm:text-[10px] font-mono uppercase tracking-wider ${day.active ? 'text-white' : 'text-white/80'}`}>
                    {weekday}
                  </div>
                  <div className={`text-xs sm:text-sm font-semibold mt-0.5 ${day.active ? 'text-white' : 'text-white/85'}`}>
                    {dayNumber}
                  </div>
                  <div className="mt-0.5 sm:mt-1 flex justify-center">
                    <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${day.active ? 'bg-white' : 'bg-white/50'}`} />
                  </div>
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
              <div className="text-2xl font-semibold text-white mt-2 leading-none">{lessonsCompleted}</div>
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
