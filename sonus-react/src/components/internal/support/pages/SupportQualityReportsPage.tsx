/* eslint-disable @typescript-eslint/no-explicit-any */

export default function SupportQualityReportsPage(props: any) {
  const {
    Play,
    baseButton,
    baseInput,
    cleanupQualityReports,
    downloadTextFile,
    isValidFullSuiteConfirmText,
    loadQualityReports,
    qualityCleanupBusy,
    qualityCleanupKeepLatest,
    qualityCleanupMessage,
    qualityDetail,
    qualityDetailError,
    qualityDetailLoading,
    qualityReports,
    qualityReportsError,
    qualityReportsLoading,
    qualityRunBusy,
    qualityRunFullConfirmOpen,
    qualityRunFullConfirmText,
    qualityRunMessage,
    runFullQualityReport,
    runProdSafeQualityReport,
    selectedQualityRunId,
    setQualityCleanupKeepLatest,
    setQualityRunFullConfirmOpen,
    setQualityRunFullConfirmText,
    setSelectedQualityRunId,
    toLocale,
    viewMode,
  } = props;
  return (
    <>
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
                    setQualityRunFullConfirmOpen((open: boolean) => !open);
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
                  {qualityReports.map((report: any) => {
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
                            (item: any, index: number) => (
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
    </>
  );
}
