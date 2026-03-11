#!/usr/bin/env node

const API_BASE = process.env.CHECKLIST_API_BASE_URL || 'http://127.0.0.1:4000';
const DEV_USER_ID =
  process.env.CHECKLIST_DEV_USER_ID || '11111111-1111-4111-8111-111111111111';
const DEV_USER_EMAIL = process.env.CHECKLIST_DEV_USER_EMAIL || 'checklist@local.test';
const TEST_WORD_ID = process.env.CHECKLIST_WORD_ID || 'L1-0001';

const headers = {
  'Content-Type': 'application/json',
  'x-dev-user-id': DEV_USER_ID,
  'x-dev-user-email': DEV_USER_EMAIL,
};

function section(title) {
  // eslint-disable-next-line no-console
  console.log(`\n== ${title} ==`);
}

async function requestJson(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!response.ok) {
    throw new Error(`${method} ${path} failed (${response.status}): ${JSON.stringify(json)}`);
  }

  return json;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runChecks() {
  section('Connectivity');
  const health = await requestJson('/health');
  assert(health?.ok === true, 'Health check did not return { ok: true }');
  // eslint-disable-next-line no-console
  console.log(`PASS /health (authMode=${health.authMode})`);

  section('Profile + Progress');
  const profileRes = await requestJson('/v1/me/profile');
  assert(profileRes?.profile?.userId, 'Profile payload missing userId');
  // eslint-disable-next-line no-console
  console.log('PASS GET /v1/me/profile');

  const updatedProfile = await requestJson('/v1/me/profile', {
    method: 'PATCH',
    body: {
      displayName: 'Checklist User',
      targetLanguage: 'ja',
      onboardingComplete: true,
    },
  });
  assert(updatedProfile?.profile?.targetLanguage === 'ja', 'Profile PATCH did not persist targetLanguage');
  // eslint-disable-next-line no-console
  console.log('PASS PATCH /v1/me/profile');

  const progress = await requestJson('/v1/me/progress');
  assert(progress?.progress?.userId, 'Progress payload missing progress.userId');
  // eslint-disable-next-line no-console
  console.log('PASS GET /v1/me/progress');

  const patchedCurrent = await requestJson('/v1/me/progress/current', {
    method: 'PATCH',
    body: {
      currentBandId: 'band1',
      currentUnitId: 'unit_numbers',
      currentLessonIdx: 2,
    },
  });
  assert(patchedCurrent?.progress?.currentBandId === 'band1', 'Progress current patch failed');
  // eslint-disable-next-line no-console
  console.log('PASS PATCH /v1/me/progress/current');

  section('Attempt + Weak Word Flow');
  await requestJson('/v1/attempts/quiz', {
    method: 'POST',
    body: {
      wordId: TEST_WORD_ID,
      isCorrect: false,
      isReview: true,
      answerText: 'wrong',
      responseMs: 1500,
    },
  });
  // eslint-disable-next-line no-console
  console.log('PASS POST /v1/attempts/quiz (miss)');

  await requestJson('/v1/attempts/speak', {
    method: 'POST',
    body: {
      wordId: TEST_WORD_ID,
      isReview: true,
      transcript: 'ba',
      detectedTransliteration: 'ichi',
      initialOk: true,
      finalOk: true,
      toneOk: false,
      score: 66,
    },
  });
  // eslint-disable-next-line no-console
  console.log('PASS POST /v1/attempts/speak (miss)');

  const weakBefore = await requestJson('/v1/me/needs-work?limit=50&minTotalMisses=1');
  const existsBefore = Array.isArray(weakBefore?.needsWork)
    ? weakBefore.needsWork.some((row) => row.wordId === TEST_WORD_ID)
    : false;
  assert(existsBefore, 'Expected test word to appear in needs-work after misses');
  // eslint-disable-next-line no-console
  console.log('PASS GET /v1/me/needs-work (word appears after misses)');

  await requestJson('/v1/attempts/quiz', {
    method: 'POST',
    body: {
      wordId: TEST_WORD_ID,
      isCorrect: true,
      isReview: true,
      answerText: 'correct',
      responseMs: 900,
    },
  });
  // eslint-disable-next-line no-console
  console.log('PASS POST /v1/attempts/quiz (correct clears weak state)');

  const weakAfter = await requestJson('/v1/me/needs-work?limit=50&minTotalMisses=1');
  const existsAfter = Array.isArray(weakAfter?.needsWork)
    ? weakAfter.needsWork.some((row) => row.wordId === TEST_WORD_ID)
    : false;
  assert(!existsAfter, 'Expected test word to be removed from needs-work after correct attempt');
  // eslint-disable-next-line no-console
  console.log('PASS GET /v1/me/needs-work (word removed after correct)');

  section('Progress Events');
  const eventResult = await requestJson('/v1/me/progress/events', {
    method: 'POST',
    body: {
      eventType: 'lesson_completed',
      streakDelta: 1,
      payloadJson: { source: 'regression-checklist' },
    },
  });
  assert(eventResult?.createdEvent?.eventType === 'lesson_completed', 'Progress event not persisted');
  // eslint-disable-next-line no-console
  console.log('PASS POST /v1/me/progress/events');
}

async function main() {
  section('Sonus Regression Checklist');
  // eslint-disable-next-line no-console
  console.log(`API base: ${API_BASE}`);
  // eslint-disable-next-line no-console
  console.log(`Mock user: ${DEV_USER_ID}`);

  try {
    await runChecks();
    // eslint-disable-next-line no-console
    console.log('\nAll regression checks passed.');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('\nRegression checklist failed.');
    // eslint-disable-next-line no-console
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

void main();
