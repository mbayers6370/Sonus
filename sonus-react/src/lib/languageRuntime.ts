import type { BandData, Word } from '../types/lesson.types';
import { resolveBandDataId } from './bandIds';

export type LanguageId = 'zh' | 'ja' | (string & {});

export type LanguageRuntime = {
  id: LanguageId;
  label: string;
  homeCollectionLabel: 'Bands' | 'Levels';
  available: boolean;
};

const LANGUAGE_RUNTIMES: Record<string, LanguageRuntime> = {
  zh: { id: 'zh', label: 'Mandarin', homeCollectionLabel: 'Bands', available: true },
  ja: { id: 'ja', label: 'Japanese', homeCollectionLabel: 'Levels', available: true },
  kr: { id: 'kr', label: 'Korean', homeCollectionLabel: 'Levels', available: false },
  fr: { id: 'fr', label: 'French', homeCollectionLabel: 'Levels', available: false },
  it: { id: 'it', label: 'Italian', homeCollectionLabel: 'Levels', available: false },
  es: { id: 'es', label: 'Spanish', homeCollectionLabel: 'Levels', available: false },
};

export function normalizeLanguageId(languageId: string | null | undefined): string {
  const normalized = (languageId || '').trim().toLowerCase();
  if (!normalized) return 'zh';
  if (normalized === 'jp') return 'ja';
  return normalized;
}

export function getLanguageRuntime(languageId: string | null | undefined): LanguageRuntime {
  const id = normalizeLanguageId(languageId);
  return (
    LANGUAGE_RUNTIMES[id] || {
      id,
      label: 'Language',
      homeCollectionLabel: 'Levels',
      available: false,
    }
  );
}

export function inferLanguageForBand(bandId: string, selectedLanguage: string | null): string {
  if (/^n[1-5]$/i.test(bandId)) return 'ja';
  return normalizeLanguageId(selectedLanguage);
}

export function resolveBandDataPath(languageId: string, bandId: string): string {
  if (languageId === 'zh') {
    return `/data/zh/${resolveBandDataId(bandId)}.json`;
  }
  return `/data/${languageId}/${bandId}.json`;
}

export function resolveApplyDataPaths(languageId: string, bandId: string): string[] {
  const normalized = normalizeLanguageId(languageId);
  const paths = [
    `/data/${normalized}/apply/${bandId}-apply.json`,
    `/data/${normalized}/apply/${bandId}.apply.json`,
    `/data/${normalized}/${bandId}-apply.json`,
    `/data/${normalized}/${bandId}.apply.json`,
  ];
  if (normalized !== 'zh') {
    // Backward compatibility while non-Mandarin apply JSON is rolled out.
    paths.push(
      `/data/zh/apply/${bandId}-apply.json`,
      `/data/zh/apply/${bandId}.apply.json`,
      `/data/zh/${bandId}-apply.json`,
      `/data/zh/${bandId}.apply.json`
    );
  }
  return paths;
}

function normalizeWordForRuntime(rawWord: Record<string, unknown>): Word | null {
  if (typeof rawWord.id !== 'string') return null;
  if (typeof rawWord.simp === 'string' && typeof rawWord.trad === 'string') {
    return rawWord as unknown as Word;
  }

  const exampleRaw = (rawWord.example || {}) as Record<string, unknown>;
  const kanji = typeof rawWord.kanji === 'string' ? rawWord.kanji.trim() : '';
  const hiragana = typeof rawWord.hiragana === 'string' ? rawWord.hiragana.trim() : '';
  const romaji = typeof rawWord.romaji === 'string' ? rawWord.romaji.trim() : '';

  return {
    id: rawWord.id,
    simp: kanji || hiragana,
    trad: kanji || hiragana,
    pinyin: romaji,
    pos: typeof rawWord.pos === 'string' ? rawWord.pos : '',
    en: typeof rawWord.en === 'string' ? rawWord.en : '',
    defs: Array.isArray(rawWord.defs)
      ? rawWord.defs.filter((value): value is string => typeof value === 'string')
      : [],
    isReview: typeof rawWord.isReview === 'boolean' ? rawWord.isReview : false,
    example: {
      zh:
        typeof exampleRaw.zh === 'string'
          ? exampleRaw.zh
          : (typeof exampleRaw.ja === 'string' ? exampleRaw.ja : undefined),
      en: typeof exampleRaw.en === 'string' ? exampleRaw.en : undefined,
      pinyin:
        typeof exampleRaw.pinyin === 'string'
          ? exampleRaw.pinyin
          : (typeof exampleRaw.romaji === 'string' ? exampleRaw.romaji : undefined),
    },
  };
}

export function normalizeBandDataPayload(
  rawPayload: unknown,
  bandId: string,
  languageId: string
): BandData | null {
  if (!rawPayload || typeof rawPayload !== 'object') return null;
  const raw = rawPayload as Record<string, unknown>;

  if (raw.units) {
    const unitsRaw = raw.units;
    if (Array.isArray(unitsRaw)) {
      const units = unitsRaw
        .map((unit) => {
          const record = (unit || {}) as Record<string, unknown>;
          const id = typeof record.id === 'string' ? record.id : null;
          if (!id) return null;
          const words = Array.isArray(record.words)
            ? record.words
                .map((word) => normalizeWordForRuntime((word || {}) as Record<string, unknown>))
                .filter((word): word is Word => Boolean(word))
            : [];
          return {
            ...(record as Record<string, unknown>),
            id,
            words,
          };
        })
        .filter(Boolean);
      return {
        language: (typeof raw.language === 'string' && raw.language) || languageId,
        source: typeof raw.source === 'string' ? raw.source : '',
        bandId: typeof raw.bandId === 'string' ? raw.bandId : bandId,
        band: typeof raw.band === 'number' ? raw.band : 0,
        wordCount:
          typeof raw.wordCount === 'number'
            ? raw.wordCount
            : units.reduce(
                (n, unit) => n + ((unit as { words?: Word[] }).words?.length || 0),
                0
              ),
        availableWords:
          typeof raw.availableWords === 'number'
            ? raw.availableWords
            : units.reduce(
                (n, unit) => n + ((unit as { words?: Word[] }).words?.length || 0),
                0
              ),
        unallocatedWords: typeof raw.unallocatedWords === 'number' ? raw.unallocatedWords : 0,
        units: units as BandData['units'],
      };
    }

    if (unitsRaw && typeof unitsRaw === 'object') {
      const normalizedUnits: Record<string, { words?: Word[] }> = {};
      for (const [unitId, unitValue] of Object.entries(unitsRaw as Record<string, unknown>)) {
        const record = (unitValue || {}) as Record<string, unknown>;
        const words = Array.isArray(record.words)
          ? record.words
              .map((word) => normalizeWordForRuntime((word || {}) as Record<string, unknown>))
              .filter((word): word is Word => Boolean(word))
          : [];
        normalizedUnits[unitId] = { ...record, words } as { words?: Word[] };
      }
      const count = Object.values(normalizedUnits).reduce(
        (n, unit) => n + (unit.words?.length || 0),
        0
      );
      return {
        language: (typeof raw.language === 'string' && raw.language) || languageId,
        source: typeof raw.source === 'string' ? raw.source : '',
        bandId: typeof raw.bandId === 'string' ? raw.bandId : bandId,
        band: typeof raw.band === 'number' ? raw.band : 0,
        wordCount: typeof raw.wordCount === 'number' ? raw.wordCount : count,
        availableWords: typeof raw.availableWords === 'number' ? raw.availableWords : count,
        unallocatedWords: typeof raw.unallocatedWords === 'number' ? raw.unallocatedWords : 0,
        units: normalizedUnits as BandData['units'],
      };
    }
  }

  const rawWords = Array.isArray(raw.words) ? raw.words : [];
  const words = rawWords
    .map((word) => normalizeWordForRuntime((word || {}) as Record<string, unknown>))
    .filter((word): word is Word => Boolean(word));
  if (!words.length) return null;
  const coreUnitId = `${bandId}-core`;
  return {
    language: (typeof raw.language === 'string' && raw.language) || languageId,
    source: typeof raw.source === 'string' ? raw.source : '',
    bandId: typeof raw.bandId === 'string' ? raw.bandId : bandId,
    band: typeof raw.band === 'number' ? raw.band : 0,
    wordCount: typeof raw.wordCount === 'number' ? raw.wordCount : words.length,
    availableWords: words.length,
    unallocatedWords: 0,
    units: [
      {
        id: coreUnitId,
        band: 0,
        targetWords: words.length,
        allocatedWords: words.length,
        words,
      },
    ],
  };
}
