import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { BookOpen, Check, LockKeyhole, MessageSquare } from 'lucide-react';
import { getUnitsForBand, isCheckpointUnitId, isPracticeUnitId, parseCheckpointIndex } from '../data/unitMetadata';
import BottomNav from './BottomNav';
import { getLessonRanges } from '../lib/lessonChunks';
import { makeLessonKey } from '../lib/lessonProgress';
import GlassHeader from './GlassHeader';
import { QUIZ_PASS_PERCENT, SPEAK_PASS_PERCENT } from '../lib/passCriteria';
import type { LessonMode } from '../types/lesson.types';
import { firstTrackLevelIds, isReleasedTrackLevel, nextTrackLevelId } from '../lib/bandIds';
import { getExampleNative } from '../lib/languageFields';

const LESSON_UNLOCK_PASS_PERCENT = 85;
const isInstructionalComplete = (quizScore: number | null | undefined, speakScore: number | null | undefined) =>
  (quizScore ?? 0) >= QUIZ_PASS_PERCENT && (speakScore ?? 0) >= SPEAK_PASS_PERCENT;
const hasLessonUnlockCredit = (status: { completed?: boolean; quizScore?: number | null; speakScore?: number | null } | undefined) =>
  Boolean(status?.completed || isInstructionalComplete(status?.quizScore, status?.speakScore) || (status?.quizScore ?? 0) >= LESSON_UNLOCK_PASS_PERCENT);

function compareTrackLevelOrder(levelId: string | null | undefined, targetLevelId: string | null | undefined) {
  const level = (levelId || '').trim().toLowerCase();
  const target = (targetLevelId || '').trim().toLowerCase();
  if (!level || !target) return null as number | null;
  for (const firstLevelId of firstTrackLevelIds()) {
    const chain: string[] = [];
    let cursor: string | null = firstLevelId;
    while (cursor) {
      chain.push(cursor);
      cursor = nextTrackLevelId(cursor);
    }
    const levelIdx = chain.indexOf(level);
    const targetIdx = chain.indexOf(target);
    if (levelIdx >= 0 && targetIdx >= 0) return levelIdx - targetIdx;
  }
  return null as number | null;
}

const CARD_ACCENTS = [
  {
    borderColor: 'border-[var(--sonus-palette-blue)]/55',
    badgeBg: 'bg-[rgba(19,87,119,0.12)]',
    badgeText: 'text-[var(--sonus-palette-blue)]',
    progressFill: 'bg-[var(--sonus-palette-blue)]/55',
    hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(19,87,119,0.28)]',
  },
  {
    borderColor: 'border-[var(--sonus-palette-green)]/55',
    badgeBg: 'bg-[rgba(25,50,50,0.12)]',
    badgeText: 'text-[var(--sonus-palette-green)]',
    progressFill: 'bg-[var(--sonus-palette-green)]/55',
    hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(25,50,50,0.26)]',
  },
  {
    borderColor: 'border-[var(--sonus-palette-charcoal)]/55',
    badgeBg: 'bg-[rgba(31,42,55,0.10)]',
    badgeText: 'text-[var(--sonus-palette-charcoal)]',
    progressFill: 'bg-[var(--sonus-palette-charcoal)]/55',
    hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(31,42,55,0.24)]',
  },
  {
    borderColor: 'border-[var(--sonus-palette-rust)]/55',
    badgeBg: 'bg-[rgba(194,65,12,0.12)]',
    badgeText: 'text-[var(--sonus-palette-rust)]',
    progressFill: 'bg-[var(--sonus-palette-rust)]/55',
    hoverShadow: 'hover:shadow-[0_20px_40px_-24px_rgba(194,65,12,0.30)]',
  },
] as const;

function drenchedBorderClassFromAccent(accentBadgeText: string) {
  if (accentBadgeText === 'text-[var(--sonus-palette-blue)]') return 'sonus-drenched-border-ocean';
  if (accentBadgeText === 'text-[var(--sonus-palette-green)]') return 'sonus-drenched-border-green';
  if (accentBadgeText === 'text-[var(--sonus-palette-charcoal)]') return 'sonus-drenched-border-charcoal';
  return '';
}

interface UnitSelectProps {
  onSelectLesson: (unitId: string, lessonIndex: number, mode?: LessonMode) => void;
  onOpenPractice: (unitId: string) => void;
  onGoHome: () => void;
  onOpenProfile: () => void;
  walkthroughHighlightLevels?: boolean;
  walkthroughHighlightUnits?: boolean;
  walkthroughHighlightLessons?: boolean;
}

function getUnitDataById(
  units: Record<string, { words?: unknown[] }> | Array<{ id?: string; words?: unknown[] }> | undefined,
  unitId: string
) {
  if (!units) return null;
  // Normalize id variants so merged/split unit payloads still resolve correctly.
  const canonical = (id?: string) =>
    (id || '')
      .replace(/^[a-z]\d+-u\d+-/i, '')
      .replace(/^[a-z]\d+-/i, '');
  if (Array.isArray(units)) {
    const direct = units.find((unit) => unit?.id === unitId);
    if (direct) return direct;
    const targetKey = canonical(unitId);
    const matched = units.filter((unit) => canonical(unit?.id) === targetKey);
    if (!matched.length) return null;
    return {
      id: unitId,
      words: matched.flatMap((unit) => unit?.words || []),
    };
  }
  if (units[unitId]) return units[unitId];
  const targetKey = canonical(unitId);
  const matchedEntries = Object.entries(units).filter(([id]) => canonical(id) === targetKey);
  if (!matchedEntries.length) return null;
  return {
    id: unitId,
    words: matchedEntries.flatMap(([, unit]) => unit?.words || []),
  };
}

function getDataUnits(
  units:
    | Record<string, { words?: unknown[]; title?: string; description?: string }>
    | Array<{ id?: string; words?: unknown[]; title?: string; description?: string }>
    | undefined
) {
  if (!units) return [] as Array<{ id: string; words: unknown[]; title?: string; description?: string }>;
  if (Array.isArray(units)) {
    return units
      .filter((unit): unit is { id: string; words?: unknown[]; title?: string; description?: string } => Boolean(unit?.id))
      .map((unit) => ({ id: unit.id, words: unit.words || [], title: unit.title, description: unit.description }));
  }
  return Object.entries(units).map(([id, unit]) => ({
    id,
    words: unit?.words || [],
    title: unit?.title,
    description: unit?.description,
  }));
}

function getGridColumns(width: number) {
  if (width >= 1536) return 6; // 2xl
  if (width >= 1280) return 5; // xl
  if (width >= 1024) return 4; // lg
  if (width >= 768) return 3; // md
  return 2; // base/sm
}

function getPracticeType(unitId: string): 'listening' | 'speaking' | 'checkpoint' | null {
  if (isCheckpointUnitId(unitId)) return 'checkpoint';
  if (/listening$/i.test(unitId)) return 'listening';
  if (/speaking$/i.test(unitId)) return 'speaking';
  return null;
}

function deriveScriptPreviewFromWords(words: unknown[]) {
  for (const rawWord of words || []) {
    const word = rawWord as { simp?: string; trad?: string; kanji?: string };
    const scriptSource = (word.simp || word.trad || word.kanji || '').trim();
    if (!scriptSource) continue;
    const nativeLabel = scriptSource.replace(/[^\p{Script=Han}]/gu, '');
    if (nativeLabel) return Array.from(nativeLabel).slice(0, 8).join('');
  }
  return '';
}

export default function UnitSelect({
  onSelectLesson,
  onOpenPractice,
  onGoHome,
  onOpenProfile,
  walkthroughHighlightLevels = false,
  walkthroughHighlightUnits = false,
  walkthroughHighlightLessons = false,
}: UnitSelectProps) {
  const { state } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentLevel, activeBandData, lessonProgress, resumeCheckpoint } = state;
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === 'undefined' ? 1280 : window.innerWidth
  );
  const [animateProgressBars, setAnimateProgressBars] = useState(false);
  const activeUnitId = searchParams.get('unit');
  const activeSectionId = searchParams.get('section');

  const setActiveUnit = (unitId: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (unitId) {
      next.set('unit', unitId);
    } else {
      next.delete('unit');
    }
    setSearchParams(next);
  };
  const setActiveSection = (sectionId: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (sectionId) {
      next.set('section', sectionId);
    } else {
      next.delete('section');
    }
    next.delete('unit');
    setSearchParams(next);
  };
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!currentLevel?.id) return;
    const timer = window.setTimeout(() => setAnimateProgressBars(true), 40);
    return () => window.clearTimeout(timer);
  }, [currentLevel?.id, activeSectionId]);

  useEffect(() => {
    if (!currentLevel || !activeBandData) return;
    const selectedLanguageId = (state.selectedLanguage || '').toLowerCase();
    const isJapaneseLevel = selectedLanguageId === 'ja';
    const availableSections = isJapaneseLevel && Array.isArray(activeBandData.sections)
      ? activeBandData.sections
      : [];
    if (!isJapaneseLevel || availableSections.length === 0) return;
    const sectionIds = new Set(
      availableSections.map((section) => section.id).filter((id): id is string => Boolean(id))
    );
    const currentSectionId = searchParams.get('section');
    if (currentSectionId && sectionIds.has(currentSectionId)) return;
    const fallbackSectionId = availableSections.find((section) => section.id)?.id || null;
    if (!fallbackSectionId) return;
    const next = new URLSearchParams(searchParams);
    next.set('section', fallbackSectionId);
    next.delete('unit');
    setSearchParams(next, { replace: true });
  }, [activeBandData, currentLevel, searchParams, setSearchParams, state.selectedLanguage]);

  if (!currentLevel || !activeBandData) {
    return (
      <div className="flex items-center justify-center h-screen page-shell">
        <p className="text-text-med">Loading...</p>
      </div>
    );
  }

  // Get unit metadata for proper ordering and display
  const configuredUnits = getUnitsForBand(currentLevel.id, activeBandData);
  const dataUnits = getDataUnits(
    activeBandData.units as Record<string, { words?: unknown[]; title?: string; description?: string }>
      | Array<{ id?: string; words?: unknown[]; title?: string; description?: string }>
  ).filter((unit) => unit.id !== '_unallocated');
  const configuredCoreUnits = configuredUnits.filter(
    (unit) => !isPracticeUnitId(unit.id) && !isCheckpointUnitId(unit.id)
  );
  const configuredCoreUnitsWithData = configuredCoreUnits.filter((unit) => {
    const matched = getUnitDataById(
      activeBandData.units as Record<string, { words?: unknown[] }> | Array<{ id?: string; words?: unknown[] }>,
      unit.id
    );
    return Boolean(matched && (matched.words || []).length > 0);
  });
  const shouldUseConfiguredCoreUnits = configuredCoreUnitsWithData.length > 0;

  const buildDataDrivenOrderedUnits = () => {
    const coreUnits = dataUnits
      .filter((unit) => !isPracticeUnitId(unit.id) && !isCheckpointUnitId(unit.id))
      .map((unit, index) => {
        const meta = configuredUnits.find((configured) => configured.id === unit.id);
        const fallbackName = unit.id
          .replace(/^[a-z]\d+-/i, '')
          .replace(/^u\d+-/i, '')
          .replace(/[-_]+/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase())
          .trim();
        return {
          id: unit.id,
          name: (unit.title || meta?.name || fallbackName).trim(),
          nativeLabel: meta?.nativeLabel || '',
          description: (unit.description || meta?.description || 'Core vocabulary.').trim(),
          microUnits: meta?.microUnits,
          order: index + 1,
          icon: meta?.icon || BookOpen,
        };
      });

    const checkpointTemplates = configuredUnits
      .filter((unit) => isCheckpointUnitId(unit.id))
      .sort((a, b) => a.order - b.order);
    const checkpointCount = Math.ceil(coreUnits.length / 4);
    const checkpoints = Array.from({ length: checkpointCount }, (_, idx) => {
      const index = idx + 1;
      const template = checkpointTemplates[idx];
      return {
        id: `checkpoint-${index}`,
        name: template?.name || `Checkpoint Quiz ${index}`,
        nativeLabel: template?.nativeLabel || `阶段测验 ${index}`,
        description: template?.description || `Quiz review covering Units ${Math.max(1, (index - 1) * 4 + 1)} - ${Math.min(coreUnits.length, index * 4)}.`,
        microUnits: undefined,
        order: coreUnits.length + index,
        icon: template?.icon || BookOpen,
      };
    });

    const interleaved: Array<{
      id: string;
      name: string;
      nativeLabel: string;
      description: string;
      microUnits?: string[];
      order: number;
      icon: typeof BookOpen;
    }> = [];
    for (let idx = 0; idx < coreUnits.length; idx += 1) {
      interleaved.push(coreUnits[idx]);
      if ((idx + 1) % 4 === 0) {
        const checkpointIdx = Math.floor((idx + 1) / 4) - 1;
        if (checkpoints[checkpointIdx]) interleaved.push(checkpoints[checkpointIdx]);
      }
    }
    if (coreUnits.length % 4 !== 0 && checkpoints.length > Math.floor(coreUnits.length / 4)) {
      const finalCheckpoint = checkpoints[checkpoints.length - 1];
      if (finalCheckpoint) interleaved.push(finalCheckpoint);
    }

    const practiceUnits = configuredUnits
      .filter((unit) => isPracticeUnitId(unit.id))
      .sort((a, b) => a.order - b.order)
      .map((unit, index) => ({
        ...unit,
        order: interleaved.length + index + 1,
      }));

    return [...interleaved, ...practiceUnits];
  };

  const selectedLanguageId = (state.selectedLanguage || '').toLowerCase();
  const isJapaneseLevel = selectedLanguageId === 'ja';
  const availableSections = isJapaneseLevel && Array.isArray(activeBandData.sections)
    ? activeBandData.sections
    : [];
  const showSectionStep = isJapaneseLevel && availableSections.length > 0;
  const activeSectionRaw = showSectionStep
    ? availableSections.find((section) => section.id === activeSectionId) || null
    : null;
  const orderedUnits = configuredUnits.length > 0 && shouldUseConfiguredCoreUnits
    ? configuredUnits
    : buildDataDrivenOrderedUnits();
  const orderedUnitsWithDisplayNativeLabel = orderedUnits.map((metadata) => {
    if ((metadata.nativeLabel || '').trim()) return metadata;
    const unitData = getUnitDataById(
      activeBandData.units as Record<string, { words?: unknown[] }> | Array<{ id?: string; words?: unknown[] }>,
      metadata.id
    );
    const fallbackNativeLabel = deriveScriptPreviewFromWords(unitData?.words || []);
    return fallbackNativeLabel
      ? { ...metadata, nativeLabel: fallbackNativeLabel }
      : metadata;
  });

  // Map units with their data and metrics
  const unitMetrics = orderedUnitsWithDisplayNativeLabel
    .map((metadata) => {
      const practiceType = getPracticeType(metadata.id);
      if (practiceType) {
        return {
          unitId: metadata.id,
          metadata,
          totalWords: 0,
          lessonsCount: 1,
          lessonRanges: [],
          completedLessons: 0,
          masteredLessons: 0,
          averageLessonProgress: 0,
          applySentenceCount: 0,
          practiceType,
          isBlueprint: false,
        };
      }
      const unitData = getUnitDataById(
        activeBandData.units as Record<string, { words?: unknown[] }> | Array<{ id?: string; words?: unknown[] }>,
        metadata.id
      );
      if (!unitData) return null;
      const unitWords = unitData.words || [];
      const isMacroBlueprint = currentLevel.band >= 7 && !practiceType && unitWords.length === 0;
      if (!practiceType && unitWords.length === 0 && !isMacroBlueprint) return null;

      const totalWords = unitWords.length;
      const lessonRanges = getLessonRanges(totalWords, 10);
      const lessonsCount = lessonRanges.length;
      // Apply prompts require full example pairs to be valid.
      const applySentenceCount = unitWords.filter(
        (word) => {
          const candidate = word as { example?: { native?: string; en?: string } };
          return Boolean(getExampleNative(candidate.example)) &&
            Boolean(candidate.example?.en?.trim());
        }
      ).length;
      const completedLessons = lessonRanges.filter((_, lessonIndex) => {
        const key = makeLessonKey(currentLevel.id, metadata.id, lessonIndex);
        const status = lessonProgress[key];
        return Boolean(status?.completed || isInstructionalComplete(status?.quizScore, status?.speakScore));
      }).length;
      const masteredLessons = lessonRanges.filter((_, lessonIndex) => {
        const key = makeLessonKey(currentLevel.id, metadata.id, lessonIndex);
        const status = lessonProgress[key];
        return Boolean(status?.mastered);
      }).length;
      // Unit completion model:
      // - core completion track: one point per regular lesson completed
      // - mastery track: one point per regular lesson mastered
      const totalTrackSteps = lessonsCount * 2;
      const completedTrackSteps = completedLessons + masteredLessons;
      const completionPercent =
        totalTrackSteps > 0
          ? Math.round((completedTrackSteps / totalTrackSteps) * 100)
          : 0;
      return {
        unitId: metadata.id,
        metadata,
        totalWords,
        lessonsCount,
        lessonRanges,
        completedLessons,
        masteredLessons,
        completionPercent,
        applySentenceCount,
        practiceType: null as null,
        isBlueprint: isMacroBlueprint,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const unitMetricById = new Map(unitMetrics.map((metric) => [metric.unitId, metric]));
  const coreUnitIds = orderedUnits
    .filter((unit) => !isPracticeUnitId(unit.id) && !isCheckpointUnitId(unit.id))
    .filter((unit) => !showSectionStep || !activeSectionRaw || activeSectionRaw.unitIds.includes(unit.id))
    .map((unit) => unit.id)
    .filter((unitId) => unitMetricById.has(unitId));
  const resolveAdminBackfillLessonLimitForUnit = (unitId: string) => {
    const cursor = state.adminUnlockCursor;
    if (!cursor?.bandId || !cursor?.unitId || cursor.lessonIndex == null) return -1;
    const bandCompare = compareTrackLevelOrder(currentLevel.id, cursor.bandId);
    if (bandCompare == null) return -1;
    if (bandCompare < 0) return Number.MAX_SAFE_INTEGER;
    if (bandCompare > 0) return -1;
    const cursorUnitIndex = coreUnitIds.indexOf(cursor.unitId);
    const unitIndex = coreUnitIds.indexOf(unitId);
    if (cursorUnitIndex < 0 || unitIndex < 0) return -1;
    if (unitIndex < cursorUnitIndex) return Number.MAX_SAFE_INTEGER;
    if (unitIndex > cursorUnitIndex) return -1;
    return Math.max(0, Math.floor(cursor.lessonIndex));
  };
  const hasAdminBackfillUnitAccess = (unitId: string) =>
    resolveAdminBackfillLessonLimitForUnit(unitId) >= 0;
  const hasAdminBackfillLessonAccess = (unitId: string, lessonIndex: number) =>
    resolveAdminBackfillLessonLimitForUnit(unitId) >= lessonIndex;
  const hasLessonPassedThreshold = (unitId: string, lessonIndex: number) => {
    const key = makeLessonKey(currentLevel.id, unitId, lessonIndex);
    return hasLessonUnlockCredit(lessonProgress[key]);
  };
  const hasUnitPassedThreshold = (unitId: string) => {
    const metric = unitMetricById.get(unitId);
    if (!metric || metric.lessonsCount === 0) return false;
    return Array.from({ length: metric.lessonsCount }).every((_, lessonIndex) =>
      hasLessonPassedThreshold(unitId, lessonIndex)
    );
  };
  const hasAnyUnitProgress = (unitId: string) => {
    const metric = unitMetricById.get(unitId);
    if (!metric || metric.lessonsCount === 0) return false;
    return Array.from({ length: metric.lessonsCount }).some((_, lessonIndex) => {
      const key = makeLessonKey(currentLevel.id, unitId, lessonIndex);
      const status = lessonProgress[key];
      if (!status) return false;
      return Boolean(
        status.completed ||
        status.mastered ||
        status.introViewed ||
        status.quizScore != null ||
        status.speakScore != null
      );
    });
  };
  const hasCheckpointPassedThreshold = (checkpointUnitId: string) =>
    hasLessonPassedThreshold(checkpointUnitId, 0);
  const sectionOrder = ['core', 'expansion', 'integration'];
  const orderedSections = [...availableSections].sort((a, b) => {
    const ai = sectionOrder.indexOf(a.id);
    const bi = sectionOrder.indexOf(b.id);
    const aRank = ai >= 0 ? ai : Number.MAX_SAFE_INTEGER;
    const bRank = bi >= 0 ? bi : Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.id.localeCompare(b.id);
  });
  const unlockedBySectionId = new Map<string, boolean>();
  for (let idx = 0; idx < orderedSections.length; idx += 1) {
    const section = orderedSections[idx];
    if (idx === 0) {
      unlockedBySectionId.set(section.id, true);
      continue;
    }
    const previous = orderedSections[idx - 1];
    const prevUnlocked = Boolean(unlockedBySectionId.get(previous.id));
    const previousInstructionalUnitIds = Array.isArray(previous.unitIds)
      ? previous.unitIds.filter((unitId) => {
        const metric = unitMetricById.get(unitId);
        return Boolean(metric && metric.practiceType === null);
      })
      : [];
    const prevComplete =
      previousInstructionalUnitIds.length > 0 &&
      previousInstructionalUnitIds.every((unitId) => hasUnitPassedThreshold(unitId));
    unlockedBySectionId.set(section.id, prevUnlocked && prevComplete);
  }

  const fallbackSection = showSectionStep
    ? (
        orderedSections.find((section) => Boolean(unlockedBySectionId.get(section.id))) ||
        orderedSections[0] ||
        null
      )
    : null;
  const activeSection = showSectionStep
    ? (
        activeSectionRaw && Boolean(unlockedBySectionId.get(activeSectionRaw.id))
          ? activeSectionRaw
          : fallbackSection
      )
    : null;
  const unlockedByUnitId = new Map<string, boolean>();
  const checkpointUnitIds = orderedUnits
    .filter((unit) => isCheckpointUnitId(unit.id))
    .filter((unit) => !showSectionStep || !activeSection || activeSection.unitIds.includes(unit.id))
    .map((unit) => unit.id)
    .filter((unitId) => unitMetricById.has(unitId));
  const practiceUnitIds = orderedUnits
    .filter((unit) => isPracticeUnitId(unit.id))
    .filter((unit) => !showSectionStep || !activeSection || activeSection.unitIds.includes(unit.id))
    .map((unit) => unit.id)
    .filter((unitId) => unitMetricById.has(unitId));

  if (coreUnitIds.length > 0) {
    unlockedByUnitId.set(coreUnitIds[0], true);
  }

  // Core units unlock linearly, with checkpoint quizzes gating every 4-unit block.
  for (let coreIndex = 1; coreIndex < coreUnitIds.length; coreIndex += 1) {
    const previousCoreUnitId = coreUnitIds[coreIndex - 1];
    let unlocked =
      Boolean(unlockedByUnitId.get(previousCoreUnitId)) &&
      hasUnitPassedThreshold(previousCoreUnitId);

    // Every 4 core units, the checkpoint quiz gates access to the next core block.
    if (unlocked && coreIndex % 4 === 0) {
      const gateCheckpointId = `checkpoint-${coreIndex / 4}`;
      unlocked = hasCheckpointPassedThreshold(gateCheckpointId);
    }

    unlockedByUnitId.set(
      coreUnitIds[coreIndex],
      unlocked || hasAnyUnitProgress(coreUnitIds[coreIndex]) || hasAdminBackfillUnitAccess(coreUnitIds[coreIndex])
    );
  }

  for (const checkpointUnitId of checkpointUnitIds) {
    const checkpointIndex = parseCheckpointIndex(checkpointUnitId);
    if (!checkpointIndex) {
      unlockedByUnitId.set(checkpointUnitId, false);
      continue;
    }
    const start = (checkpointIndex - 1) * 4;
    const end = Math.min(coreUnitIds.length, checkpointIndex * 4);
    const coveredCoreUnits = coreUnitIds.slice(start, end);
    // A checkpoint unlocks only when all covered core units passed threshold.
    const unlockedByProgress =
      coveredCoreUnits.length > 0 &&
      coveredCoreUnits.every((unitId) => hasUnitPassedThreshold(unitId));
    const unlockedByAdminBackfill =
      coveredCoreUnits.length > 0 &&
      coveredCoreUnits.every(
        (unitId) => resolveAdminBackfillLessonLimitForUnit(unitId) === Number.MAX_SAFE_INTEGER
      );
    unlockedByUnitId.set(checkpointUnitId, unlockedByProgress || unlockedByAdminBackfill);
  }

  const hasStartedCorePath =
    coreUnitIds.some((unitId) => hasAnyUnitProgress(unitId)) ||
    coreUnitIds.some((unitId) => hasAdminBackfillUnitAccess(unitId));
  for (const practiceUnitId of practiceUnitIds) {
    unlockedByUnitId.set(practiceUnitId, hasStartedCorePath);
  }
  const filteredUnitMetrics = showSectionStep && activeSection
    ? unitMetrics.filter((metric) => activeSection.unitIds.includes(metric.unitId))
    : unitMetrics;

  const columns = getGridColumns(viewportWidth);
  const activeUnit = activeUnitId
    ? (unlockedByUnitId.get(activeUnitId) ?? true)
      ? filteredUnitMetrics.find((u) => u.unitId === activeUnitId) ?? null
      : null
    : null;
  const standardUnitMetrics = filteredUnitMetrics.filter(
    (metric) => metric.practiceType !== 'listening' && metric.practiceType !== 'speaking'
  );
  const unitCardHeightClass = isJapaneseLevel
    ? 'h-[220px] sm:h-[220px]'
    : 'h-[296px] sm:h-[250px]';
  const headerTitle = activeUnit
    ? `Unit ${activeUnit.metadata.order}`
    : activeSection
      ? activeSection.title
      : currentLevel.name;
  const isActiveUnitMastered = activeUnit
    ? activeUnit.lessonsCount > 0 &&
      activeUnit.completedLessons === activeUnit.lessonsCount &&
      activeUnit.masteredLessons === activeUnit.lessonsCount
    : false;
  const isCurrentLevelLocked =
    !isReleasedTrackLevel(currentLevel.id) || !state.unlockedLevels.includes(currentLevel.id);

  return (
    <div className="min-h-screen page-shell with-bottom-nav px-6">
      <GlassHeader
        title={headerTitle}
        hideLogoOnMobile
      />

      {isCurrentLevelLocked && (
        <div className="pt-2">
          <div className="rounded-3xl border border-[var(--sonus-palette-blue)]/35 bg-white p-6 text-center shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)]">
            <div className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono bg-[rgba(19,87,119,0.12)] text-[var(--sonus-palette-blue)]">
              Coming Soon
            </div>
            <h3 className="main-font text-[2rem] leading-tight font-normal mt-4 text-[var(--sonus-palette-blue)]">
              This Level Is In Progress
            </h3>
            <p className="text-sm text-text-med mt-2 max-w-xl mx-auto">
              This level unlocks after achieving 90% completion in the previous level.
            </p>
          </div>
        </div>
      )}

      {/* Japanese Sections */}
      {!activeUnit && !activeSection && showSectionStep && !isCurrentLevelLocked && (
        <div className="pt-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {orderedSections.map((section, index) => {
              const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
              const isSectionUnlocked = Boolean(unlockedBySectionId.get(section.id));
              const sectionWords = section.unitIds.reduce((sum, unitId) => {
                const metric = unitMetricById.get(unitId);
                return sum + (metric?.totalWords || 0);
              }, 0);
              return (
                <button
                  key={section.id}
                  id={walkthroughHighlightLevels && index === 0 ? 'tour-levels-first-card' : undefined}
                  onClick={() => {
                    if (!isSectionUnlocked) return;
                    setActiveSection(section.id);
                  }}
                  disabled={!isSectionUnlocked}
                  className={`bg-white text-text-dark border ${accent.borderColor} rounded-3xl min-h-[172px] p-5 text-left shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)] transition-all duration-200 hover:-translate-y-0.5 ${accent.hoverShadow} active:translate-y-0 flex flex-col relative disabled:opacity-100 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none`}
                >
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg w-fit ${accent.badgeBg} ${accent.badgeText}`}>
                    <span className="text-[10px] font-semibold uppercase tracking-wider font-mono">
                      Section
                    </span>
                  </div>
                  <div className="mt-3 main-font text-[1.45rem] leading-tight text-text-dark">
                    {section.title}
                  </div>
                  {section.subtitle ? (
                    <div className="mt-1 text-xs font-mono uppercase tracking-wider text-text-med">
                      {section.subtitle}
                    </div>
                  ) : null}
                  <div className="mt-auto pt-5 text-xs font-mono tracking-wide text-text-light">
                    {section.unitIds.length} units · {sectionWords} words
                  </div>
                  {!isSectionUnlocked && (
                    <div className="absolute inset-0 z-20 rounded-3xl bg-white/45 backdrop-blur-[2px] border border-white/50 flex items-center justify-center pointer-events-none">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 border border-[#D1D5DB] text-[#6B7280]">
                        <LockKeyhole className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold uppercase tracking-wider font-mono">Locked</span>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Units Grid */}
      {!activeUnit && (!showSectionStep || Boolean(activeSection)) && !isCurrentLevelLocked && (
      <div className="pt-2 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {standardUnitMetrics.map(({ unitId, metadata, lessonsCount, completedLessons, masteredLessons, completionPercent, practiceType, isBlueprint }, index) => {
            const row = Math.floor(index / columns);
            const col = index % columns;
            const accent = CARD_ACCENTS[(col + row) % CARD_ACCENTS.length];
            const Icon = metadata.icon;
            const isUnitUnlocked = Boolean(unlockedByUnitId.get(unitId));
            if (practiceType === 'checkpoint') {
              const practiceAccent = {
                solidBg: 'bg-[var(--sonus-palette-charcoal)]',
                borderColor: 'sonus-drenched-border-charcoal',
              };
              return (
                <button
                  key={unitId}
                  onClick={() => {
                    if (!isUnitUnlocked) return;
                    onSelectLesson(unitId, 0, 'quiz');
                  }}
                  disabled={!isUnitUnlocked}
                  className={`${isUnitUnlocked ? `${practiceAccent.solidBg} text-white border ${practiceAccent.borderColor}` : 'bg-[#F3F4F6] text-[#6B7280] border border-[#D1D5DB]'} rounded-3xl ${unitCardHeightClass} p-4 text-center shadow-[0_12px_28px_-22px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-0.5 ${accent.hoverShadow} active:translate-y-0 flex flex-col overflow-hidden relative disabled:opacity-100 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none`}
                >
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <div className={`inline-flex w-full items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg ${isUnitUnlocked ? 'bg-white/20 text-white' : 'bg-white text-[#6B7280] border border-[#D1D5DB]'}`}>
                      <Icon className={`w-3.5 h-3.5 ${isUnitUnlocked ? 'text-white' : 'text-[#6B7280]'}`} />
                      <span className={`text-[10px] font-semibold uppercase tracking-wider font-mono text-center whitespace-nowrap overflow-hidden text-ellipsis ${isUnitUnlocked ? 'text-white' : 'text-[#6B7280]'}`}>
                        Checkpoint
                      </span>
                    </div>
                </div>

                  <div className="flex-1 flex flex-col justify-center">
                    <div className={`text-[10px] tracking-wide font-extrabold text-center ${isUnitUnlocked ? 'text-white' : 'text-[#6B7280]'}`}>
                      {metadata.name.replace(/^Checkpoint Quiz\s+/i, 'Unit Review ')}
                    </div>
                    <div
                      className={`mt-1 text-[11px] leading-4 overflow-hidden ${isUnitUnlocked ? 'text-white' : 'text-[#6B7280]'}`}
                      style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                    >
                      {metadata.description}
                    </div>
                  </div>

                  <div className={`font-mono mt-auto pt-4 text-[11px] font-semibold tracking-wide text-center ${isUnitUnlocked ? 'text-white' : 'text-[#6B7280]'}`}>
                    {!isUnitUnlocked
                      ? (
                        <span className="inline-flex items-center gap-1.5">
                          <LockKeyhole className="w-3.5 h-3.5" />
                          {`${LESSON_UNLOCK_PASS_PERCENT}% to unlock`}
                        </span>
                      )
                      : 'Begin →'}
                  </div>
                  {!isUnitUnlocked && (
                    <div className="absolute inset-0 z-20 rounded-3xl bg-white/45 backdrop-blur-[4px] border border-white/50 flex items-center justify-center pointer-events-none">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 border border-[#D1D5DB] text-[#6B7280]">
                        <LockKeyhole className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold uppercase tracking-wider font-mono">Locked</span>
                      </div>
                    </div>
                  )}
                </button>
              );
            }
            const isUnitCompleted = lessonsCount > 0 && completedLessons === lessonsCount;
            const isUnitMastered = lessonsCount > 0 && masteredLessons === lessonsCount && isUnitCompleted;
            const unitMasteredBorderClass = drenchedBorderClassFromAccent(accent.badgeText) || accent.borderColor;
            const safeCompletionPercent = completionPercent ?? 0;
            const depth = isBlueprint ? 0 : isUnitMastered ? 100 : Math.max(4, safeCompletionPercent);
            const isWalkthroughUnitTarget = walkthroughHighlightUnits && index === 0;
            const isWalkthroughLessonsFallbackTarget = walkthroughHighlightLessons && index === 0 && !activeUnit;
            const walkthroughTargetId = isWalkthroughUnitTarget
              ? 'tour-units-first-card'
              : isWalkthroughLessonsFallbackTarget
                ? 'tour-lessons-first-card'
                : undefined;
            return (
              <button
                key={unitId}
                id={walkthroughTargetId}
                onClick={() => {
                  if (isBlueprint || !isUnitUnlocked) return;
                  setActiveUnit(unitId);
                }}
                disabled={isBlueprint || !isUnitUnlocked}
                className={`${isUnitMastered ? `${accent.badgeText === 'text-[var(--sonus-palette-blue)]' ? 'bg-[#145B7A]' : accent.badgeText === 'text-[var(--sonus-palette-green)]' ? 'bg-[#1B3B27]' : accent.badgeText === 'text-[var(--sonus-palette-charcoal)]' ? 'bg-[var(--sonus-palette-charcoal)]' : 'bg-[var(--sonus-palette-rust)]'} text-white` : !isUnitUnlocked ? 'bg-[#F3F4F6] text-[#6B7280]' : isUnitCompleted ? 'bg-white text-text-dark ring-1 ring-[var(--sonus-palette-green)]/40' : 'bg-white text-text-dark'} border ${isUnitUnlocked ? (isUnitMastered ? unitMasteredBorderClass : accent.borderColor) : 'border-[#D1D5DB]'} rounded-3xl ${unitCardHeightClass} p-4 text-center shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)] transition-all duration-200 hover:-translate-y-0.5 ${accent.hoverShadow} active:translate-y-0 flex flex-col overflow-hidden relative disabled:opacity-100 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none`}
              >
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className={`inline-flex w-full items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg ${isUnitMastered ? 'bg-white/20 text-white' : !isUnitUnlocked ? 'bg-white text-[#6B7280] border border-[#D1D5DB]' : `${accent.badgeBg} ${accent.badgeText}`}`}>
                    <Icon className={`w-3.5 h-3.5 ${isUnitMastered ? 'text-white' : !isUnitUnlocked ? 'text-[#6B7280]' : accent.badgeText}`} />
                    <span className={`text-[10px] font-semibold uppercase tracking-wider font-mono text-center whitespace-nowrap overflow-hidden text-ellipsis ${isUnitMastered ? 'text-white' : !isUnitUnlocked ? 'text-[#6B7280]' : accent.badgeText}`}>
                      Unit {metadata.order}
                    </span>
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                  <div className={`text-[10px] tracking-wide font-extrabold text-center ${isUnitMastered ? 'text-white/85' : !isUnitUnlocked ? 'text-[#6B7280]' : 'text-text-med'}`}>
                    {metadata.name}
                  </div>
                  <div
                    className={`mt-1 text-[11px] leading-4 text-center ${isUnitMastered ? 'text-white/90' : !isUnitUnlocked ? 'text-[#6B7280]' : 'text-text-med'} overflow-hidden`}
                    style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                  >
                    {metadata.description}
                  </div>
                  {isBlueprint && metadata.microUnits && metadata.microUnits.length > 0 && (
                    <div className={`mt-1 text-[11px] leading-relaxed text-center ${isUnitMastered ? 'text-white/85' : !isUnitUnlocked ? 'text-[#9CA3AF]' : 'text-text-light'} overflow-hidden max-h-9`}>
                      Focus: {metadata.microUnits.slice(0, 3).join(' · ')}
                    </div>
                  )}
                </div>

                <div className={`font-mono mt-auto pt-2 text-[11px] font-semibold tracking-wide text-center ${isUnitMastered ? 'text-white' : accent.badgeText}`}>
                  {isBlueprint
                    ? 'Planned'
                    : !isUnitUnlocked
                    ? (
                      <span className="inline-flex items-center gap-1.5">
                        <LockKeyhole className="w-3.5 h-3.5" />
                        {`${LESSON_UNLOCK_PASS_PERCENT}% to unlock`}
                      </span>
                    )
                    : isUnitMastered
                    ? (
                      <span>
                        <span className="font-bold">Mastered</span>
                        <span className="font-normal"> (Practice Available)</span>
                      </span>
                    )
                    : isUnitCompleted
                    ? 'Continue Mastery Lessons →'
                    : lessonsCount > 1
                      ? `Continue (${lessonsCount} Lessons) →`
                      : 'Start Lesson →'}
                </div>
                <div className="mt-2">
                  <div className="h-2 w-full rounded-full bg-border/75 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-[width] duration-700 ease-out ${isUnitMastered ? 'bg-white/90' : accent.progressFill}`}
                      style={{ width: animateProgressBars ? `${depth}%` : '0%' }}
                    />
                  </div>
                  <div className={`mt-1 text-[10px] font-mono tracking-wide ${isUnitMastered ? 'text-white/85' : !isUnitUnlocked ? 'text-[#9CA3AF]' : 'text-text-light'}`}>
                    {safeCompletionPercent}% complete
                  </div>
                </div>
                {!isUnitUnlocked && (
                  <div className="absolute inset-0 z-20 rounded-3xl bg-white/45 backdrop-blur-[2px] border border-white/50 flex items-center justify-center pointer-events-none">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 border border-[#D1D5DB] text-[#6B7280]">
                      <LockKeyhole className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold uppercase tracking-wider font-mono">Locked</span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* Lesson Squares for Selected Unit */}
      {activeUnit && !isCurrentLevelLocked && (
        <div className="pt-2">
          {isActiveUnitMastered && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button
                onClick={() => onOpenPractice(`${activeUnit.unitId}-listening`)}
                className="rounded-2xl border sonus-drenched-border-ocean bg-[var(--sonus-palette-blue)] text-white min-h-[92px] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 shadow-[0_12px_28px_-22px_rgba(19,87,119,0.55)]"
              >
                <div className="text-[11px] uppercase tracking-wider font-mono text-white/85">Practice</div>
                <div className="main-font text-[1.1rem] leading-tight mt-1">Listening</div>
              </button>
              <button
                onClick={() => onOpenPractice(`${activeUnit.unitId}-speaking`)}
                className="rounded-2xl border border-[var(--sonus-palette-rust)] bg-[var(--sonus-palette-rust)] text-white min-h-[92px] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 shadow-[0_12px_28px_-22px_rgba(194,65,12,0.58)]"
              >
                <div className="text-[11px] uppercase tracking-wider font-mono text-white/85">Practice</div>
                <div className="main-font text-[1.1rem] leading-tight mt-1">Speaking</div>
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: activeUnit.lessonsCount }).map((_, lessonIndex) => {
              const row = Math.floor(lessonIndex / columns);
              const col = lessonIndex % columns;
              const accent = CARD_ACCENTS[(col + row) % CARD_ACCENTS.length];
              const range = activeUnit.lessonRanges[lessonIndex];
              const chunkStart = range.start;
              const chunkEnd = range.end;
              const chunkWords = range.count;
              const lessonKey = makeLessonKey(currentLevel.id, activeUnit.unitId, lessonIndex);
              const isLessonCompleted = Boolean(lessonProgress[lessonKey]?.completed);
              const isLessonMastered = Boolean(lessonProgress[lessonKey]?.mastered);
              const isUnitUnlocked = Boolean(unlockedByUnitId.get(activeUnit.unitId));
              const isLessonUnlocked =
                isUnitUnlocked &&
                (
                  lessonIndex === 0 ||
                  hasAdminBackfillLessonAccess(activeUnit.unitId, lessonIndex) ||
                  hasLessonPassedThreshold(activeUnit.unitId, lessonIndex - 1)
                );
              const lessonStatus = lessonProgress[lessonKey];
              const isResumeCandidate =
                resumeCheckpoint?.bandId === currentLevel.id &&
                resumeCheckpoint?.unitId === activeUnit.unitId &&
                resumeCheckpoint?.lessonIndex === lessonIndex;
              const isWalkthroughLessonTarget = walkthroughHighlightLessons && lessonIndex === 0;
              const lessonChecks =
                (lessonStatus?.introViewed ? 1 : 0) +
                ((lessonStatus?.quizScore ?? 0) >= QUIZ_PASS_PERCENT ? 1 : 0) +
                ((lessonStatus?.speakScore ?? 0) >= SPEAK_PASS_PERCENT ? 1 : 0);
              const lessonMasteredBorderClass = drenchedBorderClassFromAccent(accent.badgeText) || accent.borderColor;

              return (
                <button
                  key={`${activeUnit.unitId}-${lessonIndex}`}
                  id={isWalkthroughLessonTarget ? 'tour-lessons-first-card' : undefined}
                  onClick={() => {
                    if (!isLessonUnlocked) return;
                    onSelectLesson(
                      activeUnit.unitId,
                      lessonIndex,
                      isLessonCompleted && !isLessonMastered ? 'quiz' : 'intro'
                    );
                  }}
                  disabled={!isLessonUnlocked}
                  className={`${isLessonMastered ? `${accent.badgeText === 'text-[var(--sonus-palette-blue)]' ? 'bg-[var(--sonus-palette-blue)]' : accent.badgeText === 'text-[var(--sonus-palette-green)]' ? 'bg-[var(--sonus-palette-green)]' : accent.badgeText === 'text-[var(--sonus-palette-charcoal)]' ? 'bg-[var(--sonus-palette-charcoal)]' : 'bg-[var(--sonus-palette-rust)]'} text-white` : !isLessonUnlocked ? 'bg-[#F3F4F6] text-[#6B7280]' : isLessonCompleted ? 'bg-white text-text-dark ring-1 ring-[var(--sonus-palette-green)]/45' : 'bg-white text-text-dark'} border ${isLessonUnlocked ? (isLessonMastered ? lessonMasteredBorderClass : accent.borderColor) : 'border-[#D1D5DB]'} rounded-2xl min-h-[130px] p-4 text-left transition-all hover:-translate-y-1 hover:shadow-xl ${accent.hoverShadow} active:translate-y-0 disabled:opacity-100 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none`}
                >
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${isLessonMastered ? 'bg-white/20 text-white' : !isLessonUnlocked ? 'bg-[#F3F4F6] text-[#6B7280]' : `${accent.badgeBg} ${accent.badgeText}`}`}>
                    <BookOpen className={`w-3.5 h-3.5 ${isLessonMastered ? 'text-white' : !isLessonUnlocked ? 'text-[#6B7280]' : accent.badgeText}`} />
                    <span className={`text-xs font-semibold uppercase tracking-wider font-mono ${isLessonMastered ? 'text-white' : !isLessonUnlocked ? 'text-[#6B7280]' : accent.badgeText}`}>
                      Lesson {lessonIndex + 1}
                    </span>
                  </div>

                  <div className={`mt-4 text-sm font-mono uppercase tracking-wider ${isLessonMastered ? 'text-white/90' : !isLessonUnlocked ? 'text-[#6B7280]' : 'text-text-med'}`}>
                    Words {chunkStart}-{chunkEnd}
                  </div>

                  <div className={`mt-1 text-xs font-mono uppercase tracking-wider ${isLessonMastered ? 'text-white/85' : !isLessonUnlocked ? 'text-[#9CA3AF]' : 'text-text-light'}`}>
                    {chunkWords} {chunkWords === 1 ? 'word' : 'words'}
                  </div>

                  <div className={`mt-4 text-[11px] font-semibold uppercase tracking-wider font-mono ${isLessonMastered ? 'text-white' : !isLessonUnlocked ? 'text-[#6B7280]' : accent.badgeText}`}>
                    {isLessonMastered
                      ? 'Mastered'
                      : !isLessonUnlocked
                        ? (
                          <span className="inline-flex items-center gap-1">
                            <LockKeyhole className="w-3 h-3" />
                            {`${LESSON_UNLOCK_PASS_PERCENT}% to unlock`}
                          </span>
                        )
                      : isLessonCompleted
                        ? 'Completed · Mastery available'
                      : isResumeCandidate
                        ? 'Resume →'
                        : lessonChecks > 0
                          ? `${lessonChecks} of 3 complete`
                          : 'Start →'}
                  </div>
                </button>
              );
            })}
            {(() => {
              const applyLessonIndex = activeUnit.lessonsCount;
              return (
                <button
                  key={`${activeUnit.unitId}-apply`}
                  onClick={() => {
                    onSelectLesson(activeUnit.unitId, applyLessonIndex, 'apply');
                  }}
                  className="bg-[var(--sonus-palette-rust)] text-white border-[var(--sonus-palette-rust)] border-[2.5px] rounded-2xl min-h-[130px] p-4 text-left transition-all hover:-translate-y-1 hover:shadow-[0_18px_34px_-22px_rgba(194,65,12,0.55)] active:translate-y-0 relative overflow-hidden"
                >
                  <div className="absolute inset-[6px] rounded-[0.8rem] border border-white/24 pointer-events-none" />

                  <div className="h-full flex flex-col items-center justify-center text-center gap-2 relative z-10">
                    <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/18 text-white border border-white/18">
                      <span className="relative inline-flex items-center justify-center w-4 h-4">
                        <MessageSquare className="w-4 h-4 text-white" />
                        <Check className="absolute -right-1 -bottom-1 w-2.5 h-2.5 text-white" />
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider font-mono text-white">
                        Apply
                      </span>
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.16em] font-mono text-white/85">
                      Context Practice
                    </div>
                  </div>
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredUnitMetrics.length === 0 && !activeUnit && (!showSectionStep || Boolean(activeSection)) && (
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-bold text-text-dark mb-2">No Units Available</h3>
          <p className="text-text-med text-center">
            This level doesn't have any units yet. Check back soon!
          </p>
        </div>
      )}

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
