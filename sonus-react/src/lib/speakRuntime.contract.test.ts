import { describe, expect, it } from 'vitest';
import {
  buildSpeakDimensionScores,
  getSpeakRecognitionLocale,
  normalizeSpeechCandidate,
  resolveSpeakLanguageForSession,
  romanizeJapaneseForDisplay,
  speakDimensionKeys,
  shouldTrySpeakFallback,
} from './speakRuntime';
import { normalizeBandDataPayload } from './languageRuntime';

describe('speak runtime language contract', () => {
  it('normalizes Japanese numeric transcripts to script-friendly forms', () => {
    expect(normalizeSpeechCandidate('ja', '2')).toBe('二');
  });

  it('falls back unsupported language ids to Japanese normalization', () => {
    expect(normalizeSpeechCandidate('xx', '2')).toBe('二');
  });

  it('exposes expected scoring dimension keys per language', () => {
    expect(speakDimensionKeys('xx')).toEqual(['word']);
    expect(speakDimensionKeys('ja')).toEqual(['word']);
    expect(speakDimensionKeys('ko')).toEqual(['onset', 'rime', 'prosody']);
  });

  it('resolves speak language from selected language first, then band fallback', () => {
    expect(resolveSpeakLanguageForSession('xx', 'n4')).toBe('ja');
    expect(resolveSpeakLanguageForSession('ja', 'band2')).toBe('ja');
    expect(resolveSpeakLanguageForSession('', 'n4')).toBe('ja');
    expect(resolveSpeakLanguageForSession('', 'band2')).toBe('ja');
    expect(getSpeakRecognitionLocale(resolveSpeakLanguageForSession('kr', null))).toBe('ko-KR');
  });

  it('romanizes Japanese kana transcripts for display', () => {
    expect(romanizeJapaneseForDisplay('さようなら')).toBe('sayounara');
    expect(romanizeJapaneseForDisplay('がっこう')).toBe('gakkou');
    expect(romanizeJapaneseForDisplay('スーパー')).toBe('suupaa');
    expect(romanizeJapaneseForDisplay('しんぶん')).toBe('shinbun');
  });

  it('keeps ji and chi mappings distinct', () => {
    expect(romanizeJapaneseForDisplay('じゅう')).toBe('juu');
    expect(romanizeJapaneseForDisplay('ちゅう')).toBe('chuu');
  });

  it('builds speak dimensions that UI can render without branching on hardcoded labels', () => {
    const fallback = buildSpeakDimensionScores({
      languageId: 'ko',
      onset: { matched: 1, total: 1, percent: 100, pass: true },
      rime: { matched: 1, total: 1, percent: 100, pass: true },
      prosody: { matched: 1, total: 1, percent: 100, pass: true },
    });
    expect(fallback.map((dimension) => dimension.key)).toEqual(['onset', 'rime', 'prosody']);

    const ja = buildSpeakDimensionScores({
      languageId: 'ja',
      word: { matched: 1, total: 1, percent: 100, pass: true },
    });
    expect(ja.map((dimension) => dimension.key)).toEqual(['word']);
  });

  it('flags short/ambiguous misses for fallback attempts', () => {
    expect(
      shouldTrySpeakFallback({
        languageId: 'ja',
        targetScript: 'お',
        targetReading: 'o',
        recognizedText: '2',
        isMatch: false,
        isFinal: true,
      })
    ).toBe(true);
  });

  it('normalizes curriculum payload without missing required word fields', () => {
    const sample = normalizeBandDataPayload(
      {
        language: 'ja',
        source: 'test',
        bandId: 'n5',
        units: [
          {
            id: 'n5-u1',
            targetWords: 1,
            allocatedWords: 1,
            words: [{ id: 'w1', kanji: '一', hiragana: 'いち', romaji: 'ichi', en: 'one' }],
          },
        ],
      },
      'n5',
      'ja'
    );

    expect(sample).not.toBeNull();
    expect(sample?.units).toBeTruthy();
    const units = Array.isArray(sample?.units) ? sample?.units : [];
    expect(units.length).toBeGreaterThan(0);
    expect(units[0]?.words?.[0]?.id).toBe('w1');
    expect(units[0]?.words?.[0]?.transliteration).toBe('ichi');
  });
});
