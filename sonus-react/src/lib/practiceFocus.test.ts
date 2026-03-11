import { describe, expect, it } from 'vitest';
import { getStarterBandIdForLanguage, isStarterUnitCompleted } from './practiceFocus';
import { QUIZ_PASS_PERCENT, SPEAK_PASS_PERCENT } from './passCriteria';

const isInstructionalComplete = (quizScore: number | null | undefined, speakScore: number | null | undefined) =>
  (quizScore ?? 0) >= QUIZ_PASS_PERCENT && (speakScore ?? 0) >= SPEAK_PASS_PERCENT;

describe('practiceFocus', () => {
  it('maps starter band by language', () => {
    expect(getStarterBandIdForLanguage('xx')).toBe('n5');
    expect(getStarterBandIdForLanguage('ja')).toBe('n5');
    expect(getStarterBandIdForLanguage('kr')).toBe('topik1-1');
    expect(getStarterBandIdForLanguage('fr')).toBe('a1');
  });

  it('locks practice when first starter unit is not completed', () => {
    const unlocked = isStarterUnitCompleted({
      starterBandId: 'band1',
      bandData: {
        units: {
          'b1-pronouns': { words: Array.from({ length: 12 }, (_, idx) => ({ id: `w${idx}` })) },
        },
      },
      lessonProgress: {
        'band1:b1-pronouns:0': { completed: true, quizScore: 92, speakScore: 90 },
      },
      isInstructionalComplete,
    });
    expect(unlocked).toBe(false);
  });

  it('unlocks practice when first starter unit is fully completed', () => {
    const unlocked = isStarterUnitCompleted({
      starterBandId: 'band1',
      bandData: {
        units: {
          'b1-pronouns': { words: Array.from({ length: 12 }, (_, idx) => ({ id: `w${idx}` })) },
        },
      },
      lessonProgress: {
        'band1:b1-pronouns:0': { completed: true, quizScore: 92, speakScore: 90 },
        'band1:b1-pronouns:1': { completed: true, quizScore: 92, speakScore: 90 },
      },
      isInstructionalComplete,
    });
    expect(unlocked).toBe(true);
  });
});
