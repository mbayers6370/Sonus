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
import { getUnitMetadata, isCheckpointUnitId, isPracticeUnitId } from '../data/unitMetadata';
import GlassHeader from './GlassHeader';
import { useApp } from '../contexts/AppContext';
import { apiFetch } from '../lib/apiClient';
import { getLessonRanges } from '../lib/lessonChunks';
import { QUIZ_PASS_PERCENT, SPEAK_PASS_PERCENT } from '../lib/passCriteria';
import { makeLessonKey } from '../lib/lessonProgress';

type Progress = {
  streak: number;
  currentBandId: string | null;
  currentUnitId: string | null;
  currentLessonIdx: number | null;
};

type Profile = {
  displayName?: string | null;
  email?: string | null;
};

type NeedsWorkResponse = {
  needsWork?: Array<{ wordId: string }>;
};

interface HomeDashboardProps {
  selectedLanguage: string;
  onOpenLevels: () => void;
  onResumeToUnit: (target: { bandId: string; unitId: string; lessonIndex: number; isCheckpoint: boolean }) => void;
  onOpenPractice: (kind: 'listening' | 'speaking', bandId?: string | null) => void;
  onOpenWeakWords: () => void;
  onOpenProfile: () => void;
  onOpenTravelMode: (sectionId?: string) => void;
  onOpenDailyPractice: (bandId?: string | null) => void;
}

const LANGUAGE_LABELS: Record<string, string> = {
  zh: 'Mandarin',
  jp: 'Japanese',
  kr: 'Korean',
  fr: 'French',
};

function lessonsOpenedStorageKey(languageId: string) {
  return `sonus.home.lessons_opened:${languageId}`;
}

function readLessonsOpened(languageId: string) {
  try {
    return window.localStorage.getItem(lessonsOpenedStorageKey(languageId)) === '1';
  } catch {
    return false;
  }
}

function writeLessonsOpened(languageId: string) {
  try {
    window.localStorage.setItem(lessonsOpenedStorageKey(languageId), '1');
  } catch {
    // Ignore storage failures.
  }
}

function resolveBandDataId(bandId: string) {
  if (/^band[7-9]$/i.test(bandId) || bandId === 'advanced') return 'band7-9';
  return bandId;
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
  onOpenDailyPractice,
}: HomeDashboardProps) {
  const { state } = useApp();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Progress>({
    streak: 0,
    currentBandId: null,
    currentUnitId: null,
    currentLessonIdx: null,
  });
  const [needsWorkCount, setNeedsWorkCount] = useState(0);
  const [hasOpenedLessons, setHasOpenedLessons] = useState(false);
  const [progressPathIsApply, setProgressPathIsApply] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [unitCompletionPercent, setUnitCompletionPercent] = useState<number | null>(null);

  const languageLabel = LANGUAGE_LABELS[selectedLanguage] || 'Language';
  const resumeFromCheckpoint =
    state.resumeCheckpoint &&
    !isPracticeUnitId(state.resumeCheckpoint.unitId) &&
    state.resumeCheckpoint.unitId !== 'daily-review' &&
    state.resumeCheckpoint.lessonMode !== 'apply'
      ? {
          bandId: state.resumeCheckpoint.bandId,
          unitId: state.resumeCheckpoint.unitId,
          lessonIndex: state.resumeCheckpoint.lessonIndex,
        }
      : null;
  const resumeFromProgress =
    progress.currentBandId &&
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
  const resumeTarget = resumeFromCheckpoint || resumeFromProgress;
  const hasSavedLessonPath = Boolean(resumeTarget);
  const lessonNumber = resumeTarget ? resumeTarget.lessonIndex + 1 : null;
  const cardShell =
    'dashboard-card-enter rounded-3xl border p-5 sm:p-6 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)] transition-all duration-200 hover:-translate-y-0.5';
  const nowMs = Date.now();
  const dueCount = Object.values(state.wordReview).filter((review) => Date.parse(review.nextReviewAt) <= nowMs).length;
  const recentMissCount = state.recentMisses.length;

  const formatBandLabel = (bandId: string | null) => {
    if (!bandId) return 'Band';
    const matched = /^band(\d+)$/i.exec(bandId);
    if (matched) return `Band ${matched[1]}`;
    return bandId.toUpperCase();
  };

  const formatUnitLabel = (unitId: string | null) => {
    if (!unitId) return 'Unit';
    const fromMetadata =
      progress.currentBandId && progress.currentUnitId
        ? getUnitMetadata(progress.currentBandId, progress.currentUnitId)?.name
        : undefined;
    if (fromMetadata) return fromMetadata;
    return unitId
      .replace(/^[a-z]\d+-/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  useEffect(() => {
    setHasOpenedLessons(readLessonsOpened(selectedLanguage));
  }, [selectedLanguage]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      setLoading(true);
      try {
        const [profileRes, progressRes, weakRes] = await Promise.all([
          apiFetch('/v1/me/profile'),
          apiFetch('/v1/me/progress'),
          apiFetch('/v1/me/needs-work?limit=30&minTotalMisses=3'),
        ]);

        if (mounted && profileRes.ok) {
          const profileJson = (await profileRes.json()) as { profile?: Profile };
          const displayName = profileJson.profile?.displayName?.trim();
          if (displayName) {
            setProfileName(displayName);
          } else {
            const email = profileJson.profile?.email || '';
            const emailLocalPart = email.includes('@') ? email.split('@')[0] : '';
            setProfileName(emailLocalPart || null);
          }
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
                const dataBandId = resolveBandDataId(bandId);
                const bandRes = await fetch(`/data/zh/${dataBandId}.json`, { cache: 'no-store' });
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

                  if (mounted && coreLessonCount > 0) {
                    const completedLessons = Array.from({ length: coreLessonCount }).reduce<number>((count, _, idx) => {
                      const lessonKey = makeLessonKey(bandId, unitId, idx);
                      const status = state.lessonProgress[lessonKey];
                      return count + Number(Boolean(status?.completed || isInstructionalComplete(status?.quizScore, status?.speakScore)));
                    }, 0);
                    setUnitCompletionPercent(Math.round((completedLessons / coreLessonCount) * 100));
                  } else if (mounted) {
                    setUnitCompletionPercent(null);
                  }
                } else if (mounted) {
                  setProgressPathIsApply(false);
                  setUnitCompletionPercent(null);
                }
              } catch {
                if (mounted) {
                  setProgressPathIsApply(false);
                  setUnitCompletionPercent(null);
                }
              }
            } else if (mounted) {
              setProgressPathIsApply(false);
              setUnitCompletionPercent(null);
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
  }, [selectedLanguage, state.lessonProgress]);

  const openResumeCard = () => {
    if (!hasOpenedLessons) {
      writeLessonsOpened(selectedLanguage);
      setHasOpenedLessons(true);
      onOpenLevels();
      return;
    }

    if (!resumeTarget) {
      onOpenLevels();
      return;
    }

    onResumeToUnit({
      bandId: resumeTarget.bandId,
      unitId: resumeTarget.unitId,
      lessonIndex: resumeTarget.lessonIndex,
      isCheckpoint: isCheckpointUnitId(resumeTarget.unitId),
    });
  };

  return (
    <div className="min-h-screen page-shell px-6 with-bottom-nav relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-br from-[#186E95]/18 via-[#3E5648]/10 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-white/45 via-white/15 to-transparent pointer-events-none" />

      <GlassHeader title={`${languageLabel}`} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-[minmax(180px,auto)] relative">
        <section
          className={`${cardShell} md:order-1 bg-[#374151] text-white border-[#374151]/90 min-h-[210px] text-center flex flex-col justify-center shadow-[0_20px_40px_-28px_rgba(55,65,81,0.42)]`}
          style={{ animationDelay: '35ms' }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/10 to-transparent rounded-t-3xl" />
          <div className="pointer-events-none absolute inset-[8px] rounded-[1.2rem] border border-white/18" />
          <div className="text-[11px] tracking-wide font-mono uppercase text-white/70 mb-1">
            Welcome{profileName ? `, ${profileName}` : ''}
          </div>
          <div className="main-font text-2xl leading-none mb-3 text-white">Resume</div>
          {hasSavedLessonPath ? (
            <>
              <div className="text-sm text-white font-medium mb-1">{formatBandLabel(resumeTarget?.bandId || null)}</div>
              <div className="text-sm text-white/85 mb-3">
                {isCheckpointUnitId(resumeTarget?.unitId || '')
                  ? `${formatUnitLabel(resumeTarget?.unitId || null)} · Unit review quiz`
                  : `${formatUnitLabel(resumeTarget?.unitId || null)} · Lesson ${lessonNumber}`}
              </div>
              {!isCheckpointUnitId(resumeTarget?.unitId || '') && unitCompletionPercent !== null && (
                <div className="inline-flex items-center rounded-full px-3 py-1 border border-white/25 bg-white/10 text-[11px] font-mono uppercase tracking-wider text-white/90 mb-4 mx-auto">
                  Unit {unitCompletionPercent}% complete
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-white/85 mb-4">
              {!hasOpenedLessons
                ? 'Start lessons once to set your learning path. After that, this card becomes your resume shortcut.'
                : 'No saved lesson path yet. Start your first lesson and Sonus will remember exactly where to continue.'}
            </div>
          )}
          <div className="max-w-md mx-auto">
            <button
              onClick={openResumeCard}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#374151] text-white border border-white/75 hover:bg-[#2D3748] transition-colors font-semibold"
            >
              {!hasOpenedLessons
                ? 'Start lessons'
                : hasSavedLessonPath
                  ? 'Continue learning'
                  : 'Browse lessons'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        <section
          className={`${cardShell} md:order-3 md:col-span-2 bg-[#3E5648] text-white border-[#3E5648]/90 min-h-[260px] shadow-[0_20px_40px_-28px_rgba(62,86,72,0.36)] text-center flex flex-col justify-center`}
          style={{ animationDelay: '135ms' }}
        >
          <div className="main-font text-2xl leading-none mb-2 text-white">Travel Sprint</div>
          <p className="text-sm leading-relaxed text-white/86 mb-4 max-w-md mx-auto">
            Short on time? Focus on essential travel phrases before you go.
          </p>
          <div className="grid grid-cols-3 gap-2 mb-4 max-w-md mx-auto">
            <button onClick={() => onOpenTravelMode('airport-arrival')} className="px-2 py-2 rounded-xl text-xs bg-white/10 border border-white/20 hover:bg-white/15 transition-colors">
              Airport
            </button>
            <button onClick={() => onOpenTravelMode('hotel')} className="px-2 py-2 rounded-xl text-xs bg-white/10 border border-white/20 hover:bg-white/15 transition-colors">
              Hotel
            </button>
            <button onClick={() => onOpenTravelMode('emergency')} className="px-2 py-2 rounded-xl text-xs bg-white/10 border border-white/20 hover:bg-white/15 transition-colors">
              Emergency
            </button>
          </div>
          <div className="max-w-md mx-auto">
            <button
              onClick={() => onOpenTravelMode()}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl bg-white/12 border border-white/30 hover:bg-white/18 transition-colors"
            >
              <BriefcaseConveyorBelt className="w-4 h-4" />
              Explore travel content
              <ArrowRight className="w-4 h-4 text-white/85" />
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-white/68 mt-4 max-w-md mx-auto">
            Travel Mode is separate from your structured lesson path.
          </p>
        </section>

        <section
          className={`${cardShell} md:order-2 bg-white text-text-dark border-[#186E95]/35 min-h-[210px] text-center flex flex-col justify-center`}
          style={{ animationDelay: '85ms' }}
        >
          <div className="main-font text-2xl leading-none mb-2 text-[#186E95]">Practice Focus</div>
          <div className="w-full max-w-sm mx-auto mb-3">
            <div className="inline-flex items-center rounded-full px-3 py-1 bg-[rgba(24,110,149,0.08)] border border-[#186E95]/25 text-[10px] uppercase tracking-[0.22em] font-mono text-[#186E95] animate-[pulse_3.6s_ease-in-out_infinite]">
              Adaptive Mix
            </div>
            <div className="mt-2 h-2 w-full rounded-full overflow-hidden border border-[#186E95]/18 bg-[rgba(24,110,149,0.08)] flex">
              <div className="h-full w-[70%] bg-[#186E95]" />
              <div className="h-full w-[30%] bg-[rgba(62,86,72,0.7)]" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[#186E95]/20 bg-[rgba(24,110,149,0.06)] px-2.5 py-2 text-left">
                <div className="text-sm font-semibold leading-none text-[#186E95]">70%</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] font-mono text-text-med">Weak Words</div>
              </div>
              <div className="rounded-xl border border-[#186E95]/20 bg-[rgba(24,110,149,0.06)] px-2.5 py-2 text-left">
                <div className="text-sm font-semibold leading-none text-[#3E5648]">30%</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] font-mono text-[#3E5648]">Reinforce</div>
              </div>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-text-med mb-4 max-w-md mx-auto">
            {selectedLanguage === 'zh'
              ? needsWorkCount > 0
                ? `${needsWorkCount} words are in your practice queue. Let's work on those first, then reinforce with current-band reps!`
                : 'Use this as a helper while you learn. Come back anytime for focused reps to keep your skills sharp.'
              : `Practice labs are currently available for ${languageLabel}.`}
          </p>
          {selectedLanguage === 'zh' ? (
            <div className="flex items-center justify-center gap-3 max-w-md mx-auto">
              <button
                onClick={() => onOpenPractice('listening', progress.currentBandId)}
                className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[rgba(24,110,149,0.10)] border border-[#186E95]/28 hover:bg-[rgba(24,110,149,0.16)] transition-colors"
                aria-label="Listening practice"
                title="Listening practice"
              >
                <Headphones className="w-5 h-5 text-[#186E95]" />
              </button>
              <button
                onClick={() => onOpenPractice('speaking', progress.currentBandId)}
                className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[rgba(24,110,149,0.10)] border border-[#186E95]/28 hover:bg-[rgba(24,110,149,0.16)] transition-colors"
                aria-label="Speaking practice"
                title="Speaking practice"
              >
                <Mic className="w-5 h-5 text-[#186E95]" />
              </button>
            </div>
          ) : (
            <div className="max-w-md mx-auto">
              <button
                onClick={onOpenLevels}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#186E95] text-white hover:bg-[#145C7C] transition-colors"
              >
                Continue learning
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </section>

        <section
          className={`${cardShell} md:order-4 md:col-span-2 bg-white text-text-dark border-[#374151]/35 flex flex-col justify-center`}
          style={{ animationDelay: '235ms' }}
        >
          <div className="main-font text-2xl leading-none mb-3 text-[#374151]">Shortcuts</div>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => onOpenDailyPractice(progress.currentBandId)}
              className="w-full flex items-center justify-between px-3 py-3 rounded-2xl border border-border hover:bg-[rgba(55,65,81,0.06)] transition-colors"
            >
              <span className="inline-flex items-center gap-2 text-sm text-text-dark">
                <ListChecks className="w-4 h-4 text-[#186E95]" />
                Daily Review Set
              </span>
              <span className="text-xs text-text-light">{Math.min(5, dueCount + recentMissCount)} queued</span>
            </button>
            <button
              onClick={onOpenWeakWords}
              className="w-full flex items-center justify-between px-3 py-3 rounded-2xl border border-border hover:bg-[rgba(55,65,81,0.06)] transition-colors"
            >
              <span className="inline-flex items-center gap-2 text-sm text-text-dark">
                <ListChecks className="w-4 h-4 text-[#3E5648]" />
                Progress Check
              </span>
              <ArrowRight className="w-4 h-4 text-text-light" />
            </button>
            <button
              onClick={onOpenProfile}
              className="w-full flex items-center justify-between px-3 py-3 rounded-2xl border border-border hover:bg-[rgba(55,65,81,0.06)] transition-colors"
            >
              <span className="inline-flex items-center gap-2 text-sm text-text-dark">
                <Bolt className="w-4 h-4 text-[#374151]" />
                Profile Settings
              </span>
              <ArrowRight className="w-4 h-4 text-text-light" />
            </button>
          </div>
        </section>
      </div>

      {loading && <div className="mt-4 text-xs text-text-light">Refreshing dashboard data...</div>}

      <BottomNav active="home" onHome={() => {}} onProfile={onOpenProfile} />
    </div>
  );
}
