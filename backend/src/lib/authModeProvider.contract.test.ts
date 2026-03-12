import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthModeProvider } from './authModeProvider.js';

test('all auth mode providers expose the same interface surface', () => {
  for (const mode of ['mock', 'local', 'supabase'] as const) {
    const provider = createAuthModeProvider(mode);
    assert.equal(typeof provider.emailExists, 'function');
    assert.equal(typeof provider.signup, 'function');
    assert.equal(typeof provider.login, 'function');
    assert.equal(typeof provider.requestPasswordReset, 'function');
    assert.equal(typeof provider.resetPassword, 'function');
    assert.equal(typeof provider.refresh, 'function');
    assert.equal(typeof provider.logout, 'function');
  }
});

test('non-local providers report password-reset unsupported consistently', async () => {
  const mockProvider = createAuthModeProvider('mock');
  const supabaseProvider = createAuthModeProvider('supabase');

  const [mockResult, supabaseResult] = await Promise.all([
    mockProvider.resetPassword({
      token: 'invalid-token',
      password: 'ExamplePass!123',
      now: new Date(),
    }),
    supabaseProvider.resetPassword({
      token: 'invalid-token',
      password: 'ExamplePass!123',
      now: new Date(),
    }),
  ]);

  assert.equal(mockResult.ok, false);
  if (!mockResult.ok) {
    assert.equal(mockResult.status, 400);
    assert.match(mockResult.error, /local auth mode/i);
  }

  assert.equal(supabaseResult.ok, false);
  if (!supabaseResult.ok) {
    assert.equal(supabaseResult.status, 400);
    assert.match(supabaseResult.error, /local auth mode/i);
  }
});

test('mock provider refresh reports standardized unsupported response', async () => {
  const provider = createAuthModeProvider('mock');
  const result = await provider.refresh({
    refreshToken: 'mock-token',
    client: { ip: null, userAgent: null },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'refresh_not_supported');
    assert.equal(result.status, 400);
    assert.equal(result.clearCookies, false);
  }
});
