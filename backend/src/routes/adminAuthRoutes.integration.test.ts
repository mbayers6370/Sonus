import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import type { PrismaClient } from '@prisma/client';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.AUTH_MODE = process.env.AUTH_MODE || 'mock';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/sonus_test';

const { registerAdminAuthRoutes } = await import('./adminAuthRoutes.js');
const { hashPrivilegedPassword } = await import('../lib/localAuth.js');

type QueryRawImpl = (...args: unknown[]) => Promise<unknown>;
type ExecuteRawImpl = (...args: unknown[]) => Promise<unknown>;

function createThrottle(allowed = true) {
  return {
    check: () => ({ allowed, retryAfterSeconds: 60 }),
    registerFailure: () => undefined,
    registerSuccess: () => undefined,
  };
}

function createDeps(overrides?: {
  queryRaw?: QueryRawImpl;
  executeRaw?: ExecuteRawImpl;
  loginAllowed?: boolean;
}) {
  const queryRaw = overrides?.queryRaw || (async () => []);
  const executeRaw = overrides?.executeRaw || (async () => 0n);

  return {
    allowedOrigins: new Set<string>(),
    prisma: {
      $queryRaw: queryRaw,
      $executeRaw: executeRaw,
    } as unknown as PrismaClient,
    env: {
      DEV_USER_ID: '00000000-0000-4000-8000-000000000001',
    },
    SUPPORT_ADMIN_DUMMY_PASSWORD_HASH:
      'scrypt$131072$8$1$aXGrsBSWzTCAKoc4ZTMS1A$H9xcRZKFNm-b3I231Uyj7vAJ1chWXI2Btvp0_xKzESg',
    SUPPORT_ROOT_ADMIN_USERNAME: 'qa-admin-f8n2x7r1@sonus.test',
    supportAdminLoginThrottle: createThrottle(overrides?.loginAllowed ?? true),
    supportAdminForgotPasswordThrottle: createThrottle(true),
    supportAdminResetWithTokenThrottle: createThrottle(true),
    createSupportAdminResetToken: () => 'reset-token',
    hashSupportAdminResetToken: (token: string) => `hash:${token}`,
    supportAdminSessionExpiry: () => new Date('2026-12-31T00:00:00.000Z'),
    canUseSupportAdminUsername: () => true,
    resolveSupportAdminResetUrlBase: () => 'https://sonuslearning.com',
    requireSupportAdminSession: async () => ({
      username: 'qa-admin-f8n2x7r1@sonus.test',
      sessionId: '00000000-0000-4000-8000-000000000009',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    }),
  };
}

async function withAuthRoutes(
  deps: ReturnType<typeof createDeps>,
  run: (app: Awaited<ReturnType<typeof Fastify>>) => Promise<void>
) {
  const app = Fastify({ logger: false });
  registerAdminAuthRoutes(app, deps);
  try {
    await run(app);
  } finally {
    await app.close();
  }
}

test('support admin login rejects invalid payload', async () => {
  await withAuthRoutes(createDeps(), async (app) => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/auth/login',
      payload: { username: '', password: '' },
    });

    assert.equal(response.statusCode, 400);
    const payload = response.json() as { error?: string };
    assert.equal(payload.error, 'Invalid payload');
  });
});

test('support admin login returns 429 when throttled', async () => {
  await withAuthRoutes(createDeps({ loginAllowed: false }), async (app) => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/auth/login',
      payload: { username: 'qa-admin-f8n2x7r1@sonus.test', password: 'irrelevant' },
    });

    assert.equal(response.statusCode, 429);
    assert.equal(response.headers['retry-after'], '60');
    const payload = response.json() as { error?: string };
    assert.equal(payload.error, 'Too many login attempts. Try again later.');
  });
});

test('support admin login succeeds with valid credentials', async () => {
  const password = 'StrongPass!123';
  const passwordHash = await hashPrivilegedPassword(password);

  await withAuthRoutes(
    createDeps({
      queryRaw: async () => [
        {
          username: 'qa-admin-f8n2x7r1@sonus.test',
          password_hash: passwordHash,
        },
      ],
    }),
    async (app) => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/admin/auth/login',
        payload: { username: 'qa-admin-f8n2x7r1@sonus.test', password },
      });

      assert.equal(response.statusCode, 200);
      const payload = response.json() as {
        ok?: boolean;
        token?: string;
        username?: string;
        expiresAt?: string;
      };
      assert.equal(payload.ok, true);
      assert.equal(typeof payload.token, 'string');
      assert.equal(payload.username, 'qa-admin-f8n2x7r1@sonus.test');
      assert.equal(payload.expiresAt, '2026-12-31T00:00:00.000Z');
    }
  );
});

test('support admin auth me returns 401 without admin session token', async () => {
  await withAuthRoutes(createDeps(), async (app) => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/auth/me',
    });

    assert.equal(response.statusCode, 401);
    const payload = response.json() as { error?: string };
    assert.equal(payload.error, 'Not signed in to support admin');
  });
});

test('support admin auth logout returns ok even when unauthenticated', async () => {
  await withAuthRoutes(createDeps(), async (app) => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/auth/logout',
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json() as { ok?: boolean };
    assert.equal(payload.ok, true);
  });
});
