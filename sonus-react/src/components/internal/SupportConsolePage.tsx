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
  security: {
    activeSessionCount: number;
    recentIps: Array<{ ip: string; lastSeenAt: string }>;
    recentDevices: Array<{ device: string; lastSeenAt: string }>;
    lastPasswordResetAt: string | null;
    lastForcedLogoutAt: string | null;
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

type SupportNoteEntry = {
  id: string;
  createdAt: string;
  note: string;
  actorEmail: string | null;
};

type OpenDeletionRequest = {
  id: string;
  targetUserId: string;
  targetEmail: string | null;
  targetDisplayName: string | null;
  requestReason: string;
  requestChannel: string | null;
  createdAt: string;
};

type DeletionCaseEntry = {
  sourceType: string;
  status: string;
  targetUserId: string;
  targetEmail: string | null;
  targetDisplayName: string | null;
  reason: string;
  channel: string | null;
  eventAt: string;
  detail: string | null;
};

type RecentDeletionItem = {
  id: string;
  targetUserId: string;
  targetEmail: string | null;
  targetDisplayName: string | null;
  reason: string;
  status: 'scheduled' | 'cancelled' | 'completed';
  holdDays: number;
  scheduledFor: string;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  daysRemaining: number;
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
    currentUsers: number;
    activeUsers: number;
    activeWindowMinutes: number;
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

function timelineSourceLabel(entry: TimelineEntry) {
  if (entry.source === 'security_event' && entry.title.startsWith('support_note_')) {
    return 'note_event';
  }
  return entry.source;
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
  const [savedNotes, setSavedNotes] = useState<SupportNoteEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteReason, setNoteReason] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [actionChannel, setActionChannel] = useState('email');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [supportMetrics, setSupportMetrics] = useState<SupportMetrics | null>(null);
  const [learningMetrics, setLearningMetrics] = useState<LearningMetrics | null>(null);
  const [weakWordsByLanguage, setWeakWordsByLanguage] = useState<WeakWordsByLanguage | null>(null);
  const [weakSpeakWordsByLanguage, setWeakSpeakWordsByLanguage] = useState<WeakWordsByLanguage | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [adminTimeline, setAdminTimeline] = useState<TimelineEntry[]>([]);
  const [adminTimelineLoading, setAdminTimelineLoading] = useState(false);
  const [adminTimelineError, setAdminTimelineError] = useState<string | null>(null);
  const [recentDeletions, setRecentDeletions] = useState<RecentDeletionItem[]>([]);
  const [recentDeletionsLoading, setRecentDeletionsLoading] = useState(false);
  const [recentDeletionsError, setRecentDeletionsError] = useState<string | null>(null);
  const [openDeletionRequests, setOpenDeletionRequests] = useState<OpenDeletionRequest[]>([]);
  const [openDeletionRequestsLoading, setOpenDeletionRequestsLoading] = useState(false);
  const [openDeletionRequestsError, setOpenDeletionRequestsError] = useState<string | null>(null);
  const [requestModal, setRequestModal] = useState<OpenDeletionRequest | null>(null);
  const [requestDecisionReason, setRequestDecisionReason] = useState('');
  const [requestDecisionBusy, setRequestDecisionBusy] = useState(false);
  const [deletionCaseSearch, setDeletionCaseSearch] = useState('');
  const [deletionCases, setDeletionCases] = useState<DeletionCaseEntry[]>([]);
  const [deletionCasesLoading, setDeletionCasesLoading] = useState(false);
  const [deletionCasesError, setDeletionCasesError] = useState<string | null>(null);
  const [undoBusyUserId, setUndoBusyUserId] = useState<string | null>(null);
  const [undoDeletionReason, setUndoDeletionReason] = useState('');
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<SearchResult | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteAcknowledge, setDeleteAcknowledge] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteSuccessOpen, setDeleteSuccessOpen] = useState(false);
  const [metricsWindowDays, setMetricsWindowDays] = useState<7 | 30 | 90>(30);

  const viewMode = useMemo<'dashboard' | 'ops' | 'metrics-support' | 'metrics-learning'>(() => {
    if (location.pathname.endsWith('/users')) return 'ops';
    if (location.pathname.endsWith('/metrics/support')) return 'metrics-support';
    if (location.pathname.endsWith('/metrics/learning')) return 'metrics-learning';
    return 'dashboard';
  }, [location.pathname]);

  const selectedUser = useMemo(
    () => searchResults.find((entry) => entry.userId === selectedUserId) || null,
    [searchResults, selectedUserId]
  );
  const selectedTargetLabel = useMemo(() => {
    if (!selectedUserId) return 'No user selected';
    const name = (selectedUser?.displayName || '').trim();
    const email = (selectedUser?.email || '').trim();
    if (name && email) return `${name} (${email})`;
    if (name) return name;
    if (email) return email;
    return selectedUserId;
  }, [selectedUserId, selectedUser]);
  const deletionWorkflowReason = useMemo(() => {
    const primary = actionReason.trim();
    if (primary.length >= 8) return primary;
    const fallback = actionChannel.trim();
    return fallback.length >= 8 ? fallback : '';
  }, [actionReason, actionChannel]);

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
      const [overviewPayload, timelinePayload, notesPayload] = await Promise.all([
        parseJsonOrThrow<UserOverview>(await apiFetch(`/v1/admin/users/${targetUserId}`, { cache: 'no-store' })),
        parseJsonOrThrow<{ timeline?: TimelineEntry[] }>(
          await apiFetch(`/v1/admin/users/${targetUserId}/timeline?limit=120`, { cache: 'no-store' })
        ),
        parseJsonOrThrow<{ notes?: SupportNoteEntry[] }>(
          await apiFetch(`/v1/admin/users/${targetUserId}/notes?limit=80`, { cache: 'no-store' })
        ),
      ]);
      setOverview(overviewPayload);
      setTimeline(timelinePayload.timeline || []);
      setSavedNotes(notesPayload.notes || []);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Failed to load user details');
      setOverview(null);
      setTimeline([]);
      setSavedNotes([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const loadSupportMetrics = async (windowDays = metricsWindowDays) => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const payload = await parseJsonOrThrow<SupportMetrics>(
        await apiFetch(`/v1/admin/metrics/support/overview?windowDays=${windowDays}`, {
          cache: 'no-store',
        })
      );
      setSupportMetrics(payload);
    } catch (error) {
      setMetricsError(error instanceof Error ? error.message : 'Failed to load support metrics');
    } finally {
      setMetricsLoading(false);
    }
  };

  const loadLearningMetrics = async (windowDays = metricsWindowDays) => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const [overviewPayload, weakWordsByLanguagePayload, weakSpeakWordsByLanguagePayload] = await Promise.all([
        parseJsonOrThrow<LearningMetrics>(
          await apiFetch(`/v1/admin/metrics/learning/overview?windowDays=${windowDays}`, {
            cache: 'no-store',
          })
        ),
        parseJsonOrThrow<WeakWordsByLanguage>(
          await apiFetch(
            `/v1/admin/metrics/learning/weak-words-by-language?windowDays=${windowDays}&limitPerLanguage=5`,
            {
              cache: 'no-store',
            }
          )
        ),
        parseJsonOrThrow<WeakWordsByLanguage>(
          await apiFetch(
            `/v1/admin/metrics/learning/weak-speak-words-by-language?windowDays=${windowDays}&limitPerLanguage=5`,
            {
              cache: 'no-store',
            }
          )
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

  const loadDashboardMetrics = async (windowDays = metricsWindowDays) => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const [supportPayload, learningPayload] = await Promise.all([
        parseJsonOrThrow<SupportMetrics>(
          await apiFetch(`/v1/admin/metrics/support/overview?windowDays=${windowDays}`, {
            cache: 'no-store',
          })
        ),
        parseJsonOrThrow<LearningMetrics>(
          await apiFetch(`/v1/admin/metrics/learning/overview?windowDays=${windowDays}`, {
            cache: 'no-store',
          })
        ),
      ]);
      setSupportMetrics(supportPayload);
      setLearningMetrics(learningPayload);
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : 'Failed to load dashboard metrics');
    } finally {
      setDashboardLoading(false);
    }
  };

  const loadAdminTimeline = async () => {
    setAdminTimelineLoading(true);
    setAdminTimelineError(null);
    try {
      let timelinePayload: { timeline?: TimelineEntry[] } | null = null;
      try {
        timelinePayload = await parseJsonOrThrow<{ timeline?: TimelineEntry[] }>(
          await apiFetch('/v1/admin/me/timeline?windowHours=24&limit=80', { cache: 'no-store' })
        );
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : '';
        if (!message.includes('not found')) throw error;
        timelinePayload = await parseJsonOrThrow<{ timeline?: TimelineEntry[] }>(
          await apiFetch('/v1/admin/timeline?windowHours=24&limit=80', { cache: 'no-store' })
        );
      }
      setAdminTimeline(timelinePayload?.timeline || []);
    } catch (error) {
      setAdminTimelineError(error instanceof Error ? error.message : 'Failed to load admin timeline');
      setAdminTimeline([]);
    } finally {
      setAdminTimelineLoading(false);
    }
  };

  const loadRecentDeletions = async () => {
    setRecentDeletionsLoading(true);
    setRecentDeletionsError(null);
    try {
      const payload = await parseJsonOrThrow<{ items?: RecentDeletionItem[] }>(
        await apiFetch('/v1/admin/users/deletions/recent?limit=12', { cache: 'no-store' })
      );
      setRecentDeletions(payload.items || []);
    } catch (error) {
      setRecentDeletionsError(error instanceof Error ? error.message : 'Failed to load recent deletions');
      setRecentDeletions([]);
    } finally {
      setRecentDeletionsLoading(false);
    }
  };

  const loadOpenDeletionRequests = async () => {
    setOpenDeletionRequestsLoading(true);
    setOpenDeletionRequestsError(null);
    try {
      const payload = await parseJsonOrThrow<{ requests?: OpenDeletionRequest[] }>(
        await apiFetch('/v1/admin/deletion-requests/open?limit=20', { cache: 'no-store' })
      );
      setOpenDeletionRequests(payload.requests || []);
    } catch (error) {
      setOpenDeletionRequestsError(
        error instanceof Error ? error.message : 'Failed to load deletion requests'
      );
      setOpenDeletionRequests([]);
    } finally {
      setOpenDeletionRequestsLoading(false);
    }
  };

  const loadDeletionCases = async (query?: string) => {
    setDeletionCasesLoading(true);
    setDeletionCasesError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '40');
      const q = (query ?? deletionCaseSearch).trim();
      if (q) params.set('q', q);
      const payload = await parseJsonOrThrow<{ cases?: DeletionCaseEntry[] }>(
        await apiFetch(`/v1/admin/metrics/support/deletion-cases?${params.toString()}`, { cache: 'no-store' })
      );
      setDeletionCases(payload.cases || []);
    } catch (error) {
      setDeletionCasesError(error instanceof Error ? error.message : 'Failed to load deletion cases');
      setDeletionCases([]);
    } finally {
      setDeletionCasesLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refreshSetupStatus(adminUsername);
      const ok = await verifySupportAdminSession();
      if (!cancelled) {
        setBootLoading(false);
        if (ok) {
          if (viewMode === 'ops') void runSearch();
          if (viewMode === 'dashboard') {
            void loadDashboardMetrics(metricsWindowDays);
            void loadAdminTimeline();
          }
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
    if (viewMode === 'dashboard') {
      void loadDashboardMetrics(metricsWindowDays);
      void loadAdminTimeline();
      return;
    }
    if (viewMode === 'metrics-support') {
      void loadSupportMetrics(metricsWindowDays);
      void loadDeletionCases('');
      return;
    }
    if (viewMode === 'metrics-learning') {
      void loadLearningMetrics(metricsWindowDays);
    }
  }, [authenticated, viewMode, metricsWindowDays]);

  useEffect(() => {
    if (!selectedUserId || !authenticated || viewMode !== 'ops') {
      setOverview(null);
      setTimeline([]);
      setSavedNotes([]);
      return;
    }
    void refreshSelectedUser(selectedUserId);
  }, [selectedUserId, authenticated, viewMode]);

  useEffect(() => {
    if (!authenticated || viewMode !== 'ops') return;
    // Ensure User Operations repopulates whenever the view is entered.
    void runSearch();
    void loadRecentDeletions();
    void loadOpenDeletionRequests();
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
      if (action.includes('deletion') || action === 'request-deletion') {
        await loadOpenDeletionRequests();
        await loadDeletionCases();
      }
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
          }),
        })
      );
      const removedUserId = deleteCandidate.userId;
      setDeleteCandidate(null);
      setDeleteReason('');
      setDeleteAcknowledge(false);
      setDeleteSuccessOpen(true);
      if (selectedUserId === removedUserId) {
        setSelectedUserId(null);
        setOverview(null);
        setTimeline([]);
      }
      await runSearch();
      await loadRecentDeletions();
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Permanent deletion failed');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleUndoScheduledDeletion = async (targetUserId: string) => {
    const reason =
      undoDeletionReason.trim().length >= 8
        ? undoDeletionReason.trim()
        : 'Admin undo: restore scheduled deletion target before permanent purge.';
    setUndoBusyUserId(targetUserId);
    setDetailError(null);
    try {
      await parseJsonOrThrow(
        await apiFetch(`/v1/admin/users/${targetUserId}/actions/undo-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        })
      );
      setUndoDeletionReason('');
      await loadRecentDeletions();
      await runSearch();
      if (selectedUserId === targetUserId) {
        await refreshSelectedUser(targetUserId);
      }
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Undo deletion failed');
    } finally {
      setUndoBusyUserId(null);
    }
  };

  const handleDeleteSupportNote = async (noteId: string) => {
    if (!selectedUserId) return;
    const reason =
      noteReason.trim().length >= 8
        ? noteReason.trim()
        : 'Admin deleted support note from support console.';
    setDeletingNoteId(noteId);
    setDetailError(null);
    try {
      await parseJsonOrThrow(
        await apiFetch(`/v1/admin/users/${selectedUserId}/notes/${noteId}/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        })
      );
      setSavedNotes((prev) => prev.filter((entry) => entry.id !== noteId));
      void refreshSelectedUser(selectedUserId);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Failed to delete note');
    } finally {
      setDeletingNoteId(null);
    }
  };

  const handleDeletionRequestDecision = async (status: 'resolved' | 'rejected') => {
    if (!requestModal) return;
    const reason = requestDecisionReason.trim();
    if (reason.length < 8) return;
    setRequestDecisionBusy(true);
    setDetailError(null);
    try {
      await parseJsonOrThrow(
        await apiFetch(`/v1/admin/users/${requestModal.targetUserId}/actions/resolve-deletion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason, status }),
        })
      );
      setRequestModal(null);
      setRequestDecisionReason('');
      await loadOpenDeletionRequests();
      await loadDeletionCases();
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Failed to update deletion request');
    } finally {
      setRequestDecisionBusy(false);
    }
  };

  if (bootLoading) {
    return <div className="min-h-screen page-shell flex items-center justify-center text-[#1f2937]">Loading…</div>;
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen page-shell px-4 py-6 text-[#1f2937] flex items-center justify-center">
        <div className="w-full">
          <div className={`mx-auto grid gap-4 ${setupRequired ? 'max-w-5xl md:grid-cols-2' : 'max-w-md'}`}>
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
          {authError && <div className="mx-auto mt-4 max-w-5xl rounded-xl border border-[#1f2937]/20 bg-white/95 p-3 text-sm text-[#1f2937]">{authError}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-shell p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <section className="mb-4 rounded-2xl border border-white/40 bg-[#1f2937] p-4">
          <div className="relative flex items-center justify-end">
            <img
              src="/branding/Logo_White.png"
              alt="Sonus"
              className="absolute left-1/2 h-6 w-auto -translate-x-1/2 opacity-95 md:h-7"
              loading="eager"
            />
            <button
              type="button"
              className="text-sm font-medium text-white underline underline-offset-4 transition hover:text-white/80"
              onClick={() => void handleSupportLogout()}
            >
              Log Out
            </button>
          </div>
          <div className="mt-3 min-w-0 text-center">
            <h1 className="text-xl font-semibold text-white">Support Console Dashboard</h1>
            <p className="text-sm text-white/80">Main analytics dashboard with focused drill-down pages.</p>
          </div>
          <div className="mt-3">
            <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:justify-center">
              <button
                type="button"
                className="h-11 w-full rounded-xl border border-white bg-white/5 px-3 text-sm font-semibold text-white transition hover:bg-white/10 md:w-40"
                onClick={() => navigate('/internal/support')}
              >
                Home
              </button>
              <button
                type="button"
                className="h-11 w-full rounded-xl border border-white bg-white/5 px-3 text-sm font-semibold text-white transition hover:bg-white/10 md:w-40"
                onClick={() => navigate('/internal/support/users')}
              >
                User Operations
              </button>
              <button
                type="button"
                className="h-11 w-full rounded-xl border border-white bg-white/5 px-3 text-sm font-semibold text-white transition hover:bg-white/10 md:w-40"
                onClick={() => navigate('/internal/support/metrics/support')}
              >
                Support Metrics
              </button>
              <button
                type="button"
                className="h-11 w-full rounded-xl border border-white bg-white/5 px-3 text-sm font-semibold text-white transition hover:bg-white/10 md:w-40"
                onClick={() => navigate('/internal/support/metrics/learning')}
              >
                Learning Metrics
              </button>
            </div>
          </div>
        </section>

        {viewMode === 'dashboard' && (
          <section className="rounded-2xl border border-[#1f2937]/20 bg-white/95 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[#0f172a]">Analytics (Last {metricsWindowDays} Days)</h2>
              <div className="flex items-center gap-2">
                <div className="flex rounded-xl border border-[#d1d5db] bg-white p-1">
                  {[7, 30, 90].map((days) => (
                    <button
                      key={`home-window-${days}`}
                      type="button"
                      onClick={() => setMetricsWindowDays(days as 7 | 30 | 90)}
                      className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                        metricsWindowDays === days ? 'bg-[#1f2937] text-white' : 'text-[#334155]'
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
                <button type="button" className={baseButton} onClick={() => void loadDashboardMetrics(metricsWindowDays)}>Refresh</button>
              </div>
            </div>
            {dashboardLoading && <p className="mt-3 text-sm text-[#475569]">Loading dashboard analytics…</p>}
            {dashboardError && <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">{dashboardError}</p>}
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4 [&>*:last-child:nth-child(odd)]:col-span-2 [&>*:last-child:nth-child(odd)]:mx-auto [&>*:last-child:nth-child(odd)]:w-full [&>*:last-child:nth-child(odd)]:max-w-md md:[&>*:last-child:nth-child(odd)]:col-span-1 md:[&>*:last-child:nth-child(odd)]:mx-0 md:[&>*:last-child:nth-child(odd)]:max-w-none">
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">Current Users</div>
                <div className="text-2xl font-semibold text-[#0f172a]">{supportMetrics?.support.currentUsers ?? 0}</div>
              </article>
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">
                  Active Users
                  <span className="ml-1 text-[11px] text-[#94a3b8]">
                    ({supportMetrics?.support.activeWindowMinutes ?? 15}m)
                  </span>
                </div>
                <div className="text-2xl font-semibold text-[#0f172a]">{supportMetrics?.support.activeUsers ?? 0}</div>
              </article>
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">End-User Failed Logins</div>
                <div className="text-2xl font-semibold text-[#0f172a]">{supportMetrics?.support.endUserFailedLogins ?? 0}</div>
              </article>
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">Unauthorized Admin Attempts</div>
                <div className="text-2xl font-semibold text-[#0f172a]">{supportMetrics?.support.unauthorizedAdminAttempts ?? 0}</div>
              </article>
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">Quiz Accuracy</div>
                <div className="text-2xl font-semibold text-[#0f172a]">{learningMetrics?.learning.quizAccuracyPct ?? 0}%</div>
              </article>
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">Speak Pass Rate</div>
                <div className="text-2xl font-semibold text-[#0f172a]">{learningMetrics?.learning.speakPassPct ?? 0}%</div>
              </article>
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">Lessons Finished</div>
                <div className="text-2xl font-semibold text-[#0f172a]">{learningMetrics?.learning.lessonCompletionPct ?? 0}%</div>
              </article>
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">Lessons Abandoned</div>
                <div className="text-2xl font-semibold text-[#0f172a]">{learningMetrics?.learning.lessonAbandons ?? 0}</div>
              </article>
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">Support Notes Created</div>
                <div className="text-2xl font-semibold text-[#0f172a]">{supportMetrics?.support.supportNotesCreated ?? 0}</div>
              </article>
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">Password Reset Requests</div>
                <div className="text-2xl font-semibold text-[#0f172a]">{supportMetrics?.support.resetRequests ?? 0}</div>
              </article>
            </div>
            <div className="mt-4 rounded-xl border border-[#f59e0b]/40 bg-[#fff7ed] p-3">
              <h3 className="text-sm font-semibold text-[#9a3412]">Watchlist</h3>
              <div className="mt-2 grid gap-2 text-sm text-[#7c2d12] md:grid-cols-3">
                <div>Unauthorized admin attempts: <span className="font-semibold">{supportMetrics?.support.unauthorizedAdminAttempts ?? 0}</span></div>
                <div>End-user failed logins: <span className="font-semibold">{supportMetrics?.support.endUserFailedLogins ?? 0}</span></div>
                <div>Lesson abandons: <span className="font-semibold">{learningMetrics?.learning.lessonAbandons ?? 0}</span></div>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-[#e2e8f0] p-3">
              <h3 className="text-sm font-semibold text-[#0f172a]">Your Admin Timeline</h3>
              <p className="mt-1 text-xs text-[#64748b]">Admin tasks only. Last 24 hours.</p>
              {adminTimelineLoading && <p className="mt-2 text-sm text-[#475569]">Loading timeline…</p>}
              {adminTimelineError && <p className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">{adminTimelineError}</p>}
              {!adminTimelineLoading && !adminTimelineError && adminTimeline.length === 0 && (
                <p className="mt-2 text-sm text-[#64748b]">No timeline events yet.</p>
              )}
              {!adminTimelineLoading && !adminTimelineError && adminTimeline.length > 0 && (
                <div className="mt-3 max-h-[36vh] space-y-2 overflow-auto pr-1">
                  {adminTimeline.map((entry, index) => (
                    <article key={`${entry.createdAt}-${entry.source}-${index}`} className="rounded-lg border border-[#e2e8f0] p-2">
                      <div className="text-xs uppercase tracking-[0.14em] text-[#64748b]">{entry.source} | {toLocale(entry.createdAt)}</div>
                      <div className="text-sm font-semibold text-[#0f172a]">{entry.title}</div>
                      {entry.detail && <div className="text-sm text-[#334155]">{entry.detail}</div>}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {viewMode === 'metrics-support' && (
          <section className="rounded-2xl border border-[#1f2937]/20 bg-white/95 p-4">
            <h2 className="text-lg font-semibold text-[#0f172a]">Support Metrics (Last {metricsWindowDays} Days)</h2>
            <p className="mt-1 text-sm text-[#475569]">Broad overview of account access, security, and support workload.</p>
            <p className="mt-1 text-xs text-[#64748b]">Use the same time window across pages for consistent metric interpretation.</p>
            <div className="mt-3 inline-flex rounded-xl border border-[#d1d5db] bg-white p-1">
              {[7, 30, 90].map((days) => (
                <button
                  key={`support-window-${days}`}
                  type="button"
                  onClick={() => setMetricsWindowDays(days as 7 | 30 | 90)}
                  className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                    metricsWindowDays === days ? 'bg-[#1f2937] text-white' : 'text-[#334155]'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
            {metricsLoading && <p className="mt-3 text-sm text-[#475569]">Loading metrics…</p>}
            {metricsError && <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">{metricsError}</p>}
            {supportMetrics && (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 [&>*:last-child:nth-child(odd)]:col-span-2 [&>*:last-child:nth-child(odd)]:mx-auto [&>*:last-child:nth-child(odd)]:w-full [&>*:last-child:nth-child(odd)]:max-w-md md:[&>*:last-child:nth-child(odd)]:col-span-1 md:[&>*:last-child:nth-child(odd)]:mx-0 md:[&>*:last-child:nth-child(odd)]:max-w-none">
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
            <div className="mt-4 rounded-xl border border-[#e2e8f0] p-3">
              <h3 className="text-sm font-semibold text-[#0f172a]">Deletion Cases</h3>
              <div className="mt-2 flex gap-2">
                <input
                  className={baseInput}
                  value={deletionCaseSearch}
                  onChange={(event) => setDeletionCaseSearch(event.target.value)}
                  placeholder="Search by email, name, or user id"
                />
                <button type="button" className={baseButton} onClick={() => void loadDeletionCases()} disabled={deletionCasesLoading}>
                  {deletionCasesLoading ? '...' : 'Find'}
                </button>
              </div>
              {deletionCasesError && <p className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">{deletionCasesError}</p>}
              {!deletionCasesError && deletionCases.length === 0 && !deletionCasesLoading && (
                <p className="mt-2 text-sm text-[#64748b]">No deletion cases found.</p>
              )}
              <div className="mt-2 max-h-[26vh] space-y-2 overflow-auto pr-1">
                {deletionCases.map((entry, index) => (
                  <article key={`${entry.sourceType}-${entry.targetUserId}-${entry.eventAt}-${index}`} className="rounded-lg border border-[#e2e8f0] p-2">
                    <div className="text-xs uppercase tracking-[0.14em] text-[#64748b]">
                      {entry.sourceType} | {entry.status} | {toLocale(entry.eventAt)}
                    </div>
                    <div className="text-sm font-semibold text-[#0f172a]">{entry.targetDisplayName || entry.targetEmail || entry.targetUserId}</div>
                    <div className="text-xs text-[#64748b]">{entry.targetEmail || 'No email'}</div>
                    <div className="mt-1 text-xs text-[#334155]">{entry.reason}</div>
                    {entry.detail && <div className="text-xs text-[#64748b]">Detail: {entry.detail}</div>}
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {viewMode === 'metrics-learning' && (
          <section className="rounded-2xl border border-[#1f2937]/20 bg-white/95 p-4">
            <h2 className="text-lg font-semibold text-[#0f172a]">Learning Metrics (Last {metricsWindowDays} Days)</h2>
            <p className="mt-1 text-sm text-[#475569]">Broad overview of learning performance and progression quality.</p>
            <p className="mt-1 text-xs text-[#64748b]">Definitions: finished = reached the Lesson Complete screen. abandoned = started but never reached Lesson Complete.</p>
            <div className="mt-3 inline-flex rounded-xl border border-[#d1d5db] bg-white p-1">
              {[7, 30, 90].map((days) => (
                <button
                  key={`learning-window-${days}`}
                  type="button"
                  onClick={() => setMetricsWindowDays(days as 7 | 30 | 90)}
                  className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                    metricsWindowDays === days ? 'bg-[#1f2937] text-white' : 'text-[#334155]'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
            {metricsLoading && <p className="mt-3 text-sm text-[#475569]">Loading metrics…</p>}
            {metricsError && <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">{metricsError}</p>}
            {learningMetrics && (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 [&>*:last-child:nth-child(odd)]:col-span-2 [&>*:last-child:nth-child(odd)]:mx-auto [&>*:last-child:nth-child(odd)]:w-full [&>*:last-child:nth-child(odd)]:max-w-md md:[&>*:last-child:nth-child(odd)]:col-span-1 md:[&>*:last-child:nth-child(odd)]:mx-0 md:[&>*:last-child:nth-child(odd)]:max-w-none">
                <div className={metricCard}><div className="text-xs text-[#64748b]">Quiz Attempts</div><div className="text-2xl font-semibold text-[#0f172a]">{learningMetrics.learning.quizAttempts}</div><div className="text-xs text-[#64748b]">Accuracy {learningMetrics.learning.quizAccuracyPct}%</div></div>
                <div className={metricCard}><div className="text-xs text-[#64748b]">Speak Attempts</div><div className="text-2xl font-semibold text-[#0f172a]">{learningMetrics.learning.speakAttempts}</div><div className="text-xs text-[#64748b]">Speak Pass Rate {learningMetrics.learning.speakPassPct}%</div></div>
                <div className={metricCard}><div className="text-xs text-[#64748b]">Lesson Opens</div><div className="text-2xl font-semibold text-[#0f172a]">{learningMetrics.learning.lessonStarts}</div></div>
                <div className={metricCard}><div className="text-xs text-[#64748b]">Lesson Entry Events</div><div className="text-2xl font-semibold text-[#0f172a]">{learningMetrics.learning.lessonStartsTracked ?? 0}</div></div>
                <div className={metricCard}><div className="text-xs text-[#64748b]">Lessons Finished (Complete Screen)</div><div className="text-2xl font-semibold text-[#0f172a]">{learningMetrics.learning.lessonCompleted}</div></div>
                <div className={metricCard}><div className="text-xs text-[#64748b]">Lessons Abandoned</div><div className="text-2xl font-semibold text-[#0f172a]">{learningMetrics.learning.lessonAbandons}</div></div>
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
              <div className="mt-4 rounded-xl border border-[#e2e8f0] p-3">
                <h3 className="text-sm font-semibold text-[#0f172a]">Recently Scheduled/Deleted Accounts</h3>
                <p className="mt-1 text-xs text-[#64748b]">Use Undo before the timer reaches 0 days.</p>
                <input
                  className={`${baseInput} mt-2`}
                  value={undoDeletionReason}
                  onChange={(event) => setUndoDeletionReason(event.target.value)}
                  placeholder="Reason for undo (optional)"
                />
                {recentDeletionsLoading && <p className="mt-2 text-sm text-[#475569]">Loading recent deletions…</p>}
                {recentDeletionsError && <p className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">{recentDeletionsError}</p>}
                {!recentDeletionsLoading && !recentDeletionsError && recentDeletions.length === 0 && (
                  <p className="mt-2 text-sm text-[#64748b]">No recent deletion activity.</p>
                )}
                {!recentDeletionsLoading && !recentDeletionsError && recentDeletions.length > 0 && (
                  <div className="mt-2 max-h-[28vh] space-y-2 overflow-auto pr-1">
                    {recentDeletions.map((entry) => (
                      <article key={entry.id} className="rounded-lg border border-[#e2e8f0] bg-white p-2">
                        <div className="text-sm font-semibold text-[#0f172a]">{entry.targetDisplayName || entry.targetEmail || entry.targetUserId}</div>
                        <div className="text-xs text-[#64748b]">{entry.targetEmail || 'No email'}</div>
                        <div className="mt-1 text-xs text-[#475569]">
                          {entry.status === 'scheduled' && `Scheduled | ${entry.daysRemaining} day(s) left`}
                          {entry.status === 'completed' && 'Deleted permanently'}
                          {entry.status === 'cancelled' && 'Deletion cancelled'}
                        </div>
                        {entry.status === 'scheduled' && (
                          <button
                            type="button"
                            className="mt-2 w-full rounded-lg border border-[#1f2937] bg-white px-2 py-1 text-xs font-semibold text-[#1f2937] disabled:opacity-50"
                            disabled={undoBusyUserId !== null}
                            onClick={() => void handleUndoScheduledDeletion(entry.targetUserId)}
                          >
                            {undoBusyUserId === entry.targetUserId ? 'Undoing…' : 'Undo Deletion'}
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-4 rounded-xl border border-[#e2e8f0] p-3">
                <h3 className="text-sm font-semibold text-[#0f172a]">Open Deletion Requests</h3>
                <p className="mt-1 text-xs text-[#64748b]">Click a request to resolve or reject it.</p>
                {openDeletionRequestsLoading && <p className="mt-2 text-sm text-[#475569]">Loading requests…</p>}
                {openDeletionRequestsError && <p className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">{openDeletionRequestsError}</p>}
                {!openDeletionRequestsLoading && !openDeletionRequestsError && openDeletionRequests.length === 0 && (
                  <p className="mt-2 text-sm text-[#64748b]">No open deletion requests.</p>
                )}
                {!openDeletionRequestsLoading && !openDeletionRequestsError && openDeletionRequests.length > 0 && (
                  <div className="mt-2 max-h-[22vh] space-y-2 overflow-auto pr-1">
                    {openDeletionRequests.map((request) => (
                      <button
                        key={request.id}
                        type="button"
                        className="w-full rounded-lg border border-[#e2e8f0] bg-white p-2 text-left hover:border-[#1f2937]"
                        onClick={() => setRequestModal(request)}
                      >
                        <div className="text-sm font-semibold text-[#0f172a]">{request.targetDisplayName || request.targetEmail || request.targetUserId}</div>
                        <div className="text-xs text-[#64748b]">{request.targetEmail || 'No email'}{request.requestChannel ? ` | ${request.requestChannel}` : ''}</div>
                        <div className="mt-1 line-clamp-2 text-xs text-[#475569]">{request.requestReason}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[#1f2937]/20 bg-white/95 p-4">
              {!selectedUserId && <p className="text-sm text-[#475569]">Select a user to view details.</p>}
              {selectedUserId && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-[#0f172a]">{selectedUser?.displayName || selectedUser?.email || selectedUserId}</h2>
                      <p className="text-sm text-[#475569]">{selectedUser?.email || ''}</p>
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
                      <div className="mt-3 rounded-xl border border-[#e2e8f0] p-3">
                        <h3 className="text-sm font-semibold text-[#0f172a]">Security Context</h3>
                        <div className="mt-2 grid gap-3 md:grid-cols-3">
                          <div className={metricCard}>
                            <div className="text-xs text-[#64748b]">Active Sessions</div>
                            <div className="text-sm font-semibold text-[#0f172a]">{overview.security?.activeSessionCount ?? 0}</div>
                          </div>
                          <div className={metricCard}>
                            <div className="text-xs text-[#64748b]">Last Password Reset</div>
                            <div className="text-sm font-semibold text-[#0f172a]">{toLocale(overview.security?.lastPasswordResetAt)}</div>
                          </div>
                          <div className={metricCard}>
                            <div className="text-xs text-[#64748b]">Last Forced Logout</div>
                            <div className="text-sm font-semibold text-[#0f172a]">{toLocale(overview.security?.lastForcedLogoutAt)}</div>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <article className="rounded-lg border border-[#e2e8f0] p-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Recent IPs</div>
                            <div className="mt-1 space-y-1 text-xs text-[#334155]">
                              {(overview.security?.recentIps || []).length === 0 && <div>No recent IP data.</div>}
                              {(overview.security?.recentIps || []).map((row) => (
                                <div key={`ip-${row.ip}-${row.lastSeenAt}`} className="flex items-center justify-between gap-2">
                                  <span className="truncate">{row.ip}</span>
                                  <span className="text-[#64748b]">{toLocale(row.lastSeenAt)}</span>
                                </div>
                              ))}
                            </div>
                          </article>
                          <article className="rounded-lg border border-[#e2e8f0] p-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Recent Devices</div>
                            <div className="mt-1 space-y-1 text-xs text-[#334155]">
                              {(overview.security?.recentDevices || []).length === 0 && <div>No recent device data.</div>}
                              {(overview.security?.recentDevices || []).map((row) => (
                                <div key={`device-${row.device}-${row.lastSeenAt}`} className="flex items-center justify-between gap-2">
                                  <span className="truncate">{row.device}</span>
                                  <span className="text-[#64748b]">{toLocale(row.lastSeenAt)}</span>
                                </div>
                              ))}
                            </div>
                          </article>
                        </div>
                      </div>
                      <details className="mt-3 rounded-xl border border-[#e2e8f0] bg-white p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-[#0f172a]">
                          Saved Operational Notes ({savedNotes.length})
                        </summary>
                        <p className="mt-1 text-xs text-[#64748b]">Saved notes tied to this user.</p>
                        {savedNotes.length === 0 && <p className="mt-2 text-sm text-[#64748b]">No notes saved yet.</p>}
                        {savedNotes.length > 0 && (
                          <div className="mt-2 max-h-[24vh] space-y-2 overflow-auto pr-1">
                            {savedNotes.map((noteEntry) => (
                              <article key={noteEntry.id} className="flex items-start gap-2 rounded-lg border border-[#e2e8f0] p-2">
                                <button
                                  type="button"
                                  className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-300 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                  onClick={() => void handleDeleteSupportNote(noteEntry.id)}
                                  disabled={deletingNoteId !== null}
                                  aria-label="Delete note permanently"
                                  title="Delete note permanently"
                                >
                                  {deletingNoteId === noteEntry.id ? (
                                    <span className="text-[10px] font-semibold">...</span>
                                  ) : (
                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                      <path d="M3 6h18" />
                                      <path d="M8 6V4h8v2" />
                                      <path d="M19 6l-1 14H6L5 6" />
                                      <path d="M10 11v6" />
                                      <path d="M14 11v6" />
                                    </svg>
                                  )}
                                </button>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs uppercase tracking-[0.12em] text-[#64748b]">
                                    {toLocale(noteEntry.createdAt)}{noteEntry.actorEmail ? ` | ${noteEntry.actorEmail}` : ''}
                                  </div>
                                  <div className="mt-1 whitespace-pre-wrap text-sm text-[#334155]">{noteEntry.note}</div>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </details>

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
                          <h3 className="text-sm font-semibold text-[#0f172a]">Admin Actions (Audited)</h3>
                          <p className="mt-1 text-xs text-[#64748b]">Use these controls for account support. Every action is logged with your reason.</p>
                          <div className="mt-2 rounded-lg border border-[#dbe3ef] bg-[#f8fafc] px-2 py-1.5 text-xs text-[#334155]">
                            Target user: <span className="font-semibold text-[#0f172a]">{selectedTargetLabel}</span>
                          </div>
                          <p className="mt-2 text-xs text-[#64748b]">Show Walkthrough Again only resets onboarding guidance visibility. It does not delete lesson progress, attempts, streak, or mastery data.</p>
                          <input className={`${baseInput} mt-2`} value={actionReason} onChange={(event) => setActionReason(event.target.value)} placeholder="Why are you taking this action? (required)" />
                          <div className="mt-2 grid gap-2">
                            <button type="button" className={baseButton} disabled={busyAction !== null || actionReason.trim().length < 8} onClick={() => void runMutation('reset-walkthrough', `/v1/admin/users/${selectedUserId}/actions/reset-walkthrough`, { reason: actionReason.trim() })}>Show Walkthrough Again</button>
                            <button type="button" className={baseButton} disabled={busyAction !== null || actionReason.trim().length < 8} onClick={() => void runMutation('revoke-sessions', `/v1/admin/users/${selectedUserId}/actions/revoke-sessions`, { reason: actionReason.trim() })}>Force Sign Out (All Devices)</button>
                          </div>
                          <p className="mt-2 text-xs text-[#64748b]">Force Sign Out revokes all active refresh sessions for this user. They must sign in again on every device.</p>
                          <div className="mt-3 rounded-xl border border-red-300 bg-red-50/60 p-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">Deletion Workflow</div>
                            <p className="mt-1 text-xs text-[#64748b]">Workflow target: <span className="font-semibold text-[#334155]">{selectedTargetLabel}</span></p>
                            <p className="mt-1 text-xs text-[#64748b]">Channel = where the request came from (for audit context), for example: email, in-app, admin-review.</p>
                            <input className={`${baseInput} mt-2`} value={actionChannel} onChange={(event) => setActionChannel(event.target.value)} placeholder="Request channel (email, in-app, admin-review)" />
                            <div className="mt-2 grid gap-2">
                              <button type="button" className={baseButton} disabled={busyAction !== null || deletionWorkflowReason.length < 8} onClick={() => void runMutation('request-deletion', `/v1/admin/users/${selectedUserId}/actions/request-deletion`, { reason: deletionWorkflowReason, channel: actionChannel.trim() || 'email' })}>Open Deletion Request</button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-[#e2e8f0] p-3">
                        <h3 className="text-sm font-semibold text-[#0f172a]">Timeline</h3>
                        <div className="mt-2 max-h-[38vh] space-y-2 overflow-auto pr-1">
                          {timeline.map((entry, index) => (
                            <article key={`${entry.createdAt}-${entry.source}-${index}`} className="rounded-lg border border-[#e2e8f0] p-2">
                              <div className="text-xs uppercase tracking-[0.14em] text-[#64748b]">{timelineSourceLabel(entry)} | {toLocale(entry.createdAt)}</div>
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
          <div className="w-full max-w-lg rounded-2xl border border-red-300 bg-white p-5">
            <h3 className="text-lg font-semibold text-[#7f1d1d]">Schedule Permanent Deletion</h3>
            <p className="mt-2 text-sm text-[#475569]">
              This account will be queued for permanent deletion after the retention window.
              You can undo it before the timer reaches zero.
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#b91c1c]">High-impact action</p>
            <div className="mt-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-sm">
              <div className="font-semibold text-[#0f172a]">{deleteCandidate.displayName || 'Unknown User'}</div>
              <div className="text-[#475569]">{deleteCandidate.email || 'No email'}</div>
            </div>
            <input
              className={`${baseInput} mt-3`}
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              placeholder="Reason for permanent deletion (required)"
            />
            <div className="mt-4 flex justify-between gap-2">
              <button
                type="button"
                className="rounded-xl border border-red-700 bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-[#cbd5e1] disabled:bg-[#e2e8f0] disabled:text-[#1f2937]"
                disabled={
                  deleteBusy ||
                  deleteReason.trim().length < 8 ||
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
      {deleteSuccessOpen && (
        <div className="fixed inset-0 z-[145] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#1f2937]/20 bg-white p-5 text-center">
            <h3 className="text-lg font-semibold text-[#0f172a]">Deletion Scheduled</h3>
            <p className="mt-2 text-sm text-[#475569]">Deletion was scheduled. The account can be restored until the countdown ends.</p>
            <button
              type="button"
              className={`${baseButton} mt-4 w-full`}
              onClick={() => setDeleteSuccessOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {requestModal && (
        <div className="fixed inset-0 z-[146] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#1f2937]/20 bg-white p-5">
            <h3 className="text-lg font-semibold text-[#0f172a]">Review Deletion Request</h3>
            <p className="mt-1 text-sm text-[#475569]">{requestModal.targetDisplayName || requestModal.targetEmail || requestModal.targetUserId}</p>
            <p className="text-xs text-[#64748b]">{requestModal.targetEmail || 'No email'}{requestModal.requestChannel ? ` | ${requestModal.requestChannel}` : ''}</p>
            <div className="mt-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-sm text-[#334155]">
              {requestModal.requestReason}
            </div>
            <input
              className={`${baseInput} mt-3`}
              value={requestDecisionReason}
              onChange={(event) => setRequestDecisionReason(event.target.value)}
              placeholder="Decision reason (required)"
            />
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <button
                type="button"
                className={baseButton}
                disabled={requestDecisionBusy || requestDecisionReason.trim().length < 8}
                onClick={() => void handleDeletionRequestDecision('resolved')}
              >
                {requestDecisionBusy ? 'Saving...' : 'Mark Request Resolved'}
              </button>
              <button
                type="button"
                className="rounded-xl border border-red-500 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                disabled={requestDecisionBusy || requestDecisionReason.trim().length < 8}
                onClick={() => void handleDeletionRequestDecision('rejected')}
              >
                {requestDecisionBusy ? 'Saving...' : 'Reject Deletion Request'}
              </button>
            </div>
            <button
              type="button"
              className="mt-2 rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937]"
              onClick={() => {
                if (requestDecisionBusy) return;
                setRequestModal(null);
                setRequestDecisionReason('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
