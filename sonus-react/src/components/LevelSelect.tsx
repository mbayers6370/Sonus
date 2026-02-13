import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import type { LessonBand } from '../types/lesson.types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import BottomNav from './BottomNav';

// Accent styling helpers
const ACCENT = {
  gray: { badgeBg: 'bg-gray-100', badgeText: 'text-gray-700', ctaText: 'text-gray-700', hoverShadow: 'hover:shadow-gray-500/10', leftBorder: 'border-gray-400' },
  navy: { badgeBg: 'bg-[rgba(30,58,138,0.16)]', badgeText: 'text-[#1E3A8A]', ctaText: 'text-[#1E3A8A]', hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(30,58,138,0.45)]', leftBorder: 'border-[#1E3A8A]' },
  sage: { badgeBg: 'bg-[rgba(77,124,15,0.16)]', badgeText: 'text-[#4D7C0F]', ctaText: 'text-[#4D7C0F]', hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(77,124,15,0.40)]', leftBorder: 'border-[#4D7C0F]' },
  graphite: { badgeBg: 'bg-[rgba(55,65,81,0.14)]', badgeText: 'text-[#374151]', ctaText: 'text-[#374151]', hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(55,65,81,0.42)]', leftBorder: 'border-[#374151]' },
  rust: { badgeBg: 'bg-[rgba(194,65,12,0.16)]', badgeText: 'text-[#C2410C]', ctaText: 'text-[#C2410C]', hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(194,65,12,0.45)]', leftBorder: 'border-[#C2410C]' },
} as const;

type AccentKey = keyof typeof ACCENT;
const CARD_ACCENT_ORDER: AccentKey[] = ['navy', 'sage', 'graphite', 'rust'];

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
    color: 'bg-green-500',
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
    color: 'bg-green-600',
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
    color: 'bg-blue-500',
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
    color: 'bg-blue-600',
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
    id: 'n5', name: 'JLPT N5', description: 'Basic', color: 'bg-green-500',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'n4', name: 'JLPT N4', description: 'Elementary', color: 'bg-blue-500',
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
    id: 'topik1-1', name: 'TOPIK I Level 1', description: 'Beginner', color: 'bg-green-500',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'topik1-2', name: 'TOPIK I Level 2', description: 'Elementary', color: 'bg-green-600',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'topik2-3', name: 'TOPIK II Level 3', description: 'Intermediate', color: 'bg-blue-500',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'topik2-4', name: 'TOPIK II Level 4', description: 'Upper Intermediate', color: 'bg-blue-600',
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
    id: 'a1', name: 'A1', description: 'Beginner', color: 'bg-green-500',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'a2', name: 'A2', description: 'Elementary', color: 'bg-green-600',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'b1', name: 'B1', description: 'Intermediate', color: 'bg-blue-500',
    band: 0,
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    units: []
  },
  {
    id: 'b2', name: 'B2', description: 'Upper Intermediate', color: 'bg-blue-600',
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
}: LevelCardProps) {
  const a = ACCENT[accentOverride ?? 'navy'];

  const effectiveBadge = badgeLabel ?? (level.id === 'intro' ? 'Intro' : 'Level');
  const effectiveTopRight =
    topRightLabel ??
    (isCompleted
      ? '✓ Completed'
      : !isUnlocked
        ? 'Locked'
        : '');

  return (
    <button
      onClick={() => isUnlocked && onSelect(level)}
      disabled={!isUnlocked}
      className={`w-full bg-white border-l-4 ${a.leftBorder} rounded-2xl p-6 text-left transition-all ${
        isUnlocked
          ? `hover:-translate-y-1 hover:shadow-xl ${a.hoverShadow} active:translate-y-0`
          : 'opacity-50 cursor-not-allowed'
      }`}
    >
      <div className="w-full">
        <div className="flex items-start justify-between gap-4">
          <span
            className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono ${a.badgeBg} ${a.badgeText}`}
          >
            {effectiveBadge}
          </span>

          {effectiveTopRight ? (
            <div
              className={`text-xs font-mono uppercase tracking-wider ${
                isCompleted ? 'text-green-600' : 'text-text-light'
              }`}
            >
              {effectiveTopRight}
            </div>
          ) : showChevronWhenUnlocked ? (
            <ChevronRight className="w-5 h-5 text-text-light" />
          ) : null}
        </div>

        <div className="mt-4">
          {headerKicker && (
            <p className="text-xs font-mono uppercase tracking-wider text-text-med mb-1">
              {headerKicker}
            </p>
          )}

          <h3 className={`font-playfair text-2xl font-normal mb-1 ${a.badgeText}`}>
            {level.title || level.name}
          </h3>

          <p className="text-lg text-text-med mb-3">
            {level.subtitle || level.description}
          </p>

          <div className="flex gap-10 text-sm font-mono text-text-dark mb-4">
            <div>
              <span className="text-lg font-semibold">{level.wordRange || '—'}</span>
              <div className="text-xs uppercase tracking-wider text-text-med">Vocabulary</div>
            </div>
            <div>
              <span className="text-lg font-semibold">{level.units?.length ?? 0}</span>
              <div className="text-xs uppercase tracking-wider text-text-med">Units</div>
            </div>
          </div>

          <p className="text-xs text-text-med font-mono uppercase tracking-wider mb-3">
            {bodyText ||
              'Structured lessons and practice built on official proficiency frameworks.'}
          </p>

          {isUnlocked && (
            <div className={`${a.ctaText} font-medium text-sm`}>Start learning →</div>
          )}
        </div>
      </div>
    </button>
  );
}

interface LevelSelectProps {
  onBack: () => void;
  onSelectLevel: (level: LessonBand) => void;
  onOpenMandarinTones?: () => void;
  onGoHome: () => void;
  onOpenProfile: () => void;
}

export default function LevelSelect({
  onBack,
  onSelectLevel,
  onOpenMandarinTones,
  onGoHome,
  onOpenProfile,
}: LevelSelectProps) {
  const { state } = useApp();

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

  // Tier grouping (HSK structure for Mandarin)
  const [activeTier, setActiveTier] = useState<string | null>(null);

  const tiers = state.selectedLanguage === 'zh'
    ? [
        {
          id: 'beginner',
          title: 'Beginner',
          subtitle: 'Bands 1–3 · Core Foundations',
          style: { rail: 'bg-green-500', accent: 'green' as const },
          levels: levels.filter(l =>
            ['band1', 'band2', 'band3'].includes(l.id)
          )
        },
        {
          id: 'intermediate',
          title: 'Intermediate',
          subtitle: 'Bands 4–6 · Functional Fluency',
          style: { rail: 'bg-blue-500', accent: 'blue' as const },
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
    <div className="min-h-screen page-shell px-6 pt-14 pb-24">
      {/* Header */}
      <div className="relative mb-10">
        <button
          onClick={() => {
            if (state.selectedLanguage === 'zh' && activeTier !== null) {
              setActiveTier(null);
            } else {
              onBack();
            }
          }}
          className="absolute left-0 -top-1 inline-flex items-center gap-1.5 p-2 -ml-2 text-text-dark hover:opacity-70 transition-opacity"
        >
          <ChevronLeft className="w-4.5 h-4.5" />
          <span className="text-sm">Back</span>
        </button>

        <div className="text-center px-12">
          <h1 className="font-playfair text-5xl font-normal text-text-dark mb-2">
            {getLanguageName()}
          </h1>
          <h2 className="text-base text-text-med italic">
            Choose <span className="font-playfair">a level</span>
          </h2>
        </div>
      </div>

      {/* Tier or Level Cards */}
      <div className="space-y-3">
        {state.selectedLanguage === 'zh' && activeTier === null && (
          tiers.map((tier, index) => {
            const a = ACCENT[CARD_ACCENT_ORDER[index % CARD_ACCENT_ORDER.length]];
            return (
            <button
              key={tier.id}
              onClick={() => setActiveTier(tier.id)}
              className={`w-full bg-white border-l-4 ${a.leftBorder} rounded-2xl p-6 text-left transition-all hover:-translate-y-1 hover:shadow-xl ${a.hoverShadow} active:translate-y-0`}
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

                <div className="mt-4">
                  <h3 className={`font-playfair text-2xl font-normal mb-1 ${a.badgeText}`}>
                    {tier.title}
                  </h3>
                  <p className="text-lg text-text-med mb-3">
                    {tier.subtitle}
                  </p>

                  <div className="flex gap-10 text-sm font-mono text-text-dark mb-4">
                    <div>
                      <span className="text-lg font-semibold">{tier.levels.length}</span>
                      <div className="text-xs uppercase tracking-wider text-text-med">
                        Bands
                      </div>
                    </div>
                    <div>
                      <span className="text-lg font-semibold">
                        {tier.levels.reduce((sum, l) => sum + (l.units?.length ?? 0), 0)}
                      </span>
                      <div className="text-xs uppercase tracking-wider text-text-med">
                        Units
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-text-med font-mono uppercase tracking-wider mb-3">
                    Choose a tier to drill into the bands and start structured progression.
                  </p>

                  <div className={`${a.ctaText} font-medium text-sm`}>
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
                className={`w-full bg-white border-l-4 ${ACCENT.navy.leftBorder} rounded-2xl p-6 text-left transition-all hover:-translate-y-1 hover:shadow-xl ${ACCENT.navy.hoverShadow} active:translate-y-0`}
              >
                <div className="w-full">
                  <div className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono mb-4 bg-[rgba(30,58,138,0.16)] text-[#1E3A8A]">
                    Tone Foundations
                  </div>
                  <h3 className="font-playfair text-2xl font-normal text-[#1E3A8A] mb-1">
                    Mandarin Tones
                  </h3>
                  <p className="text-lg text-text-med mb-3">
                    Train tones 1-4 + neutral before vocabulary study
                  </p>
                  <p className="text-xs text-text-med font-mono uppercase tracking-wider mb-3">
                    Interactive cards with audio playback and quick pronunciation cues
                  </p>
                  <div className="text-[#1E3A8A] font-medium text-sm">
                    Open tones practice →
                  </div>
                </div>
              </button>
            )}
            {tiers
              .find(t => t.id === activeTier)!
              .levels.map((level, index) => {
                const isUnlocked = state.unlockedLevels.includes(level.id);
                const isCompleted = state.completedLevels.includes(level.id);
                return (
                  <LevelCard
                    key={level.id}
                    level={level}
                    isUnlocked={isUnlocked}
                    isCompleted={isCompleted}
                    onSelect={onSelectLevel}
                    badgeLabel={`Band ${level.band}`}
                    headerKicker={undefined}
                    bodyText={
                      level.description ||
                      'Core pronunciation, high‑frequency vocabulary, and functional progression within this band.'
                    }
                    showChevronWhenUnlocked={false}
                    accentOverride={CARD_ACCENT_ORDER[index % CARD_ACCENT_ORDER.length]}
                  />
                );
              })}
          </>
        )}

        {state.selectedLanguage !== 'zh' &&
          levels.map((level, index) => {
            const isUnlocked = state.unlockedLevels.includes(level.id);
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
                  level.description ||
                  'Structured lessons and practice built on official proficiency frameworks.'
                }
                accentOverride={CARD_ACCENT_ORDER[index % CARD_ACCENT_ORDER.length]}
              />
            );
          })}
      </div>

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
