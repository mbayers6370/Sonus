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

const TRACK_SEQUENCES: ReadonlyArray<ReadonlyArray<string>> = [
  ['band1', 'band2', 'band3', 'band4', 'band5', 'band6', 'band7', 'band8', 'band9', 'advanced'],
  ['n5', 'n4', 'n3', 'n2', 'n1'],
  ['topik1-1', 'topik1-2', 'topik2-3', 'topik2-4', 'topik2-5', 'topik2-6'],
  ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'],
] as const;

function normalizeLevelId(levelId: string) {
  return levelId.trim().toLowerCase();
}

function findTrackSequence(levelId: string) {
  const normalized = normalizeLevelId(levelId);
  return TRACK_SEQUENCES.find((sequence) => sequence.includes(normalized)) || null;
}

export function isTrackProgressionLevel(levelId: string) {
  return Boolean(findTrackSequence(levelId));
}

export function isTrackLevelLocked(levelId: string, unlockedLevels: string[]) {
  if (!isTrackProgressionLevel(levelId)) return false;
  return !unlockedLevels.includes(normalizeLevelId(levelId));
}

export function nextTrackLevelId(levelId: string) {
  const sequence = findTrackSequence(levelId);
  if (!sequence) return null;
  const normalized = normalizeLevelId(levelId);
  const idx = sequence.indexOf(normalized);
  if (idx < 0 || idx >= sequence.length - 1) return null;
  return sequence[idx + 1];
}

export function firstTrackLevelIds() {
  return TRACK_SEQUENCES.map((sequence) => sequence[0]);
}

export function isMandarinBandId(levelId: string) {
  return /^band\d+$/i.test(levelId) || normalizeLevelId(levelId) === 'advanced';
}

export function isMandarinBandLocked(bandId: string, unlockedLevels: string[]) {
  return isTrackLevelLocked(bandId, unlockedLevels);
}

export function nextBandId(bandId: string) {
  return nextTrackLevelId(bandId);
}
