import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/apiClient';

type SearchResult = {
  userId: string;
  email: string | null;
  displayName: string | null;
  targetLanguage: string | null;
  onboardingComplete: boolean;
  updatedAt: string;
};

type UserOverview = {
  profile: {
    userId: string;
    email: string | null;
    displayName: string | null;
    targetLanguage: string | null;
    onboardingComplete: boolean;
    createdAt: string;
    updatedAt: string;
  };
  progress: {
    streak: number;
    currentBandId: string | null;
    currentUnitId: string | null;
    currentLessonIdx: number | null;
    lastActiveDate: string | null;
  } | null;
  counts: {
    quizCount: number;
    speakCount: number;
    progressEventCount: number;
  };
  deletionRequest: {
    id: string;
    status: string;
    createdAt: string;
    requestReason: string;
  } | null;
};

type TimelineEntry = {
  createdAt: string;
  source: string;
  title: string;
  detail: string | null;
};

type SupportMetrics = {
  windowDays: number;
  support: {
    failedLogins: number;
    endUserFailedLogins: number;
    resetRequests: number;
    emailVerificationRequired: number;
    newIpLogins: number;
    newDeviceLogins: number;
    sessionRevocations: number;
    unauthorizedAdminAttempts: number;
    supportNotesCreated: number;
    supportNoteCreateFailures: number;
    authErrorBreakdown?: Array<{ eventType: string; count: number }>;
    authFailureByEndpoint?: Array<{ endpoint: string; count: number }>;
  };
};

type LearningMetrics = {
  windowDays: number;
  learning: {
    quizAttempts: number;
    quizAccuracyPct: number;
    speakAttempts: number;
    speakPassPct: number;
    lessonStarts: number;
    lessonStartsTracked?: number;
    lessonCompleted: number;
    lessonCompletionPct: number;
    lessonAbandons: number;
    applyCompleted: number;
  };
};

type WeakWordsByLanguage = {
  windowDays: number;
  limitPerLanguage: number;
  languages: Array<{
    languageId: string;
    hasData: boolean;
    words: Array<{
      wordId: string;
      misses: number;
      attempts: number;
      missRatePct: number;
      nativeText: string;
      englishText: string;
    }>;
  }>;
};

const SUPPORT_ADMIN_TOKEN_STORAGE_KEY = 'sonus.support_admin.token';

const baseInput =
  'w-full rounded-xl border border-[#1f2937]/20 bg-white px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-[#1f2937]';
const baseButton =
  'rounded-xl bg-[#1f2937] px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50';
const metricCard = 'rounded-xl border border-[#e2e8f0] bg-white p-4';

function toLocale(value: string | null | undefined) {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function setSupportAdminToken(token: string | null) {
  try {
    if (!token) {
      window.localStorage.removeItem(SUPPORT_ADMIN_TOKEN_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SUPPORT_ADMIN_TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore localStorage errors.
  }
}

async function parseJsonOrThrow<T>(response: Response) {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // no-op
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error?: string }).error || 'Request failed')
        : 'Request failed';
    throw new Error(message);
  }
  return (payload || {}) as T;
}

export default function SupportConsolePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [bootLoading, setBootLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [adminUsername, setAdminUsername] = useState('qa-admin-f8n2x7r1@sonus.test');
  const [adminPassword, setAdminPassword] = useState('');
  const [setPasswordValue, setSetPasswordValue] = useState('');
  const [setPasswordCurrent, setSetPasswordCurrent] = useState('');
  const [query, setQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [overview, setOverview] = useState<UserOverview | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteReason, setNoteReason] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [actionChannel, setActionChannel] = useState('support-email');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [supportMetrics, setSupportMetrics] = useState<SupportMetrics | null>(null);
  const [learningMetrics, setLearningMetrics] = useState<LearningMetrics | null>(null);
  const [weakWordsByLanguage, setWeakWordsByLanguage] = useState<WeakWordsByLanguage | null>(null);
  const [weakSpeakWordsByLanguage, setWeakSpeakWordsByLanguage] = useState<WeakWordsByLanguage | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<SearchResult | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteAcknowledge, setDeleteAcknowledge] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const viewMode = useMemo<'ops' | 'metrics-support' | 'metrics-learning'>(() => {
    if (location.pathname.endsWith('/metrics/support')) return 'metrics-support';
    if (location.pathname.endsWith('/metrics/learning')) return 'metrics-learning';
    return 'ops';
  }, [location.pathname]);

  const selectedUser = useMemo(
    () => searchResults.find((entry) => entry.userId === selectedUserId) || null,
    [searchResults, selectedUserId]
  );

  const verifySupportAdminSession = async () => {
    try {
      await parseJsonOrThrow(await apiFetch('/v1/admin/auth/me', { cache: 'no-store' }));
      setAuthenticated(true);
      setAuthError(null);
      return true;
    } catch {
      setAuthenticated(false);
      return false;
    }
  };

  const refreshSetupStatus = async (username: string) => {
    try {
      const params = new URLSearchParams();
      if (username.trim()) params.set('username', username.trim());
      const payload = await parseJsonOrThrow<{ setupRequired?: boolean; usernameConfigured?: boolean }>(
        await apiFetch(`/v1/admin/auth/setup-status?${params.toString()}`, { cache: 'no-store' })
      );
      if (typeof payload.usernameConfigured === 'boolean') {
        setSetupRequired(!payload.usernameConfigured);
        return;
      }
      setSetupRequired(Boolean(payload.setupRequired));
    } catch {
      setSetupRequired(true);
    }
  };

  const runSearch = async () => {
    setSearchLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      params.set('limit', '30');
      const payload = await parseJsonOrThrow<{ users?: SearchResult[] }>(
        await apiFetch(`/v1/admin/users/search?${params.toString()}`, { cache: 'no-store' })
      );
      const next = payload.users || [];
      setSearchResults(next);
      if (!selectedUserId && next[0]?.userId) {
        setSelectedUserId(next[0].userId);
      }
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  const refreshSelectedUser = async (targetUserId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const [overviewPayload, timelinePayload] = await Promise.all([
        parseJsonOrThrow<UserOverview>(await apiFetch(`/v1/admin/users/${targetUserId}`, { cache: 'no-store' })),
        parseJsonOrThrow<{ timeline?: TimelineEntry[] }>(
          await apiFetch(`/v1/admin/users/${targetUserId}/timeline?limit=120`, { cache: 'no-store' })
        ),
      ]);
      setOverview(overviewPayload);
      setTimeline(timelinePayload.timeline || []);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Failed to load user details');
      setOverview(null);
      setTimeline([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const loadSupportMetrics = async () => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const payload = await parseJsonOrThrow<SupportMetrics>(
        await apiFetch('/v1/admin/metrics/support/overview?windowDays=30', { cache: 'no-store' })
      );
      setSupportMetrics(payload);
    } catch (error) {
      setMetricsError(error instanceof Error ? error.message : 'Failed to load support metrics');
    } finally {
      setMetricsLoading(false);
    }
  };

  const loadLearningMetrics = async () => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const [overviewPayload, weakWordsByLanguagePayload, weakSpeakWordsByLanguagePayload] = await Promise.all([
        parseJsonOrThrow<LearningMetrics>(
          await apiFetch('/v1/admin/metrics/learning/overview?windowDays=30', { cache: 'no-store' })
        ),
        parseJsonOrThrow<WeakWordsByLanguage>(
          await apiFetch('/v1/admin/metrics/learning/weak-words-by-language?windowDays=30&limitPerLanguage=5', {
            cache: 'no-store',
          })
        ),
        parseJsonOrThrow<WeakWordsByLanguage>(
          await apiFetch('/v1/admin/metrics/learning/weak-speak-words-by-language?windowDays=30&limitPerLanguage=5', {
            cache: 'no-store',
          })
        ),
      ]);
      setLearningMetrics(overviewPayload);
      setWeakWordsByLanguage(weakWordsByLanguagePayload);
      setWeakSpeakWordsByLanguage(weakSpeakWordsByLanguagePayload);
    } catch (error) {
      setMetricsError(error instanceof Error ? error.message : 'Failed to load learning metrics');
    } finally {
      setMetricsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refreshSetupStatus(adminUsername);
      const ok = await verifySupportAdminSession();
      if (!cancelled) {
        setBootLoading(false);
        if (ok && viewMode === 'ops') {
          void runSearch();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void refreshSetupStatus(adminUsername);
  }, [adminUsername]);

  useEffect(() => {
    if (!authenticated) return;
    if (viewMode === 'metrics-support') {
      void loadSupportMetrics();
      return;
    }
    if (viewMode === 'metrics-learning') {
      void loadLearningMetrics();
    }
  }, [authenticated, viewMode]);

  useEffect(() => {
    if (!selectedUserId || !authenticated || viewMode !== 'ops') {
      setOverview(null);
      setTimeline([]);
      return;
    }
    void refreshSelectedUser(selectedUserId);
  }, [selectedUserId, authenticated, viewMode]);

  useEffect(() => {
    if (!authenticated || viewMode !== 'ops') return;
    // Ensure User Operations repopulates whenever the view is entered.
    void runSearch();
  }, [authenticated, viewMode]);

  const runMutation = async (action: string, path: string, body: Record<string, unknown>) => {
    if (!selectedUserId) return;
    setBusyAction(action);
    setDetailError(null);
    try {
      await parseJsonOrThrow(
        await apiFetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      );
      await refreshSelectedUser(selectedUserId);
      setActionReason('');
      if (action === 'add-note') {
        setNote('');
        setNoteReason('');
      }
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSupportLogin = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const payload = await parseJsonOrThrow<{ token: string }>(
        await apiFetch('/v1/admin/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: adminUsername.trim(), password: adminPassword }),
        })
      );
      setSupportAdminToken(payload.token);
      setAdminPassword('');
      const ok = await verifySupportAdminSession();
      if (ok) {
        if (viewMode === 'ops') await runSearch();
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Support login failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSetPassword = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await parseJsonOrThrow(
        await apiFetch('/v1/admin/auth/set-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: adminUsername.trim(),
            password: setPasswordValue,
            currentPassword: setPasswordCurrent || undefined,
          }),
        })
      );
      setAuthError('Password set successfully. Now sign in with it.');
      setSetupRequired(false);
      setSetPasswordCurrent('');
      setSetPasswordValue('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to set password');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSupportLogout = async () => {
    try {
      await apiFetch('/v1/admin/auth/logout', { method: 'POST' });
    } catch {
      // no-op
    }
    setSupportAdminToken(null);
    setAuthenticated(false);
    setSearchResults([]);
    setSelectedUserId(null);
    setOverview(null);
    setTimeline([]);
  };

  const handlePermanentDeleteUser = async () => {
    if (!deleteCandidate) return;
    setDeleteBusy(true);
    setDetailError(null);
    try {
      await parseJsonOrThrow(
        await apiFetch(`/v1/admin/users/${deleteCandidate.userId}/actions/permanent-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: deleteReason.trim(),
            confirmText: deleteConfirmText.trim(),
          }),
        })
      );
      const removedUserId = deleteCandidate.userId;
      setDeleteCandidate(null);
      setDeleteReason('');
      setDeleteConfirmText('');
      setDeleteAcknowledge(false);
      if (selectedUserId === removedUserId) {
        setSelectedUserId(null);
        setOverview(null);
        setTimeline([]);
      }
      await runSearch();
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Permanent deletion failed');
    } finally {
      setDeleteBusy(false);
    }
  };

  if (bootLoading) {
    return <div className="min-h-screen page-shell flex items-center justify-center text-[#1f2937]">Loading…</div>;
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen page-shell p-6 text-[#1f2937]">
        <div className="mx-auto grid max-w-4xl gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-[#1f2937]/20 bg-white/95 p-5">
            <h1 className="text-lg font-semibold text-[#0f172a]">Support Admin Login</h1>
            <p className="mt-1 text-sm text-[#475569]">Sign in to access `/internal/support`.</p>
            <input className={`${baseInput} mt-3`} value={adminUsername} onChange={(event) => setAdminUsername(event.target.value)} placeholder="admin username (email)" />
            <input type="password" className={`${baseInput} mt-2`} value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} placeholder="password" />
            <button type="button" className={`${baseButton} mt-3 w-full`} disabled={authBusy || adminUsername.trim().length < 3 || adminPassword.length < 1} onClick={() => void handleSupportLogin()}>
              Sign In
            </button>
          </section>

          {setupRequired && (
            <section className="rounded-2xl border border-[#1f2937]/20 bg-white/95 p-5">
              <h2 className="text-lg font-semibold text-[#0f172a]">Set Password (One Time)</h2>
              <p className="mt-1 text-sm text-[#475569]">This appears only until the first successful setup.</p>
              <input className={`${baseInput} mt-3`} value={adminUsername} onChange={(event) => setAdminUsername(event.target.value)} placeholder="admin username (email)" />
              <input type="password" className={`${baseInput} mt-2`} value={setPasswordValue} onChange={(event) => setSetPasswordValue(event.target.value)} placeholder="new password (min 10 chars)" />
              <input type="password" className={`${baseInput} mt-2`} value={setPasswordCurrent} onChange={(event) => setSetPasswordCurrent(event.target.value)} placeholder="current password (leave blank for first setup)" />
              <button type="button" className={`${baseButton} mt-3 w-full`} disabled={authBusy || adminUsername.trim().length < 3 || setPasswordValue.length < 10} onClick={() => void handleSetPassword()}>
                Save Password
              </button>
            </section>
          )}
        </div>
        {authError && <div className="mx-auto mt-4 max-w-4xl rounded-xl border border-[#1f2937]/20 bg-white/95 p-3 text-sm text-[#1f2937]">{authError}</div>}
      </div>
    );
  }

  return (
    <div className="min-h-screen page-shell p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <section className="mb-4 rounded-2xl border border-[#1f2937]/20 bg-white/95 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="text-xl font-semibold text-[#0f172a]">Support Console Dashboard</h1>
              <p className="text-sm text-[#475569]">Separate views for support operations, support metrics, and learning metrics.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className={baseButton} onClick={() => navigate('/internal/support')}>User Operations</button>
              <button type="button" className={baseButton} onClick={() => navigate('/internal/support/metrics/support')}>Support Metrics</button>
              <button type="button" className={baseButton} onClick={() => navigate('/internal/support/metrics/learning')}>Learning Metrics</button>
            </div>
            <div className="ml-auto">
              <button type="button" className={baseButton} onClick={() => void handleSupportLogout()}>Log Out</button>
            </div>
          </div>
        </section>

        {viewMode === 'metrics-support' && (
          <section className="rounded-2xl border border-[#1f2937]/20 bg-white/95 p-4">
            <h2 className="text-lg font-semibold text-[#0f172a]">Support Metrics (Last 30 Days)</h2>
            <p className="mt-1 text-sm text-[#475569]">Broad overview of account access, security, and support workload.</p>
            {metricsLoading && <p className="mt-3 text-sm text-[#475569]">Loading metrics…</p>}
            {metricsError && <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">{metricsError}</p>}
            {supportMetrics && (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className={metricCard}><div className="text-xs text-[#64748b]">Failed Logins</div><div className="text-2xl font-semibold text-[#0f172a]">{supportMetrics.support.failedLogins}</div></div>
                <div className={metricCard}><div className="text-xs text-[#64748b]">End-User Failed Logins</div><div className="text-2xl font-semibold text-[#0f172a]">{supportMetrics.support.endUserFailedLogins}</div></div>
                <div className={metricCard}><div className="text-xs text-[#64748b]">Password Resets</div><div className="text-2xl font-semibold text-[#0f172a]">{supportMetrics.support.resetRequests}</div></div>
                <div className={metricCard}><div className="text-xs text-[#64748b]">Email Verification Required</div><div className="text-2xl font-semibold text-[#0f172a]">{supportMetrics.support.emailVerificationRequired}</div></div>
                <div className={metricCard}><div className="text-xs text-[#64748b]">New IP Logins</div><div className="text-2xl font-semibold text-[#0f172a]">{supportMetrics.support.newIpLogins}</div></div>
                <div className={metricCard}><div className="text-xs text-[#64748b]">New Device Logins</div><div className="text-2xl font-semibold text-[#0f172a]">{supportMetrics.support.newDeviceLogins}</div></div>
                <div className={metricCard}><div className="text-xs text-[#64748b]">Session Revocations</div><div className="text-2xl font-semibold text-[#0f172a]">{supportMetrics.support.sessionRevocations}</div></div>
                <div className={metricCard}><div className="text-xs text-[#64748b]">Unauthorized Admin Attempts</div><div className="text-2xl font-semibold text-[#0f172a]">{supportMetrics.support.unauthorizedAdminAttempts}</div></div>
                <div className={metricCard}><div className="text-xs text-[#64748b]">Support Notes Created</div><div className="text-2xl font-semibold text-[#0f172a]">{supportMetrics.support.supportNotesCreated}</div></div>
                <div className={metricCard}><div className="text-xs text-[#64748b]">Note Creation Failures</div><div className="text-2xl font-semibold text-[#0f172a]">{supportMetrics.support.supportNoteCreateFailures}</div></div>
              </div>
            )}
            {supportMetrics && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <article className="rounded-xl border border-[#e2e8f0] p-3">
                  <h3 className="text-sm font-semibold text-[#0f172a]">Auth Error Frequency By Type</h3>
                  <div className="mt-2 space-y-1 text-sm text-[#334155]">
                    {(supportMetrics.support.authErrorBreakdown || []).length === 0 && <div>No auth errors recorded.</div>}
                    {(supportMetrics.support.authErrorBreakdown || []).map((item) => (
                      <div key={item.eventType} className="flex items-center justify-between gap-2">
                        <span>{item.eventType}</span>
                        <span className="font-semibold">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </article>
                <article className="rounded-xl border border-[#e2e8f0] p-3">
                  <h3 className="text-sm font-semibold text-[#0f172a]">Auth/API Failures By Endpoint</h3>
                  <div className="mt-2 space-y-1 text-sm text-[#334155]">
                    {(supportMetrics.support.authFailureByEndpoint || []).length === 0 && <div>No endpoint failures recorded.</div>}
                    {(supportMetrics.support.authFailureByEndpoint || []).map((item) => (
                      <div key={item.endpoint} className="flex items-center justify-between gap-2">
                        <span>{item.endpoint}</span>
                        <span className="font-semibold">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            )}
          </section>
        )}

        {viewMode === 'metrics-learning' && (
          <section className="rounded-2xl border border-[#1f2937]/20 bg-white/95 p-4">
            <h2 className="text-lg font-semibold text-[#0f172a]">Learning Metrics (Last 30 Days)</h2>
            <p className="mt-1 text-sm text-[#475569]">Broad overview of learning performance and progression quality.</p>
            {metricsLoading && <p className="mt-3 text-sm text-[#475569]">Loading metrics…</p>}
            {metricsError && <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">{metricsError}</p>}
            {learningMetrics && (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className={metricCard}><div className="text-xs text-[#64748b]">Quiz Attempts</div><div className="text-2xl font-semibold text-[#0f172a]">{learningMetrics.learning.quizAttempts}</div><div className="text-xs text-[#64748b]">Accuracy {learningMetrics.learning.quizAccuracyPct}%</div></div>
                <div className={metricCard}><div className="text-xs text-[#64748b]">Speak Attempts</div><div className="text-2xl font-semibold text-[#0f172a]">{learningMetrics.learning.speakAttempts}</div><div className="text-xs text-[#64748b]">Pass {learningMetrics.learning.speakPassPct}%</div></div>
                <div className={metricCard}><div className="text-xs text-[#64748b]">Lesson Starts</div><div className="text-2xl font-semibold text-[#0f172a]">{learningMetrics.learning.lessonStarts}</div></div>
                <div className={metricCard}><div className="text-xs text-[#64748b]">Lesson Starts (Tracked Event)</div><div className="text-2xl font-semibold text-[#0f172a]">{learningMetrics.learning.lessonStartsTracked ?? 0}</div></div>
                <div className={metricCard}><div className="text-xs text-[#64748b]">Lesson Completed</div><div className="text-2xl font-semibold text-[#0f172a]">{learningMetrics.learning.lessonCompleted}</div></div>
                <div className={metricCard}><div className="text-xs text-[#64748b]">Lesson Abandons</div><div className="text-2xl font-semibold text-[#0f172a]">{learningMetrics.learning.lessonAbandons}</div></div>
                <div className={metricCard}><div className="text-xs text-[#64748b]">Apply Completed</div><div className="text-2xl font-semibold text-[#0f172a]">{learningMetrics.learning.applyCompleted}</div></div>
              </div>
            )}

            {weakWordsByLanguage && (
              <div className="mt-5 rounded-xl border border-[#e2e8f0] p-3">
                <h3 className="text-sm font-semibold text-[#0f172a]">Most Missed Quiz Words By Language</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {weakWordsByLanguage.languages.map((bucket) => (
                    <article
                      key={bucket.languageId}
                      className={`rounded-lg border p-3 ${
                        bucket.hasData
                          ? 'border-[#dbe7ff] bg-[#f8fbff]'
                          : 'border-[#e2e8f0] bg-[#f1f5f9] text-[#94a3b8]'
                      }`}
                    >
                      <div className="text-xs uppercase tracking-[0.16em]">
                        {bucket.languageId}
                      </div>
                      {!bucket.hasData && <div className="mt-2 text-sm">No data yet</div>}
                      {bucket.hasData && (
                        <div className="mt-2 space-y-1 text-sm">
                          {bucket.words.map((word) => (
                            <div key={`${bucket.languageId}-${word.wordId}`} className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-[#0f172a]">{word.nativeText}</div>
                                <div className="truncate text-[#475569]">{word.englishText}</div>
                              </div>
                              <span className="font-semibold">{word.misses}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )}
            {weakSpeakWordsByLanguage && (
              <div className="mt-5 rounded-xl border border-[#e2e8f0] p-3">
                <h3 className="text-sm font-semibold text-[#0f172a]">Most Missed Speak Words By Language</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {weakSpeakWordsByLanguage.languages.map((bucket) => (
                    <article
                      key={`speak-${bucket.languageId}`}
                      className={`rounded-lg border p-3 ${
                        bucket.hasData
                          ? 'border-[#dbe7ff] bg-[#f8fbff]'
                          : 'border-[#e2e8f0] bg-[#f1f5f9] text-[#94a3b8]'
                      }`}
                    >
                      <div className="text-xs uppercase tracking-[0.16em]">
                        {bucket.languageId}
                      </div>
                      {!bucket.hasData && <div className="mt-2 text-sm">No data yet</div>}
                      {bucket.hasData && (
                        <div className="mt-2 space-y-1 text-sm">
                          {bucket.words.map((word) => (
                            <div key={`speak-${bucket.languageId}-${word.wordId}`} className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-[#0f172a]">{word.nativeText}</div>
                                <div className="truncate text-[#475569]">{word.englishText}</div>
                              </div>
                              <span className="font-semibold">{word.misses}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {viewMode === 'ops' && (
          <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <section className="rounded-2xl border border-[#1f2937]/20 bg-white/95 p-4">
              <h2 className="text-lg font-semibold text-[#0f172a]">User Operations</h2>
              <p className="mt-1 text-xs text-[#334155]">Internal use only. All write actions require a reason and are audited.</p>
              <div className="mt-4 max-h-[68vh] space-y-2 overflow-auto pr-1">
                {searchResults.map((entry) => {
                  const active = selectedUserId === entry.userId;
                  return (
                    <article
                      key={entry.userId}
                      className={`w-full rounded-xl border p-3 ${active ? 'border-[#1f2937] bg-[#f8fafc]' : 'border-[#e2e8f0] bg-white'}`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(entry.userId)}
                        className="w-full text-left"
                      >
                        <div className="text-sm font-semibold text-[#0f172a]">{entry.displayName || entry.email || entry.userId}</div>
                        <div className="text-xs text-[#475569]">{entry.email || 'No email'}</div>
                        <div className="mt-1 text-xs text-[#64748b]">{entry.targetLanguage || 'no language'} | onboarding {entry.onboardingComplete ? 'done' : 'pending'}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteCandidate(entry)}
                        className="mt-2 w-full rounded-lg border border-red-400 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        Permanently Delete User
                      </button>
                    </article>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-2">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by email or name" className={baseInput} />
                <button type="button" onClick={() => void runSearch()} disabled={searchLoading} className={baseButton}>{searchLoading ? '...' : 'Find'}</button>
              </div>
            </section>

            <section className="rounded-2xl border border-[#1f2937]/20 bg-white/95 p-4">
              {!selectedUserId && <p className="text-sm text-[#475569]">Select a user to view details.</p>}
              {selectedUserId && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-[#0f172a]">{selectedUser?.displayName || selectedUser?.email || selectedUserId}</h2>
                      <p className="text-sm text-[#475569]">{selectedUserId}</p>
                    </div>
                    <button type="button" onClick={() => void refreshSelectedUser(selectedUserId)} className={baseButton}>Refresh</button>
                  </div>

                  {detailLoading && <p className="mt-3 text-sm text-[#475569]">Loading user details…</p>}
                  {detailError && <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">{detailError}</p>}

                  {overview && (
                    <>
                      <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <div className={metricCard}><div className="text-xs text-[#64748b]">Language</div><div className="text-sm font-semibold text-[#0f172a]">{overview.profile.targetLanguage || 'n/a'}</div></div>
                        <div className={metricCard}><div className="text-xs text-[#64748b]">Streak</div><div className="text-sm font-semibold text-[#0f172a]">{overview.progress?.streak ?? 0}</div></div>
                        <div className={metricCard}><div className="text-xs text-[#64748b]">Quiz Attempts</div><div className="text-sm font-semibold text-[#0f172a]">{overview.counts.quizCount}</div></div>
                        <div className={metricCard}><div className="text-xs text-[#64748b]">Speak Attempts</div><div className="text-sm font-semibold text-[#0f172a]">{overview.counts.speakCount}</div></div>
                      </div>

                      <div className="mt-4 grid gap-4 xl:grid-cols-2">
                        <div className="rounded-xl border border-[#e2e8f0] p-3">
                          <h3 className="text-sm font-semibold text-[#0f172a]">Operational Note</h3>
                          <textarea className={`${baseInput} mt-2 min-h-[120px] resize-y`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add context (device switch issue, suspicious login report, beta exception, deletion request details...)" />
                          <input className={`${baseInput} mt-2`} value={noteReason} onChange={(event) => setNoteReason(event.target.value)} placeholder="Reason (required)" />
                          <button
                            type="button"
                            className={`${baseButton} mt-2`}
                            disabled={busyAction !== null || note.trim().length < 3 || noteReason.trim().length < 8}
                            onClick={() => void runMutation('add-note', `/v1/admin/users/${selectedUserId}/notes`, { note: note.trim(), reason: noteReason.trim() })}
                          >
                            Save Note
                          </button>
                        </div>

                        <div className="rounded-xl border border-[#e2e8f0] p-3">
                          <h3 className="text-sm font-semibold text-[#0f172a]">Admin Actions</h3>
                          <input className={`${baseInput} mt-2`} value={actionReason} onChange={(event) => setActionReason(event.target.value)} placeholder="Reason for action (required)" />
                          <div className="mt-2 grid gap-2">
                            <button type="button" className={baseButton} disabled={busyAction !== null || actionReason.trim().length < 8} onClick={() => void runMutation('reset-walkthrough', `/v1/admin/users/${selectedUserId}/actions/reset-walkthrough`, { reason: actionReason.trim() })}>Reset Walkthrough</button>
                            <button type="button" className={baseButton} disabled={busyAction !== null || actionReason.trim().length < 8} onClick={() => void runMutation('revoke-sessions', `/v1/admin/users/${selectedUserId}/actions/revoke-sessions`, { reason: actionReason.trim() })}>Revoke Sessions</button>
                          </div>
                          <div className="mt-3 border-t border-[#e2e8f0] pt-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">Deletion Workflow</div>
                            <input className={`${baseInput} mt-2`} value={actionChannel} onChange={(event) => setActionChannel(event.target.value)} placeholder="Channel (support-email, in-app, etc.)" />
                            <div className="mt-2 grid gap-2 md:grid-cols-3">
                              <button type="button" className={baseButton} disabled={busyAction !== null || actionReason.trim().length < 8} onClick={() => void runMutation('request-deletion', `/v1/admin/users/${selectedUserId}/actions/request-deletion`, { reason: actionReason.trim(), channel: actionChannel.trim() || 'support-email' })}>Request Deletion</button>
                              <button type="button" className={baseButton} disabled={busyAction !== null || actionReason.trim().length < 8} onClick={() => void runMutation('resolve-deletion', `/v1/admin/users/${selectedUserId}/actions/resolve-deletion`, { reason: actionReason.trim(), status: 'resolved' })}>Resolve Request</button>
                              <button type="button" className={baseButton} disabled={busyAction !== null || actionReason.trim().length < 8} onClick={() => void runMutation('reject-deletion', `/v1/admin/users/${selectedUserId}/actions/resolve-deletion`, { reason: actionReason.trim(), status: 'rejected' })}>Reject Request</button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-[#e2e8f0] p-3">
                        <h3 className="text-sm font-semibold text-[#0f172a]">Timeline</h3>
                        <div className="mt-2 max-h-[38vh] space-y-2 overflow-auto pr-1">
                          {timeline.map((entry, index) => (
                            <article key={`${entry.createdAt}-${entry.source}-${index}`} className="rounded-lg border border-[#e2e8f0] p-2">
                              <div className="text-xs uppercase tracking-[0.14em] text-[#64748b]">{entry.source} | {toLocale(entry.createdAt)}</div>
                              <div className="text-sm font-semibold text-[#0f172a]">{entry.title}</div>
                              {entry.detail && <div className="text-sm text-[#334155]">{entry.detail}</div>}
                            </article>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>
      {deleteCandidate && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#1f2937]/20 bg-white p-5">
            <h3 className="text-lg font-semibold text-[#0f172a]">Confirm Permanent Deletion</h3>
            <p className="mt-2 text-sm text-[#475569]">
              You are about to permanently delete this account from the database.
              Double-check the user and make sure deletion is required.
            </p>
            <div className="mt-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-sm">
              <div className="font-semibold text-[#0f172a]">{deleteCandidate.displayName || deleteCandidate.email || deleteCandidate.userId}</div>
              <div className="text-[#475569]">{deleteCandidate.email || 'No email'}</div>
              <div className="text-[#64748b]">{deleteCandidate.userId}</div>
            </div>
            <input
              className={`${baseInput} mt-3`}
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              placeholder="Reason for permanent deletion (required)"
            />
            <input
              className={`${baseInput} mt-2`}
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder="Type DELETE to confirm"
            />
            <div className="mt-4 flex justify-between gap-2">
              <button
                type="button"
                className="rounded-xl border border-red-700 bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-red-300 disabled:border-red-300"
                disabled={
                  deleteBusy ||
                  deleteReason.trim().length < 8 ||
                  deleteConfirmText.trim() !== 'DELETE' ||
                  !deleteAcknowledge
                }
                onClick={() => void handlePermanentDeleteUser()}
              >
                {deleteBusy ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button
                type="button"
                className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937]"
                onClick={() => {
                  if (deleteBusy) return;
                  setDeleteCandidate(null);
                  setDeleteReason('');
                  setDeleteConfirmText('');
                  setDeleteAcknowledge(false);
                }}
              >
                Cancel
              </button>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-[#334155]">
              <input
                type="checkbox"
                checked={deleteAcknowledge}
                onChange={(event) => setDeleteAcknowledge(event.target.checked)}
              />
              I understand this deletion is permanent and cannot be undone.
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
