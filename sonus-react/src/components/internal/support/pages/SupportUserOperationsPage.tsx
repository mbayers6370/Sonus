/* eslint-disable @typescript-eslint/no-explicit-any */

export default function SupportUserOperationsPage(props: any) {
  const {
    ACCESS_LANGUAGE_OPTIONS,
    TrendDelta,
    accessBandOptions,
    accessCatalogError,
    accessCatalogLoading,
    accessFilter,
    accessLanguageId,
    accessLessonBandId,
    accessLessonIndex,
    accessLessonStatus,
    accessLessonUnitId,
    accessLevelId,
    accessLevelStatus,
    accessReason,
    accessUnitBandId,
    accessUnitId,
    accessUnitStatus,
    actionChannel,
    actionReason,
    baseButton,
    baseInput,
    busyAction,
    deletingNoteId,
    deletionWorkflowReason,
    detailError,
    detailLoading,
    downloadUserExport,
    exportBusy,
    filteredLessonOverrides,
    filteredLevelOverrides,
    filteredUnitOverrides,
    handleDeleteSupportNote,
    handleUndoScheduledDeletion,
    languageLabel,
    learningAccess,
    learningAccessAudit,
    lessonOverrideIndexOptions,
    lessonOverrideUnitOptions,
    metricCard,
    note,
    noteReason,
    openDeletionRequests,
    openDeletionRequestsError,
    openDeletionRequestsLoading,
    overview,
    progressDetail,
    progressTrend,
    progressTrendError,
    progressTrendWindowDays,
    query,
    recentDeletions,
    recentDeletionsError,
    recentDeletionsLoading,
    refreshSelectedUser,
    reviewQueueDebug,
    reviewQueueDebugError,
    reviewQueueDebugLoading,
    runMutation,
    runSearch,
    savedNotes,
    searchLoading,
    searchResults,
    selectedTargetLabel,
    selectedUser,
    selectedUserId,
    setAccessFilter,
    setAccessLanguageId,
    setAccessLessonBandId,
    setAccessLessonIndex,
    setAccessLessonStatus,
    setAccessLessonUnitId,
    setAccessLevelId,
    setAccessLevelStatus,
    setAccessReason,
    setAccessUnitBandId,
    setAccessUnitId,
    setAccessUnitStatus,
    setActionChannel,
    setActionReason,
    setDeleteCandidate,
    setNote,
    setNoteReason,
    setProgressTrendWindowDays,
    setQuery,
    setRequestModal,
    setSelectedUserId,
    setTargetBandInput,
    setTargetLessonInput,
    setTargetUnitInput,
    setUndoDeletionReason,
    submitAccessPayload,
    targetBandInput,
    targetLessonInput,
    targetLessonOptions,
    targetUnitInput,
    targetUnitOption,
    targetUnitOptions,
    timeline,
    timelineSourceLabel,
    toLocale,
    undoBusyUserId,
    undoDeletionReason,
    unitOverrideUnitOptions,
    viewMode,
  } = props;
  return (
    <>
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
                {searchResults.map((entry: any) => {
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
                      {recentDeletions.map((entry: any) => (
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
                      {openDeletionRequests.map((request: any) => (
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
                                    .map((row: any) => (
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
                                  {reviewQueueDebug.queue.map((item: any) => {
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
                                              (reason: any) => (
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
                            {ACCESS_LANGUAGE_OPTIONS.map((option: any) => (
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
                              {accessBandOptions.map((band: any) => (
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
                              {targetUnitOptions.map((unit: any) => (
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
                              {targetLessonOptions.map((lessonIndex: any) => (
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
                              {filteredLevelOverrides.map(([key, status]: [string, string]) => (
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
                                {accessBandOptions.map((band: any) => (
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
                              {filteredUnitOverrides.map(([key, status]: [string, string]) => (
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
                                {accessBandOptions.map((band: any) => (
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
                                {unitOverrideUnitOptions.map((unit: any) => (
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
                              {filteredLessonOverrides.map(([key, status]: [string, string]) => (
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
                                {accessBandOptions.map((band: any) => (
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
                                {lessonOverrideUnitOptions.map((unit: any) => (
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
                                  (lessonIndex: any) => (
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
                            {learningAccessAudit.map((entry: any) => (
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
                                (row: any) => (
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
                                (row: any) => (
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
                            {savedNotes.map((noteEntry: any) => (
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
                          {timeline.map((entry: any, index: number) => (
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
    </>

  );
}
