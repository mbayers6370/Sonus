import { env } from '../env.js';
import { prisma } from '../lib/prisma.js';

const PRUNE_TRIGGER_PROBABILITY = 0.03;
const MIN_PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const lastPruneAtByUserId = new Map<string, number>();

export async function pruneOldLearningAttempts(userId: string) {
  const retentionDays = env.LEARNING_ATTEMPT_RETENTION_DAYS;
  if (retentionDays <= 0) return;

  const nowMs = Date.now();
  const lastPruneAt = lastPruneAtByUserId.get(userId) || 0;
  if (nowMs - lastPruneAt < MIN_PRUNE_INTERVAL_MS) return;
  if (Math.random() > PRUNE_TRIGGER_PROBABILITY) return;

  lastPruneAtByUserId.set(userId, nowMs);
  const cutoff = new Date(nowMs - retentionDays * 86_400_000);

  await prisma.$transaction([
    prisma.quizAttempt.deleteMany({
      where: {
        userId,
        createdAt: { lt: cutoff },
      },
    }),
    prisma.speakAttempt.deleteMany({
      where: {
        userId,
        createdAt: { lt: cutoff },
      },
    }),
  ]);
}
