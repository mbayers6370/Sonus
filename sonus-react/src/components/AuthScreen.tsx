import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import GlassLoader from './ui/GlassLoader';

type Mode = 'signin' | 'signup' | 'demo' | 'forgot' | 'reset';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RULE_TEXT = 'Use at least 8 characters, with at least 1 letter and 1 number.';

function readResetTokenFromUrl() {
  if (typeof window === 'undefined') return null;
  const fromSearch = new URLSearchParams(window.location.search).get('reset_token');
  if (fromSearch) return fromSearch;

  const hash = window.location.hash || '';
  const queryIdx = hash.indexOf('?');
  if (queryIdx < 0) return null;
  const hashQuery = hash.slice(queryIdx + 1);
  return new URLSearchParams(hashQuery).get('reset_token');
}

function removeResetTokenFromUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  let changed = false;

  if (url.searchParams.has('reset_token')) {
    url.searchParams.delete('reset_token');
    changed = true;
  }

  const hash = url.hash || '';
  const queryIdx = hash.indexOf('?');
  if (queryIdx >= 0) {
    const hashPath = hash.slice(0, queryIdx);
    const params = new URLSearchParams(hash.slice(queryIdx + 1));
    if (params.has('reset_token')) {
      params.delete('reset_token');
      url.hash = params.toString() ? `${hashPath}?${params.toString()}` : hashPath;
      changed = true;
    }
  }

  if (changed) {
    window.history.replaceState({}, document.title, url.toString());
  }
}

export default function AuthScreen() {
  const navigate = useNavigate();
  const { signIn, signUp, continueAsDemo, requestPasswordReset, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signUpFirstName, setSignUpFirstName] = useState('');
  const [signUpLastName, setSignUpLastName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const autoSubmittedRef = useRef(false);

  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || undefined, []);

  const releaseFormFocus = useCallback(() => {
    const active = document.activeElement as HTMLElement | null;
    active?.blur?.();
  }, []);

  const isValidEmail = useCallback((value: string) => EMAIL_PATTERN.test(value.trim()), []);

  const passwordCreationError = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 8) return 'Password must be at least 8 characters.';
    if (!/[a-zA-Z]/.test(trimmed)) return 'Password must include at least 1 letter.';
    if (!/\d/.test(trimmed)) return 'Password must include at least 1 number.';
    return null;
  }, []);

  const handleAuthSubmit = useCallback(async (emailOverride?: string, passwordOverride?: string) => {
    if (loading) return;
    releaseFormFocus();
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    setError(null);
    setMessage(null);
    if (mode === 'signin') {
      const resolvedEmail = (emailOverride ?? signInEmail).trim();
      const resolvedPassword = passwordOverride ?? signInPassword;
      if (!isValidEmail(resolvedEmail)) {
        setError('Please enter a valid email address.');
        return;
      }
      if (!resolvedPassword.trim()) {
        setError('Please enter your password.');
        return;
      }
      setLoading(true);
      try {
        await signIn(resolvedEmail, resolvedPassword);
        navigate('/', { replace: true });
      } catch (err) {
        setError((err as Error).message || 'Authentication failed');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'signup') {
      const resolvedEmail = signUpEmail.trim();
      const resolvedPassword = signUpPassword;
      if (!isValidEmail(resolvedEmail)) {
        setError('Please enter a valid email address.');
        return;
      }
      const validationError = passwordCreationError(resolvedPassword);
      if (validationError) {
        setError(validationError);
        return;
      }
      setLoading(true);
      try {
        const { requiresEmailVerification } = await signUp({
          firstName: signUpFirstName.trim(),
          lastName: signUpLastName.trim(),
          email: resolvedEmail,
          password: resolvedPassword,
          timezone,
        });
        if (requiresEmailVerification) {
          setMessage('Account created. Please verify your email, then sign in.');
          setMode('signin');
        } else {
          navigate('/');
        }
      } catch (err) {
        setError((err as Error).message || 'Authentication failed');
      } finally {
        setLoading(false);
      }
    }
  }, [
    isValidEmail,
    loading,
    mode,
    navigate,
    passwordCreationError,
    releaseFormFocus,
    signIn,
    signInEmail,
    signInPassword,
    signUp,
    signUpEmail,
    signUpFirstName,
    signUpLastName,
    signUpPassword,
    timezone,
  ]);

  const handleForgotSubmit = async () => {
    if (loading) return;
    releaseFormFocus();
    setError(null);
    setMessage(null);
    const resolvedEmail = forgotEmail.trim();
    if (!isValidEmail(resolvedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(resolvedEmail);
      setMessage('If an account exists, a reset link has been sent to that email.');
    } catch (err) {
      setError((err as Error).message || 'Unable to send reset link');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async () => {
    if (loading) return;
    if (!resetToken) {
      setError('Reset link is missing or invalid.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const validationError = passwordCreationError(resetNewPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    releaseFormFocus();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await resetPassword(resetToken, resetNewPassword);
      removeResetTokenFromUrl();
      setResetToken(null);
      setResetNewPassword('');
      setResetConfirmPassword('');
      setMode('signin');
      setMessage('Password updated. Sign in with your new password.');
    } catch (err) {
      setError((err as Error).message || 'Unable to reset password');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    autoSubmittedRef.current = false;
  }, [mode]);

  useEffect(() => {
    if (mode !== 'signin' || loading) return;
    let checks = 0;
    const timer = window.setInterval(() => {
      const emailEl = emailInputRef.current;
      const passwordEl = passwordInputRef.current;
      if (!emailEl || !passwordEl) return;

      const nextEmail = emailEl.value.trim();
      const nextPassword = passwordEl.value;

      if (nextEmail && nextEmail !== signInEmail) setSignInEmail(nextEmail);
      if (nextPassword && nextPassword !== signInPassword) setSignInPassword(nextPassword);

      const isAutoFilled = (() => {
        try {
          return (
            emailEl.matches(':-webkit-autofill') ||
            passwordEl.matches(':-webkit-autofill') ||
            emailEl.matches(':autofill') ||
            passwordEl.matches(':autofill')
          );
        } catch {
          return false;
        }
      })();

      if (!autoSubmittedRef.current && isAutoFilled && nextEmail && nextPassword) {
        autoSubmittedRef.current = true;
        void handleAuthSubmit(nextEmail, nextPassword);
      }

      checks += 1;
      if (checks >= 16) window.clearInterval(timer);
    }, 250);

    return () => {
      window.clearInterval(timer);
    };
  }, [mode, loading, signInEmail, signInPassword, handleAuthSubmit]);

  useEffect(() => {
    const token = readResetTokenFromUrl();
    if (!token) return;
    setResetToken(token);
    setMode('reset');
    setError(null);
    setMessage(null);
  }, []);

  useEffect(() => {
    document.body.classList.add('auth-screen-open');
    return () => {
      releaseFormFocus();
      document.body.classList.remove('auth-screen-open');
    };
  }, [releaseFormFocus]);

  if (loading) {
    const loadingMessage =
      mode === 'signin'
        ? 'Signing you in...'
        : mode === 'signup'
          ? 'Creating your account...'
          : mode === 'forgot'
            ? 'Sending reset link...'
            : 'Updating your password...';
    return (
      <div className="h-[100svh] min-h-[100svh] page-shell px-6 flex items-center justify-center overflow-hidden overscroll-none">
        <GlassLoader message={loadingMessage} />
      </div>
    );
  }

  return (
    <div
      className="h-[100svh] min-h-[100svh] page-shell px-6 flex items-center justify-center overflow-hidden overscroll-none"
      style={{
        paddingTop: 'max(1.25rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="w-full max-w-md bg-white border border-border rounded-3xl p-5 sm:p-6 shadow-[0_20px_42px_-34px_rgba(31,42,55,0.28)] text-center max-h-[calc(100svh-2.5rem)] overflow-hidden">
        <img
          src="/branding/logo_name_solo.png"
          alt="Sonus"
          className="h-7 mx-auto mb-5 opacity-90"
        />

        {(mode === 'signin' || mode === 'signup' || mode === 'demo') && (
          <div className="inline-flex items-center gap-5 mb-5 border-b border-border/80 pb-1">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`pb-1 text-[11px] font-semibold uppercase tracking-wider font-mono transition-colors border-b-2 ${
                mode === 'signin'
                  ? 'text-[#1F2A37] border-[#1F2A37]'
                  : 'text-text-med border-transparent hover:text-text-dark'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`pb-1 text-[11px] font-semibold uppercase tracking-wider font-mono transition-colors border-b-2 ${
                mode === 'signup'
                  ? 'text-[#1F2A37] border-[#1F2A37]'
                  : 'text-text-med border-transparent hover:text-text-dark'
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => setMode('demo')}
              className={`pb-1 text-[11px] font-semibold uppercase tracking-wider font-mono transition-colors border-b-2 ${
                mode === 'demo'
                  ? 'text-[#1F2A37] border-[#1F2A37]'
                  : 'text-text-med border-transparent hover:text-text-dark'
              }`}
            >
              Demo
            </button>
          </div>
        )}

        <h1 className="main-font text-[2rem] leading-tight text-[#1F2A37]">
          {mode === 'signin' && 'Welcome Back'}
          {mode === 'signup' && 'Create Account'}
          {mode === 'demo' && 'Try Sonus Demo'}
          {mode === 'forgot' && 'Reset Password'}
          {mode === 'reset' && 'Set New Password'}
        </h1>
        <p className="text-[13px] font-light text-[#94A3B8] mt-1 mb-4">
          {mode === 'signin' && 'Sign in with your email and password.'}
          {mode === 'signup' && 'Use your name, email, and password to create your profile.'}
          {mode === 'demo' && 'Explore real lesson flow in under two minutes.'}
          {mode === 'forgot' && 'Enter your email and we will send a secure reset link.'}
          {mode === 'reset' && 'Choose a new password for your account.'}
        </p>

        {mode === 'demo' && (
          <div className="mb-4 rounded-2xl border border-[#1F2A37]/12 bg-white p-3 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider font-mono text-[#1F2A37]">
              Demo Includes
            </p>
            <div className="mt-2 grid grid-cols-1 gap-1.5">
              <div className="text-[12px] font-mono text-[#475569]">
                <span className="font-semibold text-[#1F2A37]">No signup:</span> start instantly.
              </div>
              <div className="text-[12px] font-mono text-[#475569]">
                <span className="font-semibold text-[#1F2A37]">Core flow:</span> Learn, Quiz, and Speak.
              </div>
              <div className="text-[12px] font-mono text-[#475569]">
                <span className="font-semibold text-[#1F2A37]">Safe preview:</span> temporary session.
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === 'signin' || mode === 'signup') {
              void handleAuthSubmit();
              return;
            }
            if (mode === 'forgot') {
              void handleForgotSubmit();
              return;
            }
            void handleResetSubmit();
          }}
        >
          {mode === 'signup' && (
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input
                value={signUpFirstName}
                onChange={(e) => setSignUpFirstName(e.target.value)}
                placeholder="First name"
                autoComplete="given-name"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-left"
              />
              <input
                value={signUpLastName}
                onChange={(e) => setSignUpLastName(e.target.value)}
                placeholder="Last name"
                autoComplete="family-name"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-left"
              />
            </div>
          )}

          {(mode === 'signin' || mode === 'signup' || mode === 'forgot') && (
            <input
              ref={mode === 'signin' ? emailInputRef : null}
              type="email"
              value={mode === 'signin' ? signInEmail : mode === 'signup' ? signUpEmail : forgotEmail}
              onChange={(e) => {
                const next = e.target.value;
                if (mode === 'signin') setSignInEmail(next);
                else if (mode === 'signup') setSignUpEmail(next);
                else setForgotEmail(next);
              }}
              placeholder="Email"
              autoComplete="username webauthn"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-left"
            />
          )}

          {(mode === 'signin' || mode === 'signup') && (
            <div className="mt-2 space-y-2">
              <input
                ref={mode === 'signin' ? passwordInputRef : null}
                type="password"
                value={mode === 'signin' ? signInPassword : signUpPassword}
                onChange={(e) => {
                  const next = e.target.value;
                  if (mode === 'signin') setSignInPassword(next);
                  else setSignUpPassword(next);
                }}
                placeholder="Password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-left"
              />
              {mode === 'signup' ? (
                <p className="text-[11px] text-text-med text-left px-1">
                  {PASSWORD_RULE_TEXT}
                </p>
              ) : null}
            </div>
          )}

          {mode === 'reset' && (
            <div className="space-y-2">
              <input
                type="password"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                placeholder="New password"
                autoComplete="new-password"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-left"
              />
              <input
                type="password"
                value={resetConfirmPassword}
                onChange={(e) => setResetConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-left"
              />
              <p className="text-[11px] text-text-med text-left px-1">
                {PASSWORD_RULE_TEXT}
              </p>
            </div>
          )}

          {error && <p className="text-sm text-[#C2410C] mt-3">{error}</p>}
          {message && <p className="text-sm text-[#3E5648] mt-3">{message}</p>}

          {mode !== 'demo' && (
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 inline-flex items-center justify-center px-4 py-3 rounded-2xl bg-[#1F2A37] text-white font-semibold hover:bg-[#111827] transition-colors disabled:opacity-60"
            >
              {loading && 'Working…'}
              {!loading && mode === 'signin' && 'Sign In'}
              {!loading && mode === 'signup' && 'Create Account'}
              {!loading && mode === 'forgot' && 'Send Reset Link'}
              {!loading && mode === 'reset' && 'Update Password'}
            </button>
          )}
        </form>

        {mode === 'signin' && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setError(null);
                setMessage(null);
              }}
              className="text-xs text-text-med underline underline-offset-2 hover:text-text-dark"
            >
              Forgot password?
            </button>
          </div>
        )}
        {mode === 'demo' && (
          <div className="mt-4 text-center">
            <p className="mx-auto max-w-[26ch] text-[11px] leading-snug font-light text-[#94A3B8]">
              Demo progress is temporary and will reset after inactivity.
            </p>
            <button
              type="button"
              onClick={continueAsDemo}
              disabled={loading}
              className="w-full mt-3 inline-flex items-center justify-center px-4 py-3 rounded-2xl bg-[#1F2A37] text-white font-semibold hover:bg-[#111827] transition-colors disabled:opacity-60"
            >
              Start Demo Tour
            </button>
          </div>
        )}

        {(mode === 'forgot' || mode === 'reset') && (
          <button
            type="button"
            onClick={() => {
              if (mode === 'reset') {
                removeResetTokenFromUrl();
                setResetToken(null);
              }
              setMode('signin');
              setError(null);
            }}
            disabled={loading}
            className="mt-3 text-sm text-text-med underline underline-offset-2 hover:text-text-dark transition-colors disabled:opacity-60"
          >
            Back to Sign In
          </button>
        )}
      </div>
    </div>
  );
}
