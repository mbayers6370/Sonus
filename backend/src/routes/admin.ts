import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { env } from '../env.js';
import { requireAdmin } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { readAllowedOrigins, requireTrustedOrigin } from '../lib/originPolicy.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { resolveLexemeForWordId } from '../lib/lexemeCatalog.js';
import { sendAccountDeletionConfirmationEmail } from '../services/accountDeletionEmailService.js';
import {
  createSupportAdminSessionToken,
  hashSupportAdminSessionToken,
  normalizeSupportAdminUsername,
  resolveSupportAdminFromRequest,
} from '../lib/supportAdminAuth.js';
import { hashPassword, verifyPassword } from '../lib/localAuth.js';

const allowedOrigins = readAllowedOrigins();

const userIdParamsSchema = z.object({
  userId: z.string().uuid(),
});

const userSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const timelineQuerySchema = z.object({
  limit: z.coerce.number().int().min(10).max(200).default(80),
});
const notesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(60),
});
const noteDeleteParamsSchema = z.object({
  userId: z.string().uuid(),
  noteId: z.string().uuid(),
});

const mutationReasonSchema = z.object({
  reason: z.string().trim().min(8).max(500),
});

const noteMutationSchema = mutationReasonSchema.extend({
  note: z.string().trim().min(3).max(4000),
});

const deletionRequestSchema = mutationReasonSchema.extend({
  channel: z.string().trim().min(2).max(80).optional(),
});

const deletionResolveSchema = mutationReasonSchema.extend({
  status: z.enum(['resolved', 'rejected']),
});
const permanentDeleteSchema = mutationReasonSchema;
const recentDeletionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

const supportAdminSetPasswordSchema = z.object({
  username: z.string().trim().min(3).max(160),
  password: z.string().min(10).max(128),
  currentPassword: z.string().min(1).max(128).optional(),
});

const supportAdminLoginSchema = z.object({
  username: z.string().trim().min(3).max(160),
  password: z.string().min(1).max(128),
});
const supportAdminSetupStatusSchema = z.object({
  username: z.string().trim().min(3).max(160).optional(),
});
const metricsOverviewQuerySchema = z.object({
  windowDays: z.coerce.number().int().min(1).max(180).default(30),
});
const adminTimelineQuerySchema = z.object({
  windowHours: z.coerce.number().int().min(1).max(168).default(24),
  limit: z.coerce.number().int().min(1).max(200).default(80),
});
const openDeletionRequestsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const deletionCasesQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
const weakWordsQuerySchema = z.object({
  limit: z.coerce.number().int().min(5).max(100).default(20),
  windowDays: z.coerce.number().int().min(1).max(365).default(30),
});
const weakWordsByLanguageQuerySchema = z.object({
  limitPerLanguage: z.coerce.number().int().min(1).max(20).default(5),
  windowDays: z.coerce.number().int().min(1).max(365).default(30),
});

type MutationActor = {
  actorUserId: string;
  actorEmail: string | null;
};

function toInt(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function safeCount(query: Prisma.Sql) {
  try {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(query);
    return toInt(rows[0]?.count);
  } catch {
    return 0;
  }
}

async function ensureAdminConsoleTables() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS support_admin_credentials (
      username text PRIMARY KEY,
      password_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
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
}

function supportAdminSessionExpiry() {
  return new Date(Date.now() + 12 * 60 * 60 * 1000);
}

function canUseSupportAdminUsername(username: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) return false;
  if (env.SUPPORT_ADMIN_EMAILS_SET.size === 0) return env.NODE_ENV !== 'production';
  return env.SUPPORT_ADMIN_EMAILS_SET.has(username);
}

async function logAdminAudit(params: {
  actor: MutationActor;
  action: string;
  targetUserId: string;
  reason: string;
  result: 'ok' | 'error';
  metadata?: Record<string, unknown>;
}) {
  await prisma.$executeRaw`
    INSERT INTO admin_audit_logs
      (id, actor_user_id, actor_email, action, target_user_id, reason, result, metadata_json, created_at)
    VALUES
      (gen_random_uuid(), ${params.actor.actorUserId}::uuid, ${params.actor.actorEmail}, ${params.action}, ${params.targetUserId}::uuid, ${params.reason}, ${params.result}, ${params.metadata ? JSON.stringify(params.metadata) : null}::jsonb, now())
  `;
}

async function logAccountSecurityEvent(params: {
  actor: MutationActor;
  eventType: string;
  targetUserId: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.$executeRaw`
    INSERT INTO account_security_events
      (id, target_user_id, actor_user_id, actor_email, event_type, detail, metadata_json, created_at)
    VALUES
      (gen_random_uuid(), ${params.targetUserId}::uuid, ${params.actor.actorUserId}::uuid, ${params.actor.actorEmail}, ${params.eventType}, ${params.detail || null}, ${params.metadata ? JSON.stringify(params.metadata) : null}::jsonb, now())
  `;
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

  app.get('/v1/admin/auth/setup-status', async (request, reply) => {
    const parsed = supportAdminSetupStatusSchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
      return;
    }

    const username = parsed.data.username
      ? normalizeSupportAdminUsername(parsed.data.username)
      : null;
    const totalRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM support_admin_credentials
    `;
    const configuredCount = Number(totalRows[0]?.count || 0);
    const globallyConfigured = configuredCount > 0;

    if (!username) {
      return {
        setupRequired: !globallyConfigured,
        configured: globallyConfigured,
      };
    }

    const usernameRows = await prisma.$queryRaw<Array<{ username: string }>>`
      SELECT username
      FROM support_admin_credentials
      WHERE username = ${username}
      LIMIT 1
    `;

    return {
      setupRequired: usernameRows.length === 0,
      configured: globallyConfigured,
      usernameConfigured: usernameRows.length > 0,
    };
  });

  app.post('/v1/admin/auth/set-password', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

    const parsed = supportAdminSetPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }
    const username = normalizeSupportAdminUsername(parsed.data.username);
    if (!canUseSupportAdminUsername(username)) {
      reply.code(400).send({ error: 'Username must be an email.' });
      return;
    }

    const existing = await prisma.$queryRaw<Array<{ username: string; password_hash: string }>>`
      SELECT username, password_hash
      FROM support_admin_credentials
      WHERE username = ${username}
      LIMIT 1
    `;
    const row = existing[0] ?? null;

    if (row) {
      reply
        .code(403)
        .send({ error: 'Password for this support admin username is already configured.' });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await prisma.$executeRaw`
      INSERT INTO support_admin_credentials (username, password_hash, created_at, updated_at)
      VALUES (${username}, ${passwordHash}, now(), now())
      ON CONFLICT (username)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        updated_at = now()
    `;

    await prisma.$executeRaw`
      INSERT INTO account_security_events
        (id, target_user_id, actor_user_id, actor_email, event_type, detail, metadata_json, created_at)
      VALUES
        (
          gen_random_uuid(),
          ${request.user?.id || env.DEV_USER_ID}::uuid,
          null,
          ${username},
          'support_admin_password_set',
          'Support admin password set/rotated',
          ${JSON.stringify({ username })}::jsonb,
          now()
        )
    `;

    return { ok: true };
  });

  app.post('/v1/admin/auth/login', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

    const parsed = supportAdminLoginSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }
    const username = normalizeSupportAdminUsername(parsed.data.username);
    const rows = await prisma.$queryRaw<Array<{ username: string; password_hash: string }>>`
      SELECT username, password_hash
      FROM support_admin_credentials
      WHERE username = ${username}
      LIMIT 1
    `;
    const row = rows[0] ?? null;
    if (!row) {
      reply.code(401).send({ error: 'Invalid username or password' });
      return;
    }
    const passwordOk = await verifyPassword(parsed.data.password, row.password_hash).catch(
      () => false
    );
    if (!passwordOk) {
      await prisma.$executeRaw`
        INSERT INTO account_security_events
          (id, target_user_id, actor_user_id, actor_email, event_type, detail, metadata_json, created_at)
        VALUES
          (
            gen_random_uuid(),
            ${env.DEV_USER_ID}::uuid,
            null,
            ${username},
            'support_admin_login_failed',
            'Invalid support admin credentials',
            ${JSON.stringify({ username })}::jsonb,
            now()
          )
      `;
      reply.code(401).send({ error: 'Invalid username or password' });
      return;
    }

    const rawToken = createSupportAdminSessionToken();
    const tokenHash = hashSupportAdminSessionToken(rawToken);
    const expiresAt = supportAdminSessionExpiry();
    await prisma.$executeRaw`
      INSERT INTO support_admin_sessions (id, username, token_hash, expires_at, revoked_at, created_at, last_used_at)
      VALUES (gen_random_uuid(), ${username}, ${tokenHash}, ${expiresAt}, null, now(), now())
    `;

    await prisma.$executeRaw`
      INSERT INTO account_security_events
        (id, target_user_id, actor_user_id, actor_email, event_type, detail, metadata_json, created_at)
      VALUES
        (
          gen_random_uuid(),
          ${env.DEV_USER_ID}::uuid,
          null,
          ${username},
          'support_admin_login_succeeded',
          'Support admin login succeeded',
          ${JSON.stringify({ username })}::jsonb,
          now()
        )
    `;

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

  app.post('/v1/admin/auth/logout', async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;
    const identity = await resolveSupportAdminFromRequest(request);
    if (!identity) {
      return { ok: true };
    }
    await prisma.$executeRaw`
      UPDATE support_admin_sessions
      SET revoked_at = now()
      WHERE id = ${identity.sessionId}::uuid
    `;
    return { ok: true };
  });

  app.get(
    '/v1/admin/metrics/support/overview',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = metricsOverviewQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }
      const windowDays = parsed.data.windowDays;
      const windowInterval = `${windowDays} days`;

      const [
        failedLogins,
        resetRequests,
        sessionRevocations,
        unauthorizedAdminAttempts,
        noteCount,
        noteFailureCount,
        endUserFailedLogins,
        emailVerificationRequired,
        newIpLogins,
        newDeviceLogins,
      ] = await Promise.all([
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'support_admin_login_failed' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM password_reset_tokens prt WHERE prt.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM refresh_sessions rs WHERE rs.revoked_at IS NOT NULL AND rs.revoked_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'admin_route_access_denied' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM support_notes sn WHERE sn.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'support_note_create_failed' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'auth_login_failed' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'email_verification_required' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'auth_login_new_ip' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'auth_login_new_device' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
      ]);

      const authErrorBreakdown = await prisma.$queryRaw<
        Array<{ eventType: string; count: bigint }>
      >`
      SELECT ase.event_type AS "eventType", COUNT(*)::bigint AS count
      FROM account_security_events ase
      WHERE ase.event_type LIKE 'auth_error_%'
        AND ase.created_at >= now() - ${windowInterval}::interval
      GROUP BY ase.event_type
      ORDER BY count DESC
      LIMIT 10
    `.catch(() => []);

      const authFailureByEndpoint = await prisma.$queryRaw<
        Array<{ endpoint: string; count: bigint }>
      >`
      SELECT
        COALESCE(ase.metadata_json->>'endpoint', 'unknown') AS endpoint,
        COUNT(*)::bigint AS count
      FROM account_security_events ase
      WHERE ase.event_type LIKE 'auth_error_%'
        AND ase.created_at >= now() - ${windowInterval}::interval
      GROUP BY COALESCE(ase.metadata_json->>'endpoint', 'unknown')
      ORDER BY count DESC
      LIMIT 10
    `.catch(() => []);

      return {
        windowDays,
        support: {
          failedLogins,
          endUserFailedLogins,
          resetRequests,
          emailVerificationRequired,
          newIpLogins,
          newDeviceLogins,
          sessionRevocations,
          unauthorizedAdminAttempts,
          supportNotesCreated: noteCount,
          supportNoteCreateFailures: noteFailureCount,
          authErrorBreakdown: authErrorBreakdown.map((row) => ({
            eventType: row.eventType,
            count: toInt(row.count),
          })),
          authFailureByEndpoint: authFailureByEndpoint.map((row) => ({
            endpoint: row.endpoint,
            count: toInt(row.count),
          })),
        },
      };
    }
  );

  app.get(
    '/v1/admin/metrics/support/deletion-cases',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = deletionCasesQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }

      const searchTerm = parsed.data.q?.trim();
      const likeSearch = searchTerm ? `%${searchTerm}%` : null;

      const cases = await prisma.$queryRaw<
        Array<{
          sourceType: string;
          status: string;
          targetUserId: string;
          targetEmail: string | null;
          targetDisplayName: string | null;
          reason: string;
          channel: string | null;
          eventAt: Date;
          detail: string | null;
        }>
      >`
      SELECT *
      FROM (
        SELECT
          'request'::text AS "sourceType",
          dr.status::text AS status,
          dr.target_user_id AS "targetUserId",
          p.email AS "targetEmail",
          p.display_name AS "targetDisplayName",
          dr.request_reason AS reason,
          dr.request_channel AS channel,
          dr.created_at AS "eventAt",
          NULL::text AS detail
        FROM deletion_requests dr
        LEFT JOIN profiles p ON p.user_id = dr.target_user_id

        UNION ALL

        SELECT
          'scheduled'::text AS "sourceType",
          sad.status::text AS status,
          sad.target_user_id AS "targetUserId",
          sad.target_email AS "targetEmail",
          sad.target_display_name AS "targetDisplayName",
          sad.reason::text AS reason,
          NULL::text AS channel,
          sad.updated_at AS "eventAt",
          CONCAT('days=', sad.hold_days)::text AS detail
        FROM scheduled_account_deletions sad

        UNION ALL

        SELECT
          'decision'::text AS "sourceType",
          dch.outcome::text AS status,
          dch.target_user_id AS "targetUserId",
          dch.target_email AS "targetEmail",
          dch.target_display_name AS "targetDisplayName",
          dch.request_reason::text AS reason,
          dch.request_channel AS channel,
          dch.resolved_at AS "eventAt",
          dch.resolved_reason::text AS detail
        FROM deletion_case_history dch
      ) t
      WHERE
        ${likeSearch}::text IS NULL
        OR COALESCE(t."targetEmail", '') ILIKE ${likeSearch}
        OR COALESCE(t."targetDisplayName", '') ILIKE ${likeSearch}
        OR t."targetUserId"::text ILIKE ${likeSearch}
      ORDER BY t."eventAt" DESC
      LIMIT ${parsed.data.limit}
    `;

      return { cases };
    }
  );

  app.get(
    '/v1/admin/metrics/learning/overview',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = metricsOverviewQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }
      const windowDays = parsed.data.windowDays;
      const windowInterval = `${windowDays} days`;

      const rows = await prisma.$queryRaw<
        Array<{
          quizAttempts: bigint;
          quizCorrect: bigint;
          speakAttempts: bigint;
          speakPassed: bigint;
          lessonStarts: bigint;
          lessonCompletedAsStartFallback: bigint;
          lessonCompleted: bigint;
          applyCompleted: bigint;
        }>
      >`
      SELECT
        (SELECT COUNT(*)::bigint FROM quiz_attempts qa WHERE qa.created_at >= now() - ${windowInterval}::interval) AS "quizAttempts",
        (SELECT COUNT(*)::bigint FROM quiz_attempts qa WHERE qa.is_correct = true AND qa.created_at >= now() - ${windowInterval}::interval) AS "quizCorrect",
        (SELECT COUNT(*)::bigint FROM speak_attempts sa WHERE sa.created_at >= now() - ${windowInterval}::interval) AS "speakAttempts",
        (SELECT COUNT(*)::bigint FROM speak_attempts sa WHERE sa.initial_ok = true AND sa.final_ok = true AND sa.tone_ok = true AND sa.created_at >= now() - ${windowInterval}::interval) AS "speakPassed",
        (SELECT COUNT(*)::bigint FROM progress_events pe WHERE pe.event_type = 'lesson_started' AND pe.created_at >= now() - ${windowInterval}::interval) AS "lessonStarts",
        (SELECT COUNT(*)::bigint FROM progress_events pe WHERE pe.event_type = 'lesson_completed' AND pe.created_at >= now() - ${windowInterval}::interval) AS "lessonCompletedAsStartFallback",
        (SELECT COUNT(*)::bigint FROM progress_events pe WHERE pe.event_type = 'lesson_completed' AND pe.created_at >= now() - ${windowInterval}::interval) AS "lessonCompleted",
        (SELECT COUNT(*)::bigint FROM progress_events pe WHERE pe.event_type = 'apply_completed' AND pe.created_at >= now() - ${windowInterval}::interval) AS "applyCompleted"
    `;

      const [summary] = rows;
      const quizAttempts = toInt(summary?.quizAttempts);
      const quizCorrect = toInt(summary?.quizCorrect);
      const speakAttempts = toInt(summary?.speakAttempts);
      const speakPassed = toInt(summary?.speakPassed);
      const lessonStartsRaw = toInt(summary?.lessonStarts);
      const lessonCompletedAsStartFallback = toInt(summary?.lessonCompletedAsStartFallback);
      // If lesson_started instrumentation is sparse in older data, use completed as a conservative floor.
      const lessonStarts = Math.max(lessonStartsRaw, lessonCompletedAsStartFallback);
      const lessonCompleted = toInt(summary?.lessonCompleted);
      const lessonAbandons = Math.max(0, lessonStarts - lessonCompleted);

      const pct = (num: number, den: number) =>
        den > 0 ? Number(((num / den) * 100).toFixed(2)) : 0;

      return {
        windowDays,
        learning: {
          quizAttempts,
          quizAccuracyPct: pct(quizCorrect, quizAttempts),
          speakAttempts,
          speakPassPct: pct(speakPassed, speakAttempts),
          lessonStarts,
          lessonStartsTracked: lessonStartsRaw,
          lessonCompleted,
          lessonCompletionPct: pct(lessonCompleted, lessonStarts),
          lessonAbandons,
          applyCompleted: toInt(summary?.applyCompleted),
        },
      };
    }
  );

  app.get(
    '/v1/admin/metrics/learning/weak-words',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = weakWordsQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }
      const windowInterval = `${parsed.data.windowDays} days`;

      const words = await prisma.$queryRaw<
        Array<{
          wordId: string;
          misses: bigint;
          attempts: bigint;
          missRatePct: number;
        }>
      >`
      SELECT
        qa.word_id AS "wordId",
        COUNT(*) FILTER (WHERE qa.is_correct = false)::bigint AS misses,
        COUNT(*)::bigint AS attempts,
        ROUND(
          (COUNT(*) FILTER (WHERE qa.is_correct = false)::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100,
          2
        ) AS "missRatePct"
      FROM quiz_attempts qa
      WHERE qa.created_at >= now() - ${windowInterval}::interval
      GROUP BY qa.word_id
      HAVING COUNT(*) FILTER (WHERE qa.is_correct = false) > 0
      ORDER BY misses DESC, "missRatePct" DESC
      LIMIT ${parsed.data.limit}
    `;

      return {
        windowDays: parsed.data.windowDays,
        count: words.length,
        words: words.map((item) => ({
          wordId: item.wordId,
          misses: toInt(item.misses),
          attempts: toInt(item.attempts),
          missRatePct: Number(item.missRatePct || 0),
        })),
      };
    }
  );

  app.get(
    '/v1/admin/metrics/learning/weak-words-by-language',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = weakWordsByLanguageQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }

      const windowInterval = `${parsed.data.windowDays} days`;
      const limitPerLanguage = parsed.data.limitPerLanguage;
      const languages = ['zh', 'ja', 'kr', 'fr', 'it', 'es'];

      const rows = await prisma.$queryRaw<
        Array<{
          language: string;
          wordId: string;
          misses: bigint;
          attempts: bigint;
          missRatePct: number;
        }>
      >`
      WITH agg AS (
        SELECT
          CASE
            WHEN qa.word_id LIKE 'L%' THEN 'zh'
            WHEN qa.word_id LIKE 'N%' THEN 'ja'
            ELSE 'unknown'
          END AS language,
          qa.word_id AS "wordId",
          COUNT(*) FILTER (WHERE qa.is_correct = false)::bigint AS misses,
          COUNT(*)::bigint AS attempts,
          ROUND(
            (COUNT(*) FILTER (WHERE qa.is_correct = false)::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100,
            2
          ) AS "missRatePct"
        FROM quiz_attempts qa
        WHERE qa.created_at >= now() - ${windowInterval}::interval
        GROUP BY language, qa.word_id
        HAVING COUNT(*) FILTER (WHERE qa.is_correct = false) > 0
      ),
      ranked AS (
        SELECT
          language,
          "wordId",
          misses,
          attempts,
          "missRatePct",
          ROW_NUMBER() OVER (PARTITION BY language ORDER BY misses DESC, "missRatePct" DESC) AS rn
        FROM agg
      )
      SELECT language, "wordId", misses, attempts, "missRatePct"
      FROM ranked
      WHERE rn <= ${limitPerLanguage}
      ORDER BY language, misses DESC, "missRatePct" DESC
    `.catch(() => []);

      const byLanguage = Object.fromEntries(
        languages.map((languageId) => [
          languageId,
          [] as Array<{
            wordId: string;
            misses: number;
            attempts: number;
            missRatePct: number;
            nativeText: string;
            englishText: string;
          }>,
        ])
      ) as Record<
        string,
        Array<{
          wordId: string;
          misses: number;
          attempts: number;
          missRatePct: number;
          nativeText: string;
          englishText: string;
        }>
      >;

      for (const row of rows) {
        const language = languages.includes(row.language) ? row.language : null;
        if (!language) continue;
        const lexeme = await resolveLexemeForWordId(row.wordId, language).catch(() => null);
        byLanguage[language].push({
          wordId: row.wordId,
          misses: toInt(row.misses),
          attempts: toInt(row.attempts),
          missRatePct: Number(row.missRatePct || 0),
          nativeText: lexeme?.term || row.wordId,
          englishText: lexeme?.en || row.wordId,
        });
      }

      return {
        windowDays: parsed.data.windowDays,
        limitPerLanguage,
        languages: languages.map((languageId) => ({
          languageId,
          hasData: byLanguage[languageId].length > 0,
          words: byLanguage[languageId],
        })),
      };
    }
  );

  app.get(
    '/v1/admin/metrics/learning/weak-speak-words-by-language',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = weakWordsByLanguageQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }

      const windowInterval = `${parsed.data.windowDays} days`;
      const limitPerLanguage = parsed.data.limitPerLanguage;
      const languages = ['zh', 'ja', 'kr', 'fr', 'it', 'es'];

      const rows = await prisma.$queryRaw<
        Array<{
          language: string;
          wordId: string;
          misses: bigint;
          attempts: bigint;
          missRatePct: number;
        }>
      >`
      WITH scoped AS (
        SELECT
          COALESCE(NULLIF(LOWER(p.target_language), ''), 'unknown') AS language,
          sa.word_id,
          sa.initial_ok,
          sa.final_ok,
          sa.tone_ok
        FROM speak_attempts sa
        LEFT JOIN profiles p ON p.user_id = sa.user_id
        WHERE sa.created_at >= now() - ${windowInterval}::interval
      ),
      agg AS (
        SELECT
          language,
          word_id AS "wordId",
          COUNT(*) FILTER (WHERE initial_ok = false OR final_ok = false OR tone_ok = false)::bigint AS misses,
          COUNT(*)::bigint AS attempts,
          ROUND(
            (
              COUNT(*) FILTER (WHERE initial_ok = false OR final_ok = false OR tone_ok = false)::numeric /
              NULLIF(COUNT(*)::numeric, 0)
            ) * 100,
            2
          ) AS "missRatePct"
        FROM scoped
        GROUP BY language, word_id
        HAVING COUNT(*) FILTER (WHERE initial_ok = false OR final_ok = false OR tone_ok = false) > 0
      ),
      ranked AS (
        SELECT
          language,
          "wordId",
          misses,
          attempts,
          "missRatePct",
          ROW_NUMBER() OVER (PARTITION BY language ORDER BY misses DESC, "missRatePct" DESC) AS rn
        FROM agg
      )
      SELECT language, "wordId", misses, attempts, "missRatePct"
      FROM ranked
      WHERE rn <= ${limitPerLanguage}
      ORDER BY language, misses DESC, "missRatePct" DESC
    `.catch(() => []);

      const byLanguage = Object.fromEntries(
        languages.map((languageId) => [
          languageId,
          [] as Array<{
            wordId: string;
            misses: number;
            attempts: number;
            missRatePct: number;
            nativeText: string;
            englishText: string;
          }>,
        ])
      ) as Record<
        string,
        Array<{
          wordId: string;
          misses: number;
          attempts: number;
          missRatePct: number;
          nativeText: string;
          englishText: string;
        }>
      >;

      for (const row of rows) {
        const language = languages.includes(row.language) ? row.language : null;
        if (!language) continue;
        const lexeme = await resolveLexemeForWordId(row.wordId, language).catch(() => null);
        byLanguage[language].push({
          wordId: row.wordId,
          misses: toInt(row.misses),
          attempts: toInt(row.attempts),
          missRatePct: Number(row.missRatePct || 0),
          nativeText: lexeme?.term || row.wordId,
          englishText: lexeme?.en || row.wordId,
        });
      }

      return {
        windowDays: parsed.data.windowDays,
        limitPerLanguage,
        languages: languages.map((languageId) => ({
          languageId,
          hasData: byLanguage[languageId].length > 0,
          words: byLanguage[languageId],
        })),
      };
    }
  );

  app.get('/v1/admin/me', { preHandler: [requireAdmin] }, async (request) => {
    return {
      ok: true,
      actor: {
        id: request.user.id,
        email: request.user.email,
      },
    };
  });

  app.get('/v1/admin/users/search', { preHandler: [requireAdmin] }, async (request, reply) => {
    const parsed = userSearchQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
      return;
    }

    const searchTerm = parsed.data.q?.trim();
    const likeSearch = searchTerm ? `%${searchTerm}%` : null;
    const users = await prisma.$queryRaw<
      Array<{
        userId: string;
        email: string | null;
        displayName: string | null;
        targetLanguage: string | null;
        onboardingComplete: boolean;
        updatedAt: Date;
      }>
    >`
      SELECT
        p.user_id AS "userId",
        p.email,
        p.display_name AS "displayName",
        p.target_language AS "targetLanguage",
        p.onboarding_complete AS "onboardingComplete",
        p.updated_at AS "updatedAt"
      FROM profiles p
      WHERE
        NOT EXISTS (
          SELECT 1
          FROM scheduled_account_deletions sad
          WHERE sad.target_user_id = p.user_id
            AND sad.status = 'scheduled'
        )
        AND (
          ${likeSearch}::text IS NULL
          OR p.email ILIKE ${likeSearch}
          OR p.display_name ILIKE ${likeSearch}
        )
      ORDER BY p.updated_at DESC
      LIMIT ${parsed.data.limit}
    `;

    return { users };
  });

  app.get(
    '/v1/admin/deletion-requests/open',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = openDeletionRequestsQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }

      const requests = await prisma.$queryRaw<
        Array<{
          id: string;
          targetUserId: string;
          targetEmail: string | null;
          targetDisplayName: string | null;
          requestReason: string;
          requestChannel: string | null;
          createdAt: Date;
        }>
      >`
      SELECT
        dr.id,
        dr.target_user_id AS "targetUserId",
        p.email AS "targetEmail",
        p.display_name AS "targetDisplayName",
        dr.request_reason AS "requestReason",
        dr.request_channel AS "requestChannel",
        dr.created_at AS "createdAt"
      FROM deletion_requests dr
      LEFT JOIN profiles p ON p.user_id = dr.target_user_id
      WHERE dr.status = 'open'
      ORDER BY dr.created_at DESC
      LIMIT ${parsed.data.limit}
    `;

      return { requests };
    }
  );

  app.get(
    '/v1/admin/users/deletions/recent',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = recentDeletionQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }

      const rows = await prisma.$queryRaw<
        Array<{
          id: string;
          targetUserId: string;
          targetEmail: string | null;
          targetDisplayName: string | null;
          reason: string;
          status: string;
          holdDays: number;
          scheduledFor: Date;
          createdAt: Date;
          completedAt: Date | null;
          cancelledAt: Date | null;
        }>
      >`
      SELECT
        sad.id,
        sad.target_user_id AS "targetUserId",
        sad.target_email AS "targetEmail",
        sad.target_display_name AS "targetDisplayName",
        sad.reason,
        sad.status,
        sad.hold_days AS "holdDays",
        sad.scheduled_for AS "scheduledFor",
        sad.created_at AS "createdAt",
        sad.completed_at AS "completedAt",
        sad.cancelled_at AS "cancelledAt"
      FROM scheduled_account_deletions sad
      WHERE sad.status <> 'cancelled'
      ORDER BY sad.updated_at DESC
      LIMIT ${parsed.data.limit}
    `;

      const nowMs = Date.now();
      return {
        items: rows.map((row) => {
          const remainingDays = Math.max(
            0,
            Math.ceil((new Date(row.scheduledFor).getTime() - nowMs) / (24 * 60 * 60 * 1000))
          );
          return {
            ...row,
            daysRemaining: row.status === 'scheduled' ? remainingDays : 0,
          };
        }),
      };
    }
  );

  app.get('/v1/admin/users/:userId', { preHandler: [requireAdmin] }, async (request, reply) => {
    const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
    if (!parsedParams.success) {
      reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
      return;
    }

    const userId = parsedParams.data.userId;
    const profile = await prisma.profile.findUnique({
      where: { userId },
    });
    if (!profile) {
      reply.code(404).send({ error: 'User not found' });
      return;
    }

    const progress = await prisma.userProgress.findUnique({
      where: { userId },
    });
    const counts = await prisma.$queryRaw<
      Array<{ quizCount: bigint; speakCount: bigint; progressEventCount: bigint }>
    >`
      SELECT
        (SELECT COUNT(*)::bigint FROM quiz_attempts qa WHERE qa.user_id = ${userId}::uuid) AS "quizCount",
        (SELECT COUNT(*)::bigint FROM speak_attempts sa WHERE sa.user_id = ${userId}::uuid) AS "speakCount",
        (SELECT COUNT(*)::bigint FROM progress_events pe WHERE pe.user_id = ${userId}::uuid) AS "progressEventCount"
    `;

    const openDeletionRequest = await prisma.$queryRaw<
      Array<{ id: string; status: string; createdAt: Date; requestReason: string }>
    >`
      SELECT
        dr.id,
        dr.status,
        dr.created_at AS "createdAt",
        dr.request_reason AS "requestReason"
      FROM deletion_requests dr
      WHERE dr.target_user_id = ${userId}::uuid
      ORDER BY dr.created_at DESC
      LIMIT 1
    `;

    let activeSessionCountRows: Array<{ count: bigint }> = [];
    let recentIps: Array<{ ip: string; lastSeenAt: Date }> = [];
    let recentDevices: Array<{ device: string; lastSeenAt: Date }> = [];
    let lastPasswordResetRows: Array<{ usedAt: Date | null; createdAt: Date }> = [];
    let lastForcedLogoutRows: Array<{ createdAt: Date }> = [];
    try {
      [
        activeSessionCountRows,
        recentIps,
        recentDevices,
        lastPasswordResetRows,
        lastForcedLogoutRows,
      ] = await Promise.all([
        prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::bigint AS count
            FROM refresh_sessions rs
            WHERE rs.user_id = ${userId}::uuid
              AND rs.revoked_at IS NULL
              AND rs.expires_at > now()
          `,
        prisma.$queryRaw<Array<{ ip: string; lastSeenAt: Date }>>`
            SELECT
              rs.created_ip AS ip,
              MAX(rs.created_at) AS "lastSeenAt"
            FROM refresh_sessions rs
            WHERE rs.user_id = ${userId}::uuid
              AND rs.created_ip IS NOT NULL
              AND LENGTH(TRIM(rs.created_ip)) > 0
            GROUP BY rs.created_ip
            ORDER BY MAX(rs.created_at) DESC
            LIMIT 5
          `,
        prisma.$queryRaw<Array<{ device: string; lastSeenAt: Date }>>`
            SELECT
              rs.created_user_agent AS device,
              MAX(rs.created_at) AS "lastSeenAt"
            FROM refresh_sessions rs
            WHERE rs.user_id = ${userId}::uuid
              AND rs.created_user_agent IS NOT NULL
              AND LENGTH(TRIM(rs.created_user_agent)) > 0
            GROUP BY rs.created_user_agent
            ORDER BY MAX(rs.created_at) DESC
            LIMIT 5
          `,
        prisma.$queryRaw<Array<{ usedAt: Date | null; createdAt: Date }>>`
            SELECT
              prt.used_at AS "usedAt",
              prt.created_at AS "createdAt"
            FROM password_reset_tokens prt
            WHERE prt.user_id = ${userId}::uuid
            ORDER BY COALESCE(prt.used_at, prt.created_at) DESC
            LIMIT 1
          `,
        prisma.$queryRaw<Array<{ createdAt: Date }>>`
            SELECT aal.created_at AS "createdAt"
            FROM admin_audit_logs aal
            WHERE aal.target_user_id = ${userId}::uuid
              AND aal.action = 'sessions.revoked'
            ORDER BY aal.created_at DESC
            LIMIT 1
          `,
      ]);
    } catch (error) {
      request.log.error(
        {
          supportConsole: true,
          route: '/v1/admin/users/:userId',
          userId,
          error,
        },
        'support_console_security_context_failed'
      );
    }

    return {
      profile,
      progress,
      counts: {
        quizCount: toInt(counts[0]?.quizCount),
        speakCount: toInt(counts[0]?.speakCount),
        progressEventCount: toInt(counts[0]?.progressEventCount),
      },
      security: {
        activeSessionCount: toInt(activeSessionCountRows[0]?.count),
        recentIps: recentIps.map((row) => ({ ip: row.ip, lastSeenAt: row.lastSeenAt })),
        recentDevices: recentDevices.map((row) => ({
          device: row.device,
          lastSeenAt: row.lastSeenAt,
        })),
        lastPasswordResetAt: (lastPasswordResetRows[0]?.usedAt ||
          lastPasswordResetRows[0]?.createdAt ||
          null) as Date | null,
        lastForcedLogoutAt: (lastForcedLogoutRows[0]?.createdAt || null) as Date | null,
      },
      deletionRequest: openDeletionRequest[0] || null,
    };
  });

  app.get(
    '/v1/admin/users/:userId/timeline',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedQuery = timelineQuerySchema.safeParse(request.query ?? {});
      if (!parsedQuery.success) {
        reply
          .code(400)
          .send({ error: 'Invalid query parameters', issues: parsedQuery.error.issues });
        return;
      }

      const userId = parsedParams.data.userId;
      const timeline = await prisma.$queryRaw<
        Array<{ createdAt: Date; source: string; title: string; detail: string | null }>
      >`
      SELECT created_at AS "createdAt", source, title, detail
      FROM (
        SELECT
          aal.created_at,
          'admin_audit'::text AS source,
          aal.action::text AS title,
          CONCAT('result=', aal.result, '; reason=', aal.reason)::text AS detail
        FROM admin_audit_logs aal
        WHERE aal.target_user_id = ${userId}::uuid

        UNION ALL

        SELECT
          sn.created_at,
          'support_note'::text AS source,
          'Support note'::text AS title,
          sn.note::text AS detail
        FROM support_notes sn
        WHERE sn.target_user_id = ${userId}::uuid

        UNION ALL

        SELECT
          ase.created_at,
          'security_event'::text AS source,
          ase.event_type::text AS title,
          ase.detail::text AS detail
        FROM account_security_events ase
        WHERE ase.target_user_id = ${userId}::uuid

        UNION ALL

        SELECT
          pe.created_at,
          'progress_event'::text AS source,
          pe.event_type::text AS title,
          null::text AS detail
        FROM progress_events pe
        WHERE pe.user_id = ${userId}::uuid
      ) timeline
      ORDER BY created_at DESC
      LIMIT ${parsedQuery.data.limit}
    `;

      return { timeline };
    }
  );

  app.get(
    '/v1/admin/users/:userId/notes',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedQuery = notesQuerySchema.safeParse(request.query ?? {});
      if (!parsedQuery.success) {
        reply
          .code(400)
          .send({ error: 'Invalid query parameters', issues: parsedQuery.error.issues });
        return;
      }

      const notes = await prisma.$queryRaw<
        Array<{ id: string; createdAt: Date; note: string; actorEmail: string | null }>
      >`
      SELECT
        sn.id,
        sn.created_at AS "createdAt",
        sn.note,
        sn.actor_email AS "actorEmail"
      FROM support_notes sn
      WHERE sn.target_user_id = ${parsedParams.data.userId}::uuid
      ORDER BY sn.created_at DESC
      LIMIT ${parsedQuery.data.limit}
    `;

      return { notes };
    }
  );

  app.post(
    '/v1/admin/users/:userId/notes',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      const actor: MutationActor = {
        actorUserId: request.user.id,
        actorEmail: request.user.email,
      };
      if (!parsedParams.success) {
        await logAccountSecurityEvent({
          actor,
          eventType: 'support_note_create_failed',
          targetUserId: request.user.id,
          detail: 'Support note creation failed: invalid target user id',
        }).catch(() => undefined);
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedBody = noteMutationSchema.safeParse(request.body);
      if (!parsedBody.success) {
        await logAccountSecurityEvent({
          actor,
          eventType: 'support_note_create_failed',
          targetUserId: parsedParams.data.userId,
          detail: 'Support note creation failed: invalid payload',
        }).catch(() => undefined);
        await logAdminAudit({
          actor,
          action: 'support_note.created',
          targetUserId: parsedParams.data.userId,
          reason: 'invalid_payload',
          result: 'error',
        }).catch(() => undefined);
        reply.code(400).send({ error: 'Invalid payload', issues: parsedBody.error.issues });
        return;
      }

      const targetUserId = parsedParams.data.userId;

      try {
        await prisma.$executeRaw`
        INSERT INTO support_notes
          (id, target_user_id, actor_user_id, actor_email, note, created_at, updated_at)
        VALUES
          (gen_random_uuid(), ${targetUserId}::uuid, ${actor.actorUserId}::uuid, ${actor.actorEmail}, ${parsedBody.data.note}, now(), now())
      `;
        await logAdminAudit({
          actor,
          action: 'support_note.created',
          targetUserId,
          reason: parsedBody.data.reason,
          result: 'ok',
        });
        await logAccountSecurityEvent({
          actor,
          eventType: 'support_note_created',
          targetUserId,
          detail: 'Support note created successfully',
        });
      } catch (error) {
        await logAdminAudit({
          actor,
          action: 'support_note.created',
          targetUserId,
          reason: parsedBody.data.reason,
          result: 'error',
        });
        await logAccountSecurityEvent({
          actor,
          eventType: 'support_note_create_failed',
          targetUserId,
          detail:
            error instanceof Error
              ? `Support note creation failed: ${error.message}`
              : 'Support note creation failed',
        });
        throw error;
      }

      return { ok: true };
    }
  );

  app.post(
    '/v1/admin/users/:userId/notes/:noteId/delete',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

      const parsedParams = noteDeleteParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid params', issues: parsedParams.error.issues });
        return;
      }
      const parsedBody = mutationReasonSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: 'Invalid payload', issues: parsedBody.error.issues });
        return;
      }

      const actor: MutationActor = {
        actorUserId: request.user.id,
        actorEmail: request.user.email,
      };
      const { userId: targetUserId, noteId } = parsedParams.data;

      const deletedRows = await prisma.$queryRaw<Array<{ id: string }>>`
        DELETE FROM support_notes
        WHERE id = ${noteId}::uuid
          AND target_user_id = ${targetUserId}::uuid
        RETURNING id
      `;
      if (!deletedRows[0]?.id) {
        reply.code(404).send({ error: 'Note not found for this user.' });
        return;
      }

      await logAdminAudit({
        actor,
        action: 'support_note.deleted',
        targetUserId,
        reason: parsedBody.data.reason,
        result: 'ok',
        metadata: { noteId },
      });
      await logAccountSecurityEvent({
        actor,
        eventType: 'support_note_deleted',
        targetUserId,
        detail: 'Support note deleted',
        metadata: { noteId },
      }).catch(() => undefined);

      return { ok: true };
    }
  );

  app.post(
    '/v1/admin/users/:userId/actions/reset-walkthrough',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedBody = mutationReasonSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: 'Invalid payload', issues: parsedBody.error.issues });
        return;
      }

      const actor: MutationActor = {
        actorUserId: request.user.id,
        actorEmail: request.user.email,
      };
      const targetUserId = parsedParams.data.userId;

      await prisma.profile.updateMany({
        where: { userId: targetUserId },
        data: { onboardingComplete: false },
      });
      await logAdminAudit({
        actor,
        action: 'walkthrough.reset',
        targetUserId,
        reason: parsedBody.data.reason,
        result: 'ok',
      });

      return { ok: true };
    }
  );

  app.post(
    '/v1/admin/users/:userId/actions/revoke-sessions',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedBody = mutationReasonSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: 'Invalid payload', issues: parsedBody.error.issues });
        return;
      }

      const actor: MutationActor = {
        actorUserId: request.user.id,
        actorEmail: request.user.email,
      };
      const targetUserId = parsedParams.data.userId;
      const now = new Date();

      const revoked = await prisma.refreshSession.updateMany({
        where: {
          userId: targetUserId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revokedReason: `admin_revoked:${parsedBody.data.reason}`,
        },
      });

      await logAccountSecurityEvent({
        actor,
        eventType: 'sessions_revoked',
        targetUserId,
        detail: `Revoked ${revoked.count} active refresh session(s).`,
      });
      await logAdminAudit({
        actor,
        action: 'sessions.revoked',
        targetUserId,
        reason: parsedBody.data.reason,
        result: 'ok',
        metadata: { revokedCount: revoked.count },
      });

      return { ok: true, revokedCount: revoked.count };
    }
  );

  app.post(
    '/v1/admin/users/:userId/actions/request-deletion',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedBody = deletionRequestSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: 'Invalid payload', issues: parsedBody.error.issues });
        return;
      }

      const actor: MutationActor = {
        actorUserId: request.user.id,
        actorEmail: request.user.email,
      };
      const targetUserId = parsedParams.data.userId;

      await prisma.$executeRaw`
        INSERT INTO deletion_requests
          (id, target_user_id, status, requested_by_user_id, requested_by_email, request_reason, request_channel, created_at, updated_at)
        VALUES
          (gen_random_uuid(), ${targetUserId}::uuid, 'open', ${actor.actorUserId}::uuid, ${actor.actorEmail}, ${parsedBody.data.reason}, ${parsedBody.data.channel || null}, now(), now())
      `;
      await logAdminAudit({
        actor,
        action: 'deletion.requested',
        targetUserId,
        reason: parsedBody.data.reason,
        result: 'ok',
        metadata: { channel: parsedBody.data.channel || null },
      });

      return { ok: true };
    }
  );

  app.post(
    '/v1/admin/users/:userId/actions/resolve-deletion',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedBody = deletionResolveSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: 'Invalid payload', issues: parsedBody.error.issues });
        return;
      }

      const actor: MutationActor = {
        actorUserId: request.user.id,
        actorEmail: request.user.email,
      };
      const targetUserId = parsedParams.data.userId;
      const openRequest = await prisma.$queryRaw<
        Array<{
          id: string;
          requestReason: string;
          requestChannel: string | null;
          createdAt: Date;
          targetEmail: string | null;
          targetDisplayName: string | null;
        }>
      >`
        SELECT
          dr.id,
          dr.request_reason AS "requestReason",
          dr.request_channel AS "requestChannel",
          dr.created_at AS "createdAt",
          p.email AS "targetEmail",
          p.display_name AS "targetDisplayName"
        FROM deletion_requests dr
        LEFT JOIN profiles p ON p.user_id = dr.target_user_id
        WHERE dr.target_user_id = ${targetUserId}::uuid
          AND dr.status = 'open'
        ORDER BY dr.created_at DESC
        LIMIT 1
      `;

      const requestRow = openRequest[0];
      if (!requestRow) {
        reply.code(404).send({ error: 'No open deletion request found for this user.' });
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO deletion_case_history
            (
              id,
              target_user_id,
              target_email,
              target_display_name,
              outcome,
              request_reason,
              request_channel,
              request_created_at,
              resolved_reason,
              resolved_by_user_id,
              resolved_by_email,
              resolved_at,
              retention_until,
              created_at
            )
          VALUES
            (
              gen_random_uuid(),
              ${targetUserId}::uuid,
              ${requestRow.targetEmail},
              ${requestRow.targetDisplayName},
              ${parsedBody.data.status},
              ${requestRow.requestReason},
              ${requestRow.requestChannel},
              ${requestRow.createdAt},
              ${parsedBody.data.reason},
              ${actor.actorUserId}::uuid,
              ${actor.actorEmail},
              now(),
              now() + interval '365 days',
              now()
            )
        `;

        await tx.$executeRaw`
          DELETE FROM deletion_requests
          WHERE id = ${requestRow.id}::uuid
        `;
      });
      await logAdminAudit({
        actor,
        action: `deletion.${parsedBody.data.status}`,
        targetUserId,
        reason: parsedBody.data.reason,
        result: 'ok',
      });

      return { ok: true };
    }
  );

  app.post(
    '/v1/admin/users/:userId/actions/undo-delete',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedBody = mutationReasonSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: 'Invalid payload', issues: parsedBody.error.issues });
        return;
      }

      const actor: MutationActor = {
        actorUserId: request.user.id,
        actorEmail: request.user.email,
      };
      const targetUserId = parsedParams.data.userId;

      const deletedRows = await prisma.$queryRaw<Array<{ id: string }>>`
        DELETE FROM scheduled_account_deletions
        WHERE id = (
          SELECT id
          FROM scheduled_account_deletions
          WHERE target_user_id = ${targetUserId}::uuid
            AND status = 'scheduled'
          ORDER BY created_at DESC
          LIMIT 1
        )
        RETURNING id
      `;

      if (!deletedRows[0]?.id) {
        reply.code(404).send({ error: 'No scheduled deletion found for this user.' });
        return;
      }

      await logAdminAudit({
        actor,
        action: 'deletion.undo',
        targetUserId,
        reason: parsedBody.data.reason,
        result: 'ok',
      });

      return { ok: true };
    }
  );

  app.post(
    '/v1/admin/users/:userId/actions/permanent-delete',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;

      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedBody = permanentDeleteSchema.safeParse(request.body);
      if (!parsedBody.success) {
        reply.code(400).send({ error: 'Invalid payload', issues: parsedBody.error.issues });
        return;
      }

      const actor: MutationActor = {
        actorUserId: request.user.id,
        actorEmail: request.user.email,
      };
      const targetUserId = parsedParams.data.userId;
      const targetProfileSnapshot = await prisma.profile.findUnique({
        where: { userId: targetUserId },
        select: { displayName: true, email: true },
      });
      if (!targetProfileSnapshot) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }

      try {
        const holdDays = env.ACCOUNT_DELETION_HOLD_DAYS;
        const scheduledFor = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000);
        await prisma.$executeRaw`
          INSERT INTO scheduled_account_deletions
            (
              id,
              target_user_id,
              target_email,
              target_display_name,
              requested_by_user_id,
              requested_by_email,
              reason,
              hold_days,
              scheduled_for,
              status,
              created_at,
              updated_at
            )
          VALUES
            (
              gen_random_uuid(),
              ${targetUserId}::uuid,
              ${targetProfileSnapshot.email},
              ${targetProfileSnapshot.displayName},
              ${actor.actorUserId}::uuid,
              ${actor.actorEmail},
              ${parsedBody.data.reason},
              ${holdDays},
              ${scheduledFor},
              'scheduled',
              now(),
              now()
            )
          ON CONFLICT (target_user_id)
          WHERE (status = 'scheduled')
          DO UPDATE SET
            target_email = EXCLUDED.target_email,
            target_display_name = EXCLUDED.target_display_name,
            requested_by_user_id = EXCLUDED.requested_by_user_id,
            requested_by_email = EXCLUDED.requested_by_email,
            reason = EXCLUDED.reason,
            hold_days = EXCLUDED.hold_days,
            scheduled_for = EXCLUDED.scheduled_for,
            updated_at = now()
        `;

        if (targetProfileSnapshot?.email) {
          void sendAccountDeletionConfirmationEmail({
            to: targetProfileSnapshot.email,
            deletedAtIso: new Date().toISOString(),
            holdDays,
            scheduledForIso: scheduledFor.toISOString(),
          }).catch((error) => {
            request.log.error(
              { error, targetUserId, email: targetProfileSnapshot.email },
              'admin_permanent_delete_email_failed'
            );
          });
        }

        await logAdminAudit({
          actor,
          action: 'user.permanent_delete_scheduled',
          targetUserId,
          reason: parsedBody.data.reason,
          result: 'ok',
          metadata: {
            targetDisplayName: targetProfileSnapshot?.displayName || null,
            targetEmail: targetProfileSnapshot?.email || null,
            holdDays,
            scheduledForIso: scheduledFor.toISOString(),
          },
        });

        return { ok: true, scheduledFor: scheduledFor.toISOString(), holdDays };
      } catch (error) {
        await logAdminAudit({
          actor,
          action: 'user.permanent_delete_scheduled',
          targetUserId,
          reason: parsedBody.data.reason,
          result: 'error',
          metadata: {
            targetDisplayName: targetProfileSnapshot?.displayName || null,
            targetEmail: targetProfileSnapshot?.email || null,
          },
        }).catch(() => undefined);
        throw error;
      }
    }
  );
}
