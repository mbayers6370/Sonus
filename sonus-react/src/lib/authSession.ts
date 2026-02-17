const ACCESS_TOKEN_KEY = 'sonus.auth.access_token';
const REFRESH_TOKEN_KEY = 'sonus.auth.refresh_token';
const DEMO_MODE_KEY = 'sonus.auth.demo_mode';
const MOCK_USER_ID_KEY = 'sonus.auth.mock_user_id';
const MOCK_USER_EMAIL_KEY = 'sonus.auth.mock_user_email';

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
    } else {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
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
