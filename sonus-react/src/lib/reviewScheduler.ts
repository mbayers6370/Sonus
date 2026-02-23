import type { ConfidenceLevel, QuizPromptType, Word } from '../types/lesson.types';

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function isDue(nextReviewAt: string | undefined, nowMs: number) {
  if (!nextReviewAt) return true;
  const ts = Date.parse(nextReviewAt);
  if (Number.isNaN(ts)) return true;
  return ts <= nowMs;
}

export function plusDays(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

export function scheduleDaysForCorrectStreak(streak: number) {
  if (streak >= 3) return 14;
  if (streak >= 2) return 7;
  return 3;
}

export function applyConfidenceAdjustment(days: number, streak: number, confidence: ConfidenceLevel) {
  if (confidence === 'sure') return days;
  if (streak >= 3) return 7;
  if (streak >= 2) return 3;
  return 2;
}

export function pickQuizPromptType(cursor: number, mode: 'quiz' | 'speak'): QuizPromptType {
  if (mode === 'speak') return 'speak_from_en';
  const sequence: QuizPromptType[] = ['hanzi_to_en', 'en_to_hanzi', 'audio_to_meaning', 'cloze'];
  return sequence[cursor % sequence.length];
}

export function getCoreWordStats(words: Word[], resultsByIndex: Record<number, boolean>) {
  const coreIndexes = words
    .map((word, index) => ({ word, index }))
    .filter(({ word }) => !word.isReview)
    .map(({ index }) => index);
  const total = coreIndexes.length;
  const correct = coreIndexes.filter((index) => Boolean(resultsByIndex[index])).length;
  return { total, correct };
}
