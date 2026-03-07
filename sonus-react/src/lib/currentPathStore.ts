import { getMockIdentity } from './authSession';
import { normalizeLanguageId } from './languageRuntime';

export type CurrentPathRecord = {
  bandId: string;
  unitId: string;
  lessonIndex: number;
  updatedAt: string;
};

const CURRENT_PATH_STORAGE_KEY_PREFIX = 'sonus.current_path';

function resolveCurrentPathStorageKey() {
  const { userId, email } = getMockIdentity();
  const scope = (userId || email || 'anon')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_');
  return `${CURRENT_PATH_STORAGE_KEY_PREFIX}:${scope}`;
}

function inferLanguageFromBandId(bandId: string | null | undefined): string | null {
  if (!bandId) return null;
  if (/^n[1-5]$/i.test(bandId)) return 'ja';
  if (/^band\d+$/i.test(bandId) || bandId === 'advanced') return 'zh';
  return null;
}

export function readCachedCurrentPath(languageId?: string | null): CurrentPathRecord | null {
  try {
    const raw = window.localStorage.getItem(resolveCurrentPathStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CurrentPathRecord>;
    if (
      typeof parsed.bandId !== 'string' ||
      typeof parsed.unitId !== 'string' ||
      typeof parsed.lessonIndex !== 'number'
    ) {
      return null;
    }
    const currentPath: CurrentPathRecord = {
      bandId: parsed.bandId,
      unitId: parsed.unitId,
      lessonIndex: Math.max(0, parsed.lessonIndex),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
    if (!languageId) return currentPath;
    const normalizedLanguage = normalizeLanguageId(languageId);
    const inferredLanguage = inferLanguageFromBandId(currentPath.bandId);
    if (!normalizedLanguage || !inferredLanguage || normalizedLanguage !== inferredLanguage) return null;
    return currentPath;
  } catch {
    return null;
  }
}

export function writeCachedCurrentPath(path: {
  bandId: string;
  unitId: string;
  lessonIndex: number;
}) {
  try {
    const payload: CurrentPathRecord = {
      bandId: path.bandId,
      unitId: path.unitId,
      lessonIndex: Math.max(0, path.lessonIndex),
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(resolveCurrentPathStorageKey(), JSON.stringify(payload));
  } catch {
    // Ignore localStorage failures.
  }
}
