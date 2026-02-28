import { useCallback, useEffect, useState } from 'react';
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

type Profile = {
  displayName: string | null;
  targetLanguage: string | null;
  timezone: string | null;
  onboardingComplete: boolean;
  email: string | null;
};

type Progress = {
  streak: number;
  lastActiveDate: string | null;
  currentBandId: string | null;
  currentUnitId: string | null;
  currentLessonIdx: number | null;
};

interface ProfileScreenProps {
  onOpenProgress: () => void;
  onOpenAbout: () => void;
  onGoHome: () => void;
  currentLearningLanguage: string | null;
  onOpenLanguageSelection: () => void;
}

function inferUnitFromLessonProgress(
  bandId: string | null,
  lessonProgress: Record<string, unknown>
) {
  if (!bandId) return null;
  const unitIds = new Set<string>();
  for (const key of Object.keys(lessonProgress || {})) {
    const [keyBandId, keyUnitId] = key.split(':');
    if (keyBandId === bandId && keyUnitId) {
      unitIds.add(keyUnitId);
    }
  }
  const orderedCoreUnits = getUnitsForBand(bandId)
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
  onOpenLanguageSelection,
}: ProfileScreenProps) {
  const { state } = useApp();
  const { isDemo, signOut } = useAuth();
  const resolvedCurrentLearningLanguage = currentLearningLanguage === 'jp' ? 'ja' : currentLearningLanguage;
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

  const languageNameById: Record<string, string> = {
    zh: 'Mandarin',
    ja: 'Japanese',
    kr: 'Korean',
    ko: 'Korean',
    fr: 'French',
    es: 'Spanish',
    de: 'German',
  };
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
  const inferredUnitId = inferUnitFromLessonProgress(effectiveBandId, state.lessonProgress || {});
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
      ? getUnitMetadata(effectiveBandId, effectiveUnitId)
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
        email: null,
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
  }, [isDemo, resolvedCurrentLearningLanguage, signOut, timezone]);

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
          <div className="bg-white border border-[#3E5648] rounded-2xl p-4 text-sm text-[#3E5648]">
            {saveMessage}
          </div>
        )}

        <SurfaceCard className="relative p-5 shadow-[0_20px_42px_-34px_rgba(31,42,55,0.28)]">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[rgba(24,110,149,0.12)] border border-[rgba(24,110,149,0.22)] flex items-center justify-center text-[#186E95]">
              <UserRound className="w-5 h-5" />
            </div>
            <div className="text-lg font-semibold text-text-dark">
              {displayName.trim() || 'Learner'}
            </div>
            <div className="text-sm text-text-med">{profile?.email || '—'}</div>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
              <span className="inline-flex items-center rounded-full border border-border bg-[rgba(31,42,55,0.06)] px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider text-text-med">
                {activeLanguageName ? `Target: ${activeLanguageName}` : 'Target: Not set'}
              </span>
            </div>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-text-light hover:text-text-dark transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {isDemo ? 'Exit Demo' : 'Sign Out'}
            </button>
          </div>
          <button
            onClick={() => setProfileEditorOpen(true)}
            aria-label="Edit profile"
            title="Edit profile"
            className="absolute bottom-6 right-8 inline-flex items-center justify-center text-text-light hover:text-text-dark transition-colors"
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

            <div className="relative flex h-full flex-col justify-between">
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

              <div className="mt-4 rounded-2xl border border-[rgba(24,110,149,0.18)] bg-white/85 p-3">
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-text-light">Current</div>
                <div className="mt-1.5 inline-flex items-center rounded-full border border-[#186E95]/25 bg-[rgba(24,110,149,0.08)] px-3 py-1 text-xs font-semibold text-[#186E95]">
                  {activeLanguageName || 'Not set'}
                </div>

                <div className="mt-3 space-y-2.5">
                  <button
                    onClick={onOpenLanguageSelection}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#186E95] px-3 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-18px_rgba(24,110,149,0.55)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    Go to Language Selection
                  </button>
                </div>
              </div>
            </div>
          </SurfaceCard>

          <div className="space-y-2.5 lg:col-span-1 lg:h-full lg:flex lg:flex-col">
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
    </div>
  );
}
