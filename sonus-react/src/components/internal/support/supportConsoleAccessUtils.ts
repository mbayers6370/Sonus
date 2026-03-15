import type {
  AccessCatalogBandOption,
  AccessCatalogUnitOption,
} from "./supportConsoleTypes";

const SUPPORT_ADMIN_TOKEN_STORAGE_KEY = "sonus.support_admin.token";
const ACCESS_BANDS_BY_LANGUAGE: Record<string, string[]> = {
  ja: ["n5", "n4", "n3", "n2", "n1"],
};

export const ACCESS_LANGUAGE_OPTIONS = [{ id: "ja", label: "Japanese" }] as const;

export function readSupportAdminToken() {
  try {
    return window.localStorage.getItem(SUPPORT_ADMIN_TOKEN_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function setSupportAdminToken(token: string | null) {
  try {
    if (!token) {
      window.localStorage.removeItem(SUPPORT_ADMIN_TOKEN_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SUPPORT_ADMIN_TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore localStorage errors.
  }
}

export function normalizeLanguageId(languageId: string | null | undefined) {
  const normalized = (languageId || "").trim().toLowerCase();
  if (!normalized) return "ja";
  if (normalized === "jp" || normalized === "japanese") return "ja";
  if (normalized === "ko" || normalized === "korean") return "kr";
  if (normalized === "french") return "fr";
  if (normalized === "italian") return "it";
  if (normalized === "spanish") return "es";
  if (
    normalized === "ja" ||
    normalized === "kr" ||
    normalized === "fr" ||
    normalized === "it" ||
    normalized === "es"
  )
    return normalized;
  return "ja";
}

export function languageLabel(languageId: string | null | undefined) {
  const normalized = normalizeLanguageId(languageId);
  if (normalized === "ja") return "Japanese";
  if (normalized === "kr") return "Korean";
  if (normalized === "fr") return "French";
  if (normalized === "it") return "Italian";
  if (normalized === "es") return "Spanish";
  return "Japanese";
}

function resolveBandDataPath(languageId: string, bandId: string) {
  const normalizedLanguage = normalizeLanguageId(languageId);
  if (normalizedLanguage === "ja") return `/data/ja/${bandId}.json`;
  return `/data/${normalizedLanguage}/${bandId}.json`;
}

function isPracticeUnitId(unitId: string) {
  return /listening$/i.test(unitId) || /speaking$/i.test(unitId);
}

function isCheckpointUnitId(unitId: string) {
  return /^checkpoint-\d+$/i.test(unitId);
}

function lessonCountFromWordCount(wordCount: number, maxWordsPerLesson = 10) {
  if (!Number.isFinite(wordCount) || wordCount <= 0) return 0;
  return Math.ceil(wordCount / maxWordsPerLesson);
}

function bandLabelFromId(bandId: string) {
  const normalized = bandId.trim().toLowerCase();
  if (/^band\d+$/i.test(normalized)) {
    const num = Number(normalized.replace("band", ""));
    if (Number.isFinite(num) && num > 0) return `Band ${num}`;
  }
  if (/^n[1-5]$/i.test(normalized)) return normalized.toUpperCase();
  return bandId.toUpperCase();
}

function extractCatalogUnits(rawPayload: unknown) {
  const record = (rawPayload || {}) as Record<string, unknown>;
  const directUnits = record.units;
  const byId = new Map<string, { title: string; wordCount: number }>();

  const upsertUnit = (
    id: string | null | undefined,
    title: string | null | undefined,
    words: unknown,
  ) => {
    const normalizedId = (id || "").trim();
    if (!normalizedId) return;
    const wordCount = Array.isArray(words) ? words.length : 0;
    byId.set(normalizedId, {
      title: (title || "").trim(),
      wordCount,
    });
  };

  if (Array.isArray(directUnits)) {
    for (const unit of directUnits) {
      const row = (unit || {}) as Record<string, unknown>;
      upsertUnit(
        typeof row.id === "string" ? row.id : null,
        typeof row.title === "string" ? row.title : null,
        row.words,
      );
    }
  } else if (directUnits && typeof directUnits === "object") {
    for (const [unitId, value] of Object.entries(
      directUnits as Record<string, unknown>,
    )) {
      const row = (value || {}) as Record<string, unknown>;
      upsertUnit(
        unitId,
        typeof row.title === "string" ? row.title : null,
        row.words,
      );
    }
  }

  const sections = Array.isArray(record.sections) ? record.sections : [];
  for (const section of sections) {
    const sectionRecord = (section || {}) as Record<string, unknown>;
    const sectionUnits = Array.isArray(sectionRecord.units)
      ? sectionRecord.units
      : [];
    for (const unit of sectionUnits) {
      const row = (unit || {}) as Record<string, unknown>;
      upsertUnit(
        typeof row.id === "string" ? row.id : null,
        typeof row.title === "string" ? row.title : null,
        row.words,
      );
    }
  }

  return byId;
}

export async function loadAccessCatalog(
  languageId: string,
): Promise<AccessCatalogBandOption[]> {
  const normalizedLanguage = normalizeLanguageId(languageId);
  const bandIds = ACCESS_BANDS_BY_LANGUAGE[normalizedLanguage] || [];
  const bands: AccessCatalogBandOption[] = [];

  for (const bandId of bandIds) {
    try {
      const response = await fetch(
        resolveBandDataPath(normalizedLanguage, bandId),
        {
          cache: "no-store",
        },
      );
      if (!response.ok) continue;
      const rawPayload = (await response.json()) as unknown;
      const unitWordCount = extractCatalogUnits(rawPayload);
      const baseUnits = Array.from(unitWordCount.entries())
        .map(([unitId, unit]) => {
          if (isPracticeUnitId(unitId) || isCheckpointUnitId(unitId))
            return null;
          const wordCount = unit.wordCount;
          const lessonCount = lessonCountFromWordCount(wordCount);
          return {
            id: unitId,
            label: unit.title || unitId,
            lessonCount,
            wordCount,
          };
        })
        .filter(
          (
            unit,
          ): unit is {
            id: string;
            label: string;
            lessonCount: number;
            wordCount: number;
          } => Boolean(unit && unit.lessonCount > 0),
        );
      const units: AccessCatalogUnitOption[] = baseUnits.map((unit, index) => ({
        ...unit,
        displayLabel: `Unit ${index + 1}: ${unit.label}`,
      }));

      if (!units.length) continue;
      bands.push({
        id: bandId,
        label: bandLabelFromId(bandId),
        units,
      });
    } catch {
      // Ignore missing curriculum payloads for disabled languages.
    }
  }

  return bands;
}
