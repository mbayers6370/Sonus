import { useState } from 'react';
import type { Word } from '../types/lesson.types';
import { useAudio } from '../hooks/useAudio';
import { Volume2, Snail, ChevronRight } from 'lucide-react';

interface FlashcardProps {
  word: Word;
  currentIndex: number;
  totalWords: number;
  onNext: () => void;
}

export default function Flashcard({
  word,
  currentIndex,
  totalWords,
  onNext,
}: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const { speak } = useAudio();
  const meaningList = (word.defs && word.defs.length > 0 ? word.defs : [word.en]).slice(0, 3);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    setIsFlipped(false);
    onNext();
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Progress Bar */}
      <div className="w-full h-2 bg-gray-200/90 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-[#186E95] to-[#C2410C] transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / totalWords) * 100}%` }}
        />
      </div>

      {/* Flashcard */}
      <div className="flex-1 flex items-center justify-center px-5 py-2">
        <div
          onClick={handleFlip}
          className="w-full max-w-md min-h-[220px] md:min-h-[255px] bg-white/95 rounded-3xl shadow-[0_18px_38px_-28px_rgba(15,23,42,0.45)] border border-border cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_46px_-28px_rgba(15,23,42,0.42)] flex items-center justify-center p-6"
        >
          {!isFlipped ? (
            // Front side
            <div className="text-center w-full">
              {word.isReview && (
                <>
                  <div className="inline-flex mb-1 -mt-4 items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono bg-[rgba(194,65,12,0.14)] text-[#C2410C]">
                    Review Word
                  </div>
                  <div className="text-[11px] text-text-light mb-4">
                    {word.reviewReason || 'Reinforcement from your Needs Work queue.'}
                  </div>
                </>
              )}
              <div className="secondary-font text-5xl mb-3 text-text-dark leading-tight">
                {word.simp}
              </div>
              {word.pinyin && (
                <div className="text-[1.45rem] text-text-med mb-3">
                  {word.pinyin}
                </div>
              )}
              <div className="text-sm text-text-light italic mt-3">
                Tap to reveal meaning
              </div>
            </div>
          ) : (
            // Back side
            <div className="text-center w-full">
              <div className="mt-1 flex justify-center">
                <div className="w-full max-w-sm text-center space-y-4">
                {meaningList.map((def, idx) => (
                  <div
                    key={idx}
                    className="text-base md:text-lg text-text-dark leading-relaxed font-medium"
                  >
                    {def}
                  </div>
                ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Audio Controls */}
      <div className="flex gap-3 justify-center px-5 pb-4">
        <button
          onClick={() => speak(word.simp, word.pinyin, false)}
          className="flex items-center gap-2 px-6 py-3 bg-[#186E95] text-white rounded-2xl font-semibold tracking-wide transition-all hover:bg-[#145C7C] hover:-translate-y-0.5 hover:shadow-lg"
        >
          <Volume2 className="w-5 h-5" />
          Listen
        </button>
        <button
          onClick={() => speak(word.simp, word.pinyin, true)}
          className="flex items-center gap-2 px-6 py-3 bg-white border border-[rgba(55,65,81,0.40)] text-[#374151] rounded-2xl font-semibold tracking-wide transition-all hover:bg-[rgba(55,65,81,0.08)]"
        >
          <Snail className="w-5 h-5" />
          Slow
        </button>
      </div>

      {/* Navigation Buttons */}
      <div className="fixed bottom-20 left-0 right-0 z-40 px-5 pb-2 border-t border-border pt-3 bg-bg-warm/95 backdrop-blur-sm">
        <button
          onClick={handleNext}
          className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-[#374151] text-white rounded-2xl font-semibold tracking-wide transition-all hover:bg-[#1F2937] hover:-translate-y-0.5 hover:shadow-lg"
        >
          {currentIndex < totalWords - 1 ? 'Next' : 'Finish'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
