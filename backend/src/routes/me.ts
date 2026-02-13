import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/auth.js';

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

function buildReviewPriority(input: {
  quizDueAt: Date;
  pronunciationRisk: number;
  missedQuizCount: number;
  mispronounceCount: number;
}) {
  const now = Date.now();
  const overdueMs = Math.max(0, now - input.quizDueAt.getTime());
  const overdueDays = overdueMs / 86_400_000;

  // Weighted blend: overdue words and pronunciation risk should surface first.
  const score =
    overdueDays * 1.25 +
    input.pronunciationRisk * 4 +
    input.missedQuizCount * 0.75 +
    input.mispronounceCount * 0.5;

  const reasons: string[] = [];
  if (overdueDays >= 1) reasons.push('quiz_overdue');
  if (input.missedQuizCount > 0) reasons.push('missed_quiz');
  if (input.pronunciationRisk >= 0.5 || input.mispronounceCount > 0) reasons.push('pronunciation_risk');

  return {
    score: Number(score.toFixed(3)),
    overdueDays: Number(overdueDays.toFixed(2)),
    reasons,
  };
}

export async function meRoutes(app: FastifyInstance) {
  app.get('/v1/me/profile', { preHandler: [requireAuth] }, async (request) => {
    const { id, email } = request.user;

    const profile = await prisma.profile.upsert({
      where: { userId: id },
      update: {
        email,
      },
      create: {
        userId: id,
        email,
      },
    });

    return { profile };
  });

  app.patch('/v1/me/profile', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = profilePatchSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    const { id, email } = request.user;

    const profile = await prisma.profile.upsert({
      where: { userId: id },
      update: {
        email,
        displayName: parsed.data.displayName,
        targetLanguage: parsed.data.targetLanguage,
        timezone: parsed.data.timezone,
        onboardingComplete: parsed.data.onboardingComplete,
      },
      create: {
        userId: id,
        email,
        displayName: parsed.data.displayName,
        targetLanguage: parsed.data.targetLanguage,
        timezone: parsed.data.timezone,
        onboardingComplete: parsed.data.onboardingComplete ?? false,
      },
    });

    return { profile };
  });

  app.get('/v1/me/progress', { preHandler: [requireAuth] }, async (request) => {
    const { id } = request.user;

    const [progress, recentEvents] = await Promise.all([
      prisma.userProgress.upsert({
        where: { userId: id },
        update: {},
        create: { userId: id },
      }),
      prisma.progressEvent.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return { progress, recentEvents };
  });

  app.patch('/v1/me/progress/current', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = progressCurrentPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    const { id } = request.user;
    const progress = await prisma.userProgress.upsert({
      where: { userId: id },
      update: {
        currentBandId: parsed.data.currentBandId ?? undefined,
        currentUnitId: parsed.data.currentUnitId ?? undefined,
        currentLessonIdx: parsed.data.currentLessonIdx ?? undefined,
      },
      create: {
        userId: id,
        currentBandId: parsed.data.currentBandId ?? null,
        currentUnitId: parsed.data.currentUnitId ?? null,
        currentLessonIdx: parsed.data.currentLessonIdx ?? null,
      },
    });

    return { progress };
  });

  app.get('/v1/me/review-queue', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = reviewQueueQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
      return;
    }

    const { id } = request.user;
    const { limit } = parsed.data;
    const now = new Date();

    const rows = await prisma.wordMemoryState.findMany({
      where: {
        userId: id,
        OR: [
          { quizDueAt: { lte: now } },
          { missedQuizCount: { gt: 0 } },
          { mispronounceCount: { gt: 0 } },
          { pronunciationRisk: { gt: 0 } },
        ],
      },
      take: Math.max(limit * 4, 80),
      orderBy: [
        { quizDueAt: 'asc' },
        { pronunciationRisk: 'desc' },
        { missedQuizCount: 'desc' },
        { mispronounceCount: 'desc' },
      ],
    });

    const queue = rows
      .map((row) => {
        const priority = buildReviewPriority({
          quizDueAt: row.quizDueAt,
          pronunciationRisk: row.pronunciationRisk,
          missedQuizCount: row.missedQuizCount,
          mispronounceCount: row.mispronounceCount,
        });

        return {
          wordId: row.wordId,
          quizDueAt: row.quizDueAt,
          quizIntervalDays: row.quizIntervalDays,
          quizEase: row.quizEase,
          pronunciationRisk: row.pronunciationRisk,
          missedQuizCount: row.missedQuizCount,
          mispronounceCount: row.mispronounceCount,
          lastSeenAt: row.lastSeenAt,
          lastCorrectAt: row.lastCorrectAt,
          priorityScore: priority.score,
          overdueDays: priority.overdueDays,
          reasons: priority.reasons,
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, limit);

    return {
      count: queue.length,
      limit,
      queue,
    };
  });

  app.get('/v1/me/needs-work', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = needsWorkQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
      return;
    }

    const { id } = request.user;
    const { limit, minTotalMisses } = parsed.data;
    const now = new Date();

    const rows = await prisma.wordMemoryState.findMany({
      where: {
        userId: id,
        OR: [{ missedQuizCount: { gt: 0 } }, { mispronounceCount: { gt: 0 } }],
      },
      take: Math.max(limit * 3, 80),
      orderBy: [
        { pronunciationRisk: 'desc' },
        { missedQuizCount: 'desc' },
        { mispronounceCount: 'desc' },
        { quizDueAt: 'asc' },
      ],
    });

    const needsWork = rows
      .map((row) => {
        const priority = buildReviewPriority({
          quizDueAt: row.quizDueAt,
          pronunciationRisk: row.pronunciationRisk,
          missedQuizCount: row.missedQuizCount,
          mispronounceCount: row.mispronounceCount,
        });
        const totalMisses = row.missedQuizCount + row.mispronounceCount;

        return {
          wordId: row.wordId,
          priorityScore: priority.score,
          totalMisses,
          overdueDays: priority.overdueDays,
          reasons: priority.reasons,
          quizDueAt: row.quizDueAt,
          quizIntervalDays: row.quizIntervalDays,
          quizEase: row.quizEase,
          pronunciationRisk: row.pronunciationRisk,
          missedQuizCount: row.missedQuizCount,
          mispronounceCount: row.mispronounceCount,
          lastSeenAt: row.lastSeenAt,
          lastCorrectAt: row.lastCorrectAt,
          updatedAt: row.updatedAt,
        };
      })
      .filter((row) => row.totalMisses >= minTotalMisses)
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, limit);

    return {
      count: needsWork.length,
      limit,
      needsWork,
    };
  });

  app.get('/v1/me/logs/weak', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = weakLogsQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
      return;
    }

    const { id } = request.user;
    const { limit } = parsed.data;

    const [quizMisses, speakMisses] = await Promise.all([
      prisma.quizAttempt.findMany({
        where: {
          userId: id,
          isCorrect: false,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.speakAttempt.findMany({
        where: {
          userId: id,
          OR: [{ initialOk: false }, { finalOk: false }, { toneOk: false }],
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    const logs = [
      ...quizMisses.map((row) => ({
        type: 'quiz_miss' as const,
        wordId: row.wordId,
        createdAt: row.createdAt,
        details: {
          answerText: row.answerText,
          responseMs: row.responseMs,
        },
      })),
      ...speakMisses.map((row) => ({
        type: 'speak_miss' as const,
        wordId: row.wordId,
        createdAt: row.createdAt,
        details: {
          transcript: row.transcript,
          detectedPinyin: row.detectedPinyin,
          initialOk: row.initialOk,
          finalOk: row.finalOk,
          toneOk: row.toneOk,
          score: row.score,
        },
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    return {
      count: logs.length,
      limit,
      logs,
    };
  });

  app.get('/v1/me/wrong-words', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = wrongWordsQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
      return;
    }

    const { id } = request.user;
    const { limit, minTotalMisses } = parsed.data;

    const [quizMissGroups, speakMissGroups] = await Promise.all([
      prisma.quizAttempt.groupBy({
        by: ['wordId'],
        where: {
          userId: id,
          isCorrect: false,
        },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.speakAttempt.groupBy({
        by: ['wordId'],
        where: {
          userId: id,
          OR: [{ initialOk: false }, { finalOk: false }, { toneOk: false }],
        },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
    ]);

    const combined = new Map<
      string,
      {
        wordId: string;
        quizMisses: number;
        speakMisses: number;
        lastWrongAt: Date | null;
      }
    >();

    for (const row of quizMissGroups) {
      combined.set(row.wordId, {
        wordId: row.wordId,
        quizMisses: row._count._all,
        speakMisses: 0,
        lastWrongAt: row._max.createdAt ?? null,
      });
    }

    for (const row of speakMissGroups) {
      const current = combined.get(row.wordId);
      const nextLastWrongAt =
        current?.lastWrongAt && row._max.createdAt
          ? current.lastWrongAt > row._max.createdAt
            ? current.lastWrongAt
            : row._max.createdAt
          : current?.lastWrongAt ?? row._max.createdAt ?? null;

      combined.set(row.wordId, {
        wordId: row.wordId,
        quizMisses: current?.quizMisses ?? 0,
        speakMisses: row._count._all,
        lastWrongAt: nextLastWrongAt,
      });
    }

    const wordIds = Array.from(combined.keys());
    const memoryRows = wordIds.length
      ? await prisma.wordMemoryState.findMany({
          where: {
            userId: id,
            wordId: { in: wordIds },
          },
        })
      : [];
    const memoryByWordId = new Map(memoryRows.map((row) => [row.wordId, row]));

    const words = Array.from(combined.values())
      .map((row) => {
        const memory = memoryByWordId.get(row.wordId);
        const totalMisses = row.quizMisses + row.speakMisses;
        return {
          wordId: row.wordId,
          quizMisses: row.quizMisses,
          speakMisses: row.speakMisses,
          totalMisses,
          lastWrongAt: row.lastWrongAt,
          pronunciationRisk: memory?.pronunciationRisk ?? 0,
          missedQuizCount: memory?.missedQuizCount ?? row.quizMisses,
          mispronounceCount: memory?.mispronounceCount ?? row.speakMisses,
        };
      })
      .filter((row) => row.totalMisses >= minTotalMisses)
      .sort((a, b) => {
        if (b.totalMisses !== a.totalMisses) return b.totalMisses - a.totalMisses;
        const left = a.lastWrongAt ? new Date(a.lastWrongAt).getTime() : 0;
        const right = b.lastWrongAt ? new Date(b.lastWrongAt).getTime() : 0;
        return right - left;
      })
      .slice(0, limit);

    return {
      count: words.length,
      limit,
      words,
    };
  });

  app.post('/v1/me/progress/events', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = progressEventSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    const { id } = request.user;
    const event = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const createdEvent = await tx.progressEvent.create({
        data: {
          userId: id,
          eventType: event.eventType,
          streakDelta: event.streakDelta,
          payloadJson: event.payloadJson,
        },
      });

      const progress = await tx.userProgress.upsert({
        where: { userId: id },
        update: {
          streak: { increment: event.streakDelta },
          lastActiveDate: new Date(),
        },
        create: {
          userId: id,
          streak: Math.max(0, event.streakDelta),
          lastActiveDate: new Date(),
        },
      });

      return { createdEvent, progress };
    });

    return result;
  });
}
