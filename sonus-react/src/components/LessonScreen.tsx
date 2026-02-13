import { useApp } from '../contexts/AppContext';
import Flashcard from './Flashcard';
import Quiz from './Quiz';
import SpeakMode from './SpeakMode';
import { ChevronLeft } from 'lucide-react';
import BottomNav from './BottomNav';
import { getUnitMetadata } from '../data/unitMetadata';

interface LessonScreenProps {
  onBack: () => void;
  onGoHome: () => void;
  onOpenProfile: () => void;
}

export default function LessonScreen({ onBack, onGoHome, onOpenProfile }: LessonScreenProps) {
  const { state, setLessonMode, nextWord, prevWord } = useApp();
  const { activeLesson, lessonMode, lessonWordIndex, activeBandId } = state;

  if (!activeLesson) {
    return (
      <div className="flex items-center justify-center h-screen page-shell">
        <p className="text-text-med">No lesson loaded</p>
      </div>
    );
  }

  const currentWord = activeLesson.words[lessonWordIndex];
  const totalWords = activeLesson.words.length;
  const isListeningPractice = /listening$/i.test(activeLesson.unitId);
  const isSpeakingPractice = /speaking$/i.test(activeLesson.unitId);
  const isPracticeUnit = isListeningPractice || isSpeakingPractice;
  const unitMeta =
    activeBandId && activeLesson.unitId ? getUnitMetadata(activeBandId, activeLesson.unitId) : undefined;
  const titleText = isPracticeUnit
    ? (isListeningPractice ? 'Listening Practice' : 'Speaking Practice')
    : `Unit ${activeLesson.unitOrder ?? activeLesson.lessonIndex + 1}`;
  const subtitleText = isPracticeUnit
    ? unitMeta?.description || activeLesson.unitName || 'Focused practice'
    : activeLesson.unitName || `Unit ${activeLesson.unitId}`;
  const speakingPageTheme = isSpeakingPractice
    ? {
        shell: 'bg-[#C2410C]',
        title: 'text-white',
        subtitle: 'text-white/90',
        back: 'text-white',
        content: 'bg-[#C2410C]',
      }
    : {
        shell: '',
        title: 'text-text-dark',
        subtitle: 'text-text-lg',
        back: 'text-text-dark',
        content: '',
      };

  const handleBack = () => {
    onBack();
  };

  return (
    <div className={`flex flex-col h-[100dvh] pt-14 ${isSpeakingPractice ? 'bg-[#C2410C]' : 'page-shell'} ${speakingPageTheme.shell}`}>
      {/* Header */}
      <div className="relative px-6 pb-3">
        <button
          onClick={handleBack}
          className={`absolute left-6 -top-1 inline-flex items-center gap-1.5 p-2 -ml-2 ${speakingPageTheme.back} hover:opacity-70 transition-opacity`}
        >
          <ChevronLeft className="w-4.5 h-4.5" />
          <span className="text-sm">Back</span>
        </button>
        <div className="text-center px-12">
          <h1 className={`font-playfair text-4xl font-normal mb-1 ${speakingPageTheme.title}`}>
            {titleText}
          </h1>
          <h2 className={`text-base italic ${speakingPageTheme.subtitle}`}>
            {subtitleText}
          </h2>
        </div>
      </div>

      {/* Mode Tabs */}
      {!isPracticeUnit ? (
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
      ) : !isSpeakingPractice ? (
        <div className={`backdrop-blur-sm border-b px-6 py-2 ${isSpeakingPractice ? 'bg-[#9A3412]/95 border-white/20' : 'bg-bg-warm/90 border-border'}`}>
          <div className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono ${isSpeakingPractice ? 'bg-white/15 text-white' : 'bg-[rgba(30,58,138,0.12)] text-[#1E3A8A]'}`}>
            {isListeningPractice ? 'Listening Practice' : 'Speaking Practice'}
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
            listeningMode={isListeningPractice}
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
            practiceMode={isSpeakingPractice}
            onNext={nextWord}
            onPrev={prevWord}
          />
        )}
      </div>

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
