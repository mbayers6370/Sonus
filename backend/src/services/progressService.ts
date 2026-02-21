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

type SevenDayActivity = {
  dayKey: string;
  active: boolean;
};

type LessonProgressState = {
  introViewed: boolean;
  quizScore: number | null;
  speakScore: number | null;
  speakAllCorrect: boolean;
  completed: boolean;
  mastered: boolean;
};

function toOptionalScore(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 0) return 0;
  if (rounded > 100) return 100;
  return rounded;
}

function mergeLessonState(existing: LessonProgressState | undefined, incoming: LessonProgressState) {
  if (!existing) return incoming;
  return {
    introViewed: existing.introViewed || incoming.introViewed,
    quizScore:
      existing.quizScore === null
        ? incoming.quizScore
        : incoming.quizScore === null
          ? existing.quizScore
          : Math.max(existing.quizScore, incoming.quizScore),
    speakScore:
      existing.speakScore === null
        ? incoming.speakScore
        : incoming.speakScore === null
          ? existing.speakScore
          : Math.max(existing.speakScore, incoming.speakScore),
    speakAllCorrect: existing.speakAllCorrect || incoming.speakAllCorrect,
    completed: existing.completed || incoming.completed,
    mastered: existing.mastered || incoming.mastered,
  };
}

function buildLessonProgressFromEvents(
  events: Array<{ payloadJson: Prisma.JsonValue | null }>
): Record<string, LessonProgressState> {
  const lessonProgress: Record<string, LessonProgressState> = {};

  for (const event of events) {
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

    const key = `${bandId}:${unitId}:${lessonIndex}`;
    const incoming: LessonProgressState = {
      introViewed: Boolean(record.introViewed),
      quizScore: toOptionalScore(record.quizScore),
      speakScore: toOptionalScore(record.speakScore),
      speakAllCorrect: Boolean(record.speakAllCorrect),
      completed: Boolean(record.completed),
      mastered: Boolean(record.mastered),
    };

    lessonProgress[key] = mergeLessonState(lessonProgress[key], incoming);
  }

  return lessonProgress;
}

function resolveTimezone(timezone: string | null | undefined) {
  if (!timezone) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return 'UTC';
  }
}

function dayKeyAt(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function dayDiff(fromDayKey: string, toDayKey: string) {
  const from = Date.parse(`${fromDayKey}T00:00:00.000Z`);
  const to = Date.parse(`${toDayKey}T00:00:00.000Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

function resolveStreakForToday(streak: number, lastActiveDate: Date | null, timezone: string) {
  if (!lastActiveDate) return streak;
  const todayKey = dayKeyAt(new Date(), timezone);
  const lastKey = dayKeyAt(lastActiveDate, timezone);
  const gap = dayDiff(lastKey, todayKey);
  // Keep streak when active today or yesterday. Reset when at least one full day was missed.
  if (gap <= 1) return streak;
  return 0;
}

async function readUserTimezone(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  return resolveTimezone(profile?.timezone);
}

async function collectActivityDayKeys(userId: string, timezone: string) {
  const since = new Date(Date.now() - 10 * 86_400_000);
  const [quizAttempts, speakAttempts, progressEvents] = await Promise.all([
    prisma.quizAttempt.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.speakAttempt.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.progressEvent.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  const keys = new Set<string>();
  for (const row of quizAttempts) keys.add(dayKeyAt(row.createdAt, timezone));
  for (const row of speakAttempts) keys.add(dayKeyAt(row.createdAt, timezone));
  for (const row of progressEvents) keys.add(dayKeyAt(row.createdAt, timezone));
  return keys;
}

function buildSevenDayActivity(activeDayKeys: Set<string>, timezone: string): SevenDayActivity[] {
  const days: SevenDayActivity[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 86_400_000);
    const dayKey = dayKeyAt(date, timezone);
    days.push({
      dayKey,
      active: activeDayKeys.has(dayKey),
    });
  }
  return days;
}

export async function touchUserActivity(userId: string) {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.profile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    const timezone = resolveTimezone(profile?.timezone);
    const now = new Date();
    const todayKey = dayKeyAt(now, timezone);

    const existing = await tx.userProgress.findUnique({
      where: { userId },
      select: { streak: true, lastActiveDate: true },
    });

    const previousStreak = resolveStreakForToday(existing?.streak ?? 0, existing?.lastActiveDate ?? null, timezone);
    const lastKey = existing?.lastActiveDate ? dayKeyAt(existing.lastActiveDate, timezone) : null;

    let nextStreak = previousStreak;
    if (!lastKey) {
      nextStreak = 1;
    } else if (lastKey === todayKey) {
      nextStreak = previousStreak;
    } else {
      const gap = dayDiff(lastKey, todayKey);
      nextStreak = gap === 1 ? previousStreak + 1 : 1;
    }

    return tx.userProgress.upsert({
      where: { userId },
      update: {
        streak: nextStreak,
        lastActiveDate: now,
      },
      create: {
        userId,
        streak: 1,
        lastActiveDate: now,
      },
    });
  });
}

export async function getProgressSnapshot(userId: string) {
  const [timezone, progressSeed, recentEvents, lessonCompletionEvents] = await Promise.all([
    readUserTimezone(userId),
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
    prisma.progressEvent.findMany({
      where: { userId, eventType: 'lesson_completed' },
      select: { payloadJson: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const streak = resolveStreakForToday(progressSeed.streak, progressSeed.lastActiveDate, timezone);
  const progress = streak === progressSeed.streak
    ? progressSeed
    : await prisma.userProgress.update({
      where: { userId },
      data: { streak: 0 },
    });
  const activeDayKeys = await collectActivityDayKeys(userId, timezone);
  const sevenDayActivity = buildSevenDayActivity(activeDayKeys, timezone);
  const lessonProgress = buildLessonProgressFromEvents(lessonCompletionEvents);

  return { progress, recentEvents, sevenDayActivity, lessonProgress };
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
    const profile = await tx.profile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    const timezone = resolveTimezone(profile?.timezone);

    const createdEvent = await tx.progressEvent.create({
      data: {
        userId,
        eventType: event.eventType,
        streakDelta: event.streakDelta,
        payloadJson: event.payloadJson,
      },
    });

    const existing = await tx.userProgress.findUnique({
      where: { userId },
      select: { streak: true, lastActiveDate: true },
    });

    const baseStreak = resolveStreakForToday(existing?.streak ?? 0, existing?.lastActiveDate ?? null, timezone);
    const nextStreak = Math.max(0, baseStreak + event.streakDelta);

    const progress = await tx.userProgress.upsert({
      where: { userId },
      update: {
        streak: nextStreak,
        lastActiveDate: new Date(),
      },
      create: {
        userId,
        streak: nextStreak,
        lastActiveDate: new Date(),
      },
    });

    return { createdEvent, progress };
  });
}
