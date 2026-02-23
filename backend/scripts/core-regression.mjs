#!/usr/bin/env node

const API_BASE = process.env.CORE_TEST_API_BASE_URL || 'http://127.0.0.1:4000';
const DEV_USER_ID = process.env.CORE_TEST_DEV_USER_ID || crypto.randomUUID();
const DEV_USER_EMAIL = process.env.CORE_TEST_DEV_USER_EMAIL || `core-test-${Date.now()}@local.test`;
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

  await requestJson('/v1/me/profile');
  console.log('PASS profile bootstrap');

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

  const lessonKey = 'band1:b1-numbers:0';
  const assertLessonState = async (message, check) => {
    const snapshot = await requestJson('/v1/me/progress');
    const lesson = snapshot?.lessonProgress?.[lessonKey];
    assert(Boolean(lesson), `${message}: lesson snapshot missing`);
    check(lesson);
    console.log(`PASS ${message}`);
  };

  await requestJson('/v1/me/progress/events', {
    method: 'POST',
    body: {
      eventType: 'lesson_completed',
      streakDelta: 0,
      payloadJson: {
        bandId: 'band1',
        unitId: 'b1-numbers',
        lessonIndex: 0,
        introViewed: true,
        quizScore: 60,
        speakScore: 40,
        speakAllCorrect: false,
        completed: false,
        mastered: false,
      },
    },
  });
  await assertLessonState('lesson snapshot stored', (lesson) => {
    assert(lesson.introViewed === true, 'introViewed should persist');
    assert(lesson.completed === false, 'completed should remain false for low scores');
    assert(lesson.mastered === false, 'mastered should remain false initially');
  });

  await requestJson('/v1/me/progress/events', {
    method: 'POST',
    body: {
      eventType: 'lesson_completed',
      streakDelta: 0,
      payloadJson: {
        bandId: 'band1',
        unitId: 'b1-numbers',
        lessonIndex: 0,
        introViewed: true,
        quizScore: 91,
        speakScore: 93,
        speakAllCorrect: true,
        completed: true,
        mastered: false,
      },
    },
  });
  await assertLessonState('lesson completion persists', (lesson) => {
    assert(lesson.completed === true, 'completed should persist once passed');
    assert((lesson.quizScore ?? 0) >= 91, 'quiz score should keep highest value');
    assert((lesson.speakScore ?? 0) >= 93, 'speak score should keep highest value');
  });

  await requestJson('/v1/me/progress/events', {
    method: 'POST',
    body: {
      eventType: 'lesson_completed',
      streakDelta: 0,
      payloadJson: {
        bandId: 'band1',
        unitId: 'b1-numbers',
        lessonIndex: 0,
        introViewed: true,
        quizScore: 95,
        speakScore: 96,
        speakAllCorrect: true,
        completed: true,
        mastered: true,
      },
    },
  });
  await assertLessonState('lesson mastery persists', (lesson) => {
    assert(lesson.completed === true, 'completed should stay true');
    assert(lesson.mastered === true, 'mastered should persist once true');
  });

  await requestJson('/v1/me/progress/events', {
    method: 'POST',
    body: {
      eventType: 'lesson_completed',
      streakDelta: 0,
      payloadJson: {
        bandId: 'band1',
        unitId: 'b1-numbers',
        lessonIndex: 0,
        introViewed: false,
        quizScore: 10,
        speakScore: 15,
        speakAllCorrect: false,
        completed: false,
        mastered: false,
      },
    },
  });
  await assertLessonState('lesson state is monotonic', (lesson) => {
    assert(lesson.completed === true, 'completed must not downgrade');
    assert(lesson.mastered === true, 'mastered must not downgrade');
    assert((lesson.quizScore ?? 0) >= 91, 'quiz score should not downgrade');
    assert((lesson.speakScore ?? 0) >= 93, 'speak score should not downgrade');
  });

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
