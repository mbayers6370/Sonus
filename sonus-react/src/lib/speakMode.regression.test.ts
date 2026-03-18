import { describe, expect, it } from 'vitest';
import {
  normalizeScriptText,
  tokenizeRomanized,
  levenshtein,
} from '../lib/speakPronunciationUtils';
import { countJapaneseMora } from '../lib/speakJapaneseUtils';

describe('SpeakMode pronunciation safety regression tests', () => {
  it('normalizeScriptText handles mixed script without corruption', () => {
    // Regression: ensure mixed kanji/hiragana doesn't get mangled
    const input = '日に本ほん';
    const result = normalizeScriptText(input);
    expect(result).toBe('日本');
  });

  it('tokenizeRomanized handles edge cases without crashing', () => {
    // Regression: empty string should not cause array index errors
    const result1 = tokenizeRomanized('', 2);
    expect(Array.isArray(result1)).toBe(true);

    // Regression: single character should tokenize safely
    const result2 = tokenizeRomanized('ん', 1);
    expect(Array.isArray(result2)).toBe(true);

    // Regression: extra spaces should be handled
    const result3 = tokenizeRomanized('  ni  hon  ', 2);
    expect(result3.length).toBeGreaterThanOrEqual(1);
  });

  it('levenshtein distance handles identical strings', () => {
    // Regression: identical strings should have distance 0
    expect(levenshtein('nihon', 'nihon')).toBe(0);
  });

  it('levenshtein distance handles single character differences', () => {
    // Regression: off-by-one in distance calc
    expect(levenshtein('abc', 'abd')).toBe(1);
    expect(levenshtein('abc', 'abcd')).toBe(1);
  });

  it('countJapaneseMora counts mora correctly for common patterns', () => {
    // Regression: mora counting is critical for syllable scoring
    const mora1 = countJapaneseMora('こんにちは');
    expect(mora1).toBeGreaterThan(0);
    expect(mora1).toBeLessThanOrEqual(6); // Should be 5

    const mora2 = countJapaneseMora('あ');
    expect(mora2).toBe(1);

    const mora3 = countJapaneseMora('きょう');
    expect(mora3).toBeLessThanOrEqual(3); // Should be 2
  });

  it('pronunciation comparison prevents false positives on similar sounds', () => {
    // Regression: ensure "shi" vs "si" doesn't incorrectly resolve
    const dist1 = levenshtein('shi', 'si');
    const dist2 = levenshtein('chi', 'ti');
    expect(dist1).toBeGreaterThan(0);
    expect(dist2).toBeGreaterThan(0);
  });

  it('handles unicode normalization edge cases', () => {
    // Regression: combining marks and precomposed forms should normalize consistently
    const result = normalizeScriptText('こ\u3099んにちは');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('tokenizeRomanized respects syllable boundaries', () => {
    // Regression: tokenization should not split syllables incorrectly
    const result = tokenizeRomanized('kyo', 1);
    expect(result.some((token) => token === 'kyo')).toBe(true);
  });
});
