export function resolveBandDataId(bandId: string) {
  // Bands 7-9 share a merged payload on disk.
  if (bandId === 'band7' || bandId === 'band8' || bandId === 'band9' || bandId === 'advanced') {
    return 'band7-9';
  }
  return bandId;
}

export function resolveUnitIdForBand(bandId: string, unitId: string) {
  if (bandId === 'band2' && unitId === 'b2-directions') {
    return 'b2-places';
  }
  return unitId;
}

export function isMandarinBandId(levelId: string) {
  return /^band\d+$/i.test(levelId) || levelId === 'advanced';
}

export function isMandarinBandLocked(bandId: string, unlockedLevels: string[]) {
  if (!isMandarinBandId(bandId)) return false;
  return !unlockedLevels.includes(bandId);
}

export function nextBandId(bandId: string) {
  const match = /^band(\d+)$/i.exec(bandId);
  if (!match) return null;
  const current = Number(match[1]);
  if (!Number.isFinite(current) || current < 1 || current >= 9) return null;
  return `band${current + 1}`;
}
