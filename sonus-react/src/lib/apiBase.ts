const configuredBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

function resolveApiBaseUrl() {
  if (configuredBase) {
    // Remove trailing slashes so path joins stay consistent.
    return configuredBase.replace(/\/+$/, '');
  }

  // Production fallback: call same-origin backend when env is not set.
  if (import.meta.env.PROD) {
    return window.location.origin;
  }

  // Local dev fallback.
  return 'http://127.0.0.1:4000';
}

export const API_BASE_URL = resolveApiBaseUrl();
