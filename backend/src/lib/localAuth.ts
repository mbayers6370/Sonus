import { createHmac, randomBytes, scrypt, timingSafeEqual, randomUUID } from 'node:crypto';
import { env } from '../env.js';

const SCRYPT_N = 1 << 16;
const SCRYPT_PRIVILEGED_N = 1 << 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;
const ACCESS_TOKEN_HEADER = { alg: 'HS256', typ: 'JWT' };

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLen: number,
  opts: { N: number; r: number; p: number }
) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLen,
      {
        ...opts,
        maxmem: 256 * 1024 * 1024,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey as Buffer);
      }
    );
  });
}

type AccessTokenPayload = {
  sub: string;
  email: string | null;
  iat: number;
  exp: number;
};

type RefreshSessionSnapshot = {
  replacedByHash: string | null;
  revokedAt: Date | null;
  expiresAt: Date;
};

function b64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromB64url(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function asJson<T>(value: Buffer) {
  return JSON.parse(value.toString('utf8')) as T;
}

function signingSecret() {
  if (!env.ACCESS_TOKEN_SECRET) {
    throw new Error('ACCESS_TOKEN_SECRET is required for local auth mode');
  }
  return env.ACCESS_TOKEN_SECRET;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return ['scrypt', SCRYPT_N, SCRYPT_R, SCRYPT_P, b64url(salt), b64url(derived)].join('$');
}

export async function hashPrivilegedPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_PRIVILEGED_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return ['scrypt', SCRYPT_PRIVILEGED_N, SCRYPT_R, SCRYPT_P, b64url(salt), b64url(derived)].join(
    '$'
  );
}

export async function verifyPassword(password: string, encoded: string) {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = fromB64url(parts[4]);
  const digest = fromB64url(parts[5]);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  const derived = await scryptAsync(password, salt, digest.length, {
    N: n,
    r,
    p,
  });
  if (derived.length !== digest.length) return false;
  return timingSafeEqual(derived, digest);
}

export function needsPasswordRehash(encoded: string, minN = SCRYPT_N) {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  return Number.isFinite(n) && n < minN;
}

function signTokenInput(encodedHeader: string, encodedPayload: string) {
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', signingSecret()).update(data).digest();
  return `${data}.${b64url(signature)}`;
}

export function createAccessToken(input: { userId: string; email: string | null }) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessTokenPayload = {
    sub: input.userId,
    email: input.email,
    iat: now,
    exp: now + env.ACCESS_TOKEN_TTL_SECONDS,
  };
  const encodedHeader = b64url(JSON.stringify(ACCESS_TOKEN_HEADER));
  const encodedPayload = b64url(JSON.stringify(payload));
  return signTokenInput(encodedHeader, encodedPayload);
}

export function verifyAccessToken(token: string) {
  const [headerRaw, payloadRaw, sigRaw] = token.split('.');
  if (!headerRaw || !payloadRaw || !sigRaw) return null;
  const expected = signTokenInput(headerRaw, payloadRaw);
  const expectedSigRaw = expected.split('.')[2];
  const providedSig = fromB64url(sigRaw);
  const expectedSig = fromB64url(expectedSigRaw);
  if (providedSig.length !== expectedSig.length) return null;
  if (!timingSafeEqual(providedSig, expectedSig)) return null;

  try {
    const payload = asJson<AccessTokenPayload>(fromB64url(payloadRaw));
    if (!payload?.sub || typeof payload.sub !== 'string') return null;
    if (!Number.isFinite(payload.exp) || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      userId: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : null,
    };
  } catch {
    return null;
  }
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createRefreshToken() {
  return b64url(randomBytes(48));
}

export function hashRefreshToken(token: string) {
  return createHmac('sha256', signingSecret()).update(token).digest('hex');
}

export function createPasswordResetToken() {
  return b64url(randomBytes(32));
}

export function hashPasswordResetToken(token: string) {
  return createHmac('sha256', signingSecret()).update(`pw-reset:${token}`).digest('hex');
}

export function refreshExpiryDate() {
  return new Date(Date.now() + env.REFRESH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function createRefreshFamilyId() {
  return randomUUID();
}

export function evaluateRefreshRotationState(session: RefreshSessionSnapshot, now = new Date()) {
  if (session.replacedByHash) return 'reuse_detected' as const;
  if (session.revokedAt) return 'invalid' as const;
  if (session.expiresAt <= now) return 'invalid' as const;
  return 'rotate' as const;
}
