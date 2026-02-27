import { useEffect, useMemo, useRef } from 'react';
import type { LessonMode } from '../types/lesson.types';
import { useApp } from '../contexts/AppContext';
import Flashcard from './Flashcard';
import Quiz from './Quiz';
import SpeakMode from './SpeakMode';
import ApplyMode from './ApplyMode';
import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';
import { makeLessonKey } from '../lib/lessonProgress';
import { QUIZ_PASS_PERCENT, SPEAK_PASS_PERCENT } from '../lib/passCriteria';
import { Check } from 'lucide-react';
import { isCheckpointUnitId } from '../data/unitMetadata';
import type { BandData, Word } from '../types/lesson.types';

interface LessonScreenProps {
  onGoHome: () => void;
  onOpenProfile: () => void;
  onModeChange?: (mode: LessonMode) => void;
}

const LESSON_RELOAD_GUARD_KEY = 'sonus.lesson.reload_guard';
const LESSON_RELOAD_GUARD_TTL_MS = 2 * 60 * 1000;

type BandUnitRecord = { id: string; words: Word[] };

function getBandUnitsOrdered(bandData: BandData): BandUnitRecord[] {
  if (Array.isArray(bandData.units)) {
    return bandData.units
      .map((unit) => ({
        id: typeof unit?.id === 'string' ? unit.id : '',
        words: unit?.words || [],
      }))
      .filter((unit) => Boolean(unit.id));
  }

  return Object.entries(bandData.units || {}).map(([id, unit]) => ({
    id,
    words: unit?.words || [],
  }));
}

function isBrowserReloadNavigation() {
  try {
    const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (entry?.type) return entry.type === 'reload';
    const legacyPerformance = performance as Performance & {
      navigation?: { type?: number };
    };
    return legacyPerformance.navigation?.type === 1;
  } catch {
    return false;
  }
}

export default function LessonScreen({ onGoHome, onOpenProfile, onModeChange }: LessonScreenProps) {
  const { state, setLessonMode, nextWord, prevWord, restartLesson, completeLessonProgress } = useApp();
  const {
    activeLesson,
    lessonMode,
    lessonWordIndex,
    activeBandId,
    lessonProgress,
    quizResultsByIndex,
    speakResultsByIndex,
  } = state;
  const hasActiveAttempt =
    lessonMode === 'quiz'
      ? (lessonWordIndex > 0 || Object.keys(quizResultsByIndex).length > 0)
      : lessonMode === 'speak'
      ? (lessonWordIndex > 0 || Object.keys(speakResultsByIndex).length > 0)
      : false;
  const didApplyReloadResetRef = useRef(false);

  useEffect(() => {
    if (!activeLesson) return;
    if (didApplyReloadResetRef.current) return;
    didApplyReloadResetRef.current = true;

    let guardRaw: string | null = null;
    try {
      guardRaw = window.sessionStorage.getItem(LESSON_RELOAD_GUARD_KEY);
    } catch {
      return;
    }
    if (!guardRaw) return;

    try {
      const payload = JSON.parse(guardRaw) as {
        path?: string;
        mode?: LessonMode;
        at?: number;
      };
      const isFresh = typeof payload.at === 'number' && Date.now() - payload.at <= LESSON_RELOAD_GUARD_TTL_MS;
      const samePath = payload.path === window.location.pathname;
      const sameMode = payload.mode === lessonMode;
      if (isFresh && samePath && sameMode && isBrowserReloadNavigation() && (lessonMode === 'quiz' || lessonMode === 'speak')) {
        restartLesson();
        setLessonMode(lessonMode);
      }
    } catch {
      // Ignore malformed guard payload.
    } finally {
      try {
        window.sessionStorage.removeItem(LESSON_RELOAD_GUARD_KEY);
      } catch {
        // Ignore storage failures.
      }
    }
  }, [activeLesson, lessonMode, restartLesson, setLessonMode]);

  useEffect(() => {
    if (!activeLesson) return;
    if (lessonMode !== 'quiz' && lessonMode !== 'speak') return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasActiveAttempt) return;
      try {
        window.sessionStorage.setItem(
          LESSON_RELOAD_GUARD_KEY,
          JSON.stringify({
            path: window.location.pathname,
            mode: lessonMode,
            at: Date.now(),
          })
        );
      } catch {
        // Ignore storage failures.
      }
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [activeLesson, hasActiveAttempt, lessonMode]);

  const previousWords = useMemo(() => {
    if (!state.activeBandData || !activeLesson) return [] as Word[];
    const units = getBandUnitsOrdered(state.activeBandData);
    const activeUnitIdx = units.findIndex((unit) => unit.id === activeLesson.unitId);
    if (activeUnitIdx <= 0) return [] as Word[];
    const deduped = new Map<string, Word>();
    units
      .slice(0, activeUnitIdx)
      .flatMap((unit) => unit.words || [])
      .forEach((candidate) => {
        if (!candidate?.id || deduped.has(candidate.id)) return;
        deduped.set(candidate.id, candidate);
      });
    return Array.from(deduped.values());
  }, [state.activeBandData, activeLesson]);

  if (!activeLesson) {
    return (
      <div className="flex items-center justify-center h-screen page-shell">
        <p className="text-text-med">No lesson loaded</p>
      </div>
    );
  }

  const currentWord = activeLesson.words[lessonWordIndex];
  const totalWords = activeLesson.words.length;
  if (!currentWord && totalWords > 0) {
    return (
      <div className="flex items-center justify-center h-screen page-shell">
        <p className="text-text-med">Loading lesson…</p>
      </div>
    );
  }
  if (totalWords === 0) {
    return (
      <div className="flex items-center justify-center h-screen page-shell">
        <p className="text-text-med">This lesson has no words yet.</p>
      </div>
    );
  }
  const isListeningPractice = /listening$/i.test(activeLesson.unitId);
  const isSpeakingPractice = /speaking$/i.test(activeLesson.unitId);
  const isCheckpointQuiz = isCheckpointUnitId(activeLesson.unitId);
  const isDailyReview = activeLesson.unitId === 'daily-review';
  const isPracticeUnit = isListeningPractice || isSpeakingPractice;
  const isApplyMode = lessonMode === 'apply';
  const hideLogoOnMobile =
    isPracticeUnit || isApplyMode || /^band\d+$/i.test(activeBandId || '') || activeBandId === 'advanced';
  const titleText = isCheckpointQuiz
    ? (activeLesson.unitName || 'Checkpoint Quiz')
    : isPracticeUnit
    ? (isListeningPractice ? 'Listening Practice' : 'Speaking Practice')
    : isApplyMode
      ? `Unit ${activeLesson.unitOrder ?? activeLesson.lessonIndex + 1}`
    : isDailyReview
      ? (activeLesson.unitName || 'Daily Review')
      : `Unit ${activeLesson.unitOrder ?? activeLesson.lessonIndex + 1}`;
  const subtitleText = isApplyMode
    ? 'Apply'
    : !isPracticeUnit && !isCheckpointQuiz && !isDailyReview
      ? `Lesson ${activeLesson.lessonIndex + 1}`
      : null;
  const speakingPageTheme = isSpeakingPractice
    ? {
        shell: '',
        title: 'text-[#1F2A37]',
        content: '',
      }
    : {
        shell: '',
        title: 'text-text-dark',
        content: '',
      };
  const lessonKey =
    activeLesson && activeBandId ? makeLessonKey(activeBandId, activeLesson.unitId, activeLesson.lessonIndex) : null;
  const lessonStatus = lessonKey ? lessonProgress[lessonKey] : undefined;
  const isMasterySession = !!lessonStatus?.completed && !lessonStatus?.mastered;
  const learnDone = Boolean(lessonStatus?.introViewed);
  const quizDone = !isMasterySession && (lessonStatus?.quizScore ?? 0) >= QUIZ_PASS_PERCENT;
  const speakDone = !isMasterySession && (lessonStatus?.speakScore ?? 0) >= SPEAK_PASS_PERCENT;
  const modeTabs: Array<{
    mode: LessonMode;
    label: string;
    done: boolean;
  }> = (() => {
    if (isApplyMode) return [];
    if (isListeningPractice || isCheckpointQuiz) {
      return [{ mode: 'quiz', label: 'Quiz', done: quizDone }];
    }
    if (isSpeakingPractice) {
      return [{ mode: 'speak', label: 'Speak', done: speakDone }];
    }
    if (isMasterySession) {
      return [
        { mode: 'quiz', label: 'Quiz', done: quizDone },
        { mode: 'speak', label: 'Speak', done: speakDone },
      ];
    }
    return [
      { mode: 'intro', label: 'Learn', done: learnDone },
      { mode: 'quiz', label: 'Quiz', done: quizDone },
      { mode: 'speak', label: 'Speak', done: speakDone },
    ];
  })();

  return (
    <div className={`flex flex-col h-[100dvh] page-shell ${speakingPageTheme.shell}`}>
      {/* Header */}
      <div className="px-6 pb-1">
        <GlassHeader
          title={titleText}
          subtitle={subtitleText ? (
            <span className={`text-sm text-text-med ${isApplyMode ? 'italic' : ''}`}>{subtitleText}</span>
          ) : undefined}
          hideLogoOnMobile={hideLogoOnMobile}
          className={isSpeakingPractice ? 'bg-white/75 border-[#1F2A37]/25' : ''}
          titleClassName={speakingPageTheme.title}
          subtitleClassName="text-text-med"
        />
      </div>

      {/* Mode Tabs */}
      {modeTabs.length > 0 ? (
        <div className="bg-bg-warm/90 backdrop-blur-sm border-b border-border px-4 py-2.5 -mt-8 relative z-40">
          <div
            className={`mx-auto grid gap-2 rounded-2xl bg-[rgba(31,42,55,0.06)] p-1 ${
              modeTabs.length === 1 ? 'max-w-xl grid-cols-1' : modeTabs.length === 2 ? 'max-w-2xl grid-cols-2' : 'max-w-5xl grid-cols-3'
            }`}
          >
            {modeTabs.map((tab) => {
              const isActive = lessonMode === tab.mode;
              return (
                <button
                  key={tab.mode}
                  onClick={() => {
                    onModeChange?.(tab.mode);
                    setLessonMode(tab.mode);
                  }}
                  className={`relative rounded-xl py-2.5 px-4 text-[1.03rem] font-semibold tracking-wide transition-all ${
                    isActive
                      ? 'bg-[#186E95] text-white shadow-[0_10px_24px_-18px_rgba(24,110,149,0.55)]'
                      : 'text-[#1F2A37] hover:bg-white'
                  }`}
                >
                  <span className="inline-flex w-full items-center justify-center">{tab.label}</span>
                  {tab.done ? (
                    <Check
                      className={`absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${
                        isActive ? 'text-white/90' : 'text-[#9CA3AF]'
                      }`}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Lesson Content */}
      <div
        className={`flex-1 ${isApplyMode ? 'overflow-y-auto md:overflow-y-hidden pb-0' : 'overflow-y-auto pb-8'} ${speakingPageTheme.content}`}
        style={{
          paddingBottom: isApplyMode
            ? 'calc(var(--sonus-bottom-nav-height, 5rem) + env(safe-area-inset-bottom, 0px) + 5.25rem)'
            : 'calc(var(--sonus-bottom-nav-height, 5rem) + env(safe-area-inset-bottom, 0px) + 9rem)',
        }}
      >
        {lessonMode === 'intro' && (
          <Flashcard
            word={currentWord}
            currentIndex={lessonWordIndex}
            totalWords={totalWords}
            onPrev={prevWord}
            onNext={nextWord}
          />
        )}
        {lessonMode === 'quiz' && (
          <Quiz
            key={`quiz-${currentWord.id}-${lessonWordIndex}`}
            word={currentWord}
            allWords={activeLesson.words}
            currentIndex={lessonWordIndex}
            totalWords={totalWords}
            listeningMode={isListeningPractice}
            onPrev={prevWord}
            onNext={nextWord}
          />
        )}
        {lessonMode === 'speak' && (
          <SpeakMode
            word={currentWord}
            allWords={activeLesson.words}
            currentIndex={lessonWordIndex}
            totalWords={totalWords}
            practiceMode={isSpeakingPractice}
            onPrev={prevWord}
            onNext={nextWord}
          />
        )}
        {lessonMode === 'apply' && (
          <ApplyMode
            word={currentWord}
            allWords={activeLesson.words}
            currentIndex={lessonWordIndex}
            totalWords={totalWords}
            bandId={activeBandId}
            previousWords={previousWords}
            onPrev={prevWord}
            onNext={nextWord}
            onCompleteApply={completeLessonProgress}
          />
        )}
      </div>

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
