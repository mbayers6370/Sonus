import { API_BASE_URL } from './apiBase';
import { clearAuthSession, getAccessToken, getMockIdentity, setAuthSession, setMockIdentity } from './authSession';

type RefreshPayload = {
  user?: {
    id?: string | null;
    email?: string | null;
  };
  accessToken?: string | null;
};

let refreshPromise: Promise<boolean> | null = null;

function isAuthRoute(path: string) {
  return path.startsWith('/v1/auth/');
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
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
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

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
  });

  const hasAuthToken = Boolean(token);
  const canRetryWithRefresh = hasAuthToken && !isAuthRoute(path) && (response.status === 401 || response.status === 403);
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

  return fetch(url, {
    ...init,
    headers: retryHeaders,
    credentials: init.credentials ?? 'include',
  });
}
