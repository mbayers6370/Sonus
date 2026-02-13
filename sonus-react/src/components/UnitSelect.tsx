import { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { ChevronLeft, BookOpen } from 'lucide-react';
import { getUnitsForBand } from '../data/unitMetadata';
import BottomNav from './BottomNav';
import { getLessonRanges } from '../lib/lessonChunks';
import { makeLessonKey } from '../lib/lessonProgress';

const CARD_ACCENTS = [
  {
    borderColor: 'border-[#1E3A8A]',
    badgeBg: 'bg-[rgba(30,58,138,0.16)]',
    badgeText: 'text-[#1E3A8A]',
    progressFill: 'bg-[#1E3A8A]/45',
    hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(30,58,138,0.45)]',
  },
  {
    borderColor: 'border-[#4D7C0F]',
    badgeBg: 'bg-[rgba(77,124,15,0.16)]',
    badgeText: 'text-[#4D7C0F]',
    progressFill: 'bg-[#4D7C0F]/45',
    hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(77,124,15,0.40)]',
  },
  {
    borderColor: 'border-[#374151]',
    badgeBg: 'bg-[rgba(55,65,81,0.14)]',
    badgeText: 'text-[#374151]',
    progressFill: 'bg-[#374151]/45',
    hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(55,65,81,0.42)]',
  },
  {
    borderColor: 'border-[#C2410C]',
    badgeBg: 'bg-[rgba(194,65,12,0.16)]',
    badgeText: 'text-[#C2410C]',
    progressFill: 'bg-[#C2410C]/45',
    hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(194,65,12,0.45)]',
  },
] as const;

interface UnitSelectProps {
  onBack: () => void;
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
  onBack,
  onSelectLesson,
  onOpenPractice,
  onGoHome,
  onOpenProfile,
}: UnitSelectProps) {
  const { state } = useApp();
  const { currentLevel, activeBandData, lessonProgress, resumeCheckpoint } = state;
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === 'undefined' ? 1280 : window.innerWidth
  );
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen page-shell pb-24 px-6 pt-14">
      {/* Header */}
      <div className="relative mb-10 pt-4">
        <button
          onClick={() => {
            if (activeUnitId) {
              setActiveUnitId(null);
              return;
            }
            onBack();
          }}
          className="absolute left-0 top-0 inline-flex items-center gap-1.5 p-2 -ml-2 text-text-dark hover:opacity-70 transition-opacity"
        >
          <ChevronLeft className="w-4.5 h-4.5" />
          <span className="text-sm">Back</span>
        </button>
        <div className="text-center px-12 pt-8">
          <h1 className="font-playfair text-5xl font-normal text-text-dark mb-2">
            {activeUnit ? `Unit ${activeUnit.metadata.order}` : currentLevel.name}
          </h1>
          <h2 className="text-base text-text-med italic">
            {activeUnit ? activeUnit.metadata.name : currentLevel.description}
          </h2>
        </div>
      </div>

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
                      solidBg: 'bg-[#1E3A8A]',
                      borderColor: 'border-[#1E3A8A]',
                    }
                  : {
                      solidBg: 'bg-[#C2410C]',
                      borderColor: 'border-[#C2410C]',
                    };
              return (
                <button
                  key={unitId}
                  onClick={() => onOpenPractice(unitId)}
                  className={`${practiceAccent.solidBg} text-white border-2 ${practiceAccent.borderColor} rounded-2xl min-h-[150px] p-4 text-left transition-all hover:-translate-y-1 hover:shadow-xl ${accent.hoverShadow} active:translate-y-0 flex flex-col`}
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
                    <div className="text-xs uppercase tracking-wider font-mono text-white/85">
                      {metadata.name}
                    </div>
                    <div className="font-playfair text-xl font-normal leading-tight text-white">
                      {metadata.hanzi}
                    </div>
                  </div>

                  <div className="mt-3 text-[11px] leading-snug text-white/90">
                    {metadata.description}
                  </div>

                  <div className="mt-auto pt-4 text-xs font-semibold uppercase tracking-wider font-mono text-white">
                    Open practice →
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
                  setActiveUnitId(unitId);
                }}
                disabled={isBlueprint}
                className={`${isUnitComplete ? `${accent.badgeText === 'text-[#1E3A8A]' ? 'bg-[#1E3A8A]' : accent.badgeText === 'text-[#4D7C0F]' ? 'bg-[#4D7C0F]' : accent.badgeText === 'text-[#374151]' ? 'bg-[#374151]' : 'bg-[#C2410C]'} text-white` : 'bg-white text-text-dark'} border-2 ${accent.borderColor} rounded-2xl min-h-[150px] p-4 text-left transition-all hover:-translate-y-1 hover:shadow-xl ${accent.hoverShadow} active:translate-y-0`}
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
                  <div className={`text-xs uppercase tracking-wider font-mono ${isUnitComplete ? 'text-white/85' : 'text-text-med'}`}>
                    {metadata.name}
                  </div>
                  <div className={`font-playfair text-xl font-normal leading-tight ${isUnitComplete ? 'text-white' : 'text-text-dark'}`}>
                    {metadata.hanzi}
                  </div>
                </div>

                <div className={`mt-3 text-[11px] leading-snug ${isUnitComplete ? 'text-white/90' : 'text-text-med'}`}>
                  {metadata.description}
                </div>
                {isBlueprint && metadata.microUnits && metadata.microUnits.length > 0 && (
                  <div className={`mt-2 text-[11px] leading-snug ${isUnitComplete ? 'text-white/85' : 'text-text-light'}`}>
                    Focus: {metadata.microUnits.slice(0, 3).join(' · ')}
                  </div>
                )}

                <div className="mt-4">
                  <div className="h-1.5 w-full rounded-full bg-border/80 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isUnitComplete ? 'bg-white/90' : accent.progressFill}`}
                      style={{ width: `${depth}%` }}
                    />
                  </div>
                  <div className={`mt-1 text-[10px] font-mono uppercase tracking-wider ${isUnitComplete ? 'text-white/85' : 'text-text-light'}`}>
                    Progress {averageLessonProgress}%
                  </div>
                </div>

                <div className={`mt-4 text-xs font-semibold uppercase tracking-wider font-mono ${isUnitComplete ? 'text-white' : accent.badgeText}`}>
                  {isBlueprint
                    ? 'Planned →'
                    : isUnitComplete
                    ? 'Unit complete'
                    : lessonsCount > 1
                      ? `Choose lesson (${lessonsCount}) →`
                      : 'Start learning →'}
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
                  className={`${isLessonComplete ? `${accent.badgeText === 'text-[#1E3A8A]' ? 'bg-[#1E3A8A]' : accent.badgeText === 'text-[#4D7C0F]' ? 'bg-[#4D7C0F]' : accent.badgeText === 'text-[#374151]' ? 'bg-[#374151]' : 'bg-[#C2410C]'} text-white` : 'bg-white text-text-dark'} border-2 ${accent.borderColor} rounded-2xl min-h-[130px] p-4 text-left transition-all hover:-translate-y-1 hover:shadow-xl ${accent.hoverShadow} active:translate-y-0`}
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
