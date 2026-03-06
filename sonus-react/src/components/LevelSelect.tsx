import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import type { LessonBand } from '../types/lesson.types';
import { ChevronRight } from 'lucide-react';
import { getUnitsForBand, isCheckpointUnitId, isPracticeUnitId } from '../data/unitMetadata';
import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';
import CollapsibleBreadcrumbs from './CollapsibleBreadcrumbs';
import { getLessonRanges } from '../lib/lessonChunks';
import { makeLessonKey } from '../lib/lessonProgress';
import { QUIZ_PASS_PERCENT } from '../lib/passCriteria';
import { normalizeLanguageId } from '../lib/languageRuntime';
import { isReleasedTrackLevel } from '../lib/bandIds';

// Accent styling helpers
const ACCENT = {
  gray: { badgeBg: 'bg-gray-100/80', badgeText: 'text-gray-700', ctaText: 'text-gray-700', hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(107,114,128,0.18)]', leftBorder: 'border-gray-400/55' },
  navy: { badgeBg: 'bg-[rgba(24,110,149,0.12)]', badgeText: 'text-[#186E95]', ctaText: 'text-[#186E95]', hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(24,110,149,0.28)]', leftBorder: 'border-[#186E95]/55' },
  sage: { badgeBg: 'bg-[rgba(62,86,72,0.12)]', badgeText: 'text-[#3E5648]', ctaText: 'text-[#3E5648]', hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(62,86,72,0.26)]', leftBorder: 'border-[#3E5648]/55' },
  graphite: { badgeBg: 'bg-[rgba(31,42,55,0.10)]', badgeText: 'text-[#1F2A37]', ctaText: 'text-[#1F2A37]', hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(31,42,55,0.24)]', leftBorder: 'border-[#1F2A37]/55' },
  rust: { badgeBg: 'bg-[rgba(194,65,12,0.12)]', badgeText: 'text-[#C2410C]', ctaText: 'text-[#C2410C]', hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(194,65,12,0.30)]', leftBorder: 'border-[#C2410C]/55' },
} as const;

type AccentKey = keyof typeof ACCENT;
const CARD_ACCENT_ORDER: AccentKey[] = ['navy', 'sage', 'graphite', 'rust'];
const RELEASED_MANDARIN_BANDS = new Set(['band1', 'band2', 'band3', 'band4']);

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

// HSK 3.0 Bands for Chinese
const chineseLevels: LessonBand[] = [
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
    color: 'bg-[#3E5648]',
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
    color: 'bg-[#3E5648]',
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
    color: 'bg-[#186E95]',
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
    color: 'bg-[#186E95]',
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
    id: 'n5', name: 'N5', description: 'Basic', color: 'bg-[#3E5648]',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'n4', name: 'N4', description: 'Elementary', color: 'bg-[#186E95]',
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
    id: 'topik1-1', name: 'TOPIK I Level 1', description: 'Beginner', color: 'bg-[#3E5648]',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'topik1-2', name: 'TOPIK I Level 2', description: 'Elementary', color: 'bg-[#3E5648]',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'topik2-3', name: 'TOPIK II Level 3', description: 'Intermediate', color: 'bg-[#186E95]',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'topik2-4', name: 'TOPIK II Level 4', description: 'Upper Intermediate', color: 'bg-[#186E95]',
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
    id: 'a1', name: 'A1', description: 'Beginner', color: 'bg-[#3E5648]',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'a2', name: 'A2', description: 'Elementary', color: 'bg-[#3E5648]',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'b1', name: 'B1', description: 'Intermediate', color: 'bg-[#186E95]',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'b2', name: 'B2', description: 'Upper Intermediate', color: 'bg-[#186E95]',
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
  onSelect: (level: LessonBand) => void;
  // Optional overrides to support the Mandarin (band) view
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
}

function LevelCard({
  level,
  isUnlocked,
  isCompleted,
  isDrenched = false,
  onSelect,
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

  return (
    <button
      onClick={() => isUnlocked && onSelect(level)}
      disabled={!isUnlocked}
      className={`w-full border rounded-3xl min-h-[170px] p-5 ${centerContent ? 'text-center' : 'text-left'} shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)] transition-all duration-200 ${
        isDrenched && isUnlocked
          ? `${
            level.id === 'intro'
              ? 'bg-[#1F2A37]'
              : level.id === 'band1' || level.id === 'band2'
                ? 'bg-[#3E5648]'
                : level.id === 'band3' || level.id === 'band4'
                  ? 'bg-[#186E95]'
                  : level.id === 'band5' || level.id === 'band6'
                    ? 'bg-[#1F2A37]'
                    : 'bg-[#C2410C]'
          } border-transparent text-white`
          : isLocked
            ? 'bg-[#F3F4F6] border-[#D1D5DB]'
            : `bg-white ${a.leftBorder}`
      } ${
        isUnlocked
          ? `hover:-translate-y-0.5 ${a.hoverShadow} active:translate-y-0`
          : 'cursor-not-allowed'
      }`}
    >
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
              className={`text-xs font-mono uppercase tracking-wider ${
                isDrenched
                  ? 'text-white/85'
                  : isLocked
                    ? lockedSoftTone
                    : isCompleted
                      ? 'text-[#3E5648]'
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
            <p className={`text-[11px] font-mono tracking-wide mb-1 ${isLocked ? lockedSoftTone : 'text-text-med'}`}>
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
    </button>
  );
}

interface LevelSelectProps {
  onSelectLevel: (level: LessonBand) => void;
  onOpenFoundations?: () => void;
  onOpenLanguageIntro?: () => void;
  onGoHome: () => void;
  onOpenProfile: () => void;
}

export default function LevelSelect({
  onSelectLevel,
  onOpenFoundations,
  onOpenLanguageIntro,
  onGoHome,
  onOpenProfile,
}: LevelSelectProps) {
  const { state } = useApp();
  const normalizedLanguageId = normalizeLanguageId(state.selectedLanguage);
  const [searchParams, setSearchParams] = useSearchParams();
  const [bandQuizRequirementKeys, setBandQuizRequirementKeys] = useState<Record<string, string[]>>({});

  const getLevelsForLanguage = () => {
    switch (normalizedLanguageId) {
      case 'zh':
        return chineseLevels;
      case 'ja':
        return japaneseLevels;
      case 'kr':
        return koreanLevels;
      case 'fr':
        return frenchLevels;
      default:
        return chineseLevels;
    }
  };

  const getLanguageName = () => {
    switch (normalizedLanguageId) {
      case 'zh':
        return 'Mandarin';
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

  const activeTier = normalizedLanguageId === 'zh' ? searchParams.get('tier') : null;

  const setTier = (tier: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (tier) {
      next.set('tier', tier);
    } else {
      next.delete('tier');
    }
    setSearchParams(next);
  };

  const tiers = normalizedLanguageId === 'zh'
    ? [
        {
          id: 'beginner',
          title: 'Beginner',
          subtitle: 'Levels 1–3 · Core Foundations',
          style: { rail: 'bg-[#3E5648]', accent: 'green' as const },
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
          style: { rail: 'bg-[#186E95]', accent: 'blue' as const },
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
  const activeTierConfig = normalizedLanguageId === 'zh' && activeTier
    ? tiers.find((tier) => tier.id === activeTier) ?? null
    : null;

  useEffect(() => {
    if (normalizedLanguageId !== 'zh') return;
    let cancelled = false;

    const bandLevels = chineseLevels.filter((level) => /^band\d+$/i.test(level.id));
    void Promise.all(
      bandLevels.map(async (level) => {
        try {
          const response = await fetch(`/data/zh/${resolveBandDataId(level.id)}.json`, { cache: 'no-store' });
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
  }, [normalizedLanguageId]);

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
        subtitle={
          <div className="hidden lg:block">
            <CollapsibleBreadcrumbs
              items={
                normalizedLanguageId === 'zh' && activeTierConfig !== null
                  ? [
                      { label: 'Main', onClick: () => setTier(null) },
                      { label: 'Levels', current: true },
                      { label: 'Units', disabled: true },
                      { label: 'Lessons', disabled: true },
                    ]
                  : [
                      { label: 'Main', current: true },
                      { label: 'Levels', disabled: true },
                      { label: 'Units', disabled: true },
                      { label: 'Lessons', disabled: true },
                    ]
              }
            />
          </div>
        }
      />

      {/* Tier or Level Cards */}
      <div className="space-y-4">
        {normalizedLanguageId === 'zh' && activeTierConfig === null && (
          <>
            <button
              onClick={onOpenFoundations}
              className="relative w-full bg-[#1F2A37] border border-transparent rounded-3xl min-h-[132px] p-4 text-center text-white shadow-[0_12px_28px_-22px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
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
                    Tones, pinyin, and character pattern training
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
                    ? `${index === 0 ? 'bg-[#3E5648]' : index === 1 ? 'bg-[#186E95]' : 'bg-[#C2410C]'} border-transparent text-white`
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
                      <span className="text-xs font-mono uppercase tracking-wider text-text-light">
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

        {normalizedLanguageId === 'zh' && activeTierConfig !== null && (
          <>
            {activeTierConfig.levels.map((level, index) => {
                const isMandarinReleased =
                  normalizedLanguageId !== 'zh' || RELEASED_MANDARIN_BANDS.has(level.id);
                const isReleased = isMandarinReleased && isReleasedTrackLevel(level.id);
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
                  />
                );
              })}
          </>
        )}

        {normalizedLanguageId !== 'zh' &&
          levels.map((level, index) => {
            const isReleased = level.id === 'intro' || isReleasedTrackLevel(level.id);
            const isUnlocked = isReleased && (state.unlockedLevels.includes(level.id) || level.id === 'intro');
            const isCompleted = state.completedLevels.includes(level.id);
            return (
              <LevelCard
                key={level.id}
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
                showChevronWhenUnlocked={true}
                showStats={false}
                showCta={false}
                centerContent={isJapaneseLanguage && level.id === 'intro'}
                isDrenched={isJapaneseLanguage && level.id === 'intro'}
                bodyText={
                  isJapaneseLanguage
                    ? (!isReleased
                      ? 'This level is configured and visible now, and will open soon.'
                      : level.id === 'intro'
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
                    : 'Curriculum is in production for this language. Mandarin is currently available.'
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
