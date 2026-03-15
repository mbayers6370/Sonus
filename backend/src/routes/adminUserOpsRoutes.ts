import type { FastifyInstance } from 'fastify';
import { env } from '../env.js';
import { requireAdmin } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { requireTrustedOrigin } from '../lib/originPolicy.js';
import {
  appendLearningAccessAudit,
  getLearningAccessState,
  lessonOverrideKey,
  saveLearningAccessState,
} from '../lib/learningAccess.js';
import { sendAccountDeletionConfirmationEmail } from '../services/accountDeletionEmailService.js';
import { normalizeAdminLanguageId, toInt } from './adminMetricsShared.js';
import {
  deletionRequestSchema,
  deletionResolveSchema,
  learningAccessPatchSchema,
  MutationActor,
  mutationReasonSchema,
  noteDeleteParamsSchema,
  notesQuerySchema,
  noteMutationSchema,
  permanentDeleteSchema,
  reportWindowQuerySchema,
  timelineQuerySchema,
  userIdParamsSchema,
} from './adminSchemas.js';

type RegisterAdminUserOpsRoutesDeps = {
  allowedOrigins: Set<string>;
};

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

export function registerAdminUserOpsRoutes(
  app: FastifyInstance,
  deps: RegisterAdminUserOpsRoutesDeps
) {
  app.get(
    '/v1/admin/users/:userId/progress',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }

      const userId = parsedParams.data.userId;
      const profile = await prisma.profile.findUnique({
        where: { userId },
        select: {
          userId: true,
          targetLanguage: true,
        },
      });
      if (!profile) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }

      const progress = await prisma.userProgress.findUnique({
        where: { userId },
        select: {
          currentBandId: true,
          currentUnitId: true,
          currentLessonIdx: true,
          updatedAt: true,
          lastActiveDate: true,
        },
      });
      const progressEvents = await prisma.progressEvent.findMany({
        where: {
          userId,
          eventType: { in: ['lesson_started', 'lesson_completed'] },
        },
        select: {
          eventType: true,
          payloadJson: true,
        },
      });
      const lastActivityRows = await prisma.$queryRaw<Array<{ lastActivityAt: Date | null }>>`
      SELECT MAX(pe.created_at) AS "lastActivityAt"
      FROM progress_events pe
      WHERE pe.user_id = ${userId}::uuid
    `;

      const lastActivityAt =
        lastActivityRows[0]?.lastActivityAt ||
        progress?.lastActiveDate ||
        progress?.updatedAt ||
        null;

      const toOptionalScore = (value: unknown) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) return null;
        return Math.max(0, Math.min(100, Math.round(value)));
      };
      const completionByLesson = new Map<
        string,
        {
          introViewed: boolean;
          quizScore: number | null;
          speakScore: number | null;
          completed: boolean;
          mastered: boolean;
          completionCount: number;
        }
      >();
      const startedLessonKeys = new Set<string>();

      for (const event of progressEvents) {
        const payload = event.payloadJson;
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) continue;
        const record = payload as Record<string, unknown>;
        const bandId = typeof record.bandId === 'string' ? record.bandId.trim() : '';
        const unitId = typeof record.unitId === 'string' ? record.unitId.trim() : '';
        const lessonIndex =
          typeof record.lessonIndex === 'number' && Number.isInteger(record.lessonIndex)
            ? record.lessonIndex
            : null;
        if (!bandId || !unitId || lessonIndex === null || lessonIndex < 0) continue;

        const lessonKey = `${bandId}:${unitId}:${lessonIndex}`;
        if (event.eventType === 'lesson_started') {
          startedLessonKeys.add(lessonKey);
          continue;
        }

        const quizScore = toOptionalScore(record.quizScore);
        const speakScore = toOptionalScore(record.speakScore);
        const completedByScores = (quizScore ?? 0) >= 90 && (speakScore ?? 0) >= 75;
        const completed = Boolean(record.completed) || completedByScores;
        const mastered =
          Boolean(record.mastered) ||
          (Boolean(record.masteryQuizPassed) && Boolean(record.masterySpeakPassed));

        const existing = completionByLesson.get(lessonKey);
        completionByLesson.set(lessonKey, {
          introViewed: Boolean(record.introViewed) || Boolean(existing?.introViewed),
          quizScore:
            existing?.quizScore === null || existing?.quizScore === undefined
              ? quizScore
              : quizScore === null
                ? existing.quizScore
                : Math.max(existing.quizScore, quizScore),
          speakScore:
            existing?.speakScore === null || existing?.speakScore === undefined
              ? speakScore
              : speakScore === null
                ? existing.speakScore
                : Math.max(existing.speakScore, speakScore),
          completed: Boolean(existing?.completed) || completed,
          mastered: Boolean(existing?.mastered) || mastered,
          completionCount: (existing?.completionCount ?? 0) + (completed ? 1 : 0),
        });
      }

      const lessonsStarted = startedLessonKeys.size;
      const lessonsFinished = Array.from(completionByLesson.values()).filter(
        (item) => item.completed
      ).length;
      const lessonsMastered = Array.from(completionByLesson.values()).filter(
        (item) => item.mastered
      ).length;
      const lessonsMasteryReady = Array.from(completionByLesson.values()).filter(
        (item) => item.completed && !item.mastered
      ).length;
      const lessonsAbandoned = Math.max(0, lessonsStarted - lessonsFinished);

      const currentKey =
        progress?.currentBandId &&
        progress?.currentUnitId &&
        typeof progress.currentLessonIdx === 'number'
          ? `${progress.currentBandId}:${progress.currentUnitId}:${progress.currentLessonIdx}`
          : null;
      const currentLessonStatus = currentKey ? completionByLesson.get(currentKey) || null : null;

      return {
        userId: profile.userId,
        language: normalizeAdminLanguageId(profile.targetLanguage),
        currentBandId: progress?.currentBandId || null,
        currentUnitId: progress?.currentUnitId || null,
        currentLessonIdx: progress?.currentLessonIdx ?? null,
        lastActivityAt,
        completionSummary: {
          lessonsStarted,
          lessonsFinished,
          lessonsAbandoned,
          lessonsMastered,
          lessonsMasteryReady,
        },
        currentLessonStatus: currentLessonStatus
          ? {
              introViewed: currentLessonStatus.introViewed,
              quizScore: currentLessonStatus.quizScore,
              speakScore: currentLessonStatus.speakScore,
              completed: currentLessonStatus.completed,
              mastered: currentLessonStatus.mastered,
              masteryReady: currentLessonStatus.completed && !currentLessonStatus.mastered,
              completionCount: currentLessonStatus.completionCount,
            }
          : null,
      };
    }
  );

  app.get(
    '/v1/admin/users/:userId/progress-trend',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedQuery = reportWindowQuerySchema.safeParse(request.query ?? {});
      if (!parsedQuery.success) {
        reply
          .code(400)
          .send({ error: 'Invalid query parameters', issues: parsedQuery.error.issues });
        return;
      }

      const userId = parsedParams.data.userId;
      const windowDays = parsedQuery.data.windowDays;
      const profile = await prisma.profile.findUnique({
        where: { userId },
        select: { userId: true },
      });
      if (!profile) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }

      const rows = await prisma.$queryRaw<
        Array<{
          day: Date | string;
          quizAttempts: bigint;
          quizSessions: bigint;
          quizCorrect: bigint;
          speakAttempts: bigint;
          speakSessions: bigint;
          speakPasses: bigint;
          lessonsStarted: bigint;
          lessonsCompleted: bigint;
        }>
      >`
        WITH days AS (
          SELECT generate_series(
            date_trunc('day', now() - ${windowDays - 1} * interval '1 day'),
            date_trunc('day', now()),
            interval '1 day'
          ) AS day
        )
        SELECT
          days.day AS day,
          COALESCE(qa.quiz_attempts, 0)::bigint AS "quizAttempts",
          COALESCE(pe.quiz_sessions_completed, 0)::bigint AS "quizSessions",
          COALESCE(qa.quiz_correct, 0)::bigint AS "quizCorrect",
          COALESCE(sa.speak_attempts, 0)::bigint AS "speakAttempts",
          COALESCE(pe.speak_sessions_completed, 0)::bigint AS "speakSessions",
          COALESCE(sa.speak_passes, 0)::bigint AS "speakPasses",
          COALESCE(pe.lessons_started, 0)::bigint AS "lessonsStarted",
          COALESCE(pe.lessons_completed, 0)::bigint AS "lessonsCompleted"
        FROM days
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) AS quiz_attempts,
            COUNT(*) FILTER (WHERE qa.is_correct = true) AS quiz_correct
          FROM quiz_attempts qa
          WHERE qa.user_id = ${userId}::uuid
            AND qa.created_at >= days.day
            AND qa.created_at < days.day + interval '1 day'
        ) qa ON true
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) AS speak_attempts,
            COUNT(*) FILTER (WHERE sa.initial_ok = true AND sa.final_ok = true AND sa.tone_ok = true) AS speak_passes
          FROM speak_attempts sa
          WHERE sa.user_id = ${userId}::uuid
            AND sa.created_at >= days.day
            AND sa.created_at < days.day + interval '1 day'
        ) sa ON true
        LEFT JOIN LATERAL (
          WITH day_progress_events AS (
            SELECT
              pe.event_type,
              COALESCE(pe.payload_json->>'bandId', '') AS band_id,
              COALESCE(pe.payload_json->>'unitId', '') AS unit_id,
              COALESCE(pe.payload_json->>'lessonIndex', '') AS lesson_idx,
              COALESCE(pe.payload_json->>'reachedCompleteScreen', '') AS reached_complete_screen,
              COALESCE(pe.payload_json->>'completed', '') AS completed_flag,
              CASE
                WHEN COALESCE(pe.payload_json->>'quizScore', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                  THEN (pe.payload_json->>'quizScore')::double precision
                ELSE NULL
              END AS quiz_score,
              CASE
                WHEN COALESCE(pe.payload_json->>'speakScore', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                  THEN (pe.payload_json->>'speakScore')::double precision
                ELSE NULL
              END AS speak_score
            FROM progress_events pe
            WHERE pe.user_id = ${userId}::uuid
                AND pe.created_at >= days.day
                AND pe.created_at < days.day + interval '1 day'
          ),
          started_keys AS (
            SELECT DISTINCT dpe.band_id, dpe.unit_id, dpe.lesson_idx
            FROM day_progress_events dpe
            WHERE dpe.event_type = 'lesson_started'
              AND dpe.band_id <> ''
              AND dpe.unit_id <> ''
              AND dpe.lesson_idx <> ''
          ),
          completed_first_keys AS (
            SELECT
              dpe.band_id,
              dpe.unit_id,
              dpe.lesson_idx,
              MAX(CASE WHEN COALESCE(dpe.quiz_score, 0) >= 90 THEN 1 ELSE 0 END) AS quiz_completed,
              MAX(CASE WHEN COALESCE(dpe.speak_score, 0) >= 75 THEN 1 ELSE 0 END) AS speak_completed
            FROM day_progress_events dpe
            WHERE dpe.event_type = 'lesson_completed'
              AND dpe.band_id <> ''
              AND dpe.unit_id <> ''
              AND dpe.lesson_idx <> ''
              AND (
                dpe.reached_complete_screen = 'true'
                OR (dpe.reached_complete_screen = '' AND dpe.completed_flag = 'true')
              )
              AND NOT EXISTS (
                SELECT 1
                FROM progress_events pe_prev
                WHERE pe_prev.user_id = ${userId}::uuid
                  AND pe_prev.created_at < days.day
                  AND pe_prev.event_type = 'lesson_completed'
                  AND COALESCE(pe_prev.payload_json->>'bandId', '') = dpe.band_id
                  AND COALESCE(pe_prev.payload_json->>'unitId', '') = dpe.unit_id
                  AND COALESCE(pe_prev.payload_json->>'lessonIndex', '') = dpe.lesson_idx
                  AND (
                    COALESCE(pe_prev.payload_json->>'reachedCompleteScreen', '') = 'true'
                    OR (
                      COALESCE(pe_prev.payload_json->>'reachedCompleteScreen', '') = ''
                      AND COALESCE(pe_prev.payload_json->>'completed', '') = 'true'
                    )
                  )
              )
            GROUP BY dpe.band_id, dpe.unit_id, dpe.lesson_idx
          )
          SELECT
            (SELECT COUNT(*)::bigint FROM started_keys) AS lessons_started,
            (SELECT COUNT(*)::bigint FROM completed_first_keys) AS lessons_completed,
            (
              SELECT COUNT(*)::bigint
              FROM completed_first_keys cfk
              WHERE cfk.quiz_completed = 1
            ) AS quiz_sessions_completed,
            (
              SELECT COUNT(*)::bigint
              FROM completed_first_keys cfk
              WHERE cfk.speak_completed = 1
            ) AS speak_sessions_completed
        ) pe ON true
        ORDER BY days.day ASC
      `;

      const isoDay = (value: Date | string) => {
        if (value instanceof Date) return value.toISOString().slice(0, 10);
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
        return String(value).slice(0, 10);
      };

      const series = rows.map((row) => {
        const quizAttempts = toInt(row.quizAttempts);
        const quizSessions = toInt(row.quizSessions);
        const quizCorrect = toInt(row.quizCorrect);
        const speakAttempts = toInt(row.speakAttempts);
        const speakSessions = toInt(row.speakSessions);
        const speakPasses = toInt(row.speakPasses);
        const lessonsStarted = toInt(row.lessonsStarted);
        const lessonsCompleted = toInt(row.lessonsCompleted);
        return {
          day: isoDay(row.day),
          quizAttempts,
          quizSessions,
          quizCorrect,
          quizAccuracyPct:
            quizAttempts > 0 ? Number(((quizCorrect / quizAttempts) * 100).toFixed(1)) : 0,
          speakAttempts,
          speakSessions,
          speakPasses,
          speakPassPct:
            speakAttempts > 0 ? Number(((speakPasses / speakAttempts) * 100).toFixed(1)) : 0,
          lessonsStarted,
          lessonsCompleted,
        };
      });

      const sum = <T extends number>(values: T[]) => values.reduce((acc, value) => acc + value, 0);
      const midpoint = Math.max(1, Math.floor(series.length / 2));
      const firstHalf = series.slice(0, midpoint);
      const secondHalf = series.slice(midpoint);
      const avg = (values: number[]) => (values.length ? sum(values) / values.length : 0);
      const safeDelta = (left: number, right: number) =>
        left <= 0 ? (right > 0 ? 100 : 0) : Number((((right - left) / left) * 100).toFixed(1));

      const firstQuizAcc = avg(firstHalf.map((entry) => entry.quizAccuracyPct));
      const secondQuizAcc = avg(secondHalf.map((entry) => entry.quizAccuracyPct));
      const firstSpeakPass = avg(firstHalf.map((entry) => entry.speakPassPct));
      const secondSpeakPass = avg(secondHalf.map((entry) => entry.speakPassPct));
      const firstLessonCompletePerDay = avg(firstHalf.map((entry) => entry.lessonsCompleted));
      const secondLessonCompletePerDay = avg(secondHalf.map((entry) => entry.lessonsCompleted));

      return {
        windowDays,
        summary: {
          totalQuizAttempts: sum(series.map((entry) => entry.quizAttempts)),
          totalQuizSessions: sum(series.map((entry) => entry.quizSessions)),
          totalSpeakAttempts: sum(series.map((entry) => entry.speakAttempts)),
          totalSpeakSessions: sum(series.map((entry) => entry.speakSessions)),
          totalLessonsCompleted: sum(series.map((entry) => entry.lessonsCompleted)),
          avgQuizAccuracyPct: Number(avg(series.map((entry) => entry.quizAccuracyPct)).toFixed(1)),
          avgSpeakPassPct: Number(avg(series.map((entry) => entry.speakPassPct)).toFixed(1)),
          trend: {
            quizAccuracyDeltaPct: safeDelta(firstQuizAcc, secondQuizAcc),
            speakPassDeltaPct: safeDelta(firstSpeakPass, secondSpeakPass),
            lessonsCompletedPerDayDeltaPct: safeDelta(
              firstLessonCompletePerDay,
              secondLessonCompletePerDay
            ),
          },
        },
        series,
      };
    }
  );

  app.get(
    '/v1/admin/users/:userId/access',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
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

      const state = await getLearningAccessState(prisma, userId);
      const recentAuditRows = await prisma.$queryRaw<
        Array<{
          id: string;
          actorEmail: string | null;
          reason: string;
          changeType: string;
          createdAt: Date;
        }>
      >`
      SELECT
        ulaa.id,
        ulaa.actor_email AS "actorEmail",
        ulaa.reason,
        ulaa.change_type AS "changeType",
        ulaa.created_at AS "createdAt"
      FROM user_learning_access_audits ulaa
      WHERE ulaa.user_id = ${userId}::uuid
      ORDER BY ulaa.created_at DESC
      LIMIT 40
    `;

      return {
        state,
        recentAudit: recentAuditRows,
      };
    }
  );

  app.patch(
    '/v1/admin/users/:userId/access',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      if (!requireTrustedOrigin(request, reply, deps.allowedOrigins)) return;

      const parsedParams = userIdParamsSchema.safeParse(request.params ?? {});
      if (!parsedParams.success) {
        reply.code(400).send({ error: 'Invalid user id', issues: parsedParams.error.issues });
        return;
      }
      const parsedBody = learningAccessPatchSchema.safeParse(request.body ?? {});
      if (!parsedBody.success) {
        reply.code(400).send({ error: 'Invalid payload', issues: parsedBody.error.issues });
        return;
      }

      const targetUserId = parsedParams.data.userId;
      const actor: MutationActor = {
        actorUserId: request.user.id,
        actorEmail: request.user.email || null,
      };

      const profile = await prisma.profile.findUnique({
        where: { userId: targetUserId },
        select: { userId: true },
      });
      if (!profile) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }

      const beforeState = await getLearningAccessState(prisma, targetUserId);
      const nextState = {
        globalAccess: beforeState.globalAccess,
        lockAboveTarget: beforeState.lockAboveTarget,
        cursor: beforeState.cursor,
        overrides: {
          levels: { ...beforeState.overrides.levels },
          units: { ...beforeState.overrides.units },
          lessons: { ...beforeState.overrides.lessons },
        },
      };

      if (typeof parsedBody.data.globalAccess === 'boolean') {
        nextState.globalAccess = parsedBody.data.globalAccess;
      }

      const overrides = parsedBody.data.overrides;
      if (overrides?.levels) {
        for (const [key, status] of Object.entries(overrides.levels)) {
          const normalizedKey = key.trim();
          if (!normalizedKey) continue;
          nextState.overrides.levels[normalizedKey] = status;
        }
      }
      if (overrides?.units) {
        for (const [key, status] of Object.entries(overrides.units)) {
          const normalizedKey = key.trim();
          if (!normalizedKey) continue;
          nextState.overrides.units[normalizedKey] = status;
        }
      }
      if (overrides?.lessons) {
        for (const [key, status] of Object.entries(overrides.lessons)) {
          const normalizedKey = key.trim();
          if (!normalizedKey) continue;
          nextState.overrides.lessons[normalizedKey] = status;
        }
      }

      if (parsedBody.data.progressTarget) {
        const target = parsedBody.data.progressTarget;
        const normalizedLanguage = normalizeAdminLanguageId(target.language);
        const nextCursorLanguage = normalizedLanguage || beforeState.cursor?.language || null;

        if (normalizedLanguage) {
          await prisma.profile.update({
            where: { userId: targetUserId },
            data: {
              targetLanguage: normalizedLanguage,
            },
          });
        }

        await prisma.userProgress.upsert({
          where: { userId: targetUserId },
          update: {
            currentBandId: target.bandId,
            currentUnitId: target.unitId,
            currentLessonIdx: target.lessonIndex,
          },
          create: {
            userId: targetUserId,
            currentBandId: target.bandId,
            currentUnitId: target.unitId,
            currentLessonIdx: target.lessonIndex,
          },
        });

        nextState.cursor = {
          language: nextCursorLanguage,
          bandId: target.bandId,
          unitId: target.unitId,
          lessonIndex: target.lessonIndex,
        };

        if (target.unlockUpToTarget) {
          nextState.overrides.levels[target.bandId] = 'unlocked';
          nextState.overrides.units[target.unitId] = 'unlocked';
          nextState.overrides.lessons[lessonOverrideKey(target.unitId, target.lessonIndex)] =
            'unlocked';
        }
        nextState.lockAboveTarget = target.lockAboveTarget;
      }

      await saveLearningAccessState(prisma, targetUserId, nextState);
      const afterState = await getLearningAccessState(prisma, targetUserId);

      await logAdminAudit({
        actor,
        action: 'learning_access.updated',
        targetUserId,
        reason: parsedBody.data.reason,
        result: 'ok',
        metadata: {
          before: beforeState,
          after: afterState,
        },
      });

      await appendLearningAccessAudit({
        prisma,
        userId: targetUserId,
        actorUserId: actor.actorUserId,
        actorEmail: actor.actorEmail,
        changeType: 'learning_access.updated',
        reason: parsedBody.data.reason,
        beforeState,
        afterState,
      });

      return { ok: true, state: afterState };
    }
  );

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
      if (!requireTrustedOrigin(request, reply, deps.allowedOrigins)) return;

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
      if (!requireTrustedOrigin(request, reply, deps.allowedOrigins)) return;

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
      if (!requireTrustedOrigin(request, reply, deps.allowedOrigins)) return;

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
      if (!requireTrustedOrigin(request, reply, deps.allowedOrigins)) return;

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
      if (!requireTrustedOrigin(request, reply, deps.allowedOrigins)) return;

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
      if (!requireTrustedOrigin(request, reply, deps.allowedOrigins)) return;

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
      if (!requireTrustedOrigin(request, reply, deps.allowedOrigins)) return;

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
      if (!requireTrustedOrigin(request, reply, deps.allowedOrigins)) return;

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
