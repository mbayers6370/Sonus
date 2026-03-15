import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { requireTrustedOrigin } from '../lib/originPolicy.js';
import { verifyPassword, hashPrivilegedPassword } from '../lib/localAuth.js';
import {
  createSupportAdminSessionToken,
  hashSupportAdminSessionToken,
  normalizeSupportAdminUsername,
  resolveSupportAdminFromRequest,
} from '../lib/supportAdminAuth.js';
import { sendPasswordResetEmail } from '../services/passwordResetEmailService.js';
import {
  supportAdminCreateSchema,
  supportAdminForgotPasswordSchema,
  supportAdminLoginSchema,
  supportAdminRecoveryEmailSchema,
  supportAdminResetPasswordSchema,
  supportAdminResetWithTokenSchema,
} from './adminSchemas.js';

type RegisterAdminAuthRoutesDeps = {
  allowedOrigins: Set<string>;
  prisma: PrismaClient;
  env: {
    DEV_USER_ID: string;
  };
  SUPPORT_ADMIN_DUMMY_PASSWORD_HASH: string;
  SUPPORT_ROOT_ADMIN_USERNAME: string;
  supportAdminLoginThrottle: {
    check: (identity: { email: string; ip: string }) => {
      allowed: boolean;
      retryAfterSeconds: number;
    };
    registerFailure: (identity: { email: string; ip: string }) => void;
    registerSuccess: (identity: { email: string; ip: string }) => void;
  };
  supportAdminForgotPasswordThrottle: {
    check: (identity: { email: string; ip: string }) => {
      allowed: boolean;
      retryAfterSeconds: number;
    };
    registerFailure: (identity: { email: string; ip: string }) => void;
    registerSuccess: (identity: { email: string; ip: string }) => void;
  };
  supportAdminResetWithTokenThrottle: {
    check: (identity: { email: string; ip: string }) => {
      allowed: boolean;
      retryAfterSeconds: number;
    };
    registerFailure: (identity: { email: string; ip: string }) => void;
    registerSuccess: (identity: { email: string; ip: string }) => void;
  };
  createSupportAdminResetToken: () => string;
  hashSupportAdminResetToken: (token: string) => string;
  supportAdminSessionExpiry: () => Date;
  canUseSupportAdminUsername: (username: string) => boolean;
  resolveSupportAdminResetUrlBase: (request: FastifyRequest) => string | null;
  requireSupportAdminSession: (
    request: FastifyRequest,
    reply: FastifyReply
  ) => Promise<{
    username: string;
    sessionId: string;
    expiresAt: Date;
  } | null>;
};

export function registerAdminAuthRoutes(app: FastifyInstance, deps: RegisterAdminAuthRoutesDeps) {
  const logSupportAdminSecurityEvent = async (params: {
    eventType: string;
    detail: string;
    actorEmail?: string | null;
    metadata?: Record<string, unknown>;
  }) => {
    await deps.prisma.$executeRaw`
      INSERT INTO account_security_events
        (id, target_user_id, actor_user_id, actor_email, event_type, detail, metadata_json, created_at)
      VALUES
        (
          gen_random_uuid(),
          ${deps.env.DEV_USER_ID}::uuid,
          null,
          ${params.actorEmail ?? null},
          ${params.eventType},
          ${params.detail},
          ${params.metadata ? JSON.stringify(params.metadata) : null}::jsonb,
          now()
        )
    `;
  };

  app.post('/v1/admin/auth/login', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, deps.allowedOrigins)) return;

    const parsed = supportAdminLoginSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }
    const username = normalizeSupportAdminUsername(parsed.data.username);
    const throttleIdentity = {
      email: username,
      ip: request.ip || 'unknown',
    };
    const throttleDecision = deps.supportAdminLoginThrottle.check(throttleIdentity);
    if (!throttleDecision.allowed) {
      await deps.prisma.$executeRaw`
        INSERT INTO account_security_events
          (id, target_user_id, actor_user_id, actor_email, event_type, detail, metadata_json, created_at)
        VALUES
          (
            gen_random_uuid(),
            ${deps.env.DEV_USER_ID}::uuid,
            null,
            ${username},
            'support_admin_login_throttled',
            'Support admin login throttled due to too many attempts',
            ${JSON.stringify({
              username,
              endpoint: '/v1/admin/auth/login',
              ip: request.ip || null,
            })}::jsonb,
            now()
          )
      `;
      reply
        .code(429)
        .header('Retry-After', throttleDecision.retryAfterSeconds.toString())
        .send({ error: 'Too many login attempts. Try again later.' });
      return;
    }

    const rejectInvalidSupportAdminCredentials = async (reason: string) => {
      deps.supportAdminLoginThrottle.registerFailure(throttleIdentity);
      await deps.prisma.$executeRaw`
        INSERT INTO account_security_events
          (id, target_user_id, actor_user_id, actor_email, event_type, detail, metadata_json, created_at)
        VALUES
          (
            gen_random_uuid(),
            ${deps.env.DEV_USER_ID}::uuid,
            null,
            ${username},
            'support_admin_login_failed',
            'Invalid support admin credentials',
            ${JSON.stringify({
              username,
              reason,
              endpoint: '/v1/admin/auth/login',
              ip: request.ip || null,
            })}::jsonb,
            now()
          )
      `;
      reply.code(401).send({ error: 'Invalid username or password' });
    };

    const rows = await deps.prisma.$queryRaw<Array<{ username: string; password_hash: string }>>`
      SELECT username, password_hash
      FROM support_admin_credentials
      WHERE username = ${username}
      LIMIT 1
    `;
    const row = rows[0] ?? null;
    if (!row) {
      await verifyPassword(parsed.data.password, deps.SUPPORT_ADMIN_DUMMY_PASSWORD_HASH).catch(
        () => false
      );
      await rejectInvalidSupportAdminCredentials('account_not_found');
      return;
    }
    const passwordOk = await verifyPassword(parsed.data.password, row.password_hash).catch(
      () => false
    );
    if (!passwordOk) {
      await rejectInvalidSupportAdminCredentials('invalid_password');
      return;
    }

    const rawToken = createSupportAdminSessionToken();
    const tokenHash = hashSupportAdminSessionToken(rawToken);
    const expiresAt = deps.supportAdminSessionExpiry();
    await deps.prisma.$executeRaw`
      INSERT INTO support_admin_sessions (id, username, token_hash, expires_at, revoked_at, created_at, last_used_at)
      VALUES (gen_random_uuid(), ${username}, ${tokenHash}, ${expiresAt}, null, now(), now())
    `;

    await logSupportAdminSecurityEvent({
      eventType: 'support_admin_login_succeeded',
      detail: 'Support admin login succeeded',
      actorEmail: username,
      metadata: { username, endpoint: '/v1/admin/auth/login', ip: request.ip || null },
    });
    deps.supportAdminLoginThrottle.registerSuccess(throttleIdentity);

    return {
      ok: true,
      token: rawToken,
      username,
      expiresAt: expiresAt.toISOString(),
    };
  });

  app.get('/v1/admin/auth/me', async (request, reply) => {
    const identity = await resolveSupportAdminFromRequest(request);
    if (!identity) {
      reply.code(401).send({ error: 'Not signed in to support admin' });
      return;
    }
    return {
      ok: true,
      username: identity.username,
      expiresAt: identity.expiresAt.toISOString(),
    };
  });

  app.post('/v1/admin/auth/create-admin', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, deps.allowedOrigins)) return;
    const identity = await deps.requireSupportAdminSession(request, reply);
    if (!identity) return;
    if (identity.username !== deps.SUPPORT_ROOT_ADMIN_USERNAME) {
      reply.code(403).send({ error: 'Only the QA root admin can create new admin accounts.' });
      return;
    }
    const parsed = supportAdminCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }
    const username = normalizeSupportAdminUsername(parsed.data.username);
    if (!deps.canUseSupportAdminUsername(username)) {
      reply.code(403).send({ error: 'Support admin username is not allowlisted.' });
      return;
    }
    const existing = await deps.prisma.$queryRaw<Array<{ username: string }>>`
      SELECT username FROM support_admin_credentials WHERE username = ${username} LIMIT 1
    `;
    if (existing.length > 0) {
      reply.code(409).send({ error: 'Support admin already exists.' });
      return;
    }
    const currentRows = await deps.prisma.$queryRaw<Array<{ password_hash: string }>>`
      SELECT password_hash
      FROM support_admin_credentials
      WHERE username = ${identity.username}
      LIMIT 1
    `;
    const current = currentRows[0];
    if (!current) {
      reply.code(404).send({ error: 'Current support admin account not found.' });
      return;
    }
    const currentPasswordValid = await verifyPassword(
      parsed.data.currentPassword,
      current.password_hash
    ).catch(() => false);
    if (!currentPasswordValid) {
      await logSupportAdminSecurityEvent({
        eventType: 'support_admin_create_admin_rejected',
        detail: 'Support admin create-admin rejected due to incorrect re-auth password',
        actorEmail: identity.username,
        metadata: { username, endpoint: '/v1/admin/auth/create-admin', ip: request.ip || null },
      });
      reply.code(401).send({ error: 'Current password is incorrect.' });
      return;
    }
    const passwordHash = await hashPrivilegedPassword(parsed.data.password);
    const recoveryEmail = parsed.data.recoveryEmail?.trim().toLowerCase() || null;
    await deps.prisma.$executeRaw`
      INSERT INTO support_admin_credentials
        (username, password_hash, recovery_email, created_by_username, created_at, updated_at)
      VALUES
        (${username}, ${passwordHash}, ${recoveryEmail}, ${identity.username}, now(), now())
    `;
    await logSupportAdminSecurityEvent({
      eventType: 'support_admin_created',
      detail: 'Support admin account created',
      actorEmail: identity.username,
      metadata: {
        createdUsername: username,
        createdRecoveryEmail: recoveryEmail,
        createdByUsername: identity.username,
        endpoint: '/v1/admin/auth/create-admin',
        ip: request.ip || null,
      },
    });
    return { ok: true, username, recoveryEmail };
  });

  app.post('/v1/admin/auth/reset-password', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, deps.allowedOrigins)) return;
    const identity = await deps.requireSupportAdminSession(request, reply);
    if (!identity) return;
    const parsed = supportAdminResetPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }
    const rows = await deps.prisma.$queryRaw<Array<{ password_hash: string }>>`
      SELECT password_hash FROM support_admin_credentials WHERE username = ${identity.username} LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      reply.code(404).send({ error: 'Support admin account not found.' });
      return;
    }
    const validCurrent = await verifyPassword(parsed.data.currentPassword, row.password_hash).catch(
      () => false
    );
    if (!validCurrent) {
      reply.code(401).send({ error: 'Current password is incorrect.' });
      return;
    }
    const newPasswordHash = await hashPrivilegedPassword(parsed.data.newPassword);
    await deps.prisma.$executeRaw`
      UPDATE support_admin_credentials
      SET password_hash = ${newPasswordHash}, updated_at = now()
      WHERE username = ${identity.username}
    `;
    await deps.prisma.$executeRaw`
      UPDATE support_admin_sessions
      SET revoked_at = now()
      WHERE username = ${identity.username} AND revoked_at IS NULL AND id <> ${identity.sessionId}::uuid
    `;
    await logSupportAdminSecurityEvent({
      eventType: 'support_admin_password_changed',
      detail: 'Support admin password changed',
      actorEmail: identity.username,
      metadata: { username: identity.username, endpoint: '/v1/admin/auth/reset-password' },
    });
    return { ok: true };
  });

  app.post('/v1/admin/auth/recovery-email', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, deps.allowedOrigins)) return;
    const identity = await deps.requireSupportAdminSession(request, reply);
    if (!identity) return;
    const parsed = supportAdminRecoveryEmailSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }
    const recoveryEmail = parsed.data.recoveryEmail.trim().toLowerCase();
    await deps.prisma.$executeRaw`
      UPDATE support_admin_credentials
      SET recovery_email = ${recoveryEmail}, updated_at = now()
      WHERE username = ${identity.username}
    `;
    return { ok: true, recoveryEmail };
  });

  app.post('/v1/admin/auth/forgot-password', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, deps.allowedOrigins)) return;
    const parsed = supportAdminForgotPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }
    const email = parsed.data.email.trim().toLowerCase();
    const throttleIdentity = {
      email,
      ip: request.ip || 'unknown',
    };
    const throttleDecision = deps.supportAdminForgotPasswordThrottle.check(throttleIdentity);
    if (!throttleDecision.allowed) {
      await logSupportAdminSecurityEvent({
        eventType: 'support_admin_forgot_password_throttled',
        detail: 'Support admin forgot-password throttled due to too many attempts',
        actorEmail: email,
        metadata: { email, endpoint: '/v1/admin/auth/forgot-password', ip: request.ip || null },
      });
      reply
        .code(429)
        .header('Retry-After', throttleDecision.retryAfterSeconds.toString())
        .send({ error: 'Too many reset requests. Try again later.' });
      return;
    }
    const rows = await deps.prisma.$queryRaw<
      Array<{ username: string; recovery_email: string | null }>
    >`
      SELECT username, recovery_email
      FROM support_admin_credentials
      WHERE recovery_email = ${email} OR username = ${email}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      deps.supportAdminForgotPasswordThrottle.registerSuccess(throttleIdentity);
      await logSupportAdminSecurityEvent({
        eventType: 'support_admin_password_reset_requested',
        detail: 'Support admin forgot-password requested',
        actorEmail: email,
        metadata: { email, accountFound: false, endpoint: '/v1/admin/auth/forgot-password' },
      });
      return { ok: true };
    }
    const destinationEmail = row.recovery_email?.trim().toLowerCase() || row.username;
    if (!destinationEmail) return { ok: true };
    const rawToken = deps.createSupportAdminResetToken();
    const tokenHash = deps.hashSupportAdminResetToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await deps.prisma.$executeRaw`
      INSERT INTO support_admin_password_reset_tokens
        (id, username, token_hash, expires_at, used_at, created_at)
      VALUES
        (gen_random_uuid(), ${row.username}, ${tokenHash}, ${expiresAt}, null, now())
    `;
    const resetBase = deps.resolveSupportAdminResetUrlBase(request);
    const resetUrl = `${resetBase || ''}/internal/support?adminResetToken=${encodeURIComponent(rawToken)}`;
    await sendPasswordResetEmail({
      to: destinationEmail,
      resetUrl,
    });
    deps.supportAdminForgotPasswordThrottle.registerSuccess(throttleIdentity);
    await logSupportAdminSecurityEvent({
      eventType: 'support_admin_password_reset_requested',
      detail: 'Support admin forgot-password requested',
      actorEmail: email,
      metadata: {
        email,
        accountFound: true,
        username: row.username,
        endpoint: '/v1/admin/auth/forgot-password',
      },
    });
    return { ok: true };
  });

  app.post('/v1/admin/auth/reset-password-with-token', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, deps.allowedOrigins)) return;
    const parsed = supportAdminResetWithTokenSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }
    const throttleIdentity = {
      email: `admin-reset:${parsed.data.token.slice(0, 24)}`,
      ip: request.ip || 'unknown',
    };
    const throttleDecision = deps.supportAdminResetWithTokenThrottle.check(throttleIdentity);
    if (!throttleDecision.allowed) {
      await logSupportAdminSecurityEvent({
        eventType: 'support_admin_reset_password_throttled',
        detail: 'Support admin reset-password-with-token throttled due to too many attempts',
        metadata: { endpoint: '/v1/admin/auth/reset-password-with-token', ip: request.ip || null },
      });
      reply
        .code(429)
        .header('Retry-After', throttleDecision.retryAfterSeconds.toString())
        .send({ error: 'Too many reset attempts. Try again later.' });
      return;
    }
    const tokenHash = deps.hashSupportAdminResetToken(parsed.data.token);
    const rows = await deps.prisma.$queryRaw<
      Array<{ id: string; username: string; expires_at: Date; used_at: Date | null }>
    >`
      SELECT id, username, expires_at, used_at
      FROM support_admin_password_reset_tokens
      WHERE token_hash = ${tokenHash}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row || row.used_at || row.expires_at <= new Date()) {
      deps.supportAdminResetWithTokenThrottle.registerFailure(throttleIdentity);
      reply.code(400).send({ error: 'Reset token is invalid or expired.' });
      return;
    }
    const passwordHash = await hashPrivilegedPassword(parsed.data.password);
    await deps.prisma.$executeRaw`
      UPDATE support_admin_credentials
      SET password_hash = ${passwordHash}, updated_at = now()
      WHERE username = ${row.username}
    `;
    await deps.prisma.$executeRaw`
      UPDATE support_admin_password_reset_tokens
      SET used_at = now()
      WHERE id = ${row.id}::uuid
    `;
    await deps.prisma.$executeRaw`
      UPDATE support_admin_sessions
      SET revoked_at = now()
      WHERE username = ${row.username} AND revoked_at IS NULL
    `;
    deps.supportAdminResetWithTokenThrottle.registerSuccess(throttleIdentity);
    await logSupportAdminSecurityEvent({
      eventType: 'support_admin_password_reset_completed',
      detail: 'Support admin password reset completed with token',
      actorEmail: row.username,
      metadata: { username: row.username, endpoint: '/v1/admin/auth/reset-password-with-token' },
    });
    return { ok: true };
  });

  app.post('/v1/admin/auth/logout', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, deps.allowedOrigins)) return;
    const identity = await resolveSupportAdminFromRequest(request);
    if (!identity) {
      return { ok: true };
    }
    await deps.prisma.$executeRaw`
      UPDATE support_admin_sessions
      SET revoked_at = now()
      WHERE id = ${identity.sessionId}::uuid
    `;
    return { ok: true };
  });
}
