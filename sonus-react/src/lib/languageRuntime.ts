import type { BandData, Word } from '../types/lesson.types';
import { resolveBandDataId } from './bandIds';

export type LanguageId = 'zh' | 'ja' | (string & {});

export type LanguageRuntime = {
  id: LanguageId;
  label: string;
  homeCollectionLabel: 'Levels';
  available: boolean;
};

const LANGUAGE_RUNTIMES: Record<string, LanguageRuntime> = {
  zh: { id: 'zh', label: 'Mandarin', homeCollectionLabel: 'Levels', available: true },
  ja: { id: 'ja', label: 'Japanese', homeCollectionLabel: 'Levels', available: true },
  kr: { id: 'kr', label: 'Korean', homeCollectionLabel: 'Levels', available: false },
  fr: { id: 'fr', label: 'French', homeCollectionLabel: 'Levels', available: false },
  it: { id: 'it', label: 'Italian', homeCollectionLabel: 'Levels', available: false },
  es: { id: 'es', label: 'Spanish', homeCollectionLabel: 'Levels', available: false },
};

const DEFAULT_JA_SECTIONS = [
  { id: 'base-i', title: 'Base I', subtitle: 'Concrete & Physical' },
  { id: 'base-ii', title: 'Base II', subtitle: 'Situational & Common Context' },
  { id: 'widen', title: 'Widen', subtitle: 'Sentence Glue' },
  { id: 'connect', title: 'Connect', subtitle: 'Advanced Society & Nuance' },
] as const;
const JA_SEQUENTIAL_UNIT_SIZE = 80;

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
  const tags = Array.isArray(rawWord.tags)
    ? rawWord.tags.filter((value): value is string => typeof value === 'string')
    : undefined;
  if (typeof rawWord.simp === 'string' && typeof rawWord.trad === 'string') {
    const pinyinValue =
      typeof rawWord.pinyin === 'string'
        ? rawWord.pinyin
        : (typeof rawWord.romaji === 'string' ? rawWord.romaji : '');
    const readingValue =
      typeof rawWord.reading === 'string'
        ? rawWord.reading
        : (typeof rawWord.pronunciation === 'string' ? rawWord.pronunciation : pinyinValue);
    return {
      ...(rawWord as unknown as Word),
      pinyin: pinyinValue,
      reading: readingValue,
      pronunciation: readingValue,
      tags,
    };
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
    reading: romaji,
    pronunciation: romaji,
    tags,
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
      reading:
        typeof exampleRaw.reading === 'string'
          ? exampleRaw.reading
          : (
              typeof exampleRaw.pronunciation === 'string'
                ? exampleRaw.pronunciation
                : (
                    typeof exampleRaw.pinyin === 'string'
                      ? exampleRaw.pinyin
                      : (typeof exampleRaw.romaji === 'string' ? exampleRaw.romaji : undefined)
                  )
            ),
      pronunciation:
        typeof exampleRaw.pronunciation === 'string'
          ? exampleRaw.pronunciation
          : (
              typeof exampleRaw.reading === 'string'
                ? exampleRaw.reading
                : (
                    typeof exampleRaw.pinyin === 'string'
                      ? exampleRaw.pinyin
                      : (typeof exampleRaw.romaji === 'string' ? exampleRaw.romaji : undefined)
                  )
            ),
    },
  };
}

function buildJapaneseSequentialBandData(
  raw: Record<string, unknown>,
  bandId: string,
  languageId: string
): BandData | null {
  const wordsById = new Map<string, Word>();
  const addWord = (rawWord: unknown) => {
    const normalized = normalizeWordForRuntime((rawWord || {}) as Record<string, unknown>);
    if (!normalized) return;
    wordsById.set(normalized.id, normalized);
  };

  const rawSections = Array.isArray(raw.sections) ? raw.sections : [];
  const sectionHasUnits = rawSections.some((section) =>
    Array.isArray(((section || {}) as Record<string, unknown>).units)
  );
  const explicitSectionWords = rawSections.some(
    (section) => Array.isArray((section as Record<string, unknown>)?.words)
  );

  if (explicitSectionWords) {
    for (const section of rawSections) {
      const sectionRecord = (section || {}) as Record<string, unknown>;
      for (const rawWord of Array.isArray(sectionRecord.words) ? sectionRecord.words : []) {
        addWord(rawWord);
      }
    }
  }

  if (!wordsById.size && sectionHasUnits) {
    for (const section of rawSections) {
      const sectionRecord = (section || {}) as Record<string, unknown>;
      for (const rawUnit of Array.isArray(sectionRecord.units) ? sectionRecord.units : []) {
        const unitRecord = (rawUnit || {}) as Record<string, unknown>;
        for (const rawWord of Array.isArray(unitRecord.words) ? unitRecord.words : []) {
          addWord(rawWord);
        }
      }
    }
  }

  if (!wordsById.size && Array.isArray(raw.words)) {
    for (const rawWord of raw.words) addWord(rawWord);
  }

  if (!wordsById.size && Array.isArray(raw.units)) {
    for (const rawUnit of raw.units) {
      const unitRecord = (rawUnit || {}) as Record<string, unknown>;
      for (const rawWord of Array.isArray(unitRecord.words) ? unitRecord.words : []) {
        addWord(rawWord);
      }
    }
  }

  if (!wordsById.size) return null;
  const allWords = Array.from(wordsById.values());

  const hasMappedSections = rawSections.some((section) => {
    const record = (section || {}) as Record<string, unknown>;
    return (
      (Array.isArray(record.words) && record.words.length > 0) ||
      (Array.isArray(record.wordIds) && record.wordIds.length > 0)
    );
  });

  const mappedSectionRows = rawSections
    .map((section, index) => {
      const record = (section || {}) as Record<string, unknown>;
      const sectionId =
        typeof record.id === 'string' && record.id.trim()
          ? record.id.trim().toLowerCase()
          : `section-${index + 1}`;
      const title =
        typeof record.title === 'string' && record.title.trim()
          ? record.title.trim()
          : `Section ${index + 1}`;
      const subtitle =
        typeof record.subtitle === 'string' && record.subtitle.trim()
          ? record.subtitle.trim()
          : undefined;
      const sectionWords = Array.isArray(record.words)
        ? record.words
            .map((rawWord) => normalizeWordForRuntime((rawWord || {}) as Record<string, unknown>))
            .filter((word): word is Word => Boolean(word))
        : [];
      const sectionWordIds = Array.isArray(record.wordIds)
        ? record.wordIds.filter((value): value is string => typeof value === 'string')
        : [];
      const words =
        sectionWords.length > 0
          ? sectionWords
          : sectionWordIds
              .map((id) => wordsById.get(id))
              .filter((word): word is Word => Boolean(word));

      const units = Array.isArray(record.units)
        ? record.units
            .map((rawUnit, unitIndex) => {
              const unitRecord = (rawUnit || {}) as Record<string, unknown>;
              const explicitUnitId =
                typeof unitRecord.id === 'string' && unitRecord.id.trim()
                  ? unitRecord.id.trim()
                  : `${bandId}-${sectionId}-u${String(unitIndex + 1).padStart(2, '0')}`;
              const unitWordsFromObjects = Array.isArray(unitRecord.words)
                ? unitRecord.words
                    .map((rawWord) =>
                      normalizeWordForRuntime((rawWord || {}) as Record<string, unknown>)
                    )
                    .filter((word): word is Word => Boolean(word))
                : [];
              const unitWordIds = Array.isArray(unitRecord.wordIds)
                ? unitRecord.wordIds.filter((value): value is string => typeof value === 'string')
                : [];
              const unitWords =
                unitWordsFromObjects.length > 0
                  ? unitWordsFromObjects
                  : unitWordIds
                      .map((id) => wordsById.get(id))
                      .filter((word): word is Word => Boolean(word));
              return {
                id: explicitUnitId,
                title:
                  typeof unitRecord.title === 'string' && unitRecord.title.trim()
                    ? unitRecord.title.trim()
                    : undefined,
                description:
                  typeof unitRecord.description === 'string' && unitRecord.description.trim()
                    ? unitRecord.description.trim()
                    : undefined,
                words: unitWords,
              };
            })
            .filter((unit) => unit.words.length > 0)
        : [];

      return { id: sectionId, title, subtitle, words, units };
    })
    .filter((section) => section.words.length > 0 || section.units.length > 0);

  const sectionRows = hasMappedSections || sectionHasUnits
    ? mappedSectionRows
    : DEFAULT_JA_SECTIONS.map((section, index) => {
        const start = Math.floor((allWords.length * index) / DEFAULT_JA_SECTIONS.length);
        const end = Math.floor((allWords.length * (index + 1)) / DEFAULT_JA_SECTIONS.length);
        return {
          id: section.id,
          title: section.title,
          subtitle: section.subtitle,
          words: allWords.slice(start, end),
          units: [],
        };
      });

  const generatedUnits: BandData['units'] = [];
  const sectionMeta: NonNullable<BandData['sections']> = [];
  for (const section of sectionRows) {
    const unitIds: string[] = [];
    if (section.units.length > 0) {
      for (const unit of section.units) {
        unitIds.push(unit.id);
        generatedUnits.push({
          id: unit.id,
          title: unit.title,
          description: unit.description,
          targetWords: unit.words.length,
          allocatedWords: unit.words.length,
          words: unit.words,
        });
      }
    } else {
      for (let i = 0; i < section.words.length; i += JA_SEQUENTIAL_UNIT_SIZE) {
        const chunkWords = section.words.slice(i, i + JA_SEQUENTIAL_UNIT_SIZE);
        const chunkIndex = Math.floor(i / JA_SEQUENTIAL_UNIT_SIZE) + 1;
        const unitId = `${bandId}-${section.id}-u${String(chunkIndex).padStart(2, '0')}`;
        unitIds.push(unitId);
        generatedUnits.push({
          id: unitId,
          targetWords: chunkWords.length,
          allocatedWords: chunkWords.length,
          words: chunkWords,
        });
      }
    }
    sectionMeta.push({
      id: section.id,
      title: section.title,
      subtitle: section.subtitle,
      unitIds,
    });
  }

  const total = generatedUnits.reduce((sum, unit) => sum + ((unit.words || []).length), 0);
  return {
    language: (typeof raw.language === 'string' && raw.language) || languageId,
    source: typeof raw.source === 'string' ? raw.source : '',
    bandId:
      typeof raw.bandId === 'string'
        ? raw.bandId
        : (typeof raw.levelId === 'string' ? raw.levelId : bandId),
    band:
      typeof raw.band === 'number'
        ? raw.band
        : (typeof raw.level === 'number' ? raw.level : 0),
    wordCount: typeof raw.wordCount === 'number' ? raw.wordCount : total,
    availableWords: total,
    unallocatedWords: 0,
    sections: sectionMeta,
    units: generatedUnits,
  };
}

export function normalizeBandDataPayload(
  rawPayload: unknown,
  bandId: string,
  languageId: string
): BandData | null {
  if (!rawPayload || typeof rawPayload !== 'object') return null;
  const raw = rawPayload as Record<string, unknown>;
  const normalizedLanguageId = normalizeLanguageId(languageId);

  if (normalizedLanguageId === 'ja') {
    const generated = buildJapaneseSequentialBandData(raw, bandId, normalizedLanguageId);
    if (generated) return generated;
  }

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
        bandId:
          typeof raw.bandId === 'string'
            ? raw.bandId
            : (typeof raw.levelId === 'string' ? raw.levelId : bandId),
        band:
          typeof raw.band === 'number'
            ? raw.band
            : (typeof raw.level === 'number' ? raw.level : 0),
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
        bandId:
          typeof raw.bandId === 'string'
            ? raw.bandId
            : (typeof raw.levelId === 'string' ? raw.levelId : bandId),
        band:
          typeof raw.band === 'number'
            ? raw.band
            : (typeof raw.level === 'number' ? raw.level : 0),
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
    bandId:
      typeof raw.bandId === 'string'
        ? raw.bandId
        : (typeof raw.levelId === 'string' ? raw.levelId : bandId),
    band:
      typeof raw.band === 'number'
        ? raw.band
        : (typeof raw.level === 'number' ? raw.level : 0),
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
