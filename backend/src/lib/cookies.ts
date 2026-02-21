type CookieSameSite = 'lax' | 'strict' | 'none';

type CookieOptions = {
  maxAgeSeconds?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: CookieSameSite;
  domain?: string;
  path?: string;
};

function encode(value: string) {
  return encodeURIComponent(value);
}

export function parseCookies(cookieHeader: string | undefined) {
  const out = new Map<string, string>();
  if (!cookieHeader) return out;

  for (const pair of cookieHeader.split(';')) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const rawValue = trimmed.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out.set(key, decodeURIComponent(rawValue));
    } catch {
      out.set(key, rawValue);
    }
  }

  return out;
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}) {
  const parts = [`${name}=${encode(value)}`];
  if (options.domain) parts.push(`Domain=${options.domain}`);
  const path = options.path ?? '/';
  parts.push(`Path=${path}`);
  if (typeof options.maxAgeSeconds === 'number') {
    const maxAge = Math.max(0, Math.floor(options.maxAgeSeconds));
    parts.push(`Max-Age=${maxAge}`);
    if (maxAge === 0) {
      parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    }
  }
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) {
    const sameSite = options.sameSite[0].toUpperCase() + options.sameSite.slice(1).toLowerCase();
    parts.push(`SameSite=${sameSite}`);
  }
  return parts.join('; ');
}
