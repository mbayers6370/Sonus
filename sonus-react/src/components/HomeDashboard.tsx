import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bolt,
  BriefcaseConveyorBelt,
  Headphones,
  ListChecks,
  Mic,
} from 'lucide-react';
import BottomNav from './BottomNav';
import { formatUnitNameForDisplay, getUnitMetadata, isCheckpointUnitId, isPracticeUnitId } from '../data/unitMetadata';
import GlassHeader from './GlassHeader';
import GlassLoader from './ui/GlassLoader';
import { useApp } from '../contexts/AppContext';
import { apiFetch } from '../lib/apiClient';
import { getLessonRanges } from '../lib/lessonChunks';
import { QUIZ_PASS_PERCENT, SPEAK_PASS_PERCENT } from '../lib/passCriteria';
import { makeLessonKey } from '../lib/lessonProgress';
import { inferLanguageForBand, normalizeLanguageId, resolveBandDataPath } from '../lib/languageRuntime';
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
  onOpenTravelMode: (sectionId?: string) => void;
}

const LANGUAGE_LABELS: Record<string, string> = {
  zh: 'Mandarin',
  ja: 'Japanese',
  kr: 'Korean',
  fr: 'French',
};
const ZH_BAND_ORDER = ['band1', 'band2', 'band3', 'band4', 'band5', 'band6', 'band7', 'band8', 'band9', 'advanced'];
const JA_BAND_ORDER = ['n5', 'n4', 'n3', 'n2', 'n1'];
const LESSON_UNLOCK_PASS_PERCENT = 85;

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

function rankBandForLanguage(bandId: string, languageId: string) {
  const order = languageId === 'ja' ? JA_BAND_ORDER : ZH_BAND_ORDER;
  const index = order.indexOf((bandId || '').toLowerCase());
  return index >= 0 ? index : -1;
}

function deriveResumeFromLessonProgress(
  lessonProgress: Record<string, unknown>,
  languageId: string
) {
  const byUnit = new Map<string, ResumeTarget>();
  for (const key of Object.keys(lessonProgress || {})) {
    const [bandId, unitId, lessonIndexRaw] = key.split(':');
    if (!bandMatchesLanguage(bandId, languageId)) continue;
    if (!unitId || isPracticeUnitId(unitId) || isCheckpointUnitId(unitId) || unitId === 'daily-review') continue;
    const lessonIndex = Number(lessonIndexRaw);
    if (!Number.isFinite(lessonIndex)) continue;
    const mapKey = `${bandId}:${unitId}`;
    const existing = byUnit.get(mapKey);
    if (!existing || lessonIndex > existing.lessonIndex) {
      byUnit.set(mapKey, { bandId, unitId, lessonIndex });
    }
  }
  if (!byUnit.size) return null;
  return Array.from(byUnit.values()).sort((a, b) => {
    const bandDelta = rankBandForLanguage(b.bandId, languageId) - rankBandForLanguage(a.bandId, languageId);
    if (bandDelta !== 0) return bandDelta;
    const unitDelta = (getUnitMetadata(b.bandId, b.unitId)?.order || 0) - (getUnitMetadata(a.bandId, a.unitId)?.order || 0);
    if (unitDelta !== 0) return unitDelta;
    return b.lessonIndex - a.lessonIndex;
  })[0];
}

function hasLessonUnlockCredit(status: { completed?: boolean; quizScore?: number | null; speakScore?: number | null } | undefined) {
  return Boolean(
    status?.completed ||
    isInstructionalComplete(status?.quizScore, status?.speakScore) ||
    (status?.quizScore ?? 0) >= LESSON_UNLOCK_PASS_PERCENT
  );
}

function deriveLatestUnlockedFromLessonProgress(
  lessonProgress: Record<string, unknown>,
  languageId: string
) {
  const byUnit = new Map<string, ResumeTarget>();
  for (const key of Object.keys(lessonProgress || {})) {
    const [bandId, unitId, lessonIndexRaw] = key.split(':');
    if (!bandMatchesLanguage(bandId, languageId)) continue;
    if (!unitId || isPracticeUnitId(unitId) || isCheckpointUnitId(unitId) || unitId === 'daily-review') continue;
    const lessonIndex = Number(lessonIndexRaw);
    if (!Number.isFinite(lessonIndex)) continue;
    const status = lessonProgress[key] as {
      completed?: boolean;
      mastered?: boolean;
      quizScore?: number | null;
      speakScore?: number | null;
    } | undefined;
    if (!hasLessonUnlockCredit(status)) continue;

    const target: ResumeTarget = {
      bandId,
      unitId,
      lessonIndex,
      mode: status?.completed && !status?.mastered ? 'quiz' : undefined,
    };
    const mapKey = `${bandId}:${unitId}`;
    const existing = byUnit.get(mapKey);
    if (!existing || lessonIndex > existing.lessonIndex) {
      byUnit.set(mapKey, target);
    }
  }

  if (!byUnit.size) return null;
  return Array.from(byUnit.values()).sort((a, b) => {
    const bandDelta = rankBandForLanguage(b.bandId, languageId) - rankBandForLanguage(a.bandId, languageId);
    if (bandDelta !== 0) return bandDelta;
    const unitDelta = (getUnitMetadata(b.bandId, b.unitId)?.order || 0) - (getUnitMetadata(a.bandId, a.unitId)?.order || 0);
    if (unitDelta !== 0) return unitDelta;
    return b.lessonIndex - a.lessonIndex;
  })[0];
}

function deriveMasteryResumeFromLessonProgress(
  lessonProgress: Record<string, unknown>,
  languageId: string
) {
  const candidates: Array<ResumeTarget> = [];
  for (const key of Object.keys(lessonProgress || {})) {
    const [bandId, unitId, lessonIndexRaw] = key.split(':');
    if (!bandMatchesLanguage(bandId, languageId)) continue;
    if (!unitId || isPracticeUnitId(unitId) || isCheckpointUnitId(unitId) || unitId === 'daily-review') continue;
    const lessonIndex = Number(lessonIndexRaw);
    if (!Number.isFinite(lessonIndex)) continue;
    const status = lessonProgress[key] as { completed?: boolean; mastered?: boolean } | undefined;
    if (!status?.completed || status?.mastered) continue;
    candidates.push({ bandId, unitId, lessonIndex, mode: 'quiz' });
  }
  if (!candidates.length) return null;
  return candidates.sort((a, b) => {
    const bandDelta = rankBandForLanguage(b.bandId, languageId) - rankBandForLanguage(a.bandId, languageId);
    if (bandDelta !== 0) return bandDelta;
    const unitDelta = (getUnitMetadata(b.bandId, b.unitId)?.order || 0) - (getUnitMetadata(a.bandId, a.unitId)?.order || 0);
    if (unitDelta !== 0) return unitDelta;
    return b.lessonIndex - a.lessonIndex;
  })[0];
}

function resolveHomeLanguageId(input: {
  selectedLanguage: string;
  stateSelectedLanguage: string | null;
  currentLevelId: string | null | undefined;
  activeBandId: string | null | undefined;
  resumeBandId: string | null | undefined;
  progressBandId: string | null | undefined;
}) {
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
  const resumeFromCheckpoint: ResumeTarget | null =
    state.resumeCheckpoint &&
    bandMatchesLanguage(state.resumeCheckpoint.bandId, languageId) &&
    !isPracticeUnitId(state.resumeCheckpoint.unitId) &&
    state.resumeCheckpoint.unitId !== 'daily-review' &&
    state.resumeCheckpoint.lessonMode !== 'apply'
      ? {
          bandId: state.resumeCheckpoint.bandId,
          unitId: state.resumeCheckpoint.unitId,
          lessonIndex: state.resumeCheckpoint.lessonIndex,
          mode: state.resumeCheckpoint.lessonMode,
        }
      : null;
  const resumeFromProgress: ResumeTarget | null =
    progress.currentBandId &&
    bandMatchesLanguage(progress.currentBandId, languageId) &&
    progress.currentUnitId &&
    progress.currentLessonIdx !== null &&
    !isPracticeUnitId(progress.currentUnitId) &&
    progress.currentUnitId !== 'daily-review' &&
    !progressPathIsApply
      ? {
          bandId: progress.currentBandId,
          unitId: progress.currentUnitId,
          lessonIndex: progress.currentLessonIdx,
        }
      : null;
  const resumeFromMasteryLocalProgress: ResumeTarget | null =
    deriveMasteryResumeFromLessonProgress(state.lessonProgress || {}, languageId);
  const resumeFromLatestUnlockedLocalProgress: ResumeTarget | null =
    deriveLatestUnlockedFromLessonProgress(state.lessonProgress || {}, languageId);
  const resumeFromLocalProgress: ResumeTarget | null =
    resumeFromLatestUnlockedLocalProgress || deriveResumeFromLessonProgress(state.lessonProgress || {}, languageId);
  const resolvedResumeTarget: ResumeTarget | null =
    resumeFromLocalProgress || resumeFromMasteryLocalProgress || resumeFromCheckpoint || resumeFromProgress;
  const practiceBandId = bandMatchesLanguage(progress.currentBandId, languageId)
    ? progress.currentBandId
    : (resumeFromLocalProgress?.bandId || null);
  const hasSavedLessonPath = Boolean(resolvedResumeTarget);
  const resumeCardTitle = hasSavedLessonPath ? 'Resume' : 'Start';
  const lessonNumber = resolvedResumeTarget ? resolvedResumeTarget.lessonIndex + 1 : null;
  const cardShell =
    'dashboard-card-enter rounded-3xl border p-5 sm:p-6 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)] transition-all duration-200 hover:-translate-y-0.5';
  const needsWorkLead =
    needsWorkCount === 1
      ? '1 word ready for practice.'
      : `${needsWorkCount} words ready for practice.`;
  const needsWorkMessage =
    needsWorkCount === 0
      ? '0 words are in your practice queue. Great work. Keep reinforcing with unit practice, click Continue Learning above to begin!'
      : `${needsWorkLead} Listening & Speaking recommended.`;
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
      const sectionMatch = new RegExp(`^${bandId}-(core|expansion|integration|base-i|base-ii|widen|connect)-u(\\d+)$`, 'i').exec(unitId);
      if (sectionMatch) {
        const sectionTitle = toJapaneseSectionTitle(sectionMatch[1]);
        const sectionUnitNumber = String(Number(sectionMatch[2]));
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
        !resolvedResumeTarget ||
        isPracticeUnitId(resolvedResumeTarget.unitId) ||
        isCheckpointUnitId(resolvedResumeTarget.unitId) ||
        resolvedResumeTarget.unitId === 'daily-review'
      ) {
        if (mounted) setUnitCompletionPercent(null);
        return;
      }
      try {
        const bandLanguage = inferLanguageForBand(resolvedResumeTarget.bandId, languageId);
        const bandRes = await fetch(resolveBandDataPath(bandLanguage, resolvedResumeTarget.bandId), { cache: 'no-store' });
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
          words = (units.find((unit) => unit?.id === resolvedResumeTarget.unitId)?.words || []) as typeof words;
        } else if (units && typeof units === 'object') {
          words = (units[resolvedResumeTarget.unitId]?.words || []) as typeof words;
        }
        const coreLessonCount = getLessonRanges(words.length, 10).length;
        if (!mounted || coreLessonCount <= 0) {
          if (mounted) setUnitCompletionPercent(null);
          return;
        }
        const completedLessons = Array.from({ length: coreLessonCount }).reduce<number>((count, _, idx) => {
          const lessonKey = makeLessonKey(resolvedResumeTarget.bandId, resolvedResumeTarget.unitId, idx);
          const status = state.lessonProgress[lessonKey];
          return count + Number(Boolean(status?.completed || isInstructionalComplete(status?.quizScore, status?.speakScore)));
        }, 0);
        const masteredLessons = Array.from({ length: coreLessonCount }).reduce<number>((count, _, idx) => {
          const lessonKey = makeLessonKey(resolvedResumeTarget.bandId, resolvedResumeTarget.unitId, idx);
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
    resolvedResumeTarget,
    state.lessonProgress,
  ]);

  const openResumeCard = () => {
    if (!resolvedResumeTarget) {
      onOpenLevels();
      return;
    }

    onResumeToUnit({
      bandId: resolvedResumeTarget.bandId,
      unitId: resolvedResumeTarget.unitId,
      lessonIndex: resolvedResumeTarget.lessonIndex,
      isCheckpoint: isCheckpointUnitId(resolvedResumeTarget.unitId),
      mode: resolvedResumeTarget.mode,
    });
  };

  const glassBtnDark =
    'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold border border-white/38 bg-white/12 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/30 hover:border-white/54';
  const glassBtnPrimary =
    'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold border border-[#8FA3B8]/45 bg-[#3A4B5D] text-white transition-colors duration-200 hover:bg-[#465B70]';
  const glassBtnLight =
    'inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 border border-[#186E95]/30 bg-white/56 text-[#186E95] backdrop-blur-sm transition-all hover:bg-[#D9ECF7]/72 hover:border-[#186E95]/42';
  const glassPillLight =
    'rounded-xl text-xs border border-[#186E95]/25 bg-white/58 text-[#186E95] backdrop-blur-sm transition-all hover:bg-[#D9ECF7]/78 hover:border-[#186E95]/42';
  const glassBarShell = 'mt-2 h-2.5 w-full rounded-full overflow-hidden border border-white/28 bg-white/10 backdrop-blur-sm flex';
  const glassStatPill = 'rounded-xl border border-white/26 bg-white/12 backdrop-blur-sm px-2.5 py-2 text-left';
  const glassRowBtn =
    'w-full flex items-center justify-between px-3 py-3 rounded-2xl border border-[rgba(31,42,55,0.15)] bg-white/56 backdrop-blur-sm hover:bg-[#E8EEF4]/78 hover:border-[rgba(31,42,55,0.25)] transition-colors';

  return (
    <div className="min-h-screen page-shell px-6 with-bottom-nav relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-br from-[#186E95]/18 via-[#3E5648]/10 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-white/45 via-white/15 to-transparent pointer-events-none" />

      <GlassHeader title={`${languageLabel}`} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-[minmax(180px,auto)] relative">
        <section
          className={`${cardShell} md:order-1 md:col-span-2 bg-[#1F2A37] text-white border-[#1F2A37]/90 min-h-[210px] text-center flex flex-col justify-center shadow-[0_20px_40px_-28px_rgba(31,42,55,0.42)]`}
          style={{ animationDelay: '35ms' }}
        >
          <div className="pointer-events-none absolute inset-[8px] rounded-[1.2rem] border border-white/18" />
          <div className="text-[11px] tracking-wide font-mono uppercase text-[#C9D7E7] mb-1">
            Welcome{profileName ? `, ${profileName}` : ''}
          </div>
          <div className="main-font text-2xl leading-none mb-3 text-[#E8F1FF]">{resumeCardTitle}</div>
          {hasSavedLessonPath ? (
            <>
              <div className="text-sm text-white font-medium mb-1">{formatBandLabel(resolvedResumeTarget?.bandId || null)}</div>
              <div className="text-sm text-white/85 mb-3">
                {isCheckpointUnitId(resolvedResumeTarget?.unitId || '')
                  ? `${formatUnitLabel(resolvedResumeTarget?.unitId || null, resolvedResumeTarget?.bandId || null)} · Unit review quiz`
                  : `${formatUnitLabel(resolvedResumeTarget?.unitId || null, resolvedResumeTarget?.bandId || null)} · Lesson ${lessonNumber}`}
              </div>
              {!isCheckpointUnitId(resolvedResumeTarget?.unitId || '') && unitCompletionPercent !== null && (
                <div className="inline-flex items-center rounded-full px-3 py-1 border border-white/25 bg-white/10 text-[11px] font-mono uppercase tracking-wider text-white/90 mb-4 mx-auto">
                  Unit {unitCompletionPercent}% complete
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-white/85 mb-4">
              Choose a level to begin. After your first lesson, this card will switch to Continue Learning.
            </div>
          )}
          <div className="max-w-md mx-auto w-full">
            {hasSavedLessonPath ? (
              <button
                onClick={openResumeCard}
                className={`w-full ${glassBtnPrimary}`}
              >
                Continue Learning
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={openResumeCard}
                className={`w-full ${glassBtnDark}`}
              >
                Levels
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </section>

        <section
          className={`${cardShell} md:order-3 md:h-full bg-white text-text-dark border-[#1F2A37]/18 min-h-[260px] text-center flex flex-col justify-center relative overflow-hidden`}
          style={{ animationDelay: '135ms' }}
        >
          <div className="relative z-10 w-full h-full flex flex-col justify-between">
          <div className="main-font text-2xl leading-none mb-2 text-[#145A7D]">Travel Sprint</div>
            <p className="text-sm leading-relaxed text-text-med mb-4 max-w-md mx-auto">
              <span className="font-bold">Short on time?</span> Practice essential travel phrases before you go.
            </p>
            <div className="grid grid-cols-3 gap-2 mb-4 max-w-md mx-auto">
              <button onClick={() => onOpenTravelMode('airport-arrival')} className={`px-2 py-2 ${glassPillLight}`}>
                Airport
              </button>
              <button onClick={() => onOpenTravelMode('hotel')} className={`px-2 py-2 ${glassPillLight}`}>
                Hotel
              </button>
              <button onClick={() => onOpenTravelMode('emergency')} className={`px-2 py-2 ${glassPillLight}`}>
                Emergency
              </button>
            </div>
            <div className="max-w-md mx-auto">
              <button
                onClick={() => onOpenTravelMode()}
                className={`w-full ${glassBtnLight}`}
              >
                <BriefcaseConveyorBelt className="w-4 h-4 text-[#186E95]" />
                Explore Travel Content
                <ArrowRight className="w-4 h-4 text-[#186E95]" />
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-text-light mt-4 max-w-md mx-auto">
              Travel Sprint is separate from your structured lesson path.
            </p>
          </div>
        </section>

        <section
          className={`${cardShell} md:order-2 md:h-full bg-[#186E95] text-white border-[#186E95]/90 min-h-[210px] text-center flex flex-col justify-center shadow-[0_20px_40px_-28px_rgba(24,110,149,0.38)]`}
          style={{ animationDelay: '85ms' }}
        >
          <div className="main-font text-2xl leading-none mb-2 text-[#D7F0E4]">Practice Focus</div>
          <div className="w-full mb-3">
            <div className="inline-flex items-center rounded-full px-3 py-1 bg-white/14 border border-white/30 text-[10px] uppercase tracking-[0.22em] font-mono text-white/90 backdrop-blur-sm animate-[pulse_6.2s_ease-in-out_infinite]">
              Adaptive Mix
            </div>
            <div className={glassBarShell}>
              <div className="h-full w-[70%] bg-gradient-to-r from-white/70 via-white/62 to-white/56" />
              <div className="h-full w-[30%] bg-gradient-to-r from-white/38 via-white/30 to-white/24" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className={glassStatPill}>
                <div className="text-sm font-semibold text-center leading-none text-white">70%</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-center font-mono text-white/80">Weak Words</div>
              </div>
              <div className={glassStatPill}>
                <div className="text-sm font-semibold text-center leading-none text-white">30%</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-center font-mono text-white/80">Reinforce</div>
              </div>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-white/86 mb-4 max-w-md mx-auto">
            {selectedLanguage === 'zh' || isJapaneseLanguage
              ? needsWorkMessage
              : `Practice labs are currently available for ${languageLabel}.`}
          </p>
          {selectedLanguage === 'zh' || isJapaneseLanguage ? (
            <div className="flex items-center justify-center gap-3 max-w-md mx-auto">
              <button
                onClick={() => onOpenPractice('listening', practiceBandId)}
                className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/14 border border-white/30 backdrop-blur-sm hover:bg-black/30 hover:border-white/52 transition-colors duration-200"
                aria-label="Listening practice"
                title="Listening practice"
              >
                <Headphones className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => onOpenPractice('speaking', practiceBandId)}
                className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/14 border border-white/30 backdrop-blur-sm hover:bg-black/30 hover:border-white/52 transition-colors duration-200"
                aria-label="Speaking practice"
                title="Speaking practice"
              >
                <Mic className="w-5 h-5 text-white" />
              </button>
            </div>
          ) : (
            <div className="max-w-md mx-auto">
              <button
                onClick={onOpenLevels}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white/14 text-white border border-white/30 backdrop-blur-sm hover:bg-black/30 hover:border-white/52 transition-colors duration-200"
              >
                Continue learning
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
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
              onClick={onOpenProfile}
              className={glassRowBtn}
            >
              <span className="inline-flex items-center gap-2 text-sm text-text-dark">
                <Bolt className="w-4 h-4 text-[#1F2A37]" />
                Profile Settings
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
