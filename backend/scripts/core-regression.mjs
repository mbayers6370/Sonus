#!/usr/bin/env node

const API_BASE = process.env.CORE_TEST_API_BASE_URL || 'http://127.0.0.1:4000';
const DEV_USER_ID =
  process.env.CORE_TEST_DEV_USER_ID || '22222222-2222-4222-8222-222222222222';
const DEV_USER_EMAIL = process.env.CORE_TEST_DEV_USER_EMAIL || 'core-test@local.test';
const TEST_WORD_ID = process.env.CORE_TEST_WORD_ID || 'L1-0001';

const headers = {
  'Content-Type': 'application/json',
  'x-dev-user-id': DEV_USER_ID,
  'x-dev-user-email': DEV_USER_EMAIL,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${text}`);
  }
  return payload;
}

async function main() {
  console.log(`Running core regression tests against ${API_BASE}`);

  const health = await requestJson('/health');
  assert(health?.ok === true, 'health check failed');
  console.log('PASS health');

  await requestJson('/v1/me/progress/current', {
    method: 'PATCH',
    body: {
      currentBandId: 'band1',
      currentUnitId: 'b1-numbers',
      currentLessonIdx: 2,
    },
  });

  const progressRes = await requestJson('/v1/me/progress');
  assert(progressRes?.progress?.currentBandId === 'band1', 'currentBandId did not persist');
  assert(progressRes?.progress?.currentUnitId === 'b1-numbers', 'currentUnitId did not persist');
  assert(progressRes?.progress?.currentLessonIdx === 2, 'currentLessonIdx did not persist');
  console.log('PASS progress path persistence');

  await requestJson('/v1/attempts/quiz', {
    method: 'POST',
    body: {
      wordId: TEST_WORD_ID,
      isCorrect: false,
      isReview: true,
      answerText: 'wrong',
    },
  });

  const afterMiss = await requestJson('/v1/me/needs-work?limit=100&minTotalMisses=1');
  const hasWordAfterMiss = Array.isArray(afterMiss?.needsWork)
    ? afterMiss.needsWork.some((item) => item.wordId === TEST_WORD_ID)
    : false;
  assert(hasWordAfterMiss, 'word should appear in needs-work after miss');
  console.log('PASS weak-word appears after miss');

  await requestJson('/v1/attempts/speak', {
    method: 'POST',
    body: {
      wordId: TEST_WORD_ID,
      isReview: true,
      transcript: 'ok',
      detectedPinyin: 'yi1',
      initialOk: true,
      finalOk: true,
      toneOk: true,
      score: 100,
    },
  });

  const afterCorrect = await requestJson('/v1/me/needs-work?limit=100&minTotalMisses=1');
  const hasWordAfterCorrect = Array.isArray(afterCorrect?.needsWork)
    ? afterCorrect.needsWork.some((item) => item.wordId === TEST_WORD_ID)
    : false;
  assert(!hasWordAfterCorrect, 'word should be removed from needs-work after correct attempt');
  console.log('PASS weak-word clears after correct');

  console.log('All core regression tests passed.');
}

main().catch((error) => {
  console.error('Core regression failed:', error.message);
  process.exit(1);
});
