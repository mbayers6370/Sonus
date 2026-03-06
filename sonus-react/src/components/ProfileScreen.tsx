import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  BookOpen,
  Flame,
  BadgeCheck,
  ChevronRight,
  PencilLine,
  Flag,
  Languages,
  LogOut,
  UserRound,
} from 'lucide-react';
import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { SurfaceButtonCard, SurfaceCard } from './ui/SurfaceCard';
import { formatUnitNameForDisplay, getUnitMetadata, getUnitsForBand, isCheckpointUnitId, isPracticeUnitId } from '../data/unitMetadata';
import { QUIZ_PASS_PERCENT, SPEAK_PASS_PERCENT } from '../lib/passCriteria';
import { normalizeLanguageId } from '../lib/languageRuntime';
import type { SharedUserProgress } from '../../../shared/contracts';

const LANGUAGE_ACCENT_HEX: Record<string, string> = {
  zh: '#DE2910',
  ja: '#BC002D',
  kr: '#0047A0',
  fr: '#0055A4',
  it: '#009246',
  es: '#AA151B',
};

const CARD_ACCENTS_BY_LANGUAGE: Record<string, {
  borderColor: string;
  innerBorderColor: string;
  surfaceTint: string;
}> = {
  zh: {
    borderColor: 'border-[#DE2910]/58',
    innerBorderColor: 'border-[#DE2910]/34',
    surfaceTint: 'bg-white',
  },
  ja: {
    borderColor: 'border-[#BC002D]/58',
    innerBorderColor: 'border-[#BC002D]/34',
    surfaceTint: 'bg-white',
  },
  kr: {
    borderColor: 'border-[#0047A0]/58',
    innerBorderColor: 'border-[#0047A0]/34',
    surfaceTint: 'bg-white',
  },
  fr: {
    borderColor: 'border-[#0055A4]/58',
    innerBorderColor: 'border-[#0055A4]/34',
    surfaceTint: 'bg-white',
  },
  it: {
    borderColor: 'border-[#009246]/58',
    innerBorderColor: 'border-[#009246]/34',
    surfaceTint: 'bg-white',
  },
  es: {
    borderColor: 'border-[#AA151B]/58',
    innerBorderColor: 'border-[#AA151B]/34',
    surfaceTint: 'bg-white',
  },
};

function LanguageCardBackdrop({
  langId,
  isCurrent,
}: {
  langId: string;
  isCurrent: boolean;
}) {
  const color = isCurrent ? '#FFFFFF' : (LANGUAGE_ACCENT_HEX[langId] || LANGUAGE_ACCENT_HEX.zh);
  const strokeOpacity = isCurrent ? 0.2 : 0.11;
  const fillOpacity = isCurrent ? 0.09 : 0.05;
  const commonStroke = {
    stroke: color,
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
    opacity: strokeOpacity,
  };

  const motifs: Record<string, ReactNode> = {
    zh: (
      <>
        <circle cx="252" cy="62" r="42" fill={color} opacity={fillOpacity} />
        <path d="M214 62h76M252 24v76M226 36h52M226 88h52M236 46v32M268 46v32" {...commonStroke} />
        <path d="M42 190c34-18 77-20 116-8" {...commonStroke} />
      </>
    ),
    ja: (
      <>
        <circle cx="250" cy="60" r="46" fill={color} opacity={fillOpacity} />
        <path d="M28 176c30-16 62-20 95-13s63 6 92-6" {...commonStroke} />
        <path d="M40 194c30-16 62-20 95-13s63 6 92-6" {...commonStroke} />
      </>
    ),
    kr: (
      <>
        <circle cx="246" cy="62" r="42" fill={color} opacity={fillOpacity} />
        <path d="M218 62c0-15 12-27 28-27s28 12 28 27-12 27-28 27-28-12-28-27z" {...commonStroke} />
        <path d="M40 36h36M40 48h36M40 60h36M248 158h36M248 170h36M248 182h36" {...commonStroke} />
      </>
    ),
    fr: (
      <>
        <path d="M40 182c24-56 58-86 104-90 34-3 68 10 102 40" {...commonStroke} />
        <path d="M54 188c22-46 50-70 86-74" {...commonStroke} />
        <circle cx="260" cy="56" r="28" fill={color} opacity={fillOpacity} />
      </>
    ),
    it: (
      <>
        <path d="M30 188c28-24 62-38 102-40 34-2 70 8 108 30" {...commonStroke} />
        <path d="M34 204h226" {...commonStroke} />
        <path d="M238 36v56M254 36v56M270 36v56" {...commonStroke} />
      </>
    ),
    es: (
      <>
        <circle cx="254" cy="64" r="28" fill={color} opacity={fillOpacity} />
        <path d="M254 18v18M254 92v18M208 64h18M282 64h18M224 34l12 12M272 82l12 12M224 94l12-12M272 46l12-12" {...commonStroke} />
        <path d="M42 192c26-26 56-40 90-42 34-2 66 8 98 30" {...commonStroke} />
      </>
    ),
  };

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        viewBox="0 0 320 240"
        className="h-full w-full"
        aria-hidden="true"
        focusable="false"
      >
        {motifs[langId] || motifs.zh}
      </svg>
    </div>
  );
}

type Profile = {
  displayName: string | null;
  targetLanguage: string | null;
  timezone: string | null;
  onboardingComplete: boolean;
  email: string | null;
};

type Progress = SharedUserProgress;

interface ProfileScreenProps {
  onOpenProgress: () => void;
  onOpenAbout: () => void;
  onGoHome: () => void;
  currentLearningLanguage: string | null;
  onSwitchLanguage: (languageId: string) => void | Promise<void>;
}

function inferUnitFromLessonProgress(
  bandId: string | null,
  lessonProgress: Record<string, unknown>,
  bandData?: { units?: Array<{ id?: string }> | Record<string, { id?: string }> } | null
) {
  if (!bandId) return null;
  const unitIds = new Set<string>();
  for (const key of Object.keys(lessonProgress || {})) {
    const [keyBandId, keyUnitId] = key.split(':');
    if (keyBandId === bandId && keyUnitId) {
      unitIds.add(keyUnitId);
    }
  }
  const orderedCoreUnits = getUnitsForBand(bandId, bandData)
    .filter((unit) => !isCheckpointUnitId(unit.id) && !isPracticeUnitId(unit.id))
    .map((unit) => unit.id);
  const latestStarted = orderedCoreUnits.filter((unitId) => unitIds.has(unitId)).at(-1);
  return latestStarted ?? null;
}

function isInstructionalComplete(quizScore: number | null | undefined, speakScore: number | null | undefined) {
  return (quizScore ?? 0) >= QUIZ_PASS_PERCENT && (speakScore ?? 0) >= SPEAK_PASS_PERCENT;
}

function bandMatchesLanguage(bandId: string | null | undefined, languageId: string | null) {
  if (!bandId || !languageId) return false;
  if (languageId === 'ja') return /^n[1-5]$/i.test(bandId);
  if (languageId === 'zh') return /^band\d+$/i.test(bandId) || bandId === 'advanced';
  return true;
}

export default function ProfileScreen({
  onOpenProgress,
  onOpenAbout,
  onGoHome,
  currentLearningLanguage,
  onSwitchLanguage,
}: ProfileScreenProps) {
  const { state } = useApp();
  const { isDemo, signOut, email: authEmail } = useAuth();
  const resolvedCurrentLearningLanguage = currentLearningLanguage
    ? normalizeLanguageId(currentLearningLanguage)
    : null;
  const [saving, setSaving] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [backendOffline, setBackendOffline] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('');
  const [timezone, setTimezone] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [switchingLanguage, setSwitchingLanguage] = useState(false);

  const languageNameById: Record<string, string> = {
    zh: 'Mandarin',
    ja: 'Japanese',
    kr: 'Korean',
    ko: 'Korean',
    fr: 'French',
    es: 'Spanish',
    de: 'German',
  };
  const switchableLanguages: Array<{
    id: string;
    name: string;
    nativeName: string;
    frameworkTitle: string;
    frameworkRange: string;
    available: boolean;
  }> = [
    { id: 'zh', name: 'Mandarin', nativeName: '普通话', frameworkTitle: 'HSK 3.0', frameworkRange: 'Bands 1 - 9', available: true },
    { id: 'ja', name: 'Japanese', nativeName: '日本語', frameworkTitle: 'JLPT', frameworkRange: 'N5 - N1', available: true },
    { id: 'kr', name: 'Korean', nativeName: '한국어', frameworkTitle: 'TOPIK', frameworkRange: 'Levels 1 - 6', available: false },
    { id: 'fr', name: 'French', nativeName: 'Français', frameworkTitle: 'CEFR', frameworkRange: 'A1 - C2', available: false },
    { id: 'it', name: 'Italian', nativeName: 'Italiano', frameworkTitle: 'CEFR', frameworkRange: 'A1 - C2', available: false },
    { id: 'es', name: 'Spanish', nativeName: 'Español', frameworkTitle: 'CEFR', frameworkRange: 'A1 - C2', available: false },
  ];
  const activeLanguageName = resolvedCurrentLearningLanguage
    ? (languageNameById[resolvedCurrentLearningLanguage] || 'Language')
    : null;
  const languageScopedProgressBandId =
    bandMatchesLanguage(progress?.currentBandId, resolvedCurrentLearningLanguage)
      ? progress?.currentBandId
      : null;
  const languageScopedResumeBandId =
    bandMatchesLanguage(state.resumeCheckpoint?.bandId, resolvedCurrentLearningLanguage)
      ? state.resumeCheckpoint?.bandId
      : null;
  const languageScopedActiveBandId =
    bandMatchesLanguage(state.activeBandId, resolvedCurrentLearningLanguage)
      ? state.activeBandId
      : null;
  const languageScopedCurrentLevelBandId =
    bandMatchesLanguage(state.currentLevel?.id, resolvedCurrentLearningLanguage)
      ? state.currentLevel?.id
      : null;
  const languageScopedProgressUnitId =
    languageScopedProgressBandId ? progress?.currentUnitId : null;
  const languageScopedProgressLessonIdx =
    languageScopedProgressBandId ? progress?.currentLessonIdx : null;

  const effectiveBandId =
    languageScopedProgressBandId ??
    languageScopedResumeBandId ??
    languageScopedActiveBandId ??
    languageScopedCurrentLevelBandId ??
    null;
  const activeBandDataForProgress =
    effectiveBandId && state.activeBandId === effectiveBandId ? state.activeBandData : null;
  const inferredUnitId = inferUnitFromLessonProgress(
    effectiveBandId,
    state.lessonProgress || {},
    activeBandDataForProgress
  );
  const effectiveUnitId =
    languageScopedProgressUnitId ??
    state.resumeCheckpoint?.unitId ??
    state.activeUnitId ??
    state.activeLesson?.unitId ??
    inferredUnitId ??
    null;
  const effectiveLessonIdx =
    typeof languageScopedProgressLessonIdx === 'number'
      ? languageScopedProgressLessonIdx
      : (state.resumeCheckpoint?.lessonIndex ?? state.activeLesson?.lessonIndex ?? null);
  const lessonsCompleted = Object.entries(state.lessonProgress || {}).filter(([key, progressEntry]) => {
      const entry = progressEntry as {
        completed?: boolean;
        quizScore?: number | null;
        speakScore?: number | null;
      };
      const [bandId, unitId] = key.split(':');
      if (!bandMatchesLanguage(bandId, resolvedCurrentLearningLanguage)) return false;
      if (unitId === 'daily-review') return false;
      if (isCheckpointUnitId(unitId) || isPracticeUnitId(unitId)) return false;
      return Boolean(entry.completed || isInstructionalComplete(entry.quizScore, entry.speakScore));
    }).length;
  const currentUnitMeta =
    effectiveBandId && effectiveUnitId
      ? getUnitMetadata(effectiveBandId, effectiveUnitId, activeBandDataForProgress)
      : null;
  const currentLessonNumber =
    typeof effectiveLessonIdx === 'number' && effectiveLessonIdx >= 0
      ? effectiveLessonIdx + 1
      : null;
  const currentUnitAndLesson = effectiveUnitId
    ? `${formatUnitNameForDisplay(currentUnitMeta?.name) || 'Current Unit'}${currentLessonNumber ? ` · Lesson ${currentLessonNumber}` : ''}`
    : 'Not started';
  const isLastActiveToday = (() => {
    if (!progress?.lastActiveDate) return false;
    const last = new Date(progress.lastActiveDate);
    const now = new Date();
    return (
      last.getFullYear() === now.getFullYear() &&
      last.getMonth() === now.getMonth() &&
      last.getDate() === now.getDate()
    );
  })();
  const streakDisplay = Math.max(progress?.streak ?? 0, isLastActiveToday ? 1 : 0, 1);
  const isLanguageSwitchNotice = Boolean(saveMessage && /^Language switched to\b/i.test(saveMessage));

  const loadProfile = useCallback(async () => {
    setError(null);
    setSaveMessage(null);
    setBackendOffline(false);
    try {
      const [profileRes, progressRes] = await Promise.all([
        apiFetch('/v1/me/profile'),
        apiFetch('/v1/me/progress'),
      ]);

      if (profileRes.status === 401 || profileRes.status === 403 || progressRes.status === 401 || progressRes.status === 403) {
        if (!isDemo) {
          signOut();
          return;
        }
        throw new Error('Demo auth unavailable');
      }

      if (!profileRes.ok || !progressRes.ok) {
        throw new Error('Failed to load profile');
      }

      const profileJson = (await profileRes.json()) as { profile: Profile };
      const progressJson = (await progressRes.json()) as { progress: Progress };
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const resolvedTimezone = profileJson.profile.timezone || browserTimezone || '';
      setProfile(profileJson.profile);
      setProgress(progressJson.progress);
      setDisplayName(profileJson.profile.displayName || '');
      setTargetLanguage(profileJson.profile.targetLanguage || '');
      setTimezone(resolvedTimezone);
    } catch {
      setBackendOffline(true);
      setError(null);
      // Preserve existing user identity/progress on transient backend failures.
      setProfile((prev) => prev ?? {
        displayName: null,
        targetLanguage: resolvedCurrentLearningLanguage || null,
        timezone: timezone || null,
        onboardingComplete: false,
        email: authEmail || null,
      });
      setProgress((prev) => prev ?? {
        streak: 0,
        lastActiveDate: null,
        currentBandId: null,
        currentUnitId: null,
        currentLessonIdx: null,
      });
      if (!timezone.trim()) {
        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        if (browserTimezone) {
          setTimezone(browserTimezone);
        }
      }
    }
  }, [authEmail, isDemo, resolvedCurrentLearningLanguage, signOut, timezone]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const onFocus = () => {
      void loadProfile();
    };
    const onVisibilityChange = () => {
      if (!document.hidden) {
        void loadProfile();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [loadProfile]);

  useEffect(() => {
    if (!saveMessage) return;
    const timer = window.setTimeout(() => {
      setSaveMessage(null);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [saveMessage]);

  const saveProfile = async () => {
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const response = await apiFetch('/v1/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim() || undefined,
          targetLanguage: targetLanguage.trim() || undefined,
          timezone: timezone.trim() || undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to save profile');
      const json = (await response.json()) as { profile: Profile };
      setProfile(json.profile);
      setSaveMessage('Profile saved.');
      setProfileEditorOpen(false);
    } catch (err) {
      setError((err as Error).message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    if (deletingAccount) return;
    const confirmed = window.confirm(
      'Delete account permanently? This removes profile, progress, attempts, and review history.'
    );
    if (!confirmed) return;

    setDeletingAccount(true);
    setError(null);
    setSaveMessage(null);
    try {
      const response = await apiFetch('/v1/me/account', { method: 'DELETE' });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to delete account');
      }
      signOut();
    } catch (err) {
      setError((err as Error).message || 'Failed to delete account');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleLanguageSwitch = async (languageId: string) => {
    if (switchingLanguage) return;
    if (!switchableLanguages.some((lang) => lang.id === languageId && lang.available)) return;
    if (resolvedCurrentLearningLanguage === languageId) {
      setLanguagePickerOpen(false);
      return;
    }
    setSwitchingLanguage(true);
    setError(null);
    setSaveMessage(null);
    try {
      await onSwitchLanguage(languageId);
      setLanguagePickerOpen(false);
      setSaveMessage(`Language switched to ${languageNameById[languageId] || 'selected language'}.`);
    } catch (err) {
      setError((err as Error).message || 'Failed to switch language.');
    } finally {
      setSwitchingLanguage(false);
    }
  };

  return (
    <div className="min-h-screen page-shell px-6 with-bottom-nav">
      <GlassHeader title="Profile" />

      <div className="space-y-4">
        {backendOffline && (
          <div className="bg-white border border-border rounded-2xl p-4 text-sm text-text-med">
            Backend appears offline. Showing local profile view.
          </div>
        )}

        {error && (
          <div className="bg-white border border-[#C2410C] rounded-2xl p-4 text-sm text-[#C2410C]">
            {error}
          </div>
        )}

        {saveMessage && (
          <div
            className={`bg-white rounded-2xl p-4 text-sm ${
              isLanguageSwitchNotice
                ? 'border border-[#C56A3D] text-[#C56A3D]'
                : 'border border-[#3E5648] text-[#3E5648]'
            }`}
          >
            {saveMessage}
          </div>
        )}

        <SurfaceCard className="relative p-6 sm:p-7 shadow-[0_20px_42px_-34px_rgba(31,42,55,0.28)]">
          <div className="flex flex-col items-center gap-2.5 text-center sm:gap-3">
            <div className="w-11 h-11 rounded-full bg-[rgba(24,110,149,0.12)] border border-[rgba(24,110,149,0.22)] flex items-center justify-center text-[#186E95]">
              <UserRound className="w-5 h-5" />
            </div>
            <div className="w-full max-w-[20rem] px-1">
              <div className="text-lg font-semibold text-text-dark leading-tight break-words">
                {displayName.trim() || 'Learner'}
              </div>
              <div className="mt-1 text-sm text-text-med leading-snug break-all">
                {profile?.email || '—'}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span className="inline-flex items-center rounded-full border border-border bg-[rgba(31,42,55,0.06)] px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider text-text-med">
                {activeLanguageName ? `Target: ${activeLanguageName}` : 'Target: Not set'}
              </span>
            </div>
            <button
              onClick={signOut}
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-text-light hover:text-text-dark transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {isDemo ? 'Exit Demo' : 'Sign Out'}
            </button>
          </div>
          <button
            onClick={() => setProfileEditorOpen(true)}
            aria-label="Edit profile"
            title="Edit profile"
            className="absolute bottom-7 right-8 inline-flex items-center justify-center text-text-light hover:text-text-dark transition-colors"
          >
            <PencilLine className="w-3.5 h-3.5" />
          </button>
        </SurfaceCard>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2.5 items-stretch">
          <SurfaceButtonCard
            onClick={onOpenProgress}
            className="h-full min-h-[150px] p-4 text-center flex flex-col items-center !bg-[#186E95] !text-white !border-[#186E95]/90 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_rgba(24,110,149,0.38)] active:translate-y-0 lg:col-span-2"
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="inline-flex items-center rounded-full px-3 py-1 bg-white/14 border border-white/28 text-[10px] uppercase tracking-[0.2em] font-mono text-white/90">
                Progress Snapshot
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full">
              <div className="rounded-2xl border border-white/28 bg-white/10 p-3 col-span-2">
                <div className="inline-flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider font-mono text-white/90">
                  <BookOpen className="w-3.5 h-3.5" />
                  Lessons Completed
                </div>
                <div className="text-2xl font-semibold text-white leading-none mt-2">{lessonsCompleted}</div>
              </div>
              <div className="rounded-2xl border border-white/28 bg-white/12 p-3 col-span-2">
                <div className="inline-flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider font-mono text-white/90">
                  <Flag className="w-3.5 h-3.5" />
                  Current Unit + Lesson
                </div>
                <div className="text-sm font-semibold text-white leading-tight mt-2">{currentUnitAndLesson}</div>
              </div>
              <div className="rounded-2xl border border-white/28 bg-white/12 p-3 col-span-2">
                <div className="inline-flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider font-mono text-white/90">
                  <Flame className="w-3.5 h-3.5" />
                  Streak
                </div>
                <div className="text-2xl font-semibold text-white leading-none mt-2">{streakDisplay}</div>
              </div>
            </div>

            <div className="pt-2.5">
              <span className="inline-flex items-center text-xs text-white font-semibold">
                Open full progress →
              </span>
            </div>
          </SurfaceButtonCard>

          <SurfaceCard className="relative h-full min-h-[150px] overflow-hidden p-4 sm:p-5 lg:col-span-1">
            <div className="pointer-events-none absolute -right-14 -top-14 h-32 w-32 rounded-full bg-[rgba(24,110,149,0.13)] blur-2xl" />
            <div className="pointer-events-none absolute -left-10 -bottom-14 h-28 w-28 rounded-full bg-[rgba(62,86,72,0.12)] blur-2xl" />

            <div className="relative flex h-full flex-col">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(24,110,149,0.28)] bg-[rgba(24,110,149,0.10)] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-[#186E95]">
                  <Languages className="h-3.5 w-3.5" />
                  Language
                </div>
                <h3 className="mt-2 text-[1.15rem] font-semibold leading-tight text-text-dark">Change Learning Language</h3>
                <p className="mt-1 text-xs leading-relaxed text-text-med">
                  Switch your active dashboard language. Progress remains saved.
                </p>
              </div>

              <div className="mt-3 rounded-2xl border border-[rgba(24,110,149,0.18)] bg-white/85 p-3">
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-text-light">Current</div>
                <div className="mt-1.5 inline-flex items-center rounded-full border border-[#186E95]/25 bg-[rgba(24,110,149,0.08)] px-3 py-1 text-xs font-semibold text-[#186E95]">
                  {activeLanguageName || 'Not set'}
                </div>

                <div className="mt-3 space-y-2.5">
                  <button
                    onClick={() => setLanguagePickerOpen(true)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#186E95] px-3 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-18px_rgba(24,110,149,0.55)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    Switch Language
                  </button>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-[rgba(24,110,149,0.14)] bg-[rgba(24,110,149,0.04)] px-3 py-2.5 text-[11px] leading-relaxed text-[#4D6075]">
                Your lessons, streak, and progress stay tied to your account.
              </div>
            </div>
          </SurfaceCard>

          <div className="space-y-2.5 lg:col-span-1 lg:h-full lg:flex lg:flex-col">
            <SurfaceButtonCard
              onClick={onOpenAbout}
              className="w-full min-h-[150px] lg:flex-1 !bg-[#1F2A37] !border-transparent p-4 text-left !text-white flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_rgba(31,42,55,0.45)] active:translate-y-0"
            >
              <div>
                <div className="font-semibold text-white">About Sonus</div>
                <div className="text-sm text-white/80">Why the system uses national proficiency frameworks</div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/80" />
            </SurfaceButtonCard>
            {!isDemo && (
              <SurfaceButtonCard
                onClick={() => void deleteAccount()}
                disabled={deletingAccount}
                className="w-full min-h-[150px] lg:flex-1 !bg-[#C2410C] !border-transparent p-4 text-left !text-white flex flex-col justify-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_rgba(194,65,12,0.45)] active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                <div className="font-semibold text-white">
                  {deletingAccount ? 'Deleting Account…' : 'Delete Account'}
                </div>
                <div className="text-sm text-white/85">Permanently remove account and learning data.</div>
              </SurfaceButtonCard>
            )}
          </div>
        </div>
      </div>

      <BottomNav active="profile" onHome={onGoHome} onProfile={() => {}} />

      {profileEditorOpen && (
        <div className="fixed inset-0 bg-black/35 z-[70] flex items-center justify-center px-6">
          <div className="w-full max-w-md bg-white border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-text-dark mb-3">Edit Profile</h3>
            <div className="space-y-3">
              <label className="block">
                <div className="text-xs uppercase tracking-wider text-text-light font-mono mb-1">Display Name</div>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white"
                  placeholder="Your name"
                />
              </label>
              <label className="block">
                <div className="text-xs uppercase tracking-wider text-text-light font-mono mb-1 flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5" />
                  Target Language
                </div>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white"
                >
                  <option value="">Select language</option>
                  <option value="zh">Chinese (Mandarin)</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                </select>
              </label>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setProfileEditorOpen(false)}
                className="flex-1 px-3 py-2 rounded-lg border border-border text-sm text-text-dark"
              >
                Cancel
              </button>
              <button
                onClick={() => void saveProfile()}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#186E95] text-white text-sm font-semibold disabled:opacity-60"
              >
                <BadgeCheck className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {languagePickerOpen && (
        <div className="fixed inset-0 bg-black/35 z-[70] flex items-center justify-center px-6">
          <div className="w-full max-w-lg bg-white border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-text-dark mb-1">Switch Language</h3>
            <p className="text-sm text-text-med mb-4">
              Choose your active learning language. Your progress is saved per language.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {switchableLanguages.map((language) => {
                const isCurrent = resolvedCurrentLearningLanguage === language.id;
                const isAvailable = language.available;
                const accent = CARD_ACCENTS_BY_LANGUAGE[language.id] || CARD_ACCENTS_BY_LANGUAGE.zh;
                return (
                  <button
                    key={language.id}
                    onClick={() => void handleLanguageSwitch(language.id)}
                    disabled={switchingLanguage || !isAvailable || isCurrent}
                    className={`group relative w-full min-h-[148px] overflow-hidden rounded-2xl border p-3 text-center transition-all ${
                      isCurrent
                        ? 'bg-[#1F2A37] border-[#1F2A37]/90'
                        : isAvailable
                          ? `${accent.surfaceTint} ${accent.borderColor} hover:-translate-y-0.5`
                          : 'bg-[#F8FAFC] border-[#CBD5E1]'
                    } disabled:opacity-70`}
                  >
                    <LanguageCardBackdrop langId={language.id} isCurrent={isCurrent} />
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/18 to-transparent" />
                    <div className={`pointer-events-none absolute inset-[7px] rounded-xl border ${isCurrent ? 'border-white/18' : accent.innerBorderColor}`} />
                    <div className="relative z-10 flex h-full items-center justify-center px-2">
                      <div className="w-full">
                        <div className={`text-sm font-semibold ${isCurrent ? 'text-white' : isAvailable ? 'text-text-dark' : 'text-[#64748B]'}`}>{language.name}</div>
                        <div className={`mt-0.5 text-xs ${isCurrent ? 'text-white/85' : isAvailable ? 'text-text-med' : 'text-[#94A3B8]'}`}>{language.nativeName}</div>
                        <div className={`mt-2 text-[10px] font-mono uppercase tracking-[0.14em] ${isCurrent ? 'text-white/80' : isAvailable ? 'text-text-med' : 'text-[#9CA3AF]'}`}>
                          <div>{language.frameworkTitle}</div>
                          <div className="mt-0.5">{language.frameworkRange}</div>
                        </div>
                        {isCurrent ? (
                          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#C56A3D]">
                            Current
                          </p>
                        ) : !isAvailable ? (
                          <p className="mt-2 text-[11px] leading-relaxed text-[#94A3B8]">
                            Coming soon.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setLanguagePickerOpen(false)}
                disabled={switchingLanguage}
                className="flex-1 px-3 py-2 rounded-lg border border-border text-sm text-text-dark disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
