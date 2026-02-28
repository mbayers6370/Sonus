import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { API_BASE_URL } from '../lib/apiBase';
import { apiFetch } from '../lib/apiClient';
import {
  clearMockActivity,
  createMockUserId,
  clearAuthSession,
  ensureMockWindowScope,
  getAccessToken,
  getDemoMode,
  getMockIdentity,
  isMockActivityExpired,
  isAuthSessionExpired,
  setMockIdentity,
  setAuthSession,
  setDemoMode,
  touchMockActivity,
} from '../lib/authSession';

type AuthMode = 'mock' | 'supabase' | 'local' | 'unknown';
type AuthStatus = 'loading' | 'signed_out' | 'signed_in';

type AuthContextValue = {
  authMode: AuthMode;
  status: AuthStatus;
  email: string | null;
  isDemo: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    targetLanguage?: string;
    timezone?: string;
  }) => Promise<{ requiresEmailVerification: boolean }>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  continueAsDemo: () => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthApiResponse = {
  user?: {
    id?: string;
    email?: string | null;
  };
  accessToken?: string | null;
  refreshToken?: string | null;
  requiresEmailVerification?: boolean;
  error?: string;
  message?: string;
};

function resolveScopedAppStateKeyForIdentity(identity: { userId: string | null; email: string | null }) {
  const scope = (identity.userId || identity.email || 'anon')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_');
  return `sonus-app-state:${scope}`;
}

function clearLearningState() {
  try {
    const keysToRemove: string[] = [];
    for (let idx = 0; idx < window.localStorage.length; idx += 1) {
      const key = window.localStorage.key(idx);
      if (!key) continue;
      // Keep user-scoped learning state + last selected language across auth
      // transitions. Only clear anonymous leftovers to avoid stale bleed.
      if (key === 'sonus-app-state:anon') {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignore localStorage failures.
  }
}

async function readAuthResponse(response: Response): Promise<AuthApiResponse> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as AuthApiResponse;
  } catch {
    return { error: text };
  }
}

async function attemptRefreshAuthSession() {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    const payload = await readAuthResponse(response);
    if (!response.ok || !payload.accessToken) {
      return { ok: false, email: null as string | null };
    }

    setAuthSession(payload.accessToken);
    setMockIdentity(payload.user?.id ?? null, payload.user?.email ?? null);
    return { ok: true, email: payload.user?.email ?? null };
  } catch {
    return { ok: false, email: null as string | null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authMode, setAuthMode] = useState<AuthMode>('unknown');
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [email, setEmail] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearToSignedOut = useCallback(() => {
    const identity = getMockIdentity();
    const scopedAppStateKey = resolveScopedAppStateKeyForIdentity(identity);
    if (getDemoMode() || identity.email === 'dev@local.test') {
      try {
        window.localStorage.removeItem(scopedAppStateKey);
      } catch {
        // Ignore localStorage failures.
      }
    }
    setDemoMode(false);
    setMockIdentity(null, null);
    clearAuthSession();
    clearMockActivity();
    clearLearningState();
    setIsDemo(false);
    setEmail(null);
    setStatus('signed_out');
  }, []);

  const clearDemoStateOnly = useCallback(() => {
    setDemoMode(false);
    clearMockActivity();
    setIsDemo(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setStatus('loading');
      setError(null);
      if (isAuthSessionExpired()) {
        clearToSignedOut();
        return;
      }

      const isNewWindow = ensureMockWindowScope();
      const demoEnabledAtInit = getDemoMode();
      const demoIdleExpired = demoEnabledAtInit && isMockActivityExpired();
      const demoExpired = demoEnabledAtInit && (isNewWindow || demoIdleExpired);
      if (demoExpired) {
        clearDemoStateOnly();
        setMockIdentity(null, null);
      }

      try {
        const health = await fetch(`${API_BASE_URL}/health`);
        const healthJson = (await health.json()) as { authMode?: AuthMode };
        const mode = healthJson.authMode || 'unknown';
        if (cancelled) return;
        setAuthMode(mode);

        if (mode === 'mock') {
          const idleExpired = isMockActivityExpired();
          let mockIdentity = getMockIdentity();
          if (isNewWindow || idleExpired) {
            clearLearningState();
            const keepEmail = getDemoMode() ? 'dev@local.test' : (mockIdentity.email || null);
            const shouldKeepSignedIn = Boolean(getAccessToken() || mockIdentity.userId || keepEmail);
            const nextUserId = shouldKeepSignedIn ? createMockUserId() : null;
            setMockIdentity(nextUserId, keepEmail);
            mockIdentity = {
              userId: nextUserId,
              email: keepEmail,
            };
          }
          touchMockActivity();
          const hasMockUser = Boolean(mockIdentity.userId || mockIdentity.email);
          const hasToken = Boolean(getAccessToken());
          if (getDemoMode()) {
            if (!mockIdentity.userId) {
              setMockIdentity(createMockUserId(), 'dev@local.test');
            }
            setStatus('signed_in');
            setIsDemo(true);
            setEmail(mockIdentity.email || 'dev@local.test');
          } else if (hasMockUser || hasToken) {
            setStatus('signed_in');
            setIsDemo(false);
            setEmail(mockIdentity.email || null);
          } else {
            setStatus('signed_out');
            setIsDemo(false);
            setEmail(null);
          }
          return;
        }

        let token = getAccessToken();
        let refreshedEmail: string | null = null;
        if (!token) {
          const refreshed = await attemptRefreshAuthSession();
          if (refreshed.ok) {
            token = getAccessToken();
            refreshedEmail = refreshed.email;
          }
        }

        const demoEnabled = getDemoMode();
        const mockIdentity = getMockIdentity();
        const canResumeDemo =
          demoEnabled &&
          !demoExpired &&
          mockIdentity.email === 'dev@local.test' &&
          Boolean(mockIdentity.userId);

        if (token) {
          if (demoEnabled) setDemoMode(false);
        } else if (canResumeDemo) {
          const demoUserId = mockIdentity.userId || createMockUserId();
          const demoEmail = 'dev@local.test';
          setMockIdentity(demoUserId, demoEmail);
          touchMockActivity();
          setStatus('signed_in');
          setIsDemo(true);
          setEmail(demoEmail);
          return;
        }

        if (!token) {
          setStatus('signed_out');
          setIsDemo(false);
          setEmail(null);
          return;
        }

        const response = await apiFetch('/v1/me/profile');
        if (!response.ok) {
          // Only clear session on explicit auth failures.
          if (response.status === 401 || response.status === 403) {
            const refreshed = await attemptRefreshAuthSession();
            if (refreshed.ok) {
              const retry = await apiFetch('/v1/me/profile');
              if (retry.ok) {
                const profileJson = (await retry.json()) as { profile?: { email?: string | null } };
                setEmail(profileJson.profile?.email ?? refreshed.email ?? null);
                setIsDemo(false);
                setStatus('signed_in');
                return;
              }
            }

            clearAuthSession();
            setStatus('signed_out');
            setIsDemo(false);
            setEmail(null);
          } else {
            // Render cold starts / transient backend failures should not force logout.
            setStatus('signed_in');
            setIsDemo(false);
            if (refreshedEmail) setEmail(refreshedEmail);
          }
          return;
        }
        const profileJson = (await response.json()) as { profile?: { email?: string | null } };
        setEmail(profileJson.profile?.email ?? null);
        setIsDemo(false);
        setStatus('signed_in');
      } catch {
        if (cancelled) return;
        const token = getAccessToken();
        const demoEnabled = getDemoMode();
        const mockIdentity = getMockIdentity();
        const canResumeDemo =
          demoEnabled &&
          !demoExpired &&
          mockIdentity.email === 'dev@local.test' &&
          Boolean(mockIdentity.userId);
        if (token) {
          setStatus('signed_in');
          setIsDemo(false);
          setError('Backend temporarily unavailable. Retrying in background.');
        } else if (canResumeDemo) {
          const demoUserId = mockIdentity.userId || createMockUserId();
          const demoEmail = 'dev@local.test';
          setMockIdentity(demoUserId, demoEmail);
          touchMockActivity();
          setStatus('signed_in');
          setIsDemo(true);
          setEmail(demoEmail);
          setError('Backend temporarily unavailable. Demo mode is active.');
        } else {
          setError('Unable to initialize authentication.');
          setStatus('signed_out');
        }
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [clearDemoStateOnly, clearToSignedOut]);

  const signIn = useCallback(async (emailInput: string, password: string) => {
    setError(null);
    const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: emailInput.trim(),
        password,
      }),
    });
    const payload = await readAuthResponse(response);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Auth endpoint not found at ${API_BASE_URL}/v1/auth/login. Restart backend so /v1/auth routes are loaded.`);
      }
      throw new Error(payload.error || payload.message || 'Sign in failed');
    }
    setAuthSession(payload.accessToken ?? null);
    setMockIdentity(payload.user?.id ?? null, payload.user?.email ?? emailInput.trim());
    touchMockActivity();
    clearLearningState();
    setDemoMode(false);
    setIsDemo(false);
    setEmail(payload.user?.email ?? emailInput.trim());
    setStatus('signed_in');
  }, []);

  const signUp: AuthContextValue['signUp'] = useCallback(async (payloadInput) => {
    setError(null);
    const response = await fetch(`${API_BASE_URL}/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payloadInput),
    });
    const payload = await readAuthResponse(response);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Auth endpoint not found at ${API_BASE_URL}/v1/auth/signup. Restart backend so /v1/auth routes are loaded.`);
      }
      throw new Error(payload.error || payload.message || 'Sign up failed');
    }

    const requiresEmailVerification = Boolean(payload.requiresEmailVerification);
    setAuthSession(payload.accessToken ?? null);
    setMockIdentity(payload.user?.id ?? null, payload.user?.email ?? payloadInput.email.trim());
    touchMockActivity();
    clearLearningState();
    setDemoMode(false);
    setIsDemo(false);
    setEmail(payload.user?.email ?? payloadInput.email.trim());
    setStatus(requiresEmailVerification ? 'signed_out' : 'signed_in');
    return { requiresEmailVerification };
  }, []);

  const continueAsDemo = useCallback(() => {
    clearLearningState();
    setDemoMode(true);
    clearAuthSession();
    setMockIdentity(createMockUserId(), 'dev@local.test');
    touchMockActivity();
    setIsDemo(true);
    setEmail('dev@local.test');
    setStatus('signed_in');
  }, []);

  const requestPasswordReset = useCallback(async (emailInput: string) => {
    setError(null);
    const response = await fetch(`${API_BASE_URL}/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: emailInput.trim() }),
    });
    const payload = await readAuthResponse(response);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Auth endpoint not found at ${API_BASE_URL}/v1/auth/forgot-password. Deploy latest backend.`);
      }
      throw new Error(payload.error || payload.message || 'Unable to send reset email');
    }
  }, []);

  const resetPassword = useCallback(async (token: string, password: string) => {
    setError(null);
    const response = await fetch(`${API_BASE_URL}/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token, password }),
    });
    const payload = await readAuthResponse(response);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Auth endpoint not found at ${API_BASE_URL}/v1/auth/reset-password. Deploy latest backend.`);
      }
      throw new Error(payload.error || payload.message || 'Unable to reset password');
    }
    clearToSignedOut();
  }, [clearToSignedOut]);

  const signOut = useCallback(() => {
    void fetch(`${API_BASE_URL}/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    clearToSignedOut();
  }, [clearToSignedOut]);

  useEffect(() => {
    if (status !== 'signed_in') return;
    const timer = window.setInterval(() => {
      if (!isAuthSessionExpired()) return;
      clearToSignedOut();
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [clearToSignedOut, status]);

  useEffect(() => {
    const onAuthExpired = () => {
      clearToSignedOut();
    };
    window.addEventListener('sonus:auth-expired', onAuthExpired);
    return () => {
      window.removeEventListener('sonus:auth-expired', onAuthExpired);
    };
  }, [clearToSignedOut]);

  useEffect(() => {
    if (status !== 'signed_in' || !isDemo) return;

    const bump = () => touchMockActivity();
    const signOutForIdle = () => {
      clearToSignedOut();
      window.location.reload();
    };
    const checkForIdleReset = () => {
      if (!isMockActivityExpired()) return;
      signOutForIdle();
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (isMockActivityExpired()) {
        signOutForIdle();
        return;
      }
      bump();
    };

    window.addEventListener('pointerdown', bump);
    window.addEventListener('keydown', bump);
    window.addEventListener('touchstart', bump);
    document.addEventListener('visibilitychange', onVisibility);
    const timer = window.setInterval(checkForIdleReset, 60_000);

    return () => {
      window.removeEventListener('pointerdown', bump);
      window.removeEventListener('keydown', bump);
      window.removeEventListener('touchstart', bump);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
    };
  }, [clearToSignedOut, isDemo, status]);

  const value: AuthContextValue = {
    authMode,
    status,
    email,
    isDemo,
    error,
    signIn,
    signUp,
    requestPasswordReset,
    resetPassword,
    continueAsDemo,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
