import type { Word } from '../types/lesson.types';

function sampleWithoutReplacement<T>(items: T[], count: number): T[] {
  // Random sample without duplicates so injected review words are distinct.
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
  // Injection is probabilistic and bounded by both candidate supply and lesson size.
  const safeMaxInject = Math.max(0, Math.min(maxInject, reviewCandidates.length, lessonWords.length));
  if (safeMaxInject === 0 || Math.random() > injectProbability) {
    return [...lessonWords];
  }

  const injectCount = 1 + Math.floor(Math.random() * safeMaxInject);
  const pickedReviews = sampleWithoutReplacement(reviewCandidates, injectCount).map((word) => ({
    ...word,
    isReview: true,
    reviewReason:
      word.reviewReason ||
      "Added from your Needs Work list after repeated misses. A correct answer clears it.",
  }));

  if (pickedReviews.length === 0) return [...lessonWords];

  // Interleave review words across the lesson to increase spacing effect.
  // Core lesson words are preserved; review words are only inserted between them.
  const injected = [...lessonWords];
  const plannedSlots: number[] = [];
  for (let i = 0; i < pickedReviews.length; i += 1) {
    // Even spacing anchors around the current core sequence.
    const anchor = Math.floor(((i + 1) * (lessonWords.length + 1)) / (pickedReviews.length + 1));
    const jitter = Math.floor(Math.random() * 3) - 1; // -1, 0, +1
    const slot = Math.max(1, Math.min(lessonWords.length, anchor + jitter));
    plannedSlots.push(slot);
  }
  plannedSlots.sort((a, b) => a - b);

  let offset = 0;
  for (let i = 0; i < pickedReviews.length; i += 1) {
    const insertAt = plannedSlots[i] + offset;
    injected.splice(insertAt, 0, pickedReviews[i]);
    offset += 1;
  }

  return injected;
}
