import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { env } from '../env.js';
import { prisma } from '../lib/prisma.js';
import { getOrCreateProfile, upsertProfile } from '../services/profileService.js';
import { getSupabaseAuthClient } from '../lib/supabase.js';
import { parseCookies, serializeCookie } from '../lib/cookies.js';
import { readAllowedOrigins, requireTrustedOrigin } from '../lib/originPolicy.js';
import {
  createAccessToken,
  createRefreshFamilyId,
  createRefreshToken,
  hashPassword,
  hashRefreshToken,
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
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(4096).optional(),
});

const REFRESH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const allowedOrigins = readAllowedOrigins();

function readHeader(value: string | string[] | undefined) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] : value;
}

function requestClientInfo(request: { ip: string; headers: Record<string, string | string[] | undefined> }) {
  return {
    ip: request.ip || null,
    userAgent: readHeader(request.headers['user-agent']),
  };
}

function setRefreshCookie(reply: { header: (name: string, value: string) => unknown }, refreshToken: string) {
  reply.header(
    'Set-Cookie',
    serializeCookie(env.AUTH_COOKIE_NAME, refreshToken, {
      domain: env.AUTH_COOKIE_DOMAIN,
      path: '/',
      maxAgeSeconds: REFRESH_COOKIE_MAX_AGE_SECONDS,
      httpOnly: true,
      secure: env.AUTH_COOKIE_SECURE,
      sameSite: env.AUTH_COOKIE_SAME_SITE,
    })
  );
}

function clearRefreshCookie(reply: { header: (name: string, value: string) => unknown }) {
  reply.header(
    'Set-Cookie',
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

export async function authRoutes(app: FastifyInstance) {
  app.post('/v1/auth/signup', async (request, reply) => {
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
            onboardingComplete: true,
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
      setRefreshCookie(reply, sessionToken);
      reply.send({
        user: { id: userId, email },
        profile,
        accessToken,
        requiresEmailVerification: false,
      });
      return;
    }

    if (env.AUTH_MODE === 'mock') {
      const existing = await prisma.profile.findFirst({
        where: { email: parsed.data.email },
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
        email: parsed.data.email,
        displayName,
        targetLanguage: parsed.data.targetLanguage,
        timezone: parsed.data.timezone,
        onboardingComplete: true,
      });
      reply.send({
        user: { id: userId, email: parsed.data.email },
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
      onboardingComplete: true,
    });

    reply.send({
      user: { id: data.user.id, email: data.user.email ?? parsed.data.email },
      profile,
      accessToken: data.session?.access_token ?? null,
      requiresEmailVerification: !data.session,
    });
    if (data.session?.refresh_token) {
      setRefreshCookie(reply, data.session.refresh_token);
    }
  });

  app.post('/v1/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    if (env.AUTH_MODE === 'local') {
      const email = normalizeEmail(parsed.data.email);
      const account = await prisma.localAuthCredential.findUnique({
        where: { email },
      });
      if (!account) {
        reply.code(401).send({ error: 'Invalid email or password' });
        return;
      }
      const passwordValid = await verifyPassword(parsed.data.password, account.passwordHash);
      if (!passwordValid) {
        reply.code(401).send({ error: 'Invalid email or password' });
        return;
      }

      const profile = await getOrCreateProfile(account.userId, account.email);
      const sessionToken = createRefreshToken();
      const sessionTokenHash = hashRefreshToken(sessionToken);
      const familyId = createRefreshFamilyId();
      const expiresAt = refreshExpiryDate();
      const client = requestClientInfo(request);

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

      setRefreshCookie(reply, sessionToken);
      reply.send({
        user: { id: account.userId, email: account.email },
        profile,
        accessToken: createAccessToken({ userId: account.userId, email: account.email }),
      });
      return;
    }

    if (env.AUTH_MODE === 'mock') {
      const existing = await prisma.profile.findFirst({
        where: { email: parsed.data.email },
        orderBy: { createdAt: 'asc' },
      });
      if (!existing) {
        reply.code(401).send({ error: 'No account found for this email. Sign up first.' });
        return;
      }
      const profile = await getOrCreateProfile(existing.userId, parsed.data.email);
      reply.send({
        user: { id: existing.userId, email: parsed.data.email },
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
      reply.code(401).send({ error: error?.message || 'Invalid email or password' });
      return;
    }

    const profile = await getOrCreateProfile(data.user.id, data.user.email ?? parsed.data.email);

    reply.send({
      user: { id: data.user.id, email: data.user.email ?? parsed.data.email },
      profile,
      accessToken: data.session.access_token,
    });
    setRefreshCookie(reply, data.session.refresh_token);
  });

  app.post('/v1/auth/refresh', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

    const parsed = refreshSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    const cookies = parseCookies(request.headers.cookie);
    const refreshToken = parsed.data.refreshToken ?? cookies.get(env.AUTH_COOKIE_NAME) ?? null;
    if (!refreshToken) {
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
          return { ok: false as const };
        }

        if (existing.replacedByHash) {
          await tx.refreshSession.updateMany({
            where: { familyId: existing.familyId, revokedAt: null },
            data: { revokedAt: now, revokedReason: 'reuse_detected' },
          });
          return { ok: false as const };
        }

        if (existing.revokedAt || existing.expiresAt <= now) {
          return { ok: false as const };
        }

        const account = await tx.localAuthCredential.findUnique({
          where: { userId: existing.userId },
        });
        if (!account) {
          await tx.refreshSession.update({
            where: { id: existing.id },
            data: { revokedAt: now, revokedReason: 'account_missing' },
          });
          return { ok: false as const };
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
          user: {
            id: existing.userId,
            email: account.email,
          },
          refreshToken: nextToken,
        };
      });

      if (!rotated.ok) {
        clearRefreshCookie(reply);
        reply.code(401).send({ error: 'Unable to refresh session' });
        return;
      }

      setRefreshCookie(reply, rotated.refreshToken);
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
      reply.code(400).send({ error: 'Refresh endpoint is only available in supabase/local auth mode.' });
      return;
    }

    const supabase = getSupabaseAuthClient();
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session || !data.user) {
      reply.code(401).send({ error: error?.message || 'Unable to refresh session' });
      return;
    }

    reply.send({
      user: { id: data.user.id, email: data.user.email ?? null },
      accessToken: data.session.access_token,
    });
    setRefreshCookie(reply, data.session.refresh_token);
  });

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
    reply.send({ ok: true });
  });
}
