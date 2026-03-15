import { describe, expect, it } from 'vitest';
import type { BandData, Word } from '../types/lesson.types';
import {
  ensureScriptLookupLoaded,
  getScriptLookupStats,
  inferReadingFromTargetScript,
  inferSingleCharReadingFromLessonWords,
  mapScriptToReading,
  stripUnknownReadingTokens,
} from './speakScriptLookup';

describe('speak script lookup', () => {
  it('hydrates lookup and maps script to reading', async () => {
    const words: Word[] = [
      { simp: '日本', trad: '日本', transliteration: 'nihon' },
      { simp: '語', trad: '語', transliteration: 'go' },
    ] as unknown as Word[];
    const bandData = { units: [{ words }] } as unknown as BandData;

    await ensureScriptLookupLoaded('n5', bandData, words);
    expect(mapScriptToReading('日本')).toBe('nihon');

    const stats = getScriptLookupStats();
    expect(stats.lookupWords).toBeGreaterThan(0);
    expect(stats.lookupChars).toBeGreaterThan(0);
  });

  it('infers aligned reading from target script', () => {
    expect(inferReadingFromTargetScript('日', '日本', 'ni hon')).toBe('ni');
  });

  it('derives single-char reading from lesson words', () => {
    const words: Word[] = [
      { simp: '日本', trad: '日本', transliteration: 'ni hon' },
      { simp: '日語', trad: '日語', transliteration: 'ni go' },
    ] as unknown as Word[];
    expect(inferSingleCharReadingFromLessonWords('日', words)).toBe('ni');
  });

  it('strips unknown placeholder tokens', () => {
    expect(stripUnknownReadingTokens('? ni ?')).toBe('ni');
  });
});
