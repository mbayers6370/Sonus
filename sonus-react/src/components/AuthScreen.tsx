import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const navigate = useNavigate();
  const { authMode, signIn, signUp, continueAsDemo } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const autoSubmittedRef = useRef(false);

  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || undefined, []);

  const releaseFormFocus = () => {
    const active = document.activeElement as HTMLElement | null;
    active?.blur?.();
  };

  const handleSubmit = async (emailOverride?: string, passwordOverride?: string) => {
    if (loading) return;
    releaseFormFocus();
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const resolvedEmail = (emailOverride ?? email).trim();
      const resolvedPassword = passwordOverride ?? password;
      if (mode === 'signin') {
        await signIn(resolvedEmail, resolvedPassword);
      } else {
        const { requiresEmailVerification } = await signUp({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
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
      }
    } catch (err) {
      setError((err as Error).message || 'Authentication failed');
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

      if (nextEmail && nextEmail !== email) setEmail(nextEmail);
      if (nextPassword && nextPassword !== password) setPassword(nextPassword);

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
        void handleSubmit(nextEmail, nextPassword);
      }

      checks += 1;
      if (checks >= 16) window.clearInterval(timer);
    }, 250);

    return () => {
      window.clearInterval(timer);
    };
  }, [mode, loading, email, password]);

  useEffect(() => {
    document.body.classList.add('auth-screen-open');
    return () => {
      releaseFormFocus();
      document.body.classList.remove('auth-screen-open');
    };
  }, []);

  return (
    <div
      className="h-[100dvh] page-shell px-6 flex items-center justify-center overflow-hidden"
      style={{
        paddingTop: 'max(1.25rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="w-full max-w-md bg-white border border-border rounded-3xl p-5 sm:p-6 shadow-[0_20px_42px_-34px_rgba(31,42,55,0.28)] text-center">
        <img
          src="/branding/logo_name_solo.png"
          alt="Sonus"
          className="h-7 mx-auto mb-5 opacity-90"
        />
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
        </div>

        <h1 className="main-font text-[2rem] leading-tight text-[#1F2A37]">
          {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p className="text-sm text-text-med mt-1 mb-4">
          {mode === 'signin'
            ? 'Sign in with your email and password.'
            : 'Use your name, email, and password to create your profile.'}
        </p>
        {authMode === 'mock' && (
          <p className="text-xs text-text-light mb-3">
            Demo mode uses `dev@local.test` and a shared sample profile.
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          {mode === 'signup' && (
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                autoComplete="given-name"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-left"
              />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                autoComplete="family-name"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-left"
              />
            </div>
          )}

          <div className="space-y-2">
            <input
              ref={emailInputRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="username webauthn"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-left"
            />
            <input
              ref={passwordInputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-left"
            />
          </div>

          {error && <p className="text-sm text-[#C2410C] mt-3">{error}</p>}
          {message && <p className="text-sm text-[#3E5648] mt-3">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 inline-flex items-center justify-center px-4 py-3 rounded-2xl bg-[#1F2A37] text-white font-semibold hover:bg-[#111827] transition-colors disabled:opacity-60"
          >
            {loading ? 'Working…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        {authMode === 'mock' && (
          <button
            type="button"
            onClick={continueAsDemo}
            disabled={loading}
            className="mt-3 text-sm text-text-med underline underline-offset-2 hover:text-text-dark transition-colors disabled:opacity-60"
          >
            Continue as Demo
          </button>
        )}
      </div>
    </div>
  );
}
