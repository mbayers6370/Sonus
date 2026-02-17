const ACCESS_TOKEN_KEY = 'sonus.auth.access_token';
const REFRESH_TOKEN_KEY = 'sonus.auth.refresh_token';
const DEMO_MODE_KEY = 'sonus.auth.demo_mode';
const MOCK_USER_ID_KEY = 'sonus.auth.mock_user_id';
const MOCK_USER_EMAIL_KEY = 'sonus.auth.mock_user_email';
const SESSION_EXPIRES_AT_KEY = 'sonus.auth.expires_at';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function setSessionExpiry() {
  window.localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(Date.now() + SESSION_TTL_MS));
}

function clearSessionExpiry() {
  window.localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
}

export function isAuthSessionExpired() {
  try {
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
      clearSessionExpiry();
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
