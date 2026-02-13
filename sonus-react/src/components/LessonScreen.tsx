import { useApp } from '../contexts/AppContext';
import Flashcard from './Flashcard';
import Quiz from './Quiz';
import SpeakMode from './SpeakMode';
import { ChevronLeft } from 'lucide-react';
import BottomNav from './BottomNav';

interface LessonScreenProps {
  onGoHome: () => void;
  onOpenProfile: () => void;
}

export default function LessonScreen({ onGoHome, onOpenProfile }: LessonScreenProps) {
  const { state, setLessonMode, nextWord, prevWord, exitLesson } = useApp();
  const { activeLesson, lessonMode, lessonWordIndex } = state;

  if (!activeLesson) {
    return (
      <div className="flex items-center justify-center h-screen page-shell">
        <p className="text-text-med">No lesson loaded</p>
      </div>
    );
  }

  const currentWord = activeLesson.words[lessonWordIndex];
  const totalWords = activeLesson.words.length;

  const handleBack = () => {
    exitLesson();
  };

  return (
    <div className="flex flex-col h-[100dvh] page-shell">
      {/* Header */}
      <div className="relative px-6 pt-6 pb-3">
        <button
          onClick={handleBack}
          className="absolute left-6 top-4 inline-flex items-center gap-1.5 p-2 -ml-2 text-text-dark hover:opacity-70 transition-opacity"
        >
          <ChevronLeft className="w-4.5 h-4.5" />
          <span className="text-sm">Back</span>
        </button>
        <div className="text-center">
          <h1 className="font-playfair text-4xl font-normal text-text-dark mb-1">
            Unit {activeLesson.unitOrder ?? activeLesson.lessonIndex + 1}
          </h1>
          <h2 className="text-base text-text-lg italic">
            {activeLesson.unitName || `Unit ${activeLesson.unitId}`}
          </h2>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="bg-bg-warm/90 backdrop-blur-sm border-b border-border px-6 py-2">
        <div className="flex gap-2">
          <button
            onClick={() => setLessonMode('intro')}
            className={`flex-1 py-2 px-4 rounded-xl font-medium transition-all ${
              lessonMode === 'intro'
                ? 'bg-[#1E3A8A] text-white shadow-sm'
                : 'bg-white border border-border text-text-med hover:bg-[rgba(55,65,81,0.08)]'
            }`}
          >
            Learn
          </button>
          <button
            onClick={() => setLessonMode('quiz')}
            className={`flex-1 py-2 px-4 rounded-xl font-medium transition-all ${
              lessonMode === 'quiz'
                ? 'bg-[#1E3A8A] text-white shadow-sm'
                : 'bg-white border border-border text-text-med hover:bg-[rgba(55,65,81,0.08)]'
            }`}
          >
            Quiz
          </button>
          <button
            onClick={() => setLessonMode('speak')}
            className={`flex-1 py-2 px-4 rounded-xl font-medium transition-all ${
              lessonMode === 'speak'
                ? 'bg-[#1E3A8A] text-white shadow-sm'
                : 'bg-white border border-border text-text-med hover:bg-[rgba(55,65,81,0.08)]'
            }`}
          >
            Speak
          </button>
        </div>
      </div>

      {/* Lesson Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {lessonMode === 'intro' && (
          <Flashcard
            word={currentWord}
            currentIndex={lessonWordIndex}
            totalWords={totalWords}
            onNext={nextWord}
            onPrev={prevWord}
          />
        )}
        {lessonMode === 'quiz' && (
          <Quiz
            key={`quiz-${currentWord.id}-${lessonWordIndex}`}
            word={currentWord}
            allWords={activeLesson.words}
            currentIndex={lessonWordIndex}
            totalWords={totalWords}
            onNext={nextWord}
            onPrev={prevWord}
          />
        )}
        {lessonMode === 'speak' && (
          <SpeakMode
            word={currentWord}
            allWords={activeLesson.words}
            currentIndex={lessonWordIndex}
            totalWords={totalWords}
            onNext={nextWord}
            onPrev={prevWord}
          />
        )}
      </div>

      <BottomNav active="home" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
