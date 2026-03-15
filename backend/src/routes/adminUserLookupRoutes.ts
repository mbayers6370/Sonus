import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { fetchReviewQueue } from '../services/reviewInsightsService.js';
import { normalizeAdminLanguageId, toInt } from './adminMetricsShared.js';
import {
  openDeletionRequestsQuerySchema,
  recentDeletionQuerySchema,
  reviewQueueDebugQuerySchema,
  userIdParamsSchema,
  userSearchQuerySchema,
} from './adminSchemas.js';

export function registerAdminUserLookupRoutes(app: FastifyInstance) {
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

    return {
      users: users.map((entry) => ({
        ...entry,
        targetLanguage: normalizeAdminLanguageId(entry.targetLanguage),
      })),
    };
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
    '/v1/admin/users/:userId/review-queue',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedQuery = reviewQueueDebugQuerySchema.safeParse(request.query ?? {});
      if (!parsedQuery.success) {
        reply
          .code(400)
          .send({ error: 'Invalid query parameters', issues: parsedQuery.error.issues });
        return;
      }

      const userId = parsedParams.data.userId;
      const profile = await prisma.profile.findUnique({
        where: { userId },
        select: { userId: true },
      });
      if (!profile) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }

      return fetchReviewQueue(userId, parsedQuery.data.limit, parsedQuery.data.language, 'lexeme');
    }
  );
}
