import { API_BASE_URL } from './apiBase';
import {
  clearAuthSession,
  getAccessToken,
  getDemoMode,
  getMockIdentity,
  setAuthSession,
  setMockIdentity,
} from './authSession';

type RefreshPayload = {
  user?: {
    id?: string | null;
    email?: string | null;
  };
  accessToken?: string | null;
};

let refreshPromise: Promise<boolean> | null = null;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const TRANSIENT_RETRY_ATTEMPTS = 2;
const BASE_RETRY_DELAY_MS = 350;

function isAuthRoute(path: string) {
  return path.startsWith('/v1/auth/');
}

function normalizedMethod(init: RequestInit) {
  return (init.method || 'GET').toUpperCase();
}

function isIdempotentMethod(method: string) {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

function parseRetryAfterMs(retryAfterHeader: string | null) {
  if (!retryAfterHeader) return null;
  const seconds = Number(retryAfterHeader);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }
  const retryAt = Date.parse(retryAfterHeader);
  if (Number.isFinite(retryAt)) {
    return Math.max(0, retryAt - Date.now());
  }
  return null;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function backoffDelayMs(attempt: number) {
  const base = BASE_RETRY_DELAY_MS * (2 ** attempt);
  const jitter = Math.floor(Math.random() * 125);
  return base + jitter;
}

function shouldRetryStatus(response: Response, path: string, method: string) {
  if (isAuthRoute(path)) return false;
  if (!isIdempotentMethod(method)) return false;
  return RETRYABLE_STATUS_CODES.has(response.status);
}

function dispatchAuthExpired() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('sonus:auth-expired'));
}

async function readJson(response: Response): Promise<RefreshPayload> {
  try {
    return (await response.json()) as RefreshPayload;
  } catch {
    return {};
  }
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      const payload = await readJson(response);
      if (!response.ok || !payload.accessToken) {
        clearAuthSession();
        dispatchAuthExpired();
        return false;
      }
      setAuthSession(payload.accessToken);
      setMockIdentity(payload.user?.id ?? null, payload.user?.email ?? null);
      return true;
    } catch {
      clearAuthSession();
      dispatchAuthExpired();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function requestWithRetry(url: string, path: string, init: RequestInit, headers: Headers) {
  const method = normalizedMethod(init);
  let lastNetworkError: unknown = null;

  for (let attempt = 0; attempt <= TRANSIENT_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        headers,
        credentials: init.credentials ?? 'include',
      });

      if (attempt >= TRANSIENT_RETRY_ATTEMPTS || !shouldRetryStatus(response, path, method)) {
        return response;
      }

      const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
      const delayMs = retryAfterMs ?? backoffDelayMs(attempt);
      await sleep(delayMs);
    } catch (error) {
      lastNetworkError = error;
      const canRetryNetworkError =
        attempt < TRANSIENT_RETRY_ATTEMPTS &&
        !isAuthRoute(path) &&
        isIdempotentMethod(method);
      if (!canRetryNetworkError) throw error;
      await sleep(backoffDelayMs(attempt));
    }
  }

  if (lastNetworkError) throw lastNetworkError;
  throw new Error('Request failed');
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const url = path.startsWith('http://') || path.startsWith('https://')
    ? path
    : `${API_BASE_URL}${path}`;

  const headers = new Headers(init.headers || {});
  const token = getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const mockIdentity = getMockIdentity();
  if (mockIdentity.userId && !headers.has('x-dev-user-id')) {
    headers.set('x-dev-user-id', mockIdentity.userId);
  }
  if (mockIdentity.email && !headers.has('x-dev-user-email')) {
    headers.set('x-dev-user-email', mockIdentity.email);
  }

  const response = await requestWithRetry(url, path, init, headers);

  const canRetryWithRefresh =
    !getDemoMode() &&
    !isAuthRoute(path) &&
    (response.status === 401 || response.status === 403);
  if (!canRetryWithRefresh) {
    return response;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    return response;
  }

  const retryHeaders = new Headers(init.headers || {});
  const nextToken = getAccessToken();
  if (nextToken && !retryHeaders.has('Authorization')) {
    retryHeaders.set('Authorization', `Bearer ${nextToken}`);
  }

  const mockIdentityRetry = getMockIdentity();
  if (mockIdentityRetry.userId && !retryHeaders.has('x-dev-user-id')) {
    retryHeaders.set('x-dev-user-id', mockIdentityRetry.userId);
  }
  if (mockIdentityRetry.email && !retryHeaders.has('x-dev-user-email')) {
    retryHeaders.set('x-dev-user-email', mockIdentityRetry.email);
  }

  return requestWithRetry(url, path, init, retryHeaders);
}
