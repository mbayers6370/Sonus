import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../env.js';
import { requireAuth } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { serializeCookie } from '../lib/cookies.js';
import {
  ensureLearningAccessTables,
  getLearningAccessState,
  isLessonPointerBlocked,
} from '../lib/learningAccess.js';
import { readAllowedOrigins, requireTrustedOrigin } from '../lib/originPolicy.js';
import {
  fetchNeedsWork,
  fetchReviewQueue,
  fetchWeakLogs,
  fetchWrongWords,
} from '../services/reviewInsightsService.js';
import { getOrCreateProfile, upsertProfile } from '../services/profileService.js';
import { sendAccountDeletionConfirmationEmail } from '../services/accountDeletionEmailService.js';
import {
  getProgressSnapshot,
  recordProgressEvent,
  updateProgressCurrent,
} from '../services/progressService.js';

const reviewQueueQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  language: z.string().trim().min(2).max(12).optional(),
  shape: z.enum(['legacy', 'lexeme']).default('legacy'),
});

const needsWorkQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(30),
  minTotalMisses: z.coerce.number().int().min(1).max(100).default(3),
  language: z.string().trim().min(2).max(12).optional(),
  shape: z.enum(['legacy', 'lexeme']).default('legacy'),
});

const weakLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  language: z.string().trim().min(2).max(12).optional(),
});

const wrongWordsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(30),
  minTotalMisses: z.coerce.number().int().min(1).max(100).default(3),
  language: z.string().trim().min(2).max(12).optional(),
});

const profilePatchSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  targetLanguage: z.string().trim().min(2).max(12).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  onboardingComplete: z.boolean().optional(),
});

const progressEventSchema = z.object({
  eventType: z.enum([
    'lesson_started',
    'lesson_completed',
    'quiz_answered',
    'speak_scored',
    'manual_adjustment',
    'lesson_reset_for_review',
  ]),
  streakDelta: z.number().int().min(-3).max(3).default(0),
  payloadJson: z.record(z.any()).optional(),
});

const lessonResetPayloadSchema = z.object({
  bandId: z.string().trim().min(1).max(64),
  unitId: z.string().trim().min(1).max(128),
  lessonIndex: z.number().int().min(0).max(500),
});

const progressCurrentPatchSchema = z.object({
  currentBandId: z.string().trim().min(1).max(64).nullable().optional(),
  currentUnitId: z.string().trim().min(1).max(128).nullable().optional(),
  currentLessonIdx: z.number().int().min(0).max(500).nullable().optional(),
});
const accountDeletionRequestSchema = z.object({
  reason: z.string().trim().min(8).max(500).optional(),
});

export async function meRoutes(app: FastifyInstance) {
  const allowedOrigins = readAllowedOrigins();
  await ensureLearningAccessTables(prisma);

  // Auth required. Returns current profile, creating it lazily when missing.
  app.get('/v1/me/profile', { preHandler: [requireAuth] }, async (request) => {
    const { id, email, displayName } = request.user;
    let profile = await getOrCreateProfile(id, email);
    if (!profile.displayName && displayName) {
      profile = await upsertProfile({
        userId: id,
        email,
        displayName,
      });
    }
    return { profile };
  });

  // Auth required. Partial profile update endpoint.
  app.patch('/v1/me/profile', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = profilePatchSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    const { id, email } = request.user;
    const profile = await upsertProfile({
      userId: id,
      email,
      displayName: parsed.data.displayName,
      targetLanguage: parsed.data.targetLanguage,
      timezone: parsed.data.timezone,
      onboardingComplete: parsed.data.onboardingComplete,
    });

    return { profile };
  });

  // Auth required + trusted origin. Schedules account deletion and signs the user out immediately.
  app.delete('/v1/me/account', { preHandler: [requireAuth] }, async (request, reply) => {
    if (!requireTrustedOrigin(request, reply, allowedOrigins)) return;
    const parsedBody = accountDeletionRequestSchema.safeParse(request.body ?? {});
    if (!parsedBody.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsedBody.error.issues });
      return;
    }

    const { id, email } = request.user;
    const holdDays = env.ACCOUNT_DELETION_HOLD_DAYS;
    const scheduledFor = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000);
    const reason =
      parsedBody.data.reason?.trim() || 'User requested account deletion from profile settings.';

    const profileSnapshot = await prisma.profile.findUnique({
      where: { userId: id },
      select: { displayName: true, email: true },
    });

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
          ${id}::uuid,
          ${profileSnapshot?.email || email},
          ${profileSnapshot?.displayName || null},
          ${id}::uuid,
          ${email},
          ${reason},
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

    if (env.AUTH_MODE === 'local') {
      await prisma.refreshSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedReason: 'account_deletion_scheduled',
        },
      });
    }

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

    if (profileSnapshot?.email || email) {
      void sendAccountDeletionConfirmationEmail({
        to: profileSnapshot?.email || email || '',
        deletedAtIso: new Date().toISOString(),
        holdDays,
        scheduledForIso: scheduledFor.toISOString(),
      }).catch((error) => {
        console.error('[auth] Unexpected account deletion email error', error);
      });
    }

    return {
      ok: true,
      scheduled: true,
      holdDays,
      scheduledFor: scheduledFor.toISOString(),
    };
  });

  // Auth required. Returns denormalized progress snapshot for dashboard/profile consumers.
  app.get('/v1/me/progress', { preHandler: [requireAuth] }, async (request) => {
    const { id } = request.user;
    const [{ progress, recentEvents, lessonProgress }, learningAccess] = await Promise.all([
      getProgressSnapshot(id),
      getLearningAccessState(prisma, id),
    ]);
    return {
      progress,
      recentEvents,
      lessonProgress,
      learningAccess: {
        globalAccess: learningAccess.globalAccess,
        lockAboveTarget: learningAccess.lockAboveTarget,
        cursor: learningAccess.cursor,
      },
    };
  });

  // Auth required. Updates current resume pointer (band/unit/lesson index).
  app.patch('/v1/me/progress/current', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = progressCurrentPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    const { id } = request.user;
    const existing = await prisma.userProgress.findUnique({
      where: { userId: id },
      select: {
        currentBandId: true,
        currentUnitId: true,
        currentLessonIdx: true,
      },
    });
    const accessState = await getLearningAccessState(prisma, id);
    const pointer = {
      bandId:
        parsed.data.currentBandId !== undefined
          ? parsed.data.currentBandId
          : existing?.currentBandId || null,
      unitId:
        parsed.data.currentUnitId !== undefined
          ? parsed.data.currentUnitId
          : existing?.currentUnitId || null,
      lessonIndex:
        parsed.data.currentLessonIdx !== undefined
          ? parsed.data.currentLessonIdx
          : (existing?.currentLessonIdx ?? null),
    };
    if (isLessonPointerBlocked(accessState, pointer)) {
      reply.code(403).send({ error: 'Learning access is locked for this lesson pointer.' });
      return;
    }

    const progress = await updateProgressCurrent(id, parsed.data);
    return { progress };
  });

  // Auth required. Returns prioritized review queue; optional lexeme response shape.
  app.get('/v1/me/review-queue', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = reviewQueueQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
      return;
    }

    const { id } = request.user;
    return fetchReviewQueue(id, parsed.data.limit, parsed.data.language, parsed.data.shape);
  });

  // Auth required. Returns words still in needs-work according to graduation criteria.
  app.get('/v1/me/needs-work', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = needsWorkQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
      return;
    }

    const { id } = request.user;
    return fetchNeedsWork(
      id,
      parsed.data.limit,
      parsed.data.minTotalMisses,
      parsed.data.language,
      parsed.data.shape
    );
  });

  // Auth required. Returns recent weak-word miss logs for analytics/debug surfaces.
  app.get('/v1/me/logs/weak', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = weakLogsQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
      return;
    }

    const { id } = request.user;
    return fetchWeakLogs(id, parsed.data.limit, parsed.data.language);
  });

  // Auth required. Legacy wrong-words endpoint used by older clients.
  app.get('/v1/me/wrong-words', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = wrongWordsQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
      return;
    }

    const { id } = request.user;
    return fetchWrongWords(id, parsed.data.limit, parsed.data.minTotalMisses, parsed.data.language);
  });

  // Auth required. Appends a progress event to the event stream.
  app.post('/v1/me/progress/events', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = progressEventSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    let payloadJson = parsed.data.payloadJson;
    if (parsed.data.eventType === 'lesson_reset_for_review') {
      const parsedResetPayload = lessonResetPayloadSchema.safeParse(parsed.data.payloadJson);
      if (!parsedResetPayload.success) {
        reply
          .code(400)
          .send({ error: 'Invalid lesson reset payload', issues: parsedResetPayload.error.issues });
        return;
      }
      // Explicitly persist only a single lesson pointer for reset events.
      payloadJson = parsedResetPayload.data;
    }

    const { id } = request.user;
    return recordProgressEvent(id, {
      eventType: parsed.data.eventType,
      streakDelta: parsed.data.streakDelta,
      payloadJson,
    });
  });
}
