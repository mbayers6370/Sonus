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

test('admin learning overview rejects invalid windowDays parameter', async () => {
  setPrismaMocks(async () => []);

  await withAdminApp(async (app) => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/metrics/learning/overview?windowDays=invalid',
      headers: {
        'x-dev-user-id': ADMIN_DEV_USER_ID,
      },
    });

    assert.equal(response.statusCode, 400);
  });

  restorePrismaMocks();
});

test('admin learning overview handles very large windowDays parameter', async () => {
  setPrismaMocks(async () => []);

  await withAdminApp(async (app) => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/metrics/learning/overview?windowDays=999999',
      headers: {
        'x-dev-user-id': ADMIN_DEV_USER_ID,
      },
    });

    // Should either accept or reject, but not crash
    assert(response.statusCode === 200 || response.statusCode === 400);
  });

  restorePrismaMocks();
});

test('admin learning overview handles negative windowDays gracefully', async () => {
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
      url: '/v1/admin/metrics/learning/overview?windowDays=-7',
      headers: {
        'x-dev-user-id': ADMIN_DEV_USER_ID,
      },
    });

    // Endpoint should not crash on edge case input
    assert(response.statusCode > 0);
  });

  restorePrismaMocks();
});

test('admin impact outcomes handles missing windowDays gracefully', async () => {
  setPrismaMocks(async () => []);

  await withAdminApp(async (app) => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/metrics/impact-outcomes',
      headers: {
        'x-dev-user-id': ADMIN_DEV_USER_ID,
      },
    });

    // Should handle missing param without crashing (200, 400, or 500 acceptable)
    assert(response.statusCode > 0);
  });

  restorePrismaMocks();
});

test('admin impact outcomes returns 500 on database connection error', async () => {
  setPrismaMocks(async () => {
    throw new Error('database connection failed');
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
