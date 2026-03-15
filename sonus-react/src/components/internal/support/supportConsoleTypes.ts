export type SearchResult = {
  userId: string;
  email: string | null;
  displayName: string | null;
  targetLanguage: string | null;
  onboardingComplete: boolean;
  updatedAt: string;
};

export type UserOverview = {
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

export type UserProgressDetail = {
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

export type UserProgressTrend = {
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

export type LearningAccessState = {
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

export type LearningAccessAuditEntry = {
  id: string;
  actorEmail: string | null;
  reason: string;
  changeType: string;
  createdAt: string;
};

export type LearningAccessApplySummary = {
  language: string | null;
  bandId: string | null;
  unitId: string | null;
  lessonIndex: number | null;
  globalAccess: boolean;
  lockAboveTarget: boolean;
};

export type AccessCatalogUnitOption = {
  id: string;
  label: string;
  displayLabel: string;
  lessonCount: number;
  wordCount: number;
};

export type AccessCatalogBandOption = {
  id: string;
  label: string;
  units: AccessCatalogUnitOption[];
};

export type TimelineEntry = {
  createdAt: string;
  source: string;
  title: string;
  detail: string | null;
};

export type SupportNoteEntry = {
  id: string;
  createdAt: string;
  note: string;
  actorEmail: string | null;
};

export type OpenDeletionRequest = {
  id: string;
  targetUserId: string;
  targetEmail: string | null;
  targetDisplayName: string | null;
  requestReason: string;
  requestChannel: string | null;
  createdAt: string;
};

export type DeletionCaseEntry = {
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

export type RecentDeletionItem = {
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

export type SupportMetrics = {
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

export type LearningMetrics = {
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

export type WeakWordsByLanguage = {
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

export type SpeakMissHotspotsByLanguage = {
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

export type ReviewQueueDebug = {
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

export type QualityReportListItem = {
  runId: string;
  generatedAt: string | null;
  startedAt: string | null;
  profile: string;
  risk: string;
  summary: { passed: number; failed: number; skipped: number };
  checksTotal: number;
};

export type QualityReportDetail = {
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

export type ExecutiveWeeklyReport = {
  generatedAt: string;
  windowDays: number;
  currentUsers: number;
  comparisons: {
    newUsers: { current: number; previous: number; deltaPct: number };
    lessonsCompleted: { current: number; previous: number; deltaPct: number };
    quizAttempts: { current: number; previous: number; deltaPct: number };
  };
};

export type DeletionLifecycleReport = {
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

export type SecurityIncidentReport = {
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

export type LearningMomentumReport = {
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

export type ActivationFunnelReport = {
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

export type StorageBudgetReport = {
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

export type DbGuardrailsReport = {
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

export type ProdReadinessReport = {
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

export type ImpactOutcomesMetrics = {
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
