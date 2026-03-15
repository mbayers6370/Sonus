import { describe, expect, it } from 'vitest';
import {
  countJapaneseMora,
  hasEquivalentJapaneseNumberValue,
  isLikelyJapaneseTranscript,
  isSiriArtifactTranscript,
  japaneseRomajiKeyFromScriptOrFallback,
  parseJapaneseNumberValue,
  normalizeJapaneseLookupKey,
  normalizeJapaneseReadingForCompare,
} from './speakJapaneseUtils';

describe('speak japanese utils', () => {
  it('normalizes lookup variants consistently', () => {
    expect(normalizeJapaneseLookupKey('ゼロ')).toBe('零');
    expect(normalizeJapaneseLookupKey('0')).toBe('零');
    expect(normalizeJapaneseLookupKey('け月')).toBe('か月');
  });

  it('normalizes reading scripts and counts mora', () => {
    expect(normalizeJapaneseReadingForCompare('カタカナー!')).toBe('かたかなー');
    expect(countJapaneseMora('きょう')).toBe(2);
  });

  it('resolves romaji key with fallback when script cannot be converted', () => {
    expect(japaneseRomajiKeyFromScriptOrFallback('日本', 'nihon')).toBe('nihon');
  });

  it('classifies likely transcripts and siri artifacts', () => {
    expect(isLikelyJapaneseTranscript('こんにちは')).toBe(true);
    expect(isLikelyJapaneseTranscript('k', 'konnichiwa')).toBe(true);
    expect(isSiriArtifactTranscript('Hey Siri')).toBe(true);
  });

  it('parses and matches equivalent japanese numeric forms', () => {
    expect(parseJapaneseNumberValue('100')).toBe(100);
    expect(parseJapaneseNumberValue('一〇〇')).toBe(100);
    expect(parseJapaneseNumberValue('百')).toBe(100);
    expect(parseJapaneseNumberValue('10')).toBe(10);
    expect(parseJapaneseNumberValue('十')).toBe(10);
    expect(parseJapaneseNumberValue('十二')).toBe(12);
    expect(parseJapaneseNumberValue('20')).toBe(20);
    expect(parseJapaneseNumberValue('二十')).toBe(20);
    expect(parseJapaneseNumberValue('三百二十')).toBe(320);
    expect(parseJapaneseNumberValue('1000')).toBe(1000);
    expect(parseJapaneseNumberValue('千')).toBe(1000);
    expect(parseJapaneseNumberValue('10000')).toBe(10000);
    expect(parseJapaneseNumberValue('一万')).toBe(10000);
    expect(parseJapaneseNumberValue('二万三千')).toBe(23000);
    expect(hasEquivalentJapaneseNumberValue('100', '百')).toBe(true);
    expect(hasEquivalentJapaneseNumberValue('12', '十二')).toBe(true);
    expect(hasEquivalentJapaneseNumberValue('20', '二十')).toBe(true);
    expect(hasEquivalentJapaneseNumberValue('1000', '千')).toBe(true);
    expect(hasEquivalentJapaneseNumberValue('10000', '一万')).toBe(true);
    expect(hasEquivalentJapaneseNumberValue('23000', '二万三千')).toBe(true);
    expect(hasEquivalentJapaneseNumberValue('101', '百')).toBe(false);
    expect(hasEquivalentJapaneseNumberValue('19', '九十')).toBe(false);
    expect(hasEquivalentJapaneseNumberValue('120', '百二十')).toBe(true);
    expect(hasEquivalentJapaneseNumberValue('120', '百二十一')).toBe(false);
  });
});
