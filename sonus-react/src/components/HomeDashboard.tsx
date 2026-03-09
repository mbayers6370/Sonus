import { useEffect, useMemo, useState } from 'react';
import {
  AudioWaveform,
  ArrowRight,
  BedDouble,
  Headphones,
  ListChecks,
  Mic,
  Plane,
  Stethoscope,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import BottomNav from './BottomNav';
import {
  formatUnitNameForDisplay,
  getUnitMetadata,
  isCheckpointUnitId,
  isPracticeUnitId,
} from '../data/unitMetadata';
import GlassHeader from './GlassHeader';
import GlassLoader from './ui/GlassLoader';
import { useApp } from '../contexts/AppContext';
import { apiFetch } from '../lib/apiClient';
import { getLessonRanges } from '../lib/lessonChunks';
import { QUIZ_PASS_PERCENT, SPEAK_PASS_PERCENT } from '../lib/passCriteria.ts';
import { makeLessonKey } from '../lib/lessonProgress';
import { inferLanguageForBand, normalizeLanguageId, resolveBandDataPath } from '../lib/languageRuntime';
import { readCachedCurrentPath, writeCachedCurrentPath } from '../lib/currentPathStore';
import { deriveJapaneseSectionIdFromUnitId, extractUnitNumber } from '../lib/learnPath';
import { getStarterBandIdForLanguage, isStarterUnitCompleted } from '../lib/practiceFocus';
import type { LessonMode } from '../types/lesson.types';
import type { SharedUserProgress } from '../../../shared/contracts';

type Progress = SharedUserProgress;

type Profile = {
  displayName?: string | null;
  email?: string | null;
};

type NeedsWorkResponse = {
  needsWork?: Array<{ wordId: string }>;
};

type ResumeTarget = {
  bandId: string;
  unitId: string;
  lessonIndex: number;
  mode?: LessonMode;
};

function getFirstNameFromIdentity(displayName?: string | null, email?: string | null) {
  // Prefer explicit profile naming, then fall back to a readable email local-part token.
  const trimmedDisplay = (displayName || '').trim();
  if (trimmedDisplay) {
    const firstToken = trimmedDisplay.split(/\s+/)[0] || '';
    return firstToken || null;
  }

  const localPart = (email || '').split('@')[0]?.trim() || '';
  if (!localPart) return null;
  const firstLocalToken = localPart.split(/[._-]+/)[0] || localPart;
  return firstLocalToken || null;
}

interface HomeDashboardProps {
  selectedLanguage: string;
  onOpenLevels: () => void;
  onResumeToUnit: (target: { bandId: string; unitId: string; lessonIndex: number; isCheckpoint: boolean; mode?: LessonMode }) => void;
  onOpenPractice: (kind: 'listening' | 'speaking', bandId?: string | null) => void;
  onOpenWeakWords: () => void;
  onOpenProfile: () => void;
  onOpenAbout: () => void;
  onOpenTravelMode: (sectionId?: string) => void;
}

const LANGUAGE_LABELS: Record<string, string> = {
  zh: 'Mandarin',
  ja: 'Japanese',
  kr: 'Korean',
  fr: 'French',
};

function isJapaneseBandId(value: string | null | undefined) {
  return Boolean(value && /^n[1-5]$/i.test(value));
}

function toJapaneseSectionTitle(sectionId: string) {
  const normalized = sectionId.trim().toLowerCase();
  if (normalized === 'base-i') return 'Core';
  if (normalized === 'base-ii') return 'Expansion';
  if (normalized === 'widen' || normalized === 'connect') return 'Integration';
  if (normalized === 'core') return 'Core';
  if (normalized === 'expansion') return 'Expansion';
  if (normalized === 'integration') return 'Integration';
  return sectionId
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function bandMatchesLanguage(bandId: string | null | undefined, languageId: string) {
  if (!bandId) return false;
  if (languageId === 'ja') return /^n[1-5]$/i.test(bandId);
  if (languageId === 'zh') return /^band\d+$/i.test(bandId) || bandId === 'advanced';
  return true;
}

function resolveResumeTarget(input: {
  progress: Progress;
  cachedPath: { bandId: string; unitId: string; lessonIndex: number } | null;
  checkpoint: {
    bandId: string;
    unitId: string;
    lessonIndex: number;
    lessonMode?: LessonMode;
  } | null;
  languageId: string;
  progressPathIsApply: boolean;
}): ResumeTarget | null {
  const { progress, cachedPath, checkpoint, languageId, progressPathIsApply } = input;
  const hasValidProgressTarget =
    Boolean(progress.currentBandId) &&
    bandMatchesLanguage(progress.currentBandId, languageId) &&
    Boolean(progress.currentUnitId) &&
    !isPracticeUnitId(progress.currentUnitId || '') &&
    progress.currentUnitId !== 'daily-review' &&
    !progressPathIsApply;
  if (hasValidProgressTarget) {
    return {
      bandId: progress.currentBandId as string,
      unitId: progress.currentUnitId as string,
      lessonIndex: Math.max(0, progress.currentLessonIdx ?? 0),
    };
  }

  if (
    cachedPath &&
    bandMatchesLanguage(cachedPath.bandId, languageId) &&
    !isPracticeUnitId(cachedPath.unitId) &&
    cachedPath.unitId !== 'daily-review'
  ) {
    return {
      bandId: cachedPath.bandId,
      unitId: cachedPath.unitId,
      lessonIndex: Math.max(0, cachedPath.lessonIndex),
    };
  }

  if (
    checkpoint &&
    bandMatchesLanguage(checkpoint.bandId, languageId) &&
    !isPracticeUnitId(checkpoint.unitId) &&
    checkpoint.unitId !== 'daily-review' &&
    checkpoint.lessonMode !== 'apply'
  ) {
    return {
      bandId: checkpoint.bandId,
      unitId: checkpoint.unitId,
      lessonIndex: checkpoint.lessonIndex,
      mode: checkpoint.lessonMode,
    };
  }

  return null;
}

function hasAnyCoreProgressForLanguage(
  lessonProgress: Record<string, unknown>,
  languageId: string
) {
  for (const key of Object.keys(lessonProgress || {})) {
    const [bandId, unitId] = key.split(':');
    if (!bandMatchesLanguage(bandId, languageId)) continue;
    if (!unitId || isPracticeUnitId(unitId) || isCheckpointUnitId(unitId) || unitId === 'daily-review') continue;
    const status = lessonProgress[key] as {
      completed?: boolean;
      mastered?: boolean;
      introViewed?: boolean;
      quizScore?: number | null;
      speakScore?: number | null;
    } | undefined;
    if (!status) continue;
    if (
      status.completed ||
      status.mastered ||
      status.introViewed ||
      status.quizScore != null ||
      status.speakScore != null
    ) {
      return true;
    }
  }
  return false;
}

function resolveHomeLanguageId(input: {
  selectedLanguage: string;
  stateSelectedLanguage: string | null;
  currentLevelId: string | null | undefined;
  activeBandId: string | null | undefined;
  resumeBandId: string | null | undefined;
  progressBandId: string | null | undefined;
}) {
  // Resolve language in priority order: explicit state -> selected UI value -> band inference.
  const explicit =
    (input.stateSelectedLanguage ? normalizeLanguageId(input.stateSelectedLanguage) : null) ||
    (input.selectedLanguage ? normalizeLanguageId(input.selectedLanguage) : null);
  if (explicit) return explicit;

  if (
    isJapaneseBandId(input.currentLevelId) ||
    isJapaneseBandId(input.activeBandId) ||
    isJapaneseBandId(input.resumeBandId) ||
    isJapaneseBandId(input.progressBandId)
  ) {
    return 'ja';
  }
  return 'zh';
}

const isInstructionalComplete = (quizScore: number | null | undefined, speakScore: number | null | undefined) =>
  (quizScore ?? 0) >= QUIZ_PASS_PERCENT && (speakScore ?? 0) >= SPEAK_PASS_PERCENT;

export default function HomeDashboard({
  selectedLanguage,
  onOpenLevels,
  onResumeToUnit,
  onOpenPractice,
  onOpenWeakWords,
  onOpenProfile,
  onOpenAbout,
  onOpenTravelMode,
}: HomeDashboardProps) {
  const { state } = useApp();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Progress>({
    streak: 0,
    lastActiveDate: null,
    currentBandId: null,
    currentUnitId: null,
    currentLessonIdx: null,
  });
  const [needsWorkCount, setNeedsWorkCount] = useState(0);
  const [progressPathIsApply, setProgressPathIsApply] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [unitCompletionPercent, setUnitCompletionPercent] = useState<number | null>(null);
  const [practiceUnlocked, setPracticeUnlocked] = useState(true);

  const languageId = resolveHomeLanguageId({
    selectedLanguage,
    stateSelectedLanguage: state.selectedLanguage,
    currentLevelId: state.currentLevel?.id || null,
    activeBandId: state.activeBandId || null,
    resumeBandId: state.resumeCheckpoint?.bandId || null,
    progressBandId: progress.currentBandId,
  });
  const languageLabel = LANGUAGE_LABELS[languageId] || 'Language';
  const isJapaneseLanguage = languageId === 'ja';
  const cachedPath = readCachedCurrentPath(languageId);
  const continueTarget: ResumeTarget | null = resolveResumeTarget({
    progress,
    cachedPath,
    checkpoint: state.resumeCheckpoint
      ? {
        bandId: state.resumeCheckpoint.bandId,
          unitId: state.resumeCheckpoint.unitId,
          lessonIndex: state.resumeCheckpoint.lessonIndex,
          lessonMode: state.resumeCheckpoint.lessonMode,
        }
      : null,
    languageId,
    progressPathIsApply,
  });
  const hasAnyCoreProgress = useMemo(() => {
    if (continueTarget && !isPracticeUnitId(continueTarget.unitId) && continueTarget.unitId !== 'daily-review') {
      return true;
    }
    if (progress.currentBandId && bandMatchesLanguage(progress.currentBandId, languageId)) {
      return true;
    }
    if (progress.currentUnitId && !isPracticeUnitId(progress.currentUnitId) && progress.currentUnitId !== 'daily-review') {
      return true;
    }
    if (needsWorkCount > 0) {
      return true;
    }
    return hasAnyCoreProgressForLanguage(state.lessonProgress || {}, languageId);
  }, [
    languageId,
    needsWorkCount,
    progress.currentBandId,
    progress.currentUnitId,
    continueTarget,
    state.lessonProgress,
  ]);
  const practiceBandId = bandMatchesLanguage(progress.currentBandId, languageId)
    ? progress.currentBandId
    : (continueTarget?.bandId || null);
  const hasSavedLessonPath = Boolean(continueTarget);
  const resumeCardTitle = hasSavedLessonPath ? 'Resume' : 'Start';
  const lessonNumber = continueTarget ? continueTarget.lessonIndex + 1 : null;
  const cardShell =
    'dashboard-card-enter rounded-3xl border p-5 sm:p-6 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)] transition-all duration-200 hover:-translate-y-0.5';
  const needsWorkLead =
    needsWorkCount === 1
      ? '1 word ready for practice.'
      : `${needsWorkCount} words ready for practice.`;
  const needsWorkMessage =
    needsWorkCount === 0
      ? '0 words are in your practice queue!'
      : `${needsWorkLead} Listening & Speaking recommended.`;
  const canUsePractice = hasAnyCoreProgress && practiceUnlocked;
  const practiceLockMessage = 'Practice Focus unlocks after you complete your first unit.';
  const formatBandLabel = (bandId: string | null) => {
    if (!bandId) return 'Level';
    if (languageId === 'zh') {
      if (/^band[1-3]$/i.test(bandId)) return 'Beginner';
      if (/^band[4-6]$/i.test(bandId)) return 'Intermediate';
      if (/^band[7-9]$/i.test(bandId) || bandId === 'advanced') return 'Advanced';
    }
    if (languageId === 'ja' && /^n[1-5]$/i.test(bandId)) {
      return bandId.toUpperCase();
    }
    const matched = /^band(\d+)$/i.exec(bandId);
    if (matched) return `Level ${matched[1]}`;
    return bandId.toUpperCase();
  };

  const formatUnitLabel = (unitId: string | null, bandId: string | null) => {
    if (!unitId) return 'Unit';
    if (isJapaneseLanguage && bandId && isJapaneseBandId(bandId)) {
      const sectionId = deriveJapaneseSectionIdFromUnitId(bandId, unitId);
      const sectionUnitNumber = extractUnitNumber(unitId);
      if (sectionId && sectionUnitNumber !== null) {
        const sectionTitle = toJapaneseSectionTitle(sectionId);
        return `${sectionTitle} · Unit ${sectionUnitNumber}`;
      }
      const fallbackMatch = /(?:base\s*i{1,2}|core|expansion|integration|widen|connect)\s*u?(\d+)/i.exec(unitId);
      if (fallbackMatch) {
        const prefix = /base\s*i{1,2}|core|expansion|integration|widen|connect/i.exec(unitId)?.[0] || 'core';
        return `${toJapaneseSectionTitle(prefix)} · Unit ${String(Number(fallbackMatch[1]))}`;
      }
    }
    const fromMetadata =
      bandId && unitId
        ? getUnitMetadata(bandId, unitId)?.name
        : undefined;
    if (isJapaneseLanguage && fromMetadata) {
      const metadataMatch = /(base\s*i{1,2}|core|expansion|integration|widen|connect)\s*u?(\d+)/i.exec(fromMetadata);
      if (metadataMatch) {
        return `${toJapaneseSectionTitle(metadataMatch[1])} · Unit ${String(Number(metadataMatch[2]))}`;
      }
    }
    if (fromMetadata) return formatUnitNameForDisplay(fromMetadata);
    return formatUnitNameForDisplay(
      unitId
        .replace(/^[a-z]\d+-/i, '')
        .replace(/[-_]+/g, ' ')
    )
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };
  const formatResumeUnitLabel = (unitId: string | null, bandId: string | null) => {
    if (!unitId) return 'Unit';
    const unitNumber = extractUnitNumber(unitId);
    if (unitNumber !== null) return `Unit ${unitNumber}`;
    const fromName = bandId ? getUnitMetadata(bandId, unitId)?.name : undefined;
    const fromNameMatch = /(?:^|\s)u(?:nit)?\s*(\d+)(?:$|\s)/i.exec(fromName || '');
    if (fromNameMatch?.[1]) return `Unit ${String(Number(fromNameMatch[1]))}`;
    const fromCoreStyleName = /(?:core|expansion|integration|base\s*i{1,2}|widen|connect)\s*0*(\d+)(?:$|\s)/i.exec(fromName || '');
    if (fromCoreStyleName?.[1]) return `Unit ${String(Number(fromCoreStyleName[1]))}`;
    return formatUnitLabel(unitId, bandId);
  };

  useEffect(() => {
    let mounted = true;
    void (async () => {
      setLoading(true);
      try {
        const [profileRes, progressRes, weakRes] = await Promise.all([
          apiFetch('/v1/me/profile'),
          apiFetch('/v1/me/progress'),
          apiFetch(`/v1/me/needs-work?limit=30&minTotalMisses=1&language=${encodeURIComponent(languageId)}`),
        ]);

        if (mounted && profileRes.ok) {
          const profileJson = (await profileRes.json()) as { profile?: Profile };
          setProfileName(getFirstNameFromIdentity(profileJson.profile?.displayName, profileJson.profile?.email));
        }

        if (mounted && progressRes.ok) {
          const json = (await progressRes.json()) as { progress?: Progress };
          if (json.progress) {
            setProgress(json.progress);
            const bandId = json.progress.currentBandId;
            const unitId = json.progress.currentUnitId;
            const lessonIdx = json.progress.currentLessonIdx;
            if (
              bandId &&
              unitId &&
              lessonIdx !== null &&
              !isPracticeUnitId(unitId) &&
              !isCheckpointUnitId(unitId) &&
              unitId !== 'daily-review'
            ) {
              writeCachedCurrentPath({
                bandId,
                unitId,
                lessonIndex: Math.max(0, lessonIdx),
              });
              try {
                const bandLanguage = inferLanguageForBand(bandId, languageId);
                const bandRes = await fetch(resolveBandDataPath(bandLanguage, bandId), { cache: 'no-store' });
                if (bandRes.ok) {
                  const bandData = (await bandRes.json()) as {
                    units?: Record<string, { words?: unknown[] }> | Array<{ id?: string; words?: unknown[] }>;
                  };
                  let words: Array<{
                    id?: string;
                    example?: { zh?: string; en?: string };
                  }> = [];
                  const units = bandData.units;
                  if (Array.isArray(units)) {
                    words = (units.find((unit) => unit?.id === unitId)?.words || []) as typeof words;
                  } else if (units && typeof units === 'object') {
                    words = (units[unitId]?.words || []) as typeof words;
                  }
                  const wordsLength = words.length;
                  const coreLessonCount = getLessonRanges(wordsLength, 10).length;
                  if (mounted) setProgressPathIsApply(coreLessonCount > 0 && lessonIdx === coreLessonCount);
                } else if (mounted) {
                  setProgressPathIsApply(false);
                }
              } catch {
                if (mounted) {
                  setProgressPathIsApply(false);
                }
              }
            } else if (mounted) {
              setProgressPathIsApply(false);
            }
          }
        }

        if (mounted && weakRes.ok) {
          const json = (await weakRes.json()) as NeedsWorkResponse;
          setNeedsWorkCount((json.needsWork || []).length);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [languageId, state.lessonProgress]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (
        !continueTarget ||
        isPracticeUnitId(continueTarget.unitId) ||
        isCheckpointUnitId(continueTarget.unitId) ||
        continueTarget.unitId === 'daily-review'
      ) {
        if (mounted) setUnitCompletionPercent(null);
        return;
      }
      try {
        const bandLanguage = inferLanguageForBand(continueTarget.bandId, languageId);
        const bandRes = await fetch(resolveBandDataPath(bandLanguage, continueTarget.bandId), { cache: 'no-store' });
        if (!bandRes.ok) {
          if (mounted) setUnitCompletionPercent(null);
          return;
        }
        const bandData = (await bandRes.json()) as {
          units?: Record<string, { words?: unknown[] }> | Array<{ id?: string; words?: unknown[] }>;
        };
        const units = bandData.units;
        let words: Array<{ id?: string }> = [];
        if (Array.isArray(units)) {
          words = (units.find((unit) => unit?.id === continueTarget.unitId)?.words || []) as typeof words;
        } else if (units && typeof units === 'object') {
          words = (units[continueTarget.unitId]?.words || []) as typeof words;
        }
        const coreLessonCount = getLessonRanges(words.length, 10).length;
        if (!mounted || coreLessonCount <= 0) {
          if (mounted) setUnitCompletionPercent(null);
          return;
        }
        const completedLessons = Array.from({ length: coreLessonCount }).reduce<number>((count, _, idx) => {
          const lessonKey = makeLessonKey(continueTarget.bandId, continueTarget.unitId, idx);
          const status = state.lessonProgress[lessonKey];
          return count + Number(Boolean(status?.completed || isInstructionalComplete(status?.quizScore, status?.speakScore)));
        }, 0);
        const masteredLessons = Array.from({ length: coreLessonCount }).reduce<number>((count, _, idx) => {
          const lessonKey = makeLessonKey(continueTarget.bandId, continueTarget.unitId, idx);
          const status = state.lessonProgress[lessonKey];
          return count + Number(Boolean(status?.mastered));
        }, 0);
        const totalTrackSteps = coreLessonCount * 2;
        const completionPercent =
          totalTrackSteps > 0 ? Math.round(((completedLessons + masteredLessons) / totalTrackSteps) * 100) : null;
        if (mounted) setUnitCompletionPercent(completionPercent);
      } catch {
        if (mounted) setUnitCompletionPercent(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    languageId,
    continueTarget,
    state.lessonProgress,
  ]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const starterBandId = getStarterBandIdForLanguage(languageId);
      if (progress.currentBandId && progress.currentBandId !== starterBandId) {
        if (mounted) setPracticeUnlocked(true);
        return;
      }
      try {
        const bandLanguage = inferLanguageForBand(starterBandId, languageId);
        const bandRes = await fetch(resolveBandDataPath(bandLanguage, starterBandId), { cache: 'no-store' });
        if (!bandRes.ok) {
          if (mounted) setPracticeUnlocked(true);
          return;
        }
        const bandData = (await bandRes.json()) as {
          units?: Record<string, { words?: unknown[] }> | Array<{ id?: string; words?: unknown[] }>;
        };
        const unlocked = isStarterUnitCompleted({
          starterBandId,
          bandData,
          lessonProgress: state.lessonProgress,
          isInstructionalComplete,
        });
        if (mounted) setPracticeUnlocked(unlocked);
      } catch {
        if (mounted) setPracticeUnlocked(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [languageId, progress.currentBandId, state.lessonProgress]);

  const openResumeCard = () => {
    if (!continueTarget) {
      onOpenLevels();
      return;
    }

    onResumeToUnit({
      bandId: continueTarget.bandId,
      unitId: continueTarget.unitId,
      lessonIndex: continueTarget.lessonIndex,
      isCheckpoint: isCheckpointUnitId(continueTarget.unitId),
      mode: continueTarget.mode,
    });
  };

  const glassBtnDark =
    'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold border border-white/38 bg-white/12 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/30 hover:border-white/54';
  const glassBtnPrimary =
    'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold border border-[#8FA3B8]/45 bg-[#3A4B5D] text-white transition-colors duration-200 hover:bg-[#465B70]';
  const glassPillLight =
    'rounded-xl text-xs border border-[#186E95]/25 bg-white/58 text-[#186E95] backdrop-blur-sm transition-all hover:bg-[#D9ECF7]/78 hover:border-[#186E95]/42';
  const glassBarShell = 'mt-2 h-2.5 w-full rounded-full overflow-hidden border border-white/34 bg-[rgba(255,255,255,0.14)] backdrop-blur-sm relative';
  const glassStatPill = 'rounded-xl border border-white/26 bg-white/12 backdrop-blur-sm px-2.5 py-2 text-left';
  const glassRowBtn =
    'w-full flex items-center justify-between px-3 py-3 rounded-2xl border border-[rgba(31,42,55,0.15)] bg-white/56 backdrop-blur-sm hover:bg-[#E8EEF4]/78 hover:border-[rgba(31,42,55,0.25)] transition-colors';

  return (
    <div className="min-h-screen page-shell px-6 with-bottom-nav relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-br from-[#186E95]/18 via-[#3E5648]/10 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-white/45 via-white/15 to-transparent pointer-events-none" />

      <GlassHeader title={`${languageLabel}`} spacerClassName="mb-0" compactStandaloneTitle={false} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-[minmax(180px,auto)] relative">
        <section
          className={`${cardShell} md:order-1 md:col-span-2 bg-[#1F2A37] text-white border-[#1F2A37]/90 min-h-[210px] text-center flex flex-col justify-center shadow-[0_20px_40px_-28px_rgba(31,42,55,0.42)] relative overflow-hidden`}
          style={{ animationDelay: '35ms' }}
        >
          <div className="pointer-events-none absolute inset-[8px] rounded-[1.2rem] border border-white/18" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-[9%] top-[22%] rotate-[-12deg] font-mono text-[1.15rem] uppercase tracking-[0.22em] text-white/[0.05]">
              hello
            </div>
            <div className="absolute right-[10%] top-[18%] rotate-[8deg] font-mono text-[1.1rem] tracking-[0.2em] text-white/[0.05]">
              你好
            </div>
            <div className="absolute left-[14%] top-[58%] rotate-[-8deg] font-mono text-[1.05rem] uppercase tracking-[0.2em] text-white/[0.045]">
              bonjour
            </div>
            <div className="absolute right-[16%] top-[60%] rotate-[10deg] font-mono text-[1.08rem] tracking-[0.18em] text-white/[0.045]">
              日本語
            </div>
            <div className="absolute left-[42%] top-[36%] rotate-[-6deg] font-mono text-[0.95rem] uppercase tracking-[0.22em] text-white/[0.04]">
              hola
            </div>
            <div className="absolute right-[37%] top-[42%] rotate-[7deg] font-mono text-[0.9rem] uppercase tracking-[0.18em] text-white/[0.04]">
              안녕하세요
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1F2A37]/22 to-[#1F2A37]/34" />
          </div>
          <div className="relative z-10">
            <div className="text-[11px] tracking-wide font-mono uppercase text-white/50 mb-1.5">
              Welcome{profileName ? `, ${profileName}` : ''}
            </div>
            <div className="main-font text-2xl leading-none mb-3.5 text-[#E8F1FF]">{resumeCardTitle}</div>
            {hasSavedLessonPath ? (
              <>
                <div className="text-sm text-white/95 font-medium mb-1">{formatBandLabel(continueTarget?.bandId || null)}</div>
                <div className="text-sm text-white/82 mb-3.5">
                  {isCheckpointUnitId(continueTarget?.unitId || '')
                    ? `${formatResumeUnitLabel(continueTarget?.unitId || null, continueTarget?.bandId || null)} · Unit review quiz`
                    : `${formatResumeUnitLabel(continueTarget?.unitId || null, continueTarget?.bandId || null)} · Lesson ${lessonNumber}`}
                </div>
                {!isCheckpointUnitId(continueTarget?.unitId || '') && unitCompletionPercent !== null && (
                  <div className="inline-flex items-center rounded-full px-3 py-1 border border-white/25 bg-white/10 text-[11px] font-mono uppercase tracking-wider text-white/88 mb-4 mx-auto">
                    Unit {unitCompletionPercent}% complete
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-white/82 mb-4">
                Choose a level to begin. After your first lesson, this card will switch to Continue Learning.
              </div>
            )}
            <div className="max-w-md mx-auto w-full">
              {hasSavedLessonPath ? (
                <button
                  id="tour-begin-here-button"
                  onClick={openResumeCard}
                  className={`w-full ${glassBtnPrimary}`}
                >
                  Continue Learning
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  id="tour-begin-here-button"
                  onClick={openResumeCard}
                  className={`w-full ${glassBtnDark}`}
                >
                  Begin Here
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </section>

        <section
          id="tour-travel-sprint-card"
          className={`${cardShell} md:order-3 md:h-full bg-white text-text-dark border-[#1F2A37]/18 min-h-[260px] text-center flex flex-col justify-center relative overflow-hidden`}
          style={{ animationDelay: '135ms' }}
        >
          <div className="relative z-10 w-full h-full flex flex-col justify-between">
          <div className="main-font text-2xl leading-none mb-2 text-[#145A7D]">Travel Sprint</div>
            <p className="text-sm leading-relaxed text-text-med mb-4 max-w-md mx-auto">
              <span className="font-bold">Short on time?</span> Practice essential travel phrases before you go.
            </p>
            <div className="grid grid-cols-3 gap-2 mb-4 max-w-md mx-auto">
              <button onClick={() => onOpenTravelMode('airport-arrival')} className={`inline-flex items-center justify-center gap-1.5 px-2 py-2 ${glassPillLight}`}>
                <Plane className="w-3.5 h-3.5" />
                Airport
              </button>
              <button onClick={() => onOpenTravelMode('hotel')} className={`inline-flex items-center justify-center gap-1.5 px-2 py-2 ${glassPillLight}`}>
                <BedDouble className="w-3.5 h-3.5" />
                Hotel
              </button>
              <button onClick={() => onOpenTravelMode('emergency')} className={`inline-flex items-center justify-center gap-1.5 px-2 py-2 ${glassPillLight}`}>
                <Stethoscope className="w-3.5 h-3.5" />
                Emergency
              </button>
            </div>
            <div className="max-w-md mx-auto">
              <button
                onClick={() => onOpenTravelMode()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 border border-[#186E95] bg-[#186E95] text-white transition-colors hover:bg-[#145B7A] hover:border-[#145B7A]"
              >
                Explore Travel Content
                <ArrowRight className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] font-mono uppercase tracking-[0.12em] text-[#145B7A]">
              <Link to="/travel-mandarin-phrases" className="underline underline-offset-4 hover:text-[#0E4A66]">Guide</Link>
              <Link to="/mandarin-airport-phrases" className="underline underline-offset-4 hover:text-[#0E4A66]">Airport</Link>
              <Link to="/mandarin-taxi-phrases" className="underline underline-offset-4 hover:text-[#0E4A66]">Taxi</Link>
              <Link to="/how-to-order-food-in-chinese" className="underline underline-offset-4 hover:text-[#0E4A66]">Food</Link>
            </div>
            <p className="text-[11px] leading-relaxed text-text-light mt-4 max-w-md mx-auto">
              Travel Sprint is separate from your structured lesson path.
            </p>
          </div>
        </section>

        <section
          id="tour-practice-focus-card"
          className={`${cardShell} md:order-2 md:h-full bg-[#186E95] text-white border-[#186E95]/90 min-h-[210px] text-center flex flex-col justify-between py-4 shadow-[0_20px_40px_-28px_rgba(24,110,149,0.38)]`}
          style={{ animationDelay: '85ms' }}
        >
          <div className="main-font text-2xl leading-none mb-2 text-[#D7F0E4]">Practice Focus</div>
          <p className="text-sm leading-relaxed text-white/86 mt-3 mb-3 max-w-md mx-auto">
            {!practiceUnlocked
              ? practiceLockMessage
              : selectedLanguage === 'zh' || isJapaneseLanguage
              ? needsWorkMessage
              : `Practice labs are currently available for ${languageLabel}.`}
          </p>
          <div className={glassBarShell}>
            <div className="absolute inset-y-0 left-0 w-[70%]">
              <div className="absolute inset-y-0 left-0 right-[6px] rounded-l-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.28)]" />
              <div className="absolute inset-y-[1px] left-[2px] right-[10px] rounded-l-full bg-white/55" />
              <div className="absolute right-[1px] top-0 h-full w-[10px] bg-white -skew-x-[24deg] origin-left shadow-[0_0_12px_rgba(255,255,255,0.62)]" />
            </div>
            <div className="absolute inset-y-0 left-0 right-1">
              {[70.4, 71.2, 72.2, 73.5, 75.0, 76.8, 79.0, 81.6, 84.6, 88.0, 91.8, 95.6].map((leftPercent, idx) => (
                <span
                  // Trailing slanted markers keep full opacity and widen spacing toward the end.
                  key={leftPercent}
                  className="absolute top-1/2 h-[8px] w-[1.5px] -translate-y-1/2 bg-white rotate-[24deg] origin-center shadow-[0_0_6px_rgba(255,255,255,0.55)] animate-[pulse_2.8s_ease-in-out_infinite]"
                  style={{
                    left: `${leftPercent}%`,
                    animationDelay: `${idx * 140}ms`,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 w-full">
            <div className={glassStatPill}>
              <div className="text-sm font-semibold text-center leading-none text-white">70%</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-center font-mono text-white/80">Learning</div>
            </div>
            <div className={glassStatPill}>
              <div className="text-sm font-semibold text-center leading-none text-white">30%</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-center font-mono text-white/80">Reinforcing</div>
            </div>
          </div>
          {selectedLanguage === 'zh' || isJapaneseLanguage ? (
            <div className="flex items-center justify-center gap-3 max-w-md mx-auto mt-4">
              <button
                onClick={() => {
                  if (!canUsePractice) return;
                  onOpenPractice('listening', practiceBandId);
                }}
                disabled={!canUsePractice}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold transition-colors duration-200 ${
                  canUsePractice
                    ? 'border-white/70 bg-white text-[#186E95] hover:bg-[#EAF4FA]'
                    : 'border-white/35 bg-white/20 text-white/65 hover:bg-white/25'
                }`}
                aria-label="Listening practice"
                title="Listening practice"
              >
                <Headphones className={`w-4 h-4 ${canUsePractice ? 'text-[#186E95]' : 'text-white/70'}`} />
                Listening
              </button>
              <button
                onClick={() => {
                  if (!canUsePractice) return;
                  onOpenPractice('speaking', practiceBandId);
                }}
                disabled={!canUsePractice}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold transition-colors duration-200 ${
                  canUsePractice
                    ? 'border-white/70 bg-white text-[#186E95] hover:bg-[#EAF4FA]'
                    : 'border-white/35 bg-white/20 text-white/65 hover:bg-white/25'
                }`}
                aria-label="Speaking practice"
                title="Speaking practice"
              >
                <Mic className={`w-4 h-4 ${canUsePractice ? 'text-[#186E95]' : 'text-white/70'}`} />
                Speaking
              </button>
            </div>
          ) : (
            <div className="max-w-md mx-auto mt-4">
              <button
                onClick={onOpenLevels}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white/14 text-white border border-white/30 backdrop-blur-sm hover:bg-black/30 hover:border-white/52 transition-colors duration-200"
              >
                Continue learning
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
          <p className="text-[11px] leading-relaxed text-white/72 mt-4 max-w-md mx-auto">
            Practice Focus is separate from your structured lesson path. Practice only, not graded.
          </p>
        </section>

        <section
          className={`${cardShell} md:order-4 md:col-span-2 bg-white text-text-dark border-[#1F2A37]/35 flex flex-col justify-center`}
          style={{ animationDelay: '235ms' }}
        >
          <div className="main-font text-2xl leading-none mb-3 text-[#1B3446]">Shortcuts</div>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={onOpenWeakWords}
              className={glassRowBtn}
            >
              <span className="inline-flex items-center gap-2 text-sm text-text-dark">
                <ListChecks className="w-4 h-4 text-[#3E5648]" />
                Progress Check
              </span>
              <ArrowRight className="w-4 h-4 text-text-light" />
            </button>
            <button
              onClick={onOpenAbout}
              className={glassRowBtn}
            >
              <span className="inline-flex items-center gap-2 text-sm text-text-dark">
                <AudioWaveform className="w-4 h-4 text-[#1F2A37]" />
                About Sonus
              </span>
              <ArrowRight className="w-4 h-4 text-text-light" />
            </button>
          </div>
        </section>
      </div>

      {loading && (
        <div className="mt-4">
          <GlassLoader compact message="Refreshing dashboard..." />
        </div>
      )}

      <BottomNav active="home" onHome={() => {}} onProfile={onOpenProfile} />
    </div>
  );
}
