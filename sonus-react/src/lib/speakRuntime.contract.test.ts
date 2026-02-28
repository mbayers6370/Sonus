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

  it('normalizes Mandarin numeric-only transcripts into pinyin-like tokens', () => {
    expect(normalizeSpeechCandidate('zh', '2')).toBe('er4');
  });

  it('exposes expected scoring dimension keys per language', () => {
    expect(speakDimensionKeys('zh')).toEqual(['initial', 'final', 'tone']);
    expect(speakDimensionKeys('ja')).toEqual(['word']);
  });

  it('resolves speak language from active lesson context (band-based override)', () => {
    expect(resolveSpeakLanguageForSession('zh', 'n4')).toBe('ja');
    expect(resolveSpeakLanguageForSession('ja', 'band2')).toBe('zh');
    expect(getSpeakRecognitionLocale(resolveSpeakLanguageForSession('kr', null))).toBe('ko-KR');
  });

  it('romanizes Japanese kana transcripts for display', () => {
    expect(romanizeJapaneseForDisplay('さようなら')).toBe('sayounara');
    expect(romanizeJapaneseForDisplay('がっこう')).toBe('gakkou');
    expect(romanizeJapaneseForDisplay('スーパー')).toBe('suupaa');
    expect(romanizeJapaneseForDisplay('しんぶん')).toBe('shinbun');
  });

  it('builds speak dimensions that UI can render without branching on hardcoded labels', () => {
    const zh = buildSpeakDimensionScores({
      languageId: 'zh',
      initial: { matched: 1, total: 1, percent: 100, pass: true },
      final: { matched: 1, total: 1, percent: 100, pass: true },
      tone: { matched: 1, total: 1, percent: 100, pass: true },
    });
    expect(zh.map((dimension) => dimension.key)).toEqual(['initial', 'final', 'tone']);

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
    expect(units[0]?.words?.[0]?.pinyin).toBe('ichi');
  });
});
