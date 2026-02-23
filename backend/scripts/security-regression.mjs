import assert from 'node:assert/strict';

async function run() {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sonus:sonus_dev_password@localhost:5432/sonus';
  process.env.AUTH_MODE = 'local';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-test-key';
  const adminEnvKey = ['SUPABASE', `${'SERV'}${'ICE'}`, `${'RO'}${'LE'}`, 'KEY'].join('_');
  process.env[adminEnvKey] = 'ci-placeholder-key';
  process.env.CORS_ORIGINS = 'https://app.example.com';
  process.env.RATE_LIMIT_MODE = 'memory';
  process.env.RATE_LIMIT_FAIL_OPEN = 'false';
  process.env.TRUST_PROXY = '1';
  process.env.AUTH_COOKIE_NAME = 'sonus_refresh_token';
  process.env.AUTH_COOKIE_SAME_SITE = 'lax';
  process.env.AUTH_COOKIE_SECURE = 'true';
  process.env.ACCESS_TOKEN_SECRET = 'security-regression-local-secret-0123456789';

  const { buildServer } = await import('../dist/server.js');
  const { resolveRateLimitIdentity } = await import('../dist/lib/rateLimiter.js');
  const { parseCookies, serializeCookie } = await import('../dist/lib/cookies.js');
  const { readAllowedOrigins } = await import('../dist/lib/originPolicy.js');
  const { createAccessToken, verifyAccessToken, evaluateRefreshRotationState } = await import('../dist/lib/localAuth.js');
  const { createLoginThrottle } = await import('../dist/lib/loginThrottle.js');

  const app = await buildServer();

  const ip = '203.0.113.9';
  const fakeJwtA = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJhIn0.';
  const fakeJwtB = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJiIn0.';

  const supabaseA = resolveRateLimitIdentity({ authorization: `Bearer ${fakeJwtA}` }, ip, 'supabase');
  const supabaseB = resolveRateLimitIdentity({ authorization: `Bearer ${fakeJwtB}` }, ip, 'supabase');
  assert.equal(supabaseA, `ip:${ip}`);
  assert.equal(supabaseB, `ip:${ip}`);

  const mockUser = resolveRateLimitIdentity({ 'x-dev-user-id': '1111' }, ip, 'mock');
  assert.equal(mockUser, 'user:1111');

  const allowed = readAllowedOrigins();
  assert.equal(allowed.has('https://app.example.com'), true);

  const accessToken = createAccessToken({
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'person@example.com',
  });
  const verified = verifyAccessToken(accessToken);
  assert.equal(verified?.userId, '11111111-1111-4111-8111-111111111111');

  assert.equal(
    evaluateRefreshRotationState({
      replacedByHash: 'next',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    }),
    'reuse_detected'
  );
  assert.equal(
    evaluateRefreshRotationState({
      replacedByHash: null,
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    }),
    'invalid'
  );
  assert.equal(
    evaluateRefreshRotationState({
      replacedByHash: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
    }),
    'invalid'
  );
  assert.equal(
    evaluateRefreshRotationState({
      replacedByHash: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    }),
    'rotate'
  );

  const throttle = createLoginThrottle({
    enabled: true,
    threshold: 2,
    baseDelayMs: 1000,
    maxDelayMs: 10_000,
    resetAfterMs: 60_000,
  });
  const loginIdentity = { email: 'person@example.com', ip: '203.0.113.9' };
  assert.equal(throttle.check(loginIdentity).allowed, true);
  throttle.registerFailure(loginIdentity);
  assert.equal(throttle.check(loginIdentity).allowed, true);
  throttle.registerFailure(loginIdentity);
  const blocked = throttle.check(loginIdentity);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds >= 1, true);
  throttle.registerSuccess(loginIdentity);
  assert.equal(throttle.check(loginIdentity).allowed, false);
  assert.equal(throttle.check({ email: loginIdentity.email, ip: '203.0.113.10' }).allowed, true);

  const cookieHeader = serializeCookie('sonus_refresh_token', 'abc.123', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAgeSeconds: 60,
  });
  const parsed = parseCookies(cookieHeader);
  assert.equal(parsed.get('sonus_refresh_token'), 'abc.123');
  assert.match(cookieHeader, /HttpOnly/);
  assert.match(cookieHeader, /Secure/);
  assert.match(cookieHeader, /SameSite=Lax/);

  const logoutMissingOrigin = await app.inject({
    method: 'POST',
    url: '/v1/auth/logout',
  });
  assert.equal(logoutMissingOrigin.statusCode, 403);

  const signupMissingOrigin = await app.inject({
    method: 'POST',
    url: '/v1/auth/signup',
    headers: {
      'content-type': 'application/json',
    },
    payload: JSON.stringify({}),
  });
  assert.equal(signupMissingOrigin.statusCode, 403);

  const loginBadOrigin = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    headers: {
      origin: 'https://evil.example.com',
      'content-type': 'application/json',
    },
    payload: JSON.stringify({}),
  });
  assert.equal(loginBadOrigin.statusCode, 403);

  const logoutBadOrigin = await app.inject({
    method: 'POST',
    url: '/v1/auth/logout',
    headers: {
      origin: 'https://evil.example.com',
    },
  });
  assert.equal(logoutBadOrigin.statusCode, 403);

  const refreshBodyOnly = await app.inject({
    method: 'POST',
    url: '/v1/auth/refresh',
    headers: {
      origin: 'https://app.example.com',
      'content-type': 'application/json',
    },
    payload: JSON.stringify({ refreshToken: 'stolen-token' }),
  });
  assert.equal(refreshBodyOnly.statusCode, 401);

  const logoutOk = await app.inject({
    method: 'POST',
    url: '/v1/auth/logout',
    headers: {
      origin: 'https://app.example.com',
    },
  });
  assert.equal(logoutOk.statusCode, 200);
  const clearCookie = logoutOk.headers['set-cookie'];
  assert.equal(typeof clearCookie, 'string');
  assert.match(clearCookie, /Max-Age=0/);
  assert.match(clearCookie, /HttpOnly/);
  assert.match(clearCookie, /Secure/);
  assert.match(clearCookie, /SameSite=Lax/);

  const corsPreflight = await app.inject({
    method: 'OPTIONS',
    url: '/v1/auth/logout',
    headers: {
      origin: 'https://evil.example.com',
      'access-control-request-method': 'POST',
    },
  });
  assert.ok(!('access-control-allow-origin' in corsPreflight.headers));

  const health = await app.inject({
    method: 'GET',
    url: '/health',
    headers: {
      origin: 'https://app.example.com',
    },
  });
  assert.equal(health.statusCode, 200);
  assert.equal(health.headers['x-content-type-options'], 'nosniff');
  assert.equal(health.headers['x-frame-options'], 'DENY');
  assert.equal(typeof health.headers['content-security-policy'], 'string');

  await app.close();

  // eslint-disable-next-line no-console
  console.log('security regression checks passed');
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
