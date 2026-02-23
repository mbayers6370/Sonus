import { describe, expect, it } from 'vitest';
import {
  applyConfidenceAdjustment,
  getCoreWordStats,
  isDue,
  pickQuizPromptType,
  scheduleDaysForCorrectStreak,
} from './reviewScheduler';
import type { Word } from '../types/lesson.types';

describe('reviewScheduler', () => {
  it('marks undefined or invalid due dates as due', () => {
    expect(isDue(undefined, Date.now())).toBe(true);
    expect(isDue('not-a-date', Date.now())).toBe(true);
  });

  it('returns deterministic prompt sequence for quiz mode', () => {
    expect(pickQuizPromptType(0, 'quiz')).toBe('hanzi_to_en');
    expect(pickQuizPromptType(1, 'quiz')).toBe('en_to_hanzi');
    expect(pickQuizPromptType(2, 'quiz')).toBe('audio_to_meaning');
    expect(pickQuizPromptType(3, 'quiz')).toBe('cloze');
    expect(pickQuizPromptType(4, 'quiz')).toBe('hanzi_to_en');
  });

  it('forces speak prompt type in speak mode', () => {
    expect(pickQuizPromptType(0, 'speak')).toBe('speak_from_en');
    expect(pickQuizPromptType(99, 'speak')).toBe('speak_from_en');
  });

  it('applies streak scheduling and confidence fallback', () => {
    expect(scheduleDaysForCorrectStreak(1)).toBe(3);
    expect(scheduleDaysForCorrectStreak(2)).toBe(7);
    expect(scheduleDaysForCorrectStreak(3)).toBe(14);

    expect(applyConfidenceAdjustment(14, 3, 'sure')).toBe(14);
    expect(applyConfidenceAdjustment(14, 3, 'unsure')).toBe(7);
    expect(applyConfidenceAdjustment(7, 2, 'unsure')).toBe(3);
    expect(applyConfidenceAdjustment(3, 1, 'unsure')).toBe(2);
  });

  it('counts only non-review words in core stats', () => {
    const makeWord = (id: string, isReview = false): Word => ({
      id,
      simp: id,
      trad: id,
      pinyin: 'a1',
      pos: 'N',
      en: id,
      defs: [id],
      isReview,
    });
    const words: Word[] = [makeWord('a'), makeWord('b'), makeWord('c', true)];
    const stats = getCoreWordStats(words, { 0: true, 1: false, 2: true });
    expect(stats.total).toBe(2);
    expect(stats.correct).toBe(1);
  });
});
