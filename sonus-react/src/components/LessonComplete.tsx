import { useApp } from '../contexts/AppContext';
import { BookOpen, ChevronLeft } from 'lucide-react';
import BottomNav from './BottomNav';

interface LessonCompleteProps {
  onBack: () => void;
  onStartQuiz: () => void;
  onContinue: () => void;
  onRestart: () => void;
  onGoHome: () => void;
  onOpenProfile: () => void;
}

export default function LessonComplete({
  onBack,
  onStartQuiz,
  onContinue,
  onRestart,
  onGoHome,
  onOpenProfile,
}: LessonCompleteProps) {
  const { state } = useApp();
  const { activeLesson } = state;

  if (!activeLesson) return null;

  return (
    <div className="flex flex-col h-[100dvh] page-shell">
      <div className="px-6 pt-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 p-2 -ml-2 text-text-dark hover:opacity-70 transition-opacity"
        >
          <ChevronLeft className="w-4.5 h-4.5" />
          <span className="text-sm">Back</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start px-6 pt-2 pb-4 overflow-y-auto">
        {/* Brand image */}
        <div className="mb-4">
          <img
            src="/branding/bird.png"
            alt="Sonus bird"
            className="w-20 h-20 md:w-24 md:h-24 object-contain drop-shadow-xl"
          />
        </div>

        {/* Celebration Message */}
        <h1 className="font-playfair text-4xl font-normal text-text-dark mb-1 text-center">
          Lesson Complete!
        </h1>
        <p className="text-lg text-text-med mb-5 text-center">
          Amazing work!
        </p>

        {/* Stats Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-5 w-full max-w-md">
          <div className="space-y-6">
            {/* Lesson summary */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[rgba(77,124,15,0.16)] flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-[#4D7C0F]" />
              </div>
              <div>
                <p className="text-sm text-text-med">Words Practiced</p>
                <p className="text-2xl font-bold text-text-dark">{activeLesson.words.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 w-full max-w-md">
          <button
            onClick={onStartQuiz}
            className="w-full py-4 px-6 bg-[#1E3A8A] text-white rounded-xl font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
          >
            Start Quiz
          </button>
          <button
            onClick={onContinue}
            className="w-full py-4 px-6 bg-[#4D7C0F] text-white rounded-xl font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
          >
            Continue Learning
          </button>
          <button
            onClick={onRestart}
            className="w-full py-4 px-6 bg-white text-[#374151] border-2 border-[rgba(55,65,81,0.30)] rounded-xl font-medium transition-all hover:bg-[rgba(55,65,81,0.08)] active:bg-[rgba(55,65,81,0.12)]"
          >
            Practice Again
          </button>
        </div>
      </div>

      <BottomNav active="home" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
