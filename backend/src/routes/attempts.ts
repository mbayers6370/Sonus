import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/auth.js';
import { touchUserActivity } from '../services/progressService.js';

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

function clampMin(value: number, min: number) {
  return Math.max(min, value);
}

export async function attemptRoutes(app: FastifyInstance) {
  app.post('/v1/attempts/quiz', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = quizAttemptSchema.safeParse(request.body);
    if (!parsed.success) {
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

      const nextMissedQuizCount = isMiss ? (existing?.missedQuizCount ?? 0) + 1 : 0;
      const nextMispronounceCount = isMiss ? existing?.mispronounceCount ?? 0 : 0;
      const nextQuizEase = clampMin(
        (existing?.quizEase ?? 2.5) + (isMiss ? -0.2 : isReview ? 0.12 : 0.06),
        1.3
      );
      const nextPronunciationRisk = isMiss
        ? clampMin((existing?.pronunciationRisk ?? 0) + (isReview ? 0.22 : 0.1), 0)
        : 0;

      const baseInterval = existing?.quizIntervalDays ?? 1;
      const nextQuizIntervalDays = isMiss
        ? 1
        : clampMin(baseInterval + (isReview ? 2 : 1), 1);
      const dueDays = isMiss ? (isReview ? 0 : 1) : isReview ? 4 : 2;
      const nextQuizDueAt = nextDueDate(dueDays);

      const memory = await tx.wordMemoryState.upsert({
        where: {
          userId_wordId: {
            userId,
            wordId: data.wordId,
          },
        },
        update: {
          missedQuizCount: nextMissedQuizCount,
          mispronounceCount: nextMispronounceCount,
          quizEase: nextQuizEase,
          pronunciationRisk: nextPronunciationRisk,
          quizIntervalDays: nextQuizIntervalDays,
          quizDueAt: nextQuizDueAt,
          lastSeenAt: new Date(),
          lastCorrectAt: isMiss ? existing?.lastCorrectAt ?? null : new Date(),
        },
        create: {
          userId,
          wordId: data.wordId,
          missedQuizCount: nextMissedQuizCount,
          mispronounceCount: nextMispronounceCount,
          quizEase: nextQuizEase,
          pronunciationRisk: nextPronunciationRisk,
          quizIntervalDays: nextQuizIntervalDays,
          quizDueAt: nextQuizDueAt,
          lastSeenAt: new Date(),
          lastCorrectAt: isMiss ? null : new Date(),
        },
      });

      return { attempt, memory };
    });

    await touchUserActivity(userId);
    return result;
  });

  app.post('/v1/attempts/speak', { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = speakAttemptSchema.safeParse(request.body);
    if (!parsed.success) {
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

      const nextMispronounceCount = mispronounced ? (existing?.mispronounceCount ?? 0) + 1 : 0;
      const nextMissedQuizCount = mispronounced ? existing?.missedQuizCount ?? 0 : 0;
      const nextPronunciationRisk = mispronounced
        ? clampMin((existing?.pronunciationRisk ?? 0) + (isReview ? 0.35 : 0.2), 0)
        : 0;
      const nextQuizIntervalDays = mispronounced
        ? 1
        : clampMin((existing?.quizIntervalDays ?? 1) + (isReview ? 1 : 0), 1);
      const nextQuizDueAt = mispronounced
        ? nextDueDate(isReview ? 0 : 1)
        : nextDueDate(isReview ? 3 : 2);
      const nextQuizEase = clampMin(
        (existing?.quizEase ?? 2.5) + (mispronounced ? -0.08 : 0.05),
        1.3
      );

      const memory = await tx.wordMemoryState.upsert({
        where: {
          userId_wordId: {
            userId,
            wordId: data.wordId,
          },
        },
        update: {
          mispronounceCount: nextMispronounceCount,
          missedQuizCount: nextMissedQuizCount,
          pronunciationRisk: nextPronunciationRisk,
          quizIntervalDays: nextQuizIntervalDays,
          quizDueAt: nextQuizDueAt,
          quizEase: nextQuizEase,
          lastSeenAt: new Date(),
          lastCorrectAt: mispronounced ? existing?.lastCorrectAt ?? null : new Date(),
        },
        create: {
          userId,
          wordId: data.wordId,
          mispronounceCount: nextMispronounceCount,
          missedQuizCount: nextMissedQuizCount,
          pronunciationRisk: nextPronunciationRisk,
          quizIntervalDays: nextQuizIntervalDays,
          quizDueAt: nextQuizDueAt,
          quizEase: nextQuizEase,
          lastSeenAt: new Date(),
          lastCorrectAt: mispronounced ? null : new Date(),
        },
      });

      return { attempt, memory };
    });

    await touchUserActivity(userId);
    return result;
  });
}
