import { getUnitsForBand, isCheckpointUnitId, isPracticeUnitId } from '../data/unitMetadata';
import { getLessonRanges } from './lessonChunks';
import { makeLessonKey } from './lessonProgress';

type LessonProgressEntry = {
  completed?: boolean;
  quizScore?: number | null;
  speakScore?: number | null;
};

type LessonProgressMap = Record<string, LessonProgressEntry | undefined>;

type BandDataLike = {
  units?: Record<string, { words?: unknown[] }> | Array<{ id?: string; words?: unknown[] }>;
};

export function getStarterBandIdForLanguage(languageId: string) {
  if (languageId === 'ja') return 'n5';
  if (languageId === 'zh') return 'band1';
  if (languageId === 'kr') return 'topik1-1';
  if (languageId === 'fr') return 'a1';
  return 'band1';
}

function getUnitWordsCount(bandData: BandDataLike, unitId: string) {
  const units = bandData.units;
  if (!units) return 0;
  if (Array.isArray(units)) {
    return (units.find((unit) => unit?.id === unitId)?.words || []).length;
  }
  return (units[unitId]?.words || []).length;
}

function getFirstCoreUnitId(bandId: string, bandData: BandDataLike) {
  return getUnitsForBand(bandId, bandData)
    .filter((unit) => !isPracticeUnitId(unit.id) && !isCheckpointUnitId(unit.id))
    .sort((a, b) => a.order - b.order)[0]?.id || null;
}

export function isStarterUnitCompleted(input: {
  starterBandId: string;
  bandData: BandDataLike;
  lessonProgress: LessonProgressMap;
  isInstructionalComplete: (quizScore: number | null | undefined, speakScore: number | null | undefined) => boolean;
}) {
  const { starterBandId, bandData, lessonProgress, isInstructionalComplete } = input;
  const firstCoreUnitId = getFirstCoreUnitId(starterBandId, bandData);
  if (!firstCoreUnitId) return true;
  const wordsCount = getUnitWordsCount(bandData, firstCoreUnitId);
  const lessonCount = getLessonRanges(wordsCount, 10).length;
  if (lessonCount <= 0) return false;
  return Array.from({ length: lessonCount }).every((_, lessonIndex) => {
    const lessonKey = makeLessonKey(starterBandId, firstCoreUnitId, lessonIndex);
    const status = lessonProgress[lessonKey];
    return Boolean(status?.completed || isInstructionalComplete(status?.quizScore, status?.speakScore));
  });
}
