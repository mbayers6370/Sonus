export type LearnQuickStage = 'levels' | 'units' | 'lessons';

const JAPANESE_SECTION_ALIASES: Record<string, 'core' | 'expansion' | 'integration'> = {
  core: 'core',
  'base-i': 'core',
  expansion: 'expansion',
  'base-ii': 'expansion',
  integration: 'integration',
  widen: 'integration',
  connect: 'integration',
};

function mapJapaneseSectionId(
  sectionId: string | null | undefined
): 'core' | 'expansion' | 'integration' | null {
  if (!sectionId) return null;
  const normalized = sectionId.trim().toLowerCase();
  return JAPANESE_SECTION_ALIASES[normalized] || null;
}

export function deriveJapaneseSectionIdFromUnitId(
  bandId: string,
  unitId: string | null
): 'core' | 'expansion' | 'integration' | null {
  if (!unitId) return null;
  const bandPattern = bandId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionMatch = new RegExp(
    `^${bandPattern}-(core|expansion|integration|base-i|base-ii|widen|connect)(?:-|$)`,
    'i'
  ).exec(unitId);
  if (!sectionMatch) return null;
  return mapJapaneseSectionId(sectionMatch[1]);
}

export function extractUnitNumber(unitId: string | null | undefined): number | null {
  if (!unitId) return null;
  const numberMatch =
    /(?:^|[-_])u(\d+)(?:$|[-_])/i.exec(unitId) ||
    /(?:core|expansion|integration|base-i|base-ii|widen|connect)[-_ ]0*(\d+)(?:$|[-_ ])/i.exec(unitId);
  if (!numberMatch?.[1]) return null;
  const value = Number(numberMatch[1]);
  return Number.isFinite(value) ? value : null;
}

export function resolveLearnQuickStage(pathname: string, search: string): LearnQuickStage | null {
  if (!pathname.startsWith('/learn')) return null;
  const params = new URLSearchParams(search);
  const onLessonRoute = /^\/learn\/[^/]+\/[^/]+\/unit\/[^/]+\/lesson\/\d+\/[^/]+$/i.test(pathname);
  if (onLessonRoute) return 'lessons';

  const onBandRoute = /^\/learn\/[^/]+\/[^/]+$/i.test(pathname);
  const onJapaneseBandRoute = /^\/learn\/jlpt\/n[1-5]$/i.test(pathname);
  const sectionId = params.get('section');
  const unitId = params.get('unit');
  if (onJapaneseBandRoute) {
    if (unitId) return 'lessons';
    if (sectionId) return 'units';
    return 'levels';
  }
  if (onBandRoute) return unitId ? 'lessons' : 'units';
  return 'levels';
}
