/* eslint-disable @typescript-eslint/no-explicit-any */

export default function SupportConsoleAdminModals(props: any) {
  const {
    MailPlus,
    RotateCcwKey,
    UserRoundPlus,
    accessApplyModalOpen,
    accessApplySummary,
    accessConfirmOpen,
    adminActionError,
    adminActionSuccess,
    baseButton,
    baseInput,
    busyAction,
    canConfirmPermanentDelete,
    canCreateAdmins,
    createAdminBusy,
    createAdminCurrentPassword,
    createAdminOpen,
    createAdminPassword,
    createAdminRecoveryEmail,
    createAdminUsername,
    deleteAcknowledge,
    deleteBusy,
    deleteCandidate,
    deleteReason,
    deleteSuccessOpen,
    handleCreateSupportAdmin,
    handleDeletionRequestDecision,
    handlePermanentDeleteUser,
    handleResetSupportAdminPassword,
    handleSaveRecoveryEmail,
    iconButtonBase,
    pendingAccessPayload,
    recoveryEmailBusy,
    recoveryEmailOpen,
    recoveryEmailValue,
    requestDecisionBusy,
    requestDecisionReason,
    requestModal,
    resetPasswordBusy,
    resetPasswordCurrentValue,
    resetPasswordNewValue,
    resetPasswordOpen,
    runAccessMutation,
    selectedTargetLabel,
    setAccessApplyModalOpen,
    setAccessApplySummary,
    setAccessConfirmOpen,
    setAdminActionError,
    setAdminActionSuccess,
    setCreateAdminCurrentPassword,
    setCreateAdminOpen,
    setCreateAdminPassword,
    setCreateAdminRecoveryEmail,
    setCreateAdminUsername,
    setDeleteAcknowledge,
    setDeleteCandidate,
    setDeleteReason,
    setDeleteSuccessOpen,
    setPendingAccessPayload,
    setRecoveryEmailOpen,
    setRecoveryEmailValue,
    setRequestDecisionReason,
    setRequestModal,
    setResetPasswordCurrentValue,
    setResetPasswordNewValue,
    setResetPasswordOpen,
  } = props;
  return (
    <>
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
          <div className="w-full max-w-md rounded-xl border border-[#1f2937]/20 bg-white p-5">
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
              <p className="mt-2 rounded-xl border border-red-300 bg-red-50 p-5 text-sm text-red-700">
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
          <div className="w-full max-w-md rounded-xl border border-[#1f2937]/20 bg-white p-5">
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
              <p className="mt-2 rounded-xl border border-red-300 bg-red-50 p-5 text-sm text-red-700">
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
          <div className="w-full max-w-md rounded-xl border border-[#1f2937]/20 bg-white p-5">
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
              <p className="mt-2 rounded-xl border border-red-300 bg-red-50 p-5 text-sm text-red-700">
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
          <div className="w-full max-w-sm rounded-xl border border-[#1f2937]/20 bg-white p-5">
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
          <div className="w-full max-w-lg rounded-xl border border-[#1f2937]/20 bg-white p-5">
            <h3 className="text-lg font-semibold text-[#0f172a]">
              Confirm High-impact Learning Access Change
            </h3>
            <p className="mt-2 text-sm text-[#475569]">
              This change affects multiple levels, units, or lessons. Confirm to
              apply and write an audit entry.
            </p>
            <div className="mt-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-5 text-xs text-[#334155]">
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
          <div className="w-full max-w-md rounded-xl border border-[#1f2937]/20 bg-white p-5">
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
            <div className="mt-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-5 text-sm text-[#334155]">
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
          <div className="w-full max-w-lg rounded-xl border border-red-300 bg-white p-5">
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
            <div className="mt-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-5 text-sm">
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
          <div className="w-full max-w-sm rounded-xl border border-[#1f2937]/20 bg-white p-5 text-center">
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
          <div className="w-full max-w-lg rounded-xl border border-[#1f2937]/20 bg-white p-5">
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
            <div className="mt-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-5 text-sm text-[#334155]">
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

    </>
  );
}
