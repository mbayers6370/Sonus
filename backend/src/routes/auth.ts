import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { env } from '../env.js';
import { prisma } from '../lib/prisma.js';
import { getOrCreateProfile, upsertProfile } from '../services/profileService.js';
import { sendPasswordResetEmail } from '../services/passwordResetEmailService.js';
import { getSupabaseAuthClient } from '../lib/supabase.js';
import { parseCookies, serializeCookie } from '../lib/cookies.js';
import { readAllowedOrigins, requireTrustedOrigin } from '../lib/originPolicy.js';
import { createLoginThrottle } from '../lib/loginThrottle.js';
import {
  createPasswordResetToken,
  createAccessToken,
  createRefreshFamilyId,
  createRefreshToken,
  evaluateRefreshRotationState,
  hashPasswordResetToken,
  hashPassword,
  hashRefreshToken,
  needsPasswordRehash,
  normalizeEmail,
  refreshExpiryDate,
  verifyPassword,
} from '../lib/localAuth.js';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  targetLanguage: z.string().trim().min(2).max(12).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().optional(),
});

const refreshSchema = z.object({});
const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
const resetPasswordSchema = z.object({
  token: z.string().min(20).max(512),
  password: z.string().min(8).max(128),
});
const throttleResetSchema = z.object({
  email: z.string().email().optional(),
  ip: z.string().trim().min(1).max(128).optional(),
  all: z.boolean().optional(),
});

const REFRESH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const REMEMBER_COOKIE_NAME = 'sonus_remember_me';
const allowedOrigins = readAllowedOrigins();
const loginThrottle = createLoginThrottle({
  enabled: env.LOGIN_THROTTLE_ENABLED,
  threshold: env.LOGIN_THROTTLE_THRESHOLD,
  baseDelayMs: env.LOGIN_THROTTLE_BASE_MS,
  maxDelayMs: env.LOGIN_THROTTLE_MAX_MS,
  resetAfterMs: env.LOGIN_THROTTLE_RESET_MS,
});
const forgotPasswordThrottle = createLoginThrottle({
  enabled: env.PASSWORD_RESET_THROTTLE_ENABLED,
  threshold: env.PASSWORD_RESET_REQUEST_THRESHOLD,
  baseDelayMs: env.PASSWORD_RESET_REQUEST_WINDOW_MS,
  maxDelayMs: env.PASSWORD_RESET_REQUEST_WINDOW_MS,
  resetAfterMs: env.PASSWORD_RESET_REQUEST_WINDOW_MS,
});
const resetPasswordThrottle = createLoginThrottle({
  enabled: env.PASSWORD_RESET_THROTTLE_ENABLED,
  threshold: env.PASSWORD_RESET_CONSUME_THRESHOLD,
  baseDelayMs: env.PASSWORD_RESET_CONSUME_WINDOW_MS,
  maxDelayMs: env.PASSWORD_RESET_CONSUME_WINDOW_MS,
  resetAfterMs: env.PASSWORD_RESET_CONSUME_WINDOW_MS,
});

function readHeader(value: string | string[] | undefined) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] : value;
}

function requestClientInfo(request: {
  ip: string;
  headers: Record<string, string | string[] | undefined>;
}) {
  // Snapshot lightweight client metadata for security audit/session records.
  return {
    ip: request.ip || null,
    userAgent: readHeader(request.headers['user-agent']),
  };
}

type CookieReply = {
  header: (name: string, value: string | string[]) => unknown;
  getHeader?: (name: string) => unknown;
};
type RefreshDebugResult = 'ok' | 'error';
type RefreshDebugReason =
  | 'invalid_payload'
  | 'missing_refresh_cookie'
  | 'local_no_session'
  | 'local_reuse_detected'
  | 'local_invalid_session_state'
  | 'local_account_missing'
  | 'local_rotated'
  | 'supabase_refresh_failed'
  | 'supabase_rotated'
  | 'refresh_not_supported';

function setRefreshCookie(reply: CookieReply, refreshToken: string, persistent: boolean) {
  // Store refresh token as an HttpOnly cookie; persistence is controlled by remember-me.
  appendSetCookie(
    reply,
    serializeCookie(env.AUTH_COOKIE_NAME, refreshToken, {
      domain: env.AUTH_COOKIE_DOMAIN,
      path: '/',
      maxAgeSeconds: persistent ? REFRESH_COOKIE_MAX_AGE_SECONDS : undefined,
      httpOnly: true,
      secure: env.AUTH_COOKIE_SECURE,
      sameSite: env.AUTH_COOKIE_SAME_SITE,
    })
  );
}

function setRememberCookie(reply: CookieReply, persistent: boolean) {
  appendSetCookie(
    reply,
    serializeCookie(REMEMBER_COOKIE_NAME, persistent ? '1' : '0', {
      domain: env.AUTH_COOKIE_DOMAIN,
      path: '/',
      maxAgeSeconds: persistent ? REFRESH_COOKIE_MAX_AGE_SECONDS : undefined,
      httpOnly: true,
      secure: env.AUTH_COOKIE_SECURE,
      sameSite: env.AUTH_COOKIE_SAME_SITE,
    })
  );
}

function clearRefreshCookie(reply: CookieReply) {
  appendSetCookie(
    reply,
    serializeCookie(env.AUTH_COOKIE_NAME, '', {
      domain: env.AUTH_COOKIE_DOMAIN,
      path: '/',
      maxAgeSeconds: 0,
      httpOnly: true,
      secure: env.AUTH_COOKIE_SECURE,
      sameSite: env.AUTH_COOKIE_SAME_SITE,
    })
  );
}

function clearRememberCookie(reply: CookieReply) {
  appendSetCookie(
    reply,
    serializeCookie(REMEMBER_COOKIE_NAME, '', {
      domain: env.AUTH_COOKIE_DOMAIN,
      path: '/',
      maxAgeSeconds: 0,
      httpOnly: true,
      secure: env.AUTH_COOKIE_SECURE,
      sameSite: env.AUTH_COOKIE_SAME_SITE,
    })
  );
}

function appendSetCookie(reply: CookieReply, cookieValue: string) {
  const existing = reply.getHeader?.('Set-Cookie');
  if (!existing) {
    reply.header('Set-Cookie', cookieValue);
    return;
  }
  if (Array.isArray(existing)) {
    reply.header('Set-Cookie', [...existing, cookieValue]);
    return;
  }
  reply.header('Set-Cookie', [String(existing), cookieValue]);
}

function setRefreshDebugHeaders(
  reply: CookieReply,
  params: {
    result: RefreshDebugResult;
    reason: RefreshDebugReason;
    requestId?: string;
  }
) {
  reply.header('X-Auth-Refresh-Result', params.result);
  reply.header('X-Auth-Refresh-Reason', params.reason);
  if (params.requestId) {
    reply.header('X-Request-Id', params.requestId);
  }
}

function resolveResetUrlBase(request: { headers: Record<string, string | string[] | undefined> }) {
  // Resolve reset URL in priority order: explicit env -> request origin -> first allowlisted origin.
  const configured = env.RESET_URL_BASE?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const fromOrigin = readHeader(request.headers.origin)?.trim();
  if (fromOrigin) return fromOrigin.replace(/\/$/, '');
  const fromAllowlist = Array.from(allowedOrigins)[0]?.trim();
  if (fromAllowlist) return fromAllowlist.replace(/\/$/, '');
  return null;
}

async function logAuthSecurityEvent(params: {
  eventType: string;
  targetUserId?: string | null;
  actorEmail?: string | null;
  detail?: string;
  endpoint?: string;
  ip?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.$executeRaw`
      INSERT INTO account_security_events
        (id, target_user_id, actor_user_id, actor_email, event_type, detail, metadata_json, created_at)
      VALUES
        (
          gen_random_uuid(),
          ${params.targetUserId || env.DEV_USER_ID}::uuid,
          null,
          ${params.actorEmail || null},
          ${params.eventType},
          ${params.detail || null},
          ${JSON.stringify({
            endpoint: params.endpoint || null,
            ip: params.ip || null,
            ...(params.metadata || {}),
          })}::jsonb,
          now()
        )
    `;
  } catch {
    // Best-effort signal only; auth flow must not fail if telemetry insert fails.
  }
}

export async function authRoutes(app: FastifyInstance) {
  // Public endpoint. Accepts email and always returns a generic response to avoid account enumeration.
  app.post('/v1/auth/forgot-password', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

    const parsed = forgotPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    const genericResponse = {
      ok: true,
      message: 'If an account exists for that email, a reset link has been sent.',
    };
    const identity = {
      email: normalizeEmail(parsed.data.email),
      ip: request.ip || 'unknown',
    };
    const throttleDecision = forgotPasswordThrottle.check(identity);
    if (!throttleDecision.allowed) {
      await logAuthSecurityEvent({
        eventType: 'auth_error_forgot_password_throttled',
        actorEmail: identity.email,
        detail: 'Forgot-password request throttled due to too many attempts.',
        endpoint: '/v1/auth/forgot-password',
        ip: request.ip || null,
      });
      reply
        .code(429)
        .header('Retry-After', throttleDecision.retryAfterSeconds.toString())
        .send({ error: 'Too many reset requests. Try again later.' });
      return;
    }

    if (env.AUTH_MODE === 'local') {
      const email = identity.email;
      const account = await prisma.localAuthCredential.findUnique({
        where: { email },
      });
      if (!account) {
        forgotPasswordThrottle.registerFailure(identity);
        reply.send(genericResponse);
        return;
      }

      const resetBase = resolveResetUrlBase(request);
      if (!resetBase) {
        console.error('[auth] RESET_URL_BASE is not configured; cannot send password reset email.');
        forgotPasswordThrottle.registerFailure(identity);
        reply.send(genericResponse);
        return;
      }

      const rawToken = createPasswordResetToken();
      const tokenHash = hashPasswordResetToken(rawToken);
      const expiresAt = new Date(Date.now() + env.RESET_TOKEN_TTL_MINUTES * 60_000);
      const client = requestClientInfo(request);
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`DELETE FROM password_reset_tokens WHERE user_id = ${account.userId}::uuid AND used_at IS NULL`;
        await tx.$executeRaw`
          INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_ip, user_agent, created_at)
          VALUES (gen_random_uuid(), ${account.userId}::uuid, ${tokenHash}, ${expiresAt}, ${client.ip}, ${client.userAgent}, now())
        `;
      });

      const resetUrl = `${resetBase}/?reset_token=${encodeURIComponent(rawToken)}`;
      await sendPasswordResetEmail({
        to: email,
        resetUrl,
      });
      forgotPasswordThrottle.registerFailure(identity);
      reply.send(genericResponse);
      return;
    }

    if (env.AUTH_MODE === 'supabase') {
      const supabase = getSupabaseAuthClient();
      await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: resolveResetUrlBase(request) || undefined,
      });
    }

    forgotPasswordThrottle.registerFailure(identity);
    reply.send(genericResponse);
  });

  // Public endpoint. Consumes password reset token and revokes existing refresh sessions on success.
  app.post('/v1/auth/reset-password', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

    const parsed = resetPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    if (env.AUTH_MODE !== 'local') {
      reply.code(400).send({ error: 'Password reset is only available in local auth mode.' });
      return;
    }

    const tokenHash = hashPasswordResetToken(parsed.data.token);
    const identity = {
      email: `pw-reset:${tokenHash.slice(0, 24)}`,
      ip: request.ip || 'unknown',
    };
    const throttleDecision = resetPasswordThrottle.check(identity);
    if (!throttleDecision.allowed) {
      await logAuthSecurityEvent({
        eventType: 'auth_error_reset_password_throttled',
        detail: 'Reset-password request throttled due to too many attempts.',
        endpoint: '/v1/auth/reset-password',
        ip: request.ip || null,
      });
      reply
        .code(429)
        .header('Retry-After', throttleDecision.retryAfterSeconds.toString())
        .send({ error: 'Too many reset attempts. Try again later.' });
      return;
    }
    const tokenRows = await prisma.$queryRaw<
      Array<{ id: string; user_id: string; expires_at: Date; used_at: Date | null }>
    >`SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ${tokenHash} LIMIT 1`;
    const tokenRow = tokenRows[0] ?? null;
    const now = new Date();
    if (!tokenRow || tokenRow.used_at || tokenRow.expires_at <= now) {
      resetPasswordThrottle.registerFailure(identity);
      reply.code(400).send({ error: 'Reset link is invalid or expired.' });
      return;
    }

    const newPasswordHash = await hashPassword(parsed.data.password);
    await prisma.$transaction(async (tx) => {
      await tx.localAuthCredential.update({
        where: { userId: tokenRow.user_id },
        data: { passwordHash: newPasswordHash },
      });
      await tx.$executeRaw`UPDATE password_reset_tokens SET used_at = ${now} WHERE id = ${tokenRow.id}::uuid`;
      await tx.$executeRaw`UPDATE password_reset_tokens SET used_at = ${now} WHERE user_id = ${tokenRow.user_id}::uuid AND used_at IS NULL`;
      await tx.refreshSession.updateMany({
        where: { userId: tokenRow.user_id, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'password_reset' },
      });
    });

    clearRefreshCookie(reply);
    resetPasswordThrottle.registerSuccess(identity);
    reply.send({ ok: true });
  });

  // Public endpoint. Creates account/profile and returns auth session material for configured auth mode.
  app.post('/v1/auth/signup', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    if (env.AUTH_MODE === 'local') {
      const email = normalizeEmail(parsed.data.email);
      const existing = await prisma.localAuthCredential.findUnique({
        where: { email },
      });
      if (existing) {
        reply.code(409).send({ error: 'Email already exists. Sign in instead.' });
        return;
      }

      const userId = randomUUID();
      const displayName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();
      const passwordHash = await hashPassword(parsed.data.password);
      const sessionToken = createRefreshToken();
      const sessionTokenHash = hashRefreshToken(sessionToken);
      const familyId = createRefreshFamilyId();
      const expiresAt = refreshExpiryDate();
      const client = requestClientInfo(request);

      const profile = await prisma.$transaction(async (tx) => {
        await tx.localAuthCredential.create({
          data: {
            userId,
            email,
            passwordHash,
          },
        });
        return tx.profile.create({
          data: {
            userId,
            email,
            displayName,
            targetLanguage: parsed.data.targetLanguage,
            timezone: parsed.data.timezone,
            onboardingComplete: false,
          },
        });
      });

      await prisma.refreshSession.create({
        data: {
          userId,
          tokenHash: sessionTokenHash,
          familyId,
          createdIp: client.ip,
          createdUserAgent: client.userAgent,
          expiresAt,
        },
      });

      const accessToken = createAccessToken({ userId, email });
      setRefreshCookie(reply, sessionToken, true);
      setRememberCookie(reply, true);
      reply.send({
        user: { id: userId, email },
        profile,
        accessToken,
        requiresEmailVerification: false,
      });
      return;
    }

    if (env.AUTH_MODE === 'mock') {
      const email = normalizeEmail(parsed.data.email);
      const existing = await prisma.profile.findFirst({
        where: { email },
        orderBy: { createdAt: 'asc' },
      });
      if (existing) {
        reply.code(409).send({ error: 'Email already exists. Sign in instead.' });
        return;
      }
      const userId = randomUUID();
      const displayName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();
      const profile = await upsertProfile({
        userId,
        email,
        displayName,
        targetLanguage: parsed.data.targetLanguage,
        timezone: parsed.data.timezone,
        onboardingComplete: false,
      });
      reply.send({
        user: { id: userId, email },
        profile,
        accessToken: null,
        requiresEmailVerification: false,
      });
      return;
    }

    const supabase = getSupabaseAuthClient();
    const displayName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName,
          display_name: displayName,
        },
      },
    });

    if (error || !data.user) {
      reply.code(400).send({ error: error?.message || 'Unable to sign up' });
      return;
    }

    const profile = await upsertProfile({
      userId: data.user.id,
      email: data.user.email ?? parsed.data.email,
      displayName,
      targetLanguage: parsed.data.targetLanguage,
      timezone: parsed.data.timezone,
      onboardingComplete: false,
    });

    if (data.session?.refresh_token) {
      setRefreshCookie(reply, data.session.refresh_token, true);
      setRememberCookie(reply, true);
    }
    reply.send({
      user: { id: data.user.id, email: data.user.email ?? parsed.data.email },
      profile,
      accessToken: data.session?.access_token ?? null,
      requiresEmailVerification: !data.session,
    });
    if (!data.session) {
      await logAuthSecurityEvent({
        eventType: 'email_verification_required',
        targetUserId: data.user.id,
        actorEmail: data.user.email ?? parsed.data.email,
        detail: 'Signup completed but email verification is required before first session.',
        endpoint: '/v1/auth/signup',
        ip: request.ip || null,
      });
    }
  });

  // Public endpoint. Authenticates credentials, applies login throttling, and establishes session cookies.
  app.post('/v1/auth/login', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      await logAuthSecurityEvent({
        eventType: 'auth_error_invalid_payload',
        actorEmail: null,
        detail: 'Login request payload validation failed.',
        endpoint: '/v1/auth/login',
        ip: request.ip || null,
      });
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }
    const identity = {
      email: parsed.data.email.trim().toLowerCase(),
      ip: request.ip || 'unknown',
    };
    const rememberMe = parsed.data.rememberMe ?? true;
    const throttleDecision = loginThrottle.check(identity);
    if (!throttleDecision.allowed) {
      await logAuthSecurityEvent({
        eventType: 'auth_error_throttled',
        actorEmail: identity.email,
        detail: 'Login throttled due to too many attempts.',
        endpoint: '/v1/auth/login',
        ip: request.ip || null,
      });
      reply
        .code(429)
        .header('Retry-After', throttleDecision.retryAfterSeconds.toString())
        .send({ error: 'Too many login attempts. Try again later.' });
      return;
    }

    const rejectInvalidCredentials = async (reason: string) => {
      loginThrottle.registerFailure(identity);
      await logAuthSecurityEvent({
        eventType: 'auth_login_failed',
        actorEmail: identity.email,
        detail: `Login failed: ${reason}`,
        endpoint: '/v1/auth/login',
        ip: request.ip || null,
        metadata: { reason },
      });
      await logAuthSecurityEvent({
        eventType: 'auth_error_login_invalid_credentials',
        actorEmail: identity.email,
        detail: `Auth error: ${reason}`,
        endpoint: '/v1/auth/login',
        ip: request.ip || null,
        metadata: { reason },
      });
      reply.code(401).send({ error: 'Invalid email or password' });
    };

    if (env.AUTH_MODE === 'local') {
      const email = normalizeEmail(parsed.data.email);
      const account = await prisma.localAuthCredential.findUnique({
        where: { email },
      });
      if (!account) {
        await rejectInvalidCredentials('account_not_found');
        return;
      }
      const passwordValid = await verifyPassword(parsed.data.password, account.passwordHash);
      if (!passwordValid) {
        await rejectInvalidCredentials('invalid_password');
        return;
      }
      if (needsPasswordRehash(account.passwordHash)) {
        const upgradedPasswordHash = await hashPassword(parsed.data.password);
        await prisma.localAuthCredential
          .update({
            where: { userId: account.userId },
            data: { passwordHash: upgradedPasswordHash },
          })
          .catch(() => null);
      }

      const profile = await getOrCreateProfile(account.userId, account.email);
      const sessionToken = createRefreshToken();
      const sessionTokenHash = hashRefreshToken(sessionToken);
      const familyId = createRefreshFamilyId();
      const expiresAt = refreshExpiryDate();
      const client = requestClientInfo(request);
      const [knownIpSession, knownDeviceSession] = await Promise.all([
        client.ip
          ? prisma.refreshSession.findFirst({
              where: {
                userId: account.userId,
                createdIp: client.ip,
              },
              select: { id: true },
            })
          : null,
        client.userAgent
          ? prisma.refreshSession.findFirst({
              where: {
                userId: account.userId,
                createdUserAgent: client.userAgent,
              },
              select: { id: true },
            })
          : null,
      ]);

      await prisma.refreshSession.create({
        data: {
          userId: account.userId,
          tokenHash: sessionTokenHash,
          familyId,
          createdIp: client.ip,
          createdUserAgent: client.userAgent,
          expiresAt,
        },
      });

      setRefreshCookie(reply, sessionToken, rememberMe);
      setRememberCookie(reply, rememberMe);
      loginThrottle.registerSuccess(identity);
      await logAuthSecurityEvent({
        eventType: 'auth_login_succeeded',
        targetUserId: account.userId,
        actorEmail: account.email,
        detail: 'User login succeeded.',
        endpoint: '/v1/auth/login',
        ip: request.ip || null,
      });
      if (client.ip && !knownIpSession) {
        await logAuthSecurityEvent({
          eventType: 'auth_login_new_ip',
          targetUserId: account.userId,
          actorEmail: account.email,
          detail: 'First observed login from this IP for user.',
          endpoint: '/v1/auth/login',
          ip: client.ip,
        });
      }
      if (client.userAgent && !knownDeviceSession) {
        await logAuthSecurityEvent({
          eventType: 'auth_login_new_device',
          targetUserId: account.userId,
          actorEmail: account.email,
          detail: 'First observed login from this user-agent for user.',
          endpoint: '/v1/auth/login',
          ip: client.ip,
        });
      }
      reply.send({
        user: { id: account.userId, email: account.email },
        profile,
        accessToken: createAccessToken({ userId: account.userId, email: account.email }),
      });
      return;
    }

    if (env.AUTH_MODE === 'mock') {
      const email = normalizeEmail(parsed.data.email);
      const existing = await prisma.profile.findFirst({
        where: { email },
        orderBy: { createdAt: 'asc' },
      });
      if (existing) {
        const profile = await getOrCreateProfile(existing.userId, email);
        loginThrottle.registerSuccess(identity);
        await logAuthSecurityEvent({
          eventType: 'auth_login_succeeded',
          targetUserId: existing.userId,
          actorEmail: email,
          detail: 'Mock login succeeded.',
          endpoint: '/v1/auth/login',
          ip: request.ip || null,
        });
        reply.send({
          user: { id: existing.userId, email },
          profile,
          accessToken: null,
        });
        return;
      }

      // Allow seeded local-auth QA/admin accounts to sign in while running in
      // mock mode (useful for local dev parity and preview environments).
      const account = await prisma.localAuthCredential.findUnique({
        where: { email },
      });
      if (!account) {
        loginThrottle.registerFailure(identity);
        await logAuthSecurityEvent({
          eventType: 'auth_login_failed',
          actorEmail: email,
          detail: 'Mock login failed: account_not_found',
          endpoint: '/v1/auth/login',
          ip: request.ip || null,
          metadata: { reason: 'account_not_found' },
        });
        reply.code(401).send({ error: 'No account found for this email. Sign up first.' });
        return;
      }

      const passwordValid = await verifyPassword(parsed.data.password, account.passwordHash);
      if (!passwordValid) {
        await rejectInvalidCredentials('invalid_password');
        return;
      }
      if (needsPasswordRehash(account.passwordHash)) {
        const upgradedPasswordHash = await hashPassword(parsed.data.password);
        await prisma.localAuthCredential
          .update({
            where: { userId: account.userId },
            data: { passwordHash: upgradedPasswordHash },
          })
          .catch(() => null);
      }

      const profile = await getOrCreateProfile(account.userId, email);
      loginThrottle.registerSuccess(identity);
      await logAuthSecurityEvent({
        eventType: 'auth_login_succeeded',
        targetUserId: account.userId,
        actorEmail: email,
        detail: 'Mock login via local credential succeeded.',
        endpoint: '/v1/auth/login',
        ip: request.ip || null,
      });
      reply.send({
        user: { id: account.userId, email },
        profile,
        accessToken: null,
      });
      return;
    }

    const supabase = getSupabaseAuthClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error || !data.user || !data.session) {
      loginThrottle.registerFailure(identity);
      await logAuthSecurityEvent({
        eventType: 'auth_login_failed',
        actorEmail: identity.email,
        detail: `Supabase login failed: ${error?.message || 'invalid_credentials'}`,
        endpoint: '/v1/auth/login',
        ip: request.ip || null,
        metadata: { reason: 'supabase_sign_in_failed' },
      });
      reply.code(401).send({ error: error?.message || 'Invalid email or password' });
      return;
    }

    const profile = await getOrCreateProfile(data.user.id, data.user.email ?? parsed.data.email);

    setRefreshCookie(reply, data.session.refresh_token, rememberMe);
    setRememberCookie(reply, rememberMe);
    reply.send({
      user: { id: data.user.id, email: data.user.email ?? parsed.data.email },
      profile,
      accessToken: data.session.access_token,
    });
    loginThrottle.registerSuccess(identity);
    await logAuthSecurityEvent({
      eventType: 'auth_login_succeeded',
      targetUserId: data.user.id,
      actorEmail: data.user.email ?? parsed.data.email,
      detail: 'Supabase login succeeded.',
      endpoint: '/v1/auth/login',
      ip: request.ip || null,
    });
  });

  // Admin-only debug endpoint. Clears login-throttle buckets for support and local QA scenarios.
  app.post('/v1/auth/debug/reset-login-throttle', async (request, reply) => {
    if (!env.LOGIN_THROTTLE_ADMIN_TOKEN) {
      reply.code(404).send({ error: 'Not found' });
      return;
    }

    if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

    const adminToken = readHeader(request.headers['x-admin-token']);
    if (!adminToken || adminToken !== env.LOGIN_THROTTLE_ADMIN_TOKEN) {
      reply.code(403).send({ error: 'Forbidden' });
      return;
    }

    const parsed = throttleResetSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    if (parsed.data.all) {
      loginThrottle.reset();
      reply.send({ ok: true, scope: 'all' });
      return;
    }

    loginThrottle.reset({
      email: parsed.data.email,
      ip: parsed.data.ip,
    });
    reply.send({
      ok: true,
      scope: 'targeted',
      cleared: {
        email: parsed.data.email ?? null,
        ip: parsed.data.ip ?? null,
      },
    });
  });

  // Public endpoint. Rotates refresh token and issues a fresh access token.
  app.post('/v1/auth/refresh', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

    const parsed = refreshSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      await logAuthSecurityEvent({
        eventType: 'auth_error_invalid_payload',
        detail: 'Refresh payload validation failed.',
        endpoint: '/v1/auth/refresh',
        ip: request.ip || null,
      });
      setRefreshDebugHeaders(reply, {
        result: 'error',
        reason: 'invalid_payload',
        requestId: request.id,
      });
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    const cookies = parseCookies(request.headers.cookie);
    const refreshToken = cookies.get(env.AUTH_COOKIE_NAME) ?? null;
    const rememberCookie = cookies.get(REMEMBER_COOKIE_NAME);
    const persistentSession = rememberCookie === '1';
    if (!refreshToken) {
      await logAuthSecurityEvent({
        eventType: 'auth_error_refresh_missing_cookie',
        detail: 'Refresh token cookie missing on refresh attempt.',
        endpoint: '/v1/auth/refresh',
        ip: request.ip || null,
      });
      setRefreshDebugHeaders(reply, {
        result: 'error',
        reason: 'missing_refresh_cookie',
        requestId: request.id,
      });
      reply.code(401).send({ error: 'Missing refresh token' });
      return;
    }

    if (env.AUTH_MODE === 'local') {
      const tokenHash = hashRefreshToken(refreshToken);
      const now = new Date();
      const client = requestClientInfo(request);

      const rotated = await prisma.$transaction(async (tx) => {
        const existing = await tx.refreshSession.findUnique({
          where: { tokenHash },
        });
        if (!existing) {
          return {
            ok: false as const,
            reason: 'local_no_session' as const,
          };
        }

        const state = evaluateRefreshRotationState(existing, now);
        if (state === 'reuse_detected') {
          await tx.refreshSession.updateMany({
            where: { familyId: existing.familyId, revokedAt: null },
            data: { revokedAt: now, revokedReason: 'reuse_detected' },
          });
          return {
            ok: false as const,
            reason: 'local_reuse_detected' as const,
          };
        }

        if (state !== 'rotate') {
          return {
            ok: false as const,
            reason: 'local_invalid_session_state' as const,
          };
        }

        const account = await tx.localAuthCredential.findUnique({
          where: { userId: existing.userId },
        });
        if (!account) {
          await tx.refreshSession.update({
            where: { id: existing.id },
            data: { revokedAt: now, revokedReason: 'account_missing' },
          });
          return {
            ok: false as const,
            reason: 'local_account_missing' as const,
          };
        }

        const nextToken = createRefreshToken();
        const nextHash = hashRefreshToken(nextToken);
        await tx.refreshSession.create({
          data: {
            userId: existing.userId,
            tokenHash: nextHash,
            familyId: existing.familyId,
            parentTokenHash: existing.tokenHash,
            createdIp: client.ip,
            createdUserAgent: client.userAgent,
            expiresAt: refreshExpiryDate(),
          },
        });
        await tx.refreshSession.update({
          where: { id: existing.id },
          data: {
            replacedByHash: nextHash,
            revokedAt: now,
            revokedReason: 'rotated',
            lastUsedAt: now,
          },
        });
        return {
          ok: true as const,
          reason: 'local_rotated' as const,
          user: {
            id: existing.userId,
            email: account.email,
          },
          refreshToken: nextToken,
        };
      });

      if (!rotated.ok) {
        await logAuthSecurityEvent({
          eventType: 'auth_error_refresh_failed',
          targetUserId: env.DEV_USER_ID,
          detail: `Local refresh failed: ${rotated.reason}`,
          endpoint: '/v1/auth/refresh',
          ip: request.ip || null,
          metadata: { reason: rotated.reason },
        });
        setRefreshDebugHeaders(reply, {
          result: 'error',
          reason: rotated.reason,
          requestId: request.id,
        });
        clearRefreshCookie(reply);
        clearRememberCookie(reply);
        reply.code(401).send({ error: 'Unable to refresh session' });
        return;
      }

      setRefreshDebugHeaders(reply, {
        result: 'ok',
        reason: rotated.reason,
        requestId: request.id,
      });
      setRefreshCookie(reply, rotated.refreshToken, persistentSession);
      setRememberCookie(reply, persistentSession);
      reply.send({
        user: rotated.user,
        accessToken: createAccessToken({
          userId: rotated.user.id,
          email: rotated.user.email,
        }),
      });
      return;
    }

    if (env.AUTH_MODE !== 'supabase') {
      setRefreshDebugHeaders(reply, {
        result: 'error',
        reason: 'refresh_not_supported',
        requestId: request.id,
      });
      reply
        .code(400)
        .send({ error: 'Refresh endpoint is only available in supabase/local auth mode.' });
      return;
    }

    const supabase = getSupabaseAuthClient();
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session || !data.user) {
      await logAuthSecurityEvent({
        eventType: 'auth_error_refresh_failed',
        detail: `Supabase refresh failed: ${error?.message || 'unknown_error'}`,
        endpoint: '/v1/auth/refresh',
        ip: request.ip || null,
        metadata: { reason: 'supabase_refresh_failed' },
      });
      setRefreshDebugHeaders(reply, {
        result: 'error',
        reason: 'supabase_refresh_failed',
        requestId: request.id,
      });
      reply.code(401).send({ error: error?.message || 'Unable to refresh session' });
      return;
    }

    setRefreshDebugHeaders(reply, {
      result: 'ok',
      reason: 'supabase_rotated',
      requestId: request.id,
    });
    setRefreshCookie(reply, data.session.refresh_token, persistentSession);
    setRememberCookie(reply, persistentSession);
    reply.send({
      user: { id: data.user.id, email: data.user.email ?? null },
      accessToken: data.session.access_token,
    });
  });

  // Public endpoint. Revokes local refresh token (when present) and clears auth cookies.
  app.post('/v1/auth/logout', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

    if (env.AUTH_MODE === 'local') {
      const cookies = parseCookies(request.headers.cookie);
      const refreshToken = cookies.get(env.AUTH_COOKIE_NAME);
      if (refreshToken) {
        const tokenHash = hashRefreshToken(refreshToken);
        await prisma.refreshSession.updateMany({
          where: { tokenHash, revokedAt: null },
          data: {
            revokedAt: new Date(),
            revokedReason: 'logout',
          },
        });
      }
    }

    clearRefreshCookie(reply);
    clearRememberCookie(reply);
    reply.send({ ok: true });
  });
}
