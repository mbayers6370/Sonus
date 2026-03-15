import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../env.js';
import { requireAdmin } from '../lib/auth.js';
import { createLoginThrottle } from '../lib/loginThrottle.js';
import { prisma } from '../lib/prisma.js';
import { readAllowedOrigins } from '../lib/originPolicy.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { resolveSupportAdminFromRequest } from '../lib/supportAdminAuth.js';
import {
  ensureLearningAccessTables,
} from '../lib/learningAccess.js';
import { registerAdminAuthRoutes } from './adminAuthRoutes.js';
import { registerAdminMetricsRoutes } from './adminMetricsRoutes.js';
import { registerAdminQualityReportsRoutes } from './adminQualityReportsRoutes.js';
import { registerAdminReportsRoutes } from './adminReportsRoutes.js';
import { registerAdminUserExportRoutes } from './adminUserExportRoutes.js';
import { registerAdminUserLookupRoutes } from './adminUserLookupRoutes.js';
import { registerAdminUserOpsRoutes } from './adminUserOpsRoutes.js';
import {
  adminTimelineQuerySchema,
} from './adminSchemas.js';

const allowedOrigins = readAllowedOrigins();

const SUPPORT_ROOT_ADMIN_USERNAME = 'qa-admin-f8n2x7r1@sonus.test';
const SUPPORT_ADMIN_DUMMY_PASSWORD_HASH =
  'scrypt$131072$8$1$aXGrsBSWzTCAKoc4ZTMS1A$H9xcRZKFNm-b3I231Uyj7vAJ1chWXI2Btvp0_xKzESg';
const supportAdminLoginThrottle = createLoginThrottle({
  enabled: env.LOGIN_THROTTLE_ENABLED,
  threshold: env.SUPPORT_ADMIN_LOGIN_THROTTLE_THRESHOLD,
  baseDelayMs: env.SUPPORT_ADMIN_LOGIN_THROTTLE_WINDOW_MS,
  maxDelayMs: env.SUPPORT_ADMIN_LOGIN_THROTTLE_WINDOW_MS,
  resetAfterMs: env.SUPPORT_ADMIN_LOGIN_THROTTLE_WINDOW_MS,
});
const supportAdminForgotPasswordThrottle = createLoginThrottle({
  enabled: env.PASSWORD_RESET_THROTTLE_ENABLED,
  threshold: env.PASSWORD_RESET_REQUEST_THRESHOLD,
  baseDelayMs: env.PASSWORD_RESET_REQUEST_WINDOW_MS,
  maxDelayMs: env.PASSWORD_RESET_REQUEST_WINDOW_MS,
  resetAfterMs: env.PASSWORD_RESET_REQUEST_WINDOW_MS,
});
const supportAdminResetWithTokenThrottle = createLoginThrottle({
  enabled: env.PASSWORD_RESET_THROTTLE_ENABLED,
  threshold: env.PASSWORD_RESET_CONSUME_THRESHOLD,
  baseDelayMs: env.PASSWORD_RESET_CONSUME_WINDOW_MS,
  maxDelayMs: env.PASSWORD_RESET_CONSUME_WINDOW_MS,
  resetAfterMs: env.PASSWORD_RESET_CONSUME_WINDOW_MS,
});

function createSupportAdminResetToken() {
  return randomBytes(32).toString('base64url');
}

function hashSupportAdminResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function ensureAdminConsoleTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS support_admin_credentials (
      username text PRIMARY KEY,
      password_hash text NOT NULL,
      recovery_email text NULL,
      created_by_username text NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `;
  await prisma.$executeRaw`
    ALTER TABLE support_admin_credentials
    ADD COLUMN IF NOT EXISTS recovery_email text NULL;
  `;
  await prisma.$executeRaw`
    ALTER TABLE support_admin_credentials
    ADD COLUMN IF NOT EXISTS created_by_username text NULL;
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS support_admin_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_used_at timestamptz NULL
    );
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_support_admin_sessions_username_created_at
    ON support_admin_sessions (username, created_at DESC);
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS support_admin_password_reset_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      used_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_support_admin_password_reset_tokens_username_created_at
    ON support_admin_password_reset_tokens (username, created_at DESC);
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_refresh_sessions_active_lookup
    ON refresh_sessions (revoked_at, expires_at, last_used_at, created_at, user_id);
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_user_id uuid NOT NULL,
      actor_email text NULL,
      action text NOT NULL,
      target_user_id uuid NULL,
      reason text NOT NULL,
      result text NOT NULL,
      metadata_json jsonb NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_created_at
    ON admin_audit_logs (target_user_id, created_at DESC);
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_created_at
    ON admin_audit_logs (actor_user_id, created_at DESC);
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS support_notes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      target_user_id uuid NOT NULL,
      actor_user_id uuid NOT NULL,
      actor_email text NULL,
      note text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_support_notes_target_created_at
    ON support_notes (target_user_id, created_at DESC);
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS deletion_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      target_user_id uuid NOT NULL,
      status text NOT NULL DEFAULT 'open',
      requested_by_user_id uuid NOT NULL,
      requested_by_email text NULL,
      request_reason text NOT NULL,
      request_channel text NULL,
      resolved_by_user_id uuid NULL,
      resolved_by_email text NULL,
      resolve_reason text NULL,
      resolved_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_deletion_requests_target_created_at
    ON deletion_requests (target_user_id, created_at DESC);
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS account_security_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      target_user_id uuid NOT NULL,
      actor_user_id uuid NULL,
      actor_email text NULL,
      event_type text NOT NULL,
      detail text NULL,
      metadata_json jsonb NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_account_security_events_target_created_at
    ON account_security_events (target_user_id, created_at DESC);
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS scheduled_account_deletions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      target_user_id uuid NOT NULL,
      target_email text NULL,
      target_display_name text NULL,
      requested_by_user_id uuid NOT NULL,
      requested_by_email text NULL,
      reason text NOT NULL,
      hold_days int NOT NULL,
      scheduled_for timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'scheduled',
      cancelled_at timestamptz NULL,
      cancelled_by_user_id uuid NULL,
      cancelled_by_email text NULL,
      cancel_reason text NULL,
      completed_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_scheduled_account_deletions_status_scheduled_for
    ON scheduled_account_deletions (status, scheduled_for ASC);
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_scheduled_account_deletions_target_created_at
    ON scheduled_account_deletions (target_user_id, created_at DESC);
  `;
  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_account_deletions_target_open
    ON scheduled_account_deletions (target_user_id)
    WHERE status = 'scheduled';
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS deletion_case_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      target_user_id uuid NOT NULL,
      target_email text NULL,
      target_display_name text NULL,
      outcome text NOT NULL,
      request_reason text NOT NULL,
      request_channel text NULL,
      request_created_at timestamptz NOT NULL,
      resolved_reason text NOT NULL,
      resolved_by_user_id uuid NULL,
      resolved_by_email text NULL,
      resolved_at timestamptz NOT NULL,
      retention_until timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_deletion_case_history_target_resolved
    ON deletion_case_history (target_user_id, resolved_at DESC);
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_deletion_case_history_retention
    ON deletion_case_history (retention_until ASC);
  `;
  await ensureLearningAccessTables(prisma);
}

function supportAdminSessionExpiry() {
  return new Date(Date.now() + 12 * 60 * 60 * 1000);
}

function canUseSupportAdminUsername(username: string) {
  // Support console usernames can be any non-empty identifier.
  // If an allowlist is configured, enforce it; otherwise allow all.
  if (!username.trim()) return false;
  if (env.NODE_ENV === 'production' && env.SUPPORT_ADMIN_EMAILS_SET.size === 0) return false;
  if (env.SUPPORT_ADMIN_EMAILS_SET.size === 0) return true;
  return env.SUPPORT_ADMIN_EMAILS_SET.has(username);
}

function resolveSupportAdminResetUrlBase(request: FastifyRequest) {
  const configured = env.RESET_URL_BASE?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const originHeader = request.headers.origin;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  if (origin && origin.trim()) return origin.trim().replace(/\/$/, '');
  const firstAllowed = Array.from(allowedOrigins)[0]?.trim();
  return firstAllowed ? firstAllowed.replace(/\/$/, '') : null;
}

async function requireSupportAdminSession(request: FastifyRequest, reply: FastifyReply) {
  const identity = await resolveSupportAdminFromRequest(request);
  if (!identity) {
    reply.code(401).send({ error: 'Not signed in to support admin' });
    return null;
  }
  return identity;
}

async function hardDeleteUserData(targetUserId: string) {
  await prisma.$transaction(async (tx) => {
    if (env.AUTH_MODE === 'local') {
      await tx.refreshSession.deleteMany({ where: { userId: targetUserId } });
      await tx.localAuthCredential.deleteMany({ where: { userId: targetUserId } });
    }

    await tx.passwordResetToken.deleteMany({ where: { userId: targetUserId } });
    await tx.quizAttempt.deleteMany({ where: { userId: targetUserId } });
    await tx.speakAttempt.deleteMany({ where: { userId: targetUserId } });
    await tx.wordMemoryState.deleteMany({ where: { userId: targetUserId } });
    await tx.progressEvent.deleteMany({ where: { userId: targetUserId } });
    await tx.userProgress.deleteMany({ where: { userId: targetUserId } });
    await tx.profile.deleteMany({ where: { userId: targetUserId } });

    await tx.$executeRaw`
      DELETE FROM support_notes WHERE target_user_id = ${targetUserId}::uuid
    `;
    await tx.$executeRaw`
      DELETE FROM support_notes WHERE actor_user_id = ${targetUserId}::uuid
    `;
    await tx.$executeRaw`
      DELETE FROM deletion_requests WHERE target_user_id = ${targetUserId}::uuid
    `;
    await tx.$executeRaw`
      DELETE FROM deletion_requests
      WHERE requested_by_user_id = ${targetUserId}::uuid OR resolved_by_user_id = ${targetUserId}::uuid
    `;
    await tx.$executeRaw`
      DELETE FROM account_security_events WHERE target_user_id = ${targetUserId}::uuid
    `;
    await tx.$executeRaw`
      DELETE FROM account_security_events WHERE actor_user_id = ${targetUserId}::uuid
    `;
    await tx.$executeRaw`
      DELETE FROM admin_audit_logs
      WHERE target_user_id = ${targetUserId}::uuid OR actor_user_id = ${targetUserId}::uuid
    `;
  });

  if (env.AUTH_MODE === 'supabase') {
    try {
      const supabaseAdmin = getSupabaseAdmin();
      await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    } catch {
      // App-side deletion already finished.
    }
  }
}

export async function processScheduledAccountDeletions() {
  await ensureAdminConsoleTables();
  await prisma.$executeRaw`
    DELETE FROM deletion_case_history
    WHERE retention_until < now()
  `;
  const due = await prisma.$queryRaw<
    Array<{
      id: string;
      targetUserId: string;
      targetEmail: string | null;
      targetDisplayName: string | null;
      reason: string;
    }>
  >`
    SELECT
      sad.id,
      sad.target_user_id AS "targetUserId",
      sad.target_email AS "targetEmail",
      sad.target_display_name AS "targetDisplayName",
      sad.reason
    FROM scheduled_account_deletions sad
    WHERE sad.status = 'scheduled'
      AND sad.scheduled_for <= now()
    ORDER BY sad.scheduled_for ASC
    LIMIT 25
  `;

  for (const row of due) {
    try {
      await hardDeleteUserData(row.targetUserId);
      await prisma.$executeRaw`
        UPDATE scheduled_account_deletions
        SET status = 'completed', completed_at = now(), updated_at = now()
        WHERE id = ${row.id}::uuid
      `;
    } catch {
      // Keep row scheduled and retry on next processor pass.
    }
  }
}

export async function adminRoutes(app: FastifyInstance) {
  await ensureAdminConsoleTables();
  registerAdminAuthRoutes(app, {
    allowedOrigins,
    prisma,
    env,
    SUPPORT_ADMIN_DUMMY_PASSWORD_HASH,
    SUPPORT_ROOT_ADMIN_USERNAME,
    supportAdminLoginThrottle,
    supportAdminForgotPasswordThrottle,
    supportAdminResetWithTokenThrottle,
    createSupportAdminResetToken,
    hashSupportAdminResetToken,
    supportAdminSessionExpiry,
    canUseSupportAdminUsername,
    resolveSupportAdminResetUrlBase,
    requireSupportAdminSession,
  });

  const adminTimelineHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = adminTimelineQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
      return;
    }
    try {
      const timeline = await prisma.$queryRaw<
        Array<{ createdAt: Date; source: string; title: string; detail: string | null }>
      >`
        SELECT
          aal.created_at AS "createdAt",
          'admin_task'::text AS source,
          aal.action::text AS title,
          CONCAT('result=', aal.result, '; reason=', aal.reason)::text AS detail
        FROM admin_audit_logs aal
        WHERE aal.actor_user_id::text = ${request.user.id}
          AND aal.created_at >= now() - (${parsed.data.windowHours} * interval '1 hour')
        ORDER BY aal.created_at DESC
        LIMIT ${parsed.data.limit}
      `;
      return { windowHours: parsed.data.windowHours, timeline };
    } catch (error) {
      request.log.error(
        {
          adminTimeline: true,
          actorUserId: request.user.id,
          windowHours: parsed.data.windowHours,
          limit: parsed.data.limit,
          error,
        },
        'admin_timeline_query_failed'
      );
      return { windowHours: parsed.data.windowHours, timeline: [] };
    }
  };

  app.get('/v1/admin/me/timeline', { preHandler: [requireAdmin] }, adminTimelineHandler);
  // Backward-compatible alias in case clients still call the older path.
  app.get('/v1/admin/timeline', { preHandler: [requireAdmin] }, adminTimelineHandler);

  registerAdminQualityReportsRoutes(app, { allowedOrigins });
  registerAdminReportsRoutes(app);
  registerAdminUserLookupRoutes(app);
  registerAdminMetricsRoutes(app);
  registerAdminUserExportRoutes(app);
  registerAdminUserOpsRoutes(app, { allowedOrigins });
}
