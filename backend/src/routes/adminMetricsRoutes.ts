import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { requireAdmin } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { resolveLexemeForWordId } from '../lib/lexemeCatalog.js';
import { registerAdminImpactOutcomesRoute } from './adminImpactOutcomesRoute.js';
import {
  normalizedProfileLanguageSql,
  supportedAdminLanguageIds,
  supportedAdminLanguageSql,
  supportedSpeakMissHotspotLanguageIds,
  supportedSpeakMissHotspotLanguageSql,
  toInt,
} from './adminMetricsShared.js';
import {
  deletionCasesQuerySchema,
  metricsOverviewQuerySchema,
  speakMissHotspotsByLanguageQuerySchema,
  weakWordsByLanguageQuerySchema,
  weakWordsQuerySchema,
} from './adminSchemas.js';

async function safeCount(query: Prisma.Sql) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(query);
  return toInt(rows[0]?.count);
}

export function registerAdminMetricsRoutes(app: FastifyInstance) {
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
      const activeWindowMinutes = 15;
      const activeWindowInterval = `${activeWindowMinutes} minutes`;
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
        currentUsers,
        newUsers,
        activeUsers,
        totalSecurityEvents,
        totalAuthErrorEvents,
      ] = await Promise.all([
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type = 'support_admin_login_failed' AND ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM password_reset_tokens prt WHERE prt.created_at >= now() - ${windowInterval}::interval`
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
          Prisma.sql`
            SELECT COUNT(*)::bigint AS count
            FROM account_security_events ase
            WHERE ase.event_type IN ('admin_route_access_denied', 'support_admin_login_failed', 'support_admin_login_throttled')
              AND ase.created_at >= now() - ${windowInterval}::interval
          `
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
        safeCount(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM profiles p`),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM profiles p WHERE p.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`
            SELECT COUNT(DISTINCT rs.user_id)::bigint AS count
            FROM refresh_sessions rs
            WHERE rs.revoked_at IS NULL
              AND rs.expires_at > now()
              AND COALESCE(rs.last_used_at, rs.created_at) >= now() - ${activeWindowInterval}::interval
          `
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.created_at >= now() - ${windowInterval}::interval`
        ),
        safeCount(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM account_security_events ase WHERE ase.event_type LIKE 'auth_error_%' AND ase.created_at >= now() - ${windowInterval}::interval`
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
          currentUsers,
          newUsers,
          activeUsers,
          activeWindowMinutes,
          supportNotesCreated: noteCount,
          supportNoteCreateFailures: noteFailureCount,
          totalSecurityEvents,
          totalAuthErrorEvents,
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
          lessonStartsTracked: bigint;
          lessonStartsInferred: bigint;
          lessonStarts: bigint;
          lessonCompleted: bigint;
        }>
      >`
      WITH completion_events AS (
        SELECT
          pe.event_type,
          pe.user_id::text AS user_id,
          COALESCE(pe.payload_json->>'bandId', '') AS band_id,
          COALESCE(pe.payload_json->>'unitId', '') AS unit_id,
          COALESCE(pe.payload_json->>'lessonIndex', '') AS lesson_idx,
          COALESCE(pe.payload_json->>'reachedCompleteScreen', '') AS reached_complete_screen,
          COALESCE(pe.payload_json->>'completed', '') AS completed_flag
        FROM progress_events pe
        LEFT JOIN profiles p ON p.user_id = pe.user_id
        WHERE pe.event_type = 'lesson_completed'
          AND pe.created_at >= now() - ${windowInterval}::interval
          AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
      ),
      completion_keys AS (
        SELECT DISTINCT
          ce.event_type,
          ce.user_id,
          ce.band_id,
          ce.unit_id,
          ce.lesson_idx,
          ce.reached_complete_screen,
          ce.completed_flag
        FROM completion_events ce
        WHERE ce.band_id <> '' AND ce.unit_id <> '' AND ce.lesson_idx <> ''
      )
      SELECT
        (
          SELECT COUNT(*)::bigint
          FROM quiz_attempts qa
          LEFT JOIN profiles p ON p.user_id = qa.user_id
          WHERE qa.created_at >= now() - ${windowInterval}::interval
            AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
        ) AS "quizAttempts",
        (
          SELECT COUNT(*)::bigint
          FROM quiz_attempts qa
          LEFT JOIN profiles p ON p.user_id = qa.user_id
          WHERE qa.is_correct = true
            AND qa.created_at >= now() - ${windowInterval}::interval
            AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
        ) AS "quizCorrect",
        (
          SELECT COUNT(*)::bigint
          FROM speak_attempts sa
          LEFT JOIN profiles p ON p.user_id = sa.user_id
          WHERE sa.created_at >= now() - ${windowInterval}::interval
            AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
        ) AS "speakAttempts",
        (
          SELECT COUNT(*)::bigint
          FROM speak_attempts sa
          LEFT JOIN profiles p ON p.user_id = sa.user_id
          WHERE sa.initial_ok = true
            AND sa.final_ok = true
            AND sa.tone_ok = true
            AND sa.created_at >= now() - ${windowInterval}::interval
            AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
        ) AS "speakPassed",
        (
          SELECT COUNT(*)::bigint
          FROM progress_events pe
          LEFT JOIN profiles p ON p.user_id = pe.user_id
          WHERE pe.event_type = 'lesson_started'
            AND pe.created_at >= now() - ${windowInterval}::interval
            AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
        ) AS "lessonStartsTracked",
        (SELECT COUNT(*)::bigint FROM completion_keys) AS "lessonStartsInferred",
        GREATEST(
          (
            SELECT COUNT(*)::bigint
            FROM progress_events pe
            LEFT JOIN profiles p ON p.user_id = pe.user_id
            WHERE pe.event_type = 'lesson_started'
              AND pe.created_at >= now() - ${windowInterval}::interval
              AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
          ),
          (SELECT COUNT(*)::bigint FROM completion_keys)
        ) AS "lessonStarts",
        (
          SELECT COUNT(*)::bigint
          FROM completion_keys ck
          WHERE ck.reached_complete_screen = 'true'
             OR (ck.reached_complete_screen = '' AND ck.completed_flag = 'true')
        ) AS "lessonCompleted"
    `;

      const [summary] = rows;
      const quizAttempts = toInt(summary?.quizAttempts);
      const quizCorrect = toInt(summary?.quizCorrect);
      const speakAttempts = toInt(summary?.speakAttempts);
      const speakPassed = toInt(summary?.speakPassed);
      const lessonStartsTracked = toInt(summary?.lessonStartsTracked);
      const lessonStartsInferred = toInt(summary?.lessonStartsInferred);
      const lessonStarts = toInt(summary?.lessonStarts);
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
          lessonStartsTracked,
          lessonStartsInferred,
          lessonCompleted,
          lessonCompletionPct: pct(lessonCompleted, lessonStarts),
          lessonAbandons,
        },
      };
    }
  );

  registerAdminImpactOutcomesRoute(app);

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
      const languages = [...supportedAdminLanguageIds] as string[];

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
          ${normalizedProfileLanguageSql} AS language,
          qa.word_id AS "wordId",
          COUNT(*) FILTER (WHERE qa.is_correct = false)::bigint AS misses,
          COUNT(*)::bigint AS attempts,
          ROUND(
            (COUNT(*) FILTER (WHERE qa.is_correct = false)::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100,
            2
          ) AS "missRatePct"
        FROM quiz_attempts qa
        LEFT JOIN profiles p ON p.user_id = qa.user_id
        WHERE qa.created_at >= now() - ${windowInterval}::interval
          AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
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
          nativeText: lexeme?.term || 'Unknown term',
          englishText: lexeme?.en || 'Unknown meaning',
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
      const languages = [...supportedAdminLanguageIds] as string[];

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
          ${normalizedProfileLanguageSql} AS language,
          sa.word_id,
          sa.initial_ok,
          sa.final_ok,
          sa.tone_ok
        FROM speak_attempts sa
        LEFT JOIN profiles p ON p.user_id = sa.user_id
        WHERE sa.created_at >= now() - ${windowInterval}::interval
          AND ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
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
          nativeText: lexeme?.term || 'Unknown term',
          englishText: lexeme?.en || 'Unknown meaning',
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
    '/v1/admin/metrics/learning/speak-miss-hotspots-by-language',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsed = speakMissHotspotsByLanguageQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
        return;
      }

      const windowInterval = `${parsed.data.windowDays} days`;
      const previousIntervalStart = `${parsed.data.windowDays * 2} days`;
      const limitPerLanguage = parsed.data.limitPerLanguage;
      const minMissesPerUser = parsed.data.minMissesPerUser;
      const languages = [...supportedSpeakMissHotspotLanguageIds] as string[];

      const rows = await prisma.$queryRaw<
        Array<{
          language: string;
          wordId: string;
          affectedUsers: bigint;
          totalMisses: bigint;
          avgMissesPerUser: number;
          previousAffectedUsers: bigint | null;
          previousTotalMisses: bigint | null;
        }>
      >`
      WITH scoped_current AS (
        SELECT
          ${normalizedProfileLanguageSql} AS language,
          sa.user_id,
          sa.word_id
        FROM speak_attempts sa
        LEFT JOIN profiles p ON p.user_id = sa.user_id
        WHERE sa.created_at >= now() - ${windowInterval}::interval
          AND sa.created_at < now()
          AND (sa.initial_ok = false OR sa.final_ok = false OR sa.tone_ok = false)
          AND ${normalizedProfileLanguageSql} IN (${supportedSpeakMissHotspotLanguageSql})
      ),
      user_word_misses_current AS (
        SELECT
          language,
          user_id,
          word_id AS "wordId",
          COUNT(*)::bigint AS miss_count
        FROM scoped_current
        GROUP BY language, user_id, word_id
      ),
      filtered_current AS (
        SELECT
          language,
          "wordId",
          user_id,
          miss_count
        FROM user_word_misses_current
        WHERE miss_count >= ${minMissesPerUser}
      ),
      agg_current AS (
        SELECT
          language,
          "wordId",
          COUNT(DISTINCT user_id)::bigint AS "affectedUsers",
          SUM(miss_count)::bigint AS "totalMisses",
          ROUND(AVG(miss_count)::numeric, 2) AS "avgMissesPerUser"
        FROM filtered_current
        GROUP BY language, "wordId"
      ),
      scoped_previous AS (
        SELECT
          ${normalizedProfileLanguageSql} AS language,
          sa.user_id,
          sa.word_id
        FROM speak_attempts sa
        LEFT JOIN profiles p ON p.user_id = sa.user_id
        WHERE sa.created_at >= now() - ${previousIntervalStart}::interval
          AND sa.created_at < now() - ${windowInterval}::interval
          AND (sa.initial_ok = false OR sa.final_ok = false OR sa.tone_ok = false)
          AND ${normalizedProfileLanguageSql} IN (${supportedSpeakMissHotspotLanguageSql})
      ),
      user_word_misses_previous AS (
        SELECT
          language,
          user_id,
          word_id AS "wordId",
          COUNT(*)::bigint AS miss_count
        FROM scoped_previous
        GROUP BY language, user_id, word_id
      ),
      filtered_previous AS (
        SELECT
          language,
          "wordId",
          user_id,
          miss_count
        FROM user_word_misses_previous
        WHERE miss_count >= ${minMissesPerUser}
      ),
      agg_previous AS (
        SELECT
          language,
          "wordId",
          COUNT(DISTINCT user_id)::bigint AS "previousAffectedUsers",
          SUM(miss_count)::bigint AS "previousTotalMisses"
        FROM filtered_previous
        GROUP BY language, "wordId"
      ),
      ranked AS (
        SELECT
          c.language,
          c."wordId",
          c."affectedUsers",
          c."totalMisses",
          c."avgMissesPerUser",
          COALESCE(p."previousAffectedUsers", 0)::bigint AS "previousAffectedUsers",
          COALESCE(p."previousTotalMisses", 0)::bigint AS "previousTotalMisses",
          ROW_NUMBER() OVER (
            PARTITION BY c.language
            ORDER BY c."affectedUsers" DESC, c."totalMisses" DESC, c."avgMissesPerUser" DESC
          ) AS rn
        FROM agg_current c
        LEFT JOIN agg_previous p
          ON p.language = c.language
         AND p."wordId" = c."wordId"
      )
      SELECT
        language,
        "wordId",
        "affectedUsers",
        "totalMisses",
        "avgMissesPerUser",
        "previousAffectedUsers",
        "previousTotalMisses"
      FROM ranked
      WHERE rn <= ${limitPerLanguage}
      ORDER BY language, "affectedUsers" DESC, "totalMisses" DESC, "avgMissesPerUser" DESC
    `.catch(() => []);

      const byLanguage = Object.fromEntries(
        languages.map((languageId) => [
          languageId,
          [] as Array<{
            wordId: string;
            affectedUsers: number;
            totalMisses: number;
            avgMissesPerUser: number;
            previousAffectedUsers: number;
            previousTotalMisses: number;
            affectedUsersDeltaPct: number;
            totalMissesDeltaPct: number;
            nativeText: string;
            englishText: string;
          }>,
        ])
      ) as Record<
        string,
        Array<{
          wordId: string;
          affectedUsers: number;
          totalMisses: number;
          avgMissesPerUser: number;
          previousAffectedUsers: number;
          previousTotalMisses: number;
          affectedUsersDeltaPct: number;
          totalMissesDeltaPct: number;
          nativeText: string;
          englishText: string;
        }>
      >;

      const deltaPct = (current: number, previous: number) => {
        if (previous <= 0) return current > 0 ? 100 : 0;
        return Number((((current - previous) / previous) * 100).toFixed(2));
      };

      for (const row of rows) {
        const language = languages.includes(row.language) ? row.language : null;
        if (!language) continue;
        const lexeme = await resolveLexemeForWordId(row.wordId, language).catch(() => null);
        const affectedUsers = toInt(row.affectedUsers);
        const totalMisses = toInt(row.totalMisses);
        const previousAffectedUsers = toInt(row.previousAffectedUsers);
        const previousTotalMisses = toInt(row.previousTotalMisses);
        byLanguage[language].push({
          wordId: row.wordId,
          affectedUsers,
          totalMisses,
          avgMissesPerUser: Number(row.avgMissesPerUser || 0),
          previousAffectedUsers,
          previousTotalMisses,
          affectedUsersDeltaPct: deltaPct(affectedUsers, previousAffectedUsers),
          totalMissesDeltaPct: deltaPct(totalMisses, previousTotalMisses),
          nativeText: lexeme?.term || 'Unknown term',
          englishText: lexeme?.en || 'Unknown meaning',
        });
      }

      return {
        windowDays: parsed.data.windowDays,
        limitPerLanguage,
        minMissesPerUser,
        languages: languages.map((languageId) => ({
          languageId,
          hasData: byLanguage[languageId].length > 0,
          words: byLanguage[languageId],
        })),
      };
    }
  );
}
