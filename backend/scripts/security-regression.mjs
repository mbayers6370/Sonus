import assert from 'node:assert/strict';

async function run() {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sonus:sonus_dev_password@localhost:5432/sonus';
  process.env.AUTH_MODE = 'supabase';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-test-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test-key';
  process.env.CORS_ORIGINS = 'https://app.example.com';
  process.env.RATE_LIMIT_MODE = 'memory';
  process.env.RATE_LIMIT_FAIL_OPEN = 'false';
  process.env.TRUST_PROXY = '1';
  process.env.AUTH_COOKIE_NAME = 'sonus_refresh_token';
  process.env.AUTH_COOKIE_SAME_SITE = 'lax';
  process.env.AUTH_COOKIE_SECURE = 'true';

  const { buildServer } = await import('../dist/server.js');
  const { resolveRateLimitIdentity } = await import('../dist/lib/rateLimiter.js');
  const { parseCookies, serializeCookie } = await import('../dist/lib/cookies.js');
  const { readAllowedOrigins } = await import('../dist/lib/originPolicy.js');

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

  const logoutBadOrigin = await app.inject({
    method: 'POST',
    url: '/v1/auth/logout',
    headers: {
      origin: 'https://evil.example.com',
    },
  });
  assert.equal(logoutBadOrigin.statusCode, 403);

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
