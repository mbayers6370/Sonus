import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../env.js';
import { requireAuth } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { fetchNeedsWork, fetchReviewQueue, fetchWeakLogs, fetchWrongWords } from '../services/reviewInsightsService.js';
import { getOrCreateProfile, upsertProfile } from '../services/profileService.js';
import { getProgressSnapshot, recordProgressEvent, updateProgressCurrent } from '../services/progressService.js';

const reviewQueueQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const needsWorkQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(30),
  minTotalMisses: z.coerce.number().int().min(1).max(100).default(3),
});

const weakLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const wrongWordsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(30),
  minTotalMisses: z.coerce.number().int().min(1).max(100).default(3),
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
  ]),
  streakDelta: z.number().int().min(-3).max(3).default(0),
  payloadJson: z.record(z.any()).optional(),
});

const progressCurrentPatchSchema = z.object({
  currentBandId: z.string().trim().min(1).max(64).nullable().optional(),
  currentUnitId: z.string().trim().min(1).max(128).nullable().optional(),
  currentLessonIdx: z.number().int().min(0).max(500).nullable().optional(),
});

export async function meRoutes(app: FastifyInstance) {
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

  app.delete('/v1/me/account', { preHandler: [requireAuth] }, async (request) => {
    const { id } = request.user;

    await prisma.$transaction(async (tx) => {
      await tx.quizAttempt.deleteMany({ where: { userId: id } });
      await tx.speakAttempt.deleteMany({ where: { userId: id } });
      await tx.wordMemoryState.deleteMany({ where: { userId: id } });
      await tx.progressEvent.deleteMany({ where: { userId: id } });
      await tx.userProgress.deleteMany({ where: { userId: id } });
      await tx.profile.deleteMany({ where: { userId: id } });
    });

    if (env.AUTH_MODE === 'supabase') {
      try {
        const supabaseAdmin = getSupabaseAdmin();
        await supabaseAdmin.auth.admin.deleteUser(id);
      } catch {
        // Account data is already removed from app tables; do not fail deletion on auth cleanup.
      }
    }

    return { ok: true };
  });

  app.get('/v1/me/progress', { preHandler: [requireAuth] }, async (request) => {
    const { id } = request.user;
    const { progress, recentEvents } = await getProgressSnapshot(id);
    return { progress, recentEvents };
  });

  app.patch('/v1/me/progress/current', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = progressCurrentPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    const { id } = request.user;
    const progress = await updateProgressCurrent(id, parsed.data);
    return { progress };
  });

  app.get('/v1/me/review-queue', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = reviewQueueQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
      return;
    }

    const { id } = request.user;
    return fetchReviewQueue(id, parsed.data.limit);
  });

  app.get('/v1/me/needs-work', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = needsWorkQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
      return;
    }

    const { id } = request.user;
    return fetchNeedsWork(id, parsed.data.limit, parsed.data.minTotalMisses);
  });

  app.get('/v1/me/logs/weak', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = weakLogsQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
      return;
    }

    const { id } = request.user;
    return fetchWeakLogs(id, parsed.data.limit);
  });

  app.get('/v1/me/wrong-words', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = wrongWordsQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
      return;
    }

    const { id } = request.user;
    return fetchWrongWords(id, parsed.data.limit, parsed.data.minTotalMisses);
  });

  app.post('/v1/me/progress/events', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = progressEventSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    const { id } = request.user;
    return recordProgressEvent(id, {
      eventType: parsed.data.eventType,
      streakDelta: parsed.data.streakDelta,
      payloadJson: parsed.data.payloadJson,
    });
  });
}
