import type { Word } from '../types/lesson.types';

function sampleWithoutReplacement<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  const target = Math.min(count, pool.length);
  for (let i = 0; i < target; i += 1) {
    const idx = Math.floor(Math.random() * pool.length);
    const [next] = pool.splice(idx, 1);
    picked.push(next);
  }
  return picked;
}

export function appendReviewWords(
  lessonWords: Word[],
  reviewCandidates: Word[],
  maxInject: number,
  injectProbability: number
) {
  const safeMaxInject = Math.max(0, Math.min(maxInject, reviewCandidates.length, lessonWords.length));
  if (safeMaxInject === 0 || Math.random() > injectProbability) {
    return [...lessonWords];
  }

  const injectCount = 1 + Math.floor(Math.random() * safeMaxInject);
  const pickedReviews = sampleWithoutReplacement(reviewCandidates, injectCount).map((word) => ({
    ...word,
    isReview: true,
  }));

  // Review words are appended so core lesson content is never replaced.
  return [...lessonWords, ...pickedReviews];
}
