import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.AUTH_MODE = process.env.AUTH_MODE || 'mock';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/sonus_test';

const ADMIN_DEV_USER_ID = '00000000-0000-4000-8000-000000000001';

const { prisma } = await import('../lib/prisma.js');
const { adminRoutes } = await import('./admin.js');

type QueryRawImpl = (...args: unknown[]) => Promise<unknown>;
type ExecuteRawImpl = (...args: unknown[]) => Promise<unknown>;

const originalQueryRaw = prisma.$queryRaw as unknown as QueryRawImpl;
const originalExecuteRaw = prisma.$executeRaw as unknown as ExecuteRawImpl;

async function withAdminApp(run: (app: Awaited<ReturnType<typeof Fastify>>) => Promise<void>) {
  const app = Fastify({ logger: false });
  await adminRoutes(app);
  try {
    await run(app);
  } finally {
    await app.close();
  }
}

function setPrismaMocks(queryImpl: QueryRawImpl, executeImpl?: ExecuteRawImpl) {
  prisma.$queryRaw = queryImpl as typeof prisma.$queryRaw;
  prisma.$executeRaw = (executeImpl || (async () => 0n)) as typeof prisma.$executeRaw;
}

function restorePrismaMocks() {
  prisma.$queryRaw = originalQueryRaw as typeof prisma.$queryRaw;
  prisma.$executeRaw = originalExecuteRaw as typeof prisma.$executeRaw;
}

test('admin learning overview returns computed aggregate metrics', async () => {
  setPrismaMocks(async () => [
    {
      quizAttempts: 20n,
      quizCorrect: 15n,
      speakAttempts: 10n,
      speakPassed: 4n,
      lessonStartsTracked: 7n,
      lessonStartsInferred: 9n,
      lessonStarts: 9n,
      lessonCompleted: 6n,
    },
  ]);

  await withAdminApp(async (app) => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/metrics/learning/overview?windowDays=7',
      headers: {
        'x-dev-user-id': ADMIN_DEV_USER_ID,
      },
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json() as {
      learning: {
        quizAttempts: number;
        quizAccuracyPct: number;
        speakPassPct: number;
        lessonCompletionPct: number;
        lessonStarts: number;
        lessonCompleted: number;
      };
    };

    assert.equal(payload.learning.quizAttempts, 20);
    assert.equal(payload.learning.quizAccuracyPct, 75);
    assert.equal(payload.learning.speakPassPct, 40);
    assert.equal(payload.learning.lessonStarts, 9);
    assert.equal(payload.learning.lessonCompleted, 6);
    assert.equal(payload.learning.lessonCompletionPct, 66.67);
  });

  restorePrismaMocks();
});

test('admin impact outcomes returns computed metrics when all query blocks succeed', async () => {
  let queryCall = 0;
  setPrismaMocks(async () => {
    queryCall += 1;
    switch (queryCall) {
      case 1:
        return [
          {
            cohortWeek: '2026-03-09',
            signups: 8n,
            eligibleD1: 8n,
            retainedD1: 6n,
            eligibleD7: 5n,
            retainedD7: 3n,
            eligibleD30: 2n,
            retainedD30: 1n,
          },
        ];
      case 2:
        return [
          {
            sampleSize: 8n,
            reachedLessonComplete: 4n,
            reachedSpeakPass: 3n,
            reachedMastery: 1n,
            medianDaysToLessonComplete: 2.5,
            medianDaysToSpeakPass: 3.5,
            medianDaysToMastery: 9,
          },
        ];
      case 3:
        return [
          {
            firstQuizAttempts: 10n,
            firstQuizCorrect: 7n,
            firstQuizSessions: 5n,
            firstQuizSessionsCompleted: 3n,
            secondQuizAttempts: 20n,
            secondQuizCorrect: 16n,
            secondQuizSessions: 8n,
            secondQuizSessionsCompleted: 6n,
            firstSpeakAttempts: 5n,
            firstSpeakPasses: 2n,
            firstSpeakSessions: 3n,
            firstSpeakSessionsCompleted: 1n,
            secondSpeakAttempts: 10n,
            secondSpeakPasses: 8n,
            secondSpeakSessions: 4n,
            secondSpeakSessionsCompleted: 3n,
            firstLessonsCompleted: 4n,
            secondLessonsCompleted: 10n,
            firstActiveUsers: 4n,
            secondActiveUsers: 5n,
          },
        ];
      case 4:
        return [
          {
            activeUsers: 6n,
            active3PlusDays: 4n,
            active7PlusDays: 2n,
            avgActiveDays: 4.25,
          },
        ];
      case 5:
        return [{ bucket: '3-6', users: 3n }];
      case 6:
        return [
          {
            activeUsers: 6n,
            usersWithMastery: 2n,
            usersWithMasteryInWindow: 1n,
            medianDaysToFirstMastery: 12,
          },
        ];
      case 7:
        return [
          {
            activeUsers: 6n,
            avgNeedsWork: 2.8,
            medianNeedsWork: 2,
            firstHalfMissesPerActiveUser: 1.2,
            secondHalfMissesPerActiveUser: 0.8,
          },
        ];
      case 8:
        return [
          {
            activeUsers: 6n,
            usersWithNeedsReview: 2n,
            totalNeedsReviewEvents: 4n,
            totalLessonCompletions: 20n,
            avgNeedsReviewEventsPerActiveUser: 0.67,
            medianNeedsReviewEventsPerActiveUser: 0,
            firstHalfNeedsReviewEventsPerActiveUser: 0.5,
            secondHalfNeedsReviewEventsPerActiveUser: 0.3,
          },
        ];
      case 9:
        return [
          {
            languageId: 'ja',
            activeDays: 3,
            lessonsCompleted: 4,
            quizAttempts: 10,
            quizCorrect: 8,
            speakAttempts: 5,
            speakPasses: 4,
            needsWorkCount: 2,
            needsReviewResets: 1,
          },
          {
            languageId: 'ja',
            activeDays: 5,
            lessonsCompleted: 6,
            quizAttempts: 12,
            quizCorrect: 9,
            speakAttempts: 6,
            speakPasses: 5,
            needsWorkCount: 1,
            needsReviewResets: 0,
          },
        ];
      case 10:
        return [{ languageId: 'ja', activeUsers: 6n }];
      default:
        return [];
    }
  });

  await withAdminApp(async (app) => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/metrics/impact-outcomes?windowDays=30',
      headers: {
        'x-dev-user-id': ADMIN_DEV_USER_ID,
      },
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json() as {
      cohorts: Array<{ signups: number; d7Pct: number }>;
      learningGain: {
        firstHalf: { quizAccuracyPct: number; quizSessions: number };
        secondHalf: { quizAccuracyPct: number; quizSessions: number };
      };
      consistency: { activeUsers: number };
      segmentation: { activeUsersByLanguage: Array<{ languageId: string; activeUsers: number }> };
    };

    assert.equal(payload.cohorts[0]?.signups, 8);
    assert.equal(payload.cohorts[0]?.d7Pct, 60);
    assert.equal(payload.learningGain.firstHalf.quizAccuracyPct, 70);
    assert.equal(payload.learningGain.secondHalf.quizAccuracyPct, 80);
    assert.equal(payload.learningGain.firstHalf.quizSessions, 5);
    assert.equal(payload.consistency.activeUsers, 6);
    assert.equal(payload.segmentation.activeUsersByLanguage[0]?.languageId, 'ja');
  });

  restorePrismaMocks();
});

test('admin impact outcomes fails hard when any query block fails', async () => {
  setPrismaMocks(async () => {
    throw new Error('forced query failure');
  });

  await withAdminApp(async (app) => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/metrics/impact-outcomes?windowDays=30',
      headers: {
        'x-dev-user-id': ADMIN_DEV_USER_ID,
      },
    });

    assert.equal(response.statusCode, 500);
    const payload = response.json() as { error?: string };
    assert.equal(payload.error, 'Failed to load impact outcomes metrics.');
  });

  restorePrismaMocks();
});

test('admin deletion cases returns merged case rows', async () => {
  const eventAt = new Date('2026-03-15T09:00:00.000Z');
  setPrismaMocks(async () => [
    {
      sourceType: 'request',
      status: 'open',
      targetUserId: '00000000-0000-4000-8000-000000000123',
      targetEmail: 'learner@example.com',
      targetDisplayName: 'Learner One',
      reason: 'requested by user',
      channel: 'support',
      eventAt,
      detail: null,
    },
  ]);

  await withAdminApp(async (app) => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/metrics/support/deletion-cases?limit=10&q=learner',
      headers: {
        'x-dev-user-id': ADMIN_DEV_USER_ID,
      },
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json() as {
      cases: Array<{
        sourceType: string;
        status: string;
        targetUserId: string;
        targetEmail: string | null;
      }>;
    };

    assert.equal(payload.cases.length, 1);
    assert.equal(payload.cases[0]?.sourceType, 'request');
    assert.equal(payload.cases[0]?.status, 'open');
    assert.equal(payload.cases[0]?.targetUserId, '00000000-0000-4000-8000-000000000123');
    assert.equal(payload.cases[0]?.targetEmail, 'learner@example.com');
  });

  restorePrismaMocks();
});

test('admin deletion cases rejects invalid query', async () => {
  setPrismaMocks(async () => []);

  await withAdminApp(async (app) => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/metrics/support/deletion-cases?limit=0',
      headers: {
        'x-dev-user-id': ADMIN_DEV_USER_ID,
      },
    });

    assert.equal(response.statusCode, 400);
    const payload = response.json() as { error?: string };
    assert.equal(payload.error, 'Invalid query parameters');
  });

  restorePrismaMocks();
});

test('admin weak speak words by language returns normalized metrics', async () => {
  setPrismaMocks(async () => [
    {
      language: 'ja',
      wordId: 'missing-word-id',
      misses: 7n,
      attempts: 11n,
      missRatePct: 63.64,
    },
  ]);

  await withAdminApp(async (app) => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/metrics/learning/weak-speak-words-by-language?windowDays=7&limitPerLanguage=5',
      headers: {
        'x-dev-user-id': ADMIN_DEV_USER_ID,
      },
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json() as {
      windowDays: number;
      limitPerLanguage: number;
      languages: Array<{
        languageId: string;
        hasData: boolean;
        words: Array<{
          wordId: string;
          misses: number;
          attempts: number;
          missRatePct: number;
          nativeText: string;
          englishText: string;
        }>;
      }>;
    };

    assert.equal(payload.windowDays, 7);
    assert.equal(payload.limitPerLanguage, 5);
    const ja = payload.languages.find((entry) => entry.languageId === 'ja');
    assert.equal(ja?.hasData, true);
    assert.equal(ja?.words[0]?.wordId, 'missing-word-id');
    assert.equal(ja?.words[0]?.misses, 7);
    assert.equal(ja?.words[0]?.attempts, 11);
    assert.equal(ja?.words[0]?.missRatePct, 63.64);
    assert.equal(typeof ja?.words[0]?.nativeText, 'string');
    assert.equal(typeof ja?.words[0]?.englishText, 'string');
  });

  restorePrismaMocks();
});
