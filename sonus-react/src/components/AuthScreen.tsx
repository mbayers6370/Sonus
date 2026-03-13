import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import '../app-shell.css';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../lib/apiBase';
import GlassLoader from './ui/GlassLoader';
import PublicFooter from './public/PublicFooter';
import {
  PRIVACY_POLICY_LAST_UPDATED,
  PrivacyPolicyContent,
  TERMS_OF_SERVICE_LAST_UPDATED,
  TermsOfServiceContent,
} from './public/LegalDocuments';

type Mode = 'signin' | 'signup' | 'demo' | 'forgot' | 'reset';
type AuthScreenVariant = 'page' | 'modal';
type LegalDocumentKind = 'terms' | 'privacy';

type AuthScreenProps = {
  initialMode?: Mode;
  variant?: AuthScreenVariant;
  showDemoTab?: boolean;
  showAuthTabs?: boolean;
  onClose?: () => void;
};
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_RULE_TEXT =
  'Use at least 10 characters with uppercase, lowercase, number, and special character.';
const LEGAL_DOCUMENT_META = {
  terms: {
    title: 'Terms of Service',
    lastUpdated: TERMS_OF_SERVICE_LAST_UPDATED,
  },
  privacy: {
    title: 'Privacy Policy',
    lastUpdated: PRIVACY_POLICY_LAST_UPDATED,
  },
} as const;
const SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9\s]/;

function getPasswordChecks(value: string) {
  return {
    minLength: value.length >= PASSWORD_MIN_LENGTH,
    lowercase: /[a-z]/.test(value),
    uppercase: /[A-Z]/.test(value),
    number: /\d/.test(value),
    special: SPECIAL_CHARACTER_PATTERN.test(value),
    noWhitespace: !/\s/.test(value),
  };
}

function getPasswordStrength(value: string) {
  if (!value) {
    return { score: 0, label: 'Too weak', tone: 'bg-[#E2E8F0]', width: '0%' };
  }
  const checks = getPasswordChecks(value);
  let score = 0;
  if (value.length >= 8) score += 1;
  if (checks.minLength) score += 1;
  if (checks.lowercase && checks.uppercase) score += 1;
  if (checks.number) score += 1;
  if (checks.special) score += 1;
  if (value.length >= 14) score += 1;
  if (!checks.noWhitespace) score = Math.max(0, score - 1);

  const normalizedScore = Math.max(0, Math.min(4, Math.round((score / 6) * 4)));
  if (normalizedScore <= 1) {
    return { score: normalizedScore, label: 'Weak', tone: 'bg-[#DC2626]', width: '25%' };
  }
  if (normalizedScore === 2) {
    return { score: normalizedScore, label: 'Fair', tone: 'bg-[#D97706]', width: '50%' };
  }
  if (normalizedScore === 3) {
    return { score: normalizedScore, label: 'Good', tone: 'bg-[#CA8A04]', width: '75%' };
  }
  return { score: normalizedScore, label: 'Strong', tone: 'bg-[#15803D]', width: '100%' };
}

function FieldValidCheck({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-[#CBD5E1]">
      <Check className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const strength = getPasswordStrength(password);
  const recommendation =
    strength.score >= 4
      ? 'Strong passwords are preferred for account security.'
      : strength.score >= 3
        ? 'This password is acceptable. For better security, aim for Strong.'
        : 'Use a stronger password before continuing.';
  return (
    <div className="space-y-1 px-1">
      <div className="flex items-center justify-between text-[11px] text-[#64748B]">
        <span>Password strength</span>
        <span>{strength.label}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
        <div
          className={`h-full rounded-full transition-all duration-200 ${strength.tone}`}
          style={{ width: strength.width }}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-[#64748B]">{recommendation}</p>
    </div>
  );
}

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
  const [signUpEmailAvailable, setSignUpEmailAvailable] = useState<boolean | null>(null);
  const [signUpEmailCheckLoading, setSignUpEmailCheckLoading] = useState(false);
  const [signUpAgreedToLegal, setSignUpAgreedToLegal] = useState(false);
  const [signUpConfirmedAge, setSignUpConfirmedAge] = useState(false);
  const [reviewedTerms, setReviewedTerms] = useState(false);
  const [reviewedPrivacy, setReviewedPrivacy] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [activeLegalDocument, setActiveLegalDocument] = useState<LegalDocumentKind | null>(null);
  const [legalFinishEnabled, setLegalFinishEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const autoSubmittedRef = useRef(false);
  const legalScrollRef = useRef<HTMLDivElement | null>(null);

  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || undefined, []);
  const legalReviewReady = reviewedTerms && reviewedPrivacy;

  const releaseFormFocus = useCallback(() => {
    const active = document.activeElement as HTMLElement | null;
    active?.blur?.();
  }, []);

  const isValidEmail = useCallback((value: string) => EMAIL_PATTERN.test(value.trim()), []);

  const passwordCreationError = useCallback((value: string) => {
    const checks = getPasswordChecks(value);
    if (!checks.noWhitespace) return 'Password cannot contain spaces.';
    if (!checks.minLength) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    if (!checks.lowercase) return 'Password must include at least 1 lowercase letter.';
    if (!checks.uppercase) return 'Password must include at least 1 uppercase letter.';
    if (!checks.number) return 'Password must include at least 1 number.';
    if (!checks.special) return 'Password must include at least 1 special character.';
    return null;
  }, []);
  const emailByMode = mode === 'signin' ? signInEmail : mode === 'signup' ? signUpEmail : forgotEmail;
  const passwordByMode = mode === 'signin' ? signInPassword : signUpPassword;
  const signInValid = isValidEmail(signInEmail) && signInPassword.trim().length > 0;
  const signUpFirstNameValid = signUpFirstName.trim().length > 0;
  const signUpLastNameValid = signUpLastName.trim().length > 0;
  const signUpEmailFormatValid = isValidEmail(signUpEmail);
  const signUpPasswordStrength = getPasswordStrength(signUpPassword);
  const signUpEmailValid = signUpEmailFormatValid && signUpEmailAvailable === true;
  const signUpPasswordError = mode === 'signup' ? passwordCreationError(signUpPassword) : null;
  const signUpValid = Boolean(
    signUpFirstNameValid &&
    signUpLastNameValid &&
    signUpEmailValid &&
    !signUpPasswordError &&
    signUpPasswordStrength.score >= 3 &&
    signUpAgreedToLegal &&
    signUpConfirmedAge
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

  useEffect(() => {
    if (mode !== 'signup') return;
    const trimmedEmail = signUpEmail.trim();
    if (!trimmedEmail) {
      setSignUpEmailAvailable(null);
      setSignUpEmailCheckLoading(false);
      return;
    }
    if (!signUpEmailFormatValid) {
      setSignUpEmailAvailable(null);
      setSignUpEmailCheckLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setSignUpEmailCheckLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/v1/auth/check-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: trimmedEmail }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Email availability check failed');
        const payload = (await response.json()) as { available?: boolean };
        if (!cancelled) {
          setSignUpEmailAvailable(payload.available === true);
        }
      } catch {
        if (controller.signal.aborted) return;
        if (!cancelled) setSignUpEmailAvailable(null);
      } finally {
        if (!cancelled) setSignUpEmailCheckLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [mode, signUpEmail, signUpEmailFormatValid]);

  const updateLegalFinishState = useCallback(() => {
    const container = legalScrollRef.current;
    if (!container) {
      setLegalFinishEnabled(false);
      return;
    }
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setLegalFinishEnabled(distanceToBottom <= 24);
  }, []);

  useEffect(() => {
    if (!activeLegalDocument) return;
    setLegalFinishEnabled(false);
    const frame = window.requestAnimationFrame(() => {
      const container = legalScrollRef.current;
      if (!container) return;
      container.scrollTo({ top: 0, behavior: 'auto' });
      updateLegalFinishState();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeLegalDocument, updateLegalFinishState]);

  useEffect(() => {
    if (!activeLegalDocument || typeof document === 'undefined') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [activeLegalDocument]);

  useEffect(() => {
    if (!activeLegalDocument) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveLegalDocument(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeLegalDocument]);

  const openLegalDocument = useCallback((document: LegalDocumentKind) => {
    setActiveLegalDocument(document);
  }, []);

  const finishLegalReview = useCallback(() => {
    if (!activeLegalDocument || !legalFinishEnabled) return;
    if (activeLegalDocument === 'terms') {
      setReviewedTerms(true);
    } else {
      setReviewedPrivacy(true);
    }
    setActiveLegalDocument(null);
  }, [activeLegalDocument, legalFinishEnabled]);

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
      if (!signUpFirstName.trim()) {
        setError('Please enter your first name.');
        return;
      }
      if (!signUpLastName.trim()) {
        setError('Please enter your last name.');
        return;
      }
      if (!isValidEmail(resolvedEmail)) {
        setError('Please enter a valid email address.');
        return;
      }
      if (signUpEmailCheckLoading) {
        setError('Checking email availability. Please wait a moment.');
        return;
      }
      if (signUpEmailAvailable !== true) {
        setError('That email is already in use or could not be verified. Please use a different email.');
        return;
      }
      const validationError = passwordCreationError(resolvedPassword);
      if (validationError) {
        setError(validationError);
        return;
      }
      if (getPasswordStrength(resolvedPassword).score < 3) {
        setError('Password strength must be at least Good. For better security, aim for Strong.');
        return;
      }
      if (!reviewedTerms || !reviewedPrivacy) {
        setError('Please review the Terms and Privacy Policy before creating your account.');
        return;
      }
      if (!signUpAgreedToLegal) {
        setError('Please confirm that you agree to the Terms of Service and Privacy Policy.');
        return;
      }
      if (!signUpConfirmedAge) {
        setError('Please confirm that you meet the minimum age requirement for Sonus.');
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
          legalAcceptance: {
            termsVersion: TERMS_OF_SERVICE_LAST_UPDATED,
            privacyVersion: PRIVACY_POLICY_LAST_UPDATED,
            termsAccepted: true,
            privacyAccepted: true,
            ageConfirmed: true,
          },
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
    signUpAgreedToLegal,
    signUpEmailAvailable,
    signUpEmailCheckLoading,
    signUpConfirmedAge,
    signUpEmail,
    signUpFirstName,
    signUpLastName,
    signUpPassword,
    timezone,
    onClose,
    reviewedPrivacy,
    reviewedTerms,
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
  const cardHeightClass =
    mode === 'signup'
      ? isModal
        ? 'max-h-[min(74svh,32rem)] overflow-hidden'
        : 'max-h-[min(calc(100svh-3.5rem),32rem)] overflow-hidden'
      : isModal
        ? 'max-h-[min(74svh,38rem)] overflow-hidden'
        : 'max-h-[min(calc(100svh-3.5rem),42rem)] overflow-hidden';
  const formCard = (
    <div
      className={`relative flex w-full max-w-md flex-col rounded-3xl border border-border bg-white px-5 py-4 text-center shadow-[0_20px_42px_-34px_rgba(31,42,55,0.28)] sm:max-w-[42rem] sm:px-6 sm:py-5 ${
        cardHeightClass
      }`}
    >
      {isModal && onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-[var(--sonus-palette-charcoal)] transition-colors hover:bg-[#F8F8F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sonus-palette-blue)]/40"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      <div className={`min-h-0 flex-1 overflow-y-auto ${isModal ? 'pr-1' : 'pr-1 sm:pr-2'}`}>
        <img
          src="/branding/logo_name_solo.png"
          srcSet="/branding/logo_name_solo-500.png 500w, /branding/logo_name_solo.png 2000w"
          sizes="(max-width: 768px) 160px, 240px"
          width={2000}
          height={500}
          alt="Sonus"
          className={`mx-auto h-7 w-auto object-contain opacity-90 ${isModal ? 'mb-4' : 'mb-5'}`}
        />

        {hasAuthTabs && (
          <div className={`inline-flex items-center gap-5 border-b border-border/80 pb-1 ${isModal ? 'mb-4' : 'mb-5'}`} role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`rounded-sm border-b-2 pb-1 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sonus-palette-blue)]/50 ${
                mode === 'signin'
                  ? 'border-[var(--sonus-palette-charcoal)] text-[var(--sonus-palette-charcoal)]'
                  : 'border-transparent text-text-med hover:text-text-dark'
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
              className={`rounded-sm border-b-2 pb-1 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sonus-palette-blue)]/50 ${
                mode === 'signup'
                  ? 'text-[var(--sonus-palette-charcoal)] border-[var(--sonus-palette-charcoal)]'
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
                className={`rounded-sm border-b-2 pb-1 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sonus-palette-blue)]/50 ${
                  mode === 'demo'
                    ? 'border-[var(--sonus-palette-charcoal)] text-[var(--sonus-palette-charcoal)]'
                    : 'border-transparent text-text-med hover:text-text-dark'
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

        <h1 className="main-font text-[2rem] leading-tight text-[var(--sonus-palette-charcoal)]">
        {mode === 'signin' && 'Welcome Back'}
        {mode === 'signup' && 'Create Account'}
        {mode === 'demo' && 'Try Sonus Demo'}
        {mode === 'forgot' && 'Reset Password'}
        {mode === 'reset' && 'Set New Password'}
        </h1>
        <p className={`mt-1 text-[13px] font-light text-[#64748B] ${isModal ? 'mb-3' : 'mb-4'}`}>
        {mode === 'signin' && 'Sign in with your email and password.'}
        {mode === 'signup' && 'Use your name, email, and password to create your profile.'}
        {mode === 'demo' && 'Explore real lesson flow in under two minutes.'}
        {mode === 'forgot' && 'Enter your email and we will send a secure reset link.'}
        {mode === 'reset' && 'Choose a new password for your account.'}
        </p>

        {mode === 'demo' && (
          <div className={`rounded-2xl border border-[var(--sonus-palette-charcoal)]/12 bg-white p-3 text-center ${isModal ? 'mb-3' : 'mb-4'}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wider font-mono text-[var(--sonus-palette-charcoal)]">
            Demo Includes
          </p>
          <div className="mt-2 grid grid-cols-1 gap-1.5">
            <div className="text-[12px] font-mono text-[#475569]">
              <span className="font-semibold text-[var(--sonus-palette-charcoal)]">No signup:</span> start instantly.
            </div>
            <div className="text-[12px] font-mono text-[#475569]">
              <span className="font-semibold text-[var(--sonus-palette-charcoal)]">Core flow:</span> Learn, Quiz, and Speak.
            </div>
            <div className="text-[12px] font-mono text-[#475569]">
              <span className="font-semibold text-[var(--sonus-palette-charcoal)]">Safe preview:</span> temporary session.
            </div>
            </div>
          </div>
        )}

        <div
          id="auth-form-panel"
          role={hasAuthTabs ? 'tabpanel' : undefined}
          aria-labelledby={hasAuthTabs ? activeTabId : undefined}
          className="px-1"
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
          <div className="mb-2 grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="signup-first-name" className="sr-only">First name</label>
              <div className="relative">
                <input
                  id="signup-first-name"
                  value={signUpFirstName}
                  onChange={(e) => setSignUpFirstName(e.target.value)}
                  placeholder="First name"
                  autoComplete="given-name"
                  className="w-full border border-border rounded-xl px-3 py-2.5 pr-10 text-base sm:text-sm bg-white text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sonus-palette-blue)]/40"
                />
                <FieldValidCheck visible={signUpFirstNameValid} />
              </div>
            </div>
            <div>
              <label htmlFor="signup-last-name" className="sr-only">Last name</label>
              <div className="relative">
                <input
                  id="signup-last-name"
                  value={signUpLastName}
                  onChange={(e) => setSignUpLastName(e.target.value)}
                  placeholder="Last name"
                  autoComplete="family-name"
                  className="w-full border border-border rounded-xl px-3 py-2.5 pr-10 text-base sm:text-sm bg-white text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sonus-palette-blue)]/40"
                />
                <FieldValidCheck visible={signUpLastNameValid} />
              </div>
            </div>
          </div>
        )}

        {(mode === 'signin' || mode === 'signup' || mode === 'forgot') && (
          <div>
            <label htmlFor="auth-email" className="sr-only">Email</label>
            <div className="relative">
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
                className={`w-full rounded-xl px-3 py-2.5 pr-10 text-base sm:text-sm bg-white text-left focus-visible:outline-none focus-visible:ring-2 ${
                  mode === 'signup' && signUpEmailAvailable === false
                    ? 'border border-[var(--sonus-palette-rust)] focus-visible:ring-[var(--sonus-palette-rust)]/25'
                    : 'border border-border focus-visible:ring-[var(--sonus-palette-blue)]/40'
                }`}
              />
              <FieldValidCheck visible={mode === 'signup' && signUpEmailValid} />
            </div>
            {mode === 'signup' && signUpEmail.trim() ? (
              <p
                className={`mt-1 px-1 text-[11px] text-left ${
                  signUpEmailAvailable === false ? 'text-[var(--sonus-palette-rust)]' : 'text-[#64748B]'
                }`}
              >
                {!signUpEmailFormatValid && 'Enter a valid email address.'}
                {signUpEmailFormatValid && signUpEmailCheckLoading && 'Checking email availability...'}
                {signUpEmailFormatValid && !signUpEmailCheckLoading && signUpEmailAvailable === false && 'Email already in use.'}
                {signUpEmailFormatValid && !signUpEmailCheckLoading && signUpEmailAvailable === true && 'Email is available.'}
              </p>
            ) : null}
          </div>
        )}

        {(mode === 'signin' || mode === 'signup') && (
          <div className="mt-2 space-y-2">
            <div>
              <label htmlFor="auth-password" className="sr-only">Password</label>
              <div className="relative">
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
                  className="w-full border border-border rounded-xl px-3 py-2.5 pr-10 text-base sm:text-sm bg-white text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sonus-palette-blue)]/40"
                />
                <FieldValidCheck visible={mode === 'signup' && !signUpPasswordError && signUpPassword.length > 0} />
              </div>
            </div>
            {mode === 'signup' ? (
              <>
                <p className="text-[11px] text-text-med text-left px-1">
                  {PASSWORD_RULE_TEXT}
                </p>
                <PasswordStrengthMeter password={signUpPassword} />
              </>
            ) : null}
          </div>
        )}
        {mode === 'signup' && (
          <div className="mt-3 rounded-2xl border border-[var(--sonus-palette-charcoal)]/12 bg-[#F8FAFC] p-2.5 text-center">
            <div className="flex items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2 text-left">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0C4A6E]">
                  Required Review
                </p>
                <p className="mt-0.5 text-[11px] text-[#64748B]">
                  Open both policies to unlock consent.
                </p>
              </div>
              <div className="rounded-full border border-[#CBD5E1] bg-white px-2 py-1 text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--sonus-palette-charcoal)]">
                {[reviewedTerms, reviewedPrivacy].filter(Boolean).length}/2
              </div>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => openLegalDocument('terms')}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--sonus-palette-charcoal)]/15 bg-white px-3 py-2 text-xs font-medium text-[var(--sonus-palette-charcoal)] transition-colors hover:border-[var(--sonus-palette-blue)] hover:text-[var(--sonus-palette-blue)]"
              >
                Terms
                {reviewedTerms ? <Check className="h-3.5 w-3.5 text-[var(--sonus-palette-blue)]" aria-hidden="true" /> : null}
              </button>
              <button
                type="button"
                onClick={() => openLegalDocument('privacy')}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--sonus-palette-charcoal)]/15 bg-white px-3 py-2 text-xs font-medium text-[var(--sonus-palette-charcoal)] transition-colors hover:border-[var(--sonus-palette-blue)] hover:text-[var(--sonus-palette-blue)]"
              >
                Privacy
                {reviewedPrivacy ? <Check className="h-3.5 w-3.5 text-[var(--sonus-palette-blue)]" aria-hidden="true" /> : null}
              </button>
            </div>
            <div className="mt-2 space-y-2 text-left">
              <label
                className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-5 ${
                  legalReviewReady
                    ? 'border-[#CBD5E1] bg-white text-[var(--sonus-palette-charcoal)]'
                    : 'cursor-not-allowed border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={signUpAgreedToLegal}
                  onChange={(e) => setSignUpAgreedToLegal(e.target.checked)}
                  disabled={!legalReviewReady}
                  className="mt-0.5 h-4 w-4 rounded border-border text-[var(--sonus-palette-blue)] focus:ring-[var(--sonus-palette-blue)]/40 disabled:opacity-60"
                />
                <span>
                  I agree to the Terms and Privacy Policy.
                  {!legalReviewReady ? ' Review both first to enable this.' : ''}
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-[11px] leading-5 text-[var(--sonus-palette-charcoal)]">
                <input
                  type="checkbox"
                  checked={signUpConfirmedAge}
                  onChange={(e) => setSignUpConfirmedAge(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-[var(--sonus-palette-blue)] focus:ring-[var(--sonus-palette-blue)]/40"
                />
                <span>
                  I confirm I meet the minimum legal age to create this account.
                </span>
              </label>
            </div>
          </div>
        )}
        {mode === 'signin' && (
          <div className="mt-2">
            <label className="inline-flex items-center gap-2 text-xs text-text-med">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-border text-[var(--sonus-palette-blue)] focus:ring-[var(--sonus-palette-blue)]/40"
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
              <div className="relative">
                <input
                  id="reset-new-password"
                  type="password"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                  className="w-full border border-border rounded-xl px-3 py-2.5 pr-10 text-base sm:text-sm bg-white text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sonus-palette-blue)]/40"
                />
                <FieldValidCheck visible={!passwordCreationError(resetNewPassword) && resetNewPassword.length > 0} />
              </div>
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
                className="w-full border border-border rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sonus-palette-blue)]/40"
              />
            </div>
            <p className="text-[11px] text-text-med text-left px-1">
              {PASSWORD_RULE_TEXT}
            </p>
            <PasswordStrengthMeter password={resetNewPassword} />
          </div>
        )}

        <div className="mt-3 min-h-[1.25rem]">
          {error && <p className="text-sm text-[var(--sonus-palette-rust)]" role="status" aria-live="polite">{error}</p>}
          {message && <p className="text-sm text-[var(--sonus-palette-green)]" role="status" aria-live="polite">{message}</p>}
        </div>

        {mode !== 'demo' && (
          <button
            type="submit"
            disabled={submitDisabled}
            className="w-full mt-1 inline-flex items-center justify-center px-4 py-3 rounded-2xl bg-[var(--sonus-palette-charcoal)] text-white font-semibold hover:bg-[#111827] transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sonus-palette-blue)]/50"
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
            className="text-xs text-text-med underline underline-offset-2 hover:text-text-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sonus-palette-blue)]/40 rounded-sm"
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
              navigate('/home', { replace: true });
              onClose?.();
            }}
            disabled={loading}
            className="w-full mt-3 inline-flex items-center justify-center px-4 py-3 rounded-2xl bg-[var(--sonus-palette-charcoal)] text-white font-semibold hover:bg-[#111827] transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sonus-palette-blue)]/50"
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
            className="mt-3 rounded-sm text-sm text-text-med underline underline-offset-2 transition-colors hover:text-text-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sonus-palette-blue)]/40 disabled:opacity-60"
          >
            Back to Sign In
          </button>
        )}
      </div>
      {activeLegalDocument && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0F172A]/55 px-3 py-4 sm:px-6"
          role="dialog"
          aria-modal="true"
          aria-label={LEGAL_DOCUMENT_META[activeLegalDocument].title}
          onClick={() => setActiveLegalDocument(null)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-[42rem] flex-col overflow-hidden rounded-[28px] border border-[var(--sonus-palette-charcoal)]/10 bg-white shadow-[0_30px_80px_-36px_rgba(15,23,42,0.58)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative border-b border-[#E2E8F0] px-4 py-4 text-center sm:px-6">
              <div className="mx-auto max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0C4A6E]">Legal Review</p>
                <h2 className="main-font mt-1 text-2xl leading-tight text-[var(--sonus-palette-charcoal)]">
                  {LEGAL_DOCUMENT_META[activeLegalDocument].title}
                </h2>
                <p className="mt-1 text-xs text-[#64748B]">
                  Last updated: {LEGAL_DOCUMENT_META[activeLegalDocument].lastUpdated}. Scroll to the end to enable
                  Finish Review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveLegalDocument(null)}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-[#475569] transition-colors hover:bg-[#F1F5F9] hover:text-[var(--sonus-palette-charcoal)] sm:right-6"
                aria-label="Close legal document"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div
              ref={legalScrollRef}
              onScroll={updateLegalFinishState}
              className="flex-1 overflow-y-auto px-4 py-5 sm:px-6"
            >
              <div className="space-y-7 text-left text-[13px] leading-6 text-[#334155] sm:text-sm [&_section]:text-left [&_h2]:secondary-font [&_h2]:text-left [&_h2]:text-[1rem] [&_h2]:leading-snug sm:[&_h2]:text-[1.08rem] [&_h2]:text-[var(--sonus-palette-charcoal)] [&_p]:font-mono [&_p]:text-[13px] [&_p]:leading-6 sm:[&_p]:text-sm [&_ul]:font-mono [&_ul]:text-[13px] sm:[&_ul]:text-sm [&_li]:leading-6">
                {activeLegalDocument === 'terms' ? <TermsOfServiceContent /> : <PrivacyPolicyContent />}
              </div>
            </div>
            <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-relaxed text-[#64748B]">
                  Finish Review unlocks the signup consent checkbox for this document.
                </p>
                <button
                  type="button"
                  onClick={finishLegalReview}
                  disabled={!legalFinishEnabled}
                  className="inline-flex items-center justify-center rounded-2xl bg-[var(--sonus-palette-charcoal)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#111827] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Finish Review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return <div className="flex min-h-[calc(100svh-4rem)] w-full items-center justify-center">{formCard}</div>;
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
