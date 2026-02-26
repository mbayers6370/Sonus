import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { BookOpen, Check, LockKeyhole, MessageSquare } from 'lucide-react';
import { getUnitsForBand, isCheckpointUnitId, isPracticeUnitId, parseCheckpointIndex } from '../data/unitMetadata';
import BottomNav from './BottomNav';
import { getLessonRanges } from '../lib/lessonChunks';
import { makeLessonKey } from '../lib/lessonProgress';
import GlassHeader from './GlassHeader';
import { QUIZ_PASS_PERCENT, SPEAK_PASS_PERCENT } from '../lib/passCriteria';
import type { LessonMode } from '../types/lesson.types';

const LESSON_UNLOCK_PASS_PERCENT = 85;
const isInstructionalComplete = (quizScore: number | null | undefined, speakScore: number | null | undefined) =>
  (quizScore ?? 0) >= QUIZ_PASS_PERCENT && (speakScore ?? 0) >= SPEAK_PASS_PERCENT;
const hasLessonUnlockCredit = (status: { completed?: boolean; quizScore?: number | null; speakScore?: number | null } | undefined) =>
  Boolean(status?.completed || isInstructionalComplete(status?.quizScore, status?.speakScore) || (status?.quizScore ?? 0) >= LESSON_UNLOCK_PASS_PERCENT);

const CARD_ACCENTS = [
  {
    borderColor: 'border-[#186E95]/55',
    badgeBg: 'bg-[rgba(24,110,149,0.12)]',
    badgeText: 'text-[#186E95]',
    progressFill: 'bg-[#186E95]/55',
    hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(24,110,149,0.28)]',
  },
  {
    borderColor: 'border-[#3E5648]/55',
    badgeBg: 'bg-[rgba(62,86,72,0.12)]',
    badgeText: 'text-[#3E5648]',
    progressFill: 'bg-[#3E5648]/55',
    hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(62,86,72,0.26)]',
  },
  {
    borderColor: 'border-[#1F2A37]/55',
    badgeBg: 'bg-[rgba(31,42,55,0.10)]',
    badgeText: 'text-[#1F2A37]',
    progressFill: 'bg-[#1F2A37]/55',
    hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(31,42,55,0.24)]',
  },
  {
    borderColor: 'border-[#C2410C]/55',
    badgeBg: 'bg-[rgba(194,65,12,0.12)]',
    badgeText: 'text-[#C2410C]',
    progressFill: 'bg-[#C2410C]/55',
    hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(194,65,12,0.30)]',
  },
] as const;

interface UnitSelectProps {
  onSelectLesson: (unitId: string, lessonIndex: number, mode?: LessonMode) => void;
  onOpenPractice: (unitId: string) => void;
  onGoHome: () => void;
  onOpenProfile: () => void;
}

function getUnitDataById(
  units: Record<string, { words?: unknown[] }> | Array<{ id?: string; words?: unknown[] }> | undefined,
  unitId: string
) {
  if (!units) return null;
  // Normalize id variants so merged/split unit payloads still resolve correctly.
  const canonical = (id?: string) =>
    (id || '')
      .replace(/^[a-z]\d+-u\d+-/i, '')
      .replace(/^[a-z]\d+-/i, '');
  if (Array.isArray(units)) {
    const direct = units.find((unit) => unit?.id === unitId);
    if (direct) return direct;
    const targetKey = canonical(unitId);
    const matched = units.filter((unit) => canonical(unit?.id) === targetKey);
    if (!matched.length) return null;
    return {
      id: unitId,
      words: matched.flatMap((unit) => unit?.words || []),
    };
  }
  if (units[unitId]) return units[unitId];
  const targetKey = canonical(unitId);
  const matchedEntries = Object.entries(units).filter(([id]) => canonical(id) === targetKey);
  if (!matchedEntries.length) return null;
  return {
    id: unitId,
    words: matchedEntries.flatMap(([, unit]) => unit?.words || []),
  };
}

function getDataUnits(
  units: Record<string, { words?: unknown[] }> | Array<{ id?: string; words?: unknown[] }> | undefined
) {
  if (!units) return [] as Array<{ id: string; words: unknown[] }>;
  if (Array.isArray(units)) {
    return units
      .filter((unit): unit is { id: string; words?: unknown[] } => Boolean(unit?.id))
      .map((unit) => ({ id: unit.id, words: unit.words || [] }));
  }
  return Object.entries(units).map(([id, unit]) => ({ id, words: unit?.words || [] }));
}

function getGridColumns(width: number) {
  if (width >= 1536) return 6; // 2xl
  if (width >= 1280) return 5; // xl
  if (width >= 1024) return 4; // lg
  if (width >= 768) return 3; // md
  return 2; // base/sm
}

function getPracticeType(unitId: string): 'listening' | 'speaking' | 'checkpoint' | null {
  if (isCheckpointUnitId(unitId)) return 'checkpoint';
  if (/listening$/i.test(unitId)) return 'listening';
  if (/speaking$/i.test(unitId)) return 'speaking';
  return null;
}

export default function UnitSelect({
  onSelectLesson,
  onOpenPractice,
  onGoHome,
  onOpenProfile,
}: UnitSelectProps) {
  const { state } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentLevel, activeBandData, lessonProgress, resumeCheckpoint } = state;
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === 'undefined' ? 1280 : window.innerWidth
  );
  const activeUnitId = searchParams.get('unit');

  const setActiveUnit = (unitId: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (unitId) {
      next.set('unit', unitId);
    } else {
      next.delete('unit');
    }
    setSearchParams(next);
  };

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!currentLevel || !activeBandData) {
    return (
      <div className="flex items-center justify-center h-screen page-shell">
        <p className="text-text-med">Loading...</p>
      </div>
    );
  }

  // Get unit metadata for proper ordering and display
  const configuredUnits = getUnitsForBand(currentLevel.id);
  const orderedUnits = configuredUnits.length > 0
    ? configuredUnits
    : getDataUnits(
      activeBandData.units as Record<string, { words?: unknown[] }> | Array<{ id?: string; words?: unknown[] }>
    )
      .filter((unit) => unit.id !== '_unallocated')
      .map((unit, index) => ({
        id: unit.id,
        name: unit.id
          .replace(/^[a-z]\d+-/i, '')
          .replace(/^u\d+-/i, '')
          .replace(/[-_]+/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase()),
        hanzi: '',
        description: 'Core vocabulary.',
        microUnits: undefined,
        order: index + 1,
        icon: BookOpen,
      }));

  // Map units with their data and metrics
  const unitMetrics = orderedUnits
    .map((metadata) => {
      const practiceType = getPracticeType(metadata.id);
      if (practiceType) {
        return {
          unitId: metadata.id,
          metadata,
          totalWords: 0,
          lessonsCount: 1,
          lessonRanges: [],
          completedLessons: 0,
          masteredLessons: 0,
          averageLessonProgress: 0,
          applySentenceCount: 0,
          practiceType,
          isBlueprint: false,
        };
      }
      const unitData = getUnitDataById(
        activeBandData.units as Record<string, { words?: unknown[] }> | Array<{ id?: string; words?: unknown[] }>,
        metadata.id
      );
      if (!unitData) return null;
      const unitWords = unitData.words || [];
      const isMacroBlueprint = currentLevel.band >= 7 && !practiceType && unitWords.length === 0;
      if (!practiceType && unitWords.length === 0 && !isMacroBlueprint) return null;

      const totalWords = unitWords.length;
      const lessonRanges = getLessonRanges(totalWords, 10);
      const lessonsCount = lessonRanges.length;
      // Apply prompts require full example pairs to be valid.
      const applySentenceCount = unitWords.filter(
        (word) =>
          typeof (word as { example?: { zh?: string; en?: string } }).example?.zh === 'string' &&
          Boolean((word as { example?: { zh?: string; en?: string } }).example?.zh?.trim()) &&
          typeof (word as { example?: { zh?: string; en?: string } }).example?.en === 'string' &&
          Boolean((word as { example?: { zh?: string; en?: string } }).example?.en?.trim())
      ).length;
      const completedLessons = lessonRanges.filter((_, lessonIndex) => {
        const key = makeLessonKey(currentLevel.id, metadata.id, lessonIndex);
        const status = lessonProgress[key];
        return Boolean(status?.completed || isInstructionalComplete(status?.quizScore, status?.speakScore));
      }).length;
      const masteredLessons = lessonRanges.filter((_, lessonIndex) => {
        const key = makeLessonKey(currentLevel.id, metadata.id, lessonIndex);
        const status = lessonProgress[key];
        return Boolean(status?.mastered);
      }).length;
      // Unit completion model:
      // - core completion track: one point per regular lesson completed
      // - mastery track: one point per regular lesson mastered
      const totalTrackSteps = lessonsCount * 2;
      const completedTrackSteps = completedLessons + masteredLessons;
      const completionPercent =
        totalTrackSteps > 0
          ? Math.round((completedTrackSteps / totalTrackSteps) * 100)
          : 0;
      return {
        unitId: metadata.id,
        metadata,
        totalWords,
        lessonsCount,
        lessonRanges,
        completedLessons,
        masteredLessons,
        completionPercent,
        applySentenceCount,
        practiceType: null as null,
        isBlueprint: isMacroBlueprint,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const unitMetricById = new Map(unitMetrics.map((metric) => [metric.unitId, metric]));
  const hasLessonPassedThreshold = (unitId: string, lessonIndex: number) => {
    const key = makeLessonKey(currentLevel.id, unitId, lessonIndex);
    return hasLessonUnlockCredit(lessonProgress[key]);
  };
  const hasUnitPassedThreshold = (unitId: string) => {
    const metric = unitMetricById.get(unitId);
    if (!metric || metric.lessonsCount === 0) return false;
    return Array.from({ length: metric.lessonsCount }).every((_, lessonIndex) =>
      hasLessonPassedThreshold(unitId, lessonIndex)
    );
  };
  const hasCheckpointPassedThreshold = (checkpointUnitId: string) =>
    hasLessonPassedThreshold(checkpointUnitId, 0);
  const unlockedByUnitId = new Map<string, boolean>();
  const coreUnitIds = orderedUnits
    .filter((unit) => !isPracticeUnitId(unit.id) && !isCheckpointUnitId(unit.id))
    .map((unit) => unit.id)
    .filter((unitId) => unitMetricById.has(unitId));
  const checkpointUnitIds = orderedUnits
    .filter((unit) => isCheckpointUnitId(unit.id))
    .map((unit) => unit.id)
    .filter((unitId) => unitMetricById.has(unitId));
  const practiceUnitIds = orderedUnits
    .filter((unit) => isPracticeUnitId(unit.id))
    .map((unit) => unit.id)
    .filter((unitId) => unitMetricById.has(unitId));

  if (coreUnitIds.length > 0) {
    unlockedByUnitId.set(coreUnitIds[0], true);
  }

  // Core units unlock linearly, with checkpoint quizzes gating every 4-unit block.
  for (let coreIndex = 1; coreIndex < coreUnitIds.length; coreIndex += 1) {
    const previousCoreUnitId = coreUnitIds[coreIndex - 1];
    let unlocked =
      Boolean(unlockedByUnitId.get(previousCoreUnitId)) &&
      hasUnitPassedThreshold(previousCoreUnitId);

    // Every 4 core units, the checkpoint quiz gates access to the next core block.
    if (unlocked && coreIndex % 4 === 0) {
      const gateCheckpointId = `checkpoint-${coreIndex / 4}`;
      unlocked = hasCheckpointPassedThreshold(gateCheckpointId);
    }

    unlockedByUnitId.set(coreUnitIds[coreIndex], unlocked);
  }

  for (const checkpointUnitId of checkpointUnitIds) {
    const checkpointIndex = parseCheckpointIndex(checkpointUnitId);
    if (!checkpointIndex) {
      unlockedByUnitId.set(checkpointUnitId, false);
      continue;
    }
    const start = (checkpointIndex - 1) * 4;
    const end = Math.min(coreUnitIds.length, checkpointIndex * 4);
    const coveredCoreUnits = coreUnitIds.slice(start, end);
    // A checkpoint unlocks only when all covered core units passed threshold.
    const unlocked =
      coveredCoreUnits.length > 0 &&
      coveredCoreUnits.every((unitId) => hasUnitPassedThreshold(unitId));
    unlockedByUnitId.set(checkpointUnitId, unlocked);
  }

  for (const practiceUnitId of practiceUnitIds) {
    unlockedByUnitId.set(practiceUnitId, coreUnitIds.length > 0);
  }

  const columns = getGridColumns(viewportWidth);
  const activeUnit = activeUnitId
    ? (unlockedByUnitId.get(activeUnitId) ?? true)
      ? unitMetrics.find((u) => u.unitId === activeUnitId) ?? null
      : null
    : null;
  const featuredPracticeUnits = unitMetrics.filter(
    (metric) => metric.practiceType === 'listening' || metric.practiceType === 'speaking'
  );
  const standardUnitMetrics = unitMetrics.filter(
    (metric) => metric.practiceType !== 'listening' && metric.practiceType !== 'speaking'
  );
  const headerTitle = activeUnit ? `Unit ${activeUnit.metadata.order}` : currentLevel.name;
  const isMandarinBandLocked =
    state.selectedLanguage === 'zh' &&
    (/^band\d+$/i.test(currentLevel.id) || currentLevel.id === 'advanced') &&
    !state.unlockedLevels.includes(currentLevel.id);

  return (
    <div className="min-h-screen page-shell with-bottom-nav px-6">
      <GlassHeader title={headerTitle} />

      {isMandarinBandLocked && (
        <div className="pt-2">
          <div className="rounded-3xl border border-[#186E95]/35 bg-white p-6 text-center shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)]">
            <div className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono bg-[rgba(24,110,149,0.12)] text-[#186E95]">
              Coming Soon
            </div>
            <h3 className="main-font text-[2rem] leading-tight font-normal mt-4 text-[#186E95]">
              This Band Is In Progress
            </h3>
            <p className="text-sm text-text-med mt-2 max-w-xl mx-auto">
              This band unlocks after achieving 90% completion in the previous band.
            </p>
          </div>
        </div>
      )}

      {/* Units Grid */}
      {!activeUnit && !isMandarinBandLocked && (
      <div className="pt-2 space-y-4">
        {featuredPracticeUnits.length > 0 && (
          <div className="grid grid-cols-2 gap-0 max-w-[23em] mx-auto">
            {featuredPracticeUnits.map(({ unitId, metadata, practiceType }) => {
              const isUnitUnlocked = Boolean(unlockedByUnitId.get(unitId));
              const isListening = practiceType === 'listening';
              const tone = isListening
                ? {
                    bg: 'bg-[#186E95]',
                    border: 'border-[#186E95]',
                    text: 'text-[#186E95]',
                    pillBg: 'bg-[rgba(24,110,149,0.12)]',
                  }
                : {
                    bg: 'bg-[#C2410C]',
                    border: 'border-[#C2410C]',
                    text: 'text-[#C2410C]',
                    pillBg: 'bg-[rgba(194,65,12,0.12)]',
                  };
              const Icon = metadata.icon;
              return (
                <button
                  key={unitId}
                  onClick={() => {
                    if (!isUnitUnlocked) return;
                    onOpenPractice(unitId);
                  }}
                  disabled={!isUnitUnlocked}
                  className={`${isUnitUnlocked ? `${tone.bg} text-white border ${tone.border}` : 'bg-[#F3F4F6] text-[#6B7280] border border-[#D1D5DB]'} rounded-3xl w-full max-w-[10em] mx-auto aspect-square p-4 text-center shadow-[0_12px_28px_-22px_rgba(15,23,42,0.3)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex flex-col overflow-hidden relative disabled:opacity-100 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none`}
                >
                  {isUnitUnlocked && (
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={
                        isListening
                          ? {
                              backgroundImage:
                                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40' viewBox='0 0 80 40'%3E%3Cpath d='M0 20 Q10 8 20 20 T40 20 T60 20 T80 20' stroke='rgba(255,255,255,0.16)' stroke-width='1.5' fill='none'/%3E%3C/svg%3E\")",
                              backgroundRepeat: 'repeat',
                              backgroundSize: '80px 40px',
                            }
                          : {
                              backgroundImage:
                                'repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 14px)',
                            }
                      }
                    />
                  )}

                  <div className="relative z-10 space-y-1.5 flex flex-col items-center text-center">
                    <div className={`text-xs font-mono tracking-wide ${isUnitUnlocked ? 'text-white' : 'text-[#6B7280]'}`}>
                      {isListening ? 'Practice' : 'Practice'}
                    </div>
                    <div className={`main-font text-[1.6rem] leading-none ${isUnitUnlocked ? 'text-white' : 'text-[#4B5563]'}`}>
                      {isListening ? '听力练习' : '口语练习'}
                    </div>
                  </div>

                  <div className="mt-auto pt-3 relative z-10 flex flex-col items-center text-center">
                    <div
                      className={`inline-flex items-center justify-center w-9 h-9 rounded-full ${
                        isUnitUnlocked ? 'bg-white/20 text-white' : 'bg-white text-[#6B7280] border border-[#D1D5DB]'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isUnitUnlocked ? 'text-white' : 'text-[#6B7280]'}`} />
                    </div>
                    <div className={`mt-2 text-[11px] font-semibold tracking-wide font-mono ${isUnitUnlocked ? 'text-white/92' : 'text-[#6B7280]'}`}>
                      {isListening ? 'Start Listening →' : 'Start Speaking →'}
                    </div>
                  </div>

                  {!isUnitUnlocked && (
                    <div className="absolute inset-0 z-20 rounded-3xl bg-white/45 backdrop-blur-[2px] border border-white/50 flex items-center justify-center pointer-events-none">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 border border-[#D1D5DB] text-[#6B7280]">
                        <LockKeyhole className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold uppercase tracking-wider font-mono">Locked</span>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {standardUnitMetrics.map(({ unitId, metadata, totalWords, lessonsCount, completedLessons, masteredLessons, completionPercent, practiceType, isBlueprint }, index) => {
            const row = Math.floor(index / columns);
            const col = index % columns;
            const accent = CARD_ACCENTS[(col + row) % CARD_ACCENTS.length];
            const Icon = metadata.icon;
            const isUnitUnlocked = Boolean(unlockedByUnitId.get(unitId));
            if (practiceType === 'checkpoint') {
              const practiceAccent = {
                solidBg: 'bg-[#1F2A37]',
                borderColor: 'border-[#1F2A37]',
              };
              return (
                <button
                  key={unitId}
                  onClick={() => {
                    if (!isUnitUnlocked) return;
                    onSelectLesson(unitId, 0, 'quiz');
                  }}
                  disabled={!isUnitUnlocked}
                  className={`${isUnitUnlocked ? `${practiceAccent.solidBg} text-white border ${practiceAccent.borderColor}` : 'bg-[#F3F4F6] text-[#6B7280] border border-[#D1D5DB]'} rounded-3xl h-[220px] p-4 text-left shadow-[0_12px_28px_-22px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-0.5 ${accent.hoverShadow} active:translate-y-0 flex flex-col overflow-hidden relative disabled:opacity-100 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className={`inline-flex min-w-0 max-w-[72%] items-center gap-1.5 px-2.5 py-1 rounded-lg ${isUnitUnlocked ? 'bg-white/20 text-white' : 'bg-white text-[#6B7280] border border-[#D1D5DB]'}`}>
                      <Icon className={`w-3.5 h-3.5 ${isUnitUnlocked ? 'text-white' : 'text-[#6B7280]'}`} />
                      <span className={`text-[10px] font-semibold uppercase tracking-wider font-mono whitespace-nowrap overflow-hidden text-ellipsis ${isUnitUnlocked ? 'text-white' : 'text-[#6B7280]'}`}>
                        Checkpoint
                      </span>
                    </div>
                    <span className={`text-[10px] font-mono ${isUnitUnlocked ? 'text-white' : 'text-[#9CA3AF]'}`}>Practice</span>
                  </div>

                  <div className="space-y-0.5">
                    <div className={`text-[10px] tracking-wide font-mono ${isUnitUnlocked ? 'text-white' : 'text-[#6B7280]'}`}>
                      {metadata.name.replace(/^Checkpoint Quiz\s+/i, 'Unit Review ')}
                    </div>
                    <div className={`main-font text-[1.3rem] font-normal leading-tight ${isUnitUnlocked ? 'text-white' : 'text-[#4B5563]'}`}>
                      {metadata.hanzi}
                    </div>
                  </div>

                  <div
                    className={`mt-2 text-[11px] leading-4 overflow-hidden ${isUnitUnlocked ? 'text-white' : 'text-[#6B7280]'}`}
                    style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                  >
                    {metadata.description}
                  </div>

                  <div className={`font-mono mt-auto pt-4 text-xs font-semibold tracking-wide ${isUnitUnlocked ? 'text-white' : 'text-[#6B7280]'}`}>
                    {!isUnitUnlocked
                      ? (
                        <span className="inline-flex items-center gap-1.5">
                          <LockKeyhole className="w-3.5 h-3.5" />
                          {`${LESSON_UNLOCK_PASS_PERCENT}% to unlock`}
                        </span>
                      )
                      : 'Begin →'}
                  </div>
                  {!isUnitUnlocked && (
                    <div className="absolute inset-0 z-20 rounded-3xl bg-white/45 backdrop-blur-[4px] border border-white/50 flex items-center justify-center pointer-events-none">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 border border-[#D1D5DB] text-[#6B7280]">
                        <LockKeyhole className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold uppercase tracking-wider font-mono">Locked</span>
                      </div>
                    </div>
                  )}
                </button>
              );
            }
            const isUnitCompleted = lessonsCount > 0 && completedLessons === lessonsCount;
            const isUnitMastered = lessonsCount > 0 && masteredLessons === lessonsCount && isUnitCompleted;
            const safeCompletionPercent = completionPercent ?? 0;
            const depth = isBlueprint ? 0 : isUnitMastered ? 100 : Math.max(4, safeCompletionPercent);
            const currentLessonInUnit = (() => {
              if (lessonsCount <= 0) return null;
              for (let lessonIdx = 0; lessonIdx < lessonsCount; lessonIdx += 1) {
                if (!hasLessonPassedThreshold(unitId, lessonIdx)) {
                  return lessonIdx + 1;
                }
              }
              return lessonsCount;
            })();

            return (
              <button
                key={unitId}
                onClick={() => {
                  if (isBlueprint || !isUnitUnlocked) return;
                  setActiveUnit(unitId);
                }}
                disabled={isBlueprint || !isUnitUnlocked}
                className={`${isUnitMastered ? `${accent.badgeText === 'text-[#186E95]' ? 'bg-[#186E95]' : accent.badgeText === 'text-[#3E5648]' ? 'bg-[#3E5648]' : accent.badgeText === 'text-[#1F2A37]' ? 'bg-[#1F2A37]' : 'bg-[#C2410C]'} text-white` : !isUnitUnlocked ? 'bg-[#F3F4F6] text-[#6B7280]' : isUnitCompleted ? 'bg-white text-text-dark ring-1 ring-[#3E5648]/40' : 'bg-white text-text-dark'} border ${isUnitUnlocked ? accent.borderColor : 'border-[#D1D5DB]'} rounded-3xl h-[220px] p-4 text-left shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)] transition-all duration-200 hover:-translate-y-0.5 ${accent.hoverShadow} active:translate-y-0 flex flex-col overflow-hidden relative disabled:opacity-100 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className={`inline-flex min-w-0 max-w-[72%] items-center gap-1.5 px-2.5 py-1 rounded-lg ${isUnitMastered ? 'bg-white/20 text-white' : !isUnitUnlocked ? 'bg-white text-[#6B7280] border border-[#D1D5DB]' : `${accent.badgeBg} ${accent.badgeText}`}`}>
                    <Icon className={`w-3.5 h-3.5 ${isUnitMastered ? 'text-white' : !isUnitUnlocked ? 'text-[#6B7280]' : accent.badgeText}`} />
                    <span className={`text-[10px] font-semibold uppercase tracking-wider font-mono whitespace-nowrap overflow-hidden text-ellipsis ${isUnitMastered ? 'text-white' : !isUnitUnlocked ? 'text-[#6B7280]' : accent.badgeText}`}>
                      Unit {metadata.order}
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono ${isUnitMastered ? 'text-white/85' : !isUnitUnlocked ? 'text-[#9CA3AF]' : 'text-text-light'}`}>
                    {totalWords} words
                  </span>
                </div>

                <div className="space-y-0.5">
                  <div className={`text-[10px] tracking-wide font-mono ${isUnitMastered ? 'text-white/85' : !isUnitUnlocked ? 'text-[#6B7280]' : 'text-text-med'}`}>
                    {metadata.name}
                  </div>
                  {!isBlueprint && currentLessonInUnit && (
                    <div className={`text-[10px] tracking-wide font-mono ${isUnitMastered ? 'text-white/80' : !isUnitUnlocked ? 'text-[#9CA3AF]' : 'text-text-light'}`}>
                      Current lesson: {currentLessonInUnit}
                    </div>
                  )}
                  <div className={`main-font text-[1.3rem] font-normal leading-tight ${isUnitMastered ? 'text-white' : !isUnitUnlocked ? 'text-[#4B5563]' : 'text-text-dark'}`}>
                    {metadata.hanzi}
                  </div>
                </div>

                <div
                  className={`mt-2 text-[11px] leading-4 ${isUnitMastered ? 'text-white/90' : !isUnitUnlocked ? 'text-[#6B7280]' : 'text-text-med'} overflow-hidden`}
                  style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                >
                  {metadata.description}
                </div>
                {isBlueprint && metadata.microUnits && metadata.microUnits.length > 0 && (
                  <div className={`mt-1 text-[11px] leading-relaxed ${isUnitMastered ? 'text-white/85' : !isUnitUnlocked ? 'text-[#9CA3AF]' : 'text-text-light'} overflow-hidden max-h-9`}>
                    Focus: {metadata.microUnits.slice(0, 3).join(' · ')}
                  </div>
                )}

                <div className="mt-3">
                  <div className="h-2 w-full rounded-full bg-border/75 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isUnitMastered ? 'bg-white/90' : accent.progressFill}`}
                      style={{ width: `${depth}%` }}
                    />
                  </div>
                  <div className={`mt-1 text-[10px] font-mono tracking-wide ${isUnitMastered ? 'text-white/85' : !isUnitUnlocked ? 'text-[#9CA3AF]' : 'text-text-light'}`}>
                    {safeCompletionPercent}% complete
                  </div>
                </div>

                <div className={`font-mono mt-auto pt-3 text-xs font-semibold tracking-wide ${isUnitMastered ? 'text-white' : accent.badgeText}`}>
                  {isBlueprint
                    ? 'Planned'
                    : !isUnitUnlocked
                    ? (
                      <span className="inline-flex items-center gap-1.5">
                        <LockKeyhole className="w-3.5 h-3.5" />
                        {`${LESSON_UNLOCK_PASS_PERCENT}% to unlock`}
                      </span>
                    )
                    : isUnitMastered
                    ? 'Mastered'
                    : isUnitCompleted
                    ? 'Continue Mastery Lessons →'
                    : lessonsCount > 1
                      ? `Continue (${lessonsCount} Lessons) →`
                      : 'Start Lesson →'}
                </div>
                {!isUnitUnlocked && (
                  <div className="absolute inset-0 z-20 rounded-3xl bg-white/45 backdrop-blur-[2px] border border-white/50 flex items-center justify-center pointer-events-none">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 border border-[#D1D5DB] text-[#6B7280]">
                      <LockKeyhole className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold uppercase tracking-wider font-mono">Locked</span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* Lesson Squares for Selected Unit */}
      {activeUnit && !isMandarinBandLocked && (
        <div className="pt-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: activeUnit.lessonsCount }).map((_, lessonIndex) => {
              const row = Math.floor(lessonIndex / columns);
              const col = lessonIndex % columns;
              const accent = CARD_ACCENTS[(col + row) % CARD_ACCENTS.length];
              const range = activeUnit.lessonRanges[lessonIndex];
              const chunkStart = range.start;
              const chunkEnd = range.end;
              const chunkWords = range.count;
              const lessonKey = makeLessonKey(currentLevel.id, activeUnit.unitId, lessonIndex);
              const isLessonCompleted = Boolean(lessonProgress[lessonKey]?.completed);
              const isLessonMastered = Boolean(lessonProgress[lessonKey]?.mastered);
              const isUnitUnlocked = Boolean(unlockedByUnitId.get(activeUnit.unitId));
              const isLessonUnlocked =
                isUnitUnlocked &&
                (lessonIndex === 0 || hasLessonPassedThreshold(activeUnit.unitId, lessonIndex - 1));
              const lessonStatus = lessonProgress[lessonKey];
              const isResumeCandidate =
                resumeCheckpoint?.bandId === currentLevel.id &&
                resumeCheckpoint?.unitId === activeUnit.unitId &&
                resumeCheckpoint?.lessonIndex === lessonIndex;
              const lessonChecks =
                (lessonStatus?.introViewed ? 1 : 0) +
                ((lessonStatus?.quizScore ?? 0) >= QUIZ_PASS_PERCENT ? 1 : 0) +
                ((lessonStatus?.speakScore ?? 0) >= SPEAK_PASS_PERCENT ? 1 : 0);

              return (
                <button
                  key={`${activeUnit.unitId}-${lessonIndex}`}
                  onClick={() => {
                    if (!isLessonUnlocked) return;
                    onSelectLesson(
                      activeUnit.unitId,
                      lessonIndex,
                      isLessonCompleted && !isLessonMastered ? 'quiz' : 'intro'
                    );
                  }}
                  disabled={!isLessonUnlocked}
                  className={`${isLessonMastered ? `${accent.badgeText === 'text-[#186E95]' ? 'bg-[#186E95]' : accent.badgeText === 'text-[#3E5648]' ? 'bg-[#3E5648]' : accent.badgeText === 'text-[#1F2A37]' ? 'bg-[#1F2A37]' : 'bg-[#C2410C]'} text-white` : !isLessonUnlocked ? 'bg-[#F3F4F6] text-[#6B7280]' : isLessonCompleted ? 'bg-white text-text-dark ring-1 ring-[#3E5648]/45' : 'bg-white text-text-dark'} border-2 ${isLessonUnlocked ? accent.borderColor : 'border-[#D1D5DB]'} rounded-2xl min-h-[130px] p-4 text-left transition-all hover:-translate-y-1 hover:shadow-xl ${accent.hoverShadow} active:translate-y-0 disabled:opacity-100 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none`}
                >
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${isLessonMastered ? 'bg-white/20 text-white' : !isLessonUnlocked ? 'bg-[#F3F4F6] text-[#6B7280]' : `${accent.badgeBg} ${accent.badgeText}`}`}>
                    <BookOpen className={`w-3.5 h-3.5 ${isLessonMastered ? 'text-white' : !isLessonUnlocked ? 'text-[#6B7280]' : accent.badgeText}`} />
                    <span className={`text-xs font-semibold uppercase tracking-wider font-mono ${isLessonMastered ? 'text-white' : !isLessonUnlocked ? 'text-[#6B7280]' : accent.badgeText}`}>
                      Lesson {lessonIndex + 1}
                    </span>
                  </div>

                  <div className={`mt-4 text-sm font-mono uppercase tracking-wider ${isLessonMastered ? 'text-white/90' : !isLessonUnlocked ? 'text-[#6B7280]' : 'text-text-med'}`}>
                    Words {chunkStart}-{chunkEnd}
                  </div>

                  <div className={`mt-1 text-xs font-mono uppercase tracking-wider ${isLessonMastered ? 'text-white/85' : !isLessonUnlocked ? 'text-[#9CA3AF]' : 'text-text-light'}`}>
                    {chunkWords} {chunkWords === 1 ? 'word' : 'words'}
                  </div>

                  <div className={`mt-4 text-[11px] font-semibold uppercase tracking-wider font-mono ${isLessonMastered ? 'text-white' : !isLessonUnlocked ? 'text-[#6B7280]' : accent.badgeText}`}>
                    {isLessonMastered
                      ? 'Mastered'
                      : !isLessonUnlocked
                        ? (
                          <span className="inline-flex items-center gap-1">
                            <LockKeyhole className="w-3 h-3" />
                            {`${LESSON_UNLOCK_PASS_PERCENT}% to unlock`}
                          </span>
                        )
                      : isLessonCompleted
                        ? 'Completed · Mastery available'
                      : isResumeCandidate
                        ? 'Resume →'
                        : lessonChecks > 0
                          ? `${lessonChecks} of 3 complete`
                          : 'Start →'}
                  </div>
                </button>
              );
            })}
            {(() => {
              const applyLessonIndex = activeUnit.lessonsCount;
              return (
                <button
                  key={`${activeUnit.unitId}-apply`}
                  onClick={() => {
                    onSelectLesson(activeUnit.unitId, applyLessonIndex, 'apply');
                  }}
                  className="bg-[#C2410C] text-white border-[#C2410C] border-[2.5px] rounded-2xl min-h-[130px] p-4 text-left transition-all hover:-translate-y-1 hover:shadow-[0_18px_34px_-22px_rgba(194,65,12,0.55)] active:translate-y-0 relative overflow-hidden"
                >
                  <div className="absolute inset-[6px] rounded-[0.8rem] border border-white/24 pointer-events-none" />

                  <div className="h-full flex flex-col items-center justify-center text-center gap-2 relative z-10">
                    <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/18 text-white border border-white/18">
                      <span className="relative inline-flex items-center justify-center w-4 h-4">
                        <MessageSquare className="w-4 h-4 text-white" />
                        <Check className="absolute -right-1 -bottom-1 w-2.5 h-2.5 text-white" />
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-white">
                        Apply
                      </span>
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.16em] font-mono text-white/85">
                      Context Practice
                    </div>
                  </div>
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* Empty State */}
      {unitMetrics.length === 0 && !activeUnit && (
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-bold text-text-dark mb-2">No Units Available</h3>
          <p className="text-text-med text-center">
            This level doesn't have any units yet. Check back soon!
          </p>
        </div>
      )}

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
