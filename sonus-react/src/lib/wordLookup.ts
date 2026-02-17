import type { BandData, Word } from '../types/lesson.types';

export type WordLookup = Record<string, Pick<Word, 'id' | 'simp' | 'pinyin' | 'en'>>;

const BAND_IDS = ['band1', 'band2', 'band3', 'band4', 'band5', 'band6', 'band7', 'band8', 'band9'] as const;

export async function loadWordLookup(): Promise<WordLookup> {
  // Resolve all bands once so profile/review surfaces can render ids without
  // requiring the active band to be loaded in app state.
  const responses = await Promise.all(
    BAND_IDS.map(async (bandId) => {
      const response = await fetch(`/data/zh/${bandId}.json`, { cache: 'no-store' });
      if (!response.ok) return null;
      return (await response.json()) as BandData;
    })
  );

  const lookup: WordLookup = {};
  for (const bandData of responses) {
    if (!bandData) continue;
    // Later assignments overwrite duplicates by id, which is acceptable for
    // cross-band aliases where id is the canonical identity.
    const unitEntries = Object.values(bandData.units || {});
    for (const unit of unitEntries) {
      for (const word of unit.words || []) {
        lookup[word.id] = {
          id: word.id,
          simp: word.simp,
          pinyin: word.pinyin,
          en: word.en,
        };
      }
    }
  }

  return lookup;
}
