import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Monitor,
  KeyRound,
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
import { getTrackedEvents, isLessonActivityEventName } from '../lib/analytics';
import type { SharedUserProgress } from '../../../shared/contracts';

const LANGUAGE_ACCENT_HEX: Record<string, string> = {
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
  const color = isCurrent ? '#FFFFFF' : (LANGUAGE_ACCENT_HEX[langId] || LANGUAGE_ACCENT_HEX.ja);
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
        {motifs[langId] || motifs.ja}
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
  return true;
}

function formatUnitFallbackLabel(unitId: string | null | undefined) {
  const value = (unitId || '').trim();
  if (!value) return 'Unit #';
  const match = value.match(/(\d+)(?!.*\d)/);
  if (match) return `Unit ${match[1]}`;
  return 'Unit #';
}

function toLocalDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateCurrentCompletionStreak(completedDayKeys: Set<string>) {
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (completedDayKeys.has(toLocalDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
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
  const [timezone, setTimezone] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [switchingLanguage, setSwitchingLanguage] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState('Current device');

  const languageNameById: Record<string, string> = {
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
    ? `${formatUnitNameForDisplay(currentUnitMeta?.name) || formatUnitFallbackLabel(effectiveUnitId)}${currentLessonNumber ? ` · Lesson ${currentLessonNumber}` : ''}`
    : 'Not started';
  const completedDayKeys = useMemo(() => {
    const keys = new Set<string>();
    const events = getTrackedEvents();
    for (const event of events) {
      if (!isLessonActivityEventName(event.name)) continue;
      const ts = new Date(event.timestamp);
      if (Number.isNaN(ts.getTime())) continue;
      ts.setHours(0, 0, 0, 0);
      keys.add(toLocalDayKey(ts));
    }
    return keys;
  }, []);
  const streakDisplay = useMemo(
    () => calculateCurrentCompletionStreak(completedDayKeys),
    [completedDayKeys]
  );

  const activityTrackerDays = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = toLocalDayKey(today);

    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - index));
      const key = toLocalDayKey(day);
      return {
        key,
        label: day.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1).toUpperCase(),
        dayOfMonth: day.getDate(),
        isActive: completedDayKeys.has(key),
        isToday: key === todayKey,
      };
    });
  })();
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

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) {
      setDeviceLabel('iOS device');
      return;
    }
    if (/Android/i.test(ua)) {
      setDeviceLabel('Android device');
      return;
    }
    if (/Macintosh|Mac OS X/i.test(ua)) {
      setDeviceLabel('Mac device');
      return;
    }
    if (/Windows/i.test(ua)) {
      setDeviceLabel('Windows device');
      return;
    }
    setDeviceLabel('Web browser session');
  }, []);

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
    setDeletingAccount(true);
    setError(null);
    setSaveMessage(null);
    try {
      const response = await apiFetch('/v1/me/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'User requested account deletion from profile settings.',
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to delete account');
      }
      setDeleteModalOpen(false);
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
      <GlassHeader title="Profile" hideLogoOnMobile />

      <div className="mx-auto max-w-6xl space-y-6">
        {backendOffline && (
          <div className="bg-white border border-border rounded-2xl p-5 text-sm text-text-med">
            Backend appears offline. Showing local profile view.
          </div>
        )}

        {error && (
          <div className="bg-white border border-[var(--sonus-palette-rust)] rounded-2xl p-5 text-sm text-[var(--sonus-palette-rust)]">
            {error}
          </div>
        )}

        {saveMessage && (
          <div
            className={`bg-white rounded-2xl p-5 text-sm ${
              isLanguageSwitchNotice
                ? 'border border-[#C56A3D] text-[#C56A3D]'
                : 'border border-[var(--sonus-palette-green)] text-[var(--sonus-palette-green)]'
            }`}
          >
            {saveMessage}
          </div>
        )}

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <SurfaceCard className="relative overflow-hidden border sonus-drenched-border-charcoal !bg-[var(--sonus-palette-charcoal)] p-5 text-white shadow-[0_24px_52px_-34px_rgba(15,23,42,0.62)] lg:col-span-12">
            <div className="relative mx-auto max-w-4xl text-center">
              <div className="mt-2.5 flex flex-col items-center gap-2.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-transparent text-[#A7E1DC]">
                  <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="main-font text-[2.25rem] font-semibold leading-none text-white break-words">
                    {displayName.trim() || 'Learner'}
                  </h2>
                  <p className="mt-1.5 text-sm leading-snug text-white/80 break-all">{profile?.email || '—'}</p>
                </div>
              </div>
              <div
                id="tour-profile-language-card"
                className="mt-4 mx-auto w-full max-w-[360px] rounded-xl border border-white/14 bg-white/[0.03] sm:max-w-[420px]"
              >
                <div className="grid grid-cols-1">
                  <div className="px-4 py-3 text-center">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#A7E1DC]">Language</p>
                    <p className="mt-1 text-base font-semibold text-white">{activeLanguageName || 'Not set'}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-2">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    id="tour-profile-switch-language-button"
                    onClick={() => setLanguagePickerOpen(true)}
                    className="inline-flex h-10 min-w-[152px] items-center justify-center gap-2 rounded-xl border border-[var(--sonus-palette-blue)] bg-[var(--sonus-palette-blue)] px-3 text-sm font-semibold text-white transition-all hover:bg-[#145B7A]"
                  >
                    <Languages className="h-4 w-4" />
                    Switch Language
                  </button>
                  <button
                    onClick={signOut}
                    className="inline-flex h-10 min-w-[152px] items-center justify-center gap-1.5 rounded-xl border border-white/24 bg-transparent px-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
                  >
                    <LogOut className="h-4 w-4" />
                    {isDemo ? 'Exit Demo' : 'Sign Out'}
                  </button>
                </div>
                <p className="mx-auto mt-2 max-w-[34rem] text-center text-[11px] leading-relaxed text-white/80">
                  Language progress and review data are tracked and saved separately for each language.
                </p>
              </div>
            </div>
            <button
              onClick={() => setProfileEditorOpen(true)}
              aria-label="Edit profile"
              title="Edit profile"
              className="absolute right-8 top-7 inline-flex items-center justify-center rounded-full border border-white/22 bg-transparent p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <PencilLine className="w-3.5 h-3.5" />
            </button>
          </SurfaceCard>
        </section>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <SurfaceButtonCard
            onClick={onOpenProgress}
            className="flex h-full min-h-[150px] flex-col justify-start border-[rgba(31,42,55,0.55)] bg-white p-5 text-center sm:text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-28px_rgba(15,23,42,0.24)] active:translate-y-0 lg:col-span-7"
          >
            <div className="relative flex items-center justify-center gap-2 sm:justify-start">
              <div className="inline-flex items-center justify-center rounded-full border border-[var(--sonus-palette-blue)]/22 bg-[rgba(19,87,119,0.08)] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--sonus-palette-blue)] sm:justify-start">
                Progress Overview
              </div>
              <ChevronRight className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
            </div>

            <div className="mt-4 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-[rgba(31,42,55,0.4)] bg-[#FBFBF9] p-5 text-center sm:text-left sm:col-span-2">
                <div className="inline-flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-text-med sm:justify-start">
                  <Flag className="h-3.5 w-3.5 text-[var(--sonus-palette-blue)]" />
                  Current Unit + Lesson
                </div>
                <div className="mt-2 text-sm font-semibold leading-tight text-text-dark">{currentUnitAndLesson}</div>
              </div>
              <div className="rounded-2xl border border-[rgba(31,42,55,0.4)] bg-[#FBFBF9] p-5 text-center sm:text-left sm:col-span-1">
                <div className="inline-flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-text-med sm:justify-start">
                  <BookOpen className="h-3.5 w-3.5 text-[var(--sonus-palette-blue)]" />
                  Lessons Completed
                </div>
                <div className="mt-2 text-[16px] font-semibold leading-none text-text-dark">{lessonsCompleted}</div>
              </div>
              <div className="rounded-2xl border border-[rgba(31,42,55,0.4)] bg-[#FBFBF9] p-5 text-center sm:text-left sm:col-span-1">
                <div className="inline-flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-text-med sm:justify-start">
                  <Flame className="h-3.5 w-3.5 text-[#9A3412]" />
                  Study Streak
                </div>
                <div className="mt-2 text-[16px] font-semibold leading-none text-text-dark">{streakDisplay}</div>
              </div>
            </div>

            <div className="mt-3 border-t border-[rgba(31,42,55,0.22)] pt-3">
              <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.14em] text-text-med">Last 7 Days</p>
              <div className="grid grid-cols-7 gap-1.5">
                {activityTrackerDays.map((day) => (
                  <div
                    key={day.key}
                    className="flex flex-col items-center rounded-lg border border-[var(--sonus-palette-blue)] bg-[var(--sonus-palette-blue)] px-1 py-1.5"
                  >
                    <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-white">
                      {day.label}
                    </span>
                    <span
                      className={`mt-1 h-2.5 w-2.5 rounded-full border ${
                        day.isActive
                          ? 'border-white bg-white shadow-[0_0_0_2px_rgba(255,255,255,0.2)]'
                          : 'border-white/45 bg-transparent'
                      }`}
                    />
                    <span className={`mt-1 text-[10px] ${day.isToday ? 'font-semibold text-white' : 'text-white'}`}>
                      {day.dayOfMonth}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </SurfaceButtonCard>

          <SurfaceCard className="relative h-full min-h-[150px] overflow-hidden border-[rgba(31,42,55,0.55)] p-5 text-center sm:text-left lg:col-span-5">
            <div className="relative">
              <div className="inline-flex items-center justify-center rounded-full border border-[var(--sonus-palette-blue)]/22 bg-[rgba(19,87,119,0.08)] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--sonus-palette-blue)] sm:justify-start">
                Account Security
              </div>
              <div className="mt-3 space-y-2">
                <div className="rounded-xl border border-[rgba(31,42,55,0.4)] bg-[#FBFBF9] px-3 py-2 text-center sm:text-left">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-light">Email</p>
                  <p className="mt-1 text-sm font-semibold text-text-dark break-all">{profile?.email || 'Not set'}</p>
                </div>
                <div className="rounded-xl border border-[rgba(31,42,55,0.4)] bg-[#FBFBF9] px-3 py-2 text-center sm:text-left">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-light">Timezone</p>
                  <p className="mt-1 text-sm font-semibold text-text-dark">{timezone || 'Auto-detected'}</p>
                </div>
                <div className="rounded-xl border border-[rgba(31,42,55,0.4)] bg-[#FBFBF9] px-3 py-2 text-center sm:text-left">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-light">Active Session</p>
                  <p className="mt-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-text-dark sm:justify-start">
                    <Monitor className="h-3.5 w-3.5 text-[var(--sonus-palette-blue)]" />
                    {deviceLabel}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                <a
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--sonus-palette-blue)]/25 bg-white px-3 py-2 text-xs font-semibold text-[var(--sonus-palette-blue)] hover:bg-[rgba(19,87,119,0.06)]"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Reset Password
                </a>
              </div>
            </div>
          </SurfaceCard>
        </section>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <SurfaceCard className="border-[rgba(31,42,55,0.55)] p-5 text-center sm:text-left">
            <div className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[rgba(19,87,119,0.26)] bg-[rgba(19,87,119,0.09)] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--sonus-palette-blue)] sm:justify-start">
              Data & Privacy
            </div>
            <div className="mt-3 space-y-2">
              <a href="/privacy" className="inline-flex w-full items-center justify-center rounded-xl border border-[rgba(31,42,55,0.4)] bg-white px-3 py-2 text-sm font-medium text-text-dark hover:bg-[#F8F8F6]">
                Privacy Policy
              </a>
              <a href="/terms" className="inline-flex w-full items-center justify-center rounded-xl border border-[rgba(31,42,55,0.4)] bg-white px-3 py-2 text-sm font-medium text-text-dark hover:bg-[#F8F8F6]">
                Terms of Service
              </a>
              {!isDemo && (
                <button
                  onClick={() => setDeleteModalOpen(true)}
                  disabled={deletingAccount}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-[var(--sonus-palette-rust)]/35 bg-white px-3 py-2 text-sm font-semibold text-[#9A3412] hover:bg-[rgba(194,65,12,0.06)] disabled:opacity-60"
                >
                  {deletingAccount ? 'Scheduling Deletion…' : 'Delete Account'}
                </button>
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard className="border-[rgba(31,42,55,0.55)] p-5 text-center sm:text-left">
            <div className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[rgba(19,87,119,0.26)] bg-[rgba(19,87,119,0.09)] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--sonus-palette-blue)] sm:justify-start">
              Support & Contact
            </div>
            <div className="mt-3 space-y-2">
              <a href="/contact" className="inline-flex w-full items-center justify-center rounded-xl border border-[rgba(31,42,55,0.4)] bg-white px-3 py-2 text-sm font-medium text-text-dark hover:bg-[#F8F8F6]">
                Contact Page
              </a>
              <a href="mailto:support@sonuslearning.com" className="inline-flex w-full items-center justify-center rounded-xl border border-[rgba(31,42,55,0.4)] bg-white px-3 py-2 text-sm font-medium text-text-dark hover:bg-[#F8F8F6]">
                Email Support
              </a>
              <button
                onClick={onOpenAbout}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[rgba(31,42,55,0.4)] bg-white px-3 py-2 text-sm font-medium text-text-dark hover:bg-[#F8F8F6]"
              >
                About Sonus
              </button>
            </div>
          </SurfaceCard>
        </section>
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
              <div className="rounded-xl border border-[#C56A3D]/35 bg-[rgba(197,106,61,0.08)] px-3 py-2.5 text-xs leading-relaxed text-[#9A3412]">
                Changing this will update the name shown on your profile.
              </div>
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
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[var(--sonus-palette-blue)] text-white text-sm font-semibold disabled:opacity-60"
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
                const accent = CARD_ACCENTS_BY_LANGUAGE[language.id] || CARD_ACCENTS_BY_LANGUAGE.ja;
                return (
                  <button
                    key={language.id}
                    onClick={() => void handleLanguageSwitch(language.id)}
                    disabled={switchingLanguage || !isAvailable || isCurrent}
                    className={`group relative w-full min-h-[148px] overflow-hidden rounded-2xl border p-5 text-center transition-all ${
                      isCurrent
                        ? 'bg-[var(--sonus-palette-charcoal)] sonus-drenched-border-charcoal'
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

      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/45 z-[80] flex items-center justify-center px-6">
          <div className="w-full max-w-md bg-white border border-[#7F1D1D]/20 rounded-2xl p-5">
            <h3 className="font-semibold text-[#7F1D1D] text-lg">Delete Account?</h3>
            <p className="mt-2 text-sm text-text-med">
              Your account is scheduled for permanent deletion in 14 days.
            </p>
            <p className="mt-2 text-sm text-text-med">
              If you would like to keep your account, contact
              {' '}
              <a href="mailto:support@sonuslearning.com" className="underline underline-offset-2 text-[#9A3412]">
                support@sonuslearning.com
              </a>
              {' '}
              before the deletion date.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deletingAccount}
                className="flex-1 px-3 py-2 rounded-lg border border-border text-sm text-text-dark disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deleteAccount()}
                disabled={deletingAccount}
                className="flex-1 px-3 py-2 rounded-lg bg-[#B45309] text-white text-sm font-semibold disabled:opacity-60"
              >
                {deletingAccount ? 'Scheduling…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
