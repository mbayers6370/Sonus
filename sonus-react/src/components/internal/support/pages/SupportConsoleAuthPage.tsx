/* eslint-disable @typescript-eslint/no-explicit-any */

export default function SupportConsoleAuthPage(props: any) {
  const {
    adminAutoSubmittedRef,
    adminPassword,
    adminPasswordInputRef,
    adminUsername,
    adminUsernameInputRef,
    authBusy,
    authError,
    baseButton,
    baseInput,
    forgotPasswordBusy,
    forgotPasswordEmail,
    forgotPasswordMessage,
    forgotPasswordOpen,
    handleForgotSupportAdminPassword,
    handleResetWithEmailToken,
    handleSupportLogin,
    resetTokenBusy,
    resetTokenFromQuery,
    resetTokenPasswordValue,
    resetTokenValue,
    setAdminPassword,
    setAdminUsername,
    setForgotPasswordEmail,
    setForgotPasswordOpen,
    setResetTokenPasswordValue,
    setResetTokenValue,
  } = props;
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
