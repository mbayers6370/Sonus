import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { API_BASE_URL } from '../lib/apiBase';
import { apiFetch } from '../lib/apiClient';
import {
  clearAuthSession,
  getAccessToken,
  getDemoMode,
  getMockIdentity,
  isAuthSessionExpired,
  setMockIdentity,
  setAuthSession,
  setDemoMode,
} from '../lib/authSession';

type AuthMode = 'mock' | 'supabase' | 'unknown';
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

function clearLearningState() {
  try {
    window.localStorage.removeItem('sonus-app-state');
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authMode, setAuthMode] = useState<AuthMode>('unknown');
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [email, setEmail] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setStatus('loading');
      setError(null);
      try {
        const health = await fetch(`${API_BASE_URL}/health`);
        const healthJson = (await health.json()) as { authMode?: AuthMode };
        const mode = healthJson.authMode || 'unknown';
        if (cancelled) return;
        setAuthMode(mode);

        if (isAuthSessionExpired()) {
          clearAuthSession();
          setDemoMode(false);
          setMockIdentity(null, null);
          clearLearningState();
          setStatus('signed_out');
          setIsDemo(false);
          setEmail(null);
          return;
        }

        if (mode === 'mock') {
          const mockIdentity = getMockIdentity();
          const hasMockUser = Boolean(mockIdentity.userId || mockIdentity.email);
          const hasToken = Boolean(getAccessToken());
          if (getDemoMode()) {
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

        const token = getAccessToken();
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
            clearAuthSession();
            setStatus('signed_out');
            setIsDemo(false);
            setEmail(null);
          } else {
            // Render cold starts / transient backend failures should not force logout.
            const mockIdentity = getMockIdentity();
            setStatus('signed_in');
            setIsDemo(false);
            setEmail(mockIdentity.email || null);
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
        if (token) {
          const mockIdentity = getMockIdentity();
          setStatus('signed_in');
          setIsDemo(false);
          setEmail(mockIdentity.email || null);
          setError('Backend temporarily unavailable. Retrying in background.');
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
  }, []);

  const signIn = async (emailInput: string, password: string) => {
    setError(null);
    const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    setAuthSession(payload.accessToken ?? null, payload.refreshToken ?? null);
    setMockIdentity(payload.user?.id ?? null, payload.user?.email ?? emailInput.trim());
    clearLearningState();
    setDemoMode(false);
    setIsDemo(false);
    setEmail(payload.user?.email ?? emailInput.trim());
    setStatus('signed_in');
  };

  const signUp: AuthContextValue['signUp'] = async (payloadInput) => {
    setError(null);
    const response = await fetch(`${API_BASE_URL}/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    setAuthSession(payload.accessToken ?? null, payload.refreshToken ?? null);
    setMockIdentity(payload.user?.id ?? null, payload.user?.email ?? payloadInput.email.trim());
    clearLearningState();
    setDemoMode(false);
    setIsDemo(false);
    setEmail(payload.user?.email ?? payloadInput.email.trim());
    setStatus(requiresEmailVerification ? 'signed_out' : 'signed_in');
    return { requiresEmailVerification };
  };

  const continueAsDemo = () => {
    if (authMode === 'supabase') return;
    clearLearningState();
    setDemoMode(true);
    setMockIdentity(null, 'dev@local.test');
    setIsDemo(true);
    setEmail('dev@local.test');
    setStatus('signed_in');
  };

  const signOut = () => {
    if (authMode === 'mock') {
      setDemoMode(false);
    }
    setMockIdentity(null, null);
    clearAuthSession();
    clearLearningState();
    setIsDemo(false);
    setEmail(null);
    setStatus('signed_out');
  };

  useEffect(() => {
    if (status !== 'signed_in') return;
    const timer = window.setInterval(() => {
      if (!isAuthSessionExpired()) return;
      setDemoMode(false);
      setMockIdentity(null, null);
      clearAuthSession();
      clearLearningState();
      setIsDemo(false);
      setEmail(null);
      setStatus('signed_out');
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [status]);

  const value = useMemo<AuthContextValue>(
    () => ({
      authMode,
      status,
      email,
      isDemo,
      error,
      signIn,
      signUp,
      continueAsDemo,
      signOut,
    }),
    [authMode, email, error, isDemo, status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
