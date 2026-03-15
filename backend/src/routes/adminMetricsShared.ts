import { Prisma } from '@prisma/client';

export const REPORT_SESSION_GAP_MINUTES = 30;

export function toInt(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function toFloat(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function percentile(values: number[], target: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const clamped = Math.min(1, Math.max(0, target));
  const index = (sorted.length - 1) * clamped;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? 0;
  const weight = index - lower;
  const low = sorted[lower] ?? 0;
  const high = sorted[upper] ?? 0;
  return low + (high - low) * weight;
}

export const supportedAdminLanguageIds = ['ja', 'zh', 'kr', 'fr', 'it', 'es'] as const;
export const supportedAdminLanguageSql = Prisma.join(
  supportedAdminLanguageIds.map((languageId) => Prisma.sql`${languageId}`)
);
export const supportedSpeakMissHotspotLanguageIds = supportedAdminLanguageIds.filter(
  (languageId) => languageId !== 'zh'
);
export const supportedSpeakMissHotspotLanguageSql = Prisma.join(
  supportedSpeakMissHotspotLanguageIds.map((languageId) => Prisma.sql`${languageId}`)
);
export const normalizedProfileLanguageSql = Prisma.sql`
  CASE
    WHEN COALESCE(NULLIF(LOWER(p.target_language), ''), 'unknown') IN ('ja', 'jp', 'japanese') THEN 'ja'
    WHEN COALESCE(NULLIF(LOWER(p.target_language), ''), 'unknown') IN ('zh', 'cn', 'chinese', 'mandarin') THEN 'zh'
    WHEN COALESCE(NULLIF(LOWER(p.target_language), ''), 'unknown') IN ('kr', 'ko', 'korean') THEN 'kr'
    WHEN COALESCE(NULLIF(LOWER(p.target_language), ''), 'unknown') IN ('fr', 'french') THEN 'fr'
    WHEN COALESCE(NULLIF(LOWER(p.target_language), ''), 'unknown') IN ('it', 'italian') THEN 'it'
    WHEN COALESCE(NULLIF(LOWER(p.target_language), ''), 'unknown') IN ('es', 'spanish') THEN 'es'
    ELSE 'unknown'
  END
`;
export const impactPopulationFilterSql = Prisma.sql`
  (
    ${normalizedProfileLanguageSql} IN (${supportedAdminLanguageSql})
    OR ${normalizedProfileLanguageSql} = 'unknown'
  )
`;

export function normalizeAdminLanguageId(value: string | null | undefined) {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'jp' || normalized === 'japanese') return 'ja';
  if (normalized === 'cn' || normalized === 'chinese' || normalized === 'mandarin') return 'zh';
  if (normalized === 'ko' || normalized === 'korean') return 'kr';
  if (normalized === 'french') return 'fr';
  if (normalized === 'italian') return 'it';
  if (normalized === 'spanish') return 'es';
  if (
    normalized === 'zh' ||
    normalized === 'ja' ||
    normalized === 'kr' ||
    normalized === 'fr' ||
    normalized === 'it' ||
    normalized === 'es'
  ) {
    return normalized;
  }
  return null;
}
