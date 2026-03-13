import { useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';
import { getWordReading } from '../lib/languageFields';

interface LessonReviewProps {
  onGoHome: () => void;
  onOpenProfile: () => void;
  onRetakeQuiz: () => void;
  onContinueToSpeak: () => void;
  onBackToResults: () => void;
}

export default function LessonReview({
  onGoHome,
  onOpenProfile,
  onRetakeQuiz,
  onContinueToSpeak,
  onBackToResults,
}: LessonReviewProps) {
  const { state } = useApp();
  const { activeLesson, quizResultsByIndex } = state;
  const hideLogoOnMobile = true;

  const missedWords = useMemo(() => {
    if (!activeLesson) return [];
    return activeLesson.words
      .map((word, index) => ({ word, index }))
      .filter(({ index }) => !quizResultsByIndex[index]);
  }, [activeLesson, quizResultsByIndex]);

  const [currentIndex, setCurrentIndex] = useState(0);

  if (!activeLesson) return null;

  const totalMissed = missedWords.length;
  const hasMissedWords = totalMissed > 0;
  const safeIndex = Math.min(currentIndex, Math.max(0, totalMissed - 1));
  const currentItem = hasMissedWords ? missedWords[safeIndex] : null;
  const isFirstCard = safeIndex <= 0;
  const isLastCard = safeIndex >= totalMissed - 1;
  const reviewDone = !hasMissedWords || currentIndex >= totalMissed;
  const progressPercent = hasMissedWords
    ? Math.round((((safeIndex + 1) / totalMissed) * 100))
    : 100;

  return (
    <div className="flex flex-col h-[100svh] min-h-[100svh] overflow-hidden page-shell">
      <div className="px-6">
        <GlassHeader title="Lesson Review" hideLogoOnMobile={hideLogoOnMobile} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-start px-6 pt-2 pb-28 sm:pb-10 overflow-y-auto">
        <div className="w-full max-w-md mb-5">
          <p className="text-lg text-text-med text-center mb-3">
            {`You missed ${totalMissed} ${totalMissed === 1 ? 'word' : 'words'}. Let's fix them.`}
          </p>
          <div className="mb-1 text-sm text-text-med text-center">
            {`${Math.min(safeIndex + 1, Math.max(1, totalMissed))} of ${Math.max(1, totalMissed)}`}
          </div>
          <div className="w-full h-1.5 rounded-full bg-[rgba(31,42,55,0.14)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--sonus-palette-blue)] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {!reviewDone && currentItem ? (
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="secondary-font text-5xl text-text-dark leading-none text-center">
              {currentItem.word.simp}
            </div>
            <div className="mt-2 text-center text-xl text-text-med">
              {getWordReading(currentItem.word)}
            </div>
            <div className="mt-4 text-center text-lg text-text-dark font-medium">
              {currentItem.word.en}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md text-center">
            <div className="text-xl font-semibold text-text-dark mb-2">Review Complete</div>
            <div className="text-text-med">You have gone through all missed words.</div>
          </div>
        )}
        <div className="lesson-review-actions w-full max-w-md mt-4 flex flex-col gap-3">
          {!reviewDone && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    if (isFirstCard) return;
                    setCurrentIndex((prev) => Math.max(0, prev - 1));
                  }}
                  aria-disabled={isFirstCard}
                  className={`w-full py-3 px-4 bg-white text-[var(--sonus-palette-charcoal)] border-2 border-[rgba(31,42,55,0.30)] rounded-xl font-medium opacity-100 hover:opacity-100 focus:opacity-100 active:opacity-100 transition-all active:bg-white ${
                    isFirstCard
                      ? 'cursor-not-allowed pointer-events-none'
                      : 'hover:bg-white'
                  }`}
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    if (isLastCard) return;
                    setCurrentIndex((prev) => Math.min(totalMissed - 1, prev + 1));
                  }}
                  aria-disabled={isLastCard}
                  className={`w-full py-3 px-4 bg-white text-[var(--sonus-palette-charcoal)] border-2 border-[rgba(31,42,55,0.30)] rounded-xl font-medium opacity-100 hover:opacity-100 focus:opacity-100 active:opacity-100 transition-all active:bg-white ${
                    isLastCard
                      ? 'cursor-not-allowed pointer-events-none'
                      : 'hover:bg-white'
                  }`}
                >
                  Next
                </button>
              </div>
              <button
                onClick={() => setCurrentIndex(totalMissed)}
                className="w-full py-4 px-6 bg-[var(--sonus-palette-blue)] text-white rounded-xl font-bold text-lg opacity-100 hover:opacity-100 focus:opacity-100 active:opacity-100 transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                Finish Review
              </button>
            </>
          )}
          {reviewDone && (
            <>
              <button
                onClick={onRetakeQuiz}
                className="w-full py-4 px-6 bg-[var(--sonus-palette-blue)] text-white rounded-xl font-bold text-lg opacity-100 hover:opacity-100 focus:opacity-100 active:opacity-100 transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                Retake Quiz
              </button>
              <button
                onClick={onContinueToSpeak}
                className="self-center text-sm font-medium text-[var(--sonus-palette-blue)] opacity-100 hover:opacity-100 focus:opacity-100 active:opacity-100 underline underline-offset-4 hover:text-[#145B7A]"
              >
                Continue to Speak
              </button>
            </>
          )}
          {!reviewDone && (
            <button
              onClick={onBackToResults}
              className="self-center text-sm font-medium text-[var(--sonus-palette-blue)] opacity-100 hover:opacity-100 focus:opacity-100 active:opacity-100 underline underline-offset-4 hover:text-[#145B7A]"
            >
              Back to Results
            </button>
          )}
        </div>
      </div>

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
