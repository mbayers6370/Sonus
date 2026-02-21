const ACCESS_TOKEN_KEY = 'sonus.auth.access_token';
const REFRESH_TOKEN_KEY = 'sonus.auth.refresh_token';
const DEMO_MODE_KEY = 'sonus.auth.demo_mode';
const MOCK_USER_ID_KEY = 'sonus.auth.mock_user_id';
const MOCK_USER_EMAIL_KEY = 'sonus.auth.mock_user_email';
const SESSION_EXPIRES_AT_KEY = 'sonus.auth.expires_at';
const MOCK_WINDOW_ID_KEY = 'sonus.auth.mock_window_id';
const MOCK_LAST_ACTIVE_AT_KEY = 'sonus.auth.mock_last_active_at';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MOCK_IDLE_TTL_MS = 60 * 60 * 1000;

function randomHex(length: number) {
  let out = '';
  while (out.length < length) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out.slice(0, length);
}

export function createMockUserId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // UUID v4 shape fallback.
  return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-a${randomHex(3)}-${randomHex(12)}`;
}

function setSessionExpiry() {
  window.localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(Date.now() + SESSION_TTL_MS));
}

function clearSessionExpiry() {
  window.localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
}

export function isAuthSessionExpired() {
  try {
    // If we have a refresh token, prefer server-side session validity over local TTL.
    const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) return false;

    const raw = window.localStorage.getItem(SESSION_EXPIRES_AT_KEY);
    if (!raw) return false;
    const expiresAt = Number(raw);
    if (!Number.isFinite(expiresAt)) return false;
    return Date.now() >= expiresAt;
  } catch {
    return false;
  }
}

export function getAccessToken() {
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken() {
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthSession(accessToken: string | null, refreshToken?: string | null) {
  try {
    if (accessToken) {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      setSessionExpiry();
    } else {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      clearSessionExpiry();
    }
    if (refreshToken) {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } else {
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // Ignore localStorage failures.
  }
}

export function clearAuthSession() {
  setAuthSession(null, null);
}

export function getDemoMode() {
  try {
    return window.localStorage.getItem(DEMO_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDemoMode(enabled: boolean) {
  try {
    if (enabled) {
      window.localStorage.setItem(DEMO_MODE_KEY, '1');
      setSessionExpiry();
    } else {
      window.localStorage.removeItem(DEMO_MODE_KEY);
    }
  } catch {
    // Ignore localStorage failures.
  }
}

export function getMockIdentity() {
  try {
    return {
      userId: window.localStorage.getItem(MOCK_USER_ID_KEY),
      email: window.localStorage.getItem(MOCK_USER_EMAIL_KEY),
    };
  } catch {
    return { userId: null, email: null };
  }
}

export function setMockIdentity(userId: string | null, email: string | null) {
  try {
    if (userId) {
      window.localStorage.setItem(MOCK_USER_ID_KEY, userId);
    } else {
      window.localStorage.removeItem(MOCK_USER_ID_KEY);
    }
    if (email) {
      window.localStorage.setItem(MOCK_USER_EMAIL_KEY, email);
    } else {
      window.localStorage.removeItem(MOCK_USER_EMAIL_KEY);
    }
  } catch {
    // Ignore localStorage failures.
  }
}

export function ensureMockWindowScope() {
  try {
    const existing = window.sessionStorage.getItem(MOCK_WINDOW_ID_KEY);
    if (existing) return false;
    window.sessionStorage.setItem(MOCK_WINDOW_ID_KEY, createMockUserId());
    return true;
  } catch {
    return false;
  }
}

export function touchMockActivity() {
  try {
    window.localStorage.setItem(MOCK_LAST_ACTIVE_AT_KEY, String(Date.now()));
  } catch {
    // Ignore localStorage failures.
  }
}

export function isMockActivityExpired() {
  try {
    const raw = window.localStorage.getItem(MOCK_LAST_ACTIVE_AT_KEY);
    if (!raw) return false;
    const lastActive = Number(raw);
    if (!Number.isFinite(lastActive)) return false;
    return Date.now() - lastActive > MOCK_IDLE_TTL_MS;
  } catch {
    return false;
  }
}

export function clearMockActivity() {
  try {
    window.localStorage.removeItem(MOCK_LAST_ACTIVE_AT_KEY);
  } catch {
    // Ignore localStorage failures.
  }
}
