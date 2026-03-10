import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://sonus:sonus_dev_password@localhost:5432/sonus';
const SIGNUP_PASSWORD = 'ExamplePass!123';
const LEGAL_ACCEPTANCE = {
  termsVersion: '2026-03-08',
  privacyVersion: '2026-03-07',
  termsAccepted: true,
  privacyAccepted: true,
  ageConfirmed: true,
};

function resolveDatabaseAddress(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
      return null;
    }
    return {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? Number(parsed.port) : 5432,
    };
  } catch {
    return null;
  }
}

function canReachDatabase(databaseUrl, timeoutMs = 1200) {
  const address = resolveDatabaseAddress(databaseUrl);
  if (!address) return false;

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(address.port, address.host);
  });
}

function parseCookieValue(setCookieHeader, name) {
  const values = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : typeof setCookieHeader === 'string'
      ? [setCookieHeader]
      : [];
  for (const cookieHeader of values) {
    const firstPart = cookieHeader.split(';')[0] || '';
    const [cookieName, ...rest] = firstPart.split('=');
    if (cookieName !== name) continue;
    return rest.join('=') || null;
  }
  return null;
}

async function withServer(envOverrides, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(envOverrides)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }

  const { buildServer } = await import('../dist/server.js');
  const app = await buildServer();
  try {
    await fn(app);
  } finally {
    await app.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function runMockAuthChecks() {
  const email = `mock-mode-${Date.now()}@local.test`;
  await withServer(
    {
      NODE_ENV: 'test',
      DATABASE_URL,
      AUTH_MODE: 'mock',
      DEV_USER_ID: '00000000-0000-4000-8000-000000000001',
      DEV_USER_EMAIL: 'dev@local.test',
      CORS_ORIGINS: 'https://app.example.com',
      RATE_LIMIT_MODE: 'memory',
      RATE_LIMIT_FAIL_OPEN: 'false',
      TRUST_PROXY: 'false',
      LOGIN_THROTTLE_ENABLED: 'true',
    },
    async (app) => {
      const signup = await app.inject({
        method: 'POST',
        url: '/v1/auth/signup',
        headers: {
          origin: 'https://app.example.com',
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          email,
          password: SIGNUP_PASSWORD,
          firstName: 'Mock',
          lastName: 'User',
          legalAcceptance: LEGAL_ACCEPTANCE,
        }),
      });
      assert.equal(signup.statusCode, 200, `mock signup failed: ${signup.body}`);

      const login = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        headers: {
          origin: 'https://app.example.com',
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          email,
          password: 'anything-goes-in-mock',
        }),
      });
      assert.equal(login.statusCode, 200, `mock login failed: ${login.body}`);

      const refresh = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        headers: {
          origin: 'https://app.example.com',
          'content-type': 'application/json',
        },
        payload: JSON.stringify({}),
      });
      assert.equal(
        refresh.statusCode,
        401,
        `mock refresh should fail without cookie: ${refresh.body}`
      );
    }
  );
}

async function runLocalAuthChecks() {
  const email = `local-mode-${Date.now()}@local.test`;
  const cookieName = 'sonus_refresh_token';

  await withServer(
    {
      NODE_ENV: 'test',
      DATABASE_URL,
      AUTH_MODE: 'local',
      ACCESS_TOKEN_SECRET: 'boundary-test-local-secret-0123456789',
      ACCESS_TOKEN_TTL_SECONDS: '900',
      REFRESH_SESSION_TTL_DAYS: '30',
      AUTH_COOKIE_NAME: cookieName,
      AUTH_COOKIE_SAME_SITE: 'lax',
      CORS_ORIGINS: 'https://app.example.com',
      RATE_LIMIT_MODE: 'memory',
      RATE_LIMIT_FAIL_OPEN: 'false',
      TRUST_PROXY: 'false',
      LOGIN_THROTTLE_ENABLED: 'true',
    },
    async (app) => {
      const signup = await app.inject({
        method: 'POST',
        url: '/v1/auth/signup',
        headers: {
          origin: 'https://app.example.com',
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          email,
          password: SIGNUP_PASSWORD,
          firstName: 'Local',
          lastName: 'User',
          legalAcceptance: LEGAL_ACCEPTANCE,
        }),
      });
      assert.equal(signup.statusCode, 200, `local signup failed: ${signup.body}`);
      const signupCookie = signup.headers['set-cookie'];
      const refreshToken = parseCookieValue(signupCookie, cookieName);
      assert.equal(Boolean(refreshToken), true, 'refresh token missing in signup cookie');

      const login = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        headers: {
          origin: 'https://app.example.com',
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          email,
          password: SIGNUP_PASSWORD,
        }),
      });
      assert.equal(login.statusCode, 200, `local login failed: ${login.body}`);

      const refresh = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        headers: {
          origin: 'https://app.example.com',
          'content-type': 'application/json',
          cookie: `${cookieName}=${refreshToken}`,
        },
        payload: JSON.stringify({}),
      });
      assert.equal(refresh.statusCode, 200, `local refresh failed: ${refresh.body}`);

      const logout = await app.inject({
        method: 'POST',
        url: '/v1/auth/logout',
        headers: {
          origin: 'https://app.example.com',
          cookie: `${cookieName}=${refreshToken}`,
        },
      });
      assert.equal(logout.statusCode, 200, `local logout failed: ${logout.body}`);
    }
  );
}

async function main() {
  const dbReachable = await canReachDatabase(DATABASE_URL);
  const modeFlagIndex = process.argv.findIndex((item) => item === '--mode');
  const mode = modeFlagIndex >= 0 ? process.argv[modeFlagIndex + 1] : null;

  if (mode === 'mock') {
    if (!dbReachable) {
      // eslint-disable-next-line no-console
      console.log('auth mode boundary checks skipped (mock): database is not reachable');
      return;
    }
    await runMockAuthChecks();
    // eslint-disable-next-line no-console
    console.log('auth mode boundary checks passed (mock)');
    return;
  }

  if (mode === 'local') {
    if (!dbReachable) {
      // eslint-disable-next-line no-console
      console.log('auth mode boundary checks skipped (local): database is not reachable');
      return;
    }
    await runLocalAuthChecks();
    // eslint-disable-next-line no-console
    console.log('auth mode boundary checks passed (local)');
    return;
  }

  for (const nextMode of ['mock', 'local']) {
    const child = spawnSync(
      process.execPath,
      [fileURLToPath(import.meta.url), '--mode', nextMode],
      {
        stdio: 'inherit',
        env: process.env,
      }
    );
    if (child.status !== 0) {
      process.exit(child.status ?? 1);
    }
  }
  // eslint-disable-next-line no-console
  console.log('auth mode boundary checks passed');
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
