import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../env.js';
import { computeQuizMemoryUpdate, computeSpeakMemoryUpdate } from './learningPolicy.js';

const base = {
  missedQuizCount: 1,
  mispronounceCount: 1,
  quizEase: 2.5,
  pronunciationRisk: 0.6,
  quizIntervalDays: 1,
};

function clampInterval(value: number) {
  return Math.min(env.SRS_MAX_INTERVAL_DAYS, Math.max(env.SRS_MIN_INTERVAL_DAYS, value));
}

function nextLadderValue(current: number) {
  const ladder = [1, 3, 7, 14, 30];
  const normalized = Math.max(0, Math.round(current));
  for (const value of ladder) {
    if (value > normalized) return value;
  }
  return ladder[ladder.length - 1];
}

test('quiz review correct advances ladder and uses interval as due date', () => {
  const next = computeQuizMemoryUpdate(base, false, true);
  const expectedInterval = clampInterval(nextLadderValue(base.quizIntervalDays));
  assert.equal(next.quizIntervalDays, expectedInterval);
  assert.equal(next.dueDays, expectedInterval);
  assert.equal(next.missedQuizCount, 0);
  assert.equal(next.mispronounceCount, 0);
  assert.equal(next.pronunciationRisk, 0);
});

test('quiz review miss resets to immediate review window', () => {
  const reviewBase = { ...base, quizIntervalDays: 14 };
  const next = computeQuizMemoryUpdate(reviewBase, true, true);
  assert.equal(next.quizIntervalDays, env.SRS_MIN_INTERVAL_DAYS);
  assert.equal(next.dueDays, 0);
  assert.equal(next.missedQuizCount, reviewBase.missedQuizCount + 1);
  assert.equal(next.mispronounceCount, reviewBase.mispronounceCount);
  assert(next.pronunciationRisk > reviewBase.pronunciationRisk);
});

test('quiz lesson correct uses lesson due window and growth factor', () => {
  const lessonBase = { ...base, quizIntervalDays: 6 };
  const next = computeQuizMemoryUpdate(lessonBase, false, false);
  assert.equal(
    next.quizIntervalDays,
    clampInterval(Math.round(lessonBase.quizIntervalDays + env.SRS_CORRECT_GROWTH_FACTOR))
  );
  assert.equal(next.dueDays, 3);
  assert.equal(next.pronunciationRisk, 0);
});

test('quiz lesson miss uses lesson miss due window', () => {
  const lessonBase = { ...base, quizIntervalDays: 9 };
  const next = computeQuizMemoryUpdate(lessonBase, true, false);
  assert.equal(next.dueDays, 1);
  assert(next.quizIntervalDays >= env.SRS_MIN_INTERVAL_DAYS);
  assert(next.quizIntervalDays <= env.SRS_MAX_INTERVAL_DAYS);
});

test('speak review correct advances ladder and clears risk/mispronounce counters', () => {
  const reviewBase = { ...base, quizIntervalDays: 3, pronunciationRisk: 1.1, mispronounceCount: 3 };
  const next = computeSpeakMemoryUpdate(reviewBase, false, true);
  const expectedInterval = clampInterval(nextLadderValue(reviewBase.quizIntervalDays));
  assert.equal(next.quizIntervalDays, expectedInterval);
  assert.equal(next.dueDays, expectedInterval);
  assert.equal(next.mispronounceCount, 0);
  assert.equal(next.pronunciationRisk, 0);
});

test('speak review miss resets due days to immediate and interval to ladder start', () => {
  const reviewBase = { ...base, quizIntervalDays: 30 };
  const next = computeSpeakMemoryUpdate(reviewBase, true, true);
  assert.equal(next.quizIntervalDays, env.SRS_MIN_INTERVAL_DAYS);
  assert.equal(next.dueDays, 0);
  assert.equal(next.missedQuizCount, reviewBase.missedQuizCount);
  assert.equal(next.mispronounceCount, reviewBase.mispronounceCount + 1);
  assert(next.pronunciationRisk > reviewBase.pronunciationRisk);
});

test('speak lesson miss uses lesson miss due window', () => {
  const lessonBase = { ...base, quizIntervalDays: 11 };
  const next = computeSpeakMemoryUpdate(lessonBase, true, false);
  assert.equal(next.dueDays, 1);
  assert(next.quizIntervalDays >= env.SRS_MIN_INTERVAL_DAYS);
  assert(next.quizIntervalDays <= env.SRS_MAX_INTERVAL_DAYS);
});

test('speak lesson correct keeps lesson due window', () => {
  const lessonBase = { ...base, quizIntervalDays: 11 };
  const next = computeSpeakMemoryUpdate(lessonBase, false, false);
  assert.equal(next.quizIntervalDays, clampInterval(Math.round(lessonBase.quizIntervalDays)));
  assert.equal(next.dueDays, 3);
});

test('quiz ease and interval values clamp at policy boundaries', () => {
  const high = computeQuizMemoryUpdate(
    {
      ...base,
      quizEase: 9,
      quizIntervalDays: 100_000,
    },
    false,
    true
  );
  assert.equal(high.quizEase, 3.6);
  assert.equal(high.quizIntervalDays, clampInterval(nextLadderValue(100_000)));

  const low = computeQuizMemoryUpdate(
    {
      ...base,
      quizEase: -5,
      quizIntervalDays: -10,
    },
    true,
    true
  );
  assert.equal(low.quizEase, 1.3);
  assert.equal(low.quizIntervalDays, env.SRS_MIN_INTERVAL_DAYS);
});

test('speak ease and risk values clamp at policy boundaries', () => {
  const highRisk = computeSpeakMemoryUpdate(
    {
      ...base,
      pronunciationRisk: 9,
      quizEase: 9,
    },
    true,
    true
  );
  assert.equal(highRisk.pronunciationRisk, 2);
  assert.equal(highRisk.quizEase, 3.6);

  const lowEase = computeSpeakMemoryUpdate(
    {
      ...base,
      quizEase: -4,
    },
    true,
    false
  );
  assert.equal(lowEase.quizEase, 1.3);
});
