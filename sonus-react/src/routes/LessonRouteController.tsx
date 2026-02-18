import { useEffect, useRef } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import LessonComplete from '../components/LessonComplete';
import LessonReview from '../components/LessonReview';
import LessonScreen from '../components/LessonScreen';
import type { LessonMode } from '../types/lesson.types';
import { CHINESE_LEVEL_BY_ID, isMandarinBandLocked, tierForBand } from './lessonRouting';

interface LessonRouteControllerProps {
  onGoHome: () => void;
  onOpenProfile: () => void;
}

export default function LessonRouteController({ onGoHome, onOpenProfile }: LessonRouteControllerProps) {
  const navigate = useNavigate();
  const { state, openLessonPath, restartLesson, exitLesson, setLessonMode, selectLanguage } = useApp();
  const { activeLesson, lessonWordIndex, activeBandId } = state;
  const { band, unitId, lessonIndex, mode } = useParams<{
    tier: string;
    band: string;
    unitId: string;
    lessonIndex: string;
    mode: string;
  }>();
  const parsedLessonIndex = Number(lessonIndex ?? '0');
  const routeMode = mode ?? 'intro';
  const isCompleteRoute = routeMode === 'complete';
  const isReviewRoute = routeMode === 'review';
  const lessonMode: LessonMode =
    routeMode === 'quiz' || routeMode === 'speak' || routeMode === 'intro' || routeMode === 'apply'
      ? routeMode
      : 'intro';
  const level = band ? CHINESE_LEVEL_BY_ID[band] : undefined;
  const pendingLoadKeyRef = useRef<string>('');

  useEffect(() => {
    if (!band || !unitId || !Number.isFinite(parsedLessonIndex)) return;
    if (isMandarinBandLocked(band, state.unlockedLevels)) {
      navigate('/learn', { replace: true });
      return;
    }
    const loadKey = `${band}:${unitId}:${parsedLessonIndex}`;

    // Reuse in-memory lesson data when route and payload are already aligned.
    const hasLegacyReattemptWords = Boolean(
      state.activeLesson?.words?.some(
        (word) => Boolean(word.isReattempt) || Boolean(word.reattemptOfWordId)
      )
    );
    if (
      state.activeBandId === band &&
      state.activeLesson?.unitId === unitId &&
      state.activeLesson?.lessonIndex === parsedLessonIndex &&
      state.activeLesson.words.length > 0 &&
      !hasLegacyReattemptWords
    ) {
      if (lessonMode !== 'apply') {
        return;
      }

      const looksLikeApplyLesson =
        state.lessonMode === 'apply' ||
        Boolean(state.activeLesson.unitName?.includes('· Apply'));
      const hasApplyExamples = state.activeLesson.words.every(
        (word) =>
          Boolean(word.example?.zh?.trim()) &&
          Boolean(word.example?.en?.trim())
      );
      if (looksLikeApplyLesson && hasApplyExamples) {
        return;
      }
    }

    if (
      unitId === 'daily-review' &&
      state.activeLesson?.unitId === 'daily-review' &&
      state.activeBandId === band
    ) {
      return;
    }

    if (pendingLoadKeyRef.current === loadKey) return;
    pendingLoadKeyRef.current = loadKey;

    if (state.selectedLanguage !== 'zh') {
      selectLanguage('zh');
    }

    void openLessonPath(band, unitId, parsedLessonIndex)
      .then((opened) => {
        if (!opened) navigate(`/learn/${tierForBand(band)}/${band}`, { replace: true });
      })
      .finally(() => {
        if (pendingLoadKeyRef.current === loadKey) {
          pendingLoadKeyRef.current = '';
        }
      });
  }, [
    band,
    unitId,
    parsedLessonIndex,
    lessonMode,
    navigate,
    openLessonPath,
    selectLanguage,
    state.selectedLanguage,
    state.activeBandId,
    state.activeLesson,
    state.lessonMode,
    state.unlockedLevels,
  ]);

  useEffect(() => {
    if (!activeLesson || isCompleteRoute || isReviewRoute || !level) return;
    if (state.lessonMode !== lessonMode) {
      setLessonMode(lessonMode);
    }
  }, [activeLesson, isCompleteRoute, isReviewRoute, lessonMode, setLessonMode, state.lessonMode, level]);

  if (!level) return <Navigate to="/learn" replace />;
  const routeMatchesActiveLesson =
    Boolean(activeLesson) &&
    activeBandId === level.id &&
    activeLesson?.unitId === unitId &&
    activeLesson?.lessonIndex === parsedLessonIndex;
  if (!routeMatchesActiveLesson) {
    return <div className="min-h-screen page-shell flex items-center justify-center text-text-med">Loading lesson…</div>;
  }

  const isComplete = lessonWordIndex >= activeLesson.words.length;
  if (!isCompleteRoute && !isReviewRoute && isComplete && state.lessonMode === lessonMode) {
    return (
      <Navigate
        to={`/learn/${tierForBand(level.id)}/${level.id}/unit/${activeLesson.unitId}/lesson/${activeLesson.lessonIndex}/complete`}
        replace
      />
    );
  }

  if (isCompleteRoute) {
    return (
      <LessonComplete
        onGoHome={onGoHome}
        onOpenProfile={onOpenProfile}
        onStartQuiz={() => {
          restartLesson();
          navigate(`/learn/${tierForBand(level.id)}/${level.id}/unit/${activeLesson.unitId}/lesson/${activeLesson.lessonIndex}/quiz`);
        }}
        onStartSpeak={() => {
          restartLesson();
          navigate(`/learn/${tierForBand(level.id)}/${level.id}/unit/${activeLesson.unitId}/lesson/${activeLesson.lessonIndex}/speak`);
        }}
        onContinue={() => {
          exitLesson();
          navigate(`/learn/${tierForBand(level.id)}/${level.id}`);
        }}
        onRestart={() => {
          restartLesson();
          navigate(
            `/learn/${tierForBand(level.id)}/${level.id}/unit/${activeLesson.unitId}/lesson/${activeLesson.lessonIndex}/${state.lessonMode === 'apply' ? 'apply' : 'intro'}`
          );
        }}
        onReviewMissed={() => {
          navigate(`/learn/${tierForBand(level.id)}/${level.id}/unit/${activeLesson.unitId}/lesson/${activeLesson.lessonIndex}/review`);
        }}
      />
    );
  }

  if (isReviewRoute) {
    return (
      <LessonReview
        onGoHome={onGoHome}
        onOpenProfile={onOpenProfile}
        onRetakeQuiz={() => {
          restartLesson();
          navigate(`/learn/${tierForBand(level.id)}/${level.id}/unit/${activeLesson.unitId}/lesson/${activeLesson.lessonIndex}/quiz`);
        }}
        onContinueToSpeak={() => {
          restartLesson();
          navigate(`/learn/${tierForBand(level.id)}/${level.id}/unit/${activeLesson.unitId}/lesson/${activeLesson.lessonIndex}/speak`);
        }}
        onBackToResults={() => {
          navigate(`/learn/${tierForBand(level.id)}/${level.id}/unit/${activeLesson.unitId}/lesson/${activeLesson.lessonIndex}/complete`);
        }}
      />
    );
  }

  return (
    <LessonScreen
      onGoHome={onGoHome}
      onOpenProfile={onOpenProfile}
      onModeChange={(nextMode) => {
        if (nextMode === lessonMode) return;
        navigate(
          `/learn/${tierForBand(level.id)}/${level.id}/unit/${activeLesson.unitId}/lesson/${activeLesson.lessonIndex}/${nextMode}`
        );
      }}
    />
  );
}
