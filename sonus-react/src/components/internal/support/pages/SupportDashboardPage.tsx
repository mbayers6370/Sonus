/* eslint-disable @typescript-eslint/no-explicit-any */

export default function SupportDashboardPage(props: any) {
  const {
    Download,
    MissTrendDelta,
    TrendDelta,
    activationFunnelReport,
    adminTimeline,
    adminTimelineError,
    adminTimelineLoading,
    baseButton,
    dashboardError,
    dashboardGeneratedAt,
    dashboardLoading,
    dbGuardrailsReport,
    deletionLifecycleReport,
    downloadActivationFunnelCsv,
    downloadActivationFunnelJson,
    downloadAllReportsZip,
    downloadDbGuardrailsCsv,
    downloadDbGuardrailsJson,
    downloadDeletionLifecycleCsv,
    downloadDeletionLifecycleJson,
    downloadExecutiveSummaryJson,
    downloadLearningHealthCsv,
    downloadLearningHealthJson,
    downloadLearningMomentumCsv,
    downloadLearningMomentumJson,
    downloadProdReadinessCsv,
    downloadProdReadinessJson,
    downloadSecurityIncidentCsv,
    downloadSecurityIncidentJson,
    downloadStorageBudgetCsv,
    downloadStorageBudgetJson,
    downloadSupportOperationsCsv,
    downloadSupportOperationsJson,
    downloadWeeklyExecutiveCsv,
    downloadWeeklyExecutiveJson,
    executiveWeeklyReport,
    learningMetrics,
    learningMomentumReport,
    loadDashboardMetrics,
    metricCard,
    metricsWindowDays,
    metricsWindowOptions,
    prodReadinessReport,
    resolveMetricWordLabels,
    securityIncidentReport,
    setMetricsWindowDays,
    speakMissHotspotsByLanguage,
    storageBudgetReport,
    supportMetrics,
    toLocale,
    viewMode,
  } = props;
  return (
    <>
        {viewMode === "dashboard" && (
          <section className="rounded-xl border border-[#1f2937]/20 bg-white/95 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[#0f172a]">
                Analytics (Last {metricsWindowDays} Days)
              </h2>
              <div className="flex items-center gap-2">
                <div className="flex rounded-xl border border-[#d1d5db] bg-white p-1">
                  {metricsWindowOptions.map(({ days, label }: { days: number; label: string }) => (
                    <button
                      key={`home-window-${days}`}
                      type="button"
                      onClick={() => setMetricsWindowDays(days)}
                      className={`rounded-xl px-2 py-1 text-xs font-semibold ${
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
              <p className="mt-3 rounded-xl border border-red-300 bg-red-50 p-5 text-sm text-red-700">
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
            <div className="mt-4 rounded-xl border border-[#f59e0b]/40 bg-[#fff7ed] p-5">
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
              <div className="mt-4 rounded-xl border border-[#fca5a5]/50 bg-[#fff1f2] p-5">
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
                    {speakMissHotspotsByLanguage.languages.map((bucket: any) => (
                      <article
                        key={`hotspot-${bucket.languageId}`}
                        className={`rounded-xl border p-5 ${
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
                            {bucket.words.map((word: any) => {
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
            <div className="mt-5 rounded-xl border border-[#e2e8f0] p-5">
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
                <article className="rounded-xl border border-[#e2e8f0] bg-white p-5">
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

                <article className="rounded-xl border border-[#e2e8f0] bg-white p-5">
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

                <article className="rounded-xl border border-[#e2e8f0] bg-white p-5">
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

                <article className="rounded-xl border border-[#e2e8f0] bg-white p-5">
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

                <article className="rounded-xl border border-[#e2e8f0] bg-white p-5">
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

                <article className="rounded-xl border border-[#e2e8f0] bg-white p-5">
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

                <article className="rounded-xl border border-[#e2e8f0] bg-white p-5">
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

                <article className="rounded-xl border border-[#e2e8f0] bg-white p-5">
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

                <article className="rounded-xl border border-[#e2e8f0] bg-white p-5">
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

                <article className="rounded-xl border border-[#e2e8f0] bg-white p-5">
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
                            (item: any) => item.passed,
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

                <article className="rounded-xl border border-[#e2e8f0] bg-white p-5">
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
            <div className="mt-5 rounded-xl border border-[#e2e8f0] p-5">
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
                <p className="mt-2 rounded-xl border border-red-300 bg-red-50 p-5 text-sm text-red-700">
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
                    {adminTimeline.map((entry: any, index: number) => (
                      <article
                        key={`${entry.createdAt}-${entry.source}-${index}`}
                        className="rounded-xl border border-[#e2e8f0] p-5"
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
    </>

  );
}
