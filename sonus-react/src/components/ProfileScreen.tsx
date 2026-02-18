import { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  Flame,
  BadgeCheck,
  ChartNoAxesColumn,
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
import { getUnitMetadata, getUnitsForBand, isCheckpointUnitId, isPracticeUnitId } from '../data/unitMetadata';

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
  onRequestLearningLanguageChange: (languageId: string) => Promise<void> | void;
}

export default function ProfileScreen({
  onOpenProgress,
  onOpenAbout,
  onGoHome,
  currentLearningLanguage,
  onRequestLearningLanguageChange,
}: ProfileScreenProps) {
  const { state } = useApp();
  const { isDemo, signOut } = useAuth();
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
  const [learningLanguageSelection, setLearningLanguageSelection] = useState('zh');
  const [pendingLearningLanguage, setPendingLearningLanguage] = useState<string | null>(null);
  const [switchingLanguage, setSwitchingLanguage] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const learningLanguageName =
    (currentLearningLanguage === 'zh' && 'Mandarin') ||
    (currentLearningLanguage === 'jp' && 'Japanese') ||
    (currentLearningLanguage === 'kr' && 'Korean') ||
    (currentLearningLanguage === 'fr' && 'French') ||
    'Not set';

  const profileTargetLanguageName =
    (targetLanguage === 'zh' && 'Mandarin') ||
    (targetLanguage === 'es' && 'Spanish') ||
    (targetLanguage === 'fr' && 'French') ||
    (targetLanguage === 'de' && 'German') ||
    (targetLanguage === 'ja' && 'Japanese') ||
    (targetLanguage === 'ko' && 'Korean') ||
    null;

  const effectiveBandId = progress?.currentBandId ?? state.activeBandId ?? null;
  const effectiveUnitId = progress?.currentUnitId ?? state.activeUnitId ?? state.activeLesson?.unitId ?? null;
  const effectiveLessonIdx =
    typeof progress?.currentLessonIdx === 'number'
      ? progress.currentLessonIdx
      : (state.activeLesson?.lessonIndex ?? null);
  const coreUnits = effectiveBandId
    ? getUnitsForBand(effectiveBandId).filter(
      (unit) => !isCheckpointUnitId(unit.id) && !isPracticeUnitId(unit.id)
    )
    : [];
  const currentCoreUnitIndex =
    effectiveUnitId
      ? coreUnits.findIndex((unit) => unit.id === effectiveUnitId)
      : -1;
  const unitsCompleted = currentCoreUnitIndex > 0 ? currentCoreUnitIndex : 0;
  const completionPercent = coreUnits.length > 0
    ? Math.round((unitsCompleted / coreUnits.length) * 100)
    : 0;
  const currentUnitMeta =
    effectiveBandId && effectiveUnitId
      ? getUnitMetadata(effectiveBandId, effectiveUnitId)
      : null;
  const currentLessonNumber =
    typeof effectiveLessonIdx === 'number' && effectiveLessonIdx >= 0
      ? effectiveLessonIdx + 1
      : null;
  const currentUnitAndLesson = effectiveUnitId
    ? `${currentUnitMeta?.name ?? 'Current Unit'}${currentLessonNumber ? ` · Lesson ${currentLessonNumber}` : ''}`
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
  const streakDisplay = (progress?.streak ?? 0) > 0 ? (progress?.streak ?? 0) : (isLastActiveToday ? 1 : 0);

  const loadProfile = useCallback(async () => {
    setError(null);
    setSaveMessage(null);
    setBackendOffline(false);
    try {
      const [profileRes, progressRes] = await Promise.all([
        apiFetch('/v1/me/profile'),
        apiFetch('/v1/me/progress'),
      ]);

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
      setLearningLanguageSelection('zh');
    } catch {
      setBackendOffline(true);
      setError(null);
      setProfile({
        displayName: null,
        targetLanguage: currentLearningLanguage || null,
        timezone: timezone || null,
        onboardingComplete: false,
        email: 'dev@local.test',
      });
      setProgress({
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
  }, [currentLearningLanguage, timezone]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    setLearningLanguageSelection('zh');
  }, [currentLearningLanguage]);

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

  const requestLanguageSwitch = () => {
    if (!learningLanguageSelection || learningLanguageSelection === currentLearningLanguage) return;
    setPendingLearningLanguage(learningLanguageSelection);
  };

  const confirmLanguageSwitch = async () => {
    if (!pendingLearningLanguage) return;
    setSwitchingLanguage(true);
    try {
      await onRequestLearningLanguageChange(pendingLearningLanguage);
      setPendingLearningLanguage(null);
    } finally {
      setSwitchingLanguage(false);
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

        <SurfaceCard className="p-5 shadow-[0_20px_42px_-34px_rgba(31,42,55,0.28)]">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[rgba(24,110,149,0.12)] border border-[rgba(24,110,149,0.22)] flex items-center justify-center text-[#186E95]">
                <UserRound className="w-7 h-7" />
              </div>
              <div>
                <div className="text-lg font-semibold text-text-dark">
                  {displayName.trim() || 'Learner'}
                </div>
                <div className="text-sm text-text-med">{profile?.email || '—'}</div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-full border border-border bg-[rgba(55,65,81,0.06)] px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider text-text-med">
                    {profileTargetLanguageName ? `Target: ${profileTargetLanguageName}` : 'Target: Not set'}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-border bg-[rgba(55,65,81,0.06)] px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider text-text-med">
                    {timezone.trim() ? timezone : 'Timezone: Not set'}
                  </span>
                  <button
                    onClick={() => setProfileEditorOpen(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#186E95]/35 bg-[rgba(24,110,149,0.10)] px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider text-[#186E95] hover:bg-[rgba(24,110,149,0.16)] transition-colors"
                  >
                    <PencilLine className="w-3.5 h-3.5" />
                    Edit
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-text-light hover:text-text-dark transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {isDemo ? 'Exit Demo' : 'Sign Out'}
            </button>
          </div>
        </SurfaceCard>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2.5 items-stretch">
          <SurfaceButtonCard
            onClick={onOpenProgress}
            className="h-full min-h-[150px] p-4 text-left flex flex-col !bg-[#186E95] !text-white !border-[#186E95]/90 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_rgba(24,110,149,0.38)] active:translate-y-0 lg:col-span-2"
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="inline-flex items-center rounded-full px-3 py-1 bg-white/14 border border-white/28 text-[10px] uppercase tracking-[0.2em] font-mono text-white/90">
                Progress Snapshot
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full">
              <div className="rounded-2xl border border-white/28 bg-white/10 p-3">
                <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-mono text-white/90">
                  <BookOpen className="w-3.5 h-3.5" />
                  Units Completed
                </div>
                <div className="text-2xl font-semibold text-white leading-none mt-2">{unitsCompleted}</div>
              </div>
              <div className="rounded-2xl border border-white/28 bg-white/10 p-3">
                <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-mono text-white/90">
                  <ChartNoAxesColumn className="w-3.5 h-3.5" />
                  Completion
                </div>
                <div className="text-2xl font-semibold text-white leading-none mt-2">{completionPercent}%</div>
              </div>
              <div className="rounded-2xl border border-white/28 bg-white/12 p-3 col-span-2">
                <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-mono text-white/90">
                  <Flag className="w-3.5 h-3.5" />
                  Current Unit + Lesson
                </div>
                <div className="text-sm font-semibold text-white leading-tight mt-2">{currentUnitAndLesson}</div>
              </div>
              <div className="rounded-2xl border border-white/28 bg-white/12 p-3 col-span-2">
                <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-mono text-white/90">
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

          <SurfaceCard className="h-full min-h-[150px] p-4 flex flex-col justify-between lg:col-span-1">
            <div>
              <h3 className="font-semibold text-text-dark mb-1.5">Change Language</h3>
              <div className="inline-flex items-center rounded-full border border-[#186E95]/25 bg-[rgba(24,110,149,0.08)] px-3 py-1 text-xs font-medium text-[#186E95]">
                Current: {learningLanguageName}
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <select
                value={learningLanguageSelection}
                onChange={(e) => setLearningLanguageSelection(e.target.value)}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-white"
              >
                <option value="zh">Mandarin</option>
              </select>
              <button
                onClick={requestLanguageSwitch}
                disabled={!learningLanguageSelection || learningLanguageSelection === currentLearningLanguage}
                className="inline-flex w-full items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#186E95] text-white text-sm font-semibold disabled:opacity-60"
              >
                Switch Language
              </button>
            </div>
            <div className="mt-3 text-[11px] leading-tight text-text-light">
              Roadmap: Japanese, Korean, and French curriculum are coming soon.
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

      {pendingLearningLanguage && (
        <div className="fixed inset-0 bg-black/35 z-[60] flex items-center justify-center px-6">
          <div className="w-full max-w-sm bg-white border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-text-dark mb-2">Switch Learning Language?</h3>
            <p className="text-sm text-text-med mb-4">
              This changes your active language dashboard. Your saved progress data remains stored.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingLearningLanguage(null)}
                className="flex-1 px-3 py-2 rounded-lg border border-border text-sm text-text-dark"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmLanguageSwitch()}
                disabled={switchingLanguage}
                className="flex-1 px-3 py-2 rounded-lg bg-[#186E95] text-white text-sm font-semibold disabled:opacity-60"
              >
                {switchingLanguage ? 'Switching...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <label className="block">
                <div className="text-xs uppercase tracking-wider text-text-light font-mono mb-1">Timezone</div>
                <input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white"
                  placeholder="America/New_York"
                />
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
