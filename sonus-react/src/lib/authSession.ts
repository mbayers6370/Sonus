const DEMO_MODE_KEY = 'sonus.auth.demo_mode';
const MOCK_USER_ID_KEY = 'sonus.auth.mock_user_id';
const MOCK_USER_EMAIL_KEY = 'sonus.auth.mock_user_email';
const MOCK_WINDOW_ID_KEY = 'sonus.auth.mock_window_id';
const MOCK_LAST_ACTIVE_AT_KEY = 'sonus.auth.mock_last_active_at';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MOCK_IDLE_TTL_MS = 60 * 60 * 1000;
const LEGACY_ACCESS_TOKEN_KEY = 'sonus.auth.access_token';
const LEGACY_REFRESH_TOKEN_KEY = 'sonus.auth.refresh_token';
const LEGACY_SESSION_EXPIRES_AT_KEY = 'sonus.auth.expires_at';
const SESSION_ACCESS_TOKEN_KEY = 'sonus.auth.session_access_token';
const SESSION_ACCESS_TOKEN_EXPIRES_AT_KEY = 'sonus.auth.session_access_token_expires_at';

let accessTokenMemory: string | null = null;
let accessTokenExpiresAt = 0;

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
  accessTokenExpiresAt = Date.now() + SESSION_TTL_MS;
}

function clearSessionExpiry() {
  accessTokenExpiresAt = 0;
}

function hydrateAccessTokenFromSessionStorage() {
  if (accessTokenMemory) return;
  try {
    const token = window.sessionStorage.getItem(SESSION_ACCESS_TOKEN_KEY);
    const expiresAtRaw = window.sessionStorage.getItem(SESSION_ACCESS_TOKEN_EXPIRES_AT_KEY);
    const expiresAt = Number(expiresAtRaw || '0');
    if (!token || !Number.isFinite(expiresAt) || expiresAt <= 0) {
      window.sessionStorage.removeItem(SESSION_ACCESS_TOKEN_KEY);
      window.sessionStorage.removeItem(SESSION_ACCESS_TOKEN_EXPIRES_AT_KEY);
      return;
    }
    if (Date.now() >= expiresAt) {
      window.sessionStorage.removeItem(SESSION_ACCESS_TOKEN_KEY);
      window.sessionStorage.removeItem(SESSION_ACCESS_TOKEN_EXPIRES_AT_KEY);
      return;
    }
    accessTokenMemory = token;
    accessTokenExpiresAt = expiresAt;
  } catch {
    // Ignore storage failures.
  }
}

export function isAuthSessionExpired() {
  try {
    hydrateAccessTokenFromSessionStorage();
    if (!accessTokenMemory) return false;
    if (!Number.isFinite(accessTokenExpiresAt) || accessTokenExpiresAt <= 0) return false;
    return Date.now() >= accessTokenExpiresAt;
  } catch {
    return false;
  }
}

export function getAccessToken() {
  hydrateAccessTokenFromSessionStorage();
  return accessTokenMemory;
}

export function getRefreshToken() {
  return null;
}

export function setAuthSession(accessToken: string | null, refreshToken?: string | null) {
  void refreshToken;
  try {
    if (accessToken) {
      accessTokenMemory = accessToken;
      setSessionExpiry();
      window.sessionStorage.setItem(SESSION_ACCESS_TOKEN_KEY, accessTokenMemory);
      window.sessionStorage.setItem(SESSION_ACCESS_TOKEN_EXPIRES_AT_KEY, String(accessTokenExpiresAt));
    } else {
      accessTokenMemory = null;
      clearSessionExpiry();
      window.sessionStorage.removeItem(SESSION_ACCESS_TOKEN_KEY);
      window.sessionStorage.removeItem(SESSION_ACCESS_TOKEN_EXPIRES_AT_KEY);
    }
    // Clear legacy storage keys from previous implementations.
    window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_SESSION_EXPIRES_AT_KEY);
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
