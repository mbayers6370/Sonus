/* eslint-disable @typescript-eslint/no-explicit-any */

export default function SupportMetricsImpactPage(props: any) {
  const {
    Download,
    MissTrendDelta,
    TrendDelta,
    baseButton,
    downloadImpactOutcomesCsv,
    downloadImpactOutcomesJson,
    downloadImpactOutcomesPdf,
    impactOutcomesMetrics,
    impactRetentionSummary,
    loadImpactOutcomesMetrics,
    metricCard,
    metricsError,
    metricsLoading,
    metricsWindowDays,
    metricsWindowOptions,
    setMetricsWindowDays,
    viewMode,
  } = props;
  return (
    <>
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
                  {metricsWindowOptions.map(({ days, label }: { days: number; label: string }) => (
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
                        {impactOutcomesMetrics.cohorts.map((cohort: any) => (
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
                          {impactOutcomesMetrics.learningGain.firstHalf.quizSessions ?? 0}
                        </div>
                        <div>
                          Session completions:{" "}
                          {impactOutcomesMetrics.learningGain.firstHalf
                            .quizSessionsCompleted ?? 0}
                        </div>
                        <div className="mt-1">
                          First half:{" "}
                          {`${impactOutcomesMetrics.learningGain.firstHalf.quizAccuracyPct}%`}
                        </div>
                        <div>
                          Second-half sessions:{" "}
                          {impactOutcomesMetrics.learningGain.secondHalf.quizSessions ?? 0}
                        </div>
                        <div>
                          Second-half session completions:{" "}
                          {impactOutcomesMetrics.learningGain.secondHalf
                            .quizSessionsCompleted ?? 0}
                        </div>
                        <div>
                          Second half:{" "}
                          {`${impactOutcomesMetrics.learningGain.secondHalf.quizAccuracyPct}%`}
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
                          {impactOutcomesMetrics.learningGain.firstHalf.speakSessions ?? 0}
                        </div>
                        <div>
                          Session completions:{" "}
                          {impactOutcomesMetrics.learningGain.firstHalf
                            .speakSessionsCompleted ?? 0}
                        </div>
                        <div className="mt-1">
                          First half:{" "}
                          {`${impactOutcomesMetrics.learningGain.firstHalf.speakPassPct}%`}
                        </div>
                        <div>
                          Second-half sessions:{" "}
                          {impactOutcomesMetrics.learningGain.secondHalf.speakSessions ?? 0}
                        </div>
                        <div>
                          Second-half session completions:{" "}
                          {impactOutcomesMetrics.learningGain.secondHalf
                            .speakSessionsCompleted ?? 0}
                        </div>
                        <div>
                          Second half:{" "}
                          {`${impactOutcomesMetrics.learningGain.secondHalf.speakPassPct}%`}
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
                          {impactOutcomesMetrics.learningGain.firstHalf
                            .lessonsPerActiveUser}
                        </div>
                        <div>
                          Second half:{" "}
                          {impactOutcomesMetrics.learningGain.secondHalf
                            .lessonsPerActiveUser}
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
                        (bucket: any) => {
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
                      (row: any) => (
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
                            (cohort: any) => (
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
    </>
  );
}
