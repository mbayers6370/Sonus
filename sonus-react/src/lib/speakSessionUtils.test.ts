import { describe, expect, it } from 'vitest';
import {
  analysisCompositeScore,
  pickBetterCandidate,
  shouldUseAdaptiveShortDelay,
} from './speakSessionUtils';

describe('speak session utils', () => {
  it('computes composite score from analysis', () => {
    expect(
      analysisCompositeScore(
        {
          initial: { percent: 90 },
          final: { percent: 80 },
          prosody: { percent: 70 },
        },
        false
      )
    ).toBe(80);
    expect(analysisCompositeScore(null, true)).toBe(100);
  });

  it('ranks japanese candidates by match then score', () => {
    const current = {
      match: false,
      isFinal: true,
      confidence: 0.9,
      compositeScore: 40,
      updatedAt: 1,
    };
    const next = {
      match: true,
      isFinal: true,
      confidence: 0.4,
      compositeScore: 60,
      updatedAt: 2,
    };
    expect(pickBetterCandidate(current, next, 'ja')).toBe(next);
  });

  it('uses adaptive short delay for uncertain short utterances', () => {
    expect(
      shouldUseAdaptiveShortDelay({
        useSentenceTargetInPractice: false,
        isShortTarget: true,
        hasNewFinal: true,
        candidate: { match: true, confidence: 0.4 },
      })
    ).toBe(true);
    expect(
      shouldUseAdaptiveShortDelay({
        useSentenceTargetInPractice: false,
        isShortTarget: true,
        hasNewFinal: true,
        candidate: { match: true, confidence: 0.9 },
      })
    ).toBe(false);
  });
});
