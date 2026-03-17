import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Download,
  MailPlus,
  Play,
  RotateCcwKey,
  UserRoundPlus,
} from "lucide-react";
import { apiFetch } from "../../lib/apiClient";
import SupportDashboardPage from "./support/pages/SupportDashboardPage";
import SupportUserOperationsPage from "./support/pages/SupportUserOperationsPage";
import SupportMetricsSupportPage from "./support/pages/SupportMetricsSupportPage";
import SupportMetricsLearningPage from "./support/pages/SupportMetricsLearningPage";
import SupportMetricsImpactPage from "./support/pages/SupportMetricsImpactPage";
import SupportQualityReportsPage from "./support/pages/SupportQualityReportsPage";
import SupportConsoleAuthPage from "./support/pages/SupportConsoleAuthPage";
import SupportConsoleAdminModals from "./support/pages/SupportConsoleAdminModals";
import SupportConsoleHeader from "./support/pages/SupportConsoleHeader";
import {
  ACCESS_LANGUAGE_OPTIONS,
  languageLabel,
  loadAccessCatalog,
  normalizeLanguageId,
  readSupportAdminToken,
  setSupportAdminToken,
} from "./support/supportConsoleAccessUtils";
import {
  buildSonusPdf,
  downloadBinaryFile,
  downloadResponseAsFile,
  downloadTextFile,
  downloadZipFile,
  isValidFullSuiteConfirmText,
  normalizeFullSuiteConfirmText,
  parseJsonOrThrow,
  toCsv,
} from "./support/supportConsoleDataUtils";
import {
  resolveMetricWordLabels,
  riskStyles,
  timelineSourceLabel,
  toLocale,
} from "./support/supportConsoleUi";
import { MissTrendDelta, TrendDelta } from "./support/supportConsoleTrendChips";
import { useSupportConsoleState } from "./support/useSupportConsoleState";

import type {
  SearchResult,
  UserOverview,
  UserProgressDetail,
  UserProgressTrend,
  LearningAccessState,
  LearningAccessAuditEntry,
  LearningAccessApplySummary,
  AccessCatalogBandOption,
  TimelineEntry,
  SupportNoteEntry,
  OpenDeletionRequest,
  DeletionCaseEntry,
  RecentDeletionItem,
  SupportMetrics,
  LearningMetrics,
  WeakWordsByLanguage,
  SpeakMissHotspotsByLanguage,
  ReviewQueueDebug,
  QualityReportListItem,
  QualityReportDetail,
  ExecutiveWeeklyReport,
  DeletionLifecycleReport,
  SecurityIncidentReport,
  LearningMomentumReport,
  ActivationFunnelReport,
  StorageBudgetReport,
  DbGuardrailsReport,
  ProdReadinessReport,
  ImpactOutcomesMetrics,
} from "./support/supportConsoleTypes";

const ROOT_QA_ADMIN_USERNAME = "qa-admin-f8n2x7r1@sonus.test";
const SUPPORT_AUTH_BOOT_TIMEOUT_MS = 6000;

const baseInput =
  "w-full rounded-xl border border-[#1f2937]/20 bg-white px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-[#1f2937]";
const baseButton =
  "rounded-xl bg-[#1f2937] px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50";
const metricCard = "rounded-xl border border-[#e2e8f0] bg-white p-5";
const iconButtonBase =
  "inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-150";
const metricsWindowOptions = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "3m" },
  { days: 180, label: "6m" },
] as const;

export default function SupportConsolePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [bootLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const didBootstrapRef = useRef(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [adminUsername, setAdminUsername] = useState(
    "qa-admin-f8n2x7r1@sonus.test",
  );
  const [adminPassword, setAdminPassword] = useState("");
  const adminUsernameInputRef = useRef<HTMLInputElement | null>(null);
  const adminPasswordInputRef = useRef<HTMLInputElement | null>(null);
  const adminAutoSubmittedRef = useRef(false);
  const [query, setQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [overview, setOverview] = useState<UserOverview | null>(null);
  const [progressDetail, setProgressDetail] =
    useState<UserProgressDetail | null>(null);
  const [progressTrend, setProgressTrend] = useState<UserProgressTrend | null>(
    null,
  );
  const [progressTrendWindowDays, setProgressTrendWindowDays] = useState<
    30 | 90
  >(30);
  const [learningAccess, setLearningAccess] =
    useState<LearningAccessState | null>(null);
  const [learningAccessAudit, setLearningAccessAudit] = useState<
    LearningAccessAuditEntry[]
  >([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [savedNotes, setSavedNotes] = useState<SupportNoteEntry[]>([]);
  const [reviewQueueDebug, setReviewQueueDebug] =
    useState<ReviewQueueDebug | null>(null);
  const [reviewQueueDebugLoading, setReviewQueueDebugLoading] = useState(false);
  const [reviewQueueDebugError, setReviewQueueDebugError] = useState<
    string | null
  >(null);
  const [progressTrendError, setProgressTrendError] = useState<string | null>(
    null,
  );
  const [exportBusy, setExportBusy] = useState<"json" | "csv" | "pdf" | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteReason, setNoteReason] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [actionChannel, setActionChannel] = useState("email");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [accessReason, setAccessReason] = useState("");
  const [accessFilter, setAccessFilter] = useState("");
  const [accessLanguageId, setAccessLanguageId] = useState<"ja">("ja");
  const [accessCatalogBands, setAccessCatalogBands] = useState<
    AccessCatalogBandOption[]
  >([]);
  const [accessCatalogLoading, setAccessCatalogLoading] = useState(false);
  const [accessCatalogError, setAccessCatalogError] = useState<string | null>(
    null,
  );
  const [accessLevelId, setAccessLevelId] = useState("");
  const [accessLevelStatus, setAccessLevelStatus] = useState<
    "locked" | "unlocked"
  >("locked");
  const [accessUnitBandId, setAccessUnitBandId] = useState("");
  const [accessUnitId, setAccessUnitId] = useState("");
  const [accessUnitStatus, setAccessUnitStatus] = useState<
    "locked" | "unlocked"
  >("locked");
  const [accessLessonBandId, setAccessLessonBandId] = useState("");
  const [accessLessonUnitId, setAccessLessonUnitId] = useState("");
  const [accessLessonIndex, setAccessLessonIndex] = useState("0");
  const [accessLessonStatus, setAccessLessonStatus] = useState<
    "locked" | "unlocked"
  >("locked");
  const [targetBandInput, setTargetBandInput] = useState("");
  const [targetUnitInput, setTargetUnitInput] = useState("");
  const [targetLessonInput, setTargetLessonInput] = useState("0");
  const [accessConfirmOpen, setAccessConfirmOpen] = useState(false);
  const [pendingAccessPayload, setPendingAccessPayload] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [accessApplySummary, setAccessApplySummary] =
    useState<LearningAccessApplySummary | null>(null);
  const [accessApplyModalOpen, setAccessApplyModalOpen] = useState(false);
  const [supportMetrics, setSupportMetrics] = useState<SupportMetrics | null>(
    null,
  );
  const [learningMetrics, setLearningMetrics] =
    useState<LearningMetrics | null>(null);
  const [weakWordsByLanguage, setWeakWordsByLanguage] =
    useState<WeakWordsByLanguage | null>(null);
  const [weakSpeakWordsByLanguage, setWeakSpeakWordsByLanguage] =
    useState<WeakWordsByLanguage | null>(null);
  const [speakMissHotspotsByLanguage, setSpeakMissHotspotsByLanguage] =
    useState<SpeakMissHotspotsByLanguage | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [adminTimeline, setAdminTimeline] = useState<TimelineEntry[]>([]);
  const [adminTimelineLoading, setAdminTimelineLoading] = useState(false);
  const [adminTimelineError, setAdminTimelineError] = useState<string | null>(
    null,
  );
  const [recentDeletions, setRecentDeletions] = useState<RecentDeletionItem[]>(
    [],
  );
  const [recentDeletionsLoading, setRecentDeletionsLoading] = useState(false);
  const [recentDeletionsError, setRecentDeletionsError] = useState<
    string | null
  >(null);
  const [openDeletionRequests, setOpenDeletionRequests] = useState<
    OpenDeletionRequest[]
  >([]);
  const [openDeletionRequestsLoading, setOpenDeletionRequestsLoading] =
    useState(false);
  const [openDeletionRequestsError, setOpenDeletionRequestsError] = useState<
    string | null
  >(null);
  const [requestModal, setRequestModal] = useState<OpenDeletionRequest | null>(
    null,
  );
  const [requestDecisionReason, setRequestDecisionReason] = useState("");
  const [requestDecisionBusy, setRequestDecisionBusy] = useState(false);
  const [deletionCaseSearch, setDeletionCaseSearch] = useState("");
  const [deletionCases, setDeletionCases] = useState<DeletionCaseEntry[]>([]);
  const [deletionCasesLoading, setDeletionCasesLoading] = useState(false);
  const [deletionCasesError, setDeletionCasesError] = useState<string | null>(
    null,
  );
  const [undoBusyUserId, setUndoBusyUserId] = useState<string | null>(null);
  const [undoDeletionReason, setUndoDeletionReason] = useState("");
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<SearchResult | null>(
    null,
  );
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteAcknowledge, setDeleteAcknowledge] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteSuccessOpen, setDeleteSuccessOpen] = useState(false);
  const [metricsWindowDays, setMetricsWindowDays] = useState<7 | 30 | 90 | 180>(
    30,
  );
  const [supportAdminUsername, setSupportAdminUsername] = useState<
    string | null
  >(null);
  const [createAdminOpen, setCreateAdminOpen] = useState(false);
  const [createAdminBusy, setCreateAdminBusy] = useState(false);
  const [createAdminUsername, setCreateAdminUsername] = useState("");
  const [createAdminCurrentPassword, setCreateAdminCurrentPassword] =
    useState("");
  const [createAdminPassword, setCreateAdminPassword] = useState("");
  const [createAdminRecoveryEmail, setCreateAdminRecoveryEmail] = useState("");
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetPasswordBusy, setResetPasswordBusy] = useState(false);
  const [resetPasswordCurrentValue, setResetPasswordCurrentValue] =
    useState("");
  const [resetPasswordNewValue, setResetPasswordNewValue] = useState("");
  const [recoveryEmailOpen, setRecoveryEmailOpen] = useState(false);
  const [recoveryEmailBusy, setRecoveryEmailBusy] = useState(false);
  const [recoveryEmailValue, setRecoveryEmailValue] = useState("");
  const [adminActionError, setAdminActionError] = useState<string | null>(null);
  const [adminActionSuccess, setAdminActionSuccess] = useState<string | null>(
    null,
  );
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordBusy, setForgotPasswordBusy] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState(
    "qa-admin-f8n2x7r1@sonus.test",
  );
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState<
    string | null
  >(null);
  const [resetTokenValue, setResetTokenValue] = useState("");
  const [resetTokenPasswordValue, setResetTokenPasswordValue] = useState("");
  const [resetTokenBusy, setResetTokenBusy] = useState(false);
  const [qualityReports, setQualityReports] = useState<QualityReportListItem[]>(
    [],
  );
  const [qualityReportsLoading, setQualityReportsLoading] = useState(false);
  const [qualityReportsError, setQualityReportsError] = useState<string | null>(
    null,
  );
  const [selectedQualityRunId, setSelectedQualityRunId] = useState<
    string | null
  >(null);
  const [qualityDetail, setQualityDetail] =
    useState<QualityReportDetail | null>(null);
  const [qualityDetailLoading, setQualityDetailLoading] = useState(false);
  const [qualityDetailError, setQualityDetailError] = useState<string | null>(
    null,
  );
  const [qualityRunBusy, setQualityRunBusy] = useState(false);
  const [qualityRunMessage, setQualityRunMessage] = useState<string | null>(
    null,
  );
  const [qualityCleanupKeepLatest, setQualityCleanupKeepLatest] = useState(30);
  const [qualityCleanupBusy, setQualityCleanupBusy] = useState(false);
  const [qualityCleanupMessage, setQualityCleanupMessage] = useState<
    string | null
  >(null);
  const [qualityRunFullConfirmOpen, setQualityRunFullConfirmOpen] =
    useState(false);
  const [qualityRunFullConfirmText, setQualityRunFullConfirmText] =
    useState("");
  const [executiveWeeklyReport, setExecutiveWeeklyReport] =
    useState<ExecutiveWeeklyReport | null>(null);
  const [deletionLifecycleReport, setDeletionLifecycleReport] =
    useState<DeletionLifecycleReport | null>(null);
  const [securityIncidentReport, setSecurityIncidentReport] =
    useState<SecurityIncidentReport | null>(null);
  const [learningMomentumReport, setLearningMomentumReport] =
    useState<LearningMomentumReport | null>(null);
  const [activationFunnelReport, setActivationFunnelReport] =
    useState<ActivationFunnelReport | null>(null);
  const [storageBudgetReport, setStorageBudgetReport] =
    useState<StorageBudgetReport | null>(null);
  const [dbGuardrailsReport, setDbGuardrailsReport] =
    useState<DbGuardrailsReport | null>(null);
  const [prodReadinessReport, setProdReadinessReport] =
    useState<ProdReadinessReport | null>(null);
  const [impactOutcomesMetrics, setImpactOutcomesMetrics] =
    useState<ImpactOutcomesMetrics | null>(null);
  const [dashboardGeneratedAt, setDashboardGeneratedAt] = useState<
    string | null
  >(null);
  const canConfirmPermanentDelete =
    !deleteBusy && deleteReason.trim().length >= 8 && deleteAcknowledge;

  const {
    viewMode,
    selectedUser,
    selectedTargetLabel,
    deletionWorkflowReason,
    filteredLevelOverrides,
    filteredUnitOverrides,
    filteredLessonOverrides,
  } = useSupportConsoleState({
    pathname: location.pathname,
    searchResults,
    selectedUserId,
    actionReason,
    actionChannel,
    accessFilter,
    learningAccess: learningAccess
      ? {
          overrides: {
            levels: learningAccess.overrides.levels || {},
            units: learningAccess.overrides.units || {},
            lessons: learningAccess.overrides.lessons || {},
          },
        }
      : null,
  });
  const accessBandOptions = accessCatalogBands;
  const targetBandOption = useMemo(
    () => accessBandOptions.find((band) => band.id === targetBandInput) || null,
    [accessBandOptions, targetBandInput],
  );
  const targetUnitOptions = useMemo(
    () => targetBandOption?.units || [],
    [targetBandOption],
  );
  const targetUnitOption = useMemo(
    () => targetUnitOptions.find((unit) => unit.id === targetUnitInput) || null,
    [targetUnitOptions, targetUnitInput],
  );
  const targetLessonOptions = useMemo(
    () =>
      Array.from({ length: targetUnitOption?.lessonCount || 0 }, (_, idx) =>
        String(idx),
      ),
    [targetUnitOption?.lessonCount],
  );
  const unitOverrideBandOption = useMemo(
    () =>
      accessBandOptions.find((band) => band.id === accessUnitBandId) || null,
    [accessBandOptions, accessUnitBandId],
  );
  const unitOverrideUnitOptions = unitOverrideBandOption?.units || [];
  const lessonOverrideBandOption = useMemo(
    () =>
      accessBandOptions.find((band) => band.id === accessLessonBandId) || null,
    [accessBandOptions, accessLessonBandId],
  );
  const lessonOverrideUnitOptions = useMemo(
    () => lessonOverrideBandOption?.units || [],
    [lessonOverrideBandOption],
  );
  const lessonOverrideUnitOption = useMemo(
    () =>
      lessonOverrideUnitOptions.find(
        (unit) => unit.id === accessLessonUnitId,
      ) || null,
    [lessonOverrideUnitOptions, accessLessonUnitId],
  );
  const lessonOverrideIndexOptions = useMemo(
    () =>
      Array.from(
        { length: lessonOverrideUnitOption?.lessonCount || 0 },
        (_, idx) => String(idx),
      ),
    [lessonOverrideUnitOption?.lessonCount],
  );
  const resetTokenFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    return (params.get("adminResetToken") || "").trim();
  }, [location.search]);
  const canCreateAdmins = supportAdminUsername === ROOT_QA_ADMIN_USERNAME;
  const impactRetentionSummary = useMemo(() => {
    const cohorts = impactOutcomesMetrics?.cohorts || [];
    const totals = cohorts.reduce(
      (acc, cohort) => {
        acc.eligibleD7 += cohort.eligibleD7;
        acc.retainedD7 += cohort.retainedD7;
        acc.eligibleD30 += cohort.eligibleD30;
        acc.retainedD30 += cohort.retainedD30;
        return acc;
      },
      { eligibleD7: 0, retainedD7: 0, eligibleD30: 0, retainedD30: 0 },
    );
    return {
      d7Pct:
        totals.eligibleD7 > 0
          ? Number(((totals.retainedD7 / totals.eligibleD7) * 100).toFixed(2))
          : 0,
      d30Pct:
        totals.eligibleD30 > 0
          ? Number(((totals.retainedD30 / totals.eligibleD30) * 100).toFixed(2))
          : 0,
    };
  }, [impactOutcomesMetrics]);
  const verifySupportAdminSession = useCallback(async () => {
    if (!readSupportAdminToken()) {
      setAuthenticated(false);
      setSupportAdminUsername(null);
      return false;
    }
    try {
      const payload = await parseJsonOrThrow<{ username?: string }>(
        await apiFetch("/v1/admin/auth/me", { cache: "no-store" }),
      );
      setAuthenticated(true);
      setSupportAdminUsername(payload.username || null);
      setAuthError(null);
      return true;
    } catch {
      setSupportAdminToken(null);
      setAuthenticated(false);
      setSupportAdminUsername(null);
      return false;
    }
  }, []);

  const runSearch = useCallback(async () => {
    setSearchLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      params.set("limit", "30");
      const payload = await parseJsonOrThrow<{ users?: SearchResult[] }>(
        await apiFetch(`/v1/admin/users/search?${params.toString()}`, {
          cache: "no-store",
        }),
      );
      const next = payload.users || [];
      setSearchResults(next);
      if (!selectedUserId && next[0]?.userId) {
        setSelectedUserId(next[0].userId);
      }
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Search failed");
    } finally {
      setSearchLoading(false);
    }
  }, [query, selectedUserId]);

  const refreshSelectedUser = useCallback(
    async (targetUserId: string) => {
      setDetailLoading(true);
      setDetailError(null);
      setReviewQueueDebugLoading(true);
      setReviewQueueDebugError(null);
      setProgressTrendError(null);
      try {
        const overviewPayload = await parseJsonOrThrow<UserOverview>(
          await apiFetch(`/v1/admin/users/${targetUserId}`, {
            cache: "no-store",
          }),
        );
        const [
          progressResult,
          progressTrendResult,
          accessResult,
          timelinePayload,
          notesPayload,
          reviewQueueResult,
        ] = await Promise.all([
          (async () => {
            try {
              return await parseJsonOrThrow<UserProgressDetail>(
                await apiFetch(`/v1/admin/users/${targetUserId}/progress`, {
                  cache: "no-store",
                }),
              );
            } catch {
              return null;
            }
          })(),
          (async () => {
            try {
              const payload = await parseJsonOrThrow<UserProgressTrend>(
                await apiFetch(
                  `/v1/admin/users/${targetUserId}/progress-trend?windowDays=${progressTrendWindowDays}`,
                  { cache: "no-store" },
                ),
              );
              return { payload, error: null as string | null };
            } catch {
              return {
                payload: null as UserProgressTrend | null,
                error: "Failed to load progress trend data",
              };
            }
          })(),
          (async () => {
            try {
              return await parseJsonOrThrow<{
                state: LearningAccessState;
                recentAudit?: LearningAccessAuditEntry[];
              }>(
                await apiFetch(`/v1/admin/users/${targetUserId}/access`, {
                  cache: "no-store",
                }),
              );
            } catch {
              return null;
            }
          })(),
          parseJsonOrThrow<{ timeline?: TimelineEntry[] }>(
            await apiFetch(
              `/v1/admin/users/${targetUserId}/timeline?limit=120`,
              { cache: "no-store" },
            ),
          ),
          parseJsonOrThrow<{ notes?: SupportNoteEntry[] }>(
            await apiFetch(`/v1/admin/users/${targetUserId}/notes?limit=80`, {
              cache: "no-store",
            }),
          ),
          (async () => {
            try {
              const payload = await parseJsonOrThrow<ReviewQueueDebug>(
                await apiFetch(
                  `/v1/admin/users/${targetUserId}/review-queue?limit=24`,
                  {
                    cache: "no-store",
                  },
                ),
              );
              return { payload, error: null as string | null };
            } catch {
              return {
                payload: null as ReviewQueueDebug | null,
                error: "Failed to load review queue debug data",
              };
            }
          })(),
        ]);
        setOverview(overviewPayload);
        const fallbackProgress: UserProgressDetail = {
          userId: overviewPayload.profile.userId,
          language: overviewPayload.profile.targetLanguage || null,
          currentBandId: overviewPayload.progress?.currentBandId || null,
          currentUnitId: overviewPayload.progress?.currentUnitId || null,
          currentLessonIdx: overviewPayload.progress?.currentLessonIdx ?? null,
          lastActivityAt: overviewPayload.progress?.lastActiveDate || null,
        };
        const resolvedProgress = progressResult || fallbackProgress;
        setProgressDetail(resolvedProgress);
        if (accessResult) {
          setLearningAccess(accessResult.state);
          setLearningAccessAudit(accessResult.recentAudit || []);
        } else {
          setLearningAccess({
            globalAccess: true,
            lockAboveTarget: false,
            cursor: null,
            overrides: { levels: {}, units: {}, lessons: {} },
            updatedAt: null,
          });
          setLearningAccessAudit([]);
        }
        const normalizedProgressLanguage = normalizeLanguageId(
          resolvedProgress.language ||
            overviewPayload.profile.targetLanguage ||
            "ja",
        );
        setAccessLanguageId(normalizedProgressLanguage === "ja" ? "ja" : "ja");
        setTargetBandInput(resolvedProgress.currentBandId || "");
        setTargetUnitInput(resolvedProgress.currentUnitId || "");
        setTargetLessonInput(String(resolvedProgress.currentLessonIdx ?? 0));
        setTimeline(timelinePayload.timeline || []);
        setSavedNotes(notesPayload.notes || []);
        setReviewQueueDebug(reviewQueueResult.payload);
        setReviewQueueDebugError(reviewQueueResult.error);
        setProgressTrend(progressTrendResult.payload);
        setProgressTrendError(progressTrendResult.error);
      } catch (error) {
        setDetailError(
          error instanceof Error
            ? error.message
            : "Failed to load user details",
        );
        setOverview(null);
        setProgressDetail(null);
        setProgressTrend(null);
        setLearningAccess(null);
        setLearningAccessAudit([]);
        setTimeline([]);
        setSavedNotes([]);
        setReviewQueueDebug(null);
        setReviewQueueDebugError(null);
        setProgressTrendError(null);
      } finally {
        setDetailLoading(false);
        setReviewQueueDebugLoading(false);
      }
    },
    [progressTrendWindowDays],
  );

  const downloadUserExport = async (format: "json" | "csv" | "pdf") => {
    if (!selectedUserId) return;
    setExportBusy(format);
    setDetailError(null);
    const downloadForFormat = async (targetFormat: "json" | "csv" | "pdf") => {
      const response = await apiFetch(
        `/v1/admin/users/${selectedUserId}/export?format=${targetFormat}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        let errorText = "Failed to export user data";
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload?.error) errorText = payload.error;
        } catch {
          // no-op
        }
        throw new Error(errorText);
      }
      await downloadResponseAsFile(response, `user-data-export.${targetFormat}`);
    };

    try {
      await downloadForFormat(format);
    } catch (error) {
      if (format === "pdf") {
        try {
          await downloadForFormat("json");
          setDetailError(null);
          return;
        } catch {
          // Fall through to surface the original PDF failure.
        }
      }
      setDetailError(
        error instanceof Error ? error.message : "Failed to export user data",
      );
    } finally {
      setExportBusy(null);
    }
  };

  const loadSupportMetrics = useCallback(
    async (windowDays = metricsWindowDays) => {
      setMetricsLoading(true);
      setMetricsError(null);
      try {
        const payload = await parseJsonOrThrow<SupportMetrics>(
          await apiFetch(
            `/v1/admin/metrics/support/overview?windowDays=${windowDays}`,
            {
              cache: "no-store",
            },
          ),
        );
        setSupportMetrics(payload);
      } catch (error) {
        setSupportMetrics(null);
        setMetricsError(
          error instanceof Error
            ? error.message
            : "Failed to load support metrics",
        );
      } finally {
        setMetricsLoading(false);
      }
    },
    [metricsWindowDays],
  );

  const loadLearningMetrics = useCallback(
    async (windowDays = metricsWindowDays) => {
      setMetricsLoading(true);
      setMetricsError(null);
      try {
        const [
          overviewPayload,
          weakWordsByLanguagePayload,
          weakSpeakWordsByLanguagePayload,
          speakMissHotspotsByLanguagePayload,
        ] = await Promise.all([
          parseJsonOrThrow<LearningMetrics>(
            await apiFetch(
              `/v1/admin/metrics/learning/overview?windowDays=${windowDays}`,
              {
                cache: "no-store",
              },
            ),
          ),
          parseJsonOrThrow<WeakWordsByLanguage>(
            await apiFetch(
              `/v1/admin/metrics/learning/weak-words-by-language?windowDays=${windowDays}&limitPerLanguage=5`,
              {
                cache: "no-store",
              },
            ),
          ),
          parseJsonOrThrow<WeakWordsByLanguage>(
            await apiFetch(
              `/v1/admin/metrics/learning/weak-speak-words-by-language?windowDays=${windowDays}&limitPerLanguage=5`,
              {
                cache: "no-store",
              },
            ),
          ),
          parseJsonOrThrow<SpeakMissHotspotsByLanguage>(
            await apiFetch(
              `/v1/admin/metrics/learning/speak-miss-hotspots-by-language?windowDays=${windowDays}&limitPerLanguage=5&minMissesPerUser=4`,
              {
                cache: "no-store",
              },
            ),
          ),
        ]);
        setLearningMetrics(overviewPayload);
        setWeakWordsByLanguage(weakWordsByLanguagePayload);
        setWeakSpeakWordsByLanguage(weakSpeakWordsByLanguagePayload);
        setSpeakMissHotspotsByLanguage(speakMissHotspotsByLanguagePayload);
      } catch (error) {
        setLearningMetrics(null);
        setWeakWordsByLanguage(null);
        setWeakSpeakWordsByLanguage(null);
        setSpeakMissHotspotsByLanguage(null);
        setMetricsError(
          error instanceof Error
            ? error.message
            : "Failed to load learning metrics",
        );
      } finally {
        setMetricsLoading(false);
      }
    },
    [metricsWindowDays],
  );

  const loadImpactOutcomesMetrics = useCallback(
    async (windowDays = metricsWindowDays) => {
      setMetricsLoading(true);
      setMetricsError(null);
      try {
        const payload = await parseJsonOrThrow<ImpactOutcomesMetrics>(
          await apiFetch(`/v1/admin/metrics/impact-outcomes?windowDays=${windowDays}`, {
            cache: "no-store",
          }),
        );
        setImpactOutcomesMetrics(payload);
      } catch (error) {
        setImpactOutcomesMetrics(null);
        setMetricsError(
          error instanceof Error
            ? error.message
            : "Failed to load impact outcomes metrics",
        );
      } finally {
        setMetricsLoading(false);
      }
    },
    [metricsWindowDays],
  );

  const loadDashboardMetrics = useCallback(
    async (windowDays = metricsWindowDays) => {
      setDashboardLoading(true);
      setDashboardError(null);
      try {
        const [
          supportPayload,
          learningPayload,
          speakMissHotspotsPayload,
          executivePayload,
          deletionPayload,
          securityPayload,
          momentumPayload,
          funnelPayload,
          storagePayload,
          guardrailsPayload,
          readinessPayload,
        ] = await Promise.all([
          parseJsonOrThrow<SupportMetrics>(
            await apiFetch(
              `/v1/admin/metrics/support/overview?windowDays=${windowDays}`,
              {
                cache: "no-store",
              },
            ),
          ),
          parseJsonOrThrow<LearningMetrics>(
            await apiFetch(
              `/v1/admin/metrics/learning/overview?windowDays=${windowDays}`,
              {
                cache: "no-store",
              },
            ),
          ),
          parseJsonOrThrow<SpeakMissHotspotsByLanguage>(
            await apiFetch(
              `/v1/admin/metrics/learning/speak-miss-hotspots-by-language?windowDays=${windowDays}&limitPerLanguage=4&minMissesPerUser=4`,
              {
                cache: "no-store",
              },
            ),
          ),
          parseJsonOrThrow<ExecutiveWeeklyReport>(
            await apiFetch(
              `/v1/admin/reports/executive-weekly?windowDays=${windowDays}`,
              {
                cache: "no-store",
              },
            ),
          ),
          parseJsonOrThrow<DeletionLifecycleReport>(
            await apiFetch(
              `/v1/admin/reports/deletion-lifecycle?windowDays=${windowDays}`,
              {
                cache: "no-store",
              },
            ),
          ),
          parseJsonOrThrow<SecurityIncidentReport>(
            await apiFetch(
              `/v1/admin/reports/security-incidents?windowDays=${windowDays}`,
              {
                cache: "no-store",
              },
            ),
          ),
          parseJsonOrThrow<LearningMomentumReport>(
            await apiFetch(
              `/v1/admin/reports/learning-momentum?windowDays=${windowDays}`,
              {
                cache: "no-store",
              },
            ),
          ),
          parseJsonOrThrow<ActivationFunnelReport>(
            await apiFetch(
              `/v1/admin/reports/activation-funnel?windowDays=${windowDays}`,
              {
                cache: "no-store",
              },
            ),
          ),
          parseJsonOrThrow<StorageBudgetReport>(
            await apiFetch("/v1/admin/reports/storage-budget", {
              cache: "no-store",
            }),
          ),
          parseJsonOrThrow<DbGuardrailsReport>(
            await apiFetch(
              `/v1/admin/reports/db-guardrails?windowDays=${windowDays}`,
              {
                cache: "no-store",
              },
            ),
          ),
          parseJsonOrThrow<ProdReadinessReport>(
            await apiFetch("/v1/admin/reports/prod-readiness", {
              cache: "no-store",
            }),
          ),
        ]);
        setSupportMetrics(supportPayload);
        setLearningMetrics(learningPayload);
        setSpeakMissHotspotsByLanguage(speakMissHotspotsPayload);
        setExecutiveWeeklyReport(executivePayload);
        setDeletionLifecycleReport(deletionPayload);
        setSecurityIncidentReport(securityPayload);
        setLearningMomentumReport(momentumPayload);
        setActivationFunnelReport(funnelPayload);
        setStorageBudgetReport(storagePayload);
        setDbGuardrailsReport(guardrailsPayload);
        setProdReadinessReport(readinessPayload);
        setDashboardGeneratedAt(new Date().toISOString());
      } catch (error) {
        setSupportMetrics(null);
        setLearningMetrics(null);
        setSpeakMissHotspotsByLanguage(null);
        setExecutiveWeeklyReport(null);
        setDeletionLifecycleReport(null);
        setSecurityIncidentReport(null);
        setLearningMomentumReport(null);
        setActivationFunnelReport(null);
        setStorageBudgetReport(null);
        setDbGuardrailsReport(null);
        setProdReadinessReport(null);
        setImpactOutcomesMetrics(null);
        setDashboardError(
          error instanceof Error
            ? error.message
            : "Failed to load dashboard metrics",
        );
      } finally {
        setDashboardLoading(false);
      }
    },
    [metricsWindowDays],
  );

  const loadAdminTimeline = useCallback(async () => {
    setAdminTimelineLoading(true);
    setAdminTimelineError(null);
    try {
      let timelinePayload: { timeline?: TimelineEntry[] } | null = null;
      try {
        timelinePayload = await parseJsonOrThrow<{
          timeline?: TimelineEntry[];
        }>(
          await apiFetch("/v1/admin/me/timeline?windowHours=24&limit=80", {
            cache: "no-store",
          }),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message.toLowerCase() : "";
        if (!message.includes("not found")) throw error;
        timelinePayload = await parseJsonOrThrow<{
          timeline?: TimelineEntry[];
        }>(
          await apiFetch("/v1/admin/timeline?windowHours=24&limit=80", {
            cache: "no-store",
          }),
        );
      }
      setAdminTimeline(timelinePayload?.timeline || []);
    } catch (error) {
      setAdminTimelineError(
        error instanceof Error
          ? error.message
          : "Failed to load admin timeline",
      );
      setAdminTimeline([]);
    } finally {
      setAdminTimelineLoading(false);
    }
  }, []);

  const loadRecentDeletions = useCallback(async () => {
    setRecentDeletionsLoading(true);
    setRecentDeletionsError(null);
    try {
      const payload = await parseJsonOrThrow<{ items?: RecentDeletionItem[] }>(
        await apiFetch("/v1/admin/users/deletions/recent?limit=12", {
          cache: "no-store",
        }),
      );
      setRecentDeletions(payload.items || []);
    } catch (error) {
      setRecentDeletionsError(
        error instanceof Error
          ? error.message
          : "Failed to load recent deletions",
      );
      setRecentDeletions([]);
    } finally {
      setRecentDeletionsLoading(false);
    }
  }, []);

  const loadOpenDeletionRequests = useCallback(async () => {
    setOpenDeletionRequestsLoading(true);
    setOpenDeletionRequestsError(null);
    try {
      const payload = await parseJsonOrThrow<{
        requests?: OpenDeletionRequest[];
      }>(
        await apiFetch("/v1/admin/deletion-requests/open?limit=20", {
          cache: "no-store",
        }),
      );
      setOpenDeletionRequests(payload.requests || []);
    } catch (error) {
      setOpenDeletionRequestsError(
        error instanceof Error
          ? error.message
          : "Failed to load deletion requests",
      );
      setOpenDeletionRequests([]);
    } finally {
      setOpenDeletionRequestsLoading(false);
    }
  }, []);

  const loadDeletionCases = useCallback(
    async (query?: string) => {
      setDeletionCasesLoading(true);
      setDeletionCasesError(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", "40");
        const q = (query ?? deletionCaseSearch).trim();
        if (q) params.set("q", q);
        const payload = await parseJsonOrThrow<{ cases?: DeletionCaseEntry[] }>(
          await apiFetch(
            `/v1/admin/metrics/support/deletion-cases?${params.toString()}`,
            { cache: "no-store" },
          ),
        );
        setDeletionCases(payload.cases || []);
      } catch (error) {
        setDeletionCasesError(
          error instanceof Error
            ? error.message
            : "Failed to load deletion cases",
        );
        setDeletionCases([]);
      } finally {
        setDeletionCasesLoading(false);
      }
    },
    [deletionCaseSearch],
  );

  const loadQualityReports = useCallback(async () => {
    setQualityReportsLoading(true);
    setQualityReportsError(null);
    try {
      const payload = await parseJsonOrThrow<{
        reports?: QualityReportListItem[];
      }>(
        await apiFetch("/v1/admin/quality-reports?limit=40", {
          cache: "no-store",
        }),
      );
      const reports = payload.reports || [];
      setQualityReports(reports);
      const hasSelected = selectedQualityRunId
        ? reports.some((entry) => entry.runId === selectedQualityRunId)
        : false;
      if (!hasSelected) {
        setSelectedQualityRunId(reports[0]?.runId || null);
      }
    } catch (error) {
      setQualityReportsError(
        error instanceof Error
          ? error.message
          : "Failed to load quality reports",
      );
      setQualityReports([]);
    } finally {
      setQualityReportsLoading(false);
    }
  }, [selectedQualityRunId]);

  const loadQualityReportDetail = async (runId: string) => {
    setQualityDetailLoading(true);
    setQualityDetailError(null);
    try {
      const payload = await parseJsonOrThrow<QualityReportDetail>(
        await apiFetch(
          `/v1/admin/quality-reports/${encodeURIComponent(runId)}`,
          {
            cache: "no-store",
          },
        ),
      );
      setQualityDetail(payload);
    } catch (error) {
      setQualityDetailError(
        error instanceof Error ? error.message : "Failed to load report detail",
      );
      setQualityDetail(null);
    } finally {
      setQualityDetailLoading(false);
    }
  };

  const runProdSafeQualityReport = async () => {
    setQualityRunBusy(true);
    setQualityRunMessage(null);
    setQualityCleanupMessage(null);
    setQualityReportsError(null);
    try {
      const payload = await parseJsonOrThrow<{
        ok?: boolean;
        latestRunId?: string | null;
      }>(
        await apiFetch("/v1/admin/quality-reports/run-prod-safe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
      );
      const message = payload.ok
        ? "Production-safe quality report completed."
        : "Report command completed with failures. Inspect the latest run.";
      setQualityRunMessage(message);
      await loadQualityReports();
      const nextRunId = payload.latestRunId || selectedQualityRunId;
      if (nextRunId) {
        setSelectedQualityRunId(nextRunId);
        await loadQualityReportDetail(nextRunId);
      }
    } catch (error) {
      setQualityRunMessage(null);
      setQualityReportsError(
        error instanceof Error
          ? error.message
          : "Failed to run prod-safe report",
      );
    } finally {
      setQualityRunBusy(false);
    }
  };

  const runFullQualityReport = async () => {
    const normalizedConfirmText = normalizeFullSuiteConfirmText(
      qualityRunFullConfirmText,
    );
    setQualityRunBusy(true);
    setQualityRunMessage(null);
    setQualityCleanupMessage(null);
    setQualityReportsError(null);
    try {
      const payload = await parseJsonOrThrow<{
        ok?: boolean;
        latestRunId?: string | null;
      }>(
        await apiFetch("/v1/admin/quality-reports/run-full", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmText: normalizedConfirmText }),
        }),
      );
      const message = payload.ok
        ? "Full quality report completed."
        : "Full report command completed with failures. Inspect the latest run.";
      setQualityRunMessage(message);
      setQualityRunFullConfirmOpen(false);
      setQualityRunFullConfirmText("");
      await loadQualityReports();
      const nextRunId = payload.latestRunId || selectedQualityRunId;
      if (nextRunId) {
        setSelectedQualityRunId(nextRunId);
        await loadQualityReportDetail(nextRunId);
      }
    } catch (error) {
      setQualityRunMessage(null);
      setQualityReportsError(
        error instanceof Error ? error.message : "Failed to run full report",
      );
    } finally {
      setQualityRunBusy(false);
    }
  };

  const cleanupQualityReports = async () => {
    setQualityCleanupBusy(true);
    setQualityCleanupMessage(null);
    setQualityRunMessage(null);
    setQualityReportsError(null);
    try {
      const payload = await parseJsonOrThrow<{
        deletedCount?: number;
        latestRunId?: string | null;
      }>(
        await apiFetch("/v1/admin/quality-reports/cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keepLatest: qualityCleanupKeepLatest }),
        }),
      );
      setQualityCleanupMessage(
        `Retention cleanup complete. Deleted ${payload.deletedCount || 0} report run(s).`,
      );
      await loadQualityReports();
      const nextRunId = payload.latestRunId || null;
      if (nextRunId) {
        setSelectedQualityRunId(nextRunId);
        await loadQualityReportDetail(nextRunId);
      } else {
        setSelectedQualityRunId(null);
        setQualityDetail(null);
      }
    } catch (error) {
      setQualityCleanupMessage(null);
      setQualityReportsError(
        error instanceof Error
          ? error.message
          : "Failed to clean up old quality reports",
      );
    } finally {
      setQualityCleanupBusy(false);
    }
  };

  const buildExecutiveSummaryPayload = () => ({
    generatedAt: new Date().toISOString(),
    windowDays: metricsWindowDays,
    summary: {
      currentUsers: supportMetrics?.support.currentUsers ?? 0,
      newUsers: supportMetrics?.support.newUsers ?? 0,
      activeUsers: supportMetrics?.support.activeUsers ?? 0,
      activeWindowMinutes: supportMetrics?.support.activeWindowMinutes ?? 15,
      unauthorizedAdminAttempts:
        supportMetrics?.support.unauthorizedAdminAttempts ?? 0,
      endUserFailedLogins: supportMetrics?.support.endUserFailedLogins ?? 0,
      quizAccuracyPct: learningMetrics?.learning.quizAccuracyPct ?? 0,
      speakPassPct: learningMetrics?.learning.speakPassPct ?? 0,
      lessonCompletionPct: learningMetrics?.learning.lessonCompletionPct ?? 0,
      lessonAbandons: learningMetrics?.learning.lessonAbandons ?? 0,
    },
  });

  const buildSupportOperationsPayload = () => ({
    generatedAt: new Date().toISOString(),
    windowDays: metricsWindowDays,
    support: supportMetrics?.support || null,
  });

  const buildLearningHealthPayload = () => ({
    generatedAt: new Date().toISOString(),
    windowDays: metricsWindowDays,
    learning: learningMetrics?.learning || null,
  });

  const downloadExecutiveSummaryJson = () => {
    const payload = buildExecutiveSummaryPayload();
    downloadTextFile(
      `admin-executive-summary-${metricsWindowDays}d.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
    );
  };

  const downloadSupportOperationsJson = () => {
    const payload = buildSupportOperationsPayload();
    downloadTextFile(
      `admin-support-operations-${metricsWindowDays}d.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
    );
  };

  const downloadSupportOperationsCsv = () => {
    const support = supportMetrics?.support;
    const csv = toCsv(
      ["metric", "value", "windowDays"],
      [
        ["failedLogins", support?.failedLogins ?? 0, metricsWindowDays],
        [
          "endUserFailedLogins",
          support?.endUserFailedLogins ?? 0,
          metricsWindowDays,
        ],
        ["resetRequests", support?.resetRequests ?? 0, metricsWindowDays],
        [
          "emailVerificationRequired",
          support?.emailVerificationRequired ?? 0,
          metricsWindowDays,
        ],
        ["newIpLogins", support?.newIpLogins ?? 0, metricsWindowDays],
        ["newDeviceLogins", support?.newDeviceLogins ?? 0, metricsWindowDays],
        [
          "sessionRevocations",
          support?.sessionRevocations ?? 0,
          metricsWindowDays,
        ],
        [
          "unauthorizedAdminAttempts",
          support?.unauthorizedAdminAttempts ?? 0,
          metricsWindowDays,
        ],
        ["currentUsers", support?.currentUsers ?? 0, metricsWindowDays],
        ["newUsers", support?.newUsers ?? 0, metricsWindowDays],
        ["activeUsers", support?.activeUsers ?? 0, metricsWindowDays],
        [
          "supportNotesCreated",
          support?.supportNotesCreated ?? 0,
          metricsWindowDays,
        ],
        [
          "supportNoteCreateFailures",
          support?.supportNoteCreateFailures ?? 0,
          metricsWindowDays,
        ],
      ],
    );
    downloadTextFile(
      `admin-support-operations-${metricsWindowDays}d.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
  };

  const downloadLearningHealthJson = () => {
    const payload = buildLearningHealthPayload();
    downloadTextFile(
      `admin-learning-health-${metricsWindowDays}d.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
    );
  };

  const downloadLearningHealthCsv = () => {
    const learning = learningMetrics?.learning;
    const csv = toCsv(
      ["metric", "value", "windowDays"],
      [
        ["quizAttempts", learning?.quizAttempts ?? 0, metricsWindowDays],
        ["quizAccuracyPct", learning?.quizAccuracyPct ?? 0, metricsWindowDays],
        ["speakAttempts", learning?.speakAttempts ?? 0, metricsWindowDays],
        ["speakPassPct", learning?.speakPassPct ?? 0, metricsWindowDays],
        ["lessonStarts", learning?.lessonStarts ?? 0, metricsWindowDays],
        [
          "lessonStartsTracked",
          learning?.lessonStartsTracked ?? 0,
          metricsWindowDays,
        ],
        [
          "lessonStartsInferred",
          learning?.lessonStartsInferred ?? 0,
          metricsWindowDays,
        ],
        ["lessonCompleted", learning?.lessonCompleted ?? 0, metricsWindowDays],
        [
          "lessonCompletionPct",
          learning?.lessonCompletionPct ?? 0,
          metricsWindowDays,
        ],
        ["lessonAbandons", learning?.lessonAbandons ?? 0, metricsWindowDays],
      ],
    );
    downloadTextFile(
      `admin-learning-health-${metricsWindowDays}d.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
  };

  const downloadWeeklyExecutiveJson = () => {
    downloadTextFile(
      `admin-weekly-executive-${metricsWindowDays}d.json`,
      JSON.stringify(executiveWeeklyReport || {}, null, 2),
      "application/json;charset=utf-8",
    );
  };

  const downloadWeeklyExecutiveCsv = () => {
    const report = executiveWeeklyReport;
    const csv = toCsv(
      ["metric", "current", "previous", "deltaPct", "windowDays"],
      [
        [
          "newUsers",
          report?.comparisons.newUsers.current ?? 0,
          report?.comparisons.newUsers.previous ?? 0,
          report?.comparisons.newUsers.deltaPct ?? 0,
          report?.windowDays ?? metricsWindowDays,
        ],
        [
          "lessonsCompleted",
          report?.comparisons.lessonsCompleted.current ?? 0,
          report?.comparisons.lessonsCompleted.previous ?? 0,
          report?.comparisons.lessonsCompleted.deltaPct ?? 0,
          report?.windowDays ?? metricsWindowDays,
        ],
        [
          "quizAttempts",
          report?.comparisons.quizAttempts.current ?? 0,
          report?.comparisons.quizAttempts.previous ?? 0,
          report?.comparisons.quizAttempts.deltaPct ?? 0,
          report?.windowDays ?? metricsWindowDays,
        ],
      ],
    );
    downloadTextFile(
      `admin-weekly-executive-${metricsWindowDays}d.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
  };

  const downloadDeletionLifecycleJson = () => {
    downloadTextFile(
      `admin-deletion-lifecycle-${metricsWindowDays}d.json`,
      JSON.stringify(deletionLifecycleReport || {}, null, 2),
      "application/json;charset=utf-8",
    );
  };

  const downloadDeletionLifecycleCsv = () => {
    const report = deletionLifecycleReport;
    const csv = toCsv(
      ["metric", "value", "windowDays"],
      [
        [
          "openRequests",
          report?.openRequests ?? 0,
          report?.windowDays ?? metricsWindowDays,
        ],
        [
          "agedOpenRequestsOver7d",
          report?.agedOpenRequestsOver7d ?? 0,
          report?.windowDays ?? metricsWindowDays,
        ],
        [
          "resolvedCases",
          report?.resolvedCases ?? 0,
          report?.windowDays ?? metricsWindowDays,
        ],
        [
          "rejectedCases",
          report?.rejectedCases ?? 0,
          report?.windowDays ?? metricsWindowDays,
        ],
        [
          "scheduledPending",
          report?.scheduledPending ?? 0,
          report?.windowDays ?? metricsWindowDays,
        ],
        [
          "scheduledCompleted",
          report?.scheduledCompleted ?? 0,
          report?.windowDays ?? metricsWindowDays,
        ],
        [
          "scheduledCancelled",
          report?.scheduledCancelled ?? 0,
          report?.windowDays ?? metricsWindowDays,
        ],
        [
          "avgResolutionHours",
          report?.avgResolutionHours ?? 0,
          report?.windowDays ?? metricsWindowDays,
        ],
      ],
    );
    downloadTextFile(
      `admin-deletion-lifecycle-${metricsWindowDays}d.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
  };

  const downloadSecurityIncidentJson = () => {
    downloadTextFile(
      `admin-security-incidents-${metricsWindowDays}d.json`,
      JSON.stringify(securityIncidentReport || {}, null, 2),
      "application/json;charset=utf-8",
    );
  };

  const downloadSecurityIncidentCsv = () => {
    const report = securityIncidentReport;
    const rows: Array<Array<unknown>> = [
      [
        "unauthorizedAdminAttempts",
        report?.summary.unauthorizedAdminAttempts ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "supportAdminLoginFailed",
        report?.summary.supportAdminLoginFailed ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "endUserFailedLogins",
        report?.summary.endUserFailedLogins ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "authErrors",
        report?.summary.authErrors ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "newIpLogins",
        report?.summary.newIpLogins ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "newDeviceLogins",
        report?.summary.newDeviceLogins ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "sessionRevocations",
        report?.summary.sessionRevocations ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "adminActions",
        report?.summary.adminActions ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
    ];
    for (const event of report?.topEventTypes || []) {
      rows.push([
        `topEvent:${event.eventType}`,
        event.count,
        report?.windowDays ?? metricsWindowDays,
      ]);
    }
    const csv = toCsv(["metric", "value", "windowDays"], rows);
    downloadTextFile(
      `admin-security-incidents-${metricsWindowDays}d.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
  };

  const downloadLearningMomentumJson = () => {
    downloadTextFile(
      `admin-learning-momentum-${metricsWindowDays}d.json`,
      JSON.stringify(learningMomentumReport || {}, null, 2),
      "application/json;charset=utf-8",
    );
  };

  const downloadLearningMomentumCsv = () => {
    const report = learningMomentumReport;
    const rows: Array<Array<unknown>> = [
      [
        "averageDailyPracticeMinutes",
        report?.summary.averageDailyPracticeMinutes ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "activeLearnersToday",
        report?.summary.activeLearnersToday ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "lessonsStartedToday",
        report?.summary.lessonsStartedToday ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
    ];
    for (const bucket of report?.practiceStreakDistribution || []) {
      rows.push([
        `streakBucket:${bucket.bucket}`,
        bucket.count,
        report?.windowDays ?? metricsWindowDays,
      ]);
    }
    for (const day of report?.dailySeries || []) {
      rows.push([
        `daily:${day.day}:practiceMinutes`,
        day.practiceMinutes,
        report?.windowDays ?? metricsWindowDays,
      ]);
      rows.push([
        `daily:${day.day}:lessonsStarted`,
        day.lessonsStarted,
        report?.windowDays ?? metricsWindowDays,
      ]);
      rows.push([
        `daily:${day.day}:activeLearners`,
        day.activeLearners,
        report?.windowDays ?? metricsWindowDays,
      ]);
    }
    const csv = toCsv(["metric", "value", "windowDays"], rows);
    downloadTextFile(
      `admin-learning-momentum-${metricsWindowDays}d.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
  };

  const downloadActivationFunnelJson = () => {
    downloadTextFile(
      `admin-activation-funnel-${metricsWindowDays}d.json`,
      JSON.stringify(activationFunnelReport || {}, null, 2),
      "application/json;charset=utf-8",
    );
  };

  const downloadActivationFunnelCsv = () => {
    const report = activationFunnelReport;
    const csv = toCsv(
      ["metric", "value", "windowDays"],
      [
        [
          "signups",
          report?.funnel.signups ?? 0,
          report?.windowDays ?? metricsWindowDays,
        ],
        [
          "firstLessonUsers",
          report?.funnel.firstLessonUsers ?? 0,
          report?.windowDays ?? metricsWindowDays,
        ],
        [
          "firstSpeakUsers",
          report?.funnel.firstSpeakUsers ?? 0,
          report?.windowDays ?? metricsWindowDays,
        ],
        [
          "day7ReturnUsers",
          report?.funnel.day7ReturnUsers ?? 0,
          report?.windowDays ?? metricsWindowDays,
        ],
        [
          "signupToFirstLessonPct",
          report?.conversionPct.signupToFirstLesson ?? 0,
          report?.windowDays ?? metricsWindowDays,
        ],
        [
          "signupToFirstSpeakPct",
          report?.conversionPct.signupToFirstSpeak ?? 0,
          report?.windowDays ?? metricsWindowDays,
        ],
        [
          "signupToDay7ReturnPct",
          report?.conversionPct.signupToDay7Return ?? 0,
          report?.windowDays ?? metricsWindowDays,
        ],
      ],
    );
    downloadTextFile(
      `admin-activation-funnel-${metricsWindowDays}d.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
  };

  const downloadStorageBudgetJson = () => {
    downloadTextFile(
      "admin-storage-budget.json",
      JSON.stringify(storageBudgetReport || {}, null, 2),
      "application/json;charset=utf-8",
    );
  };

  const downloadStorageBudgetCsv = () => {
    const report = storageBudgetReport;
    const rows: Array<Array<unknown>> = [
      ["storageBudgetMb", report?.budget.storageBudgetMb ?? 0],
      ["databaseSizeMb", report?.budget.databaseSizeMb ?? 0],
      ["usedPct", report?.budget.usedPct ?? 0],
      ["status", report?.budget.status ?? "unknown"],
    ];
    for (const table of report?.largestTables || []) {
      rows.push([`table:${table.tableName}:mb`, table.mb]);
      rows.push([`table:${table.tableName}:liveRows`, table.liveRows]);
    }
    const csv = toCsv(["metric", "value"], rows);
    downloadTextFile("admin-storage-budget.csv", csv, "text/csv;charset=utf-8");
  };

  const downloadDbGuardrailsJson = () => {
    downloadTextFile(
      `admin-db-guardrails-${metricsWindowDays}d.json`,
      JSON.stringify(dbGuardrailsReport || {}, null, 2),
      "application/json;charset=utf-8",
    );
  };

  const downloadDbGuardrailsCsv = () => {
    const report = dbGuardrailsReport;
    const rows: Array<Array<unknown>> = [
      [
        "quizAttempts",
        report?.growth.quizAttempts ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "speakAttempts",
        report?.growth.speakAttempts ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "progressEvents",
        report?.growth.progressEvents ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "qualityReportsCount",
        report?.retention.qualityReportsCount ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
    ];
    for (const check of report?.indexChecks || []) {
      rows.push([
        `index:${check.key}`,
        check.passed ? "pass" : "fail",
        report?.windowDays ?? metricsWindowDays,
      ]);
    }
    for (const table of report?.tableHealth || []) {
      rows.push([
        `table:${table.tableName}:deadPct`,
        table.deadPct,
        report?.windowDays ?? metricsWindowDays,
      ]);
      rows.push([
        `table:${table.tableName}:deadRows`,
        table.deadRows,
        report?.windowDays ?? metricsWindowDays,
      ]);
    }
    const csv = toCsv(["metric", "value", "windowDays"], rows);
    downloadTextFile(
      `admin-db-guardrails-${metricsWindowDays}d.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
  };

  const downloadProdReadinessJson = () => {
    downloadTextFile(
      "admin-prod-readiness.json",
      JSON.stringify(prodReadinessReport || {}, null, 2),
      "application/json;charset=utf-8",
    );
  };

  const downloadProdReadinessCsv = () => {
    const report = prodReadinessReport;
    const checks = report?.checks;
    const rows: Array<Array<unknown>> = [
      ["ciWorkflowPresent", checks?.ciWorkflowPresent ?? false],
      ["lighthouseWorkflowPresent", checks?.lighthouseWorkflowPresent ?? false],
      [
        "protectedMainBranchEnabled",
        checks?.protectedMainBranchEnabled ?? false,
      ],
      ["stagingConfigured", checks?.stagingConfigured ?? false],
      ["backupFresh", checks?.backupFresh ?? false],
      ["releaseCurrentTag", checks?.releaseCurrentTag ?? ""],
      ["releasePreviousTag", checks?.releasePreviousTag ?? ""],
      ["latestQualityRunId", checks?.latestQualityRun?.runId ?? ""],
      ["latestQualityRunRisk", checks?.latestQualityRun?.risk ?? ""],
      [
        "latestQualityRunFailedChecks",
        checks?.latestQualityRun?.failedChecks ?? 0,
      ],
    ];
    for (const [idx, action] of (report?.recommendedActions || []).entries()) {
      rows.push([`recommendedAction_${idx + 1}`, action]);
    }
    const csv = toCsv(["metric", "value"], rows);
    downloadTextFile("admin-prod-readiness.csv", csv, "text/csv;charset=utf-8");
  };

  const downloadImpactOutcomesJson = () => {
    downloadTextFile(
      `admin-impact-outcomes-${metricsWindowDays}d.json`,
      JSON.stringify(impactOutcomesMetrics || {}, null, 2),
      "application/json;charset=utf-8",
    );
  };

  const buildImpactOutcomesCsv = (report: ImpactOutcomesMetrics | null) => {
    const rows: Array<Array<unknown>> = [
      [
        "summary",
        "generatedAt",
        report?.generatedAt ?? "",
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "summary",
        "windowDays",
        report?.windowDays ?? metricsWindowDays,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "summary",
        "sessionWindowMinutes",
        report?.sessionWindowMinutes ?? 30,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "timeToValue",
        "sampleSize",
        report?.timeToValue?.sampleSize ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "timeToValue",
        "reachedLessonComplete",
        report?.timeToValue?.reachedLessonComplete ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "timeToValue",
        "reachedSpeakPass",
        report?.timeToValue?.reachedSpeakPass ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "timeToValue",
        "reachedMastery",
        report?.timeToValue?.reachedMastery ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "timeToValue",
        "medianDaysToLessonComplete",
        report?.timeToValue?.medianDaysToLessonComplete ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "timeToValue",
        "medianDaysToSpeakPass",
        report?.timeToValue?.medianDaysToSpeakPass ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "timeToValue",
        "medianDaysToMastery",
        report?.timeToValue?.medianDaysToMastery ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "learningGainDelta",
        "quizAccuracyPct",
        report?.learningGain?.deltaPct?.quizAccuracyPct ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "learningGainDelta",
        "speakPassPct",
        report?.learningGain?.deltaPct?.speakPassPct ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "learningGainDelta",
        "lessonsPerActiveUser",
        report?.learningGain?.deltaPct?.lessonsPerActiveUser ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "learningGain.firstHalf",
        "quizSessions",
        report?.learningGain?.firstHalf?.quizSessions ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "learningGain.firstHalf",
        "quizSessionsCompleted",
        report?.learningGain?.firstHalf?.quizSessionsCompleted ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "learningGain.firstHalf",
        "speakSessions",
        report?.learningGain?.firstHalf?.speakSessions ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "learningGain.firstHalf",
        "speakSessionsCompleted",
        report?.learningGain?.firstHalf?.speakSessionsCompleted ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "learningGain.secondHalf",
        "quizSessions",
        report?.learningGain?.secondHalf?.quizSessions ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "learningGain.secondHalf",
        "quizSessionsCompleted",
        report?.learningGain?.secondHalf?.quizSessionsCompleted ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "learningGain.secondHalf",
        "speakSessions",
        report?.learningGain?.secondHalf?.speakSessions ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "learningGain.secondHalf",
        "speakSessionsCompleted",
        report?.learningGain?.secondHalf?.speakSessionsCompleted ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "consistency",
        "activeUsers",
        report?.consistency?.activeUsers ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "consistency",
        "active3PlusDays",
        report?.consistency?.active3PlusDays ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "consistency",
        "active7PlusDays",
        report?.consistency?.active7PlusDays ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "consistency",
        "avgActiveDays",
        report?.consistency?.avgActiveDays ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "mastery",
        "activeUsers",
        report?.mastery?.activeUsers ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "mastery",
        "usersWithMastery",
        report?.mastery?.usersWithMastery ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "mastery",
        "usersWithMasteryInWindow",
        report?.mastery?.usersWithMasteryInWindow ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "mastery",
        "masteryRatePct",
        report?.mastery?.masteryRatePct ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "mastery",
        "medianDaysToFirstMastery",
        report?.mastery?.medianDaysToFirstMastery ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "needsWorkBurden",
        "activeUsers",
        report?.needsWorkBurden?.activeUsers ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "needsWorkBurden",
        "avgNeedsWorkPerActiveUser",
        report?.needsWorkBurden?.avgNeedsWorkPerActiveUser ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "needsWorkBurden",
        "medianNeedsWorkPerActiveUser",
        report?.needsWorkBurden?.medianNeedsWorkPerActiveUser ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "needsWorkBurden",
        "firstHalfMissesPerActiveUser",
        report?.needsWorkBurden?.firstHalfMissesPerActiveUser ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "needsWorkBurden",
        "secondHalfMissesPerActiveUser",
        report?.needsWorkBurden?.secondHalfMissesPerActiveUser ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "needsWorkBurden",
        "missesPerActiveUserDeltaPct",
        report?.needsWorkBurden?.missesPerActiveUserDeltaPct ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "needsReview",
        "activeUsers",
        report?.needsReview?.activeUsers ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "needsReview",
        "usersWithNeedsReview",
        report?.needsReview?.usersWithNeedsReview ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "needsReview",
        "totalNeedsReviewEvents",
        report?.needsReview?.totalNeedsReviewEvents ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "needsReview",
        "totalLessonCompletions",
        report?.needsReview?.totalLessonCompletions ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "needsReview",
        "needsReviewEventsPer100Completions",
        report?.needsReview?.needsReviewEventsPer100Completions ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "needsReview",
        "avgNeedsReviewEventsPerActiveUser",
        report?.needsReview?.avgNeedsReviewEventsPerActiveUser ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "needsReview",
        "medianNeedsReviewEventsPerActiveUser",
        report?.needsReview?.medianNeedsReviewEventsPerActiveUser ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "needsReview",
        "firstHalfNeedsReviewEventsPerActiveUser",
        report?.needsReview?.firstHalfNeedsReviewEventsPerActiveUser ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "needsReview",
        "secondHalfNeedsReviewEventsPerActiveUser",
        report?.needsReview?.secondHalfNeedsReviewEventsPerActiveUser ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "needsReview",
        "needsReviewEventsPerActiveUserDeltaPct",
        report?.needsReview?.needsReviewEventsPerActiveUserDeltaPct ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution",
        "sampleSize",
        report?.perUserDistribution?.sampleSize ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.activeDays",
        "avg",
        report?.perUserDistribution?.metrics?.activeDays?.avg ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.activeDays",
        "p50",
        report?.perUserDistribution?.metrics?.activeDays?.p50 ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.activeDays",
        "p75",
        report?.perUserDistribution?.metrics?.activeDays?.p75 ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.activeDays",
        "p90",
        report?.perUserDistribution?.metrics?.activeDays?.p90 ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.lessonsCompleted",
        "avg",
        report?.perUserDistribution?.metrics?.lessonsCompleted?.avg ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.lessonsCompleted",
        "p50",
        report?.perUserDistribution?.metrics?.lessonsCompleted?.p50 ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.lessonsCompleted",
        "p75",
        report?.perUserDistribution?.metrics?.lessonsCompleted?.p75 ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.lessonsCompleted",
        "p90",
        report?.perUserDistribution?.metrics?.lessonsCompleted?.p90 ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.quizAccuracyPct",
        "avg",
        report?.perUserDistribution?.metrics?.quizAccuracyPct?.avg ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.quizAccuracyPct",
        "p50",
        report?.perUserDistribution?.metrics?.quizAccuracyPct?.p50 ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.quizAccuracyPct",
        "p75",
        report?.perUserDistribution?.metrics?.quizAccuracyPct?.p75 ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.quizAccuracyPct",
        "p90",
        report?.perUserDistribution?.metrics?.quizAccuracyPct?.p90 ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.speakPassPct",
        "avg",
        report?.perUserDistribution?.metrics?.speakPassPct?.avg ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.speakPassPct",
        "p50",
        report?.perUserDistribution?.metrics?.speakPassPct?.p50 ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.speakPassPct",
        "p75",
        report?.perUserDistribution?.metrics?.speakPassPct?.p75 ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.speakPassPct",
        "p90",
        report?.perUserDistribution?.metrics?.speakPassPct?.p90 ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.needsWorkCount",
        "avg",
        report?.perUserDistribution?.metrics?.needsWorkCount?.avg ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.needsWorkCount",
        "p50",
        report?.perUserDistribution?.metrics?.needsWorkCount?.p50 ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.needsWorkCount",
        "p75",
        report?.perUserDistribution?.metrics?.needsWorkCount?.p75 ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.needsWorkCount",
        "p90",
        report?.perUserDistribution?.metrics?.needsWorkCount?.p90 ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.needsReviewResets",
        "avg",
        report?.perUserDistribution?.metrics?.needsReviewResets?.avg ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.needsReviewResets",
        "p50",
        report?.perUserDistribution?.metrics?.needsReviewResets?.p50 ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.needsReviewResets",
        "p75",
        report?.perUserDistribution?.metrics?.needsReviewResets?.p75 ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
      [
        "perUserDistribution.needsReviewResets",
        "p90",
        report?.perUserDistribution?.metrics?.needsReviewResets?.p90 ?? 0,
        report?.windowDays ?? metricsWindowDays,
      ],
    ];
    for (const cohort of report?.cohorts || []) {
      rows.push([
        `cohort:${cohort.cohortWeek}`,
        "signups",
        cohort.signups,
        report?.windowDays ?? metricsWindowDays,
      ]);
      rows.push([
        `cohort:${cohort.cohortWeek}`,
        "d1Pct",
        cohort.d1Pct,
        report?.windowDays ?? metricsWindowDays,
      ]);
      rows.push([
        `cohort:${cohort.cohortWeek}`,
        "d7Pct",
        cohort.d7Pct,
        report?.windowDays ?? metricsWindowDays,
      ]);
      rows.push([
        `cohort:${cohort.cohortWeek}`,
        "d30Pct",
        cohort.d30Pct,
        report?.windowDays ?? metricsWindowDays,
      ]);
    }
    for (const item of report?.segmentation?.activeUsersByLanguage || []) {
      rows.push([
        `language:${item.languageId}`,
        "activeUsers",
        item.activeUsers,
        report?.windowDays ?? metricsWindowDays,
      ]);
    }
    for (const bucket of report?.consistency?.streakDistribution || []) {
      rows.push([
        `streak:${bucket.bucket}`,
        "users",
        bucket.users,
        report?.windowDays ?? metricsWindowDays,
      ]);
    }
    for (const cohort of report?.riskCohorts || []) {
      rows.push([
        `riskCohort:${cohort.cohort}`,
        "users",
        cohort.users,
        report?.windowDays ?? metricsWindowDays,
      ]);
      rows.push([
        `riskCohort:${cohort.cohort}`,
        "atRiskUsers",
        cohort.atRiskUsers,
        report?.windowDays ?? metricsWindowDays,
      ]);
      rows.push([
        `riskCohort:${cohort.cohort}`,
        "atRiskRatePct",
        cohort.atRiskRatePct,
        report?.windowDays ?? metricsWindowDays,
      ]);
      rows.push([
        `riskCohort:${cohort.cohort}`,
        "avgNeedsWorkCount",
        cohort.avgNeedsWorkCount,
        report?.windowDays ?? metricsWindowDays,
      ]);
      rows.push([
        `riskCohort:${cohort.cohort}`,
        "avgQuizMissPct",
        cohort.avgQuizMissPct,
        report?.windowDays ?? metricsWindowDays,
      ]);
      rows.push([
        `riskCohort:${cohort.cohort}`,
        "avgSpeakMissPct",
        cohort.avgSpeakMissPct,
        report?.windowDays ?? metricsWindowDays,
      ]);
    }
    return toCsv(["section", "metric", "value", "windowDays"], rows);
  };

  const downloadImpactOutcomesCsv = () => {
    const csv = buildImpactOutcomesCsv(impactOutcomesMetrics);
    downloadTextFile(
      `admin-impact-outcomes-${metricsWindowDays}d.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
  };

  const downloadImpactOutcomesPdf = async () => {
    const report = impactOutcomesMetrics;
    if (!report) return;
    const topCohorts = report.cohorts.slice(0, 8);
    const topRiskCohorts = report.riskCohorts.slice(0, 5);
    const sections = [
      {
        heading: "Executive Summary",
        lines: [
          `Generated at: ${report.generatedAt}`,
          `Reporting window: ${report.windowDays} days`,
          `Weighted D7 retention: ${impactRetentionSummary.d7Pct}%`,
          `Weighted D30 retention: ${impactRetentionSummary.d30Pct}%`,
          `Mastery rate among active users: ${report.mastery.masteryRatePct}%`,
          `Median days to first lesson completion: ${report.timeToValue.medianDaysToLessonComplete ?? "n/a"}`,
          `Median days to first mastery: ${report.mastery.medianDaysToFirstMastery ?? "n/a"}`,
        ],
      },
      {
        heading: "Retention Cohorts (Recent)",
        lines: topCohorts.map(
          (cohort) =>
            `- ${cohort.cohortWeek}: signups ${cohort.signups}, D7 ${cohort.d7Pct}% (${cohort.retainedD7}/${cohort.eligibleD7}), D30 ${cohort.d30Pct}% (${cohort.retainedD30}/${cohort.eligibleD30})`,
        ),
      },
      {
        heading: "Learning Gain",
        lines: [
          `- Session window policy: ${report.sessionWindowMinutes ?? 30} minutes of inactivity defines a new attempt session`,
          `- Quiz accuracy delta: ${report.learningGain.deltaPct.quizAccuracyPct}%`,
          `- Speak pass delta: ${report.learningGain.deltaPct.speakPassPct}%`,
          `- Lessons per active user delta: ${report.learningGain.deltaPct.lessonsPerActiveUser}%`,
          `- First-half quiz sessions: ${report.learningGain.firstHalf.quizSessions ?? 0} (completed: ${report.learningGain.firstHalf.quizSessionsCompleted ?? 0})`,
          `- Second-half quiz sessions: ${report.learningGain.secondHalf.quizSessions ?? 0} (completed: ${report.learningGain.secondHalf.quizSessionsCompleted ?? 0})`,
          `- First-half speak sessions: ${report.learningGain.firstHalf.speakSessions ?? 0} (completed: ${report.learningGain.firstHalf.speakSessionsCompleted ?? 0})`,
          `- Second-half speak sessions: ${report.learningGain.secondHalf.speakSessions ?? 0} (completed: ${report.learningGain.secondHalf.speakSessionsCompleted ?? 0})`,
          `- First-half active users: ${report.learningGain.sample.firstActiveUsers}`,
          `- Second-half active users: ${report.learningGain.sample.secondActiveUsers}`,
        ],
      },
      {
        heading: "Consistency, Mastery, and Needs-Work",
        lines: [
          `- Active users: ${report.consistency.activeUsers}`,
          `- Users active 3+ days: ${report.consistency.active3PlusDays}`,
          `- Users active 7+ days: ${report.consistency.active7PlusDays}`,
          `- Average active days: ${report.consistency.avgActiveDays}`,
          `- Users with mastery: ${report.mastery.usersWithMastery}`,
          `- Users with mastery in window: ${report.mastery.usersWithMasteryInWindow}`,
          `- Avg needs-work count per active user: ${report.needsWorkBurden.avgNeedsWorkPerActiveUser}`,
          `- Median needs-work count per active user: ${report.needsWorkBurden.medianNeedsWorkPerActiveUser}`,
          `- Needs-work misses delta (second vs first half): ${report.needsWorkBurden.missesPerActiveUserDeltaPct}%`,
        ],
      },
      {
        heading: "Needs Review Reset Metrics",
        lines: [
          `- Active users: ${report.needsReview.activeUsers}`,
          `- Users with at least one reset: ${report.needsReview.usersWithNeedsReview}`,
          `- Total needs-review reset events: ${report.needsReview.totalNeedsReviewEvents}`,
          `- Total lesson completions: ${report.needsReview.totalLessonCompletions}`,
          `- Reset events per 100 completions: ${report.needsReview.needsReviewEventsPer100Completions}`,
          `- Avg reset events per active user: ${report.needsReview.avgNeedsReviewEventsPerActiveUser}`,
          `- Median reset events per active user: ${report.needsReview.medianNeedsReviewEventsPerActiveUser}`,
          `- Reset events per active user delta (second vs first half): ${report.needsReview.needsReviewEventsPerActiveUserDeltaPct}%`,
        ],
      },
      {
        heading: "Anonymized Per-User Distribution",
        lines: [
          `- Sample size: ${report.perUserDistribution.sampleSize} active users`,
          `- Active days (avg/p50/p75/p90): ${report.perUserDistribution.metrics.activeDays.avg} / ${report.perUserDistribution.metrics.activeDays.p50} / ${report.perUserDistribution.metrics.activeDays.p75} / ${report.perUserDistribution.metrics.activeDays.p90}`,
          `- Lessons completed (avg/p50/p75/p90): ${report.perUserDistribution.metrics.lessonsCompleted.avg} / ${report.perUserDistribution.metrics.lessonsCompleted.p50} / ${report.perUserDistribution.metrics.lessonsCompleted.p75} / ${report.perUserDistribution.metrics.lessonsCompleted.p90}`,
          `- Quiz accuracy % (avg/p50/p75/p90): ${report.perUserDistribution.metrics.quizAccuracyPct.avg} / ${report.perUserDistribution.metrics.quizAccuracyPct.p50} / ${report.perUserDistribution.metrics.quizAccuracyPct.p75} / ${report.perUserDistribution.metrics.quizAccuracyPct.p90}`,
          `- Speak pass % (avg/p50/p75/p90): ${report.perUserDistribution.metrics.speakPassPct.avg} / ${report.perUserDistribution.metrics.speakPassPct.p50} / ${report.perUserDistribution.metrics.speakPassPct.p75} / ${report.perUserDistribution.metrics.speakPassPct.p90}`,
          `- Needs-work count (avg/p50/p75/p90): ${report.perUserDistribution.metrics.needsWorkCount.avg} / ${report.perUserDistribution.metrics.needsWorkCount.p50} / ${report.perUserDistribution.metrics.needsWorkCount.p75} / ${report.perUserDistribution.metrics.needsWorkCount.p90}`,
          `- Needs-review resets (avg/p50/p75/p90): ${report.perUserDistribution.metrics.needsReviewResets.avg} / ${report.perUserDistribution.metrics.needsReviewResets.p50} / ${report.perUserDistribution.metrics.needsReviewResets.p75} / ${report.perUserDistribution.metrics.needsReviewResets.p90}`,
        ],
      },
      {
        heading: "Language Segmentation",
        lines: report.segmentation.activeUsersByLanguage.map(
          (bucket) =>
            `- ${bucket.languageId}: ${bucket.activeUsers} active users`,
        ),
      },
      {
        heading: "Top Risk Cohorts (Anonymized)",
        lines:
          topRiskCohorts.length > 0
            ? topRiskCohorts.map(
                (cohort) =>
                  `- ${cohort.cohort}: users ${cohort.users}, at-risk ${cohort.atRiskUsers} (${cohort.atRiskRatePct}%), avg needs-work ${cohort.avgNeedsWorkCount}, avg quiz miss ${cohort.avgQuizMissPct}%, avg speak miss ${cohort.avgSpeakMissPct}%`,
              )
            : ["- No cohorts met minimum sample threshold in this window."],
      },
      {
        heading: "Metric Definitions",
        lines: [
          `- Cohorts: ${report.definitions.cohorts}`,
          `- Time-to-value: ${report.definitions.timeToValue}`,
          `- Learning gain: ${report.definitions.learningGain}`,
          `- Consistency: ${report.definitions.consistency}`,
          `- Mastery: ${report.definitions.mastery}`,
          `- Needs-work burden: ${report.definitions.needsWorkBurden}`,
          `- Needs-review resets: ${report.definitions.needsReview}`,
          `- Per-user distribution: ${report.definitions.perUserDistribution}`,
          `- Risk cohorts: ${report.definitions.riskCohorts}`,
        ],
      },
    ];
    const pdfBytes = await buildSonusPdf(
      "Sonus Impact & Outcomes Report",
      "Grant-ready summary for retention, progression, and mastery outcomes",
      sections,
    );
    downloadBinaryFile(
      `admin-impact-outcomes-${metricsWindowDays}d.pdf`,
      pdfBytes,
      "application/pdf",
    );
  };

  const downloadAllReportsZip = async () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const generatedAt = new Date().toISOString();
    const appVersion =
      (import.meta.env.VITE_APP_VERSION as string | undefined) || "dev";
    let impact = impactOutcomesMetrics;
    if (!impact || impact.windowDays !== metricsWindowDays) {
      try {
        impact = await parseJsonOrThrow<ImpactOutcomesMetrics>(
          await apiFetch(
            `/v1/admin/metrics/impact-outcomes?windowDays=${metricsWindowDays}`,
            {
              cache: "no-store",
            },
          ),
        );
      } catch {
        impact = impactOutcomesMetrics;
      }
    }
    const executivePayload = buildExecutiveSummaryPayload();
    const supportPayload = buildSupportOperationsPayload();
    const learningPayload = buildLearningHealthPayload();
    const weeklyPayload = executiveWeeklyReport || {};
    const deletionPayload = deletionLifecycleReport || {};
    const securityPayload = securityIncidentReport || {};
    const momentumPayload = learningMomentumReport || {};
    const funnelPayload = activationFunnelReport || {};
    const storagePayload = storageBudgetReport || {};
    const guardrailsPayload = dbGuardrailsReport || {};
    const readinessPayload = prodReadinessReport || {};
    const impactPayload = impact || {};

    const support = supportMetrics?.support;
    const learning = learningMetrics?.learning;
    const weekly = executiveWeeklyReport;
    const deletion = deletionLifecycleReport;
    const security = securityIncidentReport;
    const momentum = learningMomentumReport;
    const funnel = activationFunnelReport;
    const storage = storageBudgetReport;
    const guardrails = dbGuardrailsReport;
    const readiness = prodReadinessReport;

    const supportCsv = toCsv(
      ["metric", "value", "windowDays"],
      [
        ["failedLogins", support?.failedLogins ?? 0, metricsWindowDays],
        [
          "endUserFailedLogins",
          support?.endUserFailedLogins ?? 0,
          metricsWindowDays,
        ],
        ["resetRequests", support?.resetRequests ?? 0, metricsWindowDays],
        [
          "emailVerificationRequired",
          support?.emailVerificationRequired ?? 0,
          metricsWindowDays,
        ],
        ["newIpLogins", support?.newIpLogins ?? 0, metricsWindowDays],
        ["newDeviceLogins", support?.newDeviceLogins ?? 0, metricsWindowDays],
        [
          "sessionRevocations",
          support?.sessionRevocations ?? 0,
          metricsWindowDays,
        ],
        [
          "unauthorizedAdminAttempts",
          support?.unauthorizedAdminAttempts ?? 0,
          metricsWindowDays,
        ],
        ["currentUsers", support?.currentUsers ?? 0, metricsWindowDays],
        ["newUsers", support?.newUsers ?? 0, metricsWindowDays],
        ["activeUsers", support?.activeUsers ?? 0, metricsWindowDays],
        [
          "supportNotesCreated",
          support?.supportNotesCreated ?? 0,
          metricsWindowDays,
        ],
        [
          "supportNoteCreateFailures",
          support?.supportNoteCreateFailures ?? 0,
          metricsWindowDays,
        ],
      ],
    );
    const learningCsv = toCsv(
      ["metric", "value", "windowDays"],
      [
        ["quizAttempts", learning?.quizAttempts ?? 0, metricsWindowDays],
        ["quizAccuracyPct", learning?.quizAccuracyPct ?? 0, metricsWindowDays],
        ["speakAttempts", learning?.speakAttempts ?? 0, metricsWindowDays],
        ["speakPassPct", learning?.speakPassPct ?? 0, metricsWindowDays],
        ["lessonStarts", learning?.lessonStarts ?? 0, metricsWindowDays],
        [
          "lessonStartsTracked",
          learning?.lessonStartsTracked ?? 0,
          metricsWindowDays,
        ],
        [
          "lessonStartsInferred",
          learning?.lessonStartsInferred ?? 0,
          metricsWindowDays,
        ],
        ["lessonCompleted", learning?.lessonCompleted ?? 0, metricsWindowDays],
        [
          "lessonCompletionPct",
          learning?.lessonCompletionPct ?? 0,
          metricsWindowDays,
        ],
        ["lessonAbandons", learning?.lessonAbandons ?? 0, metricsWindowDays],
      ],
    );
    const weeklyCsv = toCsv(
      ["metric", "current", "previous", "deltaPct", "windowDays"],
      [
        [
          "newUsers",
          weekly?.comparisons.newUsers.current ?? 0,
          weekly?.comparisons.newUsers.previous ?? 0,
          weekly?.comparisons.newUsers.deltaPct ?? 0,
          weekly?.windowDays ?? metricsWindowDays,
        ],
        [
          "lessonsCompleted",
          weekly?.comparisons.lessonsCompleted.current ?? 0,
          weekly?.comparisons.lessonsCompleted.previous ?? 0,
          weekly?.comparisons.lessonsCompleted.deltaPct ?? 0,
          weekly?.windowDays ?? metricsWindowDays,
        ],
        [
          "quizAttempts",
          weekly?.comparisons.quizAttempts.current ?? 0,
          weekly?.comparisons.quizAttempts.previous ?? 0,
          weekly?.comparisons.quizAttempts.deltaPct ?? 0,
          weekly?.windowDays ?? metricsWindowDays,
        ],
      ],
    );
    const deletionCsv = toCsv(
      ["metric", "value", "windowDays"],
      [
        [
          "openRequests",
          deletion?.openRequests ?? 0,
          deletion?.windowDays ?? metricsWindowDays,
        ],
        [
          "agedOpenRequestsOver7d",
          deletion?.agedOpenRequestsOver7d ?? 0,
          deletion?.windowDays ?? metricsWindowDays,
        ],
        [
          "resolvedCases",
          deletion?.resolvedCases ?? 0,
          deletion?.windowDays ?? metricsWindowDays,
        ],
        [
          "rejectedCases",
          deletion?.rejectedCases ?? 0,
          deletion?.windowDays ?? metricsWindowDays,
        ],
        [
          "scheduledPending",
          deletion?.scheduledPending ?? 0,
          deletion?.windowDays ?? metricsWindowDays,
        ],
        [
          "scheduledCompleted",
          deletion?.scheduledCompleted ?? 0,
          deletion?.windowDays ?? metricsWindowDays,
        ],
        [
          "scheduledCancelled",
          deletion?.scheduledCancelled ?? 0,
          deletion?.windowDays ?? metricsWindowDays,
        ],
        [
          "avgResolutionHours",
          deletion?.avgResolutionHours ?? 0,
          deletion?.windowDays ?? metricsWindowDays,
        ],
      ],
    );
    const securityRows: Array<Array<unknown>> = [
      [
        "unauthorizedAdminAttempts",
        security?.summary.unauthorizedAdminAttempts ?? 0,
        security?.windowDays ?? metricsWindowDays,
      ],
      [
        "supportAdminLoginFailed",
        security?.summary.supportAdminLoginFailed ?? 0,
        security?.windowDays ?? metricsWindowDays,
      ],
      [
        "endUserFailedLogins",
        security?.summary.endUserFailedLogins ?? 0,
        security?.windowDays ?? metricsWindowDays,
      ],
      [
        "authErrors",
        security?.summary.authErrors ?? 0,
        security?.windowDays ?? metricsWindowDays,
      ],
      [
        "newIpLogins",
        security?.summary.newIpLogins ?? 0,
        security?.windowDays ?? metricsWindowDays,
      ],
      [
        "newDeviceLogins",
        security?.summary.newDeviceLogins ?? 0,
        security?.windowDays ?? metricsWindowDays,
      ],
      [
        "sessionRevocations",
        security?.summary.sessionRevocations ?? 0,
        security?.windowDays ?? metricsWindowDays,
      ],
      [
        "adminActions",
        security?.summary.adminActions ?? 0,
        security?.windowDays ?? metricsWindowDays,
      ],
    ];
    for (const event of security?.topEventTypes || []) {
      securityRows.push([
        `topEvent:${event.eventType}`,
        event.count,
        security?.windowDays ?? metricsWindowDays,
      ]);
    }
    const securityCsv = toCsv(["metric", "value", "windowDays"], securityRows);

    const momentumRows: Array<Array<unknown>> = [
      [
        "averageDailyPracticeMinutes",
        momentum?.summary.averageDailyPracticeMinutes ?? 0,
        momentum?.windowDays ?? metricsWindowDays,
      ],
      [
        "activeLearnersToday",
        momentum?.summary.activeLearnersToday ?? 0,
        momentum?.windowDays ?? metricsWindowDays,
      ],
      [
        "lessonsStartedToday",
        momentum?.summary.lessonsStartedToday ?? 0,
        momentum?.windowDays ?? metricsWindowDays,
      ],
    ];
    for (const bucket of momentum?.practiceStreakDistribution || []) {
      momentumRows.push([
        `streakBucket:${bucket.bucket}`,
        bucket.count,
        momentum?.windowDays ?? metricsWindowDays,
      ]);
    }
    for (const day of momentum?.dailySeries || []) {
      momentumRows.push([
        `daily:${day.day}:practiceMinutes`,
        day.practiceMinutes,
        momentum?.windowDays ?? metricsWindowDays,
      ]);
      momentumRows.push([
        `daily:${day.day}:lessonsStarted`,
        day.lessonsStarted,
        momentum?.windowDays ?? metricsWindowDays,
      ]);
      momentumRows.push([
        `daily:${day.day}:activeLearners`,
        day.activeLearners,
        momentum?.windowDays ?? metricsWindowDays,
      ]);
    }
    const momentumCsv = toCsv(["metric", "value", "windowDays"], momentumRows);

    const funnelCsv = toCsv(
      ["metric", "value", "windowDays"],
      [
        [
          "signups",
          funnel?.funnel.signups ?? 0,
          funnel?.windowDays ?? metricsWindowDays,
        ],
        [
          "firstLessonUsers",
          funnel?.funnel.firstLessonUsers ?? 0,
          funnel?.windowDays ?? metricsWindowDays,
        ],
        [
          "firstSpeakUsers",
          funnel?.funnel.firstSpeakUsers ?? 0,
          funnel?.windowDays ?? metricsWindowDays,
        ],
        [
          "day7ReturnUsers",
          funnel?.funnel.day7ReturnUsers ?? 0,
          funnel?.windowDays ?? metricsWindowDays,
        ],
        [
          "signupToFirstLessonPct",
          funnel?.conversionPct.signupToFirstLesson ?? 0,
          funnel?.windowDays ?? metricsWindowDays,
        ],
        [
          "signupToFirstSpeakPct",
          funnel?.conversionPct.signupToFirstSpeak ?? 0,
          funnel?.windowDays ?? metricsWindowDays,
        ],
        [
          "signupToDay7ReturnPct",
          funnel?.conversionPct.signupToDay7Return ?? 0,
          funnel?.windowDays ?? metricsWindowDays,
        ],
      ],
    );

    const storageRows: Array<Array<unknown>> = [
      ["storageBudgetMb", storage?.budget.storageBudgetMb ?? 0],
      ["databaseSizeMb", storage?.budget.databaseSizeMb ?? 0],
      ["usedPct", storage?.budget.usedPct ?? 0],
      ["status", storage?.budget.status ?? "unknown"],
    ];
    for (const table of storage?.largestTables || []) {
      storageRows.push([`table:${table.tableName}:mb`, table.mb]);
      storageRows.push([`table:${table.tableName}:liveRows`, table.liveRows]);
    }
    const storageCsv = toCsv(["metric", "value"], storageRows);

    const guardrailRows: Array<Array<unknown>> = [
      [
        "quizAttempts",
        guardrails?.growth.quizAttempts ?? 0,
        guardrails?.windowDays ?? metricsWindowDays,
      ],
      [
        "speakAttempts",
        guardrails?.growth.speakAttempts ?? 0,
        guardrails?.windowDays ?? metricsWindowDays,
      ],
      [
        "progressEvents",
        guardrails?.growth.progressEvents ?? 0,
        guardrails?.windowDays ?? metricsWindowDays,
      ],
      [
        "qualityReportsCount",
        guardrails?.retention.qualityReportsCount ?? 0,
        guardrails?.windowDays ?? metricsWindowDays,
      ],
    ];
    for (const check of guardrails?.indexChecks || []) {
      guardrailRows.push([
        `index:${check.key}`,
        check.passed ? "pass" : "fail",
        guardrails?.windowDays ?? metricsWindowDays,
      ]);
    }
    for (const table of guardrails?.tableHealth || []) {
      guardrailRows.push([
        `table:${table.tableName}:deadPct`,
        table.deadPct,
        guardrails?.windowDays ?? metricsWindowDays,
      ]);
      guardrailRows.push([
        `table:${table.tableName}:deadRows`,
        table.deadRows,
        guardrails?.windowDays ?? metricsWindowDays,
      ]);
    }
    const guardrailsCsv = toCsv(
      ["metric", "value", "windowDays"],
      guardrailRows,
    );

    const readinessRows: Array<Array<unknown>> = [
      ["ciWorkflowPresent", readiness?.checks.ciWorkflowPresent ?? false],
      [
        "lighthouseWorkflowPresent",
        readiness?.checks.lighthouseWorkflowPresent ?? false,
      ],
      [
        "protectedMainBranchEnabled",
        readiness?.checks.protectedMainBranchEnabled ?? false,
      ],
      ["stagingConfigured", readiness?.checks.stagingConfigured ?? false],
      ["backupFresh", readiness?.checks.backupFresh ?? false],
      ["releaseCurrentTag", readiness?.checks.releaseCurrentTag ?? ""],
      ["releasePreviousTag", readiness?.checks.releasePreviousTag ?? ""],
      ["latestQualityRunId", readiness?.checks.latestQualityRun?.runId ?? ""],
      ["latestQualityRunRisk", readiness?.checks.latestQualityRun?.risk ?? ""],
      [
        "latestQualityRunFailedChecks",
        readiness?.checks.latestQualityRun?.failedChecks ?? 0,
      ],
    ];
    for (const [idx, action] of (
      readiness?.recommendedActions || []
    ).entries()) {
      readinessRows.push([`recommendedAction_${idx + 1}`, action]);
    }
    const readinessCsv = toCsv(["metric", "value"], readinessRows);
    const impactCsv = buildImpactOutcomesCsv(impact);

    const files = [
      {
        name: `admin-executive-summary-${metricsWindowDays}d.json`,
        content: JSON.stringify(executivePayload, null, 2),
      },
      {
        name: `admin-support-operations-${metricsWindowDays}d.json`,
        content: JSON.stringify(supportPayload, null, 2),
      },
      {
        name: `admin-support-operations-${metricsWindowDays}d.csv`,
        content: supportCsv,
      },
      {
        name: `admin-learning-health-${metricsWindowDays}d.json`,
        content: JSON.stringify(learningPayload, null, 2),
      },
      {
        name: `admin-learning-health-${metricsWindowDays}d.csv`,
        content: learningCsv,
      },
      {
        name: `admin-weekly-executive-${metricsWindowDays}d.json`,
        content: JSON.stringify(weeklyPayload, null, 2),
      },
      {
        name: `admin-weekly-executive-${metricsWindowDays}d.csv`,
        content: weeklyCsv,
      },
      {
        name: `admin-deletion-lifecycle-${metricsWindowDays}d.json`,
        content: JSON.stringify(deletionPayload, null, 2),
      },
      {
        name: `admin-deletion-lifecycle-${metricsWindowDays}d.csv`,
        content: deletionCsv,
      },
      {
        name: `admin-security-incidents-${metricsWindowDays}d.json`,
        content: JSON.stringify(securityPayload, null, 2),
      },
      {
        name: `admin-security-incidents-${metricsWindowDays}d.csv`,
        content: securityCsv,
      },
      {
        name: `admin-learning-momentum-${metricsWindowDays}d.json`,
        content: JSON.stringify(momentumPayload, null, 2),
      },
      {
        name: `admin-learning-momentum-${metricsWindowDays}d.csv`,
        content: momentumCsv,
      },
      {
        name: `admin-activation-funnel-${metricsWindowDays}d.json`,
        content: JSON.stringify(funnelPayload, null, 2),
      },
      {
        name: `admin-activation-funnel-${metricsWindowDays}d.csv`,
        content: funnelCsv,
      },
      {
        name: "admin-storage-budget.json",
        content: JSON.stringify(storagePayload, null, 2),
      },
      { name: "admin-storage-budget.csv", content: storageCsv },
      {
        name: `admin-db-guardrails-${metricsWindowDays}d.json`,
        content: JSON.stringify(guardrailsPayload, null, 2),
      },
      {
        name: `admin-db-guardrails-${metricsWindowDays}d.csv`,
        content: guardrailsCsv,
      },
      {
        name: "admin-prod-readiness.json",
        content: JSON.stringify(readinessPayload, null, 2),
      },
      { name: "admin-prod-readiness.csv", content: readinessCsv },
      {
        name: `admin-impact-outcomes-${metricsWindowDays}d.json`,
        content: JSON.stringify(impactPayload, null, 2),
      },
      {
        name: `admin-impact-outcomes-${metricsWindowDays}d.csv`,
        content: impactCsv,
      },
    ];
    const manifest = {
      schemaVersion: 1,
      generatedAt,
      windowDays: metricsWindowDays,
      appVersion,
      fileCount: files.length,
      files: files.map((file) => file.name),
    };
    downloadZipFile(`admin-reports-${metricsWindowDays}d-${timestamp}.zip`, [
      { name: "manifest.json", content: JSON.stringify(manifest, null, 2) },
      ...files,
    ]);
  };

  useEffect(() => {
    if (didBootstrapRef.current) return;
    didBootstrapRef.current = true;
    let cancelled = false;
    if (!readSupportAdminToken()) {
      setAuthenticated(false);
      setSupportAdminUsername(null);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      const ok = await Promise.race<boolean>([
        verifySupportAdminSession(),
        new Promise<boolean>((resolve) => {
          window.setTimeout(() => resolve(false), SUPPORT_AUTH_BOOT_TIMEOUT_MS);
        }),
      ]);
      if (!cancelled) {
        if (ok) {
          if (viewMode === "ops") void runSearch();
          if (viewMode === "dashboard") {
            void loadDashboardMetrics(metricsWindowDays);
            void loadAdminTimeline();
          }
          if (viewMode === "quality-reports") {
            void loadQualityReports();
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    loadAdminTimeline,
    loadDashboardMetrics,
    loadQualityReports,
    metricsWindowDays,
    runSearch,
    verifySupportAdminSession,
    viewMode,
  ]);

  useEffect(() => {
    if (!authenticated) return;
    if (viewMode === "dashboard") {
      void loadDashboardMetrics(metricsWindowDays);
      void loadAdminTimeline();
      return;
    }
    if (viewMode === "metrics-support") {
      void loadSupportMetrics(metricsWindowDays);
      void loadDeletionCases("");
      return;
    }
    if (viewMode === "metrics-learning") {
      void loadLearningMetrics(metricsWindowDays);
      return;
    }
    if (viewMode === "metrics-impact") {
      void loadImpactOutcomesMetrics(metricsWindowDays);
      return;
    }
    if (viewMode === "quality-reports") {
      void loadQualityReports();
    }
  }, [
    authenticated,
    loadAdminTimeline,
    loadDashboardMetrics,
    loadDeletionCases,
    loadImpactOutcomesMetrics,
    loadLearningMetrics,
    loadQualityReports,
    loadSupportMetrics,
    metricsWindowDays,
    viewMode,
  ]);

  // Intentionally tied to auth/view transitions to repopulate operations state.
  useEffect(() => {
    if (!selectedUserId || !authenticated || viewMode !== "ops") {
      setOverview(null);
      setProgressDetail(null);
      setProgressTrend(null);
      setProgressTrendError(null);
      setLearningAccess(null);
      setLearningAccessAudit([]);
      setTimeline([]);
      setSavedNotes([]);
      setReviewQueueDebug(null);
      setReviewQueueDebugError(null);
      return;
    }
    void refreshSelectedUser(selectedUserId);
  }, [authenticated, refreshSelectedUser, selectedUserId, viewMode]);

  useEffect(() => {
    if (!authenticated || viewMode !== "ops") return;
    // Ensure User Operations repopulates whenever the view is entered.
    void runSearch();
    void loadRecentDeletions();
    void loadOpenDeletionRequests();
  }, [
    authenticated,
    loadOpenDeletionRequests,
    loadRecentDeletions,
    runSearch,
    viewMode,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!authenticated || viewMode !== "ops") return () => void 0;
    setAccessCatalogLoading(true);
    setAccessCatalogError(null);
    (async () => {
      try {
        const bands = await loadAccessCatalog(accessLanguageId);
        if (cancelled) return;
        setAccessCatalogBands(bands);
      } catch {
        if (cancelled) return;
        setAccessCatalogBands([]);
        setAccessCatalogError(
          "Failed to load language curriculum for access controls.",
        );
      } finally {
        if (!cancelled) setAccessCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessLanguageId, authenticated, viewMode]);

  useEffect(() => {
    if (!accessBandOptions.length) {
      setTargetBandInput("");
      setTargetUnitInput("");
      setTargetLessonInput("0");
      setAccessLevelId("");
      setAccessUnitBandId("");
      setAccessUnitId("");
      setAccessLessonBandId("");
      setAccessLessonUnitId("");
      setAccessLessonIndex("0");
      return;
    }

    const firstBandId = accessBandOptions[0].id;
    const resolvedTargetBand = accessBandOptions.some(
      (band) => band.id === targetBandInput,
    )
      ? targetBandInput
      : firstBandId;
    if (resolvedTargetBand !== targetBandInput)
      setTargetBandInput(resolvedTargetBand);
    if (!accessBandOptions.some((band) => band.id === accessLevelId))
      setAccessLevelId(firstBandId);

    const targetBand =
      accessBandOptions.find((band) => band.id === resolvedTargetBand) || null;
    const targetUnits = targetBand?.units || [];
    const firstTargetUnitId = targetUnits[0]?.id || "";
    const resolvedTargetUnit = targetUnits.some(
      (unit) => unit.id === targetUnitInput,
    )
      ? targetUnitInput
      : firstTargetUnitId;
    if (resolvedTargetUnit !== targetUnitInput)
      setTargetUnitInput(resolvedTargetUnit);
    const resolvedTargetUnitMeta =
      targetUnits.find((unit) => unit.id === resolvedTargetUnit) || null;
    const targetLessonCount = resolvedTargetUnitMeta?.lessonCount || 0;
    const targetLesson = Number(targetLessonInput);
    const nextTargetLesson =
      Number.isFinite(targetLesson) &&
      targetLesson >= 0 &&
      targetLesson < targetLessonCount
        ? String(targetLesson)
        : "0";
    if (nextTargetLesson !== targetLessonInput)
      setTargetLessonInput(nextTargetLesson);

    const resolvedUnitBand = accessBandOptions.some(
      (band) => band.id === accessUnitBandId,
    )
      ? accessUnitBandId
      : resolvedTargetBand;
    if (resolvedUnitBand !== accessUnitBandId)
      setAccessUnitBandId(resolvedUnitBand);
    const unitBand =
      accessBandOptions.find((band) => band.id === resolvedUnitBand) || null;
    const unitOptions = unitBand?.units || [];
    const firstUnitId = unitOptions[0]?.id || "";
    if (!unitOptions.some((unit) => unit.id === accessUnitId))
      setAccessUnitId(firstUnitId);

    const resolvedLessonBand = accessBandOptions.some(
      (band) => band.id === accessLessonBandId,
    )
      ? accessLessonBandId
      : resolvedTargetBand;
    if (resolvedLessonBand !== accessLessonBandId)
      setAccessLessonBandId(resolvedLessonBand);
    const lessonBand =
      accessBandOptions.find((band) => band.id === resolvedLessonBand) || null;
    const lessonUnits = lessonBand?.units || [];
    const firstLessonUnitId = lessonUnits[0]?.id || "";
    const resolvedLessonUnit = lessonUnits.some(
      (unit) => unit.id === accessLessonUnitId,
    )
      ? accessLessonUnitId
      : firstLessonUnitId;
    if (resolvedLessonUnit !== accessLessonUnitId)
      setAccessLessonUnitId(resolvedLessonUnit);
    const lessonUnitMeta =
      lessonUnits.find((unit) => unit.id === resolvedLessonUnit) || null;
    const lessonCount = lessonUnitMeta?.lessonCount || 0;
    const lessonIndex = Number(accessLessonIndex);
    const nextLessonIndex =
      Number.isFinite(lessonIndex) &&
      lessonIndex >= 0 &&
      lessonIndex < lessonCount
        ? String(lessonIndex)
        : "0";
    if (nextLessonIndex !== accessLessonIndex)
      setAccessLessonIndex(nextLessonIndex);
  }, [
    accessBandOptions,
    accessLessonBandId,
    accessLessonIndex,
    accessLessonUnitId,
    accessLevelId,
    accessUnitBandId,
    accessUnitId,
    targetBandInput,
    targetLessonInput,
    targetUnitInput,
  ]);

  useEffect(() => {
    if (
      !authenticated ||
      viewMode !== "quality-reports" ||
      !selectedQualityRunId
    ) {
      setQualityDetail(null);
      setQualityDetailError(null);
      return;
    }
    void loadQualityReportDetail(selectedQualityRunId);
  }, [authenticated, viewMode, selectedQualityRunId]);

  const runMutation = async (
    action: string,
    path: string,
    body: Record<string, unknown>,
  ) => {
    if (!selectedUserId) return;
    setBusyAction(action);
    setDetailError(null);
    try {
      await parseJsonOrThrow(
        await apiFetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      await refreshSelectedUser(selectedUserId);
      if (action.includes("deletion") || action === "request-deletion") {
        await loadOpenDeletionRequests();
        await loadDeletionCases();
      }
      setActionReason("");
      if (action === "add-note") {
        setNote("");
        setNoteReason("");
      }
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusyAction(null);
    }
  };

  const runAccessMutation = async (payload: Record<string, unknown>) => {
    if (!selectedUserId) return;
    setBusyAction("learning-access");
    setDetailError(null);
    try {
      const responsePayload = await parseJsonOrThrow<{
        state?: LearningAccessState;
      }>(
        await apiFetch(`/v1/admin/users/${selectedUserId}/access`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      await refreshSelectedUser(selectedUserId);
      const cursor = responsePayload.state?.cursor || null;
      setAccessApplySummary({
        language: cursor?.language || null,
        bandId: cursor?.bandId || null,
        unitId: cursor?.unitId || null,
        lessonIndex:
          typeof cursor?.lessonIndex === "number" ? cursor.lessonIndex : null,
        globalAccess: responsePayload.state?.globalAccess ?? true,
        lockAboveTarget: responsePayload.state?.lockAboveTarget ?? false,
      });
      setAccessApplyModalOpen(true);
      setAccessReason("");
      setAccessConfirmOpen(false);
      setPendingAccessPayload(null);
    } catch (error) {
      setDetailError(
        error instanceof Error
          ? error.message
          : "Failed to update learning access",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const submitAccessPayload = async (payload: Record<string, unknown>) => {
    const overrideCount = (() => {
      const overrides = payload.overrides as
        | {
            levels?: Record<string, unknown>;
            units?: Record<string, unknown>;
            lessons?: Record<string, unknown>;
          }
        | undefined;
      if (!overrides) return 0;
      return (
        Object.keys(overrides.levels || {}).length +
        Object.keys(overrides.units || {}).length +
        Object.keys(overrides.lessons || {}).length
      );
    })();

    if (overrideCount >= 8 || (payload.progressTarget && overrideCount >= 4)) {
      setPendingAccessPayload(payload);
      setAccessConfirmOpen(true);
      return;
    }
    await runAccessMutation(payload);
  };

  const handleSupportLogin = useCallback(
    async (usernameOverride?: string, passwordOverride?: string) => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        const resolvedUsername = (usernameOverride ?? adminUsername).trim();
        const resolvedPassword = passwordOverride ?? adminPassword;
        const payload = await parseJsonOrThrow<{ token: string }>(
          await apiFetch("/v1/admin/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: resolvedUsername,
              password: resolvedPassword,
            }),
          }),
        );
        setSupportAdminToken(payload.token);
        setAdminPassword("");
        const ok = await verifySupportAdminSession();
        if (ok) {
          if (viewMode === "ops") await runSearch();
        }
      } catch (error) {
        setAuthError(
          error instanceof Error ? error.message : "Support login failed",
        );
      } finally {
        setAuthBusy(false);
      }
    },
    [
      adminPassword,
      adminUsername,
      runSearch,
      verifySupportAdminSession,
      viewMode,
    ],
  );

  useEffect(() => {
    if (authenticated || authBusy) return;
    let checks = 0;
    const timer = window.setInterval(() => {
      const usernameEl = adminUsernameInputRef.current;
      const passwordEl = adminPasswordInputRef.current;
      if (!usernameEl || !passwordEl) return;

      const nextUsername = usernameEl.value.trim();
      const nextPassword = passwordEl.value;

      if (nextUsername && nextUsername !== adminUsername)
        setAdminUsername(nextUsername);
      if (nextPassword && nextPassword !== adminPassword)
        setAdminPassword(nextPassword);

      const isAutoFilled = (() => {
        try {
          return (
            usernameEl.matches(":-webkit-autofill") ||
            passwordEl.matches(":-webkit-autofill") ||
            usernameEl.matches(":autofill") ||
            passwordEl.matches(":autofill")
          );
        } catch {
          return false;
        }
      })();

      if (
        !adminAutoSubmittedRef.current &&
        isAutoFilled &&
        nextUsername.length >= 3 &&
        nextPassword.length > 0
      ) {
        adminAutoSubmittedRef.current = true;
        void handleSupportLogin(nextUsername, nextPassword);
      }

      checks += 1;
      if (checks >= 20) {
        window.clearInterval(timer);
      }
    }, 250);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    authenticated,
    authBusy,
    adminPassword,
    adminUsername,
    handleSupportLogin,
  ]);

  const handleSupportLogout = async () => {
    try {
      await apiFetch("/v1/admin/auth/logout", { method: "POST" });
    } catch {
      // no-op
    }
    setSupportAdminToken(null);
    setAuthenticated(false);
    setSearchResults([]);
    setSelectedUserId(null);
    setOverview(null);
    setTimeline([]);
    setSupportAdminUsername(null);
  };

  const handleCreateSupportAdmin = async () => {
    if (!canCreateAdmins) return;
    setCreateAdminBusy(true);
    setAdminActionError(null);
    setAuthError(null);
    try {
      await parseJsonOrThrow(
        await apiFetch("/v1/admin/auth/create-admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: createAdminUsername.trim(),
            currentPassword: createAdminCurrentPassword,
            password: createAdminPassword,
            recoveryEmail: createAdminRecoveryEmail.trim() || undefined,
          }),
        }),
      );
      setCreateAdminOpen(false);
      setCreateAdminUsername("");
      setCreateAdminCurrentPassword("");
      setCreateAdminPassword("");
      setCreateAdminRecoveryEmail("");
      setAdminActionSuccess("New admin created successfully.");
    } catch (error) {
      setAdminActionError(
        error instanceof Error ? error.message : "Failed to create admin",
      );
    } finally {
      setCreateAdminBusy(false);
    }
  };

  const handleResetSupportAdminPassword = async () => {
    setResetPasswordBusy(true);
    setAdminActionError(null);
    setAuthError(null);
    try {
      await parseJsonOrThrow(
        await apiFetch("/v1/admin/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword: resetPasswordCurrentValue,
            newPassword: resetPasswordNewValue,
          }),
        }),
      );
      setResetPasswordOpen(false);
      setResetPasswordCurrentValue("");
      setResetPasswordNewValue("");
      setAdminActionSuccess("Password updated successfully.");
    } catch (error) {
      setAdminActionError(
        error instanceof Error ? error.message : "Failed to reset password",
      );
    } finally {
      setResetPasswordBusy(false);
    }
  };

  const handleSaveRecoveryEmail = async () => {
    setRecoveryEmailBusy(true);
    setAdminActionError(null);
    setAuthError(null);
    try {
      await parseJsonOrThrow(
        await apiFetch("/v1/admin/auth/recovery-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recoveryEmail: recoveryEmailValue.trim() }),
        }),
      );
      setRecoveryEmailOpen(false);
      setAdminActionSuccess("Recovery email saved successfully.");
    } catch (error) {
      setAdminActionError(
        error instanceof Error
          ? error.message
          : "Failed to save recovery email",
      );
    } finally {
      setRecoveryEmailBusy(false);
    }
  };

  const handleForgotSupportAdminPassword = async () => {
    setForgotPasswordBusy(true);
    setForgotPasswordMessage(null);
    setAuthError(null);
    try {
      await parseJsonOrThrow(
        await apiFetch("/v1/admin/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: forgotPasswordEmail.trim() }),
        }),
      );
      setForgotPasswordMessage(
        "If an admin account is found, a reset email was sent.",
      );
    } catch (error) {
      setForgotPasswordMessage(
        error instanceof Error ? error.message : "Failed to request reset",
      );
    } finally {
      setForgotPasswordBusy(false);
    }
  };

  const handleResetWithEmailToken = async () => {
    setResetTokenBusy(true);
    setAuthError(null);
    try {
      await parseJsonOrThrow(
        await apiFetch("/v1/admin/auth/reset-password-with-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: resetTokenValue.trim() || resetTokenFromQuery,
            password: resetTokenPasswordValue,
          }),
        }),
      );
      setResetTokenPasswordValue("");
      setResetTokenValue("");
      setAuthError(
        "Password reset successful. Sign in with your new password.",
      );
      navigate("/internal/support", { replace: true });
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Failed to reset password with token",
      );
    } finally {
      setResetTokenBusy(false);
    }
  };

  const handlePermanentDeleteUser = async () => {
    if (!deleteCandidate) return;
    setDeleteBusy(true);
    setDetailError(null);
    try {
      await parseJsonOrThrow(
        await apiFetch(
          `/v1/admin/users/${deleteCandidate.userId}/actions/permanent-delete`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reason: deleteReason.trim(),
            }),
          },
        ),
      );
      const removedUserId = deleteCandidate.userId;
      setDeleteCandidate(null);
      setDeleteReason("");
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
      setDetailError(
        error instanceof Error ? error.message : "Permanent deletion failed",
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleUndoScheduledDeletion = async (targetUserId: string) => {
    const reason =
      undoDeletionReason.trim().length >= 8
        ? undoDeletionReason.trim()
        : "Admin undo: restore scheduled deletion target before permanent purge.";
    setUndoBusyUserId(targetUserId);
    setDetailError(null);
    try {
      await parseJsonOrThrow(
        await apiFetch(`/v1/admin/users/${targetUserId}/actions/undo-delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }),
      );
      setUndoDeletionReason("");
      await loadRecentDeletions();
      await runSearch();
      if (selectedUserId === targetUserId) {
        await refreshSelectedUser(targetUserId);
      }
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "Undo deletion failed",
      );
    } finally {
      setUndoBusyUserId(null);
    }
  };

  const handleDeleteSupportNote = async (noteId: string) => {
    if (!selectedUserId) return;
    const reason =
      noteReason.trim().length >= 8
        ? noteReason.trim()
        : "Admin deleted support note from support console.";
    setDeletingNoteId(noteId);
    setDetailError(null);
    try {
      await parseJsonOrThrow(
        await apiFetch(
          `/v1/admin/users/${selectedUserId}/notes/${noteId}/delete`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
          },
        ),
      );
      setSavedNotes((prev) => prev.filter((entry) => entry.id !== noteId));
      void refreshSelectedUser(selectedUserId);
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "Failed to delete note",
      );
    } finally {
      setDeletingNoteId(null);
    }
  };

  const handleDeletionRequestDecision = async (
    status: "resolved" | "rejected",
  ) => {
    if (!requestModal) return;
    const reason = requestDecisionReason.trim();
    if (reason.length < 8) return;
    setRequestDecisionBusy(true);
    setDetailError(null);
    try {
      await parseJsonOrThrow(
        await apiFetch(
          `/v1/admin/users/${requestModal.targetUserId}/actions/resolve-deletion`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason, status }),
          },
        ),
      );
      setRequestModal(null);
      setRequestDecisionReason("");
      await loadOpenDeletionRequests();
      await loadDeletionCases();
    } catch (error) {
      setDetailError(
        error instanceof Error
          ? error.message
          : "Failed to update deletion request",
      );
    } finally {
      setRequestDecisionBusy(false);
    }
  };

  if (bootLoading) {
    return (
      <div className="min-h-screen page-shell flex items-center justify-center text-[#1f2937]">
        Loading…
      </div>
    );
  }
  if (!authenticated) {
    return (
      <SupportConsoleAuthPage
        adminAutoSubmittedRef={adminAutoSubmittedRef}
        adminPassword={adminPassword}
        adminPasswordInputRef={adminPasswordInputRef}
        adminUsername={adminUsername}
        adminUsernameInputRef={adminUsernameInputRef}
        authBusy={authBusy}
        authError={authError}
        baseButton={baseButton}
        baseInput={baseInput}
        forgotPasswordBusy={forgotPasswordBusy}
        forgotPasswordEmail={forgotPasswordEmail}
        forgotPasswordMessage={forgotPasswordMessage}
        forgotPasswordOpen={forgotPasswordOpen}
        handleForgotSupportAdminPassword={handleForgotSupportAdminPassword}
        handleResetWithEmailToken={handleResetWithEmailToken}
        handleSupportLogin={handleSupportLogin}
        resetTokenBusy={resetTokenBusy}
        resetTokenFromQuery={resetTokenFromQuery}
        resetTokenPasswordValue={resetTokenPasswordValue}
        resetTokenValue={resetTokenValue}
        setAdminPassword={setAdminPassword}
        setAdminUsername={setAdminUsername}
        setForgotPasswordEmail={setForgotPasswordEmail}
        setForgotPasswordOpen={setForgotPasswordOpen}
        setResetTokenPasswordValue={setResetTokenPasswordValue}
        setResetTokenValue={setResetTokenValue}
      />
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      <SupportConsoleHeader
        iconButtonBase={iconButtonBase}
        onLogout={() => void handleSupportLogout()}
        onNavigate={(path) => navigate(path)}
        viewMode={viewMode}
      />

      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <SupportDashboardPage
          Download={Download}
          MissTrendDelta={MissTrendDelta}
          TrendDelta={TrendDelta}
          activationFunnelReport={activationFunnelReport}
          adminTimeline={adminTimeline}
          adminTimelineError={adminTimelineError}
          adminTimelineLoading={adminTimelineLoading}
          baseButton={baseButton}
          dashboardError={dashboardError}
          dashboardGeneratedAt={dashboardGeneratedAt}
          dashboardLoading={dashboardLoading}
          dbGuardrailsReport={dbGuardrailsReport}
          deletionLifecycleReport={deletionLifecycleReport}
          downloadActivationFunnelCsv={downloadActivationFunnelCsv}
          downloadActivationFunnelJson={downloadActivationFunnelJson}
          downloadAllReportsZip={downloadAllReportsZip}
          downloadDbGuardrailsCsv={downloadDbGuardrailsCsv}
          downloadDbGuardrailsJson={downloadDbGuardrailsJson}
          downloadDeletionLifecycleCsv={downloadDeletionLifecycleCsv}
          downloadDeletionLifecycleJson={downloadDeletionLifecycleJson}
          downloadExecutiveSummaryJson={downloadExecutiveSummaryJson}
          downloadLearningHealthCsv={downloadLearningHealthCsv}
          downloadLearningHealthJson={downloadLearningHealthJson}
          downloadLearningMomentumCsv={downloadLearningMomentumCsv}
          downloadLearningMomentumJson={downloadLearningMomentumJson}
          downloadProdReadinessCsv={downloadProdReadinessCsv}
          downloadProdReadinessJson={downloadProdReadinessJson}
          downloadSecurityIncidentCsv={downloadSecurityIncidentCsv}
          downloadSecurityIncidentJson={downloadSecurityIncidentJson}
          downloadStorageBudgetCsv={downloadStorageBudgetCsv}
          downloadStorageBudgetJson={downloadStorageBudgetJson}
          downloadSupportOperationsCsv={downloadSupportOperationsCsv}
          downloadSupportOperationsJson={downloadSupportOperationsJson}
          downloadWeeklyExecutiveCsv={downloadWeeklyExecutiveCsv}
          downloadWeeklyExecutiveJson={downloadWeeklyExecutiveJson}
          executiveWeeklyReport={executiveWeeklyReport}
          learningMetrics={learningMetrics}
          learningMomentumReport={learningMomentumReport}
          loadDashboardMetrics={loadDashboardMetrics}
          metricCard={metricCard}
          metricsWindowDays={metricsWindowDays}
          metricsWindowOptions={metricsWindowOptions}
          prodReadinessReport={prodReadinessReport}
          resolveMetricWordLabels={resolveMetricWordLabels}
          securityIncidentReport={securityIncidentReport}
          setMetricsWindowDays={setMetricsWindowDays}
          speakMissHotspotsByLanguage={speakMissHotspotsByLanguage}
          storageBudgetReport={storageBudgetReport}
          supportMetrics={supportMetrics}
          toLocale={toLocale}
          viewMode={viewMode}
        />

        <SupportMetricsSupportPage
          baseButton={baseButton}
          baseInput={baseInput}
          deletionCaseSearch={deletionCaseSearch}
          deletionCases={deletionCases}
          deletionCasesError={deletionCasesError}
          deletionCasesLoading={deletionCasesLoading}
          loadDeletionCases={loadDeletionCases}
          metricCard={metricCard}
          metricsError={metricsError}
          metricsLoading={metricsLoading}
          metricsWindowDays={metricsWindowDays}
          metricsWindowOptions={metricsWindowOptions}
          riskStyles={riskStyles}
          setDeletionCaseSearch={setDeletionCaseSearch}
          setMetricsWindowDays={setMetricsWindowDays}
          supportMetrics={supportMetrics}
          toLocale={toLocale}
          viewMode={viewMode}
        />

        <SupportMetricsLearningPage
          learningMetrics={learningMetrics}
          metricCard={metricCard}
          metricsError={metricsError}
          metricsLoading={metricsLoading}
          metricsWindowDays={metricsWindowDays}
          metricsWindowOptions={metricsWindowOptions}
          resolveMetricWordLabels={resolveMetricWordLabels}
          setMetricsWindowDays={setMetricsWindowDays}
          viewMode={viewMode}
          weakSpeakWordsByLanguage={weakSpeakWordsByLanguage}
          weakWordsByLanguage={weakWordsByLanguage}
        />

        <SupportMetricsImpactPage
          Download={Download}
          MissTrendDelta={MissTrendDelta}
          TrendDelta={TrendDelta}
          baseButton={baseButton}
          downloadImpactOutcomesCsv={downloadImpactOutcomesCsv}
          downloadImpactOutcomesJson={downloadImpactOutcomesJson}
          downloadImpactOutcomesPdf={downloadImpactOutcomesPdf}
          impactOutcomesMetrics={impactOutcomesMetrics}
          impactRetentionSummary={impactRetentionSummary}
          loadImpactOutcomesMetrics={loadImpactOutcomesMetrics}
          metricCard={metricCard}
          metricsError={metricsError}
          metricsLoading={metricsLoading}
          metricsWindowDays={metricsWindowDays}
          metricsWindowOptions={metricsWindowOptions}
          setMetricsWindowDays={setMetricsWindowDays}
          viewMode={viewMode}
        />

        <SupportQualityReportsPage
          Play={Play}
          baseButton={baseButton}
          baseInput={baseInput}
          cleanupQualityReports={cleanupQualityReports}
          downloadTextFile={downloadTextFile}
          isValidFullSuiteConfirmText={isValidFullSuiteConfirmText}
          loadQualityReports={loadQualityReports}
          qualityCleanupBusy={qualityCleanupBusy}
          qualityCleanupKeepLatest={qualityCleanupKeepLatest}
          qualityCleanupMessage={qualityCleanupMessage}
          qualityDetail={qualityDetail}
          qualityDetailError={qualityDetailError}
          qualityDetailLoading={qualityDetailLoading}
          qualityReports={qualityReports}
          qualityReportsError={qualityReportsError}
          qualityReportsLoading={qualityReportsLoading}
          qualityRunBusy={qualityRunBusy}
          qualityRunFullConfirmOpen={qualityRunFullConfirmOpen}
          qualityRunFullConfirmText={qualityRunFullConfirmText}
          qualityRunMessage={qualityRunMessage}
          runFullQualityReport={runFullQualityReport}
          runProdSafeQualityReport={runProdSafeQualityReport}
          selectedQualityRunId={selectedQualityRunId}
          setQualityCleanupKeepLatest={setQualityCleanupKeepLatest}
          setQualityRunFullConfirmOpen={setQualityRunFullConfirmOpen}
          setQualityRunFullConfirmText={setQualityRunFullConfirmText}
          setSelectedQualityRunId={setSelectedQualityRunId}
          toLocale={toLocale}
          viewMode={viewMode}
        />

        <SupportUserOperationsPage
          ACCESS_LANGUAGE_OPTIONS={ACCESS_LANGUAGE_OPTIONS}
          TrendDelta={TrendDelta}
          accessBandOptions={accessBandOptions}
          accessCatalogError={accessCatalogError}
          accessCatalogLoading={accessCatalogLoading}
          accessFilter={accessFilter}
          accessLanguageId={accessLanguageId}
          accessLessonBandId={accessLessonBandId}
          accessLessonIndex={accessLessonIndex}
          accessLessonStatus={accessLessonStatus}
          accessLessonUnitId={accessLessonUnitId}
          accessLevelId={accessLevelId}
          accessLevelStatus={accessLevelStatus}
          accessReason={accessReason}
          accessUnitBandId={accessUnitBandId}
          accessUnitId={accessUnitId}
          accessUnitStatus={accessUnitStatus}
          actionChannel={actionChannel}
          actionReason={actionReason}
          baseButton={baseButton}
          baseInput={baseInput}
          busyAction={busyAction}
          deletingNoteId={deletingNoteId}
          deletionWorkflowReason={deletionWorkflowReason}
          detailError={detailError}
          detailLoading={detailLoading}
          downloadUserExport={downloadUserExport}
          exportBusy={exportBusy}
          filteredLessonOverrides={filteredLessonOverrides}
          filteredLevelOverrides={filteredLevelOverrides}
          filteredUnitOverrides={filteredUnitOverrides}
          handleDeleteSupportNote={handleDeleteSupportNote}
          handleUndoScheduledDeletion={handleUndoScheduledDeletion}
          languageLabel={languageLabel}
          learningAccess={learningAccess}
          learningAccessAudit={learningAccessAudit}
          lessonOverrideIndexOptions={lessonOverrideIndexOptions}
          lessonOverrideUnitOptions={lessonOverrideUnitOptions}
          metricCard={metricCard}
          note={note}
          noteReason={noteReason}
          openDeletionRequests={openDeletionRequests}
          openDeletionRequestsError={openDeletionRequestsError}
          openDeletionRequestsLoading={openDeletionRequestsLoading}
          overview={overview}
          progressDetail={progressDetail}
          progressTrend={progressTrend}
          progressTrendError={progressTrendError}
          progressTrendWindowDays={progressTrendWindowDays}
          query={query}
          recentDeletions={recentDeletions}
          recentDeletionsError={recentDeletionsError}
          recentDeletionsLoading={recentDeletionsLoading}
          refreshSelectedUser={refreshSelectedUser}
          reviewQueueDebug={reviewQueueDebug}
          reviewQueueDebugError={reviewQueueDebugError}
          reviewQueueDebugLoading={reviewQueueDebugLoading}
          runMutation={runMutation}
          runSearch={runSearch}
          savedNotes={savedNotes}
          searchLoading={searchLoading}
          searchResults={searchResults}
          selectedTargetLabel={selectedTargetLabel}
          selectedUser={selectedUser}
          selectedUserId={selectedUserId}
          setAccessFilter={setAccessFilter}
          setAccessLanguageId={setAccessLanguageId}
          setAccessLessonBandId={setAccessLessonBandId}
          setAccessLessonIndex={setAccessLessonIndex}
          setAccessLessonStatus={setAccessLessonStatus}
          setAccessLessonUnitId={setAccessLessonUnitId}
          setAccessLevelId={setAccessLevelId}
          setAccessLevelStatus={setAccessLevelStatus}
          setAccessReason={setAccessReason}
          setAccessUnitBandId={setAccessUnitBandId}
          setAccessUnitId={setAccessUnitId}
          setAccessUnitStatus={setAccessUnitStatus}
          setActionChannel={setActionChannel}
          setActionReason={setActionReason}
          setDeleteCandidate={setDeleteCandidate}
          setNote={setNote}
          setNoteReason={setNoteReason}
          setProgressTrendWindowDays={setProgressTrendWindowDays}
          setQuery={setQuery}
          setRequestModal={setRequestModal}
          setSelectedUserId={setSelectedUserId}
          setTargetBandInput={setTargetBandInput}
          setTargetLessonInput={setTargetLessonInput}
          setTargetUnitInput={setTargetUnitInput}
          setUndoDeletionReason={setUndoDeletionReason}
          submitAccessPayload={submitAccessPayload}
          targetBandInput={targetBandInput}
          targetLessonInput={targetLessonInput}
          targetLessonOptions={targetLessonOptions}
          targetUnitInput={targetUnitInput}
          targetUnitOption={targetUnitOption}
          targetUnitOptions={targetUnitOptions}
          timeline={timeline}
          timelineSourceLabel={timelineSourceLabel}
          toLocale={toLocale}
          undoBusyUserId={undoBusyUserId}
          undoDeletionReason={undoDeletionReason}
          unitOverrideUnitOptions={unitOverrideUnitOptions}
          viewMode={viewMode}
        />
      </div>
      <SupportConsoleAdminModals
        MailPlus={MailPlus}
        RotateCcwKey={RotateCcwKey}
        UserRoundPlus={UserRoundPlus}
        accessApplyModalOpen={accessApplyModalOpen}
        accessApplySummary={accessApplySummary}
        accessConfirmOpen={accessConfirmOpen}
        adminActionError={adminActionError}
        adminActionSuccess={adminActionSuccess}
        baseButton={baseButton}
        baseInput={baseInput}
        busyAction={busyAction}
        canConfirmPermanentDelete={canConfirmPermanentDelete}
        canCreateAdmins={canCreateAdmins}
        createAdminBusy={createAdminBusy}
        createAdminCurrentPassword={createAdminCurrentPassword}
        createAdminOpen={createAdminOpen}
        createAdminPassword={createAdminPassword}
        createAdminRecoveryEmail={createAdminRecoveryEmail}
        createAdminUsername={createAdminUsername}
        deleteAcknowledge={deleteAcknowledge}
        deleteBusy={deleteBusy}
        deleteCandidate={deleteCandidate}
        deleteReason={deleteReason}
        deleteSuccessOpen={deleteSuccessOpen}
        handleCreateSupportAdmin={handleCreateSupportAdmin}
        handleDeletionRequestDecision={handleDeletionRequestDecision}
        handlePermanentDeleteUser={handlePermanentDeleteUser}
        handleResetSupportAdminPassword={handleResetSupportAdminPassword}
        handleSaveRecoveryEmail={handleSaveRecoveryEmail}
        iconButtonBase={iconButtonBase}
        pendingAccessPayload={pendingAccessPayload}
        recoveryEmailBusy={recoveryEmailBusy}
        recoveryEmailOpen={recoveryEmailOpen}
        recoveryEmailValue={recoveryEmailValue}
        requestDecisionBusy={requestDecisionBusy}
        requestDecisionReason={requestDecisionReason}
        requestModal={requestModal}
        resetPasswordBusy={resetPasswordBusy}
        resetPasswordCurrentValue={resetPasswordCurrentValue}
        resetPasswordNewValue={resetPasswordNewValue}
        resetPasswordOpen={resetPasswordOpen}
        runAccessMutation={runAccessMutation}
        selectedTargetLabel={selectedTargetLabel}
        setAccessApplyModalOpen={setAccessApplyModalOpen}
        setAccessApplySummary={setAccessApplySummary}
        setAccessConfirmOpen={setAccessConfirmOpen}
        setAdminActionError={setAdminActionError}
        setAdminActionSuccess={setAdminActionSuccess}
        setCreateAdminCurrentPassword={setCreateAdminCurrentPassword}
        setCreateAdminOpen={setCreateAdminOpen}
        setCreateAdminPassword={setCreateAdminPassword}
        setCreateAdminRecoveryEmail={setCreateAdminRecoveryEmail}
        setCreateAdminUsername={setCreateAdminUsername}
        setDeleteAcknowledge={setDeleteAcknowledge}
        setDeleteCandidate={setDeleteCandidate}
        setDeleteReason={setDeleteReason}
        setDeleteSuccessOpen={setDeleteSuccessOpen}
        setPendingAccessPayload={setPendingAccessPayload}
        setRecoveryEmailOpen={setRecoveryEmailOpen}
        setRecoveryEmailValue={setRecoveryEmailValue}
        setRequestDecisionReason={setRequestDecisionReason}
        setRequestModal={setRequestModal}
        setResetPasswordCurrentValue={setResetPasswordCurrentValue}
        setResetPasswordNewValue={setResetPasswordNewValue}
        setResetPasswordOpen={setResetPasswordOpen}
      />
    </div>
  );
}
