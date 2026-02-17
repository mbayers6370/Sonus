import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

interface UpdateProgressCurrentInput {
  currentBandId?: string | null;
  currentUnitId?: string | null;
  currentLessonIdx?: number | null;
}

interface ProgressEventInput {
  eventType: 'lesson_started' | 'lesson_completed' | 'quiz_answered' | 'speak_scored' | 'manual_adjustment';
  streakDelta: number;
  payloadJson?: Prisma.JsonObject;
}

export async function getProgressSnapshot(userId: string) {
  const [progress, recentEvents] = await Promise.all([
    prisma.userProgress.upsert({
      where: { userId },
      update: {},
      create: { userId },
    }),
    prisma.progressEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  return { progress, recentEvents };
}

export async function updateProgressCurrent(userId: string, input: UpdateProgressCurrentInput) {
  return prisma.userProgress.upsert({
    where: { userId },
    update: {
      currentBandId: input.currentBandId ?? undefined,
      currentUnitId: input.currentUnitId ?? undefined,
      currentLessonIdx: input.currentLessonIdx ?? undefined,
    },
    create: {
      userId,
      currentBandId: input.currentBandId ?? null,
      currentUnitId: input.currentUnitId ?? null,
      currentLessonIdx: input.currentLessonIdx ?? null,
    },
  });
}

export async function recordProgressEvent(userId: string, event: ProgressEventInput) {
  return prisma.$transaction(async (tx) => {
    const createdEvent = await tx.progressEvent.create({
      data: {
        userId,
        eventType: event.eventType,
        streakDelta: event.streakDelta,
        payloadJson: event.payloadJson,
      },
    });

    const progress = await tx.userProgress.upsert({
      where: { userId },
      update: {
        streak: { increment: event.streakDelta },
        lastActiveDate: new Date(),
      },
      create: {
        userId,
        streak: Math.max(0, event.streakDelta),
        lastActiveDate: new Date(),
      },
    });

    return { createdEvent, progress };
  });
}
