import { describe, expect, it } from 'vitest';
import {
  levenshtein,
  normalizeLatinForCompare,
  normalizeScriptText,
  toMarkerAndAscii,
  tokenizeRomanized,
} from './speakPronunciationUtils';

describe('speak pronunciation utils', () => {
  it('normalizes script and latin forms for compare', () => {
    expect(normalizeScriptText('日ni本hon')).toBe('日本');
    expect(normalizeLatinForCompare('Nihon!')).toBe('nihon');
  });

  it('normalizes romanized syllables to ascii', () => {
    expect(toMarkerAndAscii('ryō')).toEqual({ ascii: 'ryo', marker: 5 });
    expect(toMarkerAndAscii('shi')).toEqual({ ascii: 'shi', marker: 5 });
  });

  it('tokenizes spaced and compact transliteration', () => {
    expect(tokenizeRomanized('ni hon', 2)).toEqual(['ni', 'hon']);
    expect(tokenizeRomanized('nihon', 2).length).toBe(2);
  });

  it('computes edit distance', () => {
    expect(levenshtein('nihon', 'nihon')).toBe(0);
    expect(levenshtein('nihon', 'nihonn')).toBe(1);
  });
});
