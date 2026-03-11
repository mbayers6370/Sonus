import type { BandData, Word } from '../types/lesson.types';
import { normalizeBandDataPayload as normalizeBandDataPayloadRuntime } from './languageRuntime';
import { getWordReading } from './languageFields';

export type WordLookup = Record<string, Pick<Word, 'id' | 'simp' | 'transliteration' | 'reading' | 'pronunciation' | 'en'>>;

const JLPT_IDS = ['n5', 'n4', 'n3', 'n2', 'n1'] as const;

type LanguageId = 'ja';

function normalizeLanguage(languageId: string | null | undefined): LanguageId {
  void languageId;
  return 'ja';
}

function extractWords(bandData: BandData) {
  if (Array.isArray(bandData.units)) {
    return bandData.units.flatMap((unit) => unit.words || []);
  }
  return Object.values(bandData.units || {}).flatMap((unit) => unit.words || []);
}

export async function loadWordLookup(languageId?: string | null): Promise<WordLookup> {
  const language = normalizeLanguage(languageId);
  const bandIds = JLPT_IDS;

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
        transliteration: word.transliteration || '',
        reading: getWordReading(word),
        pronunciation: getWordReading(word),
        en: word.en || '',
      };
    }
  }

  return lookup;
}
