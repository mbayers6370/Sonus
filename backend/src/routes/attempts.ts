import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/auth.js';
import { touchUserActivity } from '../services/progressService.js';
import { computeQuizMemoryUpdate, computeSpeakMemoryUpdate } from '../lib/learningPolicy.js';
import { recordAttemptTelemetry } from '../services/learningMetricsService.js';

const quizAttemptSchema = z.object({
  wordId: z.string().trim().min(1).max(80),
  isCorrect: z.boolean(),
  isReview: z.boolean().optional(),
  responseMs: z.number().int().positive().max(120000).optional(),
  answerText: z.string().trim().max(256).optional(),
});

const speakAttemptSchema = z.object({
  wordId: z.string().trim().min(1).max(80),
  isReview: z.boolean().optional(),
  transcript: z.string().max(512).optional(),
  detectedPinyin: z.string().max(128).optional(),
  initialOk: z.boolean(),
  finalOk: z.boolean(),
  toneOk: z.boolean(),
  score: z.number().int().min(0).max(100).optional(),
});

function nextDueDate(days: number) {
  const due = new Date();
  due.setDate(due.getDate() + days);
  return due;
}

export async function attemptRoutes(app: FastifyInstance) {
  app.post('/v1/attempts/quiz', { preHandler: [requireAuth] }, async (request, reply) => {
    const startedAt = Date.now();
    const parsed = quizAttemptSchema.safeParse(request.body);
    if (!parsed.success) {
      recordAttemptTelemetry({
        kind: 'quiz',
        durationMs: Date.now() - startedAt,
        ok: false,
        isReview: false,
      });
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    const { id: userId } = request.user;
    const data = parsed.data;
    const isReview = Boolean(data.isReview);
    const isMiss = !data.isCorrect;

    const result = await prisma.$transaction(async (tx) => {
      const attempt = await tx.quizAttempt.create({
        data: {
          userId,
          wordId: data.wordId,
          isCorrect: data.isCorrect,
          responseMs: data.responseMs,
          answerText: data.answerText,
        },
      });

      const existing = await tx.wordMemoryState.findUnique({
        where: {
          userId_wordId: {
            userId,
            wordId: data.wordId,
          },
        },
      });

      const update = computeQuizMemoryUpdate(existing, isMiss, isReview);
      const nextQuizDueAt = nextDueDate(update.dueDays);

      const memory = await tx.wordMemoryState.upsert({
        where: {
          userId_wordId: {
            userId,
            wordId: data.wordId,
          },
        },
        update: {
          missedQuizCount: update.missedQuizCount,
          mispronounceCount: update.mispronounceCount,
          quizEase: update.quizEase,
          pronunciationRisk: update.pronunciationRisk,
          quizIntervalDays: update.quizIntervalDays,
          quizDueAt: nextQuizDueAt,
          lastSeenAt: new Date(),
          lastCorrectAt: isMiss ? existing?.lastCorrectAt ?? null : new Date(),
        },
        create: {
          userId,
          wordId: data.wordId,
          missedQuizCount: update.missedQuizCount,
          mispronounceCount: update.mispronounceCount,
          quizEase: update.quizEase,
          pronunciationRisk: update.pronunciationRisk,
          quizIntervalDays: update.quizIntervalDays,
          quizDueAt: nextQuizDueAt,
          lastSeenAt: new Date(),
          lastCorrectAt: isMiss ? null : new Date(),
        },
      });

      return { attempt, memory };
    });

    await touchUserActivity(userId);
    recordAttemptTelemetry({
      kind: 'quiz',
      durationMs: Date.now() - startedAt,
      ok: true,
      isReview,
    });
    return result;
  });

  app.post('/v1/attempts/speak', { preHandler: [requireAuth] }, async (request, reply) => {
    const startedAt = Date.now();
    const parsed = speakAttemptSchema.safeParse(request.body);
    if (!parsed.success) {
      recordAttemptTelemetry({
        kind: 'speak',
        durationMs: Date.now() - startedAt,
        ok: false,
        isReview: false,
      });
      reply.code(400).send({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }

    const { id: userId } = request.user;
    const data = parsed.data;
    const isReview = Boolean(data.isReview);
    const mispronounced = !(data.initialOk && data.finalOk && data.toneOk);

    const result = await prisma.$transaction(async (tx) => {
      const attempt = await tx.speakAttempt.create({
        data: {
          userId,
          wordId: data.wordId,
          transcript: data.transcript,
          detectedPinyin: data.detectedPinyin,
          initialOk: data.initialOk,
          finalOk: data.finalOk,
          toneOk: data.toneOk,
          score: data.score,
        },
      });

      const existing = await tx.wordMemoryState.findUnique({
        where: {
          userId_wordId: {
            userId,
            wordId: data.wordId,
          },
        },
      });

      const update = computeSpeakMemoryUpdate(existing, mispronounced, isReview);
      const nextQuizDueAt = nextDueDate(update.dueDays);

      const memory = await tx.wordMemoryState.upsert({
        where: {
          userId_wordId: {
            userId,
            wordId: data.wordId,
          },
        },
        update: {
          mispronounceCount: update.mispronounceCount,
          missedQuizCount: update.missedQuizCount,
          pronunciationRisk: update.pronunciationRisk,
          quizIntervalDays: update.quizIntervalDays,
          quizDueAt: nextQuizDueAt,
          quizEase: update.quizEase,
          lastSeenAt: new Date(),
          lastCorrectAt: mispronounced ? existing?.lastCorrectAt ?? null : new Date(),
        },
        create: {
          userId,
          wordId: data.wordId,
          mispronounceCount: update.mispronounceCount,
          missedQuizCount: update.missedQuizCount,
          pronunciationRisk: update.pronunciationRisk,
          quizIntervalDays: update.quizIntervalDays,
          quizDueAt: nextQuizDueAt,
          quizEase: update.quizEase,
          lastSeenAt: new Date(),
          lastCorrectAt: mispronounced ? null : new Date(),
        },
      });

      return { attempt, memory };
    });

    await touchUserActivity(userId);
    recordAttemptTelemetry({
      kind: 'speak',
      durationMs: Date.now() - startedAt,
      ok: true,
      isReview,
    });
    return result;
  });
}
