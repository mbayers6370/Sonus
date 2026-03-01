import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { SharedUserProgress } from '../types.js';

type UpdateProgressCurrentInput = Partial<
  Pick<SharedUserProgress, 'currentBandId' | 'currentUnitId' | 'currentLessonIdx'>
>;

interface ProgressEventInput {
  eventType:
    | 'lesson_started'
    | 'lesson_completed'
    | 'apply_completed'
    | 'quiz_answered'
    | 'speak_scored'
    | 'manual_adjustment';
  streakDelta: number;
  payloadJson?: Prisma.JsonObject;
}

type LessonProgressState = {
  introViewed: boolean;
  quizScore: number | null;
  speakScore: number | null;
  speakAllCorrect: boolean;
  completed: boolean;
  mastered: boolean;
};

function isCompletedByScores(quizScore: number | null, speakScore: number | null) {
  return (quizScore ?? 0) >= 85 && (speakScore ?? 0) >= 85;
}

function isCompletedLessonPayload(
  payloadJson: Prisma.JsonValue | Prisma.JsonObject | undefined | null
) {
  if (!payloadJson || typeof payloadJson !== 'object' || Array.isArray(payloadJson)) return false;
  const payload = payloadJson as Record<string, unknown>;
  if (payload.completed) return true;
  const quizScore = toOptionalScore(payload.quizScore);
  const speakScore = toOptionalScore(payload.speakScore);
  return isCompletedByScores(quizScore, speakScore);
}

function lessonKeyFromPayload(
  payloadJson: Prisma.JsonValue | Prisma.JsonObject | undefined | null
) {
  if (!payloadJson || typeof payloadJson !== 'object' || Array.isArray(payloadJson)) return null;
  const payload = payloadJson as Record<string, unknown>;
  const bandId = typeof payload.bandId === 'string' ? payload.bandId.trim() : '';
  const unitId = typeof payload.unitId === 'string' ? payload.unitId.trim() : '';
  const lessonIndex =
    typeof payload.lessonIndex === 'number' && Number.isInteger(payload.lessonIndex)
      ? payload.lessonIndex
      : null;
  if (!bandId || !unitId || lessonIndex === null || lessonIndex < 0) return null;
  return `${bandId}:${unitId}:${lessonIndex}`;
}

function toOptionalScore(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 0) return 0;
  if (rounded > 100) return 100;
  return rounded;
}

function mergeLessonState(
  existing: LessonProgressState | undefined,
  incoming: LessonProgressState
) {
  if (!existing) return incoming;
  const mergedQuiz =
    existing.quizScore === null
      ? incoming.quizScore
      : incoming.quizScore === null
        ? existing.quizScore
        : Math.max(existing.quizScore, incoming.quizScore);
  const mergedSpeak =
    existing.speakScore === null
      ? incoming.speakScore
      : incoming.speakScore === null
        ? existing.speakScore
        : Math.max(existing.speakScore, incoming.speakScore);
  const completed =
    existing.completed || incoming.completed || isCompletedByScores(mergedQuiz, mergedSpeak);
  return {
    introViewed: existing.introViewed || incoming.introViewed,
    quizScore: mergedQuiz,
    speakScore: mergedSpeak,
    speakAllCorrect: existing.speakAllCorrect || incoming.speakAllCorrect,
    completed,
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
    const quizScore = toOptionalScore(record.quizScore);
    const speakScore = toOptionalScore(record.speakScore);
    const completed = Boolean(record.completed) || isCompletedByScores(quizScore, speakScore);
    const incoming: LessonProgressState = {
      introViewed: Boolean(record.introViewed),
      quizScore,
      speakScore,
      speakAllCorrect: Boolean(record.speakAllCorrect),
      completed,
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

function resolveCompletionStreak(
  completionDayKeys: Set<string>,
  timezone: string,
  now = new Date()
) {
  const today = dayKeyAt(now, timezone);
  const yesterday = dayKeyAt(new Date(now.getTime() - 86_400_000), timezone);
  const anchor = completionDayKeys.has(today)
    ? now
    : completionDayKeys.has(yesterday)
      ? new Date(now.getTime() - 86_400_000)
      : null;
  if (!anchor) return 0;

  let streak = 0;
  let cursor = anchor;
  while (true) {
    const key = dayKeyAt(cursor, timezone);
    if (!completionDayKeys.has(key)) break;
    streak += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return streak;
}

export async function touchUserActivity(userId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.profile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

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

    const previousStreak = resolveStreakForToday(
      existing?.streak ?? 0,
      existing?.lastActiveDate ?? null,
      timezone
    );
    const lastKey = existing?.lastActiveDate ? dayKeyAt(existing.lastActiveDate, timezone) : null;

    const nextStreak = !lastKey
      ? 1
      : lastKey === todayKey
        ? previousStreak
        : dayDiff(lastKey, todayKey) === 1
          ? previousStreak + 1
          : 1;

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
  await prisma.profile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  const [timezone, progressSeed, recentEvents, lessonCompletionEvents, recentLessonCompletions] =
    await Promise.all([
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
        where: { userId, eventType: { in: ['lesson_completed', 'apply_completed'] } },
        select: { payloadJson: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.progressEvent.findMany({
        where: {
          userId,
          eventType: { in: ['lesson_completed', 'apply_completed'] },
          createdAt: { gte: new Date(Date.now() - 35 * 86_400_000) },
        },
        select: { createdAt: true, payloadJson: true },
      }),
    ]);

  const streak = resolveStreakForToday(progressSeed.streak, progressSeed.lastActiveDate, timezone);
  const progress =
    streak === progressSeed.streak
      ? progressSeed
      : await prisma.userProgress.update({
          where: { userId },
          data: { streak: 0 },
        });
  const lessonCompletionSetsByDay = new Map<string, Set<string>>();
  for (const row of recentLessonCompletions) {
    if (!isCompletedLessonPayload(row.payloadJson)) continue;
    const lessonKey = lessonKeyFromPayload(row.payloadJson);
    if (!lessonKey) continue;
    const key = dayKeyAt(row.createdAt, timezone);
    const existing = lessonCompletionSetsByDay.get(key) ?? new Set<string>();
    existing.add(lessonKey);
    lessonCompletionSetsByDay.set(key, existing);
  }
  const lessonCompletionsByDay = new Map<string, number>();
  for (const [dayKey, lessonKeys] of lessonCompletionSetsByDay.entries()) {
    lessonCompletionsByDay.set(dayKey, lessonKeys.size);
  }
  const completionStreak = resolveCompletionStreak(
    new Set(lessonCompletionsByDay.keys()),
    timezone
  );
  const streakWithCompletions = Math.max(progress.streak, completionStreak);
  const normalizedProgress =
    streakWithCompletions === progress.streak
      ? progress
      : await prisma.userProgress.update({
          where: { userId },
          data: { streak: streakWithCompletions },
        });
  const lessonProgress = buildLessonProgressFromEvents(lessonCompletionEvents);

  return {
    progress: normalizedProgress,
    recentEvents,
    lessonProgress,
  };
}

export async function updateProgressCurrent(userId: string, input: UpdateProgressCurrentInput) {
  await prisma.profile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

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
    await tx.profile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

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

    const baseStreak = resolveStreakForToday(
      existing?.streak ?? 0,
      existing?.lastActiveDate ?? null,
      timezone
    );
    const now = new Date();
    const todayKey = dayKeyAt(now, timezone);
    const lastKey = existing?.lastActiveDate ? dayKeyAt(existing.lastActiveDate, timezone) : null;

    const countsAsCompletedLesson =
      (event.eventType === 'lesson_completed' || event.eventType === 'apply_completed') &&
      isCompletedLessonPayload(event.payloadJson);

    const nextStreak = (() => {
      if (!countsAsCompletedLesson) {
        return Math.max(0, baseStreak + event.streakDelta);
      }
      if (!lastKey) return 1;
      if (lastKey === todayKey) return Math.max(1, baseStreak);
      const gap = dayDiff(lastKey, todayKey);
      if (gap === 1) return Math.max(1, baseStreak) + 1;
      return 1;
    })();

    const progress = await tx.userProgress.upsert({
      where: { userId },
      update: {
        streak: nextStreak,
        lastActiveDate: countsAsCompletedLesson ? now : (existing?.lastActiveDate ?? null),
      },
      create: {
        userId,
        streak: nextStreak,
        lastActiveDate: countsAsCompletedLesson ? now : null,
      },
    });

    return { createdEvent, progress };
  });
}
