/* eslint-disable @typescript-eslint/no-explicit-any */

export default function SupportMetricsSupportPage(props: any) {
  const {
    baseButton,
    baseInput,
    deletionCaseSearch,
    deletionCases,
    deletionCasesError,
    deletionCasesLoading,
    loadDeletionCases,
    metricCard,
    metricsError,
    metricsLoading,
    metricsWindowDays,
    metricsWindowOptions,
    riskStyles,
    setDeletionCaseSearch,
    setMetricsWindowDays,
    supportMetrics,
    toLocale,
    viewMode,
  } = props;
  return (
    <>
        {viewMode === "metrics-support" && (
          <section className="rounded-xl border border-[#1f2937]/20 bg-white/95 p-5">
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
              {metricsWindowOptions.map(({ days, label }: { days: number; label: string }) => (
                <button
                  key={`support-window-${days}`}
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
              <div className="mt-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-5">
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
                  ].map((item: any) => {
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
                        className="rounded-xl border border-[#e2e8f0] bg-white p-5"
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
                <article className="rounded-xl border border-[#e2e8f0] p-5">
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
                      (item: any) => {
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
                            className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-5"
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
                <article className="rounded-xl border border-[#e2e8f0] p-5">
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
                      (item: any) => {
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
                            className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-5"
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
            <div className="mt-4 rounded-xl border border-[#e2e8f0] p-5">
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
                <p className="mt-2 rounded-xl border border-red-300 bg-red-50 p-5 text-sm text-red-700">
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
                {deletionCases.map((entry: any, index: number) => (
                  <article
                    key={`${entry.sourceType}-${entry.targetUserId}-${entry.eventAt}-${index}`}
                    className="rounded-xl border border-[#e2e8f0] p-5"
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
    </>
  );
}
