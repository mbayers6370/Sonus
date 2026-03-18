import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import type { LessonBand } from '../types/lesson.types';
import { ChevronRight } from 'lucide-react';
import { getUnitsForBand, isCheckpointUnitId, isPracticeUnitId } from '../data/unitMetadata';
import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';
import { getLessonRanges } from '../lib/lessonChunks';
import { makeLessonKey } from '../lib/lessonProgress';
import { QUIZ_PASS_PERCENT, SPEAK_PASS_PERCENT } from '../lib/passCriteria';
import { normalizeLanguageId } from '../lib/languageRuntime';
import { isReleasedTrackLevel } from '../lib/bandIds';

// Accent styling helpers
const ACCENT = {
  gray: { badgeBg: 'bg-gray-100/80', badgeText: 'text-gray-700', ctaText: 'text-gray-700', hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(107,114,128,0.18)]', leftBorder: 'border-gray-400/55' },
  navy: { badgeBg: 'bg-[rgba(19,87,119,0.12)]', badgeText: 'text-[var(--sonus-palette-blue)]', ctaText: 'text-[var(--sonus-palette-blue)]', hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(19,87,119,0.28)]', leftBorder: 'border-[var(--sonus-palette-blue)]/55' },
  sage: { badgeBg: 'bg-[rgba(25,50,50,0.12)]', badgeText: 'text-[var(--sonus-palette-green)]', ctaText: 'text-[var(--sonus-palette-green)]', hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(25,50,50,0.26)]', leftBorder: 'border-[var(--sonus-palette-green)]/55' },
  graphite: { badgeBg: 'bg-[rgba(31,42,55,0.10)]', badgeText: 'text-[var(--sonus-palette-charcoal)]', ctaText: 'text-[var(--sonus-palette-charcoal)]', hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(31,42,55,0.24)]', leftBorder: 'border-[var(--sonus-palette-charcoal)]/55' },
  rust: { badgeBg: 'bg-[rgba(194,65,12,0.12)]', badgeText: 'text-[var(--sonus-palette-rust)]', ctaText: 'text-[var(--sonus-palette-rust)]', hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(194,65,12,0.30)]', leftBorder: 'border-[var(--sonus-palette-rust)]/55' },
} as const;

type AccentKey = keyof typeof ACCENT;
const CARD_ACCENT_ORDER: AccentKey[] = ['navy', 'sage', 'graphite', 'rust'];
const RELEASED_LEGACY_BAND_LEVELS = new Set(['band1', 'band2', 'band3', 'band4']);

function getDrenchedBorderClass(levelId: string) {
  if (levelId === 'intro') return 'sonus-drenched-border-charcoal';
  if (levelId === 'band1' || levelId === 'band2') return 'sonus-drenched-border-green';
  if (levelId === 'band3' || levelId === 'band4') return 'sonus-drenched-border-ocean';
  if (levelId === 'band5' || levelId === 'band6') return 'sonus-drenched-border-charcoal';
  if (levelId === 'n5') return 'sonus-drenched-border-green';
  if (levelId === 'n4') return 'sonus-drenched-border-ocean';
  return 'border-transparent';
}

type BandData = {
  band: number;
  units:
    | Array<{ id?: string; words?: Array<{ id: string }> }>
    | Record<string, { words?: Array<{ id: string }> }>;
};

function resolveBandDataId(bandId: string) {
  if (bandId === 'band7' || bandId === 'band8' || bandId === 'band9' || bandId === 'advanced') {
    return 'band7-9';
  }
  return bandId;
}

function resolveUnitIdForBand(bandId: string, unitId: string) {
  if (bandId === 'band2' && unitId === 'b2-directions') {
    return 'b2-places';
  }
  return unitId;
}

function getBandUnitsMap(bandData: BandData) {
  const next = new Map<string, number>();
  if (Array.isArray(bandData.units)) {
    for (const unit of bandData.units) {
      if (!unit?.id) continue;
      next.set(unit.id, (unit.words || []).length);
    }
    return next;
  }
  for (const [unitId, unit] of Object.entries(bandData.units || {})) {
    next.set(unitId, (unit?.words || []).length);
  }
  return next;
}

// Legacy band track levels
const bandTrackLevels: LessonBand[] = [
  {
    id: 'intro',
    name: 'Introduction',
    description: 'Start here',
    color: 'bg-gray-400',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'band1',
    name: 'Elementary I',
    description: 'Foundations · Everyday Use',
    color: 'bg-[var(--sonus-palette-green)]',
    band: 1,
    title: 'Elementary I',
    subtitle: 'Foundations · Everyday Use',
    wordCount: 500,
    wordRange: '0–500',
    units: []
  },
  {
    id: 'band2',
    name: 'Elementary II',
    description: 'Expanded Daily Life',
    color: 'bg-[var(--sonus-palette-green)]',
    band: 2,
    title: 'Elementary II',
    subtitle: 'Expanded Daily Life',
    wordCount: 1272,
    wordRange: '500–1272',
    units: []
  },
  {
    id: 'band3',
    name: 'Pre‑Intermediate',
    description: 'Simple Narratives',
    color: 'bg-[var(--sonus-palette-blue)]',
    band: 3,
    title: 'Pre‑Intermediate',
    subtitle: 'Simple Narratives',
    wordCount: 2245,
    wordRange: '1272–2245',
    units: []
  },
  {
    id: 'band4',
    name: 'Intermediate I',
    description: 'Intermediate Topics',
    color: 'bg-[var(--sonus-palette-blue)]',
    band: 4,
    title: 'Intermediate I',
    subtitle: 'Intermediate Topics',
    wordCount: 3245,
    wordRange: '2245–3245',
    units: []
  },
  {
    id: 'band5',
    name: 'Intermediate II',
    description: 'Broader Expression',
    color: 'bg-purple-500',
    band: 5,
    title: 'Intermediate II',
    subtitle: 'Broader Expression',
    wordCount: 4316,
    wordRange: '3245–4316',
    units: []
  },
  {
    id: 'band6',
    name: 'Upper‑Intermediate',
    description: 'Abstract Themes',
    color: 'bg-purple-600',
    band: 6,
    title: 'Upper‑Intermediate',
    subtitle: 'Abstract Themes',
    wordCount: 5456,
    wordRange: '4316–5456',
    units: []
  },
  {
    id: 'band7',
    name: 'Advanced I',
    description: 'Complex topics · High range',
    color: 'bg-red-500',
    band: 7,
    title: 'Advanced I',
    subtitle: 'Complex topics · High range',
    wordCount: 7356,
    wordRange: '5456–7356',
    units: []
  },
  {
    id: 'band8',
    name: 'Advanced II',
    description: 'Formal language · Precision',
    color: 'bg-slate-500',
    band: 8,
    title: 'Advanced II',
    subtitle: 'Formal language · Precision',
    wordCount: 9256,
    wordRange: '7356–9256',
    units: []
  },
  {
    id: 'band9',
    name: 'Advanced III',
    description: 'Near-native range · Depth',
    color: 'bg-slate-900',
    band: 9,
    title: 'Advanced III',
    subtitle: 'Near-native range · Depth',
    wordCount: 11092,
    wordRange: '9256–11092',
    units: []
  },
];

// JLPT Levels for Japanese
const japaneseLevels: LessonBand[] = [
  {
    id: 'intro', name: 'Introduction', description: 'Start here', color: 'bg-gray-400',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'n5', name: 'N5', description: 'Basic', color: 'bg-[var(--sonus-palette-green)]',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'n4', name: 'N4', description: 'Elementary', color: 'bg-[var(--sonus-palette-blue)]',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'n3', name: 'N3', description: 'Intermediate', color: 'bg-yellow-500',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'n2', name: 'N2', description: 'Upper Intermediate', color: 'bg-orange-500',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'n1', name: 'N1', description: 'Advanced', color: 'bg-red-500',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
];

// TOPIK Levels for Korean
const koreanLevels: LessonBand[] = [
  {
    id: 'intro', name: 'Introduction', description: 'Start here', color: 'bg-gray-400',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'topik1-1', name: 'TOPIK I Level 1', description: 'Beginner', color: 'bg-[var(--sonus-palette-green)]',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'topik1-2', name: 'TOPIK I Level 2', description: 'Elementary', color: 'bg-[var(--sonus-palette-green)]',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'topik2-3', name: 'TOPIK II Level 3', description: 'Intermediate', color: 'bg-[var(--sonus-palette-blue)]',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'topik2-4', name: 'TOPIK II Level 4', description: 'Upper Intermediate', color: 'bg-[var(--sonus-palette-blue)]',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'topik2-5', name: 'TOPIK II Level 5', description: 'Advanced', color: 'bg-purple-500',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'topik2-6', name: 'TOPIK II Level 6', description: 'Proficient', color: 'bg-red-500',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
];

// CEFR Levels for French
const frenchLevels: LessonBand[] = [
  {
    id: 'intro', name: 'Introduction', description: 'Start here', color: 'bg-gray-400',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'a1', name: 'A1', description: 'Beginner', color: 'bg-[var(--sonus-palette-green)]',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'a2', name: 'A2', description: 'Elementary', color: 'bg-[var(--sonus-palette-green)]',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'b1', name: 'B1', description: 'Intermediate', color: 'bg-[var(--sonus-palette-blue)]',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'b2', name: 'B2', description: 'Upper Intermediate', color: 'bg-[var(--sonus-palette-blue)]',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'c1', name: 'C1', description: 'Advanced', color: 'bg-purple-500',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'c2', name: 'C2', description: 'Proficient', color: 'bg-red-500',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
];


interface LevelCardProps {
  level: LessonBand;
  isUnlocked: boolean;
  isCompleted: boolean;
  isDrenched?: boolean;
  elementId?: string;
  onSelect: (level: LessonBand) => void;
  onSelectSection?: (level: LessonBand, sectionId: 'core' | 'expansion' | 'integration') => void;
  sectionLinks?: Array<{
    id: 'core' | 'expansion' | 'integration';
    label: string;
    elementId?: string;
    unlocked?: boolean;
  }>;
  highlightSectionLinks?: boolean;
  // Optional overrides to support the legacy band-track view
  badgeLabel?: string;
  topRightLabel?: string;
  showChevronWhenUnlocked?: boolean;
  headerKicker?: string;
  bodyText?: string;
  accentOverride?: AccentKey;
  showBadge?: boolean;
  showStats?: boolean;
  showCta?: boolean;
  centerContent?: boolean;
  cardClickable?: boolean;
}

function LevelCard({
  level,
  isUnlocked,
  isCompleted,
  isDrenched = false,
  elementId,
  onSelect,
  onSelectSection,
  sectionLinks = [],
  highlightSectionLinks = false,
  badgeLabel,
  topRightLabel,
  showChevronWhenUnlocked = true,
  headerKicker,
  bodyText,
  accentOverride,
  showBadge = true,
  showStats = true,
  showCta = true,
  centerContent = false,
  cardClickable = true,
}: LevelCardProps) {
  const a = ACCENT[accentOverride ?? 'navy'];
  const isLocked = !isUnlocked;
  const lockedTone = 'text-[#6B7280]';
  const lockedSoftTone = 'text-[#9CA3AF]';
  const allUnits = getUnitsForBand(level.id);
  const unitCount = allUnits.filter(
    (unit) => !/listening$/i.test(unit.id) && !/speaking$/i.test(unit.id)
  ).length;

  const effectiveBadge = badgeLabel ?? (level.id === 'intro' ? 'Intro' : 'Level');
  const effectiveTopRight =
    topRightLabel ??
    (isCompleted
      ? '✓ Completed'
      : !isUnlocked
        ? 'Locked'
        : '');
  const ctaLabel =
    effectiveBadge.toLowerCase().startsWith('band') || effectiveBadge.toLowerCase() === 'track'
      ? 'Open →'
      : 'Start learning →';
  const isSectionCard = sectionLinks.length > 0;
  const drenchedBorderClass = getDrenchedBorderClass(level.id);
  const cardBaseClass = `w-full border rounded-3xl ${isSectionCard ? 'min-h-[228px] sm:min-h-[212px] p-5' : 'min-h-[170px] p-5'} text-center sm:text-left shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)] transition-all duration-200`;
  const cardToneClass = isDrenched && isUnlocked
    ? `${
      level.id === 'intro'
        ? 'bg-[var(--sonus-palette-charcoal)]'
        : level.id === 'band1' || level.id === 'band2'
          ? 'bg-[var(--sonus-palette-green)]'
          : level.id === 'band3' || level.id === 'band4'
            ? 'bg-[var(--sonus-palette-blue)]'
            : level.id === 'band5' || level.id === 'band6'
              ? 'bg-[var(--sonus-palette-charcoal)]'
              : 'bg-[var(--sonus-palette-rust)]'
    } ${drenchedBorderClass} text-white`
    : isLocked
      ? 'bg-[#F3F4F6] border-[#D1D5DB]'
      : `bg-white ${a.leftBorder}`;
  const cardMotionClass = cardClickable
    ? (isUnlocked ? `hover:-translate-y-0.5 ${a.hoverShadow} active:translate-y-0` : 'cursor-not-allowed')
    : '';
  const cardClassName = `${cardBaseClass} ${cardToneClass} ${cardMotionClass}`.trim();
  const content = isSectionCard ? (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0 w-full text-center sm:text-left">
          <h3 className={`main-font text-[2.15rem] sm:text-[2.4rem] leading-none font-normal ${isDrenched ? 'text-white' : isLocked ? lockedTone : a.badgeText}`}>
            {level.title || level.name}
          </h3>
          <p className={`mt-2 text-[1.08rem] text-center sm:text-left ${isDrenched ? 'text-white/90' : isLocked ? lockedTone : 'text-text-med'}`}>
            {level.subtitle || level.description}
          </p>
          <p className={`mt-3 text-[11px] leading-relaxed font-mono tracking-[0.14em] text-center sm:text-left ${isDrenched ? 'text-white/75' : isLocked ? lockedTone : 'text-text-med'}`}>
            {bodyText || 'Structured lessons and practice built on official proficiency frameworks.'}
          </p>
        </div>
        {effectiveTopRight ? (
          <div
            className={`shrink-0 hidden sm:block font-mono uppercase tracking-wider ${
              isDrenched
                ? 'text-white/85'
                : isLocked
                  ? lockedSoftTone
                  : isCompleted
                    ? 'text-[var(--sonus-palette-green)]'
                    : 'text-text-light'
            }`}
          >
            {effectiveTopRight}
          </div>
        ) : null}
      </div>

      {effectiveTopRight ? (
        <div
          className={`mt-2 sm:hidden text-[11px] text-center font-mono uppercase tracking-wider ${
            isDrenched
              ? 'text-white/85'
              : isLocked
                ? lockedSoftTone
                : isCompleted
                  ? 'text-[var(--sonus-palette-green)]'
                  : 'text-text-light'
          }`}
        >
          {effectiveTopRight}
        </div>
      ) : null}

      <div className="mt-4 sm:mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {sectionLinks.map((section, sectionIndex) => (
          <button
            key={section.id}
            id={section.elementId}
            type="button"
            disabled={!section.unlocked}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!section.unlocked) return;
              onSelectSection?.(level, section.id);
            }}
            className={`h-11 rounded-xl border px-3 text-center font-mono uppercase tracking-[0.2em] transition-colors ${
              !section.unlocked
                ? 'border-[#D1D5DB] text-[#9CA3AF] bg-[#F3F4F6] cursor-not-allowed'
                : isDrenched
                  ? 'border-white/45 text-white bg-white/5 hover:bg-white/12'
                  : 'border-[var(--sonus-palette-charcoal)]/24 text-[var(--sonus-palette-charcoal)] bg-white hover:bg-[var(--sonus-palette-charcoal)]/6'
            } ${
              highlightSectionLinks
                ? 'ring-1 ring-[rgba(19,87,119,0.26)] sonus-tour-levels-pulse bg-[rgba(19,87,119,0.02)]'
                : ''
            }`}
            style={
              highlightSectionLinks
                ? { animationDelay: `${sectionIndex * 110}ms` }
                : undefined
            }
          >
            {section.label}
          </button>
        ))}
      </div>
    </div>
  ) : (
    <div className="w-full">
      <div className="flex items-start justify-between gap-4">
        {showBadge ? (
          <span
            className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono ${
              isDrenched ? 'bg-white/20 text-white' : isLocked ? 'bg-[#F3F4F6] text-[#6B7280]' : `${a.badgeBg} ${a.badgeText}`
            }`}
          >
            {effectiveBadge}
          </span>
        ) : (
          <span />
        )}

        {effectiveTopRight ? (
          <div
            className={`font-mono uppercase tracking-wider ${
              isDrenched
                ? 'text-white/85'
                : isLocked
                  ? lockedSoftTone
                  : isCompleted
                    ? 'text-[var(--sonus-palette-green)]'
                    : 'text-text-light'
            }`}
          >
            {effectiveTopRight}
          </div>
        ) : showChevronWhenUnlocked ? (
          <ChevronRight className="w-5 h-5 text-text-light" />
        ) : null}
      </div>

      <div className="mt-5">
        {headerKicker && (
          <p className={`font-mono tracking-wide mb-1 ${isLocked ? lockedSoftTone : 'text-text-med'}`}>
            {headerKicker}
          </p>
        )}

        <h3 className={`main-font text-[2rem] leading-tight font-normal mb-1 ${isDrenched ? 'text-white' : isLocked ? lockedTone : a.badgeText}`}>
          {level.title || level.name}
        </h3>

        <p className={`text-[1.05rem] mb-4 ${isDrenched ? 'text-white/90' : isLocked ? lockedTone : 'text-text-med'}`}>
          {level.subtitle || level.description}
        </p>

        {showStats && (
          <div className={`flex gap-10 text-sm font-mono mb-4 ${isDrenched ? 'text-white' : isLocked ? lockedTone : 'text-text-dark'} ${centerContent ? 'justify-center' : ''}`}>
            <div>
              <span className="text-lg font-semibold">{level.wordRange || '—'}</span>
              <div className={`text-[11px] tracking-wide ${isDrenched ? 'text-white/75' : isLocked ? lockedSoftTone : 'text-text-med'}`}>Vocabulary</div>
            </div>
            <div>
              <span className="text-lg font-semibold">{unitCount}</span>
              <div className={`text-[11px] tracking-wide ${isDrenched ? 'text-white/75' : isLocked ? lockedSoftTone : 'text-text-med'}`}>Units</div>
            </div>
          </div>
        )}

        <p className={`text-[11px] leading-relaxed font-mono tracking-wide mb-4 ${isDrenched ? 'text-white/80' : isLocked ? lockedTone : 'text-text-med'}`}>
          {bodyText ||
            'Structured lessons and practice built on official proficiency frameworks.'}
        </p>

        {isUnlocked && showCta && (
          <div className={`${isDrenched ? 'text-white' : a.ctaText} text-sm font-semibold tracking-wide`}>{ctaLabel}</div>
        )}
      </div>
    </div>
  );

  if (!cardClickable) {
    return (
      <div id={elementId} className={cardClassName}>
        {content}
      </div>
    );
  }

  return (
    <button
      id={elementId}
      onClick={() => isUnlocked && onSelect(level)}
      disabled={!isUnlocked}
      className={cardClassName}
    >
      {content}
    </button>
  );
}

interface LevelSelectProps {
  onSelectLevel: (
    level: LessonBand,
    options?: { sectionId?: 'core' | 'expansion' | 'integration' }
  ) => void;
  onOpenFoundations?: () => void;
  onOpenLanguageIntro?: () => void;
  onGoHome: () => void;
  onOpenProfile: () => void;
  walkthroughHighlightMainPath?: boolean;
  walkthroughHighlightLevels?: boolean;
}

export default function LevelSelect({
  onSelectLevel,
  onOpenFoundations,
  onOpenLanguageIntro,
  onGoHome,
  onOpenProfile,
  walkthroughHighlightMainPath = false,
  walkthroughHighlightLevels = false,
}: LevelSelectProps) {
  const { state } = useApp();
  const normalizedLanguageId = normalizeLanguageId(state.selectedLanguage);
  const legacyTrackEnabled = false;
  const [searchParams, setSearchParams] = useSearchParams();
  const [bandQuizRequirementKeys, setBandQuizRequirementKeys] = useState<Record<string, string[]>>({});
  const [sectionUnlockRulesByLevel, setSectionUnlockRulesByLevel] = useState<Record<string, {
    coreLastLessonKey: string | null;
    expansionLastLessonKey: string | null;
  }>>({});

  const isInstructionalComplete = (quizScore: number | null | undefined, speakScore: number | null | undefined) =>
    (quizScore ?? 0) >= QUIZ_PASS_PERCENT && (speakScore ?? 0) >= SPEAK_PASS_PERCENT;
  const hasLessonUnlockCredit = (status: { completed?: boolean; quizScore?: number | null; speakScore?: number | null } | undefined) =>
    Boolean(status?.completed || isInstructionalComplete(status?.quizScore, status?.speakScore));

  const getLevelsForLanguage = () => {
    switch (normalizedLanguageId) {
      case 'ja':
        return japaneseLevels;
      case 'kr':
        return koreanLevels;
      case 'fr':
        return frenchLevels;
      default:
        return japaneseLevels;
    }
  };

  const getLanguageName = () => {
    switch (normalizedLanguageId) {
      case 'ja':
        return 'Japanese';
      case 'kr':
        return 'Korean';
      case 'fr':
        return 'French';
      default:
        return 'Language';
    }
  };

  const levels = getLevelsForLanguage();
  const isJapaneseLanguage = normalizedLanguageId === 'ja';
  const advancedTrackLevel: LessonBand = {
    id: 'advanced',
    band: 7,
    name: 'Advanced',
    title: 'Advanced',
    subtitle: 'Levels 7–9 · Mastery',
    wordCount: 0,
    wordRange: 'Level 7–9',
    color: 'bg-red-500',
    description: 'Macro-unit track for Levels 7-9',
    units: [],
  };

  const activeTier = legacyTrackEnabled ? searchParams.get('tier') : null;

  const setTier = (tier: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (tier) {
      next.set('tier', tier);
    } else {
      next.delete('tier');
    }
    setSearchParams(next);
  };

  const tiers = legacyTrackEnabled
    ? [
        {
          id: 'beginner',
          title: 'Beginner',
          subtitle: 'Levels 1–3 · Core Foundations',
          style: { rail: 'bg-[var(--sonus-palette-green)]', accent: 'green' as const },
          summary:
            'Tone control, high-frequency grammar, and everyday communication for a strong foundation.',
          isAvailable: true,
          levels: levels.filter(l =>
            ['band1', 'band2', 'band3'].includes(l.id)
          )
        },
        {
          id: 'intermediate',
          title: 'Intermediate',
          subtitle: 'Levels 4–6 · Functional Fluency',
          style: { rail: 'bg-[var(--sonus-palette-blue)]', accent: 'blue' as const },
          summary:
            'Longer conversations, wider topics, and more flexible sentence patterns for real-world fluency.',
          isAvailable: true,
          levels: levels.filter(l =>
            ['band4', 'band5', 'band6'].includes(l.id)
          )
        },
        {
          id: 'advanced',
          title: 'Advanced',
          subtitle: 'Levels 7–9 · Mastery',
          style: { rail: 'bg-red-500', accent: 'red' as const },
          summary:
            'High-register vocabulary, abstract topics, nuanced expression, and advanced comprehension/speaking precision.',
          isAvailable: false,
          levels: levels.filter(l =>
            ['band7', 'band8', 'band9'].includes(l.id)
          )
        }
      ]
    : [];
  const activeTierConfig = legacyTrackEnabled && activeTier
    ? tiers.find((tier) => tier.id === activeTier) ?? null
    : null;
  const firstNonIntroLevelId = levels.find((level) => level.id !== 'intro')?.id || levels[0]?.id || null;
  const mainPathStarterLevelId =
    normalizedLanguageId === 'ja'
      ? 'n5'
      : normalizedLanguageId === 'kr'
        ? 'topik1-1'
        : normalizedLanguageId === 'fr'
          ? 'a1'
          : firstNonIntroLevelId;

  useEffect(() => {
    if (!legacyTrackEnabled) return;
    let cancelled = false;

    const bandLevels = bandTrackLevels.filter((level) => /^band\d+$/i.test(level.id));
    void Promise.all(
      bandLevels.map(async (level) => {
        try {
          const response = await fetch(`/data/ja/${resolveBandDataId(level.id)}.json`, { cache: 'no-store' });
          if (!response.ok) return [level.id, []] as const;
          const bandData = (await response.json()) as BandData;
          const unitWordsById = getBandUnitsMap(bandData);
          const quizKeys: string[] = [];
          for (const unit of getUnitsForBand(level.id, bandData)) {
            if (isPracticeUnitId(unit.id)) continue;
            if (isCheckpointUnitId(unit.id)) {
              quizKeys.push(makeLessonKey(level.id, unit.id, 0));
              continue;
            }
            const resolvedUnitId = resolveUnitIdForBand(level.id, unit.id);
            const lessonCount = getLessonRanges(unitWordsById.get(resolvedUnitId) || 0, 10).length;
            for (let lessonIdx = 0; lessonIdx < lessonCount; lessonIdx += 1) {
              quizKeys.push(makeLessonKey(level.id, resolvedUnitId, lessonIdx));
            }
          }
          return [level.id, quizKeys] as const;
        } catch {
          return [level.id, []] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setBandQuizRequirementKeys(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [legacyTrackEnabled, normalizedLanguageId]);

  useEffect(() => {
    if (!isJapaneseLanguage) return;
    let cancelled = false;
    void (async () => {
      const levelIds = levels
        .filter((level) => /^n[1-5]$/i.test(level.id))
        .map((level) => level.id);
      const entries = await Promise.all(
        levelIds.map(async (levelId) => {
          try {
            const response = await fetch(`/data/ja/${levelId}.json`, { cache: 'no-store' });
            if (!response.ok) return [levelId, { coreLastLessonKey: null, expansionLastLessonKey: null }] as const;
            const payload = (await response.json()) as {
              sections?: Array<{ id?: string; units?: Array<{ id?: string; words?: unknown[] }> }>;
            };
            const sections = Array.isArray(payload.sections) ? payload.sections : [];
            const findSection = (id: 'core' | 'expansion') => sections.find((section) => (section.id || '').toLowerCase() === id);
            const toLastLessonKey = (section?: { units?: Array<{ id?: string; words?: unknown[] }> }) => {
              const units = Array.isArray(section?.units) ? section!.units : [];
              const lastUnit = [...units].reverse().find((unit) => (unit?.id || '').trim()) || null;
              if (!lastUnit?.id) return null;
              const wordCount = Array.isArray(lastUnit.words) ? lastUnit.words.length : 0;
              const lessonCount = getLessonRanges(wordCount, 10).length;
              if (lessonCount <= 0) return null;
              return makeLessonKey(levelId, lastUnit.id, lessonCount - 1);
            };
            return [levelId, {
              coreLastLessonKey: toLastLessonKey(findSection('core')),
              expansionLastLessonKey: toLastLessonKey(findSection('expansion')),
            }] as const;
          } catch {
            return [levelId, { coreLastLessonKey: null, expansionLastLessonKey: null }] as const;
          }
        })
      );
      if (cancelled) return;
      setSectionUnlockRulesByLevel(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [isJapaneseLanguage, levels]);

  const sectionUnlockStateByLevel = (() => {
    const next: Record<string, { core: boolean; expansion: boolean; integration: boolean }> = {};
    for (const level of levels) {
      if (!/^n[1-5]$/i.test(level.id)) continue;
      const rules = sectionUnlockRulesByLevel[level.id];
      const coreComplete = rules?.coreLastLessonKey
        ? hasLessonUnlockCredit(state.lessonProgress[rules.coreLastLessonKey])
        : false;
      const expansionComplete = rules?.expansionLastLessonKey
        ? hasLessonUnlockCredit(state.lessonProgress[rules.expansionLastLessonKey])
        : false;
      next[level.id] = {
        core: true,
        expansion: coreComplete,
        integration: expansionComplete,
      };
    }
    return next;
  })();

  const bandQuizCompleteById = useMemo(() => {
    const next: Record<string, boolean> = {};
    for (const [bandId, keys] of Object.entries(bandQuizRequirementKeys)) {
      next[bandId] =
        keys.length > 0 &&
        keys.every((key) => (state.lessonProgress[key]?.quizScore ?? 0) >= QUIZ_PASS_PERCENT);
    }
    return next;
  }, [bandQuizRequirementKeys, state.lessonProgress]);

  return (
    <div className="min-h-screen page-shell px-6 with-bottom-nav">
      <GlassHeader
        title={getLanguageName()}
        compactStandaloneTitle={false}
        hideLogoOnMobile
      />

      {/* Tier or Level Cards */}
      <div className="space-y-4">
        {legacyTrackEnabled && activeTierConfig === null && (
          <>
            <button
              onClick={onOpenFoundations}
              className="relative w-full bg-[var(--sonus-palette-charcoal)] border sonus-drenched-border-charcoal rounded-3xl min-h-[132px] p-5 text-center text-white shadow-[0_12px_28px_-22px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              <ChevronRight className="absolute top-4 right-4 w-5 h-5 text-white/80" />
              <div className="w-full h-full flex flex-col items-center justify-center">
                <div className="flex items-center justify-center gap-4">
                  <span
                    className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono bg-white/15 text-white"
                  >
                    Start Here
                  </span>
                </div>

                <div className="mt-3">
                  <h3 className="main-font text-[1.75rem] leading-tight font-normal mb-1 text-white">
                    Sound + Script Lab
                  </h3>
                  <p className="text-[0.98rem] text-white/85">
                    Tones, transliteration, and character pattern training
                  </p>
                </div>
              </div>
            </button>

            {tiers.map((tier, index) => {
              const a = ACCENT[CARD_ACCENT_ORDER[index % CARD_ACCENT_ORDER.length]];
              const isLocked = !tier.isAvailable;
              const isTierDrenched =
                tier.levels.length > 0 &&
                tier.levels.every((level) => Boolean(bandQuizCompleteById[level.id]));
              return (
              <button
                key={tier.id}
                id={walkthroughHighlightMainPath && index === 0 ? 'tour-main-first-path-card' : undefined}
                onClick={() => {
                  if (isLocked) return;
                  if (tier.id === 'advanced') {
                    onSelectLevel(advancedTrackLevel);
                    return;
                  }
                  setTier(tier.id);
                }}
                disabled={isLocked}
                className={`w-full border rounded-3xl min-h-[170px] p-5 text-left shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)] transition-all duration-200 ${
                  isTierDrenched && !isLocked
                    ? `${index === 0 ? 'bg-[var(--sonus-palette-green)] sonus-drenched-border-green' : index === 1 ? 'bg-[var(--sonus-palette-blue)] sonus-drenched-border-ocean' : 'bg-[var(--sonus-palette-rust)] border-transparent'} text-white`
                    : isLocked
                      ? 'bg-[#F3F4F6] border-[#D1D5DB]'
                      : `bg-white ${a.leftBorder}`
                } ${
                  isLocked
                    ? 'cursor-not-allowed'
                    : `hover:-translate-y-0.5 ${a.hoverShadow} active:translate-y-0`
                }`}
              >
                <div className="w-full">
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono ${
                        isTierDrenched
                          ? 'bg-white/20 text-white'
                          : isLocked
                            ? 'bg-[#F3F4F6] text-[#6B7280]'
                            : `${a.badgeBg} ${a.badgeText}`
                      }`}
                    >
                      Track
                    </span>
                    {isLocked ? (
                      <span className="font-mono uppercase tracking-wider text-text-light">
                        Coming Soon
                      </span>
                    ) : (
                      <ChevronRight className="w-5 h-5 text-text-light" />
                    )}
                  </div>

                  <div className="mt-5">
                    <h3 className={`main-font text-[2rem] leading-tight font-normal mb-1 ${isTierDrenched ? 'text-white' : isLocked ? 'text-[#6B7280]' : a.badgeText}`}>
                      {tier.title}
                    </h3>
                    <p className={`text-[1.05rem] mb-4 ${isTierDrenched ? 'text-white/90' : isLocked ? 'text-[#6B7280]' : 'text-text-med'}`}>
                      {tier.subtitle}
                    </p>

                    <div className={`flex gap-10 text-sm font-mono mb-4 ${isTierDrenched ? 'text-white' : isLocked ? 'text-[#6B7280]' : 'text-text-dark'}`}>
                      <div>
                        <span className="text-lg font-semibold">{tier.levels.length}</span>
                        <div className={`text-[11px] tracking-wide ${isTierDrenched ? 'text-white/75' : isLocked ? 'text-[#9CA3AF]' : 'text-text-med'}`}>
                          Levels
                        </div>
                      </div>
                    </div>

                    <p className={`text-[11px] leading-relaxed font-mono tracking-wide mb-4 ${isTierDrenched ? 'text-white/80' : isLocked ? 'text-[#6B7280]' : 'text-text-med'}`}>
                      {tier.summary}
                    </p>

                    {isLocked && (
                      <div className="text-sm font-semibold tracking-wide text-[#9CA3AF]">
                        Releasing soon
                      </div>
                    )}
                  </div>
                </div>
              </button>
              );
            })}
          </>
        )}

        {legacyTrackEnabled && activeTierConfig !== null && (
          <>
            {activeTierConfig.levels.map((level, index) => {
                const isLegacyBandReleased =
                  !legacyTrackEnabled || RELEASED_LEGACY_BAND_LEVELS.has(level.id);
                const isReleased = isLegacyBandReleased && isReleasedTrackLevel(level.id);
                const isUnlocked = isReleased && state.unlockedLevels.includes(level.id);
                const isQuizCompleted = Boolean(bandQuizCompleteById[level.id]);
                const isCompleted = state.completedLevels.includes(level.id) || isQuizCompleted;
                return (
                  <LevelCard
                    key={level.id}
                    level={level}
                    isUnlocked={isUnlocked}
                    isCompleted={isCompleted}
                    isDrenched={isQuizCompleted}
                    onSelect={onSelectLevel}
                    badgeLabel={`Level ${level.band}`}
                    showBadge={activeTier !== 'advanced'}
                    headerKicker={undefined}
                    bodyText={
                      !isReleased
                        ? 'This level is configured and visible now, and will open soon.'
                        : !isUnlocked
                        ? 'Unlock this level by reaching at least 90% completion in the previous level.'
                        : level.description ||
                          'Core pronunciation, high‑frequency vocabulary, and functional progression within this band.'
                    }
                    showChevronWhenUnlocked={true}
                    topRightLabel={!isReleased ? 'Coming Soon' : !isUnlocked ? 'Locked' : undefined}
                    accentOverride={CARD_ACCENT_ORDER[index % CARD_ACCENT_ORDER.length]}
                    elementId={walkthroughHighlightLevels && index === 0 ? 'tour-levels-first-card' : undefined}
                  />
                );
              })}
          </>
        )}

        {!legacyTrackEnabled &&
          levels.map((level, index) => {
            const isReleased = level.id === 'intro' || isReleasedTrackLevel(level.id);
            const isUnlocked = isReleased && (state.unlockedLevels.includes(level.id) || level.id === 'intro');
            const isCompleted = state.completedLevels.includes(level.id);
            return (
              <LevelCard
                key={level.id}
                elementId={
                  level.id === 'n5'
                    ? (
                      walkthroughHighlightMainPath
                        ? 'tour-main-first-path-card'
                        : walkthroughHighlightLevels
                          ? 'tour-levels-first-card'
                          : undefined
                    )
                    : (
                      mainPathStarterLevelId && level.id === mainPathStarterLevelId
                        ? (
                          walkthroughHighlightMainPath
                              ? 'tour-main-first-path-card'
                              : undefined
                        )
                        : undefined
                    )
                }
                level={level}
                isUnlocked={isUnlocked}
                isCompleted={isCompleted}
                onSelect={(selectedLevel) => {
                  if (isJapaneseLanguage && selectedLevel.id === 'intro') {
                    onOpenLanguageIntro?.();
                    return;
                  }
                  onSelectLevel(selectedLevel);
                }}
                badgeLabel={level.id === 'intro' ? 'Intro' : 'Level'}
                showChevronWhenUnlocked={level.id === 'intro'}
                showBadge={level.id === 'intro'}
                showStats={false}
                showCta={false}
                centerContent={isJapaneseLanguage && level.id === 'intro'}
                isDrenched={isJapaneseLanguage && level.id === 'intro'}
                cardClickable={!(isJapaneseLanguage && /^n[1-5]$/i.test(level.id))}
                sectionLinks={
                  isJapaneseLanguage && /^n[1-5]$/i.test(level.id)
                    ? [
                        {
                          id: 'core',
                          label: 'Core',
                          unlocked: isUnlocked,
                        },
                        {
                          id: 'expansion',
                          label: 'Expansion',
                          unlocked: isUnlocked && Boolean(sectionUnlockStateByLevel[level.id]?.expansion),
                        },
                        {
                          id: 'integration',
                          label: 'Integration',
                          unlocked: isUnlocked && Boolean(sectionUnlockStateByLevel[level.id]?.integration),
                        },
                      ]
                    : []
                }
                highlightSectionLinks={level.id === 'n5' && (walkthroughHighlightMainPath || walkthroughHighlightLevels)}
                onSelectSection={(selectedLevel, sectionId) => {
                  onSelectLevel(selectedLevel, { sectionId });
                }}
                bodyText={
                  isJapaneseLanguage
                    ? (level.id === 'intro'
                      ? 'Open orientation cards before JLPT study.'
                      : level.id === 'n5'
                        ? 'Core survival Japanese'
                        : level.id === 'n4'
                          ? 'Daily life communication'
                          : level.id === 'n3'
                            ? 'Broader real-world topics'
                            : level.id === 'n2'
                              ? 'Advanced reading and listening'
                              : level.id === 'n1'
                                ? 'Nuance and high-level Japanese'
                                : '')
                    : 'Curriculum is in production for this language.'
                }
                topRightLabel={isReleased ? (isUnlocked ? undefined : 'Locked') : 'Coming Soon'}
                accentOverride={CARD_ACCENT_ORDER[index % CARD_ACCENT_ORDER.length]}
              />
            );
          })}
      </div>

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
