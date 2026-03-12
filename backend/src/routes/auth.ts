import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../env.js';
import { prisma } from '../lib/prisma.js';
import { getOrCreateProfile, upsertProfile } from '../services/profileService.js';
import { parseCookies, serializeCookie } from '../lib/cookies.js';
import { readAllowedOrigins, requireTrustedOrigin } from '../lib/originPolicy.js';
import { createLoginThrottle } from '../lib/loginThrottle.js';
import { createAuthModeProvider } from '../lib/authModeProvider.js';
import {
  hashPasswordResetToken,
  normalizeEmail,
} from '../lib/localAuth.js';

const TERMS_OF_SERVICE_VERSION = '2026-03-08';
const PRIVACY_POLICY_VERSION = '2026-03-07';
const PASSWORD_MIN_LENGTH = 10;

function isStrongPassword(value: string) {
  return (
    value.length >= PASSWORD_MIN_LENGTH &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9\s]/.test(value) &&
    !/\s/.test(value)
  );
}

const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(128).refine(isStrongPassword, {
  message:
    'Password must be at least 10 characters and include uppercase, lowercase, number, and special character, with no spaces.',
});

const signupSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  targetLanguage: z.string().trim().min(2).max(12).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  legalAcceptance: z.object({
    termsVersion: z.string().trim().min(1).max(32),
    privacyVersion: z.string().trim().min(1).max(32),
    termsAccepted: z.literal(true),
    privacyAccepted: z.literal(true),
    ageConfirmed: z.literal(true),
  }),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().optional(),
});
const emailAvailabilitySchema = z.object({
  email: z.string().email(),
});

const refreshSchema = z.object({});
const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
const resetPasswordSchema = z.object({
  token: z.string().min(20).max(512),
  password: passwordSchema,
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
const authProvider = createAuthModeProvider();

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

function hasCurrentLegalVersions(legalAcceptance: {
  termsVersion: string;
  privacyVersion: string;
}) {
  return (
    legalAcceptance.termsVersion === TERMS_OF_SERVICE_VERSION &&
    legalAcceptance.privacyVersion === PRIVACY_POLICY_VERSION
  );
}

async function recordSignupLegalAcceptance(
  db: Pick<typeof prisma, 'legalDocumentAcceptance'>,
  input: {
    userId: string;
    client: ReturnType<typeof requestClientInfo>;
    legalAcceptance: {
      termsVersion: string;
      privacyVersion: string;
      ageConfirmed: true;
    };
  }
) {
  const { userId, client, legalAcceptance } = input;
  await db.legalDocumentAcceptance.createMany({
    data: [
      {
        userId,
        documentType: 'terms',
        documentVersion: legalAcceptance.termsVersion,
        acceptanceSource: 'signup',
        ageConfirmed: legalAcceptance.ageConfirmed,
        acceptedIp: client.ip,
        acceptedUserAgent: client.userAgent,
      },
      {
        userId,
        documentType: 'privacy',
        documentVersion: legalAcceptance.privacyVersion,
        acceptanceSource: 'signup',
        ageConfirmed: legalAcceptance.ageConfirmed,
        acceptedIp: client.ip,
        acceptedUserAgent: client.userAgent,
      },
    ],
  });
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

    await authProvider.requestPasswordReset({
      email: parsed.data.email,
      resetBase: resolveResetUrlBase(request),
      client: requestClientInfo(request),
    });

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
    const now = new Date();
    const resetResult = await authProvider.resetPassword({
      token: parsed.data.token,
      password: parsed.data.password,
      now,
    });
    if (!resetResult.ok) {
      resetPasswordThrottle.registerFailure(identity);
      reply.code(resetResult.status).send({ error: resetResult.error });
      return;
    }

    clearRefreshCookie(reply);
    resetPasswordThrottle.registerSuccess(identity);
    reply.send({ ok: true });
  });

  // Public endpoint. Creates account/profile and returns auth session material for configured auth mode.
  app.post('/v1/auth/check-email', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

    const parsed = emailAvailabilitySchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    const email = normalizeEmail(parsed.data.email);
    const exists = await authProvider.emailExists(email);

    reply.send({ available: !exists });
  });

  // Public endpoint. Creates account/profile and returns auth session material for configured auth mode.
  app.post('/v1/auth/signup', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }
    if (!hasCurrentLegalVersions(parsed.data.legalAcceptance)) {
      reply.code(409).send({
        error:
          'The Terms or Privacy Policy changed. Please review the latest versions and try again.',
      });
      return;
    }

    const displayName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();
    const signupResult = await authProvider.signup({
      email: parsed.data.email,
      password: parsed.data.password,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      displayName,
    });
    if (!signupResult.ok) {
      reply.code(signupResult.status).send({ error: signupResult.error });
      return;
    }

    const profile = await upsertProfile({
      userId: signupResult.user.id,
      email: signupResult.user.email ?? parsed.data.email,
      displayName,
      targetLanguage: parsed.data.targetLanguage,
      timezone: parsed.data.timezone,
      onboardingComplete: false,
    });
    await recordSignupLegalAcceptance(prisma, {
      userId: signupResult.user.id,
      client: requestClientInfo(request),
      legalAcceptance: parsed.data.legalAcceptance,
    });

    if (signupResult.refreshToken) {
      setRefreshCookie(reply, signupResult.refreshToken, true);
      setRememberCookie(reply, true);
    }
    reply.send({
      user: {
        id: signupResult.user.id,
        email: signupResult.user.email ?? parsed.data.email,
      },
      profile,
      accessToken: signupResult.accessToken,
      requiresEmailVerification: signupResult.requiresEmailVerification,
    });
    if (signupResult.requiresEmailVerification) {
      await logAuthSecurityEvent({
        eventType: 'email_verification_required',
        targetUserId: signupResult.user.id,
        actorEmail: signupResult.user.email ?? parsed.data.email,
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

    const loginResult = await authProvider.login({
      email: parsed.data.email,
      password: parsed.data.password,
      client: requestClientInfo(request),
    });
    if (!loginResult.ok) {
      if (loginResult.invalidCredentials) {
        await rejectInvalidCredentials(loginResult.reason);
        return;
      }
      loginThrottle.registerFailure(identity);
      await logAuthSecurityEvent({
        eventType: 'auth_login_failed',
        actorEmail: identity.email,
        detail: `Login failed: ${loginResult.reason}`,
        endpoint: '/v1/auth/login',
        ip: request.ip || null,
        metadata: { reason: loginResult.reason },
      });
      reply.code(loginResult.status).send({ error: loginResult.error });
      return;
    }

    const profile = await getOrCreateProfile(
      loginResult.user.id,
      loginResult.user.email ?? parsed.data.email
    );

    if (loginResult.refreshToken) {
      setRefreshCookie(reply, loginResult.refreshToken, rememberMe);
    }
    setRememberCookie(reply, rememberMe);
    reply.send({
      user: { id: loginResult.user.id, email: loginResult.user.email ?? parsed.data.email },
      profile,
      accessToken: loginResult.accessToken,
    });
    loginThrottle.registerSuccess(identity);
    await logAuthSecurityEvent({
      eventType: 'auth_login_succeeded',
      targetUserId: loginResult.user.id,
      actorEmail: loginResult.user.email ?? parsed.data.email,
      detail: `${authProvider.mode} login succeeded.`,
      endpoint: '/v1/auth/login',
      ip: request.ip || null,
    });
    if (authProvider.mode === 'local' && loginResult.newIp) {
      await logAuthSecurityEvent({
        eventType: 'auth_login_new_ip',
        targetUserId: loginResult.user.id,
        actorEmail: loginResult.user.email ?? parsed.data.email,
        detail: 'First observed login from this IP for user.',
        endpoint: '/v1/auth/login',
        ip: request.ip || null,
      });
    }
    if (authProvider.mode === 'local' && loginResult.newDevice) {
      await logAuthSecurityEvent({
        eventType: 'auth_login_new_device',
        targetUserId: loginResult.user.id,
        actorEmail: loginResult.user.email ?? parsed.data.email,
        detail: 'First observed login from this user-agent for user.',
        endpoint: '/v1/auth/login',
        ip: request.ip || null,
      });
    }
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
        // Missing refresh cookie is expected when the browser no longer has a session cookie.
        // Track it, but do not classify as auth_error_* noise.
        eventType: 'auth_refresh_missing_cookie',
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

    const refreshResult = await authProvider.refresh({
      refreshToken,
      client: requestClientInfo(request),
    });
    if (!refreshResult.ok) {
      await logAuthSecurityEvent({
        eventType: 'auth_error_refresh_failed',
        detail: `Refresh failed: ${refreshResult.reason}`,
        endpoint: '/v1/auth/refresh',
        ip: request.ip || null,
        metadata: { reason: refreshResult.reason },
      });
      setRefreshDebugHeaders(reply, {
        result: 'error',
        reason: refreshResult.reason,
        requestId: request.id,
      });
      if (refreshResult.clearCookies) {
        clearRefreshCookie(reply);
        clearRememberCookie(reply);
      }
      reply.code(refreshResult.status).send({ error: refreshResult.error });
      return;
    }

    setRefreshDebugHeaders(reply, {
      result: 'ok',
      reason: refreshResult.reason,
      requestId: request.id,
    });
    setRefreshCookie(reply, refreshResult.refreshToken, persistentSession);
    setRememberCookie(reply, persistentSession);
    reply.send({
      user: refreshResult.user,
      accessToken: refreshResult.accessToken,
    });
  });

  // Public endpoint. Revokes local refresh token (when present) and clears auth cookies.
  app.post('/v1/auth/logout', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

    const cookies = parseCookies(request.headers.cookie);
    const refreshToken = cookies.get(env.AUTH_COOKIE_NAME) ?? null;
    await authProvider.logout({ refreshToken });

    clearRefreshCookie(reply);
    clearRememberCookie(reply);
    reply.send({ ok: true });
  });
}
