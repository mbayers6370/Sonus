import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  BookUser,
  Gauge,
  Download,
  Home,
  LogOut,
  MailPlus,
  Play,
  RotateCcwKey,
  TextSearch,
  UserRoundPlus,
  UserRoundSearch,
  Minus,
} from "lucide-react";
import { apiFetch } from "../../lib/apiClient";

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

type UserProgressDetail = {
  userId: string;
  language: string | null;
  currentBandId: string | null;
  currentUnitId: string | null;
  currentLessonIdx: number | null;
  lastActivityAt: string | null;
  completionSummary?: {
    lessonsStarted: number;
    lessonsFinished: number;
    lessonsAbandoned: number;
    lessonsMastered: number;
    lessonsMasteryReady: number;
  };
  currentLessonStatus?: {
    introViewed: boolean;
    quizScore: number | null;
    speakScore: number | null;
    completed: boolean;
    mastered: boolean;
    masteryReady: boolean;
    completionCount: number;
  } | null;
};

type UserProgressTrend = {
  windowDays: number;
  summary: {
    totalQuizAttempts: number;
    totalQuizSessions: number;
    totalSpeakAttempts: number;
    totalSpeakSessions: number;
    totalLessonsCompleted: number;
    avgQuizAccuracyPct: number;
    avgSpeakPassPct: number;
    trend: {
      quizAccuracyDeltaPct: number;
      speakPassDeltaPct: number;
      lessonsCompletedPerDayDeltaPct: number;
    };
  };
  series: Array<{
    day: string;
    quizAttempts: number;
    quizSessions: number;
    quizCorrect: number;
    quizAccuracyPct: number;
    speakAttempts: number;
    speakSessions: number;
    speakPasses: number;
    speakPassPct: number;
    lessonsStarted: number;
    lessonsCompleted: number;
  }>;
};

type LearningAccessState = {
  globalAccess: boolean;
  lockAboveTarget: boolean;
  cursor: {
    language: string | null;
    bandId: string | null;
    unitId: string | null;
    lessonIndex: number | null;
  } | null;
  overrides: {
    levels: Record<string, "locked" | "unlocked">;
    units: Record<string, "locked" | "unlocked">;
    lessons: Record<string, "locked" | "unlocked">;
  };
  updatedAt: string | null;
};

type LearningAccessAuditEntry = {
  id: string;
  actorEmail: string | null;
  reason: string;
  changeType: string;
  createdAt: string;
};

type LearningAccessApplySummary = {
  language: string | null;
  bandId: string | null;
  unitId: string | null;
  lessonIndex: number | null;
  globalAccess: boolean;
  lockAboveTarget: boolean;
};

type AccessCatalogUnitOption = {
  id: string;
  label: string;
  displayLabel: string;
  lessonCount: number;
  wordCount: number;
};

type AccessCatalogBandOption = {
  id: string;
  label: string;
  units: AccessCatalogUnitOption[];
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
  status: "scheduled" | "cancelled" | "completed";
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
    newUsers: number;
    activeUsers: number;
    activeWindowMinutes: number;
    supportNotesCreated: number;
    supportNoteCreateFailures: number;
    totalSecurityEvents?: number;
    totalAuthErrorEvents?: number;
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
    lessonStartsInferred?: number;
    lessonCompleted: number;
    lessonCompletionPct: number;
    lessonAbandons: number;
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

type SpeakMissHotspotsByLanguage = {
  windowDays: number;
  limitPerLanguage: number;
  minMissesPerUser: number;
  languages: Array<{
    languageId: string;
    hasData: boolean;
    words: Array<{
      wordId: string;
      affectedUsers: number;
      totalMisses: number;
      avgMissesPerUser: number;
      previousAffectedUsers: number;
      previousTotalMisses: number;
      affectedUsersDeltaPct: number;
      totalMissesDeltaPct: number;
      nativeText: string;
      englishText: string;
    }>;
  }>;
};

type ReviewQueueDebug = {
  count: number;
  limit: number;
  queue: Array<{
    wordId: string;
    priorityScore: number;
    overdueDays: number;
    reasons: string[];
    priorityBreakdown?: {
      forgettingRisk: number;
      missHistory: number;
      pronunciationWeakness: number;
      recentSeenPenalty: number;
      elapsedDays: number;
      stabilityDays: number;
    };
    missedQuizCount: number;
    mispronounceCount: number;
    pronunciationRisk: number;
    lastSeenAt: string | null;
    lexeme?: {
      term?: string;
      en?: string;
    } | null;
  }>;
};

type QualityReportListItem = {
  runId: string;
  generatedAt: string | null;
  startedAt: string | null;
  profile: string;
  risk: string;
  summary: { passed: number; failed: number; skipped: number };
  checksTotal: number;
};

type QualityReportDetail = {
  runId: string;
  markdown: string;
  json: {
    profile?: string;
    risk?: string;
    summary?: { passed?: number; failed?: number; skipped?: number };
    results?: Array<{
      id?: string;
      title?: string;
      status?: string;
      durationMs?: number;
      parsed?: { summary?: string };
    }>;
  } | null;
};

type ExecutiveWeeklyReport = {
  generatedAt: string;
  windowDays: number;
  currentUsers: number;
  comparisons: {
    newUsers: { current: number; previous: number; deltaPct: number };
    lessonsCompleted: { current: number; previous: number; deltaPct: number };
    quizAttempts: { current: number; previous: number; deltaPct: number };
  };
};

type DeletionLifecycleReport = {
  generatedAt: string;
  windowDays: number;
  openRequests: number;
  agedOpenRequestsOver7d: number;
  resolvedCases: number;
  rejectedCases: number;
  scheduledPending: number;
  scheduledCompleted: number;
  scheduledCancelled: number;
  avgResolutionHours: number;
};

type SecurityIncidentReport = {
  generatedAt: string;
  windowDays: number;
  summary: {
    unauthorizedAdminAttempts: number;
    supportAdminLoginFailed: number;
    endUserFailedLogins: number;
    authErrors: number;
    newIpLogins: number;
    newDeviceLogins: number;
    sessionRevocations: number;
    adminActions: number;
  };
  topEventTypes: Array<{ eventType: string; count: number }>;
};

type LearningMomentumReport = {
  generatedAt: string;
  windowDays: number;
  summary: {
    averageDailyPracticeMinutes: number;
    activeLearnersToday: number;
    lessonsStartedToday: number;
  };
  practiceStreakDistribution: Array<{ bucket: string; count: number }>;
  dailySeries: Array<{
    day: string;
    practiceMinutes: number;
    lessonsStarted: number;
    activeLearners: number;
  }>;
};

type ActivationFunnelReport = {
  generatedAt: string;
  windowDays: number;
  funnel: {
    signups: number;
    firstLessonUsers: number;
    firstSpeakUsers: number;
    day7ReturnUsers: number;
  };
  conversionPct: {
    signupToFirstLesson: number;
    signupToFirstSpeak: number;
    signupToDay7Return: number;
  };
};

type StorageBudgetReport = {
  generatedAt: string;
  budget: {
    storageBudgetMb: number;
    storageBudgetBytes: number;
    databaseSizeBytes: number;
    databaseSizeMb: number;
    usedPct: number;
    status: "healthy" | "warning" | "critical" | string;
  };
  largestTables: Array<{
    tableName: string;
    bytes: number;
    mb: number;
    liveRows: number;
  }>;
};

type DbGuardrailsReport = {
  generatedAt: string;
  windowDays: number;
  indexChecks: Array<{ key: string; passed: boolean }>;
  tableHealth: Array<{
    tableName: string;
    liveRows: number;
    deadRows: number;
    deadPct: number;
  }>;
  growth: {
    quizAttempts: number;
    speakAttempts: number;
    progressEvents: number;
  };
  retention: {
    qualityReportsCount: number;
    latestQualityRunId: string | null;
  };
};

type ProdReadinessReport = {
  generatedAt: string;
  checks: {
    ciWorkflowPresent: boolean;
    lighthouseWorkflowPresent: boolean;
    protectedMainBranchEnabled: boolean | null;
    stagingConfigured: boolean;
    backupLastSuccessAt: string | null;
    backupFresh: boolean;
    releaseCurrentTag: string | null;
    releasePreviousTag: string | null;
    latestQualityRun: {
      runId: string;
      generatedAt: string | null;
      risk: string;
      failedChecks: number;
    } | null;
  };
  recommendedActions: string[];
};

type ImpactOutcomesMetrics = {
  generatedAt: string;
  windowDays: number;
  sessionWindowMinutes?: number;
  warning?: string;
  definitions: {
    cohorts: string;
    timeToValue: string;
    learningGain: string;
    consistency: string;
    mastery: string;
    needsWorkBurden: string;
    needsReview: string;
    perUserDistribution: string;
    riskCohorts: string;
  };
  cohorts: Array<{
    cohortWeek: string;
    signups: number;
    eligibleD1: number;
    retainedD1: number;
    d1Pct: number;
    eligibleD7: number;
    retainedD7: number;
    d7Pct: number;
    eligibleD30: number;
    retainedD30: number;
    d30Pct: number;
  }>;
  timeToValue: {
    sampleSize: number;
    reachedLessonComplete: number;
    reachedSpeakPass: number;
    reachedMastery: number;
    medianDaysToLessonComplete: number | null;
    medianDaysToSpeakPass: number | null;
    medianDaysToMastery: number | null;
  };
  learningGain: {
    sample: {
      firstActiveUsers: number;
      secondActiveUsers: number;
    };
    firstHalf: {
      quizAttempts: number;
      quizSessions?: number;
      quizSessionsCompleted?: number;
      quizAccuracyPct: number;
      speakAttempts: number;
      speakSessions?: number;
      speakSessionsCompleted?: number;
      speakPassPct: number;
      lessonsCompleted: number;
      lessonsPerActiveUser: number;
    };
    secondHalf: {
      quizAttempts: number;
      quizSessions?: number;
      quizSessionsCompleted?: number;
      quizAccuracyPct: number;
      speakAttempts: number;
      speakSessions?: number;
      speakSessionsCompleted?: number;
      speakPassPct: number;
      lessonsCompleted: number;
      lessonsPerActiveUser: number;
    };
    deltaPct: {
      quizAccuracyPct: number;
      speakPassPct: number;
      lessonsPerActiveUser: number;
    };
  };
  consistency: {
    activeUsers: number;
    active3PlusDays: number;
    active7PlusDays: number;
    avgActiveDays: number;
    streakDistribution: Array<{ bucket: string; users: number }>;
  };
  mastery: {
    activeUsers: number;
    usersWithMastery: number;
    usersWithMasteryInWindow: number;
    masteryRatePct: number;
    medianDaysToFirstMastery: number | null;
  };
  needsWorkBurden: {
    activeUsers: number;
    avgNeedsWorkPerActiveUser: number;
    medianNeedsWorkPerActiveUser: number;
    firstHalfMissesPerActiveUser: number;
    secondHalfMissesPerActiveUser: number;
    missesPerActiveUserDeltaPct: number;
  };
  needsReview: {
    activeUsers: number;
    usersWithNeedsReview: number;
    totalNeedsReviewEvents: number;
    totalLessonCompletions: number;
    needsReviewEventsPer100Completions: number;
    avgNeedsReviewEventsPerActiveUser: number;
    medianNeedsReviewEventsPerActiveUser: number;
    firstHalfNeedsReviewEventsPerActiveUser: number;
    secondHalfNeedsReviewEventsPerActiveUser: number;
    needsReviewEventsPerActiveUserDeltaPct: number;
  };
  segmentation: {
    activeUsersByLanguage: Array<{
      languageId: string;
      activeUsers: number;
    }>;
  };
  perUserDistribution: {
    sampleSize: number;
    metrics: {
      activeDays: { avg: number; p50: number; p75: number; p90: number };
      lessonsCompleted: { avg: number; p50: number; p75: number; p90: number };
      quizAccuracyPct: { avg: number; p50: number; p75: number; p90: number };
      speakPassPct: { avg: number; p50: number; p75: number; p90: number };
      needsWorkCount: { avg: number; p50: number; p75: number; p90: number };
      needsReviewResets: { avg: number; p50: number; p75: number; p90: number };
    };
  };
  riskCohorts: Array<{
    cohort: string;
    users: number;
    atRiskUsers: number;
    atRiskRatePct: number;
    avgNeedsWorkCount: number;
    avgQuizMissPct: number;
    avgSpeakMissPct: number;
  }>;
};

const SUPPORT_ADMIN_TOKEN_STORAGE_KEY = "sonus.support_admin.token";
const ROOT_QA_ADMIN_USERNAME = "qa-admin-f8n2x7r1@sonus.test";
const SUPPORT_AUTH_BOOT_TIMEOUT_MS = 6000;

function readSupportAdminToken() {
  try {
    return window.localStorage.getItem(SUPPORT_ADMIN_TOKEN_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}
const ACCESS_LANGUAGE_OPTIONS = [{ id: "ja", label: "Japanese" }] as const;
const ACCESS_BANDS_BY_LANGUAGE: Record<string, string[]> = {
  ja: ["n5", "n4", "n3", "n2", "n1"],
};

const baseInput =
  "w-full rounded-xl border border-[#1f2937]/20 bg-white px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-[#1f2937]";
const baseButton =
  "rounded-xl bg-[#1f2937] px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50";
const metricCard = "rounded-xl border border-[#e2e8f0] bg-white p-4";
const iconButtonBase =
  "inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-150";
const metricsWindowOptions = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "3m" },
  { days: 180, label: "6m" },
] as const;

function toLocale(value: string | null | undefined) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function TrendDelta({ deltaPct }: { deltaPct: number }) {
  const safeDelta = Number.isFinite(deltaPct) ? deltaPct : 0;
  const rounded = Math.round(safeDelta * 10) / 10;
  if (rounded > 0) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
        <ArrowUpRight className="h-3.5 w-3.5" />+{rounded}%
      </span>
    );
  }
  if (rounded < 0) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
        <ArrowDownRight className="h-3.5 w-3.5" />
        {rounded}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
      <Minus className="h-3.5 w-3.5" />
      0%
    </span>
  );
}

function MissTrendDelta({ deltaPct }: { deltaPct: number }) {
  const safeDelta = Number.isFinite(deltaPct) ? deltaPct : 0;
  const rounded = Math.round(safeDelta * 10) / 10;
  if (rounded > 0) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
        <ArrowUpRight className="h-3.5 w-3.5" />+{rounded}%
      </span>
    );
  }
  if (rounded < 0) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
        <ArrowDownRight className="h-3.5 w-3.5" />
        {rounded}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
      <Minus className="h-3.5 w-3.5" />
      0%
    </span>
  );
}

function riskStyles(ratio: number) {
  if (ratio >= 1) {
    return { label: "high", tone: "text-red-700", bar: "bg-red-600" };
  }
  if (ratio >= 0.65) {
    return { label: "elevated", tone: "text-amber-700", bar: "bg-amber-500" };
  }
  return { label: "normal", tone: "text-emerald-700", bar: "bg-emerald-600" };
}

function timelineSourceLabel(entry: TimelineEntry) {
  if (
    entry.source === "security_event" &&
    entry.title.startsWith("support_note_")
  ) {
    return "note_event";
  }
  return entry.source;
}

function resolveMetricWordLabels(word: {
  wordId: string;
  nativeText?: string;
  englishText?: string;
}) {
  const wordId = (word.wordId || "").trim();
  const nativeRaw = (word.nativeText || "").trim();
  const englishRaw = (word.englishText || "").trim();
  const looksLikeId = (value: string) =>
    /^l\d+-\d+$/i.test(value) ||
    /^n[1-5]-\d+$/i.test(value) ||
    /^n\d+-\d+$/i.test(value);

  const native =
    nativeRaw && nativeRaw !== wordId && !looksLikeId(nativeRaw)
      ? nativeRaw
      : "Unknown term";
  const english =
    englishRaw && englishRaw !== wordId && !looksLikeId(englishRaw)
      ? englishRaw
      : "Unknown meaning";

  return { native, english };
}

function normalizeLanguageId(languageId: string | null | undefined) {
  const normalized = (languageId || "").trim().toLowerCase();
  if (!normalized) return "ja";
  if (normalized === "jp" || normalized === "japanese") return "ja";
  if (normalized === "ko" || normalized === "korean") return "kr";
  if (normalized === "french") return "fr";
  if (normalized === "italian") return "it";
  if (normalized === "spanish") return "es";
  if (
    normalized === "ja" ||
    normalized === "kr" ||
    normalized === "fr" ||
    normalized === "it" ||
    normalized === "es"
  )
    return normalized;
  return "ja";
}

function languageLabel(languageId: string | null | undefined) {
  const normalized = normalizeLanguageId(languageId);
  if (normalized === "ja") return "Japanese";
  if (normalized === "kr") return "Korean";
  if (normalized === "fr") return "French";
  if (normalized === "it") return "Italian";
  if (normalized === "es") return "Spanish";
  return "Japanese";
}

function resolveBandDataPath(languageId: string, bandId: string) {
  const normalizedLanguage = normalizeLanguageId(languageId);
  if (normalizedLanguage === "ja") return `/data/ja/${bandId}.json`;
  return `/data/${normalizedLanguage}/${bandId}.json`;
}

function isPracticeUnitId(unitId: string) {
  return /listening$/i.test(unitId) || /speaking$/i.test(unitId);
}

function isCheckpointUnitId(unitId: string) {
  return /^checkpoint-\d+$/i.test(unitId);
}

function lessonCountFromWordCount(wordCount: number, maxWordsPerLesson = 10) {
  if (!Number.isFinite(wordCount) || wordCount <= 0) return 0;
  return Math.ceil(wordCount / maxWordsPerLesson);
}

function bandLabelFromId(bandId: string) {
  const normalized = bandId.trim().toLowerCase();
  if (/^band\d+$/i.test(normalized)) {
    const num = Number(normalized.replace("band", ""));
    if (Number.isFinite(num) && num > 0) return `Band ${num}`;
  }
  if (/^n[1-5]$/i.test(normalized)) return normalized.toUpperCase();
  return bandId.toUpperCase();
}

function extractCatalogUnits(rawPayload: unknown) {
  const record = (rawPayload || {}) as Record<string, unknown>;
  const directUnits = record.units;
  const byId = new Map<string, { title: string; wordCount: number }>();

  const upsertUnit = (
    id: string | null | undefined,
    title: string | null | undefined,
    words: unknown,
  ) => {
    const normalizedId = (id || "").trim();
    if (!normalizedId) return;
    const wordCount = Array.isArray(words) ? words.length : 0;
    byId.set(normalizedId, {
      title: (title || "").trim(),
      wordCount,
    });
  };

  if (Array.isArray(directUnits)) {
    for (const unit of directUnits) {
      const row = (unit || {}) as Record<string, unknown>;
      upsertUnit(
        typeof row.id === "string" ? row.id : null,
        typeof row.title === "string" ? row.title : null,
        row.words,
      );
    }
  } else if (directUnits && typeof directUnits === "object") {
    for (const [unitId, value] of Object.entries(
      directUnits as Record<string, unknown>,
    )) {
      const row = (value || {}) as Record<string, unknown>;
      upsertUnit(
        unitId,
        typeof row.title === "string" ? row.title : null,
        row.words,
      );
    }
  }

  const sections = Array.isArray(record.sections) ? record.sections : [];
  for (const section of sections) {
    const sectionRecord = (section || {}) as Record<string, unknown>;
    const sectionUnits = Array.isArray(sectionRecord.units)
      ? sectionRecord.units
      : [];
    for (const unit of sectionUnits) {
      const row = (unit || {}) as Record<string, unknown>;
      upsertUnit(
        typeof row.id === "string" ? row.id : null,
        typeof row.title === "string" ? row.title : null,
        row.words,
      );
    }
  }

  return byId;
}

async function loadAccessCatalog(
  languageId: string,
): Promise<AccessCatalogBandOption[]> {
  const normalizedLanguage = normalizeLanguageId(languageId);
  const bandIds = ACCESS_BANDS_BY_LANGUAGE[normalizedLanguage] || [];
  const bands: AccessCatalogBandOption[] = [];

  for (const bandId of bandIds) {
    try {
      const response = await fetch(
        resolveBandDataPath(normalizedLanguage, bandId),
        {
          cache: "no-store",
        },
      );
      if (!response.ok) continue;
      const rawPayload = (await response.json()) as unknown;
      const unitWordCount = extractCatalogUnits(rawPayload);
      const baseUnits = Array.from(unitWordCount.entries())
        .map(([unitId, unit]) => {
          if (isPracticeUnitId(unitId) || isCheckpointUnitId(unitId))
            return null;
          const wordCount = unit.wordCount;
          const lessonCount = lessonCountFromWordCount(wordCount);
          return {
            id: unitId,
            label: unit.title || unitId,
            lessonCount,
            wordCount,
          };
        })
        .filter(
          (
            unit,
          ): unit is {
            id: string;
            label: string;
            lessonCount: number;
            wordCount: number;
          } => Boolean(unit && unit.lessonCount > 0),
        );
      const units: AccessCatalogUnitOption[] = baseUnits.map((unit, index) => ({
        ...unit,
        displayLabel: `Unit ${index + 1}: ${unit.label}`,
      }));

      if (!units.length) continue;
      bands.push({
        id: bandId,
        label: bandLabelFromId(bandId),
        units,
      });
    } catch {
      // Ignore missing curriculum payloads for disabled languages.
    }
  }

  return bands;
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

function downloadTextFile(
  filename: string,
  content: string,
  contentType: string,
) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadBinaryFile(
  filename: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([buffer], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function wrapTextForPdf(
  text: string,
  maxWidth: number,
  font: { widthOfTextAtSize: (text: string, size: number) => number },
  fontSize: number,
) {
  const words = String(text || "")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = words[0];
  for (let idx = 1; idx < words.length; idx += 1) {
    const candidate = `${current} ${words[idx]}`;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[idx];
    }
  }
  lines.push(current);
  return lines;
}

async function buildSonusPdf(
  title: string,
  subtitle: string,
  sections: Array<{ heading: string; lines: string[] }>,
) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const heading = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  const pageWidth = 612;
  const pageHeight = 792;
  const contentWidth = pageWidth - margin * 2;
  const bodySize = 10.5;
  const headingSize = 12;
  const lineHeight = 14;
  const titleColor = rgb(0.06, 0.19, 0.33);
  const textColor = rgb(0.09, 0.16, 0.22);
  const mutedColor = rgb(0.39, 0.45, 0.52);

  let logoImage: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  try {
    const logoRes = await fetch("/branding/logo_name_solo.png", {
      cache: "no-store",
    });
    if (logoRes.ok) {
      const logoBytes = await logoRes.arrayBuffer();
      logoImage = await doc.embedPng(logoBytes);
    }
  } catch {
    logoImage = null;
  }

  const createPage = () => doc.addPage([pageWidth, pageHeight]);
  let page = createPage();
  let y = pageHeight - margin;
  let pageNumber = 1;

  const drawPageHeader = () => {
    y = pageHeight - margin;
    if (logoImage) {
      const maxLogoWidth = contentWidth * 0.34;
      const baseScale = maxLogoWidth / logoImage.width;
      const scaled = logoImage.scale(Math.min(0.22, baseScale));
      const logoX = (pageWidth - scaled.width) / 2;
      page.drawImage(logoImage, {
        x: logoX,
        y: y - scaled.height,
        width: scaled.width,
        height: scaled.height,
      });
      y -= scaled.height + 24;
    }
    const titleWidth = heading.widthOfTextAtSize(title, 19);
    page.drawText(title, {
      x: Math.max(margin, (pageWidth - titleWidth) / 2),
      y: y - 6,
      size: 19,
      font: heading,
      color: titleColor,
    });
    y -= 34;
    const subtitleWidth = regular.widthOfTextAtSize(subtitle, 10);
    page.drawText(subtitle, {
      x: Math.max(margin, (pageWidth - subtitleWidth) / 2),
      y,
      size: 10,
      font: regular,
      color: mutedColor,
    });
    y -= 18;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1,
      color: rgb(0.85, 0.89, 0.93),
    });
    y -= 16;
  };

  const ensureSpace = (required: number) => {
    if (y - required > margin) return;
    page.drawText(`Page ${pageNumber}`, {
      x: pageWidth - margin - 42,
      y: margin - 18,
      size: 9,
      font: regular,
      color: mutedColor,
    });
    pageNumber += 1;
    page = createPage();
    drawPageHeader();
  };

  drawPageHeader();

  for (const section of sections) {
    ensureSpace(28);
    page.drawText(section.heading, {
      x: margin,
      y,
      size: headingSize,
      font: heading,
      color: textColor,
    });
    y -= 8;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.7,
      color: rgb(0.9, 0.93, 0.95),
    });
    y -= 12;
    for (const rawLine of section.lines) {
      const lineText = rawLine === "" ? " " : rawLine;
      const isBullet = lineText.startsWith("- ");
      const normalizedLine = isBullet ? lineText.slice(2) : lineText;
      const wrapped = wrapTextForPdf(
        normalizedLine,
        isBullet ? contentWidth - 14 : contentWidth,
        regular,
        bodySize,
      );
      for (const wrappedLine of wrapped) {
        ensureSpace(lineHeight + 6);
        if (isBullet) {
          page.drawText("•", {
            x: margin + 2,
            y,
            size: bodySize,
            font: regular,
            color: textColor,
          });
        }
        page.drawText(wrappedLine, {
          x: isBullet ? margin + 14 : margin,
          y,
          size: bodySize,
          font: regular,
          color: textColor,
        });
        y -= lineHeight;
      }
    }
    y -= 10;
  }

  page.drawText(`Page ${pageNumber}`, {
    x: pageWidth - margin - 42,
    y: margin - 18,
    size: 9,
    font: regular,
    color: mutedColor,
  });

  return doc.save();
}

function escapeCsvCell(value: unknown) {
  const text =
    value === null || value === undefined
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(headers: string[], rows: Array<Array<unknown>>) {
  const headerLine = headers.map((cell) => escapeCsvCell(cell)).join(",");
  const rowLines = rows.map((row) =>
    row.map((cell) => escapeCsvCell(cell)).join(","),
  );
  return `\ufeff${[headerLine, ...rowLines].join("\n")}`;
}

function normalizeFullSuiteConfirmText(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function isValidFullSuiteConfirmText(value: string) {
  const normalized = normalizeFullSuiteConfirmText(value);
  return normalized === "RUN_FULL_SUITE" || normalized === "RUN_FULL_SITE";
}

function crc32(input: string) {
  let crc = 0 ^ -1;
  for (let i = 0; i < input.length; i += 1) {
    const byte = input.charCodeAt(i) & 0xff;
    crc ^= byte;
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ -1) >>> 0;
}

function createSimpleZip(files: Array<{ name: string; content: string }>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  const pushU16 = (value: number, out: number[]) => {
    out.push(value & 0xff, (value >>> 8) & 0xff);
  };
  const pushU32 = (value: number, out: number[]) => {
    out.push(
      value & 0xff,
      (value >>> 8) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 24) & 0xff,
    );
  };

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const contentBytes = encoder.encode(file.content);
    const crc = crc32(file.content);

    const localHeader: number[] = [];
    pushU32(0x04034b50, localHeader);
    pushU16(20, localHeader);
    pushU16(0, localHeader);
    pushU16(0, localHeader);
    pushU16(0, localHeader);
    pushU16(0, localHeader);
    pushU32(crc, localHeader);
    pushU32(contentBytes.length, localHeader);
    pushU32(contentBytes.length, localHeader);
    pushU16(nameBytes.length, localHeader);
    pushU16(0, localHeader);

    const localChunk = new Uint8Array(
      localHeader.length + nameBytes.length + contentBytes.length,
    );
    localChunk.set(localHeader, 0);
    localChunk.set(nameBytes, localHeader.length);
    localChunk.set(contentBytes, localHeader.length + nameBytes.length);
    localParts.push(localChunk);

    const centralHeader: number[] = [];
    pushU32(0x02014b50, centralHeader);
    pushU16(20, centralHeader);
    pushU16(20, centralHeader);
    pushU16(0, centralHeader);
    pushU16(0, centralHeader);
    pushU16(0, centralHeader);
    pushU16(0, centralHeader);
    pushU32(crc, centralHeader);
    pushU32(contentBytes.length, centralHeader);
    pushU32(contentBytes.length, centralHeader);
    pushU16(nameBytes.length, centralHeader);
    pushU16(0, centralHeader);
    pushU16(0, centralHeader);
    pushU16(0, centralHeader);
    pushU16(0, centralHeader);
    pushU32(0, centralHeader);
    pushU32(offset, centralHeader);

    const centralChunk = new Uint8Array(
      centralHeader.length + nameBytes.length,
    );
    centralChunk.set(centralHeader, 0);
    centralChunk.set(nameBytes, centralHeader.length);
    centralParts.push(centralChunk);

    offset += localChunk.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const centralOffset = localParts.reduce((sum, part) => sum + part.length, 0);

  const endHeader: number[] = [];
  pushU32(0x06054b50, endHeader);
  pushU16(0, endHeader);
  pushU16(0, endHeader);
  pushU16(files.length, endHeader);
  pushU16(files.length, endHeader);
  pushU32(centralSize, endHeader);
  pushU32(centralOffset, endHeader);
  pushU16(0, endHeader);
  const endChunk = new Uint8Array(endHeader);

  const toArrayBuffer = (chunk: Uint8Array): ArrayBuffer => {
    const copied = new Uint8Array(chunk.byteLength);
    copied.set(chunk);
    return copied.buffer;
  };
  return new Blob(
    [...localParts, ...centralParts, endChunk].map((chunk) =>
      toArrayBuffer(chunk),
    ),
    {
      type: "application/zip",
    },
  );
}

function downloadZipFile(
  filename: string,
  files: Array<{ name: string; content: string }>,
) {
  const blob = createSimpleZip(files);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function fileNameFromContentDisposition(
  headerValue: string | null,
  fallback: string,
) {
  if (!headerValue) return fallback;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(headerValue);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const quotedMatch = /filename="([^"]+)"/i.exec(headerValue);
  if (quotedMatch?.[1]) return quotedMatch[1];
  const plainMatch = /filename=([^;]+)/i.exec(headerValue);
  return plainMatch?.[1]?.trim() || fallback;
}

async function downloadResponseAsFile(
  response: Response,
  fallbackName: string,
) {
  const blob = await response.blob();
  const fileName = fileNameFromContentDisposition(
    response.headers.get("content-disposition"),
    fallbackName,
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: string }).error || "Request failed")
        : "Request failed";
    throw new Error(message);
  }
  return (payload || {}) as T;
}

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

  const viewMode = useMemo<
    | "dashboard"
    | "ops"
    | "metrics-support"
    | "metrics-learning"
    | "metrics-impact"
    | "quality-reports"
  >(() => {
    if (location.pathname.endsWith("/users")) return "ops";
    if (location.pathname.endsWith("/metrics/support"))
      return "metrics-support";
    if (location.pathname.endsWith("/metrics/learning"))
      return "metrics-learning";
    if (location.pathname.endsWith("/metrics/impact-outcomes"))
      return "metrics-impact";
    if (location.pathname.endsWith("/quality-reports"))
      return "quality-reports";
    return "dashboard";
  }, [location.pathname]);

  const selectedUser = useMemo(
    () =>
      searchResults.find((entry) => entry.userId === selectedUserId) || null,
    [searchResults, selectedUserId],
  );
  const selectedTargetLabel = useMemo(() => {
    if (!selectedUserId) return "No user selected";
    const name = (selectedUser?.displayName || "").trim();
    const email = (selectedUser?.email || "").trim();
    if (name && email) return `${name} (${email})`;
    if (name) return name;
    if (email) return email;
    return selectedUserId;
  }, [selectedUserId, selectedUser]);
  const deletionWorkflowReason = useMemo(() => {
    const primary = actionReason.trim();
    if (primary.length >= 8) return primary;
    const fallback = actionChannel.trim();
    return fallback.length >= 8 ? fallback : "";
  }, [actionReason, actionChannel]);
  const normalizedAccessFilter = accessFilter.trim().toLowerCase();
  const filteredLevelOverrides = useMemo(() => {
    const entries = Object.entries(learningAccess?.overrides.levels || {});
    if (!normalizedAccessFilter) return entries;
    return entries.filter(([key]) =>
      key.toLowerCase().includes(normalizedAccessFilter),
    );
  }, [learningAccess?.overrides.levels, normalizedAccessFilter]);
  const filteredUnitOverrides = useMemo(() => {
    const entries = Object.entries(learningAccess?.overrides.units || {});
    if (!normalizedAccessFilter) return entries;
    return entries.filter(([key]) =>
      key.toLowerCase().includes(normalizedAccessFilter),
    );
  }, [learningAccess?.overrides.units, normalizedAccessFilter]);
  const filteredLessonOverrides = useMemo(() => {
    const entries = Object.entries(learningAccess?.overrides.lessons || {});
    if (!normalizedAccessFilter) return entries;
    return entries.filter(([key]) =>
      key.toLowerCase().includes(normalizedAccessFilter),
    );
  }, [learningAccess?.overrides.lessons, normalizedAccessFilter]);
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
          await apiFetch(
            `/v1/admin/metrics/impact-outcomes?windowDays=${windowDays}`,
            {
              cache: "no-store",
            },
          ),
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
      <div className="min-h-screen page-shell px-4 py-6 text-[#1f2937] flex items-center justify-center">
        <div className="w-full">
          <div className="mx-auto max-w-md">
            <section className="rounded-2xl border border-[#1f2937]/20 bg-white/95 p-5">
              <h1 className="text-lg font-semibold text-[#0f172a]">
                Support Admin Login
              </h1>
              <p className="mt-1 text-sm text-[#475569]">
                Sign in to access `/internal/support`.
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (
                    authBusy ||
                    adminUsername.trim().length < 3 ||
                    adminPassword.length < 1
                  )
                    return;
                  void handleSupportLogin();
                }}
              >
                <input
                  ref={adminUsernameInputRef}
                  className={`${baseInput} mt-3`}
                  value={adminUsername}
                  onChange={(event) => {
                    adminAutoSubmittedRef.current = false;
                    setAdminUsername(event.target.value);
                  }}
                  placeholder="admin username (email)"
                  autoComplete="username"
                />
                <input
                  ref={adminPasswordInputRef}
                  type="password"
                  className={`${baseInput} mt-2`}
                  value={adminPassword}
                  onChange={(event) => {
                    adminAutoSubmittedRef.current = false;
                    setAdminPassword(event.target.value);
                  }}
                  placeholder="password"
                  autoComplete="current-password"
                />
                <button
                  type="submit"
                  className={`${baseButton} mt-3 w-full`}
                  disabled={
                    authBusy ||
                    adminUsername.trim().length < 3 ||
                    adminPassword.length < 1
                  }
                >
                  Sign In
                </button>
              </form>
              <button
                type="button"
                className="mt-2 w-full text-xs font-medium text-[#1f2937] underline underline-offset-4"
                onClick={() => {
                  setForgotPasswordEmail(
                    adminUsername.trim() || "qa-admin-f8n2x7r1@sonus.test",
                  );
                  setForgotPasswordOpen(true);
                }}
              >
                Forgot admin password?
              </button>
            </section>
          </div>
          {(resetTokenFromQuery || resetTokenValue.trim()) && (
            <div className="mx-auto mt-4 max-w-md rounded-2xl border border-[#1f2937]/20 bg-white/95 p-5">
              <h2 className="text-lg font-semibold text-[#0f172a]">
                Reset Admin Password
              </h2>
              <p className="mt-1 text-sm text-[#475569]">
                Use the token from your recovery email.
              </p>
              <input
                className={`${baseInput} mt-3`}
                value={resetTokenValue}
                onChange={(event) => setResetTokenValue(event.target.value)}
                placeholder={
                  resetTokenFromQuery
                    ? "Token from URL detected"
                    : "reset token"
                }
              />
              <input
                type="password"
                className={`${baseInput} mt-2`}
                value={resetTokenPasswordValue}
                onChange={(event) =>
                  setResetTokenPasswordValue(event.target.value)
                }
                placeholder="new password (min 12 chars, upper/lower/number/symbol)"
              />
              <button
                type="button"
                className={`${baseButton} mt-3 w-full`}
                disabled={
                  resetTokenBusy ||
                  (resetTokenValue.trim().length < 24 &&
                    resetTokenFromQuery.length < 24) ||
                  resetTokenPasswordValue.length < 12
                }
                onClick={() => void handleResetWithEmailToken()}
              >
                {resetTokenBusy ? "Resetting…" : "Reset Password"}
              </button>
            </div>
          )}
          {authError && (
            <div className="mx-auto mt-4 max-w-5xl rounded-xl border border-[#1f2937]/20 bg-white/95 p-3 text-sm text-[#1f2937]">
              {authError}
            </div>
          )}
          {forgotPasswordOpen && (
            <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-4">
              <div className="w-full max-w-md rounded-2xl border border-[#1f2937]/20 bg-white p-5">
                <h3 className="text-lg font-semibold text-[#0f172a]">
                  Forgot Admin Password
                </h3>
                <p className="mt-1 text-sm text-[#475569]">
                  Enter admin email. If an account is found, we will send a
                  reset link.
                </p>
                <input
                  className={`${baseInput} mt-3`}
                  value={forgotPasswordEmail}
                  onChange={(event) =>
                    setForgotPasswordEmail(event.target.value)
                  }
                  placeholder="admin email"
                />
                {forgotPasswordMessage && (
                  <p className="mt-2 text-xs text-[#334155]">
                    {forgotPasswordMessage}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className={baseButton}
                    disabled={
                      forgotPasswordBusy ||
                      forgotPasswordEmail.trim().length < 5
                    }
                    onClick={() => void handleForgotSupportAdminPassword()}
                  >
                    {forgotPasswordBusy ? "Sending…" : "Send Reset Link"}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937]"
                    disabled={forgotPasswordBusy}
                    onClick={() => setForgotPasswordOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      <section className="fixed inset-x-0 top-0 z-[110] w-full border-b border-white/20 bg-[#1f2937] px-4 py-4 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.65)] md:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="relative flex items-center justify-center gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src="/branding/Logo_White.png"
                srcSet="/branding/Logo_White-500.png 500w, /branding/Logo_White.png 2000w"
                sizes="(max-width: 768px) 180px, 260px"
                width={2000}
                height={500}
                alt="Sonus"
                className="h-6 w-auto opacity-95 md:h-7"
                loading="eager"
              />
              <span aria-hidden="true" className="text-white/45">
                |
              </span>
              <h1 className="main-font truncate text-base font-normal text-white md:text-lg">
                Support Dashboard
              </h1>
            </div>
            <div className="absolute right-0">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/85 transition hover:bg-white/10 hover:text-white"
                onClick={() => void handleSupportLogout()}
                aria-label="Log Out"
                title="Log Out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-center gap-4">
              <div className="relative">
                <button
                  type="button"
                  className={`${iconButtonBase} ${viewMode === "dashboard" ? "bg-[#111827] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                  onClick={() => navigate("/internal/support")}
                  aria-label="Home"
                  title="Home"
                >
                  <Home className="h-5 w-5" />
                </button>
              </div>
              <div className="relative">
                <button
                  type="button"
                  className={`${iconButtonBase} ${viewMode === "ops" ? "bg-[#111827] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                  onClick={() => navigate("/internal/support/users")}
                  aria-label="User Operations"
                  title="User Operations"
                >
                  <UserRoundSearch className="h-5 w-5" />
                </button>
              </div>
              <div className="relative">
                <button
                  type="button"
                  className={`${iconButtonBase} ${viewMode === "metrics-support" ? "bg-[#111827] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                  onClick={() => navigate("/internal/support/metrics/support")}
                  aria-label="Support Metrics"
                  title="Support Metrics"
                >
                  <TextSearch className="h-5 w-5" />
                </button>
              </div>
              <div className="relative">
                <button
                  type="button"
                  className={`${iconButtonBase} ${viewMode === "metrics-learning" ? "bg-[#111827] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                  onClick={() => navigate("/internal/support/metrics/learning")}
                  aria-label="Learning Metrics"
                  title="Learning Metrics"
                >
                  <BookUser className="h-5 w-5" />
                </button>
              </div>
              <div className="relative">
                <button
                  type="button"
                  className={`${iconButtonBase} ${viewMode === "metrics-impact" ? "bg-[#111827] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                  onClick={() =>
                    navigate("/internal/support/metrics/impact-outcomes")
                  }
                  aria-label="Impact and Outcomes"
                  title="Impact and Outcomes"
                >
                  <Gauge className="h-5 w-5" />
                </button>
              </div>
              <div className="relative">
                <button
                  type="button"
                  className={`${iconButtonBase} ${viewMode === "quality-reports" ? "bg-[#111827] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                  onClick={() => navigate("/internal/support/quality-reports")}
                  aria-label="Quality Reports"
                  title="Quality Reports"
                >
                  <FileText className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div aria-hidden="true" className="h-[100px] md:h-[95px]" />

      <div className="mx-auto max-w-7xl p-4 md:p-6">
        {viewMode === "dashboard" && (
          <section className="rounded-2xl border border-[#1f2937]/20 bg-white/95 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[#0f172a]">
                Analytics (Last {metricsWindowDays} Days)
              </h2>
              <div className="flex items-center gap-2">
                <div className="flex rounded-xl border border-[#d1d5db] bg-white p-1">
                  {metricsWindowOptions.map(({ days, label }) => (
                    <button
                      key={`home-window-${days}`}
                      type="button"
                      onClick={() => setMetricsWindowDays(days)}
                      className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                        metricsWindowDays === days
                          ? "bg-[#1f2937] text-white"
                          : "text-[#334155]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={baseButton}
                  onClick={() => void loadDashboardMetrics(metricsWindowDays)}
                >
                  Refresh
                </button>
              </div>
            </div>
            {dashboardLoading && (
              <p className="mt-3 text-sm text-[#475569]">
                Loading dashboard analytics…
              </p>
            )}
            {dashboardError && (
              <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                {dashboardError}
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4 [&>*:last-child:nth-child(odd)]:col-span-2 [&>*:last-child:nth-child(odd)]:mx-auto [&>*:last-child:nth-child(odd)]:w-full [&>*:last-child:nth-child(odd)]:max-w-md md:[&>*:last-child:nth-child(odd)]:col-span-1 md:[&>*:last-child:nth-child(odd)]:mx-0 md:[&>*:last-child:nth-child(odd)]:max-w-none">
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">Current Users</div>
                <div className="text-2xl font-semibold text-[#0f172a]">
                  {supportMetrics?.support.currentUsers ?? 0}
                </div>
                <div className="mt-1 text-[11px] text-[#94a3b8]">
                  Total profile count.
                </div>
              </article>
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">New Users</div>
                <div className="text-2xl font-semibold text-[#0f172a]">
                  {supportMetrics?.support.newUsers ?? 0}
                </div>
                <div className="mt-1 text-[11px] text-[#94a3b8]">
                  Created in this window.
                </div>
              </article>
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">
                  Active Users
                  <span className="ml-1 text-[11px] text-[#94a3b8]">
                    ({supportMetrics?.support.activeWindowMinutes ?? 15}m)
                  </span>
                </div>
                <div className="text-2xl font-semibold text-[#0f172a]">
                  {supportMetrics?.support.activeUsers ?? 0}
                </div>
                <div className="mt-1 text-[11px] text-[#94a3b8]">
                  Active in current session window.
                </div>
              </article>
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">
                  End-User Failed Logins
                </div>
                <div className="text-2xl font-semibold text-[#0f172a]">
                  {supportMetrics?.support.endUserFailedLogins ?? 0}
                </div>
                <div className="mt-1 text-[11px] text-[#94a3b8]">
                  Failed user login events.
                </div>
              </article>
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">
                  Unauthorized Admin Attempts (Route + Login)
                </div>
                <div className="text-2xl font-semibold text-[#0f172a]">
                  {supportMetrics?.support.unauthorizedAdminAttempts ?? 0}
                </div>
                <div className="mt-1 text-[11px] text-[#94a3b8]">
                  Denied route + failed admin login.
                </div>
              </article>
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">Quiz Accuracy</div>
                <div className="text-2xl font-semibold text-[#0f172a]">
                  {learningMetrics?.learning.quizAccuracyPct ?? 0}%
                </div>
                <div className="mt-1 text-[11px] text-[#94a3b8]">
                  Correct quiz attempts / total.
                </div>
              </article>
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">Speak Pass Rate</div>
                <div className="text-2xl font-semibold text-[#0f172a]">
                  {learningMetrics?.learning.speakPassPct ?? 0}%
                </div>
                <div className="mt-1 text-[11px] text-[#94a3b8]">
                  Full pass across initial/final/tone.
                </div>
              </article>
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">
                  Lesson Completion Rate
                </div>
                <div className="text-2xl font-semibold text-[#0f172a]">
                  {learningMetrics?.learning.lessonCompletionPct ?? 0}%
                </div>
                <div className="mt-1 text-[11px] text-[#94a3b8]">
                  Completed lessons / started lessons.
                </div>
              </article>
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">Lessons Abandoned</div>
                <div className="text-2xl font-semibold text-[#0f172a]">
                  {learningMetrics?.learning.lessonAbandons ?? 0}
                </div>
                <div className="mt-1 text-[11px] text-[#94a3b8]">
                  Started lessons not completed.
                </div>
              </article>
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">
                  Support Notes Created
                </div>
                <div className="text-2xl font-semibold text-[#0f172a]">
                  {supportMetrics?.support.supportNotesCreated ?? 0}
                </div>
                <div className="mt-1 text-[11px] text-[#94a3b8]">
                  Notes created in this window.
                </div>
              </article>
              <article className={metricCard}>
                <div className="text-xs text-[#64748b]">
                  Password Reset Requests
                </div>
                <div className="text-2xl font-semibold text-[#0f172a]">
                  {supportMetrics?.support.resetRequests ?? 0}
                </div>
                <div className="mt-1 text-[11px] text-[#94a3b8]">
                  Reset tokens created in-window.
                </div>
              </article>
            </div>
            <div className="mt-4 rounded-xl border border-[#f59e0b]/40 bg-[#fff7ed] p-3">
              <h3 className="text-sm font-semibold text-[#9a3412]">
                Watchlist
              </h3>
              <div className="mt-2 grid gap-2 text-sm text-[#7c2d12] md:grid-cols-3">
                <div>
                  Unauthorized admin attempts (route + login):{" "}
                  <span className="font-semibold">
                    {supportMetrics?.support.unauthorizedAdminAttempts ?? 0}
                  </span>
                </div>
                <div>
                  End-user failed logins:{" "}
                  <span className="font-semibold">
                    {supportMetrics?.support.endUserFailedLogins ?? 0}
                  </span>
                </div>
                <div>
                  Lesson abandons:{" "}
                  <span className="font-semibold">
                    {learningMetrics?.learning.lessonAbandons ?? 0}
                  </span>
                </div>
              </div>
            </div>
            {speakMissHotspotsByLanguage && (
              <div className="mt-4 rounded-xl border border-[#fca5a5]/50 bg-[#fff1f2] p-3">
                <details open>
                  <summary className="cursor-pointer list-none">
                    <h3 className="text-sm font-semibold text-[#9f1239]">
                      Speak Miss Hotspots By Language
                    </h3>
                  </summary>
                  <p className="mt-1 text-xs text-[#9f1239]">
                    Trigger threshold: at least{" "}
                    {speakMissHotspotsByLanguage.minMissesPerUser} misses per
                    user on the same word.
                  </p>
                  <p className="mt-1 text-[11px] text-[#be123c]">
                    Trend compares against the previous{" "}
                    {speakMissHotspotsByLanguage.windowDays}-day window.
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {speakMissHotspotsByLanguage.languages.map((bucket) => (
                      <article
                        key={`hotspot-${bucket.languageId}`}
                        className={`rounded-lg border p-3 ${
                          bucket.hasData
                            ? "border-[#fecdd3] bg-white"
                            : "border-[#ffd6dc] bg-[#fff7f9] text-[#9ca3af]"
                        }`}
                      >
                        <div className="text-xs uppercase tracking-[0.16em]">
                          {bucket.languageId}
                        </div>
                        {!bucket.hasData && (
                          <div className="mt-2 text-sm">
                            No hotspots in this window.
                          </div>
                        )}
                        {bucket.hasData && (
                          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1 text-sm">
                            {bucket.words.map((word) => {
                              const labels = resolveMetricWordLabels(word);
                              return (
                                <div
                                  key={`hotspot-${bucket.languageId}-${word.wordId}`}
                                  className="rounded border border-[#ffe4e6] bg-[#fffafb] p-2"
                                >
                                  <div className="truncate font-semibold text-[#0f172a]">
                                    {labels.native}
                                  </div>
                                  <div className="truncate text-[#475569]">
                                    {labels.english}
                                  </div>
                                  <div className="mt-1 space-y-1 text-xs text-[#9f1239]">
                                    <div className="flex items-center justify-between gap-2">
                                      <span>
                                        {word.affectedUsers} users (prev{" "}
                                        {word.previousAffectedUsers})
                                      </span>
                                      <MissTrendDelta
                                        deltaPct={word.affectedUsersDeltaPct}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span>
                                        {word.totalMisses} misses (prev{" "}
                                        {word.previousTotalMisses})
                                      </span>
                                      <MissTrendDelta
                                        deltaPct={word.totalMissesDeltaPct}
                                      />
                                    </div>
                                    <div>
                                      avg {word.avgMissesPerUser.toFixed(1)}
                                      /user
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </details>
              </div>
            )}
            <div className="mt-5 rounded-xl border border-[#e2e8f0] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#0f172a]">
                  Downloadable Reports
                </h3>
                <button
                  type="button"
                  className={baseButton}
                  onClick={downloadAllReportsZip}
                >
                  <span className="inline-flex items-center gap-1">
                    <Download className="h-4 w-4" /> Download Grant Packet (ZIP)
                  </span>
                </button>
              </div>
              <p className="mt-1 text-xs text-[#64748b]">
                Export snapshots for operations reviews, debugging notes, and
                leadership updates.
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <article className="rounded-lg border border-[#e2e8f0] bg-white p-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-[#64748b]">
                    Executive Summary
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#0f172a]">
                    Company health snapshot
                  </div>
                  <div className="mt-1 text-[11px] text-[#475569]">
                    Why it matters: board/grant baseline.
                  </div>
                  <div className="mt-1 text-[11px] text-[#94a3b8]">
                    Last generated: {toLocale(dashboardGeneratedAt)}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-[#334155]">
                    <div>
                      Current users:{" "}
                      <span className="font-semibold">
                        {supportMetrics?.support.currentUsers ?? 0}
                      </span>
                    </div>
                    <div>
                      New users:{" "}
                      <span className="font-semibold">
                        {supportMetrics?.support.newUsers ?? 0}
                      </span>
                    </div>
                    <div>
                      Lesson completion:{" "}
                      <span className="font-semibold">
                        {learningMetrics?.learning.lessonCompletionPct ?? 0}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <button
                      type="button"
                      className={baseButton}
                      onClick={downloadExecutiveSummaryJson}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Download className="h-4 w-4" /> JSON
                      </span>
                    </button>
                  </div>
                </article>

                <article className="rounded-lg border border-[#e2e8f0] bg-white p-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-[#64748b]">
                    Support Operations
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#0f172a]">
                    Security and support workload
                  </div>
                  <div className="mt-1 text-[11px] text-[#475569]">
                    Why it matters: support risk + workload.
                  </div>
                  <div className="mt-1 text-[11px] text-[#94a3b8]">
                    Last generated: {toLocale(dashboardGeneratedAt)}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-[#334155]">
                    <div>
                      Failed logins:{" "}
                      <span className="font-semibold">
                        {supportMetrics?.support.failedLogins ?? 0}
                      </span>
                    </div>
                    <div>
                      Unauthorized admin attempts (route + login):{" "}
                      <span className="font-semibold">
                        {supportMetrics?.support.unauthorizedAdminAttempts ?? 0}
                      </span>
                    </div>
                    <div>
                      Support notes:{" "}
                      <span className="font-semibold">
                        {supportMetrics?.support.supportNotesCreated ?? 0}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={baseButton}
                      onClick={downloadSupportOperationsJson}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Download className="h-4 w-4" /> JSON
                      </span>
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f8fafc]"
                      onClick={downloadSupportOperationsCsv}
                    >
                      CSV
                    </button>
                  </div>
                </article>

                <article className="rounded-lg border border-[#e2e8f0] bg-white p-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-[#64748b]">
                    Learning Health
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#0f172a]">
                    Learning quality and outcomes
                  </div>
                  <div className="mt-1 text-[11px] text-[#475569]">
                    Why it matters: learning quality signal.
                  </div>
                  <div className="mt-1 text-[11px] text-[#94a3b8]">
                    Last generated: {toLocale(dashboardGeneratedAt)}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-[#334155]">
                    <div>
                      Quiz accuracy:{" "}
                      <span className="font-semibold">
                        {learningMetrics?.learning.quizAccuracyPct ?? 0}%
                      </span>
                    </div>
                    <div>
                      Speak pass rate:{" "}
                      <span className="font-semibold">
                        {learningMetrics?.learning.speakPassPct ?? 0}%
                      </span>
                    </div>
                    <div>
                      Lesson abandons:{" "}
                      <span className="font-semibold">
                        {learningMetrics?.learning.lessonAbandons ?? 0}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={baseButton}
                      onClick={downloadLearningHealthJson}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Download className="h-4 w-4" /> JSON
                      </span>
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f8fafc]"
                      onClick={downloadLearningHealthCsv}
                    >
                      CSV
                    </button>
                  </div>
                </article>

                <article className="rounded-lg border border-[#e2e8f0] bg-white p-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-[#64748b]">
                    Weekly Executive
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#0f172a]">
                    Current vs previous window deltas
                  </div>
                  <div className="mt-1 text-[11px] text-[#475569]">
                    Why it matters: trend direction fast.
                  </div>
                  <div className="mt-1 text-[11px] text-[#94a3b8]">
                    Last generated:{" "}
                    {toLocale(
                      executiveWeeklyReport?.generatedAt ||
                        dashboardGeneratedAt,
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-[#334155]">
                    <div>
                      Current users:{" "}
                      <span className="font-semibold">
                        {executiveWeeklyReport?.currentUsers ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>New users delta</span>
                      <TrendDelta
                        deltaPct={
                          executiveWeeklyReport?.comparisons.newUsers
                            .deltaPct ?? 0
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Lessons completed delta</span>
                      <TrendDelta
                        deltaPct={
                          executiveWeeklyReport?.comparisons.lessonsCompleted
                            .deltaPct ?? 0
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Quiz attempts delta</span>
                      <TrendDelta
                        deltaPct={
                          executiveWeeklyReport?.comparisons.quizAttempts
                            .deltaPct ?? 0
                        }
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={baseButton}
                      onClick={downloadWeeklyExecutiveJson}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Download className="h-4 w-4" /> JSON
                      </span>
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f8fafc]"
                      onClick={downloadWeeklyExecutiveCsv}
                    >
                      CSV
                    </button>
                  </div>
                </article>

                <article className="rounded-lg border border-[#e2e8f0] bg-white p-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-[#64748b]">
                    Deletion Lifecycle
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#0f172a]">
                    Deletion pipeline health
                  </div>
                  <div className="mt-1 text-[11px] text-[#475569]">
                    Why it matters: deletion SLA posture.
                  </div>
                  <div className="mt-1 text-[11px] text-[#94a3b8]">
                    Last generated:{" "}
                    {toLocale(
                      deletionLifecycleReport?.generatedAt ||
                        dashboardGeneratedAt,
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-[#334155]">
                    <div>
                      Open requests:{" "}
                      <span className="font-semibold">
                        {deletionLifecycleReport?.openRequests ?? 0}
                      </span>
                    </div>
                    <div>
                      Aged open (&gt;7d):{" "}
                      <span className="font-semibold">
                        {deletionLifecycleReport?.agedOpenRequestsOver7d ?? 0}
                      </span>
                    </div>
                    <div>
                      Avg resolution:{" "}
                      <span className="font-semibold">
                        {deletionLifecycleReport?.avgResolutionHours ?? 0}h
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={baseButton}
                      onClick={downloadDeletionLifecycleJson}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Download className="h-4 w-4" /> JSON
                      </span>
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f8fafc]"
                      onClick={downloadDeletionLifecycleCsv}
                    >
                      CSV
                    </button>
                  </div>
                </article>

                <article className="rounded-lg border border-[#e2e8f0] bg-white p-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-[#64748b]">
                    Security Incidents
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#0f172a]">
                    Security event trend digest
                  </div>
                  <div className="mt-1 text-[11px] text-[#475569]">
                    Why it matters: incident tracking.
                  </div>
                  <div className="mt-1 text-[11px] text-[#94a3b8]">
                    Last generated:{" "}
                    {toLocale(
                      securityIncidentReport?.generatedAt ||
                        dashboardGeneratedAt,
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-[#334155]">
                    <div>
                      Unauthorized admin attempts (route + login):{" "}
                      <span className="font-semibold">
                        {securityIncidentReport?.summary
                          .unauthorizedAdminAttempts ?? 0}
                      </span>
                    </div>
                    <div>
                      Auth errors:{" "}
                      <span className="font-semibold">
                        {securityIncidentReport?.summary.authErrors ?? 0}
                      </span>
                    </div>
                    <div>
                      Session revocations:{" "}
                      <span className="font-semibold">
                        {securityIncidentReport?.summary.sessionRevocations ??
                          0}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={baseButton}
                      onClick={downloadSecurityIncidentJson}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Download className="h-4 w-4" /> JSON
                      </span>
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f8fafc]"
                      onClick={downloadSecurityIncidentCsv}
                    >
                      CSV
                    </button>
                  </div>
                </article>

                <article className="rounded-lg border border-[#e2e8f0] bg-white p-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-[#64748b]">
                    Learning Momentum
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#0f172a]">
                    Daily activity and streak momentum
                  </div>
                  <div className="mt-1 text-[11px] text-[#475569]">
                    Why it matters: engagement stability.
                  </div>
                  <div className="mt-1 text-[11px] text-[#94a3b8]">
                    Last generated:{" "}
                    {toLocale(
                      learningMomentumReport?.generatedAt ||
                        dashboardGeneratedAt,
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-[#334155]">
                    <div>
                      Avg daily practice:{" "}
                      <span className="font-semibold">
                        {learningMomentumReport?.summary
                          .averageDailyPracticeMinutes ?? 0}{" "}
                        min
                      </span>
                    </div>
                    <div>
                      Active learners today:{" "}
                      <span className="font-semibold">
                        {learningMomentumReport?.summary.activeLearnersToday ??
                          0}
                      </span>
                    </div>
                    <div>
                      Lessons started today:{" "}
                      <span className="font-semibold">
                        {learningMomentumReport?.summary.lessonsStartedToday ??
                          0}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={baseButton}
                      onClick={downloadLearningMomentumJson}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Download className="h-4 w-4" /> JSON
                      </span>
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f8fafc]"
                      onClick={downloadLearningMomentumCsv}
                    >
                      CSV
                    </button>
                  </div>
                </article>

                <article className="rounded-lg border border-[#e2e8f0] bg-white p-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-[#64748b]">
                    Activation Funnel
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#0f172a]">
                    Signup to first value and day-7 return
                  </div>
                  <div className="mt-1 text-[11px] text-[#475569]">
                    Why it matters: funnel quality.
                  </div>
                  <div className="mt-1 text-[11px] text-[#94a3b8]">
                    Last generated:{" "}
                    {toLocale(
                      activationFunnelReport?.generatedAt ||
                        dashboardGeneratedAt,
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-[#334155]">
                    <div>
                      Signups:{" "}
                      <span className="font-semibold">
                        {activationFunnelReport?.funnel.signups ?? 0}
                      </span>
                    </div>
                    <div>
                      First lesson:{" "}
                      <span className="font-semibold">
                        {activationFunnelReport?.conversionPct
                          .signupToFirstLesson ?? 0}
                        %
                      </span>
                    </div>
                    <div>
                      Day-7 return:{" "}
                      <span className="font-semibold">
                        {activationFunnelReport?.conversionPct
                          .signupToDay7Return ?? 0}
                        %
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={baseButton}
                      onClick={downloadActivationFunnelJson}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Download className="h-4 w-4" /> JSON
                      </span>
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f8fafc]"
                      onClick={downloadActivationFunnelCsv}
                    >
                      CSV
                    </button>
                  </div>
                </article>

                <article className="rounded-lg border border-[#e2e8f0] bg-white p-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-[#64748b]">
                    Storage Budget
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#0f172a]">
                    Database capacity tracking
                  </div>
                  <div className="mt-1 text-[11px] text-[#475569]">
                    Why it matters: storage/cost risk.
                  </div>
                  <div className="mt-1 text-[11px] text-[#94a3b8]">
                    Last generated:{" "}
                    {toLocale(
                      storageBudgetReport?.generatedAt || dashboardGeneratedAt,
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-[#334155]">
                    <div>
                      Used:{" "}
                      <span className="font-semibold">
                        {storageBudgetReport?.budget.usedPct ?? 0}%
                      </span>
                    </div>
                    <div>
                      DB size:{" "}
                      <span className="font-semibold">
                        {storageBudgetReport?.budget.databaseSizeMb ?? 0} MB
                      </span>
                    </div>
                    <div>
                      Status:{" "}
                      <span className="font-semibold">
                        {storageBudgetReport?.budget.status ?? "unknown"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={baseButton}
                      onClick={downloadStorageBudgetJson}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Download className="h-4 w-4" /> JSON
                      </span>
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f8fafc]"
                      onClick={downloadStorageBudgetCsv}
                    >
                      CSV
                    </button>
                  </div>
                </article>

                <article className="rounded-lg border border-[#e2e8f0] bg-white p-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-[#64748b]">
                    DB Guardrails
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#0f172a]">
                    Index + growth + dead-row health
                  </div>
                  <div className="mt-1 text-[11px] text-[#475569]">
                    Why it matters: DB/reporting health.
                  </div>
                  <div className="mt-1 text-[11px] text-[#94a3b8]">
                    Last generated:{" "}
                    {toLocale(
                      dbGuardrailsReport?.generatedAt || dashboardGeneratedAt,
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-[#334155]">
                    <div>
                      Index checks passing:{" "}
                      <span className="font-semibold">
                        {
                          (dbGuardrailsReport?.indexChecks || []).filter(
                            (item) => item.passed,
                          ).length
                        }
                        /{dbGuardrailsReport?.indexChecks.length ?? 0}
                      </span>
                    </div>
                    <div>
                      Quiz attempts ({metricsWindowDays}d):{" "}
                      <span className="font-semibold">
                        {dbGuardrailsReport?.growth.quizAttempts ?? 0}
                      </span>
                    </div>
                    <div>
                      Speak attempts ({metricsWindowDays}d):{" "}
                      <span className="font-semibold">
                        {dbGuardrailsReport?.growth.speakAttempts ?? 0}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={baseButton}
                      onClick={downloadDbGuardrailsJson}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Download className="h-4 w-4" /> JSON
                      </span>
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f8fafc]"
                      onClick={downloadDbGuardrailsCsv}
                    >
                      CSV
                    </button>
                  </div>
                </article>

                <article className="rounded-lg border border-[#e2e8f0] bg-white p-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-[#64748b]">
                    Production Readiness
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#0f172a]">
                    Release, staging, backup, rollback posture
                  </div>
                  <div className="mt-1 text-[11px] text-[#475569]">
                    Why it matters: release readiness.
                  </div>
                  <div className="mt-1 text-[11px] text-[#94a3b8]">
                    Last generated:{" "}
                    {toLocale(
                      prodReadinessReport?.generatedAt || dashboardGeneratedAt,
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-[#334155]">
                    <div>
                      CI workflow:{" "}
                      <span className="font-semibold">
                        {prodReadinessReport?.checks.ciWorkflowPresent
                          ? "yes"
                          : "no"}
                      </span>
                    </div>
                    <div>
                      Staging configured:{" "}
                      <span className="font-semibold">
                        {prodReadinessReport?.checks.stagingConfigured
                          ? "yes"
                          : "no"}
                      </span>
                    </div>
                    <div>
                      Backup fresh:{" "}
                      <span className="font-semibold">
                        {prodReadinessReport?.checks.backupFresh ? "yes" : "no"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={baseButton}
                      onClick={downloadProdReadinessJson}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Download className="h-4 w-4" /> JSON
                      </span>
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f8fafc]"
                      onClick={downloadProdReadinessCsv}
                    >
                      CSV
                    </button>
                  </div>
                </article>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-[#e2e8f0] p-3">
              <h3 className="text-sm font-semibold text-[#0f172a]">
                Your Admin Timeline
              </h3>
              <p className="mt-1 text-xs text-[#64748b]">
                Admin tasks only. Last 24 hours.
              </p>
              {adminTimelineLoading && (
                <p className="mt-2 text-sm text-[#475569]">Loading timeline…</p>
              )}
              {adminTimelineError && (
                <p className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                  {adminTimelineError}
                </p>
              )}
              {!adminTimelineLoading &&
                !adminTimelineError &&
                adminTimeline.length === 0 && (
                  <p className="mt-2 text-sm text-[#64748b]">
                    No timeline events yet.
                  </p>
                )}
              {!adminTimelineLoading &&
                !adminTimelineError &&
                adminTimeline.length > 0 && (
                  <div className="mt-3 max-h-[36vh] space-y-2 overflow-auto pr-1">
                    {adminTimeline.map((entry, index) => (
                      <article
                        key={`${entry.createdAt}-${entry.source}-${index}`}
                        className="rounded-lg border border-[#e2e8f0] p-2"
                      >
                        <div className="text-xs uppercase tracking-[0.14em] text-[#64748b]">
                          {entry.source} | {toLocale(entry.createdAt)}
                        </div>
                        <div className="text-sm font-semibold text-[#0f172a]">
                          {entry.title}
                        </div>
                        {entry.detail && (
                          <div className="text-sm text-[#334155]">
                            {entry.detail}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
            </div>
          </section>
        )}

        {viewMode === "metrics-support" && (
          <section className="rounded-2xl border border-[#1f2937]/20 bg-white/95 p-4">
            <h2 className="text-lg font-semibold text-[#0f172a]">
              Support Metrics (Last {metricsWindowDays} Days)
            </h2>
            <p className="mt-1 text-sm text-[#475569]">
              Broad overview of account access, security, and support workload.
            </p>
            <p className="mt-1 text-xs text-[#64748b]">
              Use the same time window across pages for consistent metric
              interpretation.
            </p>
            <div className="mt-3 inline-flex rounded-xl border border-[#d1d5db] bg-white p-1">
              {metricsWindowOptions.map(({ days, label }) => (
                <button
                  key={`support-window-${days}`}
                  type="button"
                  onClick={() => setMetricsWindowDays(days)}
                  className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                    metricsWindowDays === days
                      ? "bg-[#1f2937] text-white"
                      : "text-[#334155]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {metricsLoading && (
              <p className="mt-3 text-sm text-[#475569]">Loading metrics…</p>
            )}
            {metricsError && (
              <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                {metricsError}
              </p>
            )}
            {supportMetrics && (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 [&>*:last-child:nth-child(odd)]:col-span-2 [&>*:last-child:nth-child(odd)]:mx-auto [&>*:last-child:nth-child(odd)]:w-full [&>*:last-child:nth-child(odd)]:max-w-md md:[&>*:last-child:nth-child(odd)]:col-span-1 md:[&>*:last-child:nth-child(odd)]:mx-0 md:[&>*:last-child:nth-child(odd)]:max-w-none">
                <div className={metricCard}>
                  <div className="text-xs text-[#64748b]">Password Resets</div>
                  <div className="text-2xl font-semibold text-[#0f172a]">
                    {supportMetrics.support.resetRequests}
                  </div>
                </div>
                <div className={metricCard}>
                  <div className="text-xs text-[#64748b]">
                    Email Verification Required
                  </div>
                  <div className="text-2xl font-semibold text-[#0f172a]">
                    {supportMetrics.support.emailVerificationRequired}
                  </div>
                </div>
                <div className={metricCard}>
                  <div className="text-xs text-[#64748b]">New IP Logins</div>
                  <div className="text-2xl font-semibold text-[#0f172a]">
                    {supportMetrics.support.newIpLogins}
                  </div>
                </div>
                <div className={metricCard}>
                  <div className="text-xs text-[#64748b]">
                    New Device Logins
                  </div>
                  <div className="text-2xl font-semibold text-[#0f172a]">
                    {supportMetrics.support.newDeviceLogins}
                  </div>
                </div>
                <div className={metricCard}>
                  <div className="text-xs text-[#64748b]">
                    Session Revocations
                  </div>
                  <div className="text-2xl font-semibold text-[#0f172a]">
                    {supportMetrics.support.sessionRevocations}
                  </div>
                </div>
                <div className={metricCard}>
                  <div className="text-xs text-[#64748b]">
                    Note Creation Failures
                  </div>
                  <div className="text-2xl font-semibold text-[#0f172a]">
                    {supportMetrics.support.supportNoteCreateFailures}
                  </div>
                </div>
              </div>
            )}
            {supportMetrics && (
              <div className="mt-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
                <h3 className="text-sm font-semibold text-[#0f172a]">
                  Incident Risk Snapshot
                </h3>
                <p className="mt-1 text-xs text-[#64748b]">
                  Each bar is normalized to a practical threshold for this
                  selected window.
                </p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {[
                    {
                      label: "Unauthorized Admin Attempts (Route + Login)",
                      value: supportMetrics.support.unauthorizedAdminAttempts,
                      thresholdPer7d: 2,
                    },
                    {
                      label: "Failed Logins",
                      value: supportMetrics.support.failedLogins,
                      thresholdPer7d: 30,
                    },
                    {
                      label: "New IP Logins",
                      value: supportMetrics.support.newIpLogins,
                      thresholdPer7d: 40,
                    },
                    {
                      label: "Session Revocations",
                      value: supportMetrics.support.sessionRevocations,
                      thresholdPer7d: 20,
                    },
                  ].map((item) => {
                    const scaledThreshold = Math.max(
                      1,
                      Math.round(item.thresholdPer7d * (metricsWindowDays / 7)),
                    );
                    const ratio = item.value / scaledThreshold;
                    const widthPct = Math.min(100, Math.round(ratio * 100));
                    const styles = riskStyles(ratio);
                    return (
                      <div
                        key={item.label}
                        className="rounded-lg border border-[#e2e8f0] bg-white p-2"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-[#334155]">
                          <span>{item.label}</span>
                          <span className={`font-semibold ${styles.tone}`}>
                            {item.value} / {scaledThreshold} ({styles.label})
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-[#e2e8f0]">
                          <div
                            className={`h-2 rounded-full ${styles.bar}`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {supportMetrics && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <article className="rounded-xl border border-[#e2e8f0] p-3">
                  <h3 className="text-sm font-semibold text-[#0f172a]">
                    Auth Error Frequency By Type
                  </h3>
                  <p className="mt-1 text-xs text-[#64748b]">
                    Total auth errors:{" "}
                    <span className="font-semibold text-[#0f172a]">
                      {supportMetrics.support.totalAuthErrorEvents ?? 0}
                    </span>{" "}
                    | Active users:{" "}
                    <span className="font-semibold text-[#0f172a]">
                      {supportMetrics.support.activeUsers}
                    </span>
                  </p>
                  <div className="mt-2 space-y-2">
                    {(supportMetrics.support.authErrorBreakdown || [])
                      .length === 0 && (
                      <div className="text-sm text-[#64748b]">
                        No auth errors recorded.
                      </div>
                    )}
                    {(supportMetrics.support.authErrorBreakdown || []).map(
                      (item) => {
                        const totalAuthErrors = Math.max(
                          0,
                          supportMetrics.support.totalAuthErrorEvents ?? 0,
                        );
                        const sharePct =
                          totalAuthErrors > 0
                            ? Number(
                                ((item.count / totalAuthErrors) * 100).toFixed(
                                  1,
                                ),
                              )
                            : 0;
                        const perDay = Number(
                          (item.count / Math.max(1, metricsWindowDays)).toFixed(
                            2,
                          ),
                        );
                        const ratePer100Active =
                          supportMetrics.support.activeUsers > 0
                            ? Number(
                                (
                                  (item.count /
                                    supportMetrics.support.activeUsers) *
                                  100
                                ).toFixed(2),
                              )
                            : 0;
                        return (
                          <div
                            key={item.eventType}
                            className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 text-sm font-medium text-[#0f172a] truncate">
                                {item.eventType}
                              </div>
                              <div className="text-sm font-semibold text-[#0f172a]">
                                {item.count}
                              </div>
                            </div>
                            <div className="mt-1 text-xs text-[#64748b]">
                              {sharePct}% of auth errors | {perDay}/day |{" "}
                              {ratePer100Active} per 100 active users
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </article>
                <article className="rounded-xl border border-[#e2e8f0] p-3">
                  <h3 className="text-sm font-semibold text-[#0f172a]">
                    Auth/API Failures By Endpoint
                  </h3>
                  <p className="mt-1 text-xs text-[#64748b]">
                    Total auth errors:{" "}
                    <span className="font-semibold text-[#0f172a]">
                      {supportMetrics.support.totalAuthErrorEvents ?? 0}
                    </span>{" "}
                    | Total security events:{" "}
                    <span className="font-semibold text-[#0f172a]">
                      {supportMetrics.support.totalSecurityEvents ?? 0}
                    </span>
                  </p>
                  <div className="mt-2 space-y-2">
                    {(supportMetrics.support.authFailureByEndpoint || [])
                      .length === 0 && (
                      <div className="text-sm text-[#64748b]">
                        No endpoint failures recorded.
                      </div>
                    )}
                    {(supportMetrics.support.authFailureByEndpoint || []).map(
                      (item) => {
                        const totalAuthErrors = Math.max(
                          0,
                          supportMetrics.support.totalAuthErrorEvents ?? 0,
                        );
                        const totalSecurityEvents = Math.max(
                          0,
                          supportMetrics.support.totalSecurityEvents ?? 0,
                        );
                        const shareOfAuthPct =
                          totalAuthErrors > 0
                            ? Number(
                                ((item.count / totalAuthErrors) * 100).toFixed(
                                  1,
                                ),
                              )
                            : 0;
                        const shareOfSecurityPct =
                          totalSecurityEvents > 0
                            ? Number(
                                (
                                  (item.count / totalSecurityEvents) *
                                  100
                                ).toFixed(1),
                              )
                            : 0;
                        const perDay = Number(
                          (item.count / Math.max(1, metricsWindowDays)).toFixed(
                            2,
                          ),
                        );
                        return (
                          <div
                            key={item.endpoint}
                            className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 text-sm font-medium text-[#0f172a] truncate">
                                {item.endpoint}
                              </div>
                              <div className="text-sm font-semibold text-[#0f172a]">
                                {item.count}
                              </div>
                            </div>
                            <div className="mt-1 text-xs text-[#64748b]">
                              {shareOfAuthPct}% of auth errors |{" "}
                              {shareOfSecurityPct}% of security events |{" "}
                              {perDay}/day
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </article>
              </div>
            )}
            <div className="mt-4 rounded-xl border border-[#e2e8f0] p-3">
              <h3 className="text-sm font-semibold text-[#0f172a]">
                Deletion Cases
              </h3>
              <div className="mt-2 flex gap-2">
                <input
                  className={baseInput}
                  value={deletionCaseSearch}
                  onChange={(event) =>
                    setDeletionCaseSearch(event.target.value)
                  }
                  placeholder="Search by email, name, or user id"
                />
                <button
                  type="button"
                  className={baseButton}
                  onClick={() => void loadDeletionCases()}
                  disabled={deletionCasesLoading}
                >
                  {deletionCasesLoading ? "..." : "Find"}
                </button>
              </div>
              {deletionCasesError && (
                <p className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                  {deletionCasesError}
                </p>
              )}
              {!deletionCasesError &&
                deletionCases.length === 0 &&
                !deletionCasesLoading && (
                  <p className="mt-2 text-sm text-[#64748b]">
                    No deletion cases found.
                  </p>
                )}
              <div className="mt-2 max-h-[26vh] space-y-2 overflow-auto pr-1">
                {deletionCases.map((entry, index) => (
                  <article
                    key={`${entry.sourceType}-${entry.targetUserId}-${entry.eventAt}-${index}`}
                    className="rounded-lg border border-[#e2e8f0] p-2"
                  >
                    <div className="text-xs uppercase tracking-[0.14em] text-[#64748b]">
                      {entry.sourceType} | {entry.status} |{" "}
                      {toLocale(entry.eventAt)}
                    </div>
                    <div className="text-sm font-semibold text-[#0f172a]">
                      {entry.targetDisplayName ||
                        entry.targetEmail ||
                        entry.targetUserId}
                    </div>
                    <div className="text-xs text-[#64748b]">
                      {entry.targetEmail || "No email"}
                    </div>
                    <div className="mt-1 text-xs text-[#334155]">
                      {entry.reason}
                    </div>
                    {entry.detail && (
                      <div className="text-xs text-[#64748b]">
                        Detail: {entry.detail}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {viewMode === "metrics-learning" && (
          <section className="rounded-2xl border border-[#1f2937]/20 bg-white/95 p-4">
            <h2 className="text-lg font-semibold text-[#0f172a]">
              Learning Metrics (Last {metricsWindowDays} Days)
            </h2>
            <p className="mt-1 text-sm text-[#475569]">
              Broad overview of learning performance and progression quality.
            </p>
            <p className="mt-1 text-xs text-[#64748b]">
              Definitions: finished = reached the Lesson Complete screen.
              abandoned = started but never reached Lesson Complete.
            </p>
            <div className="mt-3 inline-flex rounded-xl border border-[#d1d5db] bg-white p-1">
              {metricsWindowOptions.map(({ days, label }) => (
                <button
                  key={`learning-window-${days}`}
                  type="button"
                  onClick={() => setMetricsWindowDays(days)}
                  className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                    metricsWindowDays === days
                      ? "bg-[#1f2937] text-white"
                      : "text-[#334155]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {metricsLoading && (
              <p className="mt-3 text-sm text-[#475569]">Loading metrics…</p>
            )}
            {metricsError && (
              <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                {metricsError}
              </p>
            )}
            {learningMetrics && (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 [&>*:last-child:nth-child(odd)]:col-span-2 [&>*:last-child:nth-child(odd)]:mx-auto [&>*:last-child:nth-child(odd)]:w-full [&>*:last-child:nth-child(odd)]:max-w-md md:[&>*:last-child:nth-child(odd)]:col-span-1 md:[&>*:last-child:nth-child(odd)]:mx-0 md:[&>*:last-child:nth-child(odd)]:max-w-none">
                  <div className={metricCard}>
                    <div className="text-xs text-[#64748b]">Quiz Attempts</div>
                    <div className="text-2xl font-semibold text-[#0f172a]">
                      {learningMetrics.learning.quizAttempts}
                    </div>
                    <div className="text-xs text-[#64748b]">
                      Accuracy {learningMetrics.learning.quizAccuracyPct}%
                    </div>
                  </div>
                  <div className={metricCard}>
                    <div className="text-xs text-[#64748b]">Speak Attempts</div>
                    <div className="text-2xl font-semibold text-[#0f172a]">
                      {learningMetrics.learning.speakAttempts}
                    </div>
                    <div className="text-xs text-[#64748b]">
                      Speak Pass Rate {learningMetrics.learning.speakPassPct}%
                    </div>
                  </div>
                  <div className={metricCard}>
                    <div className="text-xs text-[#64748b]">Lesson Opens</div>
                    <div className="text-2xl font-semibold text-[#0f172a]">
                      {learningMetrics.learning.lessonStarts}
                    </div>
                  </div>
                  <div className={metricCard}>
                    <div className="text-xs text-[#64748b]">
                      Lesson Entry Events
                    </div>
                    <div className="text-2xl font-semibold text-[#0f172a]">
                      {learningMetrics.learning.lessonStartsTracked ?? 0}
                    </div>
                  </div>
                  <div className={metricCard}>
                    <div className="text-xs text-[#64748b]">
                      Lessons Finished (Complete Screen)
                    </div>
                    <div className="text-2xl font-semibold text-[#0f172a]">
                      {learningMetrics.learning.lessonCompleted}
                    </div>
                  </div>
                  <div className={metricCard}>
                    <div className="text-xs text-[#64748b]">
                      Lessons Abandoned
                    </div>
                    <div className="text-2xl font-semibold text-[#0f172a]">
                      {learningMetrics.learning.lessonAbandons}
                    </div>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
                  <details open>
                    <summary className="cursor-pointer list-none">
                      <h3 className="text-sm font-semibold text-[#0f172a]">
                        Raw Pipeline Check
                      </h3>
                    </summary>
                    <p className="mt-1 text-xs text-[#64748b]">
                      Use these counters to verify data ingestion in production.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg border border-[#dbe3ee] bg-white p-2">
                        <div className="text-[11px] uppercase tracking-[0.12em] text-[#64748b]">
                          tracked_starts
                        </div>
                        <div className="mt-1 text-xl font-semibold text-[#0f172a]">
                          {learningMetrics.learning.lessonStartsTracked ?? 0}
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#dbe3ee] bg-white p-2">
                        <div className="text-[11px] uppercase tracking-[0.12em] text-[#64748b]">
                          inferred_starts
                        </div>
                        <div className="mt-1 text-xl font-semibold text-[#0f172a]">
                          {learningMetrics.learning.lessonStartsInferred ?? 0}
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#dbe3ee] bg-white p-2">
                        <div className="text-[11px] uppercase tracking-[0.12em] text-[#64748b]">
                          completed
                        </div>
                        <div className="mt-1 text-xl font-semibold text-[#0f172a]">
                          {learningMetrics.learning.lessonCompleted}
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#dbe3ee] bg-white p-2">
                        <div className="text-[11px] uppercase tracking-[0.12em] text-[#64748b]">
                          effective_starts
                        </div>
                        <div className="mt-1 text-xl font-semibold text-[#0f172a]">
                          {learningMetrics.learning.lessonStarts}
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              </>
            )}

            {weakWordsByLanguage && (
              <div className="mt-5 rounded-xl border border-[#e2e8f0] p-3">
                <details open>
                  <summary className="cursor-pointer list-none">
                    <h3 className="text-sm font-semibold text-[#0f172a]">
                      Most Missed Quiz Words By Language
                    </h3>
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {weakWordsByLanguage.languages.map((bucket) => (
                      <article
                        key={bucket.languageId}
                        className={`rounded-lg border p-3 ${
                          bucket.hasData
                            ? "border-[#dbe7ff] bg-[#f8fbff]"
                            : "border-[#e2e8f0] bg-[#f1f5f9] text-[#94a3b8]"
                        }`}
                      >
                        <div className="text-xs uppercase tracking-[0.16em]">
                          {bucket.languageId}
                        </div>
                        {!bucket.hasData && (
                          <div className="mt-2 text-sm">No data yet</div>
                        )}
                        {bucket.hasData && (
                          <div className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1 text-sm">
                            {bucket.words.map((word) => {
                              const labels = resolveMetricWordLabels(word);
                              return (
                                <div
                                  key={`${bucket.languageId}-${word.wordId}`}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate font-semibold text-[#0f172a]">
                                      {labels.native}
                                    </div>
                                    <div className="truncate text-[#475569]">
                                      {labels.english}
                                    </div>
                                  </div>
                                  <span className="font-semibold">
                                    {word.misses}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </details>
              </div>
            )}
            {weakSpeakWordsByLanguage && (
              <div className="mt-5 rounded-xl border border-[#e2e8f0] p-3">
                <details open>
                  <summary className="cursor-pointer list-none">
                    <h3 className="text-sm font-semibold text-[#0f172a]">
                      Most Missed Speak Words By Language
                    </h3>
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {weakSpeakWordsByLanguage.languages.map((bucket) => (
                      <article
                        key={`speak-${bucket.languageId}`}
                        className={`rounded-lg border p-3 ${
                          bucket.hasData
                            ? "border-[#dbe7ff] bg-[#f8fbff]"
                            : "border-[#e2e8f0] bg-[#f1f5f9] text-[#94a3b8]"
                        }`}
                      >
                        <div className="text-xs uppercase tracking-[0.16em]">
                          {bucket.languageId}
                        </div>
                        {!bucket.hasData && (
                          <div className="mt-2 text-sm">No data yet</div>
                        )}
                        {bucket.hasData && (
                          <div className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1 text-sm">
                            {bucket.words.map((word) => {
                              const labels = resolveMetricWordLabels(word);
                              return (
                                <div
                                  key={`speak-${bucket.languageId}-${word.wordId}`}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate font-semibold text-[#0f172a]">
                                      {labels.native}
                                    </div>
                                    <div className="truncate text-[#475569]">
                                      {labels.english}
                                    </div>
                                  </div>
                                  <span className="font-semibold">
                                    {word.misses}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </section>
        )}

        {viewMode === "metrics-impact" && (
          <section className="rounded-2xl border border-[#1f2937]/20 bg-white/95 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#0f172a]">
                  Impact & Outcomes (Last {metricsWindowDays} Days)
                </h2>
                <p className="mt-1 text-sm text-[#475569]">
                  Grant-ready retention and learning outcomes across cohorts,
                  behavior consistency, and mastery depth.
                </p>
                <p className="mt-1 text-xs text-[#64748b]">
                  Scope: aggregate metrics across all active users in the
                  selected time window.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl border border-[#d1d5db] bg-white p-1">
                  {metricsWindowOptions.map(({ days, label }) => (
                    <button
                      key={`impact-window-${days}`}
                      type="button"
                      onClick={() => setMetricsWindowDays(days)}
                      className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                        metricsWindowDays === days
                          ? "bg-[#1f2937] text-white"
                          : "text-[#334155]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={baseButton}
                  onClick={() =>
                    void loadImpactOutcomesMetrics(metricsWindowDays)
                  }
                >
                  Refresh
                </button>
                <button
                  type="button"
                  className={baseButton}
                  onClick={downloadImpactOutcomesJson}
                >
                  <span className="inline-flex items-center gap-1">
                    <Download className="h-4 w-4" /> JSON
                  </span>
                </button>
                <button
                  type="button"
                  className={baseButton}
                  onClick={downloadImpactOutcomesCsv}
                >
                  <span className="inline-flex items-center gap-1">
                    <Download className="h-4 w-4" /> CSV
                  </span>
                </button>
                <button
                  type="button"
                  className={baseButton}
                  onClick={() => void downloadImpactOutcomesPdf()}
                >
                  <span className="inline-flex items-center gap-1">
                    <Download className="h-4 w-4" /> PDF
                  </span>
                </button>
              </div>
            </div>
            {metricsLoading && (
              <p className="mt-3 text-sm text-[#475569]">Loading metrics…</p>
            )}
            {metricsError && (
              <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                {metricsError}
              </p>
            )}
            {impactOutcomesMetrics && (
              <>
                {impactOutcomesMetrics.warning && (
                  <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800">
                    {impactOutcomesMetrics.warning}
                  </p>
                )}
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 [&>*:last-child:nth-child(odd)]:col-span-2 [&>*:last-child:nth-child(odd)]:mx-auto [&>*:last-child:nth-child(odd)]:w-full [&>*:last-child:nth-child(odd)]:max-w-md md:[&>*:last-child:nth-child(odd)]:col-span-1 md:[&>*:last-child:nth-child(odd)]:mx-0 md:[&>*:last-child:nth-child(odd)]:max-w-none">
                  <article className={metricCard}>
                    <div className="text-xs text-[#64748b]">
                      Weighted D7 Retention
                    </div>
                    <div className="text-2xl font-semibold text-[#0f172a]">
                      {impactRetentionSummary.d7Pct}%
                    </div>
                  </article>
                  <article className={metricCard}>
                    <div className="text-xs text-[#64748b]">
                      Weighted D30 Retention
                    </div>
                    <div className="text-2xl font-semibold text-[#0f172a]">
                      {impactRetentionSummary.d30Pct}%
                    </div>
                  </article>
                  <article className={metricCard}>
                    <div className="text-xs text-[#64748b]">
                      Median Days To First Lesson Complete
                    </div>
                    <div className="text-2xl font-semibold text-[#0f172a]">
                      {impactOutcomesMetrics.timeToValue
                        .medianDaysToLessonComplete ?? "n/a"}
                    </div>
                  </article>
                  <article className={metricCard}>
                    <div className="text-xs text-[#64748b]">
                      Mastery Rate (Active Users)
                    </div>
                    <div className="text-2xl font-semibold text-[#0f172a]">
                      {impactOutcomesMetrics.mastery.masteryRatePct}%
                    </div>
                  </article>
                  <article className={metricCard}>
                    <div className="text-xs text-[#64748b]">
                      Needs Review Events / 100 Completions
                    </div>
                    <div className="text-2xl font-semibold text-[#0f172a]">
                      {
                        impactOutcomesMetrics.needsReview
                          .needsReviewEventsPer100Completions
                      }
                    </div>
                  </article>
                </div>

                <div className="mt-4 rounded-xl border border-[#e2e8f0] p-3">
                  <h3 className="text-sm font-semibold text-[#0f172a]">
                    Cohort Retention
                  </h3>
                  <p className="mt-1 text-xs text-[#64748b]">
                    {impactOutcomesMetrics.definitions.cohorts}
                  </p>
                  <div className="mt-3 overflow-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-[0.08em] text-[#64748b]">
                        <tr>
                          <th className="px-2 py-2">Cohort Week</th>
                          <th className="px-2 py-2">Signups</th>
                          <th className="px-2 py-2">D1</th>
                          <th className="px-2 py-2">D7</th>
                          <th className="px-2 py-2">D30</th>
                        </tr>
                      </thead>
                      <tbody>
                        {impactOutcomesMetrics.cohorts.map((cohort) => (
                          <tr
                            key={cohort.cohortWeek}
                            className="border-t border-[#e2e8f0]"
                          >
                            <td className="px-2 py-2 font-medium text-[#0f172a]">
                              {cohort.cohortWeek}
                            </td>
                            <td className="px-2 py-2 text-[#334155]">
                              {cohort.signups}
                            </td>
                            <td className="px-2 py-2 text-[#334155]">
                              {cohort.d1Pct}% ({cohort.retainedD1}/
                              {cohort.eligibleD1})
                            </td>
                            <td className="px-2 py-2 text-[#334155]">
                              {cohort.d7Pct}% ({cohort.retainedD7}/
                              {cohort.eligibleD7})
                            </td>
                            <td className="px-2 py-2 text-[#334155]">
                              {cohort.d30Pct}% ({cohort.retainedD30}/
                              {cohort.eligibleD30})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <article className="rounded-xl border border-[#e2e8f0] p-3">
                    <h3 className="text-sm font-semibold text-[#0f172a]">
                      Time To Value
                    </h3>
                    <p className="mt-1 text-xs text-[#64748b]">
                      {impactOutcomesMetrics.definitions.timeToValue}
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-[#334155]">
                      <div>
                        Sample size:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {impactOutcomesMetrics.timeToValue.sampleSize}
                        </span>
                      </div>
                      <div>
                        Reached lesson complete:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {
                            impactOutcomesMetrics.timeToValue
                              .reachedLessonComplete
                          }
                        </span>
                      </div>
                      <div>
                        Reached speak pass:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {impactOutcomesMetrics.timeToValue.reachedSpeakPass}
                        </span>
                      </div>
                      <div>
                        Reached mastery:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {impactOutcomesMetrics.timeToValue.reachedMastery}
                        </span>
                      </div>
                      <div>
                        Median days to lesson complete:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {impactOutcomesMetrics.timeToValue
                            .medianDaysToLessonComplete ?? "n/a"}
                        </span>
                      </div>
                      <div>
                        Median days to speak pass:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {impactOutcomesMetrics.timeToValue
                            .medianDaysToSpeakPass ?? "n/a"}
                        </span>
                      </div>
                      <div>
                        Median days to mastery:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {impactOutcomesMetrics.timeToValue
                            .medianDaysToMastery ?? "n/a"}
                        </span>
                      </div>
                    </div>
                  </article>
                  <article className="rounded-xl border border-[#e2e8f0] p-3">
                    <h3 className="text-sm font-semibold text-[#0f172a]">
                      Learning Gain (Window Half Comparison)
                    </h3>
                    <p className="mt-1 text-xs text-[#64748b]">
                      {impactOutcomesMetrics.definitions.learningGain}
                    </p>
                    <p className="mt-1 text-xs text-[#64748b]">
                      Session window:{" "}
                      {impactOutcomesMetrics.sessionWindowMinutes ?? 30} minutes
                    </p>
                    <div className="mt-3 grid gap-2 text-sm text-[#334155]">
                      <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-2">
                        <div className="font-semibold text-[#0f172a]">
                          Quiz accuracy
                        </div>
                        <div className="mt-1">
                          Sessions:{" "}
                          {impactOutcomesMetrics.learningGain.firstHalf
                            .quizSessions ?? 0}
                        </div>
                        <div>
                          Session completions:{" "}
                          {
                            impactOutcomesMetrics.learningGain.firstHalf
                              .quizSessionsCompleted
                          ?? 0}
                        </div>
                        <div className="mt-1">
                          First half:{" "}
                          {
                            impactOutcomesMetrics.learningGain.firstHalf
                              .quizAccuracyPct
                          }
                          %
                        </div>
                        <div>
                          Second-half sessions:{" "}
                          {impactOutcomesMetrics.learningGain.secondHalf
                            .quizSessions ?? 0}
                        </div>
                        <div>
                          Second-half session completions:{" "}
                          {
                            impactOutcomesMetrics.learningGain.secondHalf
                              .quizSessionsCompleted
                          ?? 0}
                        </div>
                        <div>
                          Second half:{" "}
                          {
                            impactOutcomesMetrics.learningGain.secondHalf
                              .quizAccuracyPct
                          }
                          %
                        </div>
                        <div className="mt-1">
                          Delta:{" "}
                          <TrendDelta
                            deltaPct={
                              impactOutcomesMetrics.learningGain.deltaPct
                                .quizAccuracyPct
                            }
                          />
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-2">
                        <div className="font-semibold text-[#0f172a]">
                          Speak pass rate
                        </div>
                        <div className="mt-1">
                          Sessions:{" "}
                          {impactOutcomesMetrics.learningGain.firstHalf
                            .speakSessions ?? 0}
                        </div>
                        <div>
                          Session completions:{" "}
                          {
                            impactOutcomesMetrics.learningGain.firstHalf
                              .speakSessionsCompleted
                          ?? 0}
                        </div>
                        <div className="mt-1">
                          First half:{" "}
                          {
                            impactOutcomesMetrics.learningGain.firstHalf
                              .speakPassPct
                          }
                          %
                        </div>
                        <div>
                          Second-half sessions:{" "}
                          {impactOutcomesMetrics.learningGain.secondHalf
                            .speakSessions ?? 0}
                        </div>
                        <div>
                          Second-half session completions:{" "}
                          {
                            impactOutcomesMetrics.learningGain.secondHalf
                              .speakSessionsCompleted
                          ?? 0}
                        </div>
                        <div>
                          Second half:{" "}
                          {
                            impactOutcomesMetrics.learningGain.secondHalf
                              .speakPassPct
                          }
                          %
                        </div>
                        <div className="mt-1">
                          Delta:{" "}
                          <TrendDelta
                            deltaPct={
                              impactOutcomesMetrics.learningGain.deltaPct
                                .speakPassPct
                            }
                          />
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-2">
                        <div className="font-semibold text-[#0f172a]">
                          Lessons per active user
                        </div>
                        <div className="mt-1">
                          First half:{" "}
                          {
                            impactOutcomesMetrics.learningGain.firstHalf
                              .lessonsPerActiveUser
                          }
                        </div>
                        <div>
                          Second half:{" "}
                          {
                            impactOutcomesMetrics.learningGain.secondHalf
                              .lessonsPerActiveUser
                          }
                        </div>
                        <div className="mt-1">
                          Delta:{" "}
                          <TrendDelta
                            deltaPct={
                              impactOutcomesMetrics.learningGain.deltaPct
                                .lessonsPerActiveUser
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <article className="rounded-xl border border-[#e2e8f0] p-3">
                    <h3 className="text-sm font-semibold text-[#0f172a]">
                      Consistency
                    </h3>
                    <p className="mt-1 text-xs text-[#64748b]">
                      {impactOutcomesMetrics.definitions.consistency}
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-[#334155]">
                      <div>
                        Active users:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {impactOutcomesMetrics.consistency.activeUsers}
                        </span>
                      </div>
                      <div>
                        3+ active days:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {impactOutcomesMetrics.consistency.active3PlusDays}
                        </span>
                      </div>
                      <div>
                        7+ active days:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {impactOutcomesMetrics.consistency.active7PlusDays}
                        </span>
                      </div>
                      <div>
                        Average active days:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {impactOutcomesMetrics.consistency.avgActiveDays}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {impactOutcomesMetrics.consistency.streakDistribution.map(
                        (bucket) => {
                          const denominator = Math.max(
                            1,
                            impactOutcomesMetrics.consistency.activeUsers,
                          );
                          const widthPct = Math.round(
                            (bucket.users / denominator) * 100,
                          );
                          return (
                            <div key={bucket.bucket}>
                              <div className="flex items-center justify-between text-xs text-[#475569]">
                                <span>{bucket.bucket} days</span>
                                <span>{bucket.users}</span>
                              </div>
                              <div className="mt-1 h-2 rounded-full bg-[#e2e8f0]">
                                <div
                                  className="h-2 rounded-full bg-[#1f2937]"
                                  style={{ width: `${widthPct}%` }}
                                />
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </article>
                  <article className="rounded-xl border border-[#e2e8f0] p-3">
                    <h3 className="text-sm font-semibold text-[#0f172a]">
                      Mastery & Needs-Work Burden
                    </h3>
                    <p className="mt-1 text-xs text-[#64748b]">
                      {impactOutcomesMetrics.definitions.mastery}
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-[#334155]">
                      <div>
                        Users with mastery:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {impactOutcomesMetrics.mastery.usersWithMastery}
                        </span>
                      </div>
                      <div>
                        Users with mastery in window:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {
                            impactOutcomesMetrics.mastery
                              .usersWithMasteryInWindow
                          }
                        </span>
                      </div>
                      <div>
                        Mastery rate:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {impactOutcomesMetrics.mastery.masteryRatePct}%
                        </span>
                      </div>
                      <div>
                        Median days to first mastery:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {impactOutcomesMetrics.mastery
                            .medianDaysToFirstMastery ?? "n/a"}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-[#64748b]">
                      {impactOutcomesMetrics.definitions.needsWorkBurden}
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-[#334155]">
                      <div>
                        Avg needs-work/user:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {
                            impactOutcomesMetrics.needsWorkBurden
                              .avgNeedsWorkPerActiveUser
                          }
                        </span>
                      </div>
                      <div>
                        Median needs-work/user:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {
                            impactOutcomesMetrics.needsWorkBurden
                              .medianNeedsWorkPerActiveUser
                          }
                        </span>
                      </div>
                      <div>
                        First-half misses/active user:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {
                            impactOutcomesMetrics.needsWorkBurden
                              .firstHalfMissesPerActiveUser
                          }
                        </span>
                      </div>
                      <div>
                        Second-half misses/active user:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {
                            impactOutcomesMetrics.needsWorkBurden
                              .secondHalfMissesPerActiveUser
                          }
                        </span>
                      </div>
                      <div>
                        Burden delta:
                        <span className="ml-1">
                          <MissTrendDelta
                            deltaPct={
                              impactOutcomesMetrics.needsWorkBurden
                                .missesPerActiveUserDeltaPct
                            }
                          />
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-[#64748b]">
                      {impactOutcomesMetrics.definitions.needsReview}
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-[#334155]">
                      <div>
                        Users with needs review:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {
                            impactOutcomesMetrics.needsReview
                              .usersWithNeedsReview
                          }
                        </span>
                      </div>
                      <div>
                        Total needs review events:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {
                            impactOutcomesMetrics.needsReview
                              .totalNeedsReviewEvents
                          }
                        </span>
                      </div>
                      <div>
                        Reset events / 100 completions:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {
                            impactOutcomesMetrics.needsReview
                              .needsReviewEventsPer100Completions
                          }
                        </span>
                      </div>
                      <div>
                        Avg resets/active user:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {
                            impactOutcomesMetrics.needsReview
                              .avgNeedsReviewEventsPerActiveUser
                          }
                        </span>
                      </div>
                      <div>
                        Median resets/active user:{" "}
                        <span className="font-semibold text-[#0f172a]">
                          {
                            impactOutcomesMetrics.needsReview
                              .medianNeedsReviewEventsPerActiveUser
                          }
                        </span>
                      </div>
                      <div>
                        Reset intensity delta:
                        <span className="ml-1">
                          <TrendDelta
                            deltaPct={
                              impactOutcomesMetrics.needsReview
                                .needsReviewEventsPerActiveUserDeltaPct
                            }
                          />
                        </span>
                      </div>
                    </div>
                  </article>
                </div>

                <div className="mt-4 rounded-xl border border-[#e2e8f0] p-3">
                  <h3 className="text-sm font-semibold text-[#0f172a]">
                    Active User Segmentation
                  </h3>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {impactOutcomesMetrics.segmentation.activeUsersByLanguage.map(
                      (row) => (
                        <div
                          key={row.languageId}
                          className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-2"
                        >
                          <div className="text-xs uppercase tracking-[0.12em] text-[#64748b]">
                            {row.languageId}
                          </div>
                          <div className="mt-1 text-xl font-semibold text-[#0f172a]">
                            {row.activeUsers}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-[#e2e8f0] p-3">
                  <h3 className="text-sm font-semibold text-[#0f172a]">
                    Anonymized Per-User Distribution
                  </h3>
                  <p className="mt-1 text-xs text-[#64748b]">
                    {impactOutcomesMetrics.definitions.perUserDistribution ||
                      "Anonymized percentile distribution across active users (no user identifiers)."}
                  </p>
                  <div className="mt-2 text-xs text-[#475569]">
                    Sample size:{" "}
                    <span className="font-semibold text-[#0f172a]">
                      {impactOutcomesMetrics.perUserDistribution?.sampleSize ??
                        0}
                    </span>{" "}
                    active users
                  </div>
                  <div className="mt-3 overflow-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-[0.08em] text-[#64748b]">
                        <tr>
                          <th className="px-2 py-2">Metric</th>
                          <th className="px-2 py-2">Avg</th>
                          <th className="px-2 py-2">P50</th>
                          <th className="px-2 py-2">P75</th>
                          <th className="px-2 py-2">P90</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          {
                            label: "Active Days",
                            row: impactOutcomesMetrics.perUserDistribution
                              ?.metrics?.activeDays ?? {
                              avg: 0,
                              p50: 0,
                              p75: 0,
                              p90: 0,
                            },
                          },
                          {
                            label: "Lessons Completed",
                            row: impactOutcomesMetrics.perUserDistribution
                              ?.metrics?.lessonsCompleted ?? {
                              avg: 0,
                              p50: 0,
                              p75: 0,
                              p90: 0,
                            },
                          },
                          {
                            label: "Quiz Accuracy %",
                            row: impactOutcomesMetrics.perUserDistribution
                              ?.metrics?.quizAccuracyPct ?? {
                              avg: 0,
                              p50: 0,
                              p75: 0,
                              p90: 0,
                            },
                          },
                          {
                            label: "Speak Pass %",
                            row: impactOutcomesMetrics.perUserDistribution
                              ?.metrics?.speakPassPct ?? {
                              avg: 0,
                              p50: 0,
                              p75: 0,
                              p90: 0,
                            },
                          },
                          {
                            label: "Needs-Work Count",
                            row: impactOutcomesMetrics.perUserDistribution
                              ?.metrics?.needsWorkCount ?? {
                              avg: 0,
                              p50: 0,
                              p75: 0,
                              p90: 0,
                            },
                          },
                          {
                            label: "Needs-Review Resets",
                            row: impactOutcomesMetrics.perUserDistribution
                              ?.metrics?.needsReviewResets ?? {
                              avg: 0,
                              p50: 0,
                              p75: 0,
                              p90: 0,
                            },
                          },
                        ].map(({ label, row }) => {
                          return (
                            <tr
                              key={label}
                              className="border-t border-[#e2e8f0]"
                            >
                              <td className="px-2 py-2 font-medium text-[#0f172a]">
                                {label}
                              </td>
                              <td className="px-2 py-2 text-[#334155]">
                                {row.avg}
                              </td>
                              <td className="px-2 py-2 text-[#334155]">
                                {row.p50}
                              </td>
                              <td className="px-2 py-2 text-[#334155]">
                                {row.p75}
                              </td>
                              <td className="px-2 py-2 text-[#334155]">
                                {row.p90}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-[#e2e8f0] p-3">
                  <h3 className="text-sm font-semibold text-[#0f172a]">
                    Top Risk Cohorts (Anonymized)
                  </h3>
                  <p className="mt-1 text-xs text-[#64748b]">
                    {impactOutcomesMetrics.definitions.riskCohorts ||
                      "Anonymized cohorts grouped by language and engagement intensity, ranked by at-risk share."}
                  </p>
                  {(impactOutcomesMetrics.riskCohorts || []).length === 0 ? (
                    <p className="mt-2 text-sm text-[#64748b]">
                      No cohorts met the minimum sample threshold in this
                      window.
                    </p>
                  ) : (
                    <div className="mt-3 overflow-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-xs uppercase tracking-[0.08em] text-[#64748b]">
                          <tr>
                            <th className="px-2 py-2">Cohort</th>
                            <th className="px-2 py-2">Users</th>
                            <th className="px-2 py-2">At-Risk Users</th>
                            <th className="px-2 py-2">At-Risk %</th>
                            <th className="px-2 py-2">Avg Needs-Work</th>
                            <th className="px-2 py-2">Avg Quiz Miss %</th>
                            <th className="px-2 py-2">Avg Speak Miss %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(impactOutcomesMetrics.riskCohorts || []).map(
                            (cohort) => (
                              <tr
                                key={cohort.cohort}
                                className="border-t border-[#e2e8f0]"
                              >
                                <td className="px-2 py-2 font-medium text-[#0f172a]">
                                  {cohort.cohort}
                                </td>
                                <td className="px-2 py-2 text-[#334155]">
                                  {cohort.users}
                                </td>
                                <td className="px-2 py-2 text-[#334155]">
                                  {cohort.atRiskUsers}
                                </td>
                                <td className="px-2 py-2 text-[#334155]">
                                  {cohort.atRiskRatePct}%
                                </td>
                                <td className="px-2 py-2 text-[#334155]">
                                  {cohort.avgNeedsWorkCount}
                                </td>
                                <td className="px-2 py-2 text-[#334155]">
                                  {cohort.avgQuizMissPct}%
                                </td>
                                <td className="px-2 py-2 text-[#334155]">
                                  {cohort.avgSpeakMissPct}%
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {viewMode === "quality-reports" && (
          <section className="rounded-2xl border border-[#1f2937]/20 bg-white/95 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#0f172a]">
                  Quality Reports
                </h2>
                <p className="mt-1 text-sm text-[#475569]">
                  Read-only reports generated from security, stability, and
                  latency checks.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={baseButton}
                  onClick={() => void loadQualityReports()}
                  disabled={
                    qualityReportsLoading ||
                    qualityRunBusy ||
                    qualityCleanupBusy
                  }
                >
                  {qualityReportsLoading ? "Loading…" : "Refresh"}
                </button>
                <button
                  type="button"
                  className={baseButton}
                  onClick={() => void runProdSafeQualityReport()}
                  disabled={qualityRunBusy}
                >
                  <span className="inline-flex items-center gap-1">
                    <Play className="h-4 w-4" />
                    {qualityRunBusy ? "Running…" : "Run Prod-Safe Report"}
                  </span>
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-[#1f2937] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f8fafc] disabled:opacity-50"
                  onClick={() => {
                    setQualityRunFullConfirmOpen((open) => !open);
                    setQualityRunFullConfirmText("");
                  }}
                  disabled={qualityRunBusy}
                >
                  Run Full Suite
                </button>
              </div>
            </div>

            {qualityRunMessage && (
              <p className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-sm text-emerald-700">
                {qualityRunMessage}
              </p>
            )}
            {qualityCleanupMessage && (
              <p className="mt-3 rounded-lg border border-cyan-300 bg-cyan-50 p-2 text-sm text-cyan-700">
                {qualityCleanupMessage}
              </p>
            )}
            {qualityReportsError && (
              <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                {qualityReportsError}
              </p>
            )}
            {qualityRunFullConfirmOpen && (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                <h3 className="text-sm font-semibold text-[#0f172a]">
                  Confirm Full Suite Run
                </h3>
                <p className="mt-1 text-xs text-[#7c2d12]">
                  Full suite can include mutating checks. Type{" "}
                  <span className="font-semibold">RUN_FULL_SUITE</span> (or{" "}
                  <span className="font-semibold">RUN_FULL_SITE</span>) to
                  confirm.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    className={baseInput}
                    value={qualityRunFullConfirmText}
                    onChange={(event) =>
                      setQualityRunFullConfirmText(event.target.value)
                    }
                    placeholder="RUN_FULL_SUITE"
                  />
                  <button
                    type="button"
                    className={baseButton}
                    onClick={() => void runFullQualityReport()}
                    disabled={
                      qualityRunBusy ||
                      !isValidFullSuiteConfirmText(qualityRunFullConfirmText)
                    }
                  >
                    {qualityRunBusy ? "Running…" : "Confirm & Run Full Suite"}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937]"
                    onClick={() => {
                      setQualityRunFullConfirmOpen(false);
                      setQualityRunFullConfirmText("");
                    }}
                    disabled={qualityRunBusy}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 rounded-xl border border-[#e2e8f0] bg-white p-3">
              <h3 className="text-sm font-semibold text-[#0f172a]">
                Report Retention
              </h3>
              <p className="mt-1 text-xs text-[#64748b]">
                Delete older report folders and keep only the most recent runs.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label
                  className="text-xs text-[#475569]"
                  htmlFor="quality-keep-latest"
                >
                  Keep latest
                </label>
                <input
                  id="quality-keep-latest"
                  type="number"
                  min={1}
                  max={200}
                  className="w-28 rounded-xl border border-[#1f2937]/20 bg-white px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-[#1f2937]"
                  value={qualityCleanupKeepLatest}
                  onChange={(event) =>
                    setQualityCleanupKeepLatest(
                      Math.min(
                        200,
                        Math.max(
                          1,
                          Number.parseInt(event.target.value || "30", 10) || 30,
                        ),
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="rounded-xl border border-[#1f2937] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f8fafc] disabled:opacity-50"
                  onClick={() => void cleanupQualityReports()}
                  disabled={qualityCleanupBusy || qualityRunBusy}
                >
                  {qualityCleanupBusy ? "Cleaning…" : "Cleanup Old Reports"}
                </button>
              </div>
            </div>

            <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
              <aside className="min-w-0 rounded-xl border border-[#e2e8f0] bg-white p-3">
                <h3 className="text-sm font-semibold text-[#0f172a]">Runs</h3>
                <div className="mt-2 max-h-[62vh] space-y-2 overflow-auto pr-1">
                  {!qualityReportsLoading && qualityReports.length === 0 && (
                    <p className="text-sm text-[#64748b]">
                      No reports found yet.
                    </p>
                  )}
                  {qualityReports.map((report) => {
                    const isActive = selectedQualityRunId === report.runId;
                    return (
                      <button
                        key={report.runId}
                        type="button"
                        className={`w-full rounded-lg border p-2 text-left ${
                          isActive
                            ? "border-[#1f2937] bg-[#f8fafc]"
                            : "border-[#e2e8f0] bg-white hover:border-[#cbd5e1]"
                        }`}
                        onClick={() => setSelectedQualityRunId(report.runId)}
                      >
                        <div className="text-xs uppercase tracking-[0.12em] text-[#64748b]">
                          {report.profile} | {report.risk}
                        </div>
                        <div className="mt-1 break-all text-sm font-semibold text-[#0f172a]">
                          {report.runId}
                        </div>
                        <div className="mt-1 text-xs text-[#64748b]">
                          {toLocale(report.generatedAt || report.startedAt)}
                        </div>
                        <div className="mt-1 text-xs text-[#334155]">
                          {report.summary.passed} passed /{" "}
                          {report.summary.failed} failed /{" "}
                          {report.summary.skipped} skipped
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <article className="min-w-0 rounded-xl border border-[#e2e8f0] bg-white p-3">
                {!selectedQualityRunId && (
                  <p className="text-sm text-[#64748b]">
                    Select a report run to view details.
                  </p>
                )}
                {qualityDetailLoading && (
                  <p className="text-sm text-[#475569]">
                    Loading report details…
                  </p>
                )}
                {qualityDetailError && (
                  <p className="rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                    {qualityDetailError}
                  </p>
                )}
                {!qualityDetailLoading &&
                  !qualityDetailError &&
                  qualityDetail && (
                    <div className="space-y-3">
                      <header>
                        <h3 className="text-sm font-semibold text-[#0f172a]">
                          {qualityDetail.runId}
                        </h3>
                        <p className="mt-1 text-xs text-[#64748b]">
                          Profile: {qualityDetail.json?.profile || "n/a"} |
                          Risk:{" "}
                          {(
                            qualityDetail.json?.risk || "unknown"
                          ).toUpperCase()}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-[#cbd5e1] bg-white px-2 py-1 text-xs font-semibold text-[#1f2937] transition hover:bg-[#f8fafc]"
                            onClick={() =>
                              downloadTextFile(
                                `${qualityDetail.runId}-QUALITY_REPORT.md`,
                                qualityDetail.markdown || "",
                                "text/markdown;charset=utf-8",
                              )
                            }
                          >
                            Download Markdown
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-[#cbd5e1] bg-white px-2 py-1 text-xs font-semibold text-[#1f2937] transition hover:bg-[#f8fafc]"
                            onClick={() =>
                              downloadTextFile(
                                `${qualityDetail.runId}-quality-report.json`,
                                JSON.stringify(
                                  qualityDetail.json || {},
                                  null,
                                  2,
                                ),
                                "application/json;charset=utf-8",
                              )
                            }
                          >
                            Download JSON
                          </button>
                        </div>
                      </header>

                      <section className="rounded-lg border border-[#e2e8f0] p-2">
                        <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">
                          Check Status
                        </h4>
                        <div className="mt-2 max-h-[20vh] space-y-2 overflow-auto pr-1">
                          {(qualityDetail.json?.results || []).map(
                            (item, index) => (
                              <div
                                key={`${item.id || item.title || "check"}-${index}`}
                                className="rounded-md border border-[#e2e8f0] p-2"
                              >
                                <div className="flex items-center justify-between gap-2 text-sm">
                                  <span className="font-semibold text-[#0f172a]">
                                    {item.title || item.id || "Check"}
                                  </span>
                                  <span
                                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                                      String(
                                        item.status || "",
                                      ).toLowerCase() === "passed"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-red-100 text-red-700"
                                    }`}
                                  >
                                    {String(
                                      item.status || "unknown",
                                    ).toUpperCase()}
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-[#64748b]">
                                  Duration: {item.durationMs ?? 0} ms
                                </div>
                                {item.parsed?.summary && (
                                  <div className="mt-1 text-xs text-[#334155]">
                                    {item.parsed.summary}
                                  </div>
                                )}
                              </div>
                            ),
                          )}
                        </div>
                      </section>

                      <section className="rounded-lg border border-[#e2e8f0] p-2">
                        <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">
                          Markdown Report
                        </h4>
                        <pre className="mt-2 max-h-[38vh] overflow-auto whitespace-pre-wrap rounded-md bg-[#f8fafc] p-2 text-xs text-[#334155]">
                          {qualityDetail.markdown}
                        </pre>
                      </section>
                    </div>
                  )}
              </article>
            </div>
          </section>
        )}

        {viewMode === "ops" && (
          <div className="grid min-w-0 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <section className="min-w-0 rounded-2xl border border-[#1f2937]/20 bg-white/95 p-4">
              <h2 className="text-lg font-semibold text-[#0f172a]">
                User Operations
              </h2>
              <p className="mt-1 text-xs text-[#334155]">
                Internal use only. All write actions require a reason and are
                audited.
              </p>
              <div className="mt-4 max-h-[68vh] space-y-2 overflow-auto pr-1">
                {searchResults.map((entry) => {
                  const active = selectedUserId === entry.userId;
                  return (
                    <article
                      key={entry.userId}
                      className={`w-full min-w-0 rounded-xl border p-3 ${active ? "border-[#1f2937] bg-[#f8fafc]" : "border-[#e2e8f0] bg-white"}`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(entry.userId)}
                        className="w-full text-left"
                      >
                        <div className="break-words text-sm font-semibold text-[#0f172a]">
                          {entry.displayName || entry.email || entry.userId}
                        </div>
                        <div className="break-all text-xs text-[#475569]">
                          {entry.email || "No email"}
                        </div>
                        <div className="mt-1 text-xs text-[#64748b]">
                          {languageLabel(entry.targetLanguage)} | onboarding{" "}
                          {entry.onboardingComplete ? "done" : "pending"}
                        </div>
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
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by email or name"
                  className={baseInput}
                />
                <button
                  type="button"
                  onClick={() => void runSearch()}
                  disabled={searchLoading}
                  className={baseButton}
                >
                  {searchLoading ? "..." : "Find"}
                </button>
              </div>
              <div className="mt-4 rounded-xl border border-[#e2e8f0] p-3">
                <h3 className="text-sm font-semibold text-[#0f172a]">
                  Recently Scheduled/Deleted Accounts
                </h3>
                <p className="mt-1 text-xs text-[#64748b]">
                  Use Undo before the timer reaches 0 days.
                </p>
                <input
                  className={`${baseInput} mt-2`}
                  value={undoDeletionReason}
                  onChange={(event) =>
                    setUndoDeletionReason(event.target.value)
                  }
                  placeholder="Reason for undo (optional)"
                />
                {recentDeletionsLoading && (
                  <p className="mt-2 text-sm text-[#475569]">
                    Loading recent deletions…
                  </p>
                )}
                {recentDeletionsError && (
                  <p className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                    {recentDeletionsError}
                  </p>
                )}
                {!recentDeletionsLoading &&
                  !recentDeletionsError &&
                  recentDeletions.length === 0 && (
                    <p className="mt-2 text-sm text-[#64748b]">
                      No recent deletion activity.
                    </p>
                  )}
                {!recentDeletionsLoading &&
                  !recentDeletionsError &&
                  recentDeletions.length > 0 && (
                    <div className="mt-2 max-h-[28vh] space-y-2 overflow-auto pr-1">
                      {recentDeletions.map((entry) => (
                        <article
                          key={entry.id}
                          className="rounded-lg border border-[#e2e8f0] bg-white p-2"
                        >
                          <div className="text-sm font-semibold text-[#0f172a]">
                            {entry.targetDisplayName ||
                              entry.targetEmail ||
                              entry.targetUserId}
                          </div>
                          <div className="text-xs text-[#64748b]">
                            {entry.targetEmail || "No email"}
                          </div>
                          <div className="mt-1 text-xs text-[#475569]">
                            {entry.status === "scheduled" &&
                              `Scheduled | ${entry.daysRemaining} day(s) left`}
                            {entry.status === "completed" &&
                              "Deleted permanently"}
                            {entry.status === "cancelled" &&
                              "Deletion cancelled"}
                          </div>
                          {entry.status === "scheduled" && (
                            <button
                              type="button"
                              className="mt-2 w-full rounded-lg border border-[#1f2937] bg-white px-2 py-1 text-xs font-semibold text-[#1f2937] disabled:opacity-50"
                              disabled={undoBusyUserId !== null}
                              onClick={() =>
                                void handleUndoScheduledDeletion(
                                  entry.targetUserId,
                                )
                              }
                            >
                              {undoBusyUserId === entry.targetUserId
                                ? "Undoing…"
                                : "Undo Deletion"}
                            </button>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
              </div>
              <div className="mt-4 rounded-xl border border-[#e2e8f0] p-3">
                <h3 className="text-sm font-semibold text-[#0f172a]">
                  Open Deletion Requests
                </h3>
                <p className="mt-1 text-xs text-[#64748b]">
                  Click a request to resolve or reject it.
                </p>
                {openDeletionRequestsLoading && (
                  <p className="mt-2 text-sm text-[#475569]">
                    Loading requests…
                  </p>
                )}
                {openDeletionRequestsError && (
                  <p className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                    {openDeletionRequestsError}
                  </p>
                )}
                {!openDeletionRequestsLoading &&
                  !openDeletionRequestsError &&
                  openDeletionRequests.length === 0 && (
                    <p className="mt-2 text-sm text-[#64748b]">
                      No open deletion requests.
                    </p>
                  )}
                {!openDeletionRequestsLoading &&
                  !openDeletionRequestsError &&
                  openDeletionRequests.length > 0 && (
                    <div className="mt-2 max-h-[22vh] space-y-2 overflow-auto pr-1">
                      {openDeletionRequests.map((request) => (
                        <button
                          key={request.id}
                          type="button"
                          className="w-full rounded-lg border border-[#e2e8f0] bg-white p-2 text-left hover:border-[#1f2937]"
                          onClick={() => setRequestModal(request)}
                        >
                          <div className="text-sm font-semibold text-[#0f172a]">
                            {request.targetDisplayName ||
                              request.targetEmail ||
                              request.targetUserId}
                          </div>
                          <div className="text-xs text-[#64748b]">
                            {request.targetEmail || "No email"}
                            {request.requestChannel
                              ? ` | ${request.requestChannel}`
                              : ""}
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs text-[#475569]">
                            {request.requestReason}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            </section>

            <section className="min-w-0 rounded-2xl border border-[#1f2937]/20 bg-white/95 p-4">
              {!selectedUserId && (
                <p className="text-sm text-[#475569]">
                  Select a user to view details.
                </p>
              )}
              {selectedUserId && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="break-words text-xl font-semibold text-[#0f172a]">
                        {selectedUser?.displayName ||
                          selectedUser?.email ||
                          selectedUserId}
                      </h2>
                      <p className="break-all text-sm text-[#475569]">
                        {selectedUser?.email || ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void downloadUserExport("json")}
                        className={baseButton}
                        disabled={exportBusy !== null}
                      >
                        {exportBusy === "json"
                          ? "Exporting JSON…"
                          : "Download JSON"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void downloadUserExport("csv")}
                        className={baseButton}
                        disabled={exportBusy !== null}
                      >
                        {exportBusy === "csv"
                          ? "Exporting CSV…"
                          : "Download CSV"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void downloadUserExport("pdf")}
                        className={baseButton}
                        disabled={exportBusy !== null}
                      >
                        {exportBusy === "pdf"
                          ? "Exporting PDF…"
                          : "Download PDF"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void refreshSelectedUser(selectedUserId)}
                        className={baseButton}
                      >
                        Refresh
                      </button>
                    </div>
                  </div>

                  {detailLoading && (
                    <p className="mt-3 text-sm text-[#475569]">
                      Loading user details…
                    </p>
                  )}
                  {detailError && (
                    <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                      {detailError}
                    </p>
                  )}

                  {overview && (
                    <>
                      <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <div className={metricCard}>
                          <div className="text-xs text-[#64748b]">Language</div>
                          <div className="text-sm font-semibold text-[#0f172a]">
                            {languageLabel(overview.profile.targetLanguage)}
                          </div>
                        </div>
                        <div className={metricCard}>
                          <div className="text-xs text-[#64748b]">Streak</div>
                          <div className="text-sm font-semibold text-[#0f172a]">
                            {overview.progress?.streak ?? 0}
                          </div>
                        </div>
                        <div className={metricCard}>
                          <div className="text-xs text-[#64748b]">
                            Quiz Attempts
                          </div>
                          <div className="text-sm font-semibold text-[#0f172a]">
                            {overview.counts.quizCount}
                          </div>
                        </div>
                        <div className={metricCard}>
                          <div className="text-xs text-[#64748b]">
                            Speak Attempts
                          </div>
                          <div className="text-sm font-semibold text-[#0f172a]">
                            {overview.counts.speakCount}
                          </div>
                        </div>
                      </div>

                      <details
                        className="mt-3 rounded-xl border border-[#e2e8f0] p-3"
                        open
                      >
                        <summary className="cursor-pointer text-sm font-semibold text-[#0f172a]">
                          Current Progress (Read-only)
                        </summary>
                        <div className="mt-3 grid gap-3 md:grid-cols-5">
                          <div className={metricCard}>
                            <div className="text-xs text-[#64748b]">
                              Current Language
                            </div>
                            <div className="text-sm font-semibold text-[#0f172a]">
                              {languageLabel(
                                progressDetail?.language ||
                                  overview.profile.targetLanguage,
                              )}
                            </div>
                          </div>
                          <div className={metricCard}>
                            <div className="text-xs text-[#64748b]">
                              Current Level
                            </div>
                            <div className="text-sm font-semibold text-[#0f172a]">
                              {progressDetail?.currentBandId ||
                                overview.progress?.currentBandId ||
                                "n/a"}
                            </div>
                          </div>
                          <div className={metricCard}>
                            <div className="text-xs text-[#64748b]">
                              Current Unit
                            </div>
                            <div className="text-sm font-semibold text-[#0f172a]">
                              {progressDetail?.currentUnitId ||
                                overview.progress?.currentUnitId ||
                                "n/a"}
                            </div>
                          </div>
                          <div className={metricCard}>
                            <div className="text-xs text-[#64748b]">
                              Lesson Index
                            </div>
                            <div className="text-sm font-semibold text-[#0f172a]">
                              {progressDetail?.currentLessonIdx ??
                                overview.progress?.currentLessonIdx ??
                                "n/a"}
                            </div>
                          </div>
                          <div className={metricCard}>
                            <div className="text-xs text-[#64748b]">
                              Last Activity
                            </div>
                            <div className="text-sm font-semibold text-[#0f172a]">
                              {toLocale(progressDetail?.lastActivityAt)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-5">
                          <div className={metricCard}>
                            <div className="text-xs text-[#64748b]">
                              Lessons Started
                            </div>
                            <div className="text-sm font-semibold text-[#0f172a]">
                              {progressDetail?.completionSummary
                                ?.lessonsStarted ?? 0}
                            </div>
                          </div>
                          <div className={metricCard}>
                            <div className="text-xs text-[#64748b]">
                              Lessons Finished
                            </div>
                            <div className="text-sm font-semibold text-[#0f172a]">
                              {progressDetail?.completionSummary
                                ?.lessonsFinished ?? 0}
                            </div>
                          </div>
                          <div className={metricCard}>
                            <div className="text-xs text-[#64748b]">
                              Lessons Abandoned
                            </div>
                            <div className="text-sm font-semibold text-[#0f172a]">
                              {progressDetail?.completionSummary
                                ?.lessonsAbandoned ?? 0}
                            </div>
                          </div>
                          <div className={metricCard}>
                            <div className="text-xs text-[#64748b]">
                              Mastered Lessons
                            </div>
                            <div className="text-sm font-semibold text-[#0f172a]">
                              {progressDetail?.completionSummary
                                ?.lessonsMastered ?? 0}
                            </div>
                          </div>
                          <div className={metricCard}>
                            <div className="text-xs text-[#64748b]">
                              Mastery Ready
                            </div>
                            <div className="text-sm font-semibold text-[#0f172a]">
                              {progressDetail?.completionSummary
                                ?.lessonsMasteryReady ?? 0}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-4">
                          <div className={metricCard}>
                            <div className="text-xs text-[#64748b]">
                              Current Lesson Quiz
                            </div>
                            <div className="text-sm font-semibold text-[#0f172a]">
                              {progressDetail?.currentLessonStatus?.quizScore ??
                                "n/a"}
                            </div>
                          </div>
                          <div className={metricCard}>
                            <div className="text-xs text-[#64748b]">
                              Current Lesson Speak
                            </div>
                            <div className="text-sm font-semibold text-[#0f172a]">
                              {progressDetail?.currentLessonStatus
                                ?.speakScore ?? "n/a"}
                            </div>
                          </div>
                          <div className={metricCard}>
                            <div className="text-xs text-[#64748b]">
                              Current Lesson State
                            </div>
                            <div className="text-sm font-semibold text-[#0f172a]">
                              {progressDetail?.currentLessonStatus?.masteryReady
                                ? "Finished (Mastery Ready)"
                                : progressDetail?.currentLessonStatus?.mastered
                                  ? "Mastered"
                                  : progressDetail?.currentLessonStatus
                                        ?.completed
                                    ? "Finished"
                                    : "In Progress"}
                            </div>
                          </div>
                          <div className={metricCard}>
                            <div className="text-xs text-[#64748b]">
                              Current Lesson Finish Count
                            </div>
                            <div className="text-sm font-semibold text-[#0f172a]">
                              {progressDetail?.currentLessonStatus
                                ?.completionCount ?? 0}
                            </div>
                          </div>
                        </div>
                      </details>

                      <details
                        className="mt-3 rounded-xl border border-[#e2e8f0] p-3"
                        open
                      >
                        <summary className="cursor-pointer text-sm font-semibold text-[#0f172a]">
                          Progress Over Time
                        </summary>
                        <div className="mt-2 inline-flex rounded-xl border border-[#d1d5db] bg-white p-1">
                          {[30, 90].map((days) => (
                            <button
                              key={`user-progress-window-${days}`}
                              type="button"
                              onClick={() =>
                                setProgressTrendWindowDays(days as 30 | 90)
                              }
                              className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                                progressTrendWindowDays === days
                                  ? "bg-[#1f2937] text-white"
                                  : "text-[#334155]"
                              }`}
                            >
                              {days}d
                            </button>
                          ))}
                        </div>
                        {progressTrendError && (
                          <p className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                            {progressTrendError}
                          </p>
                        )}
                        {!progressTrendError && !progressTrend && (
                          <p className="mt-2 text-sm text-[#64748b]">
                            No trend data available yet.
                          </p>
                        )}
                        {progressTrend && (
                          <>
                            <div className="mt-3 grid gap-3 md:grid-cols-3">
                              <div className={metricCard}>
                                <div className="text-xs text-[#64748b]">
                                  Quiz Accuracy Trend
                                </div>
                                <div className="mt-1 flex items-center justify-between">
                                  <div className="text-sm font-semibold text-[#0f172a]">
                                    {progressTrend.summary.avgQuizAccuracyPct}%
                                    avg
                                  </div>
                                  <TrendDelta
                                    deltaPct={
                                      progressTrend.summary.trend
                                        .quizAccuracyDeltaPct
                                    }
                                  />
                                </div>
                              </div>
                              <div className={metricCard}>
                                <div className="text-xs text-[#64748b]">
                                  Speak Pass Trend
                                </div>
                                <div className="mt-1 flex items-center justify-between">
                                  <div className="text-sm font-semibold text-[#0f172a]">
                                    {progressTrend.summary.avgSpeakPassPct}% avg
                                  </div>
                                  <TrendDelta
                                    deltaPct={
                                      progressTrend.summary.trend
                                        .speakPassDeltaPct
                                    }
                                  />
                                </div>
                              </div>
                              <div className={metricCard}>
                                <div className="text-xs text-[#64748b]">
                                  Lesson Completions/Day Trend
                                </div>
                                <div className="mt-1 flex items-center justify-between">
                                  <div className="text-sm font-semibold text-[#0f172a]">
                                    {
                                      progressTrend.summary
                                        .totalLessonsCompleted
                                    }{" "}
                                    total
                                  </div>
                                  <TrendDelta
                                    deltaPct={
                                      progressTrend.summary.trend
                                        .lessonsCompletedPerDayDeltaPct
                                    }
                                  />
                                </div>
                                <div className="mt-1 text-[11px] text-[#64748b]">
                                  Quiz sessions: {progressTrend.summary.totalQuizSessions ?? 0}{" "}
                                  · Speak sessions:{" "}
                                  {progressTrend.summary.totalSpeakSessions ?? 0}
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 overflow-x-auto rounded-lg border border-[#e2e8f0]">
                              <table className="w-full min-w-[920px] text-left text-xs">
                                <thead className="bg-[#f8fafc] text-[#64748b]">
                                  <tr>
                                    <th className="px-2 py-2 font-semibold">
                                      Day
                                    </th>
                                    <th className="px-2 py-2 font-semibold">
                                      Quiz Sessions Completed
                                    </th>
                                    <th className="px-2 py-2 font-semibold">
                                      Quiz Accuracy
                                    </th>
                                    <th className="px-2 py-2 font-semibold">
                                      Speak Sessions Completed
                                    </th>
                                    <th className="px-2 py-2 font-semibold">
                                      Speak Pass
                                    </th>
                                    <th className="px-2 py-2 font-semibold">
                                      Lessons Started
                                    </th>
                                    <th className="px-2 py-2 font-semibold">
                                      Lessons Completed
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {progressTrend.series
                                    .slice(-21)
                                    .reverse()
                                    .map((row) => (
                                      <tr
                                        key={`trend-${row.day}`}
                                        className="border-t border-[#e2e8f0]"
                                      >
                                        <td className="px-2 py-2 text-[#0f172a]">
                                          {row.day}
                                        </td>
                                        <td className="px-2 py-2 text-[#0f172a]">
                                          {row.quizSessions ?? 0}
                                        </td>
                                        <td className="px-2 py-2 text-[#0f172a]">
                                          {row.quizAccuracyPct}%
                                        </td>
                                        <td className="px-2 py-2 text-[#0f172a]">
                                          {row.speakSessions ?? 0}
                                        </td>
                                        <td className="px-2 py-2 text-[#0f172a]">
                                          {row.speakPassPct}%
                                        </td>
                                        <td className="px-2 py-2 text-[#0f172a]">
                                          {row.lessonsStarted ?? 0}
                                        </td>
                                        <td className="px-2 py-2 text-[#0f172a]">
                                          {row.lessonsCompleted ?? 0}
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </details>

                      <details className="mt-3 rounded-xl border border-[#e2e8f0] p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-[#0f172a]">
                          Review Queue Debug (v1 Priority)
                        </summary>
                        <p className="mt-2 text-xs text-[#64748b]">
                          Components: forgetting risk, miss history,
                          pronunciation weakness, recent seen penalty.
                        </p>
                        {reviewQueueDebugLoading && (
                          <p className="mt-2 text-sm text-[#475569]">
                            Loading review queue…
                          </p>
                        )}
                        {reviewQueueDebugError && (
                          <p className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                            {reviewQueueDebugError}
                          </p>
                        )}
                        {!reviewQueueDebugLoading &&
                          !reviewQueueDebugError &&
                          (!reviewQueueDebug ||
                            reviewQueueDebug.queue.length === 0) && (
                            <p className="mt-2 text-sm text-[#64748b]">
                              No queued review words for this user yet.
                            </p>
                          )}
                        {reviewQueueDebug &&
                          reviewQueueDebug.queue.length > 0 && (
                            <div className="mt-3 overflow-x-auto rounded-lg border border-[#e2e8f0]">
                              <table className="min-w-[920px] w-full text-left text-xs">
                                <thead className="bg-[#f8fafc] text-[#475569]">
                                  <tr>
                                    <th className="px-2 py-2 font-semibold">
                                      Word
                                    </th>
                                    <th className="px-2 py-2 font-semibold">
                                      Priority
                                    </th>
                                    <th className="px-2 py-2 font-semibold">
                                      Forget
                                    </th>
                                    <th className="px-2 py-2 font-semibold">
                                      Miss
                                    </th>
                                    <th className="px-2 py-2 font-semibold">
                                      Pron
                                    </th>
                                    <th className="px-2 py-2 font-semibold">
                                      Recent Penalty
                                    </th>
                                    <th className="px-2 py-2 font-semibold">
                                      Elapsed/Stability
                                    </th>
                                    <th className="px-2 py-2 font-semibold">
                                      Misses
                                    </th>
                                    <th className="px-2 py-2 font-semibold">
                                      Reasons
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {reviewQueueDebug.queue.map((item) => {
                                    const nativeText =
                                      (item.lexeme?.term || "").trim() ||
                                      item.wordId;
                                    const englishText = (
                                      item.lexeme?.en || ""
                                    ).trim();
                                    const breakdown = item.priorityBreakdown;
                                    return (
                                      <tr
                                        key={`queue-debug-${item.wordId}`}
                                        className="border-t border-[#e2e8f0] align-top"
                                      >
                                        <td className="px-2 py-2">
                                          <div className="font-semibold text-[#0f172a]">
                                            {nativeText}
                                          </div>
                                          <div className="text-[#64748b]">
                                            {englishText || "Unknown meaning"}
                                          </div>
                                        </td>
                                        <td className="px-2 py-2 font-semibold text-[#0f172a]">
                                          {item.priorityScore.toFixed(2)}
                                        </td>
                                        <td className="px-2 py-2 text-[#0f172a]">
                                          {breakdown
                                            ? breakdown.forgettingRisk.toFixed(
                                                3,
                                              )
                                            : "n/a"}
                                        </td>
                                        <td className="px-2 py-2 text-[#0f172a]">
                                          {breakdown
                                            ? breakdown.missHistory.toFixed(3)
                                            : "n/a"}
                                        </td>
                                        <td className="px-2 py-2 text-[#0f172a]">
                                          {breakdown
                                            ? breakdown.pronunciationWeakness.toFixed(
                                                3,
                                              )
                                            : "n/a"}
                                        </td>
                                        <td className="px-2 py-2 text-[#0f172a]">
                                          {breakdown
                                            ? breakdown.recentSeenPenalty.toFixed(
                                                3,
                                              )
                                            : "n/a"}
                                        </td>
                                        <td className="px-2 py-2 text-[#0f172a]">
                                          {breakdown
                                            ? `${breakdown.elapsedDays.toFixed(2)}d / ${breakdown.stabilityDays.toFixed(0)}d`
                                            : "n/a"}
                                        </td>
                                        <td className="px-2 py-2 text-[#0f172a]">
                                          q:{item.missedQuizCount} / s:
                                          {item.mispronounceCount}
                                        </td>
                                        <td className="px-2 py-2">
                                          <div className="flex flex-wrap gap-1">
                                            {(item.reasons || []).map(
                                              (reason) => (
                                                <span
                                                  key={`${item.wordId}-${reason}`}
                                                  className="rounded-full border border-[#dbe3ee] bg-[#f8fafc] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#475569]"
                                                >
                                                  {reason}
                                                </span>
                                              ),
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                      </details>

                      <details className="mt-3 rounded-xl border border-[#e2e8f0] p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-[#0f172a]">
                          Learning Access Controls
                        </summary>
                        <p className="mt-1 text-xs text-[#64748b]">
                          Every change requires a reason and is audit logged.
                          Explicit locks win over unlocks.
                        </p>
                        <div className="mt-2 grid gap-2 md:grid-cols-4">
                          <input
                            className={baseInput}
                            value={accessReason}
                            onChange={(event) =>
                              setAccessReason(event.target.value)
                            }
                            placeholder="Reason for learning access change (required)"
                          />
                          <input
                            className={baseInput}
                            value={accessFilter}
                            onChange={(event) =>
                              setAccessFilter(event.target.value)
                            }
                            placeholder="Search/filter overrides"
                          />
                          <select
                            className={baseInput}
                            value={accessLanguageId}
                            onChange={() => setAccessLanguageId("ja")}
                          >
                            {ACCESS_LANGUAGE_OPTIONS.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className={baseButton}
                            disabled={
                              busyAction !== null ||
                              accessReason.trim().length < 8 ||
                              !learningAccess
                            }
                            onClick={() => {
                              if (!learningAccess) return;
                              void submitAccessPayload({
                                reason: accessReason.trim(),
                                globalAccess: !learningAccess.globalAccess,
                              });
                            }}
                          >
                            Global Access:{" "}
                            {learningAccess?.globalAccess
                              ? "Unlocked"
                              : "Locked"}
                          </button>
                        </div>
                        {(accessCatalogLoading || accessCatalogError) && (
                          <div className="mt-2 text-xs text-[#64748b]">
                            {accessCatalogLoading
                              ? "Loading language curriculum options…"
                              : accessCatalogError}
                          </div>
                        )}

                        <details
                          className="mt-3 rounded-lg border border-[#e2e8f0] p-2"
                          open
                        >
                          <summary className="cursor-pointer text-sm font-semibold text-[#0f172a]">
                            Set Progress Target and Unlock Up To
                          </summary>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-[#64748b]">
                              Lock Above Target:
                            </span>
                            <span
                              className={`rounded px-2 py-0.5 font-semibold ${
                                learningAccess?.lockAboveTarget
                                  ? "bg-red-50 text-red-700"
                                  : "bg-green-50 text-green-700"
                              }`}
                            >
                              {learningAccess?.lockAboveTarget
                                ? "Enabled"
                                : "Disabled"}
                            </span>
                          </div>
                          <div className="mt-2 grid gap-2 md:grid-cols-4">
                            <select
                              className={baseInput}
                              value={targetBandInput}
                              onChange={(event) =>
                                setTargetBandInput(event.target.value)
                              }
                              disabled={
                                accessCatalogLoading ||
                                accessBandOptions.length === 0
                              }
                            >
                              {accessBandOptions.length === 0 && (
                                <option value="">No levels available</option>
                              )}
                              {accessBandOptions.map((band) => (
                                <option key={band.id} value={band.id}>
                                  {band.label}
                                </option>
                              ))}
                            </select>
                            <select
                              className={baseInput}
                              value={targetUnitInput}
                              onChange={(event) =>
                                setTargetUnitInput(event.target.value)
                              }
                              disabled={targetUnitOptions.length === 0}
                            >
                              {targetUnitOptions.length === 0 && (
                                <option value="">No units available</option>
                              )}
                              {targetUnitOptions.map((unit) => (
                                <option key={unit.id} value={unit.id}>
                                  {unit.displayLabel}
                                </option>
                              ))}
                            </select>
                            <select
                              className={baseInput}
                              value={targetLessonInput}
                              onChange={(event) =>
                                setTargetLessonInput(event.target.value)
                              }
                              disabled={targetLessonOptions.length === 0}
                            >
                              {targetLessonOptions.length === 0 && (
                                <option value="0">No lessons available</option>
                              )}
                              {targetLessonOptions.map((lessonIndex) => (
                                <option key={lessonIndex} value={lessonIndex}>
                                  Lesson {Number(lessonIndex) + 1}
                                </option>
                              ))}
                            </select>
                            <div className="flex items-center rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs text-[#475569]">
                              {targetUnitOption
                                ? `${targetUnitOption.wordCount} words · ${targetUnitOption.lessonCount} lessons`
                                : "Select a unit"}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={baseButton}
                              disabled={
                                busyAction !== null ||
                                accessReason.trim().length < 8 ||
                                !targetBandInput ||
                                !targetUnitInput ||
                                targetLessonOptions.length === 0
                              }
                              onClick={() =>
                                void submitAccessPayload({
                                  reason: accessReason.trim(),
                                  progressTarget: {
                                    language: accessLanguageId,
                                    bandId: targetBandInput,
                                    unitId: targetUnitInput,
                                    lessonIndex: Number(targetLessonInput),
                                    unlockUpToTarget: true,
                                    lockAboveTarget: false,
                                  },
                                })
                              }
                            >
                              Unlock Through Target
                            </button>
                            <button
                              type="button"
                              className={baseButton}
                              disabled={
                                busyAction !== null ||
                                accessReason.trim().length < 8 ||
                                !targetBandInput ||
                                !targetUnitInput ||
                                targetLessonOptions.length === 0
                              }
                              onClick={() =>
                                void submitAccessPayload({
                                  reason: accessReason.trim(),
                                  progressTarget: {
                                    language: accessLanguageId,
                                    bandId: targetBandInput,
                                    unitId: targetUnitInput,
                                    lessonIndex: Number(targetLessonInput),
                                    unlockUpToTarget: true,
                                    lockAboveTarget: true,
                                  },
                                })
                              }
                            >
                              Unlock Through Target + Lock Above Target
                            </button>
                          </div>
                          <p className="mt-3 text-xs text-[#64748b]">
                            Sets the user&apos;s current language, level, unit,
                            and lesson pointer. Required: reason, level, unit,
                            lesson.
                            <span className="font-semibold text-[#475569]">
                              {" "}
                              Unlock Through Target
                            </span>{" "}
                            moves them to the target and unlocks up to that
                            point.
                            <span className="font-semibold text-[#475569]">
                              {" "}
                              Unlock Through Target + Lock Above Target
                            </span>{" "}
                            does the same and blocks progress beyond that
                            target.
                          </p>
                        </details>

                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          <details
                            className="rounded-lg border border-[#e2e8f0] p-2"
                            open
                          >
                            <summary className="cursor-pointer text-sm font-semibold text-[#0f172a]">
                              Level Overrides ({filteredLevelOverrides.length})
                            </summary>
                            <div className="mt-2 space-y-1 max-h-36 overflow-auto">
                              {filteredLevelOverrides.length === 0 && (
                                <div className="text-xs text-[#64748b]">
                                  No level overrides.
                                </div>
                              )}
                              {filteredLevelOverrides.map(([key, status]) => (
                                <div
                                  key={`level-${key}`}
                                  className="flex items-center justify-between gap-2 rounded border border-[#e2e8f0] px-2 py-1 text-xs"
                                >
                                  <span className="truncate">{key}</span>
                                  <span
                                    className={`rounded px-2 py-0.5 font-semibold ${status === "locked" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
                                  >
                                    {status === "locked"
                                      ? "Locked"
                                      : "Unlocked"}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 grid gap-1">
                              <select
                                className={baseInput}
                                value={accessLevelId}
                                onChange={(event) =>
                                  setAccessLevelId(event.target.value)
                                }
                                disabled={accessBandOptions.length === 0}
                              >
                                {accessBandOptions.length === 0 && (
                                  <option value="">No levels available</option>
                                )}
                                {accessBandOptions.map((band) => (
                                  <option key={band.id} value={band.id}>
                                    {band.label}
                                  </option>
                                ))}
                              </select>
                              <select
                                className={baseInput}
                                value={accessLevelStatus}
                                onChange={(event) =>
                                  setAccessLevelStatus(
                                    event.target.value as "locked" | "unlocked",
                                  )
                                }
                              >
                                <option value="locked">Locked</option>
                                <option value="unlocked">Unlocked</option>
                              </select>
                              <button
                                type="button"
                                className={baseButton}
                                disabled={
                                  busyAction !== null ||
                                  accessReason.trim().length < 8 ||
                                  !accessLevelId
                                }
                                onClick={() =>
                                  void submitAccessPayload({
                                    reason: accessReason.trim(),
                                    overrides: {
                                      levels: {
                                        [accessLevelId]: accessLevelStatus,
                                      },
                                    },
                                  })
                                }
                              >
                                Apply Level Override
                              </button>
                            </div>
                            <p className="mt-3 text-xs text-[#64748b]">
                              Apply an explicit lock or unlock to a single level
                              for this user. Required: reason, level, status.
                            </p>
                          </details>

                          <details
                            className="rounded-lg border border-[#e2e8f0] p-2"
                            open
                          >
                            <summary className="cursor-pointer text-sm font-semibold text-[#0f172a]">
                              Unit Overrides ({filteredUnitOverrides.length})
                            </summary>
                            <div className="mt-2 space-y-1 max-h-36 overflow-auto">
                              {filteredUnitOverrides.length === 0 && (
                                <div className="text-xs text-[#64748b]">
                                  No unit overrides.
                                </div>
                              )}
                              {filteredUnitOverrides.map(([key, status]) => (
                                <div
                                  key={`unit-${key}`}
                                  className="flex items-center justify-between gap-2 rounded border border-[#e2e8f0] px-2 py-1 text-xs"
                                >
                                  <span className="truncate">{key}</span>
                                  <span
                                    className={`rounded px-2 py-0.5 font-semibold ${status === "locked" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
                                  >
                                    {status === "locked"
                                      ? "Locked"
                                      : "Unlocked"}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 grid gap-1">
                              <select
                                className={baseInput}
                                value={accessUnitBandId}
                                onChange={(event) =>
                                  setAccessUnitBandId(event.target.value)
                                }
                                disabled={accessBandOptions.length === 0}
                              >
                                {accessBandOptions.length === 0 && (
                                  <option value="">No levels available</option>
                                )}
                                {accessBandOptions.map((band) => (
                                  <option key={band.id} value={band.id}>
                                    {band.label}
                                  </option>
                                ))}
                              </select>
                              <select
                                className={baseInput}
                                value={accessUnitId}
                                onChange={(event) =>
                                  setAccessUnitId(event.target.value)
                                }
                                disabled={unitOverrideUnitOptions.length === 0}
                              >
                                {unitOverrideUnitOptions.length === 0 && (
                                  <option value="">No units available</option>
                                )}
                                {unitOverrideUnitOptions.map((unit) => (
                                  <option key={unit.id} value={unit.id}>
                                    {unit.displayLabel}
                                  </option>
                                ))}
                              </select>
                              <select
                                className={baseInput}
                                value={accessUnitStatus}
                                onChange={(event) =>
                                  setAccessUnitStatus(
                                    event.target.value as "locked" | "unlocked",
                                  )
                                }
                              >
                                <option value="locked">Locked</option>
                                <option value="unlocked">Unlocked</option>
                              </select>
                              <button
                                type="button"
                                className={baseButton}
                                disabled={
                                  busyAction !== null ||
                                  accessReason.trim().length < 8 ||
                                  !accessUnitId
                                }
                                onClick={() =>
                                  void submitAccessPayload({
                                    reason: accessReason.trim(),
                                    overrides: {
                                      units: {
                                        [accessUnitId]: accessUnitStatus,
                                      },
                                    },
                                  })
                                }
                              >
                                Apply Unit Override
                              </button>
                            </div>
                            <p className="mt-3 text-xs text-[#64748b]">
                              Apply an explicit lock or unlock to one unit.
                              Required: reason, level, unit, status.
                            </p>
                          </details>

                          <details
                            className="rounded-lg border border-[#e2e8f0] p-2"
                            open
                          >
                            <summary className="cursor-pointer text-sm font-semibold text-[#0f172a]">
                              Lesson Overrides ({filteredLessonOverrides.length}
                              )
                            </summary>
                            <div className="mt-2 space-y-1 max-h-36 overflow-auto">
                              {filteredLessonOverrides.length === 0 && (
                                <div className="text-xs text-[#64748b]">
                                  No lesson overrides.
                                </div>
                              )}
                              {filteredLessonOverrides.map(([key, status]) => (
                                <div
                                  key={`lesson-${key}`}
                                  className="flex items-center justify-between gap-2 rounded border border-[#e2e8f0] px-2 py-1 text-xs"
                                >
                                  <span className="truncate">{key}</span>
                                  <span
                                    className={`rounded px-2 py-0.5 font-semibold ${status === "locked" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
                                  >
                                    {status === "locked"
                                      ? "Locked"
                                      : "Unlocked"}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 grid gap-1">
                              <select
                                className={baseInput}
                                value={accessLessonBandId}
                                onChange={(event) =>
                                  setAccessLessonBandId(event.target.value)
                                }
                                disabled={accessBandOptions.length === 0}
                              >
                                {accessBandOptions.length === 0 && (
                                  <option value="">No levels available</option>
                                )}
                                {accessBandOptions.map((band) => (
                                  <option key={band.id} value={band.id}>
                                    {band.label}
                                  </option>
                                ))}
                              </select>
                              <select
                                className={baseInput}
                                value={accessLessonUnitId}
                                onChange={(event) =>
                                  setAccessLessonUnitId(event.target.value)
                                }
                                disabled={
                                  lessonOverrideUnitOptions.length === 0
                                }
                              >
                                {lessonOverrideUnitOptions.length === 0 && (
                                  <option value="">No units available</option>
                                )}
                                {lessonOverrideUnitOptions.map((unit) => (
                                  <option key={unit.id} value={unit.id}>
                                    {unit.displayLabel}
                                  </option>
                                ))}
                              </select>
                              <select
                                className={baseInput}
                                value={accessLessonIndex}
                                onChange={(event) =>
                                  setAccessLessonIndex(event.target.value)
                                }
                                disabled={
                                  lessonOverrideIndexOptions.length === 0
                                }
                              >
                                {lessonOverrideIndexOptions.length === 0 && (
                                  <option value="0">
                                    No lessons available
                                  </option>
                                )}
                                {lessonOverrideIndexOptions.map(
                                  (lessonIndex) => (
                                    <option
                                      key={lessonIndex}
                                      value={lessonIndex}
                                    >
                                      Lesson {Number(lessonIndex) + 1}
                                    </option>
                                  ),
                                )}
                              </select>
                              <select
                                className={baseInput}
                                value={accessLessonStatus}
                                onChange={(event) =>
                                  setAccessLessonStatus(
                                    event.target.value as "locked" | "unlocked",
                                  )
                                }
                              >
                                <option value="locked">Locked</option>
                                <option value="unlocked">Unlocked</option>
                              </select>
                              <button
                                type="button"
                                className={baseButton}
                                disabled={
                                  busyAction !== null ||
                                  accessReason.trim().length < 8 ||
                                  !accessLessonUnitId ||
                                  lessonOverrideIndexOptions.length === 0
                                }
                                onClick={() =>
                                  void submitAccessPayload({
                                    reason: accessReason.trim(),
                                    overrides: {
                                      lessons: {
                                        [`${accessLessonUnitId}::${Number(accessLessonIndex)}`]:
                                          accessLessonStatus,
                                      },
                                    },
                                  })
                                }
                              >
                                Apply Lesson Override
                              </button>
                            </div>
                            <p className="mt-3 text-xs text-[#64748b]">
                              Apply an explicit lock or unlock to one lesson
                              index inside a unit. Required: reason, level,
                              unit, lesson, status.
                            </p>
                          </details>
                        </div>

                        <details className="mt-3 rounded-lg border border-[#e2e8f0] p-2">
                          <summary className="cursor-pointer text-sm font-semibold text-[#0f172a]">
                            Learning Access Audit ({learningAccessAudit.length})
                          </summary>
                          <div className="mt-2 max-h-36 space-y-1 overflow-auto">
                            {learningAccessAudit.length === 0 && (
                              <div className="text-xs text-[#64748b]">
                                No learning access changes yet.
                              </div>
                            )}
                            {learningAccessAudit.map((entry) => (
                              <article
                                key={entry.id}
                                className="rounded border border-[#e2e8f0] p-2 text-xs"
                              >
                                <div className="font-semibold text-[#0f172a]">
                                  {entry.changeType}
                                </div>
                                <div className="text-[#475569]">
                                  {entry.reason}
                                </div>
                                <div className="text-[#64748b]">
                                  {toLocale(entry.createdAt)}
                                  {entry.actorEmail
                                    ? ` | ${entry.actorEmail}`
                                    : ""}
                                </div>
                              </article>
                            ))}
                          </div>
                        </details>
                      </details>

                      <details className="mt-3 rounded-xl border border-[#e2e8f0] p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-[#0f172a]">
                          Security Context
                        </summary>
                        <div className="mt-2 grid gap-3 md:grid-cols-3">
                          <div className={metricCard}>
                            <div className="text-xs text-[#64748b]">
                              Active Sessions
                            </div>
                            <div className="text-sm font-semibold text-[#0f172a]">
                              {overview.security?.activeSessionCount ?? 0}
                            </div>
                          </div>
                          <div className={metricCard}>
                            <div className="text-xs text-[#64748b]">
                              Last Password Reset
                            </div>
                            <div className="text-sm font-semibold text-[#0f172a]">
                              {toLocale(overview.security?.lastPasswordResetAt)}
                            </div>
                          </div>
                          <div className={metricCard}>
                            <div className="text-xs text-[#64748b]">
                              Last Forced Logout
                            </div>
                            <div className="text-sm font-semibold text-[#0f172a]">
                              {toLocale(overview.security?.lastForcedLogoutAt)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <article className="rounded-lg border border-[#e2e8f0] p-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">
                              Recent IPs
                            </div>
                            <div className="mt-1 space-y-1 text-xs text-[#334155]">
                              {(overview.security?.recentIps || []).length ===
                                0 && <div>No recent IP data.</div>}
                              {(overview.security?.recentIps || []).map(
                                (row) => (
                                  <div
                                    key={`ip-${row.ip}-${row.lastSeenAt}`}
                                    className="flex items-center justify-between gap-2"
                                  >
                                    <span className="truncate">{row.ip}</span>
                                    <span className="text-[#64748b]">
                                      {toLocale(row.lastSeenAt)}
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          </article>
                          <article className="rounded-lg border border-[#e2e8f0] p-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">
                              Recent Devices
                            </div>
                            <div className="mt-1 space-y-1 text-xs text-[#334155]">
                              {(overview.security?.recentDevices || [])
                                .length === 0 && (
                                <div>No recent device data.</div>
                              )}
                              {(overview.security?.recentDevices || []).map(
                                (row) => (
                                  <div
                                    key={`device-${row.device}-${row.lastSeenAt}`}
                                    className="flex items-center justify-between gap-2"
                                  >
                                    <span className="truncate">
                                      {row.device}
                                    </span>
                                    <span className="text-[#64748b]">
                                      {toLocale(row.lastSeenAt)}
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          </article>
                        </div>
                      </details>
                      <details className="mt-3 rounded-xl border border-[#e2e8f0] bg-white p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-[#0f172a]">
                          Saved Operational Notes ({savedNotes.length})
                        </summary>
                        <p className="mt-1 text-xs text-[#64748b]">
                          Saved notes tied to this user.
                        </p>
                        {savedNotes.length === 0 && (
                          <p className="mt-2 text-sm text-[#64748b]">
                            No notes saved yet.
                          </p>
                        )}
                        {savedNotes.length > 0 && (
                          <div className="mt-2 max-h-[24vh] space-y-2 overflow-auto pr-1">
                            {savedNotes.map((noteEntry) => (
                              <article
                                key={noteEntry.id}
                                className="flex items-start gap-2 rounded-lg border border-[#e2e8f0] p-2"
                              >
                                <button
                                  type="button"
                                  className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-300 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                  onClick={() =>
                                    void handleDeleteSupportNote(noteEntry.id)
                                  }
                                  disabled={deletingNoteId !== null}
                                  aria-label="Delete note permanently"
                                  title="Delete note permanently"
                                >
                                  {deletingNoteId === noteEntry.id ? (
                                    <span className="text-[10px] font-semibold">
                                      ...
                                    </span>
                                  ) : (
                                    <svg
                                      viewBox="0 0 24 24"
                                      className="h-4 w-4"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      aria-hidden="true"
                                    >
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
                                    {toLocale(noteEntry.createdAt)}
                                    {noteEntry.actorEmail
                                      ? ` | ${noteEntry.actorEmail}`
                                      : ""}
                                  </div>
                                  <div className="mt-1 whitespace-pre-wrap text-sm text-[#334155]">
                                    {noteEntry.note}
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </details>

                      <details className="mt-4 rounded-xl border border-[#e2e8f0] p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-[#0f172a]">
                          Operations Actions
                        </summary>
                        <div className="mt-3 grid gap-4 xl:grid-cols-2">
                          <div className="rounded-xl border border-[#e2e8f0] p-3">
                            <h3 className="text-sm font-semibold text-[#0f172a]">
                              Operational Note
                            </h3>
                            <textarea
                              className={`${baseInput} mt-2 min-h-[120px] resize-y`}
                              value={note}
                              onChange={(event) => setNote(event.target.value)}
                              placeholder="Add context (device switch issue, suspicious login report, beta exception, deletion request details...)"
                            />
                            <input
                              className={`${baseInput} mt-2`}
                              value={noteReason}
                              onChange={(event) =>
                                setNoteReason(event.target.value)
                              }
                              placeholder="Reason (required)"
                            />
                            <button
                              type="button"
                              className={`${baseButton} mt-2`}
                              disabled={
                                busyAction !== null ||
                                note.trim().length < 3 ||
                                noteReason.trim().length < 8
                              }
                              onClick={() =>
                                void runMutation(
                                  "add-note",
                                  `/v1/admin/users/${selectedUserId}/notes`,
                                  {
                                    note: note.trim(),
                                    reason: noteReason.trim(),
                                  },
                                )
                              }
                            >
                              Save Note
                            </button>
                          </div>

                          <div className="rounded-xl border border-[#e2e8f0] p-3">
                            <h3 className="text-sm font-semibold text-[#0f172a]">
                              Admin Actions (Audited)
                            </h3>
                            <p className="mt-1 text-xs text-[#64748b]">
                              Use these controls for account support. Every
                              action is logged with your reason.
                            </p>
                            <div className="mt-2 rounded-lg border border-[#dbe3ef] bg-[#f8fafc] px-2 py-1.5 text-xs text-[#334155]">
                              Target user:{" "}
                              <span className="font-semibold text-[#0f172a]">
                                {selectedTargetLabel}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-[#64748b]">
                              Show Walkthrough Again only resets onboarding
                              guidance visibility. It does not delete lesson
                              progress, attempts, streak, or mastery data.
                            </p>
                            <input
                              className={`${baseInput} mt-2`}
                              value={actionReason}
                              onChange={(event) =>
                                setActionReason(event.target.value)
                              }
                              placeholder="Why are you taking this action? (required)"
                            />
                            <div className="mt-2 grid gap-2">
                              <button
                                type="button"
                                className={baseButton}
                                disabled={
                                  busyAction !== null ||
                                  actionReason.trim().length < 8
                                }
                                onClick={() =>
                                  void runMutation(
                                    "reset-walkthrough",
                                    `/v1/admin/users/${selectedUserId}/actions/reset-walkthrough`,
                                    { reason: actionReason.trim() },
                                  )
                                }
                              >
                                Show Walkthrough Again
                              </button>
                              <button
                                type="button"
                                className={baseButton}
                                disabled={
                                  busyAction !== null ||
                                  actionReason.trim().length < 8
                                }
                                onClick={() =>
                                  void runMutation(
                                    "revoke-sessions",
                                    `/v1/admin/users/${selectedUserId}/actions/revoke-sessions`,
                                    { reason: actionReason.trim() },
                                  )
                                }
                              >
                                Force Sign Out (All Devices)
                              </button>
                            </div>
                            <p className="mt-2 text-xs text-[#64748b]">
                              Force Sign Out revokes all active refresh sessions
                              for this user. They must sign in again on every
                              device.
                            </p>
                            <div className="mt-3 rounded-xl border border-red-300 bg-red-50/60 p-3">
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#64748b]">
                                Deletion Workflow
                              </div>
                              <p className="mt-1 text-xs text-[#64748b]">
                                Workflow target:{" "}
                                <span className="font-semibold text-[#334155]">
                                  {selectedTargetLabel}
                                </span>
                              </p>
                              <p className="mt-1 text-xs text-[#64748b]">
                                Channel = where the request came from (for audit
                                context), for example: email, in-app,
                                admin-review.
                              </p>
                              <input
                                className={`${baseInput} mt-2`}
                                value={actionChannel}
                                onChange={(event) =>
                                  setActionChannel(event.target.value)
                                }
                                placeholder="Request channel (email, in-app, admin-review)"
                              />
                              <div className="mt-2 grid gap-2">
                                <button
                                  type="button"
                                  className={baseButton}
                                  disabled={
                                    busyAction !== null ||
                                    deletionWorkflowReason.length < 8
                                  }
                                  onClick={() =>
                                    void runMutation(
                                      "request-deletion",
                                      `/v1/admin/users/${selectedUserId}/actions/request-deletion`,
                                      {
                                        reason: deletionWorkflowReason,
                                        channel:
                                          actionChannel.trim() || "email",
                                      },
                                    )
                                  }
                                >
                                  Open Deletion Request
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </details>

                      <details className="mt-4 rounded-xl border border-[#e2e8f0] p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-[#0f172a]">
                          Timeline
                        </summary>
                        <div className="mt-3 max-h-[38vh] space-y-2 overflow-auto pr-1">
                          {timeline.map((entry, index) => (
                            <article
                              key={`${entry.createdAt}-${entry.source}-${index}`}
                              className="rounded-lg border border-[#e2e8f0] p-2"
                            >
                              <div className="text-xs uppercase tracking-[0.14em] text-[#64748b]">
                                {timelineSourceLabel(entry)} |{" "}
                                {toLocale(entry.createdAt)}
                              </div>
                              <div className="text-sm font-semibold text-[#0f172a]">
                                {entry.title}
                              </div>
                              {entry.detail && (
                                <div className="text-sm text-[#334155]">
                                  {entry.detail}
                                </div>
                              )}
                            </article>
                          ))}
                        </div>
                      </details>
                    </>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[119] bg-[#1f2937]"
        style={{ height: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
      />
      <footer className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-[120] border-t border-white/10 bg-[#1f2937]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-center gap-6 px-4 md:h-16">
          {canCreateAdmins && (
            <div className="relative">
              <button
                type="button"
                className={`${iconButtonBase} ${createAdminOpen ? "bg-[#111827] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                onClick={() => {
                  setAdminActionError(null);
                  setCreateAdminOpen(true);
                }}
                aria-label="Create Admin"
                title="Create Admin"
              >
                <UserRoundPlus className="h-6 w-6 stroke-[2.6]" />
              </button>
            </div>
          )}
          <div className="relative">
            <button
              type="button"
              className={`${iconButtonBase} ${resetPasswordOpen ? "bg-[#111827] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
              onClick={() => {
                setAdminActionError(null);
                setResetPasswordOpen(true);
              }}
              aria-label="Reset Password"
              title="Reset Password"
            >
              <RotateCcwKey className="h-6 w-6 stroke-[2.6]" />
            </button>
          </div>
          <div className="relative">
            <button
              type="button"
              className={`${iconButtonBase} ${recoveryEmailOpen ? "bg-[#111827] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
              onClick={() => {
                setAdminActionError(null);
                setRecoveryEmailOpen(true);
              }}
              aria-label="Recovery Email"
              title="Recovery Email"
            >
              <MailPlus className="h-6 w-6 stroke-[2.6]" />
            </button>
          </div>
        </div>
      </footer>
      {createAdminOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#1f2937]/20 bg-white p-5">
            <h3 className="text-lg font-semibold text-[#0f172a]">
              Create New Admin
            </h3>
            <input
              className={`${baseInput} mt-3`}
              value={createAdminUsername}
              onChange={(event) => setCreateAdminUsername(event.target.value)}
              placeholder="admin username"
            />
            <input
              className={`${baseInput} mt-2`}
              value={createAdminRecoveryEmail}
              onChange={(event) =>
                setCreateAdminRecoveryEmail(event.target.value)
              }
              placeholder="recovery email (optional)"
            />
            <input
              type="password"
              className={`${baseInput} mt-2`}
              value={createAdminCurrentPassword}
              onChange={(event) =>
                setCreateAdminCurrentPassword(event.target.value)
              }
              placeholder="confirm your current admin password"
            />
            <input
              type="password"
              className={`${baseInput} mt-2`}
              value={createAdminPassword}
              onChange={(event) => setCreateAdminPassword(event.target.value)}
              placeholder="initial password (min 12 chars, upper/lower/number/symbol)"
            />
            {adminActionError && (
              <p className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                {adminActionError}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className={baseButton}
                disabled={
                  createAdminBusy ||
                  createAdminUsername.trim().length < 3 ||
                  createAdminCurrentPassword.length < 1 ||
                  createAdminPassword.length < 12
                }
                onClick={() => void handleCreateSupportAdmin()}
              >
                {createAdminBusy ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937]"
                disabled={createAdminBusy}
                onClick={() => setCreateAdminOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {resetPasswordOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#1f2937]/20 bg-white p-5">
            <h3 className="text-lg font-semibold text-[#0f172a]">
              Reset Admin Password
            </h3>
            <input
              type="password"
              className={`${baseInput} mt-3`}
              value={resetPasswordCurrentValue}
              onChange={(event) =>
                setResetPasswordCurrentValue(event.target.value)
              }
              placeholder="current password"
            />
            <input
              type="password"
              className={`${baseInput} mt-2`}
              value={resetPasswordNewValue}
              onChange={(event) => setResetPasswordNewValue(event.target.value)}
              placeholder="new password (min 12 chars, upper/lower/number/symbol)"
            />
            {adminActionError && (
              <p className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                {adminActionError}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className={baseButton}
                disabled={
                  resetPasswordBusy ||
                  resetPasswordCurrentValue.length < 1 ||
                  resetPasswordNewValue.length < 12
                }
                onClick={() => void handleResetSupportAdminPassword()}
              >
                {resetPasswordBusy ? "Saving…" : "Reset"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937]"
                disabled={resetPasswordBusy}
                onClick={() => setResetPasswordOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {recoveryEmailOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#1f2937]/20 bg-white p-5">
            <h3 className="text-lg font-semibold text-[#0f172a]">
              Set Recovery Email
            </h3>
            <input
              className={`${baseInput} mt-3`}
              value={recoveryEmailValue}
              onChange={(event) => setRecoveryEmailValue(event.target.value)}
              placeholder="outside recovery email"
            />
            {adminActionError && (
              <p className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                {adminActionError}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className={baseButton}
                disabled={
                  recoveryEmailBusy || recoveryEmailValue.trim().length < 5
                }
                onClick={() => void handleSaveRecoveryEmail()}
              >
                {recoveryEmailBusy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937]"
                disabled={recoveryEmailBusy}
                onClick={() => setRecoveryEmailOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {adminActionSuccess && (
        <div className="fixed inset-0 z-[145] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#1f2937]/20 bg-white p-5">
            <h3 className="text-lg font-semibold text-[#0f172a]">Success</h3>
            <p className="mt-2 text-sm text-[#334155]">{adminActionSuccess}</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className={baseButton}
                onClick={() => setAdminActionSuccess(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      {accessConfirmOpen && pendingAccessPayload && (
        <div className="fixed inset-0 z-[146] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#1f2937]/20 bg-white p-5">
            <h3 className="text-lg font-semibold text-[#0f172a]">
              Confirm High-impact Learning Access Change
            </h3>
            <p className="mt-2 text-sm text-[#475569]">
              This change affects multiple levels, units, or lessons. Confirm to
              apply and write an audit entry.
            </p>
            <div className="mt-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-xs text-[#334155]">
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(pendingAccessPayload, null, 2)}
              </pre>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className={baseButton}
                disabled={busyAction !== null}
                onClick={() => void runAccessMutation(pendingAccessPayload)}
              >
                {busyAction === "learning-access"
                  ? "Applying..."
                  : "Confirm and Apply"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937]"
                onClick={() => {
                  if (busyAction !== null) return;
                  setAccessConfirmOpen(false);
                  setPendingAccessPayload(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {accessApplyModalOpen && accessApplySummary && (
        <div className="fixed inset-0 z-[147] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#1f2937]/20 bg-white p-5">
            <h3 className="text-lg font-semibold text-[#0f172a]">
              Learning Access Updated
            </h3>
            <p className="mt-2 text-sm text-[#334155]">
              Change applied for{" "}
              <span className="font-semibold text-[#0f172a]">
                {selectedTargetLabel}
              </span>
              .
            </p>
            <div className="mt-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-sm text-[#334155]">
              <div>
                <span className="font-semibold text-[#0f172a]">Language:</span>{" "}
                {accessApplySummary.language || "n/a"}
              </div>
              <div>
                <span className="font-semibold text-[#0f172a]">
                  Effective Level:
                </span>{" "}
                {accessApplySummary.bandId || "n/a"}
              </div>
              <div>
                <span className="font-semibold text-[#0f172a]">
                  Effective Unit:
                </span>{" "}
                {accessApplySummary.unitId || "n/a"}
              </div>
              <div>
                <span className="font-semibold text-[#0f172a]">
                  Effective Lesson Index:
                </span>{" "}
                {accessApplySummary.lessonIndex ?? "n/a"}
              </div>
              <div>
                <span className="font-semibold text-[#0f172a]">
                  Global Access:
                </span>{" "}
                {accessApplySummary.globalAccess ? "Unlocked" : "Locked"}
              </div>
              <div>
                <span className="font-semibold text-[#0f172a]">
                  Lock Above Target:
                </span>{" "}
                {accessApplySummary.lockAboveTarget ? "Enabled" : "Disabled"}
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className={baseButton}
                onClick={() => {
                  setAccessApplyModalOpen(false);
                  setAccessApplySummary(null);
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteCandidate && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-red-300 bg-white p-5">
            <h3 className="text-lg font-semibold text-[#7f1d1d]">
              Schedule Permanent Deletion
            </h3>
            <p className="mt-2 text-sm text-[#475569]">
              This account will be queued for permanent deletion after the
              retention window. You can undo it before the timer reaches zero.
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#b91c1c]">
              High-impact action
            </p>
            <div className="mt-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-sm">
              <div className="font-semibold text-[#0f172a]">
                {deleteCandidate.displayName || "Unknown User"}
              </div>
              <div className="text-[#475569]">
                {deleteCandidate.email || "No email"}
              </div>
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
                className={`min-w-[132px] rounded-xl border px-3 py-2 text-sm font-semibold ${
                  canConfirmPermanentDelete
                    ? "border-red-700 bg-red-600 text-white"
                    : "cursor-not-allowed border-[#cbd5e1] bg-[#e2e8f0] text-[#1f2937]"
                }`}
                disabled={!canConfirmPermanentDelete}
                onClick={() => void handlePermanentDeleteUser()}
                style={{
                  color: canConfirmPermanentDelete ? "#ffffff" : "#1f2937",
                }}
              >
                {deleteBusy ? "Deleting..." : "Confirm Delete"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937]"
                onClick={() => {
                  if (deleteBusy) return;
                  setDeleteCandidate(null);
                  setDeleteReason("");
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
            <h3 className="text-lg font-semibold text-[#0f172a]">
              Deletion Scheduled
            </h3>
            <p className="mt-2 text-sm text-[#475569]">
              Deletion was scheduled. The account can be restored until the
              countdown ends.
            </p>
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
            <h3 className="text-lg font-semibold text-[#0f172a]">
              Review Deletion Request
            </h3>
            <p className="mt-1 text-sm text-[#475569]">
              {requestModal.targetDisplayName ||
                requestModal.targetEmail ||
                requestModal.targetUserId}
            </p>
            <p className="text-xs text-[#64748b]">
              {requestModal.targetEmail || "No email"}
              {requestModal.requestChannel
                ? ` | ${requestModal.requestChannel}`
                : ""}
            </p>
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
                disabled={
                  requestDecisionBusy || requestDecisionReason.trim().length < 8
                }
                onClick={() => void handleDeletionRequestDecision("resolved")}
              >
                {requestDecisionBusy ? "Saving..." : "Mark Request Resolved"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-red-500 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                disabled={
                  requestDecisionBusy || requestDecisionReason.trim().length < 8
                }
                onClick={() => void handleDeletionRequestDecision("rejected")}
              >
                {requestDecisionBusy ? "Saving..." : "Reject Deletion Request"}
              </button>
            </div>
            <button
              type="button"
              className="mt-2 rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-semibold text-[#1f2937]"
              onClick={() => {
                if (requestDecisionBusy) return;
                setRequestModal(null);
                setRequestDecisionReason("");
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
