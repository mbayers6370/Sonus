import { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { ChevronLeft, BookOpen } from 'lucide-react';
import { getUnitsForBand } from '../data/unitMetadata';
import BottomNav from './BottomNav';

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
  onGoHome: () => void;
  onOpenProfile: () => void;
}

function getGridColumns(width: number) {
  if (width >= 1280) return 4; // xl
  if (width >= 1024) return 3; // lg
  if (width >= 640) return 2; // sm
  return 1;
}

export default function UnitSelect({ onBack, onSelectLesson, onGoHome, onOpenProfile }: UnitSelectProps) {
  const { state } = useApp();
  const { currentLevel, activeBandData } = state;
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
      if (!unitData || unitData.words.length === 0) return null;

      const totalWords = unitData.words.length;
      const lessonsCount = Math.ceil(totalWords / 10);
      return {
        unitId: metadata.id,
        metadata,
        totalWords,
        lessonsCount,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const maxWords = Math.max(1, ...unitMetrics.map((m) => m.totalWords));
  const columns = getGridColumns(viewportWidth);
  const activeUnit = activeUnitId
    ? unitMetrics.find((u) => u.unitId === activeUnitId) ?? null
    : null;

  return (
    <div className="min-h-screen page-shell pb-24 px-6 pt-14">
      {/* Header */}
      <div className="relative mb-10">
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
        <div className="text-center">
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
          {unitMetrics.map(({ unitId, metadata, totalWords, lessonsCount }, index) => {
            const row = Math.floor(index / columns);
            const col = index % columns;
            const accent = CARD_ACCENTS[(col + row) % CARD_ACCENTS.length];
            const Icon = metadata.icon;
            const depth = Math.max(12, Math.round((totalWords / maxWords) * 100));

            return (
              <button
                key={unitId}
                onClick={() => setActiveUnitId(unitId)}
                className={`bg-white border-2 ${accent.borderColor} rounded-2xl min-h-[150px] p-4 text-left transition-all hover:-translate-y-1 hover:shadow-xl ${accent.hoverShadow} active:translate-y-0`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${accent.badgeBg}`}>
                    <Icon className={`w-3.5 h-3.5 ${accent.badgeText}`} />
                    <span className={`text-xs font-semibold uppercase tracking-wider font-mono ${accent.badgeText}`}>
                      Unit {metadata.order}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-text-light">
                    {totalWords} words
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wider text-text-med font-mono">
                    {metadata.name}
                  </div>
                  <div className="font-playfair text-xl font-normal text-text-dark leading-tight">
                    {metadata.hanzi}
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-text-med leading-snug">
                  {metadata.description}
                </div>

                <div className="mt-4">
                  <div className="h-1.5 w-full rounded-full bg-border/80 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${accent.progressFill}`}
                      style={{ width: `${depth}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] font-mono text-text-light uppercase tracking-wider">
                    Content depth
                  </div>
                </div>

                <div className={`mt-4 text-xs font-semibold uppercase tracking-wider font-mono ${accent.badgeText}`}>
                  {lessonsCount > 1 ? `Choose lesson (${lessonsCount}) →` : 'Start learning →'}
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
              const chunkStart = lessonIndex * 10 + 1;
              const chunkEnd = Math.min((lessonIndex + 1) * 10, activeUnit.totalWords);
              const chunkWords = chunkEnd - chunkStart + 1;

              return (
                <button
                  key={`${activeUnit.unitId}-${lessonIndex}`}
                  onClick={() => onSelectLesson(activeUnit.unitId, lessonIndex)}
                  className={`bg-white border-2 ${accent.borderColor} rounded-2xl min-h-[130px] p-4 text-left transition-all hover:-translate-y-1 hover:shadow-xl ${accent.hoverShadow} active:translate-y-0`}
                >
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${accent.badgeBg}`}>
                    <BookOpen className={`w-3.5 h-3.5 ${accent.badgeText}`} />
                    <span className={`text-xs font-semibold uppercase tracking-wider font-mono ${accent.badgeText}`}>
                      Lesson {lessonIndex + 1}
                    </span>
                  </div>

                  <div className="mt-4 text-sm font-mono text-text-med uppercase tracking-wider">
                    Words {chunkStart}-{chunkEnd}
                  </div>

                  <div className="mt-1 text-xs text-text-light font-mono uppercase tracking-wider">
                    {chunkWords} {chunkWords === 1 ? 'word' : 'words'}
                  </div>

                  <div className={`mt-4 text-xs font-semibold uppercase tracking-wider font-mono ${accent.badgeText}`}>
                    Start →
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

      <BottomNav active="home" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
