import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import '../app-shell.css';
import { useAuth } from '../contexts/AuthContext';
import GlassLoader from './ui/GlassLoader';
import PublicFooter from './public/PublicFooter';

type Mode = 'signin' | 'signup' | 'demo' | 'forgot' | 'reset';
type AuthScreenVariant = 'page' | 'modal';

type AuthScreenProps = {
  initialMode?: Mode;
  variant?: AuthScreenVariant;
  showDemoTab?: boolean;
  showAuthTabs?: boolean;
  onClose?: () => void;
};
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

export default function AuthScreen({
  initialMode = 'signin',
  variant = 'page',
  showDemoTab = true,
  showAuthTabs = true,
  onClose,
}: AuthScreenProps) {
  const navigate = useNavigate();
  const { signIn, signUp, continueAsDemo, requestPasswordReset, resetPassword, error: authError } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
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
  const emailByMode = mode === 'signin' ? signInEmail : mode === 'signup' ? signUpEmail : forgotEmail;
  const passwordByMode = mode === 'signin' ? signInPassword : signUpPassword;
  const signInValid = isValidEmail(signInEmail) && signInPassword.trim().length > 0;
  const signUpPasswordError = mode === 'signup' ? passwordCreationError(signUpPassword) : null;
  const signUpValid = Boolean(
    signUpFirstName.trim() &&
    signUpLastName.trim() &&
    isValidEmail(signUpEmail) &&
    !signUpPasswordError
  );
  const forgotValid = isValidEmail(forgotEmail);
  const resetValid = Boolean(
    resetToken &&
    resetNewPassword.length > 0 &&
    resetConfirmPassword.length > 0 &&
    resetNewPassword === resetConfirmPassword &&
    !passwordCreationError(resetNewPassword)
  );
  const submitDisabled =
    loading ||
    (mode === 'signin' && !signInValid) ||
    (mode === 'signup' && !signUpValid) ||
    (mode === 'forgot' && !forgotValid) ||
    (mode === 'reset' && !resetValid);

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
        await signIn(resolvedEmail, resolvedPassword, rememberMe);
        setMessage('Signing you in...');
        navigate('/', { replace: true });
      } catch (err) {
        const source = (err as Error).message || 'Authentication failed';
        const normalized = source.toLowerCase();
        if (normalized.includes('too many login attempts') || normalized.includes('too many attempts')) {
          setError('Too many sign-in attempts. Please wait a few minutes and try again.');
        } else {
          setError('Invalid email or password.');
        }
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
          onClose?.();
          navigate('/', { replace: true });
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
    rememberMe,
    signIn,
    signInEmail,
    signInPassword,
    signUp,
    signUpEmail,
    signUpFirstName,
    signUpLastName,
    signUpPassword,
    timezone,
    onClose,
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
    if (!authError || mode !== 'signin') return;
    setError(authError);
  }, [authError, mode]);

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
    if (initialMode !== 'reset') {
      setMode(initialMode);
    }
  }, [initialMode]);

  useEffect(() => {
    if (showDemoTab) return;
    if (mode === 'demo') {
      setMode('signin');
    }
  }, [mode, showDemoTab]);

  useEffect(() => {
    if (variant !== 'page') return;
    document.body.classList.add('auth-screen-open');
    return () => {
      releaseFormFocus();
      document.body.classList.remove('auth-screen-open');
    };
  }, [releaseFormFocus, variant]);

  if (loading) {
    return (
      <div className={`${variant === 'modal' ? 'w-full' : 'h-[100svh] min-h-[100svh] page-shell px-6 flex items-center justify-center overflow-hidden overscroll-none'}`}>
        <GlassLoader />
      </div>
    );
  }

  const isModal = variant === 'modal';
  const hasAuthTabs = showAuthTabs && (mode === 'signin' || mode === 'signup' || mode === 'demo');
  const activeTabId = mode === 'signin' ? 'auth-tab-signin' : mode === 'signup' ? 'auth-tab-signup' : 'auth-tab-demo';
  const formCard = (
    <div className={`relative w-full max-w-md bg-white border border-border rounded-3xl p-5 sm:p-6 shadow-[0_20px_42px_-34px_rgba(31,42,55,0.28)] text-center overflow-hidden ${isModal ? 'max-h-[85vh] overflow-y-auto' : 'max-h-[calc(100svh-2.5rem)]'}`}>
      {isModal && onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-[#1F2A37] transition-colors hover:bg-[#F8F8F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#186E95]/40"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      <img
        src="/branding/logo_name_solo.png"
        srcSet="/branding/logo_name_solo-500.png 500w, /branding/logo_name_solo.png 2000w"
        sizes="(max-width: 768px) 160px, 240px"
        width={2000}
        height={500}
        alt="Sonus"
        className="h-7 w-auto object-contain mx-auto mb-5 opacity-90"
      />

      {hasAuthTabs && (
        <div className="inline-flex items-center gap-5 mb-5 border-b border-border/80 pb-1" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`pb-1 text-[11px] font-semibold uppercase tracking-wider font-mono transition-colors border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#186E95]/50 rounded-sm ${
              mode === 'signin'
                ? 'text-[#1F2A37] border-[#1F2A37]'
                : 'text-text-med border-transparent hover:text-text-dark'
            }`}
            role="tab"
            aria-selected={mode === 'signin'}
            aria-controls="auth-form-panel"
            id="auth-tab-signin"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`pb-1 text-[11px] font-semibold uppercase tracking-wider font-mono transition-colors border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#186E95]/50 rounded-sm ${
              mode === 'signup'
                ? 'text-[#1F2A37] border-[#1F2A37]'
                : 'text-text-med border-transparent hover:text-text-dark'
            }`}
            role="tab"
            aria-selected={mode === 'signup'}
            aria-controls="auth-form-panel"
            id="auth-tab-signup"
          >
              Sign Up
            </button>
          {showDemoTab && (
            <button
              type="button"
              onClick={() => setMode('demo')}
              className={`pb-1 text-[11px] font-semibold uppercase tracking-wider font-mono transition-colors border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#186E95]/50 rounded-sm ${
                mode === 'demo'
                  ? 'text-[#1F2A37] border-[#1F2A37]'
                  : 'text-text-med border-transparent hover:text-text-dark'
              }`}
              role="tab"
              aria-selected={mode === 'demo'}
              aria-controls="auth-form-panel"
              id="auth-tab-demo"
            >
              Demo
            </button>
          )}
        </div>
      )}

      <h1 className="main-font text-[2rem] leading-tight text-[#1F2A37]">
        {mode === 'signin' && 'Welcome Back'}
        {mode === 'signup' && 'Create Account'}
        {mode === 'demo' && 'Try Sonus Demo'}
        {mode === 'forgot' && 'Reset Password'}
        {mode === 'reset' && 'Set New Password'}
      </h1>
      <p className="text-[13px] font-light text-[#64748B] mt-1 mb-4">
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

      <div
        id="auth-form-panel"
        role={hasAuthTabs ? 'tabpanel' : undefined}
        aria-labelledby={hasAuthTabs ? activeTabId : undefined}
      >
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
            <div>
              <label htmlFor="signup-first-name" className="sr-only">First name</label>
              <input
                id="signup-first-name"
                value={signUpFirstName}
                onChange={(e) => setSignUpFirstName(e.target.value)}
                placeholder="First name"
                autoComplete="given-name"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#186E95]/40"
              />
            </div>
            <div>
              <label htmlFor="signup-last-name" className="sr-only">Last name</label>
              <input
                id="signup-last-name"
                value={signUpLastName}
                onChange={(e) => setSignUpLastName(e.target.value)}
                placeholder="Last name"
                autoComplete="family-name"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#186E95]/40"
              />
            </div>
          </div>
        )}

        {(mode === 'signin' || mode === 'signup' || mode === 'forgot') && (
          <div>
            <label htmlFor="auth-email" className="sr-only">Email</label>
            <input
              id="auth-email"
              ref={mode === 'signin' ? emailInputRef : null}
              type="email"
              value={emailByMode}
              onChange={(e) => {
                const next = e.target.value;
                if (mode === 'signin') setSignInEmail(next);
                else if (mode === 'signup') setSignUpEmail(next);
                else setForgotEmail(next);
              }}
              placeholder="Email"
              autoComplete="email"
              aria-invalid={Boolean(error && !isValidEmail(emailByMode))}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#186E95]/40"
            />
          </div>
        )}

        {(mode === 'signin' || mode === 'signup') && (
          <div className="mt-2 space-y-2">
            <div>
              <label htmlFor="auth-password" className="sr-only">Password</label>
              <input
                id="auth-password"
                ref={mode === 'signin' ? passwordInputRef : null}
                type="password"
                value={passwordByMode}
                onChange={(e) => {
                  const next = e.target.value;
                  if (mode === 'signin') setSignInPassword(next);
                  else setSignUpPassword(next);
                }}
                placeholder="Password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#186E95]/40"
              />
            </div>
            {mode === 'signup' ? (
              <p className="text-[11px] text-text-med text-left px-1">
                {PASSWORD_RULE_TEXT}
              </p>
            ) : null}
          </div>
        )}
        {mode === 'signin' && (
          <div className="mt-2">
            <label className="inline-flex items-center gap-2 text-xs text-text-med">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-border text-[#186E95] focus:ring-[#186E95]/40"
              />
              <span>Remember me on this device</span>
            </label>
            <p className="mt-1 text-[11px] text-[#64748B]">
              Keeps you signed in on this device. Avoid on shared computers.
            </p>
          </div>
        )}

        {mode === 'reset' && (
          <div className="space-y-2">
            <div>
              <label htmlFor="reset-new-password" className="sr-only">New password</label>
              <input
                id="reset-new-password"
                type="password"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                placeholder="New password"
                autoComplete="new-password"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#186E95]/40"
              />
            </div>
            <div>
              <label htmlFor="reset-confirm-password" className="sr-only">Confirm new password</label>
              <input
                id="reset-confirm-password"
                type="password"
                value={resetConfirmPassword}
                onChange={(e) => setResetConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#186E95]/40"
              />
            </div>
            <p className="text-[11px] text-text-med text-left px-1">
              {PASSWORD_RULE_TEXT}
            </p>
          </div>
        )}

        <div className="mt-3 min-h-[1.25rem]">
          {error && <p className="text-sm text-[#C2410C]" role="status" aria-live="polite">{error}</p>}
          {message && <p className="text-sm text-[#3E5648]" role="status" aria-live="polite">{message}</p>}
        </div>

        {mode !== 'demo' && (
          <button
            type="submit"
            disabled={submitDisabled}
            className="w-full mt-1 inline-flex items-center justify-center px-4 py-3 rounded-2xl bg-[#1F2A37] text-white font-semibold hover:bg-[#111827] transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#186E95]/50"
          >
            {loading && 'Working…'}
            {!loading && mode === 'signin' && 'Sign In'}
            {!loading && mode === 'signup' && 'Create Account'}
            {!loading && mode === 'forgot' && 'Send Reset Link'}
            {!loading && mode === 'reset' && 'Update Password'}
          </button>
        )}
      </form>
      </div>

      {mode === 'signin' && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => {
              setMode('forgot');
              setError(null);
              setMessage(null);
            }}
            className="text-xs text-text-med underline underline-offset-2 hover:text-text-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#186E95]/40 rounded-sm"
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
            onClick={() => {
              continueAsDemo();
              onClose?.();
              navigate('/', { replace: true });
            }}
            disabled={loading}
            className="w-full mt-3 inline-flex items-center justify-center px-4 py-3 rounded-2xl bg-[#1F2A37] text-white font-semibold hover:bg-[#111827] transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#186E95]/50"
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
          className="mt-3 text-sm text-text-med underline underline-offset-2 hover:text-text-dark transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#186E95]/40 rounded-sm"
        >
          Back to Sign In
        </button>
      )}
    </div>
  );

  if (isModal) {
    return <div className="w-full">{formCard}</div>;
  }

  return (
    <div
      className="min-h-[100svh] page-shell px-6 flex flex-col pb-[calc(6.25rem+env(safe-area-inset-bottom,0px))] sm:pb-0"
      style={{
        paddingTop: 'max(1.25rem, env(safe-area-inset-top, 0px))',
      }}
    >
      <div className="flex-1 flex items-center justify-center overflow-hidden overscroll-none">
        {formCard}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 sm:static sm:z-auto">
        <div className="sm:-mx-6">
          <PublicFooter />
        </div>
      </div>
    </div>
  );
}
