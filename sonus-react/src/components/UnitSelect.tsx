import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { BookOpen } from 'lucide-react';
import { getUnitsForBand } from '../data/unitMetadata';
import BottomNav from './BottomNav';
import { getLessonRanges } from '../lib/lessonChunks';
import { makeLessonKey } from '../lib/lessonProgress';
import GlassHeader from './GlassHeader';

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
  onSelectLesson: (unitId: string, lessonIndex: number) => void;
  onOpenPractice: (unitId: string) => void;
  onGoHome: () => void;
  onOpenProfile: () => void;
}

function getGridColumns(width: number) {
  if (width >= 1280) return 4; // xl
  if (width >= 1024) return 3; // lg
  if (width >= 640) return 2; // sm
  return 1;
}

function getPracticeType(unitId: string): 'listening' | 'speaking' | null {
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
      const unitData = activeBandData.units[metadata.id];
      if (!unitData) return null;
      const practiceType = getPracticeType(metadata.id);
      const isMacroBlueprint = currentLevel.band >= 7 && !practiceType && unitData.words.length === 0;
      if (!practiceType && unitData.words.length === 0 && !isMacroBlueprint) return null;
      if (practiceType) {
        return {
          unitId: metadata.id,
          metadata,
          totalWords: 0,
          lessonsCount: 1,
          lessonRanges: [],
          completedLessons: 0,
          averageLessonProgress: 0,
          practiceType,
          isBlueprint: false,
        };
      }

      const totalWords = unitData.words.length;
      const lessonRanges = getLessonRanges(totalWords, 10);
      const lessonsCount = lessonRanges.length;
      const lessonScores = lessonRanges.map((_, lessonIndex) => {
        const key = makeLessonKey(currentLevel.id, metadata.id, lessonIndex);
        const status = lessonProgress[key];
        if (!status) return 0;
        let checks = 0;
        if (status.introViewed) checks += 1;
        if ((status.quizScore ?? 0) >= 90) checks += 1;
        if (status.speakAllCorrect) checks += 1;
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
      return {
        unitId: metadata.id,
        metadata,
        totalWords,
        lessonsCount,
        lessonRanges,
        completedLessons,
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

  return (
    <div className="min-h-screen page-shell pb-24 px-6">
      <GlassHeader title={headerTitle} />

      {/* Units Grid */}
      {!activeUnit && (
      <div className="pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {unitMetrics.map(({ unitId, metadata, totalWords, lessonsCount, completedLessons, averageLessonProgress, practiceType, isBlueprint }, index) => {
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
                  : {
                      solidBg: 'bg-[#C2410C]',
                      borderColor: 'border-[#C2410C]',
                    };
              return (
                <button
                  key={unitId}
                  onClick={() => onOpenPractice(unitId)}
                  className={`${practiceAccent.solidBg} text-white border ${practiceAccent.borderColor} rounded-3xl min-h-[170px] p-5 text-left shadow-[0_12px_28px_-22px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-0.5 ${accent.hoverShadow} active:translate-y-0 flex flex-col`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/20 text-white">
                      <Icon className="w-3.5 h-3.5 text-white" />
                      <span className="text-xs font-semibold uppercase tracking-wider font-mono text-white">
                        {practiceType === 'listening' ? 'Listening Practice' : 'Speaking Practice'}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-white/85">Practice</span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] tracking-wide font-mono text-white/85">
                      {metadata.name}
                    </div>
                    <div className="main-font text-[2rem] font-normal leading-tight text-white">
                      {metadata.hanzi}
                    </div>
                  </div>

                  <div className="mt-3 text-xs leading-relaxed text-white/90">
                    {metadata.description}
                  </div>

                  <div className="mt-auto pt-5 text-sm font-semibold tracking-wide text-white">
                    Start practice →
                  </div>
                </button>
              );
            }
            const isUnitComplete = lessonsCount > 0 && completedLessons === lessonsCount;
            const depth = isBlueprint ? 0 : isUnitComplete ? 100 : Math.max(4, averageLessonProgress);

            return (
              <button
                key={unitId}
                onClick={() => {
                  if (isBlueprint) return;
                  setActiveUnit(unitId);
                }}
                disabled={isBlueprint}
                className={`${isUnitComplete ? `${accent.badgeText === 'text-[#186E95]' ? 'bg-[#186E95]' : accent.badgeText === 'text-[#3E5648]' ? 'bg-[#3E5648]' : accent.badgeText === 'text-[#374151]' ? 'bg-[#374151]' : 'bg-[#C2410C]'} text-white` : 'bg-white/95 text-text-dark'} border ${accent.borderColor} rounded-3xl min-h-[170px] p-5 text-left shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)] transition-all duration-200 hover:-translate-y-0.5 ${accent.hoverShadow} active:translate-y-0`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${isUnitComplete ? 'bg-white/20 text-white' : `${accent.badgeBg} ${accent.badgeText}`}`}>
                    <Icon className={`w-3.5 h-3.5 ${isUnitComplete ? 'text-white' : accent.badgeText}`} />
                    <span className={`text-xs font-semibold uppercase tracking-wider font-mono ${isUnitComplete ? 'text-white' : accent.badgeText}`}>
                      Unit {metadata.order}
                    </span>
                  </div>
                  <span className={`text-xs font-mono ${isUnitComplete ? 'text-white/85' : 'text-text-light'}`}>
                    {totalWords} words
                  </span>
                </div>

                <div className="space-y-1">
                  <div className={`text-[11px] tracking-wide font-mono ${isUnitComplete ? 'text-white/85' : 'text-text-med'}`}>
                    {metadata.name}
                  </div>
                  <div className={`main-font text-[2rem] font-normal leading-tight ${isUnitComplete ? 'text-white' : 'text-text-dark'}`}>
                    {metadata.hanzi}
                  </div>
                </div>

                <div className={`mt-3 text-xs leading-relaxed ${isUnitComplete ? 'text-white/90' : 'text-text-med'}`}>
                  {metadata.description}
                </div>
                {isBlueprint && metadata.microUnits && metadata.microUnits.length > 0 && (
                  <div className={`mt-2 text-xs leading-relaxed ${isUnitComplete ? 'text-white/85' : 'text-text-light'}`}>
                    Focus: {metadata.microUnits.slice(0, 3).join(' · ')}
                  </div>
                )}

                <div className="mt-5">
                  <div className="h-2.5 w-full rounded-full bg-border/75 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isUnitComplete ? 'bg-white/90' : accent.progressFill}`}
                      style={{ width: `${depth}%` }}
                    />
                  </div>
                  <div className={`mt-1.5 text-[11px] font-mono tracking-wide ${isUnitComplete ? 'text-white/85' : 'text-text-light'}`}>
                    Progress {averageLessonProgress}%
                  </div>
                </div>

                <div className={`mt-5 text-sm font-semibold tracking-wide ${isUnitComplete ? 'text-white' : accent.badgeText}`}>
                  {isBlueprint
                    ? 'Planned'
                    : isUnitComplete
                    ? 'Unit complete'
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
      {activeUnit && (
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
              const isLessonComplete = Boolean(lessonProgress[lessonKey]?.completed);
              const lessonStatus = lessonProgress[lessonKey];
              const isResumeCandidate =
                resumeCheckpoint?.bandId === currentLevel.id &&
                resumeCheckpoint?.unitId === activeUnit.unitId &&
                resumeCheckpoint?.lessonIndex === lessonIndex;
              const lessonChecks =
                (lessonStatus?.introViewed ? 1 : 0) +
                ((lessonStatus?.quizScore ?? 0) >= 90 ? 1 : 0) +
                (lessonStatus?.speakAllCorrect ? 1 : 0);

              return (
                <button
                  key={`${activeUnit.unitId}-${lessonIndex}`}
                  onClick={() => onSelectLesson(activeUnit.unitId, lessonIndex)}
                  className={`${isLessonComplete ? `${accent.badgeText === 'text-[#186E95]' ? 'bg-[#186E95]' : accent.badgeText === 'text-[#3E5648]' ? 'bg-[#3E5648]' : accent.badgeText === 'text-[#374151]' ? 'bg-[#374151]' : 'bg-[#C2410C]'} text-white` : 'bg-white text-text-dark'} border-2 ${accent.borderColor} rounded-2xl min-h-[130px] p-4 text-left transition-all hover:-translate-y-1 hover:shadow-xl ${accent.hoverShadow} active:translate-y-0`}
                >
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${isLessonComplete ? 'bg-white/20 text-white' : `${accent.badgeBg} ${accent.badgeText}`}`}>
                    <BookOpen className={`w-3.5 h-3.5 ${isLessonComplete ? 'text-white' : accent.badgeText}`} />
                    <span className={`text-xs font-semibold uppercase tracking-wider font-mono ${isLessonComplete ? 'text-white' : accent.badgeText}`}>
                      Lesson {lessonIndex + 1}
                    </span>
                  </div>

                  <div className={`mt-4 text-sm font-mono uppercase tracking-wider ${isLessonComplete ? 'text-white/90' : 'text-text-med'}`}>
                    Words {chunkStart}-{chunkEnd}
                  </div>

                  <div className={`mt-1 text-xs font-mono uppercase tracking-wider ${isLessonComplete ? 'text-white/85' : 'text-text-light'}`}>
                    {chunkWords} {chunkWords === 1 ? 'word' : 'words'}
                  </div>

                  <div className={`mt-4 text-xs font-semibold uppercase tracking-wider font-mono ${isLessonComplete ? 'text-white' : accent.badgeText}`}>
                    {isLessonComplete
                      ? 'Complete'
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
