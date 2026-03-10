import type { AppState } from '../types/lesson.types';
import { makeLessonKey } from './lessonProgress';
import { QUIZ_PASS_PERCENT, SPEAK_PASS_PERCENT } from './passCriteria';
import { resolveUnitIdForBand } from './bandIds';

export type ProgressEventEnvelope = {
  eventType?: string;
  payloadJson?: unknown;
};

function isCompletedByScores(quizScore: number | null, speakScore: number | null) {
  return (quizScore ?? 0) >= QUIZ_PASS_PERCENT && (speakScore ?? 0) >= SPEAK_PASS_PERCENT;
}

export function normalizeLessonProgressKeys(progress: AppState['lessonProgress']) {
  const next: AppState['lessonProgress'] = {};
  for (const [key, value] of Object.entries(progress || {})) {
    const parts = key.split(':');
    if (parts.length !== 3) {
      next[key] = value;
      continue;
    }
    const [bandId, rawUnitId, lessonIndex] = parts;
    const unitId = resolveUnitIdForBand(bandId, rawUnitId);
    if (bandId !== 'unknown-band') {
      next[`${bandId}:${unitId}:${lessonIndex}`] = value;
      continue;
    }

    const match = unitId.match(/^b(\d+)-/i);
    if (match) {
      const inferredBandId = `band${match[1]}`;
      next[`${inferredBandId}:${unitId}:${lessonIndex}`] = value;
      continue;
    }

    next[key] = value;
  }
  return next;
}

export function mergeLessonProgress(
  existingProgress: AppState['lessonProgress'],
  incomingProgress: AppState['lessonProgress']
) {
  const merged: AppState['lessonProgress'] = { ...existingProgress };
  for (const [key, incoming] of Object.entries(incomingProgress || {})) {
    const existing = merged[key];
    if (!existing) {
      const completed = incoming.completed || isCompletedByScores(incoming.quizScore, incoming.speakScore);
      merged[key] = {
        ...incoming,
        completed,
        mastered: incoming.mastered,
        masteryQuizPassed: incoming.masteryQuizPassed,
        masterySpeakPassed: incoming.masterySpeakPassed,
      };
      continue;
    }
    const introViewed = existing.introViewed || incoming.introViewed;
    const quizScore =
      existing.quizScore === null
        ? incoming.quizScore
        : incoming.quizScore === null
          ? existing.quizScore
          : Math.max(existing.quizScore, incoming.quizScore);
    const speakScore =
      existing.speakScore === null
        ? incoming.speakScore
        : incoming.speakScore === null
          ? existing.speakScore
          : Math.max(existing.speakScore, incoming.speakScore);
    const completed =
      existing.completed ||
      incoming.completed ||
      isCompletedByScores(quizScore, speakScore);
    merged[key] = {
      introViewed,
      quizScore,
      speakScore,
      speakAllCorrect: existing.speakAllCorrect || incoming.speakAllCorrect,
      completed,
      mastered: existing.mastered || incoming.mastered,
      masteryQuizPassed:
        Boolean(existing.mastered || incoming.mastered) ||
        Boolean(existing.masteryQuizPassed || incoming.masteryQuizPassed),
      masterySpeakPassed:
        Boolean(existing.mastered || incoming.mastered) ||
        Boolean(existing.masterySpeakPassed || incoming.masterySpeakPassed),
    };
  }
  return merged;
}

export function buildLessonProgressFromRecentEvents(events: ProgressEventEnvelope[] | undefined) {
  const next: AppState['lessonProgress'] = {};
  for (const event of events || []) {
    if (event?.eventType !== 'lesson_completed' && event?.eventType !== 'apply_completed') continue;
    if (!event.payloadJson || typeof event.payloadJson !== 'object' || Array.isArray(event.payloadJson)) continue;
    const payload = event.payloadJson as Record<string, unknown>;
    const bandId = typeof payload.bandId === 'string' ? payload.bandId.trim() : '';
    const unitId = typeof payload.unitId === 'string' ? payload.unitId.trim() : '';
    const lessonIndex =
      typeof payload.lessonIndex === 'number' && Number.isInteger(payload.lessonIndex)
        ? payload.lessonIndex
        : null;
    if (!bandId || !unitId || lessonIndex === null || lessonIndex < 0) continue;

    const key = makeLessonKey(bandId, unitId, lessonIndex);
    const quizScore = typeof payload.quizScore === 'number' ? payload.quizScore : null;
    const speakScore = typeof payload.speakScore === 'number' ? payload.speakScore : null;
    const completed = Boolean(payload.completed) || isCompletedByScores(quizScore, speakScore);
    next[key] = {
      introViewed: Boolean(payload.introViewed),
      quizScore,
      speakScore,
      speakAllCorrect: Boolean(payload.speakAllCorrect),
      completed,
      mastered: Boolean(payload.mastered),
      masteryQuizPassed: Boolean(payload.mastered) || Boolean(payload.masteryQuizPassed),
      masterySpeakPassed: Boolean(payload.mastered) || Boolean(payload.masterySpeakPassed),
    };
  }
  return next;
}
