import assert from 'node:assert/strict';
import { env } from '../env.js';
import { computeQuizMemoryUpdate, computeSpeakMemoryUpdate } from './learningPolicy.js';

function run() {
  const base = {
    missedQuizCount: 0,
    mispronounceCount: 0,
    quizEase: 2.5,
    pronunciationRisk: 0,
    quizIntervalDays: 6,
  };

  const quizCorrect = computeQuizMemoryUpdate(base, false, true);
  assert(
    quizCorrect.quizIntervalDays >= base.quizIntervalDays,
    'Correct quiz attempt should not reduce interval'
  );

  const quizMiss = computeQuizMemoryUpdate(base, true, true);
  assert(
    quizMiss.quizIntervalDays <= base.quizIntervalDays,
    'Missed quiz attempt should not increase interval'
  );

  const speakCorrect = computeSpeakMemoryUpdate(base, false, true);
  assert(
    speakCorrect.quizIntervalDays >= base.quizIntervalDays,
    'Correct speak attempt should not reduce interval'
  );

  const speakMiss = computeSpeakMemoryUpdate(base, true, true);
  assert(
    speakMiss.quizIntervalDays <= base.quizIntervalDays,
    'Missed speak attempt should not increase interval'
  );

  const extremelyHigh = {
    ...base,
    quizIntervalDays: 100_000,
  };
  const clampedHigh = computeQuizMemoryUpdate(extremelyHigh, false, true);
  assert(
    clampedHigh.quizIntervalDays <= env.SRS_MAX_INTERVAL_DAYS,
    'Interval should respect max clamp'
  );

  const extremelyLow = {
    ...base,
    quizIntervalDays: 0,
  };
  const clampedLow = computeQuizMemoryUpdate(extremelyLow, true, true);
  assert(
    clampedLow.quizIntervalDays >= env.SRS_MIN_INTERVAL_DAYS,
    'Interval should respect min clamp'
  );

  console.log('learningPolicy unit sanity passed');
}

run();
