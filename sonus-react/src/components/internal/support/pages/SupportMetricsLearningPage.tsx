/* eslint-disable @typescript-eslint/no-explicit-any */

export default function SupportMetricsLearningPage(props: any) {
  const {
    learningMetrics,
    metricCard,
    metricsError,
    metricsLoading,
    metricsWindowDays,
    metricsWindowOptions,
    resolveMetricWordLabels,
    setMetricsWindowDays,
    viewMode,
    weakSpeakWordsByLanguage,
    weakWordsByLanguage,
  } = props;
  return (
    <>
        {viewMode === "metrics-learning" && (
          <section className="rounded-xl border border-[#1f2937]/20 bg-white/95 p-5">
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
              {metricsWindowOptions.map(({ days, label }: { days: number; label: string }) => (
                <button
                  key={`learning-window-${days}`}
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
            {metricsLoading && (
              <p className="mt-3 text-sm text-[#475569]">Loading metrics…</p>
            )}
            {metricsError && (
              <p className="mt-3 rounded-xl border border-red-300 bg-red-50 p-5 text-sm text-red-700">
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
                <div className="mt-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-5">
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
                      <div className="rounded-xl border border-[#dbe3ee] bg-white p-5">
                        <div className="text-[11px] uppercase tracking-[0.12em] text-[#64748b]">
                          tracked_starts
                        </div>
                        <div className="mt-1 text-xl font-semibold text-[#0f172a]">
                          {learningMetrics.learning.lessonStartsTracked ?? 0}
                        </div>
                      </div>
                      <div className="rounded-xl border border-[#dbe3ee] bg-white p-5">
                        <div className="text-[11px] uppercase tracking-[0.12em] text-[#64748b]">
                          inferred_starts
                        </div>
                        <div className="mt-1 text-xl font-semibold text-[#0f172a]">
                          {learningMetrics.learning.lessonStartsInferred ?? 0}
                        </div>
                      </div>
                      <div className="rounded-xl border border-[#dbe3ee] bg-white p-5">
                        <div className="text-[11px] uppercase tracking-[0.12em] text-[#64748b]">
                          completed
                        </div>
                        <div className="mt-1 text-xl font-semibold text-[#0f172a]">
                          {learningMetrics.learning.lessonCompleted}
                        </div>
                      </div>
                      <div className="rounded-xl border border-[#dbe3ee] bg-white p-5">
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
              <div className="mt-5 rounded-xl border border-[#e2e8f0] p-5">
                <details open>
                  <summary className="cursor-pointer list-none">
                    <h3 className="text-sm font-semibold text-[#0f172a]">
                      Most Missed Quiz Words By Language
                    </h3>
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {weakWordsByLanguage.languages.map((bucket: any) => (
                      <article
                        key={bucket.languageId}
                        className={`rounded-xl border p-5 ${
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
                            {bucket.words.map((word: any) => {
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
              <div className="mt-5 rounded-xl border border-[#e2e8f0] p-5">
                <details open>
                  <summary className="cursor-pointer list-none">
                    <h3 className="text-sm font-semibold text-[#0f172a]">
                      Most Missed Speak Words By Language
                    </h3>
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {weakSpeakWordsByLanguage.languages.map((bucket: any) => (
                      <article
                        key={`speak-${bucket.languageId}`}
                        className={`rounded-xl border p-5 ${
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
                            {bucket.words.map((word: any) => {
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
    </>
  );
}
