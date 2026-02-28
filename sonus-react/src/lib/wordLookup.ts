import type { BandData, Word } from '../types/lesson.types';
import { normalizeBandDataPayload as normalizeBandDataPayloadRuntime, normalizeLanguageId } from './languageRuntime';

export type WordLookup = Record<string, Pick<Word, 'id' | 'simp' | 'pinyin' | 'reading' | 'pronunciation' | 'en'>>;

const BAND_IDS = ['band1', 'band2', 'band3', 'band4', 'band5', 'band6', 'band7', 'band8', 'band9'] as const;
const JLPT_IDS = ['n5', 'n4', 'n3', 'n2', 'n1'] as const;

type LanguageId = 'zh' | 'ja';

function normalizeLanguage(languageId: string | null | undefined): LanguageId {
  const value = normalizeLanguageId(languageId);
  if (value === 'ja') return 'ja';
  return 'zh';
}

function extractWords(bandData: BandData) {
  if (Array.isArray(bandData.units)) {
    return bandData.units.flatMap((unit) => unit.words || []);
  }
  return Object.values(bandData.units || {}).flatMap((unit) => unit.words || []);
}

export async function loadWordLookup(languageId?: string | null): Promise<WordLookup> {
  const language = normalizeLanguage(languageId);
  const bandIds = language === 'ja' ? JLPT_IDS : BAND_IDS;

  const responses = await Promise.all(
    bandIds.map(async (bandId) => {
      const response = await fetch(`/data/${language}/${bandId}.json`, { cache: 'no-store' });
      if (!response.ok) return null;
      const raw = await response.json();
      return normalizeBandDataPayloadRuntime(raw, bandId, language) as BandData | null;
    })
  );

  const lookup: WordLookup = {};
  for (const bandData of responses) {
    if (!bandData) continue;
    const words = extractWords(bandData);
    for (const word of words) {
      lookup[word.id] = {
        id: word.id,
        simp: word.simp || word.en || '',
        pinyin: word.pinyin || '',
        reading: word.reading || word.pronunciation || word.pinyin || '',
        pronunciation: word.pronunciation || word.reading || word.pinyin || '',
        en: word.en || '',
      };
    }
  }

  return lookup;
}
