import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { BookOpen } from 'lucide-react';
import { getUnitsForBand, isCheckpointUnitId } from '../data/unitMetadata';
import BottomNav from './BottomNav';
import { getLessonRanges } from '../lib/lessonChunks';
import { makeLessonKey } from '../lib/lessonProgress';
import GlassHeader from './GlassHeader';
import { QUIZ_PASS_PERCENT, SPEAK_PASS_PERCENT } from '../lib/passCriteria';
import type { LessonMode } from '../types/lesson.types';

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
    borderColor: 'border-[#374151]/55',
    badgeBg: 'bg-[rgba(55,65,81,0.10)]',
    badgeText: 'text-[#374151]',
    progressFill: 'bg-[#374151]/55',
    hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(55,65,81,0.24)]',
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
  const orderedUnits = getUnitsForBand(currentLevel.id);

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
      const lessonScores = lessonRanges.map((_, lessonIndex) => {
        const key = makeLessonKey(currentLevel.id, metadata.id, lessonIndex);
        const status = lessonProgress[key];
        if (!status) return 0;
        let checks = 0;
        if (status.introViewed) checks += 1;
        if ((status.quizScore ?? 0) >= QUIZ_PASS_PERCENT) checks += 1;
        if ((status.speakScore ?? 0) >= SPEAK_PASS_PERCENT) checks += 1;
        return checks / 3;
      });
      const averageLessonProgress =
        lessonsCount > 0
          ? Math.round((lessonScores.reduce((sum, next) => sum + next, 0) / lessonsCount) * 100)
          : 0;
      const completedLessons = lessonRanges.filter((_, lessonIndex) => {
        const key = makeLessonKey(currentLevel.id, metadata.id, lessonIndex);
        return Boolean(lessonProgress[key]?.completed);
      }).length;
      const masteredLessons = lessonRanges.filter((_, lessonIndex) => {
        const key = makeLessonKey(currentLevel.id, metadata.id, lessonIndex);
        return Boolean(lessonProgress[key]?.mastered);
      }).length;
      return {
        unitId: metadata.id,
        metadata,
        totalWords,
        lessonsCount,
        lessonRanges,
        completedLessons,
        masteredLessons,
        averageLessonProgress,
        practiceType: null as null,
        isBlueprint: isMacroBlueprint,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const columns = getGridColumns(viewportWidth);
  const activeUnit = activeUnitId
    ? unitMetrics.find((u) => u.unitId === activeUnitId) ?? null
    : null;
  const headerTitle = activeUnit ? `Unit ${activeUnit.metadata.order}` : currentLevel.name;
  const isMandarinBandLocked = state.selectedLanguage === 'zh' && currentLevel.band > 2;

  return (
    <div className="min-h-screen page-shell pb-24 px-6">
      <GlassHeader title={headerTitle} />

      {isMandarinBandLocked && (
        <div className="pt-2">
          <div className="rounded-3xl border border-[#186E95]/35 bg-white/95 p-6 text-center shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)]">
            <div className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono bg-[rgba(24,110,149,0.12)] text-[#186E95]">
              Coming Soon
            </div>
            <h3 className="main-font text-[2rem] leading-tight font-normal mt-4 text-[#186E95]">
              This Band Is In Progress
            </h3>
            <p className="text-sm text-text-med mt-2 max-w-xl mx-auto">
              Bands 1 and 2 are available now. We are actively building this band and will unlock it soon.
            </p>
          </div>
        </div>
      )}

      {/* Units Grid */}
      {!activeUnit && !isMandarinBandLocked && (
      <div className="pt-2">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {unitMetrics.map(({ unitId, metadata, totalWords, lessonsCount, completedLessons, masteredLessons, averageLessonProgress, practiceType, isBlueprint }, index) => {
            const row = Math.floor(index / columns);
            const col = index % columns;
            const accent = CARD_ACCENTS[(col + row) % CARD_ACCENTS.length];
            const Icon = metadata.icon;
            if (practiceType) {
              const practiceAccent =
                practiceType === 'listening'
                  ? {
                      solidBg: 'bg-[#186E95]',
                      borderColor: 'border-[#186E95]',
                    }
                  : practiceType === 'speaking'
                  ? {
                      solidBg: 'bg-[#C2410C]',
                      borderColor: 'border-[#C2410C]',
                    }
                  : {
                      solidBg: 'bg-[#374151]',
                      borderColor: 'border-[#374151]',
                    };
              return (
                <button
                  key={unitId}
                  onClick={() => {
                    if (practiceType === 'checkpoint') {
                      onSelectLesson(unitId, 0, 'quiz');
                      return;
                    }
                    onOpenPractice(unitId);
                  }}
                  className={`${practiceAccent.solidBg} text-white border ${practiceAccent.borderColor} rounded-3xl h-[220px] p-4 text-left shadow-[0_12px_28px_-22px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-0.5 ${accent.hoverShadow} active:translate-y-0 flex flex-col overflow-hidden`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="inline-flex min-w-0 max-w-[72%] items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/20 text-white">
                      <Icon className="w-3.5 h-3.5 text-white" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider font-mono text-white whitespace-nowrap overflow-hidden text-ellipsis">
                        {practiceType === 'listening'
                          ? 'Listening'
                          : practiceType === 'speaking'
                          ? 'Speaking'
                          : 'Checkpoint'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-white/85">Practice</span>
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-[10px] tracking-wide font-mono text-white/85">
                      {metadata.name.replace(/^Checkpoint Quiz\s+/i, 'Unit Review ')}
                    </div>
                    <div className="main-font text-[1.3rem] font-normal leading-tight text-white">
                      {metadata.hanzi}
                    </div>
                  </div>

                  <div
                    className="mt-2 text-[11px] leading-4 text-white/90 overflow-hidden"
                    style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                  >
                    {metadata.description}
                  </div>

                  <div className="font-mono mt-auto pt-4 text-sm font-semibold tracking-wide text-white">
                    {practiceType === 'checkpoint' ? 'Begin →' : 'Start practice →'}
                  </div>
                </button>
              );
            }
            const isUnitCompleted = lessonsCount > 0 && completedLessons === lessonsCount;
            const isUnitMastered = lessonsCount > 0 && masteredLessons === lessonsCount;
            const depth = isBlueprint ? 0 : isUnitMastered ? 100 : Math.max(4, averageLessonProgress);

            return (
              <button
                key={unitId}
                onClick={() => {
                  if (isBlueprint) return;
                  setActiveUnit(unitId);
                }}
                disabled={isBlueprint}
                className={`${isUnitMastered ? `${accent.badgeText === 'text-[#186E95]' ? 'bg-[#186E95]' : accent.badgeText === 'text-[#3E5648]' ? 'bg-[#3E5648]' : accent.badgeText === 'text-[#374151]' ? 'bg-[#374151]' : 'bg-[#C2410C]'} text-white` : isUnitCompleted ? 'bg-white text-text-dark ring-1 ring-[#3E5648]/40' : 'bg-white/95 text-text-dark'} border ${accent.borderColor} rounded-3xl h-[220px] p-4 text-left shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)] transition-all duration-200 hover:-translate-y-0.5 ${accent.hoverShadow} active:translate-y-0 flex flex-col overflow-hidden`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className={`inline-flex min-w-0 max-w-[72%] items-center gap-1.5 px-2.5 py-1 rounded-lg ${isUnitMastered ? 'bg-white/20 text-white' : `${accent.badgeBg} ${accent.badgeText}`}`}>
                    <Icon className={`w-3.5 h-3.5 ${isUnitMastered ? 'text-white' : accent.badgeText}`} />
                    <span className={`text-[10px] font-semibold uppercase tracking-wider font-mono whitespace-nowrap overflow-hidden text-ellipsis ${isUnitMastered ? 'text-white' : accent.badgeText}`}>
                      Unit {metadata.order}
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono ${isUnitMastered ? 'text-white/85' : 'text-text-light'}`}>
                    {totalWords} words
                  </span>
                </div>

                <div className="space-y-0.5">
                  <div className={`text-[10px] tracking-wide font-mono ${isUnitMastered ? 'text-white/85' : 'text-text-med'}`}>
                    {metadata.name}
                  </div>
                  <div className={`main-font text-[1.3rem] font-normal leading-tight ${isUnitMastered ? 'text-white' : 'text-text-dark'}`}>
                    {metadata.hanzi}
                  </div>
                </div>

                <div
                  className={`mt-2 text-[11px] leading-4 ${isUnitMastered ? 'text-white/90' : 'text-text-med'} overflow-hidden`}
                  style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                >
                  {metadata.description}
                </div>
                {isBlueprint && metadata.microUnits && metadata.microUnits.length > 0 && (
                  <div className={`mt-1 text-[11px] leading-relaxed ${isUnitMastered ? 'text-white/85' : 'text-text-light'} overflow-hidden max-h-9`}>
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
                  <div className={`mt-1 text-[10px] font-mono tracking-wide ${isUnitMastered ? 'text-white/85' : 'text-text-light'}`}>
                    {averageLessonProgress}% complete
                  </div>
                </div>

                <div className={`font-mono mt-auto pt-3 text-sm font-semibold tracking-wide ${isUnitMastered ? 'text-white' : accent.badgeText}`}>
                  {isBlueprint
                    ? 'Planned'
                    : isUnitMastered
                    ? 'Mastered'
                    : isUnitCompleted
                    ? 'Completed · Mastery available'
                    : lessonsCount > 1
                      ? `Continue (${lessonsCount} lessons) →`
                      : 'Start lesson →'}
                </div>
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
                  onClick={() =>
                    onSelectLesson(
                      activeUnit.unitId,
                      lessonIndex,
                      isLessonCompleted && !isLessonMastered ? 'quiz' : 'intro'
                    )
                  }
                  className={`${isLessonMastered ? `${accent.badgeText === 'text-[#186E95]' ? 'bg-[#186E95]' : accent.badgeText === 'text-[#3E5648]' ? 'bg-[#3E5648]' : accent.badgeText === 'text-[#374151]' ? 'bg-[#374151]' : 'bg-[#C2410C]'} text-white` : isLessonCompleted ? 'bg-white text-text-dark ring-1 ring-[#3E5648]/45' : 'bg-white text-text-dark'} border-2 ${accent.borderColor} rounded-2xl min-h-[130px] p-4 text-left transition-all hover:-translate-y-1 hover:shadow-xl ${accent.hoverShadow} active:translate-y-0`}
                >
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${isLessonMastered ? 'bg-white/20 text-white' : `${accent.badgeBg} ${accent.badgeText}`}`}>
                    <BookOpen className={`w-3.5 h-3.5 ${isLessonMastered ? 'text-white' : accent.badgeText}`} />
                    <span className={`text-xs font-semibold uppercase tracking-wider font-mono ${isLessonMastered ? 'text-white' : accent.badgeText}`}>
                      Lesson {lessonIndex + 1}
                    </span>
                  </div>

                  <div className={`mt-4 text-sm font-mono uppercase tracking-wider ${isLessonMastered ? 'text-white/90' : 'text-text-med'}`}>
                    Words {chunkStart}-{chunkEnd}
                  </div>

                  <div className={`mt-1 text-xs font-mono uppercase tracking-wider ${isLessonMastered ? 'text-white/85' : 'text-text-light'}`}>
                    {chunkWords} {chunkWords === 1 ? 'word' : 'words'}
                  </div>

                  <div className={`mt-4 text-xs font-semibold uppercase tracking-wider font-mono ${isLessonMastered ? 'text-white' : accent.badgeText}`}>
                    {isLessonMastered
                      ? 'Mastered'
                      : isLessonCompleted
                        ? 'Completed · Mastery available'
                      : isResumeCandidate
                        ? 'Resume →'
                        : lessonChecks > 0
                          ? `${lessonChecks}/3 checks`
                          : 'Start →'}
                  </div>
                </button>
              );
            })}
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
