import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { env } from '../env.js';
import { requireAdmin } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import {
  pathExists,
  readQualityReportList,
  resolveRepoRootForQualityReports,
  type QualityReportListEntry,
} from '../services/adminQualityReportsService.js';
import { reportWindowQuerySchema } from './adminSchemas.js';
import { toInt } from './adminMetricsShared.js';

async function safeCount(query: Prisma.Sql) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(query);
  return toInt(rows[0]?.count);
}

export function registerAdminReportsRoutes(app: FastifyInstance) {
  app.get(
    '/v1/admin/reports/executive-weekly',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = reportWindowQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }
      const windowDays = parsed.data.windowDays;
      const currentInterval = `${windowDays} days`;
      const previousIntervalStart = `${windowDays * 2} days`;

      const [
        newUsersCurrent,
        newUsersPrevious,
        lessonsCurrent,
        lessonsPrevious,
        quizCurrent,
        quizPrevious,
      ] = await Promise.all([
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM profiles p WHERE p.created_at >= now() - ${currentInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM profiles p WHERE p.created_at >= now() - ${previousIntervalStart}::interval AND p.created_at < now() - ${currentInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM progress_events pe WHERE pe.event_type = 'lesson_completed' AND pe.created_at >= now() - ${currentInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM progress_events pe WHERE pe.event_type = 'lesson_completed' AND pe.created_at >= now() - ${previousIntervalStart}::interval AND pe.created_at < now() - ${currentInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM quiz_attempts qa WHERE qa.created_at >= now() - ${currentInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM quiz_attempts qa WHERE qa.created_at >= now() - ${previousIntervalStart}::interval AND qa.created_at < now() - ${currentInterval}::interval`
        ),
      ]);

      const currentUsers = await safeCount(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM profiles`
      );

      const deltaPct = (current: number, previous: number) => {
        if (previous <= 0) return current > 0 ? 100 : 0;
        return Number((((current - previous) / previous) * 100).toFixed(2));
      };

      return {
        generatedAt: new Date().toISOString(),
        windowDays,
        currentUsers,
        comparisons: {
          newUsers: {
            current: newUsersCurrent,
            previous: newUsersPrevious,
            deltaPct: deltaPct(newUsersCurrent, newUsersPrevious),
          },
          lessonsCompleted: {
            current: lessonsCurrent,
            previous: lessonsPrevious,
            deltaPct: deltaPct(lessonsCurrent, lessonsPrevious),
          },
          quizAttempts: {
            current: quizCurrent,
            previous: quizPrevious,
            deltaPct: deltaPct(quizCurrent, quizPrevious),
          },
        },
      };
    }
  );

  app.get(
    '/v1/admin/reports/deletion-lifecycle',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = reportWindowQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }
      const windowDays = parsed.data.windowDays;
      const windowInterval = `${windowDays} days`;
      const [
        openRequests,
        agedOpenRequests,
        resolvedCases,
        rejectedCases,
        scheduledPending,
        scheduledCompleted,
        scheduledCancelled,
      ] = await Promise.all([
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM deletion_requests dr WHERE dr.status = 'open'`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM deletion_requests dr WHERE dr.status = 'open' AND dr.created_at < now() - interval '7 days'`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM deletion_case_history dch WHERE dch.outcome = 'resolved' AND dch.resolved_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM deletion_case_history dch WHERE dch.outcome = 'rejected' AND dch.resolved_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM scheduled_account_deletions sad WHERE sad.status = 'scheduled'`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM scheduled_account_deletions sad WHERE sad.status = 'completed' AND sad.completed_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM scheduled_account_deletions sad WHERE sad.status = 'cancelled' AND sad.cancelled_at >= now() - ${windowInterval}::interval`
        ),
      ]);

      const avgResolutionRows = await prisma.$queryRaw<Array<{ avgHours: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (dch.resolved_at - dch.request_created_at)) / 3600.0) AS "avgHours"
      FROM deletion_case_history dch
      WHERE dch.resolved_at >= now() - ${windowInterval}::interval
    `.catch(() => []);

      return {
        generatedAt: new Date().toISOString(),
        windowDays,
        openRequests,
        agedOpenRequestsOver7d: agedOpenRequests,
        resolvedCases,
        rejectedCases,
        scheduledPending,
        scheduledCompleted,
        scheduledCancelled,
        avgResolutionHours: Number((avgResolutionRows[0]?.avgHours || 0).toFixed(2)),
      };
    }
  );

  app.get(
    '/v1/admin/reports/security-incidents',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = reportWindowQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }
      const windowDays = parsed.data.windowDays;
      const windowInterval = `${windowDays} days`;
      const [
        unauthorizedAdminAttempts,
        supportAdminLoginFailed,
        endUserFailedLogins,
        authErrors,
        newIpLogins,
        newDeviceLogins,
        sessionRevocations,
        adminActions,
      ] = await Promise.all([
        safeCount(
          Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM account_security_events ase
          WHERE ase.event_type IN ('admin_route_access_denied', 'support_admin_login_failed', 'support_admin_login_throttled')
            AND ase.created_at >= now() - ${windowInterval}::interval
        `
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'support_admin_login_failed' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'auth_login_failed' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type LIKE 'auth_error_%' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'auth_login_new_ip' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'auth_login_new_device' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`
            SELECT COUNT(*)::bigint AS count
            FROM refresh_sessions rs
            WHERE rs.revoked_at IS NOT NULL
              AND rs.revoked_at >= now() - ${windowInterval}::interval
              AND COALESCE(rs.revoked_reason, '') <> 'rotated'
          `
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM admin_audit_logs aal WHERE aal.created_at >= now() - ${windowInterval}::interval`
        ),
      ]);

      const topEventRows = await prisma.$queryRaw<Array<{ eventType: string; count: bigint }>>`
      SELECT ase.event_type AS "eventType", COUNT(*)::bigint AS count
      FROM account_security_events ase
      WHERE ase.created_at >= now() - ${windowInterval}::interval
      GROUP BY ase.event_type
      ORDER BY count DESC
      LIMIT 10
    `.catch(() => []);

      return {
        generatedAt: new Date().toISOString(),
        windowDays,
        summary: {
          unauthorizedAdminAttempts,
          supportAdminLoginFailed,
          endUserFailedLogins,
          authErrors,
          newIpLogins,
          newDeviceLogins,
          sessionRevocations,
          adminActions,
        },
        topEventTypes: topEventRows.map((row) => ({
          eventType: row.eventType,
          count: toInt(row.count),
        })),
      };
    }
  );

  app.get(
    '/v1/admin/reports/learning-momentum',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = reportWindowQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }
      const windowDays = parsed.data.windowDays;
      const windowInterval = `${windowDays} days`;

      const [activeLearnersTodayRows, lessonsStartedToday, practiceMsRows, streakRows, dailyRows] =
        await Promise.all([
          prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT user_id)::bigint AS count
        FROM (
          SELECT qa.user_id FROM quiz_attempts qa WHERE qa.created_at >= date_trunc('day', now())
          UNION
          SELECT sa.user_id FROM speak_attempts sa WHERE sa.created_at >= date_trunc('day', now())
          UNION
          SELECT pe.user_id FROM progress_events pe WHERE pe.created_at >= date_trunc('day', now())
        ) users
      `.catch(() => []),
          safeCount(
            Prisma.sql`SELECT COUNT(*)::bigint AS count FROM progress_events pe WHERE pe.event_type = 'lesson_started' AND pe.created_at >= date_trunc('day', now())`
          ),
          prisma.$queryRaw<Array<{ totalMs: bigint | null }>>`
        SELECT COALESCE(SUM(qa.response_ms), 0)::bigint AS "totalMs"
        FROM quiz_attempts qa
        WHERE qa.created_at >= now() - ${windowInterval}::interval
          AND qa.response_ms IS NOT NULL
      `.catch(() => []),
          prisma.$queryRaw<Array<{ bucket: string; count: bigint }>>`
        SELECT
          CASE
            WHEN up.streak <= 0 THEN '0'
            WHEN up.streak BETWEEN 1 AND 3 THEN '1-3'
            WHEN up.streak BETWEEN 4 AND 7 THEN '4-7'
            WHEN up.streak BETWEEN 8 AND 14 THEN '8-14'
            ELSE '15+'
          END AS bucket,
          COUNT(*)::bigint AS count
        FROM user_progress up
        GROUP BY bucket
        ORDER BY bucket
      `.catch(() => []),
          prisma.$queryRaw<
            Array<{ day: Date; practiceMs: bigint; lessonsStarted: bigint; activeLearners: bigint }>
          >`
        WITH days AS (
          SELECT generate_series(
            date_trunc('day', now() - ${windowInterval}::interval),
            date_trunc('day', now()),
            interval '1 day'
          ) AS day
        ),
        practice AS (
          SELECT date_trunc('day', qa.created_at) AS day, COALESCE(SUM(qa.response_ms), 0)::bigint AS practice_ms
          FROM quiz_attempts qa
          WHERE qa.created_at >= now() - ${windowInterval}::interval
            AND qa.response_ms IS NOT NULL
          GROUP BY 1
        ),
        lessons AS (
          SELECT date_trunc('day', pe.created_at) AS day, COUNT(*)::bigint AS lessons_started
          FROM progress_events pe
          WHERE pe.event_type = 'lesson_started'
            AND pe.created_at >= now() - ${windowInterval}::interval
          GROUP BY 1
        ),
        active AS (
          SELECT date_trunc('day', x.created_at) AS day, COUNT(DISTINCT x.user_id)::bigint AS active_learners
          FROM (
            SELECT qa.user_id, qa.created_at FROM quiz_attempts qa WHERE qa.created_at >= now() - ${windowInterval}::interval
            UNION ALL
            SELECT sa.user_id, sa.created_at FROM speak_attempts sa WHERE sa.created_at >= now() - ${windowInterval}::interval
            UNION ALL
            SELECT pe.user_id, pe.created_at FROM progress_events pe WHERE pe.created_at >= now() - ${windowInterval}::interval
          ) x
          GROUP BY 1
        )
        SELECT
          d.day AS day,
          COALESCE(p.practice_ms, 0)::bigint AS "practiceMs",
          COALESCE(l.lessons_started, 0)::bigint AS "lessonsStarted",
          COALESCE(a.active_learners, 0)::bigint AS "activeLearners"
        FROM days d
        LEFT JOIN practice p ON p.day = d.day
        LEFT JOIN lessons l ON l.day = d.day
        LEFT JOIN active a ON a.day = d.day
        ORDER BY d.day ASC
      `.catch(() => []),
        ]);

      const totalPracticeMs = toInt(practiceMsRows[0]?.totalMs);
      const avgDailyPracticeMinutes = Number((totalPracticeMs / windowDays / 60000).toFixed(2));
      const activeLearnersToday = toInt(activeLearnersTodayRows[0]?.count);

      return {
        generatedAt: new Date().toISOString(),
        windowDays,
        summary: {
          averageDailyPracticeMinutes: avgDailyPracticeMinutes,
          activeLearnersToday,
          lessonsStartedToday,
        },
        practiceStreakDistribution: streakRows.map((row) => ({
          bucket: row.bucket,
          count: toInt(row.count),
        })),
        dailySeries: dailyRows.map((row) => ({
          day: row.day.toISOString().slice(0, 10),
          practiceMinutes: Number((toInt(row.practiceMs) / 60000).toFixed(2)),
          lessonsStarted: toInt(row.lessonsStarted),
          activeLearners: toInt(row.activeLearners),
        })),
      };
    }
  );

  app.get(
    '/v1/admin/reports/activation-funnel',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = reportWindowQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }
      const windowDays = parsed.data.windowDays;
      const windowInterval = `${windowDays} days`;
      const [signups, firstLessonUsers, firstSpeakUsers, day7ReturnUsers] = await Promise.all([
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM profiles p WHERE p.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`
          SELECT COUNT(DISTINCT pe.user_id)::bigint AS count
          FROM progress_events pe
          WHERE pe.event_type IN ('lesson_started', 'lesson_completed')
            AND pe.created_at >= now() - ${windowInterval}::interval
        `
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(DISTINCT sa.user_id)::bigint AS count FROM speak_attempts sa WHERE sa.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`
          WITH cohort AS (
            SELECT p.user_id, p.created_at
            FROM profiles p
            WHERE p.created_at >= now() - (${windowInterval}::interval + interval '7 days')
              AND p.created_at < now() - interval '7 days'
          ),
          activity AS (
            SELECT qa.user_id, qa.created_at FROM quiz_attempts qa
            UNION ALL
            SELECT sa.user_id, sa.created_at FROM speak_attempts sa
            UNION ALL
            SELECT pe.user_id, pe.created_at FROM progress_events pe
          )
          SELECT COUNT(*)::bigint AS count
          FROM cohort c
          WHERE EXISTS (
            SELECT 1
            FROM activity a
            WHERE a.user_id = c.user_id
              AND a.created_at >= c.created_at + interval '7 days'
              AND a.created_at < c.created_at + interval '8 days'
          )
        `
        ),
      ]);

      const pct = (value: number, total: number) =>
        total > 0 ? Number(((value / total) * 100).toFixed(2)) : 0;

      return {
        generatedAt: new Date().toISOString(),
        windowDays,
        funnel: {
          signups,
          firstLessonUsers,
          firstSpeakUsers,
          day7ReturnUsers,
        },
        conversionPct: {
          signupToFirstLesson: pct(firstLessonUsers, signups),
          signupToFirstSpeak: pct(firstSpeakUsers, signups),
          signupToDay7Return: pct(day7ReturnUsers, signups),
        },
      };
    }
  );

  app.get('/v1/admin/reports/storage-budget', { preHandler: [requireAdmin] }, async () => {
    const budgetMb = env.STORAGE_BUDGET_MB;
    const budgetBytes = Math.round(budgetMb * 1024 * 1024);
    const [dbSizeRows, tableRows] = await Promise.all([
      prisma.$queryRaw<Array<{ bytes: bigint }>>`
          SELECT pg_database_size(current_database())::bigint AS bytes
        `.catch(() => []),
      prisma.$queryRaw<Array<{ tableName: string; bytes: bigint; liveRows: bigint }>>`
          SELECT
            st.relname AS "tableName",
            pg_total_relation_size(st.relid)::bigint AS bytes,
            st.n_live_tup::bigint AS "liveRows"
          FROM pg_stat_user_tables st
          WHERE st.schemaname = 'public'
          ORDER BY pg_total_relation_size(st.relid) DESC
          LIMIT 15
        `.catch(() => []),
    ]);

    const totalBytes = toInt(dbSizeRows[0]?.bytes);
    const usedPct = budgetBytes > 0 ? Number(((totalBytes / budgetBytes) * 100).toFixed(2)) : 0;
    const status = usedPct >= 90 ? 'critical' : usedPct >= 75 ? 'warning' : 'healthy';

    return {
      generatedAt: new Date().toISOString(),
      budget: {
        storageBudgetMb: budgetMb,
        storageBudgetBytes: budgetBytes,
        databaseSizeBytes: totalBytes,
        databaseSizeMb: Number((totalBytes / (1024 * 1024)).toFixed(2)),
        usedPct,
        status,
      },
      largestTables: tableRows.map((row) => ({
        tableName: row.tableName,
        bytes: toInt(row.bytes),
        mb: Number((toInt(row.bytes) / (1024 * 1024)).toFixed(2)),
        liveRows: toInt(row.liveRows),
      })),
    };
  });

  app.get(
    '/v1/admin/reports/db-guardrails',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = reportWindowQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }
      const windowDays = parsed.data.windowDays;
      const windowInterval = `${windowDays} days`;

      const [indexRows, tableHealthRows, growthRows, reportRuns] = await Promise.all([
        prisma.$queryRaw<Array<{ tableName: string; indexName: string; indexDef: string }>>`
          SELECT
            pi.tablename AS "tableName",
            pi.indexname AS "indexName",
            pi.indexdef AS "indexDef"
          FROM pg_indexes pi
          WHERE pi.schemaname = 'public'
            AND pi.tablename IN ('quiz_attempts', 'speak_attempts', 'progress_events', 'user_progress', 'account_security_events')
        `.catch(() => []),
        prisma.$queryRaw<
          Array<{ tableName: string; liveRows: bigint; deadRows: bigint; deadPct: number }>
        >`
          SELECT
            st.relname AS "tableName",
            st.n_live_tup::bigint AS "liveRows",
            st.n_dead_tup::bigint AS "deadRows",
            CASE
              WHEN st.n_live_tup > 0
                THEN ROUND((st.n_dead_tup::numeric * 100.0) / st.n_live_tup::numeric, 2)
              ELSE 0
            END AS "deadPct"
          FROM pg_stat_user_tables st
          WHERE st.schemaname = 'public'
            AND st.relname IN ('quiz_attempts', 'speak_attempts', 'progress_events', 'word_memory_state', 'account_security_events')
          ORDER BY st.n_dead_tup DESC
        `.catch(() => []),
        prisma.$queryRaw<
          Array<{ quizAttempts: bigint; speakAttempts: bigint; progressEvents: bigint }>
        >`
          SELECT
            (SELECT COUNT(*)::bigint FROM quiz_attempts qa WHERE qa.created_at >= now() - ${windowInterval}::interval) AS "quizAttempts",
            (SELECT COUNT(*)::bigint FROM speak_attempts sa WHERE sa.created_at >= now() - ${windowInterval}::interval) AS "speakAttempts",
            (SELECT COUNT(*)::bigint FROM progress_events pe WHERE pe.created_at >= now() - ${windowInterval}::interval) AS "progressEvents"
        `.catch(() => []),
        readQualityReportList(200).catch(() => [] as QualityReportListEntry[]),
      ]);

      const hasIndex = (tableName: string, pattern: RegExp) =>
        indexRows.some((row) => row.tableName === tableName && pattern.test(row.indexDef));

      const indexChecks = [
        {
          key: 'quiz_attempts_user_created_at',
          passed: hasIndex('quiz_attempts', /\(user_id,\s*created_at\)/i),
        },
        {
          key: 'speak_attempts_user_created_at',
          passed: hasIndex('speak_attempts', /\(user_id,\s*created_at\)/i),
        },
        {
          key: 'progress_events_user_created_at',
          passed: hasIndex('progress_events', /\(user_id,\s*created_at\)/i),
        },
      ];

      const growth = growthRows[0] || {
        quizAttempts: BigInt(0),
        speakAttempts: BigInt(0),
        progressEvents: BigInt(0),
      };

      return {
        generatedAt: new Date().toISOString(),
        windowDays,
        indexChecks,
        tableHealth: tableHealthRows.map((row) => ({
          tableName: row.tableName,
          liveRows: toInt(row.liveRows),
          deadRows: toInt(row.deadRows),
          deadPct: Number(row.deadPct || 0),
        })),
        growth: {
          quizAttempts: toInt(growth.quizAttempts),
          speakAttempts: toInt(growth.speakAttempts),
          progressEvents: toInt(growth.progressEvents),
        },
        retention: {
          qualityReportsCount: reportRuns.length,
          latestQualityRunId: reportRuns[0]?.runId || null,
        },
      };
    }
  );

  app.get('/v1/admin/reports/prod-readiness', { preHandler: [requireAdmin] }, async () => {
    const repoRoot = await resolveRepoRootForQualityReports();
    const [hasCiWorkflow, hasLighthouseWorkflow, latestReport] = await Promise.all([
      pathExists(path.join(repoRoot, '.github', 'workflows', 'ci.yml')),
      pathExists(path.join(repoRoot, '.github', 'workflows', 'lighthouse.yml')),
      readQualityReportList(1)
        .then((rows) => rows[0] || null)
        .catch(() => null),
    ]);

    const backupDate = env.BACKUP_LAST_SUCCESS_AT ? new Date(env.BACKUP_LAST_SUCCESS_AT) : null;
    const backupAgeHours =
      backupDate && Number.isFinite(backupDate.getTime())
        ? Number(((Date.now() - backupDate.getTime()) / (1000 * 60 * 60)).toFixed(2))
        : null;
    const backupFresh = typeof backupAgeHours === 'number' ? backupAgeHours <= 36 : false;
    const protectedMainEnabled = env.PROTECTED_MAIN_BRANCH_ENABLED;
    const stagingConfigured = Boolean(env.STAGING_APP_URL);

    const checks = {
      ciWorkflowPresent: hasCiWorkflow,
      lighthouseWorkflowPresent: hasLighthouseWorkflow,
      protectedMainBranchEnabled: protectedMainEnabled,
      stagingConfigured,
      backupLastSuccessAt: env.BACKUP_LAST_SUCCESS_AT || null,
      backupFresh,
      releaseCurrentTag: env.RELEASE_CURRENT_TAG || null,
      releasePreviousTag: env.RELEASE_PREVIOUS_TAG || null,
      latestQualityRun: latestReport
        ? {
            runId: latestReport.runId,
            generatedAt: latestReport.generatedAt,
            risk: latestReport.risk,
            failedChecks: latestReport.summary.failed,
          }
        : null,
    };

    const recommendedActions: string[] = [];
    if (!hasCiWorkflow)
      recommendedActions.push(
        'Add/restore .github/workflows/ci.yml and require it on protected main.'
      );
    if (!hasLighthouseWorkflow)
      recommendedActions.push('Add/restore Lighthouse workflow and require it on pull requests.');
    if (protectedMainEnabled !== true)
      recommendedActions.push('Enable protected main branch with required PR + status checks.');
    if (!stagingConfigured)
      recommendedActions.push('Configure STAGING_APP_URL and deploy every PR to staging.');
    if (!backupFresh)
      recommendedActions.push(
        'Set BACKUP_LAST_SUCCESS_AT from nightly backup job and verify restore monthly.'
      );
    if (!env.RELEASE_CURRENT_TAG || !env.RELEASE_PREVIOUS_TAG)
      recommendedActions.push(
        'Set RELEASE_CURRENT_TAG and RELEASE_PREVIOUS_TAG for rollback readiness.'
      );

    return {
      generatedAt: new Date().toISOString(),
      checks,
      recommendedActions,
    };
  });
}
