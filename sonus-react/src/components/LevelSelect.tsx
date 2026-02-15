import { useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import type { LessonBand } from '../types/lesson.types';
import { ChevronRight } from 'lucide-react';
import { getUnitsForBand } from '../data/unitMetadata';
import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';

// Accent styling helpers
const ACCENT = {
  gray: { badgeBg: 'bg-gray-100/80', badgeText: 'text-gray-700', ctaText: 'text-gray-700', hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(107,114,128,0.18)]', leftBorder: 'border-gray-400/55' },
  navy: { badgeBg: 'bg-[rgba(24,110,149,0.12)]', badgeText: 'text-[#186E95]', ctaText: 'text-[#186E95]', hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(24,110,149,0.28)]', leftBorder: 'border-[#186E95]/55' },
  sage: { badgeBg: 'bg-[rgba(62,86,72,0.12)]', badgeText: 'text-[#3E5648]', ctaText: 'text-[#3E5648]', hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(62,86,72,0.26)]', leftBorder: 'border-[#3E5648]/55' },
  graphite: { badgeBg: 'bg-[rgba(55,65,81,0.10)]', badgeText: 'text-[#374151]', ctaText: 'text-[#374151]', hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(55,65,81,0.24)]', leftBorder: 'border-[#374151]/55' },
  rust: { badgeBg: 'bg-[rgba(194,65,12,0.12)]', badgeText: 'text-[#C2410C]', ctaText: 'text-[#C2410C]', hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(194,65,12,0.30)]', leftBorder: 'border-[#C2410C]/55' },
} as const;

type AccentKey = keyof typeof ACCENT;
const CARD_ACCENT_ORDER: AccentKey[] = ['navy', 'sage', 'graphite', 'rust'];

function isMandarinBandComingSoon(levelId: string) {
  const match = /^band(\d+)$/i.exec(levelId);
  if (!match) return levelId === 'advanced';
  return Number(match[1]) > 2;
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
    id: 'n5', name: 'JLPT N5', description: 'Basic', color: 'bg-[#3E5648]',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'n4', name: 'JLPT N4', description: 'Elementary', color: 'bg-[#186E95]',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'n3', name: 'JLPT N3', description: 'Intermediate', color: 'bg-yellow-500',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'n2', name: 'JLPT N2', description: 'Upper Intermediate', color: 'bg-orange-500',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'n1', name: 'JLPT N1', description: 'Advanced', color: 'bg-red-500',
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
  onSelect: (level: LessonBand) => void;
  // Optional overrides to support the Mandarin (band) view
  badgeLabel?: string;
  topRightLabel?: string;
  showChevronWhenUnlocked?: boolean;
  headerKicker?: string;
  bodyText?: string;
  accentOverride?: AccentKey;
  showBadge?: boolean;
}

function LevelCard({
  level,
  isUnlocked,
  isCompleted,
  onSelect,
  badgeLabel,
  topRightLabel,
  showChevronWhenUnlocked = true,
  headerKicker,
  bodyText,
  accentOverride,
  showBadge = true,
}: LevelCardProps) {
  const a = ACCENT[accentOverride ?? 'navy'];
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
      className={`w-full bg-white/95 border ${a.leftBorder} rounded-3xl min-h-[170px] p-5 text-left shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)] transition-all duration-200 ${
        isUnlocked
          ? `hover:-translate-y-0.5 ${a.hoverShadow} active:translate-y-0`
          : 'opacity-50 cursor-not-allowed'
      }`}
    >
      <div className="w-full">
        <div className="flex items-start justify-between gap-4">
          {showBadge ? (
            <span
              className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono ${a.badgeBg} ${a.badgeText}`}
            >
              {effectiveBadge}
            </span>
          ) : (
            <span />
          )}

          {effectiveTopRight ? (
            <div
              className={`text-xs font-mono uppercase tracking-wider ${
                isCompleted ? 'text-[#3E5648]' : 'text-text-light'
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
            <p className="text-[11px] font-mono tracking-wide text-text-med mb-1">
              {headerKicker}
            </p>
          )}

          <h3 className={`main-font text-[2rem] leading-tight font-normal mb-1 ${a.badgeText}`}>
            {level.title || level.name}
          </h3>

          <p className="text-[1.05rem] text-text-med mb-4">
            {level.subtitle || level.description}
          </p>

          <div className="flex gap-10 text-sm font-mono text-text-dark mb-4">
            <div>
              <span className="text-lg font-semibold">{level.wordRange || '—'}</span>
              <div className="text-[11px] tracking-wide text-text-med">Vocabulary</div>
            </div>
            <div>
              <span className="text-lg font-semibold">{unitCount}</span>
              <div className="text-[11px] tracking-wide text-text-med">Units</div>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-text-med font-mono tracking-wide mb-4">
            {bodyText ||
              'Structured lessons and practice built on official proficiency frameworks.'}
          </p>

          {isUnlocked && (
            <div className={`${a.ctaText} text-sm font-semibold tracking-wide`}>{ctaLabel}</div>
          )}
        </div>
      </div>
    </button>
  );
}

interface LevelSelectProps {
  onSelectLevel: (level: LessonBand) => void;
  onOpenMandarinTones?: () => void;
  onGoHome: () => void;
  onOpenProfile: () => void;
}

export default function LevelSelect({
  onSelectLevel,
  onOpenMandarinTones,
  onGoHome,
  onOpenProfile,
}: LevelSelectProps) {
  const { state } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const getLevelsForLanguage = () => {
    switch (state.selectedLanguage) {
      case 'zh':
        return chineseLevels;
      case 'jp':
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
    switch (state.selectedLanguage) {
      case 'zh':
        return 'Mandarin';
      case 'jp':
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
  const advancedTrackLevel: LessonBand = {
    id: 'advanced',
    band: 7,
    name: 'Advanced',
    title: 'Advanced',
    subtitle: 'Bands 7–9 · Mastery',
    wordCount: 0,
    wordRange: 'Band 7–9',
    color: 'bg-red-500',
    description: 'Macro-unit track for Bands 7-9',
    units: [],
  };

  const activeTier = state.selectedLanguage === 'zh' ? searchParams.get('tier') : null;

  const setTier = (tier: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (tier) {
      next.set('tier', tier);
    } else {
      next.delete('tier');
    }
    setSearchParams(next);
  };

  const tiers = state.selectedLanguage === 'zh'
    ? [
        {
          id: 'beginner',
          title: 'Beginner',
          subtitle: 'Bands 1–3 · Core Foundations',
          style: { rail: 'bg-[#3E5648]', accent: 'green' as const },
          levels: levels.filter(l =>
            ['band1', 'band2', 'band3'].includes(l.id)
          )
        },
        {
          id: 'intermediate',
          title: 'Intermediate',
          subtitle: 'Bands 4–6 · Functional Fluency',
          style: { rail: 'bg-[#186E95]', accent: 'blue' as const },
          levels: levels.filter(l =>
            ['band4', 'band5', 'band6'].includes(l.id)
          )
        },
        {
          id: 'advanced',
          title: 'Advanced',
          subtitle: 'Bands 7–9 · Mastery',
          style: { rail: 'bg-red-500', accent: 'red' as const },
          levels: levels.filter(l =>
            ['band7', 'band8', 'band9'].includes(l.id)
          )
        }
      ]
    : [];

  return (
    <div className="min-h-screen page-shell px-6 pb-24">
      <GlassHeader title={getLanguageName()} />

      {/* Tier or Level Cards */}
      <div className="space-y-4">
        {state.selectedLanguage === 'zh' && activeTier === null && (
          tiers.map((tier, index) => {
            const a = ACCENT[CARD_ACCENT_ORDER[index % CARD_ACCENT_ORDER.length]];
            return (
            <button
              key={tier.id}
              onClick={() => {
                if (tier.id === 'advanced') {
                  onSelectLevel(advancedTrackLevel);
                  return;
                }
                setTier(tier.id);
              }}
              className={`w-full bg-white/95 border ${a.leftBorder} rounded-3xl min-h-[170px] p-5 text-left shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)] transition-all duration-200 hover:-translate-y-0.5 ${a.hoverShadow} active:translate-y-0`}
            >
              <div className="w-full">
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono ${a.badgeBg} ${a.badgeText}`}
                  >
                    Track
                  </span>
                  <ChevronRight className="w-5 h-5 text-text-light" />
                </div>

                <div className="mt-5">
                  <h3 className={`main-font text-[2rem] leading-tight font-normal mb-1 ${a.badgeText}`}>
                    {tier.title}
                  </h3>
                  <p className="text-[1.05rem] text-text-med mb-4">
                    {tier.subtitle}
                  </p>

                  <div className="flex gap-10 text-sm font-mono text-text-dark mb-4">
                    <div>
                      <span className="text-lg font-semibold">{tier.levels.length}</span>
                      <div className="text-[11px] tracking-wide text-text-med">
                        Bands
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] leading-relaxed text-text-med font-mono tracking-wide mb-4">
                    Choose a tier to drill into the bands and start structured progression.
                  </p>

                  <div className={`${a.ctaText} text-sm font-semibold tracking-wide`}>
                    View bands →
                  </div>
                </div>
              </div>
            </button>
            );
          })
        )}

        {state.selectedLanguage === 'zh' && activeTier !== null && (
          <>
            {activeTier === 'beginner' && onOpenMandarinTones && (
              <button
                onClick={onOpenMandarinTones}
                className={`w-full bg-[#186E95] border border-[#186E95] rounded-3xl min-h-[170px] p-5 text-left text-white shadow-[0_12px_28px_-22px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-0.5 ${ACCENT.navy.hoverShadow} active:translate-y-0`}
              >
                <div className="w-full">
                  <div className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono mb-4 bg-white/20 text-white">
                    Tone Foundations
                  </div>
                  <h3 className="main-font text-[2rem] leading-tight font-normal text-white mb-1">
                    Mandarin Tones
                  </h3>
                  <p className="text-[1.05rem] text-white/90 mb-4">
                    Learn tones 1-4 + neutral before vocabulary study
                  </p>
                  <p className="text-[11px] leading-relaxed text-white/80 font-mono tracking-wide mb-4">
                    Tone cards with playback and pronunciation cues
                  </p>
                  <div className="text-white text-sm font-semibold tracking-wide">
                    Open tone guide →
                  </div>
                </div>
              </button>
            )}
            {tiers
              .find(t => t.id === activeTier)!
              .levels.map((level, index) => {
                const isComingSoon = state.selectedLanguage === 'zh' && isMandarinBandComingSoon(level.id);
                const isUnlocked = state.unlockedLevels.includes(level.id) && !isComingSoon;
                const isCompleted = state.completedLevels.includes(level.id);
                return (
                  <LevelCard
                    key={level.id}
                    level={level}
                    isUnlocked={isUnlocked}
                    isCompleted={isCompleted}
                    onSelect={onSelectLevel}
                    badgeLabel={`Band ${level.band}`}
                    showBadge={activeTier !== 'advanced'}
                    headerKicker={undefined}
                    bodyText={
                      isComingSoon
                        ? 'This band is in production and will unlock soon.'
                        : level.description ||
                          'Core pronunciation, high‑frequency vocabulary, and functional progression within this band.'
                    }
                    showChevronWhenUnlocked={false}
                    topRightLabel={isComingSoon ? 'Coming Soon' : undefined}
                    accentOverride={CARD_ACCENT_ORDER[index % CARD_ACCENT_ORDER.length]}
                  />
                );
              })}
          </>
        )}

        {state.selectedLanguage !== 'zh' &&
          levels.map((level, index) => {
            const isUnlocked = false;
            const isCompleted = state.completedLevels.includes(level.id);
            return (
              <LevelCard
                key={level.id}
                level={level}
                isUnlocked={isUnlocked}
                isCompleted={isCompleted}
                onSelect={onSelectLevel}
                badgeLabel={level.id === 'intro' ? 'Intro' : 'Level'}
                showChevronWhenUnlocked={true}
                bodyText={
                  'Curriculum is in production for this language. Mandarin is currently available.'
                }
                topRightLabel="Coming Soon"
                accentOverride={CARD_ACCENT_ORDER[index % CARD_ACCENT_ORDER.length]}
              />
            );
          })}
      </div>

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
