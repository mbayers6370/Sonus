import { env } from '../env.js';

export type ExistingWordMemorySnapshot = {
  missedQuizCount: number;
  mispronounceCount: number;
  quizEase: number;
  pronunciationRisk: number;
  quizIntervalDays: number;
};

export type QuizMemoryUpdate = {
  missedQuizCount: number;
  mispronounceCount: number;
  quizEase: number;
  pronunciationRisk: number;
  quizIntervalDays: number;
  dueDays: number;
};

export type SpeakMemoryUpdate = {
  missedQuizCount: number;
  mispronounceCount: number;
  quizEase: number;
  pronunciationRisk: number;
  quizIntervalDays: number;
  dueDays: number;
};

const POLICY = {
  minEase: 1.3,
  maxEase: 3.6,
  maxRisk: 2.0,
  minIntervalDays: env.SRS_MIN_INTERVAL_DAYS,
  maxIntervalDays: env.SRS_MAX_INTERVAL_DAYS,
  baseIntervalDays: env.SRS_BASE_INTERVAL_DAYS,
  correctGrowthFactor: env.SRS_CORRECT_GROWTH_FACTOR,
  missPenaltyFactor: env.SRS_MISS_PENALTY_FACTOR,
  quiz: {
    missEaseDelta: -0.2,
    reviewCorrectEaseDelta: 0.1,
    lessonCorrectEaseDelta: 0.05,
    reviewRiskMissDelta: 0.22,
    lessonRiskMissDelta: 0.1,
    reviewIntervalGain: 2,
    lessonIntervalGain: 1,
    missDueDaysReview: 0,
    missDueDaysLesson: 1,
    correctDueDaysReview: 5,
    correctDueDaysLesson: 3,
  },
  speak: {
    missRiskReviewDelta: 0.35,
    missRiskLessonDelta: 0.2,
    missEaseDelta: -0.08,
    correctEaseDelta: 0.05,
    reviewIntervalGain: 1,
    missDueDaysReview: 0,
    missDueDaysLesson: 1,
    correctDueDaysReview: 4,
    correctDueDaysLesson: 3,
  },
} as const;

const REVIEW_INTERVAL_LADDER_DAYS = [1, 3, 7, 14, 30] as const;

function clampRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function nextLadderIntervalDay(current: number) {
  const normalizedCurrent = Math.max(0, Math.round(current));
  for (const value of REVIEW_INTERVAL_LADDER_DAYS) {
    if (value > normalizedCurrent) return value;
  }
  return REVIEW_INTERVAL_LADDER_DAYS[REVIEW_INTERVAL_LADDER_DAYS.length - 1];
}

export function computeQuizMemoryUpdate(
  existing: ExistingWordMemorySnapshot | null,
  isMiss: boolean,
  isReview: boolean
): QuizMemoryUpdate {
  const nextMissedQuizCount = isMiss ? (existing?.missedQuizCount ?? 0) + 1 : 0;
  const nextMispronounceCount = isMiss ? (existing?.mispronounceCount ?? 0) : 0;
  const nextQuizEase = clampRange(
    (existing?.quizEase ?? 2.5) +
      (isMiss
        ? POLICY.quiz.missEaseDelta
        : isReview
          ? POLICY.quiz.reviewCorrectEaseDelta
          : POLICY.quiz.lessonCorrectEaseDelta),
    POLICY.minEase,
    POLICY.maxEase
  );
  const nextPronunciationRisk = isMiss
    ? clampRange(
        (existing?.pronunciationRisk ?? 0) +
          (isReview ? POLICY.quiz.reviewRiskMissDelta : POLICY.quiz.lessonRiskMissDelta),
        0,
        POLICY.maxRisk
      )
    : 0;

  const baseInterval = existing?.quizIntervalDays ?? POLICY.baseIntervalDays;
  const nextQuizIntervalDays = isMiss
    ? clampRange(
        isReview
          ? REVIEW_INTERVAL_LADDER_DAYS[0]
          : Math.round(baseInterval * POLICY.missPenaltyFactor),
        POLICY.minIntervalDays,
        POLICY.maxIntervalDays
      )
    : clampRange(
        isReview
          ? nextLadderIntervalDay(baseInterval)
          : Math.round(baseInterval + POLICY.quiz.lessonIntervalGain * POLICY.correctGrowthFactor),
        POLICY.minIntervalDays,
        POLICY.maxIntervalDays
      );
  const dueDays = isMiss
    ? isReview
      ? POLICY.quiz.missDueDaysReview
      : POLICY.quiz.missDueDaysLesson
    : isReview
      ? nextQuizIntervalDays
      : POLICY.quiz.correctDueDaysLesson;

  return {
    missedQuizCount: nextMissedQuizCount,
    mispronounceCount: nextMispronounceCount,
    quizEase: nextQuizEase,
    pronunciationRisk: nextPronunciationRisk,
    quizIntervalDays: nextQuizIntervalDays,
    dueDays,
  };
}

export function computeSpeakMemoryUpdate(
  existing: ExistingWordMemorySnapshot | null,
  mispronounced: boolean,
  isReview: boolean
): SpeakMemoryUpdate {
  const nextMispronounceCount = mispronounced ? (existing?.mispronounceCount ?? 0) + 1 : 0;
  const nextMissedQuizCount = mispronounced ? (existing?.missedQuizCount ?? 0) : 0;
  const nextPronunciationRisk = mispronounced
    ? clampRange(
        (existing?.pronunciationRisk ?? 0) +
          (isReview ? POLICY.speak.missRiskReviewDelta : POLICY.speak.missRiskLessonDelta),
        0,
        POLICY.maxRisk
      )
    : 0;
  const nextQuizIntervalDays = mispronounced
    ? clampRange(
        isReview
          ? REVIEW_INTERVAL_LADDER_DAYS[0]
          : Math.round(
              (existing?.quizIntervalDays ?? POLICY.baseIntervalDays) * POLICY.missPenaltyFactor
            ),
        POLICY.minIntervalDays,
        POLICY.maxIntervalDays
      )
    : clampRange(
        isReview
          ? nextLadderIntervalDay(existing?.quizIntervalDays ?? POLICY.baseIntervalDays)
          : Math.round(existing?.quizIntervalDays ?? POLICY.baseIntervalDays),
        POLICY.minIntervalDays,
        POLICY.maxIntervalDays
      );
  const dueDays = mispronounced
    ? isReview
      ? POLICY.speak.missDueDaysReview
      : POLICY.speak.missDueDaysLesson
    : isReview
      ? nextQuizIntervalDays
      : POLICY.speak.correctDueDaysLesson;
  const nextQuizEase = clampRange(
    (existing?.quizEase ?? 2.5) +
      (mispronounced ? POLICY.speak.missEaseDelta : POLICY.speak.correctEaseDelta),
    POLICY.minEase,
    POLICY.maxEase
  );

  return {
    missedQuizCount: nextMissedQuizCount,
    mispronounceCount: nextMispronounceCount,
    pronunciationRisk: nextPronunciationRisk,
    quizIntervalDays: nextQuizIntervalDays,
    dueDays,
    quizEase: nextQuizEase,
  };
}
