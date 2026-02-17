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

interface LessonScreenProps {
  onGoHome: () => void;
  onOpenProfile: () => void;
  onModeChange?: (mode: LessonMode) => void;
}

export default function LessonScreen({ onGoHome, onOpenProfile, onModeChange }: LessonScreenProps) {
  const { state, setLessonMode, nextWord, prevWord } = useApp();
  const { activeLesson, lessonMode, lessonWordIndex, activeBandId, lessonProgress } = state;

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
        title: 'text-[#C2410C]',
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
  const isMasterySession = Boolean(lessonStatus?.completed) && !Boolean(lessonStatus?.mastered);
  const learnDone = Boolean(lessonStatus?.introViewed);
  const quizDone = (lessonStatus?.quizScore ?? 0) >= QUIZ_PASS_PERCENT;
  const speakDone = (lessonStatus?.speakScore ?? 0) >= SPEAK_PASS_PERCENT;

  return (
    <div className={`flex flex-col h-[100dvh] page-shell ${speakingPageTheme.shell}`}>
      {/* Header */}
      <div className="px-6 pb-1">
        <GlassHeader
          title={titleText}
          className={isSpeakingPractice ? 'bg-white/75 border-[#C2410C]/25' : ''}
          titleClassName={speakingPageTheme.title}
        />
      </div>

      {/* Mode Tabs */}
      {!isPracticeUnit && !isCheckpointQuiz ? (
        <div className="bg-bg-warm/90 backdrop-blur-sm border-b border-border px-4 py-2.5 -mt-8 relative z-40">
          <div className={`grid ${isMasterySession ? 'grid-cols-2' : 'grid-cols-3'} gap-2 rounded-3xl`}>
            {!isMasterySession && (
              <button
                onClick={() => {
                  onModeChange?.('intro');
                  setLessonMode('intro');
                }}
                className={`relative py-2.5 px-4 rounded-2xl text-[1.03rem] font-semibold tracking-wide transition-all ${
                  lessonMode === 'intro'
                    ? 'bg-[#186E95] text-white shadow-[0_10px_24px_-18px_rgba(24,110,149,0.55)]'
                  : learnDone
                      ? 'bg-[rgba(55,65,81,0.10)] border border-[rgba(55,65,81,0.22)] text-text-light'
                    : 'bg-white border border-border text-text-med hover:bg-[rgba(55,65,81,0.08)]'
                }`}
              >
                <span className="inline-flex w-full items-center justify-center">Learn</span>
                {learnDone && lessonMode !== 'intro' ? (
                  <Check className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                ) : null}
              </button>
            )}
            <button
              onClick={() => {
                onModeChange?.('quiz');
                setLessonMode('quiz');
              }}
              className={`relative py-2.5 px-4 rounded-2xl text-[1.03rem] font-semibold tracking-wide transition-all ${
                lessonMode === 'quiz'
                  ? 'bg-[#186E95] text-white shadow-[0_10px_24px_-18px_rgba(24,110,149,0.55)]'
                  : quizDone
                    ? 'bg-[rgba(55,65,81,0.10)] border border-[rgba(55,65,81,0.22)] text-text-light'
                  : 'bg-white border border-border text-text-med hover:bg-[rgba(55,65,81,0.08)]'
              }`}
            >
              <span className="inline-flex w-full items-center justify-center">Quiz</span>
              {quizDone && lessonMode !== 'quiz' ? (
                <Check className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
              ) : null}
            </button>
            <button
              onClick={() => {
                onModeChange?.('speak');
                setLessonMode('speak');
              }}
              className={`relative py-2.5 px-4 rounded-2xl text-[1.03rem] font-semibold tracking-wide transition-all ${
                lessonMode === 'speak'
                  ? 'bg-[#186E95] text-white shadow-[0_10px_24px_-18px_rgba(24,110,149,0.55)]'
                  : speakDone
                    ? 'bg-[rgba(55,65,81,0.10)] border border-[rgba(55,65,81,0.22)] text-text-light'
                  : 'bg-white border border-border text-text-med hover:bg-[rgba(55,65,81,0.08)]'
              }`}
            >
              <span className="inline-flex w-full items-center justify-center">Speak</span>
              {speakDone && lessonMode !== 'speak' ? (
                <Check className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
              ) : null}
            </button>
          </div>
        </div>
      ) : null}

      {/* Lesson Content */}
      <div className={`flex-1 overflow-y-auto pb-40 ${speakingPageTheme.content}`}>
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
            onNext={nextWord}
          />
        )}
      </div>

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
