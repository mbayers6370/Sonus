import { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck,
  ChevronRight,
  Clock3,
  Languages,
  UserRound,
} from 'lucide-react';
import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://127.0.0.1:4000';

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
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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

  const learningLanguageName =
    (currentLearningLanguage === 'zh' && 'Mandarin') ||
    (currentLearningLanguage === 'jp' && 'Japanese') ||
    (currentLearningLanguage === 'kr' && 'Korean') ||
    (currentLearningLanguage === 'fr' && 'French') ||
    'Not set';

  const loadProfile = useCallback(async () => {
    setError(null);
    setSaveMessage(null);
    setBackendOffline(false);
    try {
      const [profileRes, progressRes] = await Promise.all([
        fetch(`${API_BASE_URL}/v1/me/profile`),
        fetch(`${API_BASE_URL}/v1/me/progress`),
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
      setIsEditing(
        !profileJson.profile.displayName &&
          !profileJson.profile.targetLanguage &&
          !profileJson.profile.timezone
      );
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
      });
      if (!timezone.trim()) {
        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        if (browserTimezone) {
          setTimezone(browserTimezone);
        }
      }
      setIsEditing(true);
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
      const response = await fetch(`${API_BASE_URL}/v1/me/profile`, {
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
      setIsEditing(false);
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

  return (
    <div className="min-h-screen page-shell px-6 pb-24">
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

        <div className="bg-white/95 border border-border rounded-3xl p-5 shadow-[0_20px_42px_-34px_rgba(31,42,55,0.28)]">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[rgba(24,110,149,0.12)] border border-[rgba(24,110,149,0.22)] flex items-center justify-center text-[#186E95]">
                <UserRound className="w-7 h-7" />
              </div>
              <div>
                <div className="text-lg font-semibold text-text-dark">
                  {displayName.trim() || 'Learner'}
                </div>
                <div className="text-sm text-text-med">{profile?.email || 'dev@local.test'}</div>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider font-mono bg-[rgba(24,110,149,0.10)] text-[#186E95] border border-[rgba(24,110,149,0.22)]">
              {isEditing ? 'Editing' : 'View Mode'}
            </div>
          </div>
        </div>

        <div className="bg-white/95 border border-border rounded-3xl p-5">
          <h3 className="font-semibold text-text-dark mb-3">User Profile</h3>
          <div className={`space-y-3 transition-opacity ${isEditing ? 'opacity-100' : 'opacity-70'}`}>
            <div>
              <div className="text-xs uppercase tracking-wider text-text-light font-mono mb-1">Email</div>
              <div className="text-sm text-text-dark">{profile?.email || 'dev@local.test'}</div>
            </div>
            <label className="block">
              <div className="text-xs uppercase tracking-wider text-text-light font-mono mb-1">Display Name</div>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={!isEditing}
                className={`w-full border border-border rounded-xl px-3 py-2.5 text-sm ${isEditing ? 'bg-white' : 'bg-[#F6F5F2] text-text-med'}`}
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
                disabled={!isEditing}
                className={`w-full border border-border rounded-xl px-3 py-2.5 text-sm ${isEditing ? 'bg-white' : 'bg-[#F6F5F2] text-text-med'}`}
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
              <div className="text-xs uppercase tracking-wider text-text-light font-mono mb-1 flex items-center gap-1.5">
                <Clock3 className="w-3.5 h-3.5" />
                Timezone
              </div>
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={!isEditing}
                className={`w-full border border-border rounded-xl px-3 py-2.5 text-sm ${isEditing ? 'bg-white' : 'bg-[#F6F5F2] text-text-med'}`}
                placeholder="America/New_York"
              />
            </label>
            {isEditing ? (
              <button
                onClick={() => void saveProfile()}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#186E95] text-white text-sm font-semibold disabled:opacity-60"
              >
                <BadgeCheck className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-text-dark text-sm font-semibold hover:bg-[rgba(55,65,81,0.08)]"
              >
                Edit Profile
              </button>
            )}
          </div>
        </div>

        <button
          onClick={onOpenProgress}
          className="w-full bg-white/95 border border-border rounded-3xl p-5 text-left hover:bg-[rgba(55,65,81,0.04)] transition-colors"
        >
          <h3 className="font-semibold text-text-dark mb-3">Progress Snapshot</h3>
          <div className="grid grid-cols-1 gap-4 mb-3">
            <div className="p-3 rounded-xl border border-[rgba(62,86,72,0.22)] bg-[rgba(62,86,72,0.10)]">
              <div className="text-xs uppercase tracking-wider font-mono text-text-light mb-1">Streak</div>
              <div className="text-2xl font-semibold text-[#3E5648]">{progress?.streak ?? 0}</div>
            </div>
          </div>
          <div className="text-sm text-text-med">
            Last active:{' '}
            <span className="text-text-dark font-medium">
              {progress?.lastActiveDate ? new Date(progress.lastActiveDate).toLocaleDateString() : 'N/A'}
            </span>
          </div>
          <div className="mt-3 text-sm text-[#186E95] font-medium">Open full progress →</div>
        </button>

        <div className="bg-white/95 border border-border rounded-3xl p-5">
          <h3 className="font-semibold text-text-dark mb-3">Learning Language</h3>
          <div className="text-sm text-text-med mb-3">
            Current: <span className="text-text-dark font-medium">{learningLanguageName}</span>
          </div>
          <div className="flex flex-col gap-3">
            <select
              value={learningLanguageSelection}
              onChange={(e) => setLearningLanguageSelection(e.target.value)}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm"
            >
              <option value="zh">Mandarin</option>
            </select>
            <button
              onClick={requestLanguageSwitch}
              disabled={!learningLanguageSelection || learningLanguageSelection === currentLearningLanguage}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#186E95] text-white text-sm font-semibold disabled:opacity-60"
            >
              Switch Learning Language
            </button>
            <div className="text-xs text-text-light">
              Japanese, Korean, and French curriculum are coming soon.
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={onOpenAbout}
            className="w-full bg-white/95 border border-border rounded-3xl p-4 text-left flex items-center justify-between hover:bg-[rgba(55,65,81,0.05)] transition-colors"
          >
            <div>
              <div className="font-semibold text-text-dark">About Sonus</div>
              <div className="text-sm text-text-med">Why the system uses national proficiency frameworks</div>
            </div>
            <ChevronRight className="w-5 h-5 text-text-light" />
          </button>
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
    </div>
  );
}
