import { useEffect, useRef, useState } from 'react';
import type { LessonMode } from '../types/lesson.types';
import { useApp } from '../contexts/AppContext';
import Flashcard from './Flashcard';
import Quiz from './Quiz';
import SpeakMode from './SpeakMode';
import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';
import { makeLessonKey } from '../lib/lessonProgress';
import { QUIZ_PASS_PERCENT, SPEAK_PASS_PERCENT } from '../lib/passCriteria';
import { Check } from 'lucide-react';
import { isCheckpointUnitId } from '../data/unitMetadata';
import { normalizeLanguageId } from '../lib/languageRuntime';

interface LessonScreenProps {
  onGoHome: () => void;
  onOpenProfile: () => void;
  onModeChange?: (mode: LessonMode) => void;
  onReturnToLessons?: () => void;
}

const LESSON_RELOAD_GUARD_KEY = 'sonus.lesson.reload_guard';
const LESSON_RELOAD_GUARD_TTL_MS = 2 * 60 * 1000;

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

export default function LessonScreen({
  onGoHome,
  onOpenProfile,
  onModeChange,
  onReturnToLessons,
}: LessonScreenProps) {
  const { state, setLessonMode, nextWord, prevWord, restartLesson } = useApp();
  const [showNeedReviewModal, setShowNeedReviewModal] = useState(false);
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
  const lessonSubtitle = isPracticeUnit ? '(Not Graded)' : undefined;
  const hideLogoOnMobile = true;
  const titleText = isCheckpointQuiz
    ? (activeLesson.unitName || 'Checkpoint Quiz')
    : isPracticeUnit
    ? (isListeningPractice ? 'Listening Practice' : 'Speaking Practice')
    : isDailyReview
      ? (activeLesson.unitName || 'Daily Review')
      : `Unit ${activeLesson.unitOrder ?? activeLesson.lessonIndex + 1}`;
  const speakingPageTheme = isSpeakingPractice
    ? {
        shell: '',
        title: 'text-[var(--sonus-palette-charcoal)]',
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
  const normalizedLanguageId = normalizeLanguageId(state.selectedLanguage);
  const shouldHideReadingAndMeaning =
    isMasterySession && !['es', 'fr', 'it'].includes(normalizedLanguageId);
  const learnDone = Boolean(lessonStatus?.introViewed);
  const instructionalQuizDone = (lessonStatus?.quizScore ?? 0) >= QUIZ_PASS_PERCENT;
  const instructionalSpeakDone = (lessonStatus?.speakScore ?? 0) >= SPEAK_PASS_PERCENT;
  const masteryQuizDone = Boolean(lessonStatus?.mastered || lessonStatus?.masteryQuizPassed);
  const masterySpeakDone = Boolean(lessonStatus?.mastered || lessonStatus?.masterySpeakPassed);
  const quizDone = isMasterySession ? masteryQuizDone : instructionalQuizDone;
  const speakDone = isMasterySession ? masterySpeakDone : instructionalSpeakDone;
  const showNeedReviewAction = isMasterySession && (lessonMode === 'quiz' || lessonMode === 'speak');
  const modeTabs: Array<{
    mode: LessonMode;
    label: string;
    done: boolean;
  }> = (() => {
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
  const isIntroMode = lessonMode === 'intro';
  const lockViewportScroll = lessonMode === 'quiz' || isIntroMode;
  const lessonContentClass = lockViewportScroll
    ? 'overflow-y-hidden pb-0'
    : 'overflow-y-auto pb-8';
  const effectiveLessonContentClass = lessonMode === 'speak'
    ? 'overflow-y-hidden pb-0 md:overflow-y-auto md:pb-8'
    : lessonContentClass;
  const lessonContentPaddingBottom = lockViewportScroll
    ? 'calc(var(--sonus-bottom-nav-height, 5rem) + env(safe-area-inset-bottom, 0px) + 1rem)'
    : lessonMode === 'speak'
      ? 'calc(var(--sonus-bottom-nav-height, 5rem) + env(safe-area-inset-bottom, 0px) + 1.5rem)'
      : 'calc(var(--sonus-bottom-nav-height, 5rem) + env(safe-area-inset-bottom, 0px) + 9rem)';

  return (
    <div className={`flex flex-col h-[100svh] min-h-[100svh] overflow-hidden page-shell ${speakingPageTheme.shell}`}>
      {showNeedReviewModal ? (
        <div className="fixed inset-0 z-[120] bg-[rgba(15,23,42,0.48)] px-6 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Return to lessons confirmation">
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-5 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.55)]">
            <h2 className="text-lg font-semibold text-text-dark">Return To Lessons?</h2>
            <p className="mt-2 text-sm text-text-med">
              This will exit mastery mode, return you to the lesson, and clear your scores for this session.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowNeedReviewModal(false)}
                className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-text-dark transition-colors hover:bg-[#F8FAFC]"
              >
                Keep Practicing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNeedReviewModal(false);
                  onReturnToLessons?.();
                }}
                className="w-full rounded-xl border border-[var(--sonus-palette-rust)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--sonus-palette-rust)] transition-colors hover:bg-[rgba(194,65,12,0.08)]"
              >
                Restart Lesson
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {/* Header */}
      <div className="px-6 pb-1">
        <GlassHeader
          title={titleText}
          subtitle={lessonSubtitle}
          hideLogoOnMobile={hideLogoOnMobile}
          className={isSpeakingPractice ? 'bg-white/75 border-[var(--sonus-palette-charcoal)]/25' : ''}
          titleClassName={speakingPageTheme.title}
          subtitleClassName="text-text-light"
        />
      </div>
      {/* Mode Tabs */}
      {modeTabs.length > 1 ? (
        <div className="bg-bg-warm/90 backdrop-blur-sm border-b border-border px-4 pb-2.5 pt-0 relative z-40">
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
                  type="button"
                  onClick={() => {
                    onModeChange?.(tab.mode);
                    setLessonMode(tab.mode);
                  }}
                  className={`relative rounded-xl py-2 px-3 sm:py-2.5 sm:px-4 text-[0.9rem] sm:text-[1.03rem] font-semibold tracking-wide transition-all ${
                    isActive
                      ? 'bg-[var(--sonus-palette-blue)] text-white shadow-[0_10px_24px_-18px_rgba(19,87,119,0.55)]'
                      : 'text-[var(--sonus-palette-charcoal)] hover:bg-white'
                  }`}
                >
                  <span className="inline-flex w-full items-center justify-center">{tab.label}</span>
                  {tab.done ? (
                    <Check
                      className={`absolute right-2.5 sm:right-3.5 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 ${
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
        className={`flex-1 ${effectiveLessonContentClass} ${speakingPageTheme.content}`}
        style={{
          paddingBottom: lessonContentPaddingBottom,
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
            word={currentWord}
            allWords={activeLesson.words}
            currentIndex={lessonWordIndex}
            totalWords={totalWords}
            listeningMode={isListeningPractice}
            hideReadingAndMeaning={shouldHideReadingAndMeaning}
            showNeedReviewAction={showNeedReviewAction}
            onNeedReview={() => setShowNeedReviewModal(true)}
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
            hideReadingAndMeaning={shouldHideReadingAndMeaning}
            disableTargetAudio={isMasterySession}
            showNeedReviewAction={showNeedReviewAction}
            onNeedReview={() => setShowNeedReviewModal(true)}
            onNext={nextWord}
          />
        )}
      </div>

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
