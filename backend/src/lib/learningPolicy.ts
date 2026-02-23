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
  quiz: {
    missEaseDelta: -0.2,
    reviewCorrectEaseDelta: 0.12,
    lessonCorrectEaseDelta: 0.06,
    reviewRiskMissDelta: 0.22,
    lessonRiskMissDelta: 0.1,
    reviewIntervalGain: 2,
    lessonIntervalGain: 1,
    missDueDaysReview: 0,
    missDueDaysLesson: 1,
    correctDueDaysReview: 4,
    correctDueDaysLesson: 2,
  },
  speak: {
    missRiskReviewDelta: 0.35,
    missRiskLessonDelta: 0.2,
    missEaseDelta: -0.08,
    correctEaseDelta: 0.05,
    reviewIntervalGain: 1,
    missDueDaysReview: 0,
    missDueDaysLesson: 1,
    correctDueDaysReview: 3,
    correctDueDaysLesson: 2,
  },
} as const;

function clampMin(value: number, min: number) {
  return Math.max(min, value);
}

export function computeQuizMemoryUpdate(
  existing: ExistingWordMemorySnapshot | null,
  isMiss: boolean,
  isReview: boolean
): QuizMemoryUpdate {
  const nextMissedQuizCount = isMiss ? (existing?.missedQuizCount ?? 0) + 1 : 0;
  const nextMispronounceCount = isMiss ? (existing?.mispronounceCount ?? 0) : 0;
  const nextQuizEase = clampMin(
    (existing?.quizEase ?? 2.5) +
      (isMiss
        ? POLICY.quiz.missEaseDelta
        : isReview
          ? POLICY.quiz.reviewCorrectEaseDelta
          : POLICY.quiz.lessonCorrectEaseDelta),
    POLICY.minEase
  );
  const nextPronunciationRisk = isMiss
    ? clampMin(
        (existing?.pronunciationRisk ?? 0) +
          (isReview ? POLICY.quiz.reviewRiskMissDelta : POLICY.quiz.lessonRiskMissDelta),
        0
      )
    : 0;

  const baseInterval = existing?.quizIntervalDays ?? 1;
  const nextQuizIntervalDays = isMiss
    ? 1
    : clampMin(
        baseInterval + (isReview ? POLICY.quiz.reviewIntervalGain : POLICY.quiz.lessonIntervalGain),
        1
      );
  const dueDays = isMiss
    ? isReview
      ? POLICY.quiz.missDueDaysReview
      : POLICY.quiz.missDueDaysLesson
    : isReview
      ? POLICY.quiz.correctDueDaysReview
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
    ? clampMin(
        (existing?.pronunciationRisk ?? 0) +
          (isReview ? POLICY.speak.missRiskReviewDelta : POLICY.speak.missRiskLessonDelta),
        0
      )
    : 0;
  const nextQuizIntervalDays = mispronounced
    ? 1
    : clampMin(
        (existing?.quizIntervalDays ?? 1) + (isReview ? POLICY.speak.reviewIntervalGain : 0),
        1
      );
  const dueDays = mispronounced
    ? isReview
      ? POLICY.speak.missDueDaysReview
      : POLICY.speak.missDueDaysLesson
    : isReview
      ? POLICY.speak.correctDueDaysReview
      : POLICY.speak.correctDueDaysLesson;
  const nextQuizEase = clampMin(
    (existing?.quizEase ?? 2.5) +
      (mispronounced ? POLICY.speak.missEaseDelta : POLICY.speak.correctEaseDelta),
    POLICY.minEase
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
