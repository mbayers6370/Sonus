import { useState } from 'react';
import type { Word } from '../types/lesson.types';
import { useAudio } from '../hooks/useAudio';
import { Volume2, Zap, ChevronLeft, ChevronRight } from 'lucide-react';

interface FlashcardProps {
  word: Word;
  currentIndex: number;
  totalWords: number;
  onNext: () => void;
  onPrev: () => void;
}

export default function Flashcard({
  word,
  currentIndex,
  totalWords,
  onNext,
  onPrev,
}: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const { speak } = useAudio();

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    setIsFlipped(false);
    onNext();
  };

  const handlePrev = () => {
    setIsFlipped(false);
    onPrev();
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Progress Bar */}
      <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-[#1E3A8A] to-[#4D7C0F] transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / totalWords) * 100}%` }}
        />
      </div>

      {/* Progress Text */}
      <div className="text-center text-sm text-text-med font-medium mb-3">
        {currentIndex + 1} / {totalWords}
      </div>

      {/* Flashcard */}
      <div className="flex-1 flex items-center justify-center px-5 py-2">
        <div
          onClick={handleFlip}
          className="w-full max-w-md min-h-[210px] md:min-h-[250px] bg-white rounded-3xl shadow-xl border border-border cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl flex items-center justify-center p-5"
        >
          {!isFlipped ? (
            // Front side
            <div className="text-center w-full">
              {word.isReview && (
                <div className="inline-flex mb-2 items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono bg-[rgba(30,58,138,0.16)] text-[#1E3A8A]">
                  Review
                </div>
              )}
              <div className="font-noto-serif text-5xl mb-3 text-text-dark">
                {word.simp}
              </div>
              {word.pinyin && (
                <div className="text-xl text-text-med mb-3">
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
              <div className="text-2xl font-semibold text-[#1E3A8A] mb-3">
                {word.en}
              </div>
              {word.defs && word.defs.length > 1 && (
                <div className="mt-4 text-left space-y-1.5">
                  {word.defs.slice(0, 3).map((def, idx) => (
                    <div key={idx} className="text-sm text-text-med leading-relaxed">
                      • {def}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Audio Controls */}
      <div className="flex gap-3 justify-center px-5 pb-4">
        <button
          onClick={() => speak(word.simp, word.pinyin, false)}
          className="flex items-center gap-2 px-6 py-3 bg-[#1E3A8A] text-white rounded-xl font-medium transition-all hover:bg-[#182F74] hover:-translate-y-0.5 hover:shadow-lg"
        >
          <Volume2 className="w-5 h-5" />
          Listen
        </button>
        <button
          onClick={() => speak(word.simp, word.pinyin, true)}
          className="flex items-center gap-2 px-6 py-3 bg-white border border-[rgba(55,65,81,0.40)] text-[#374151] rounded-xl font-medium transition-all hover:bg-[rgba(55,65,81,0.08)]"
        >
          <Zap className="w-5 h-5" />
          Slow
        </button>
      </div>

      {/* Navigation Buttons */}
      <div className="fixed bottom-20 left-0 right-0 z-40 flex gap-3 px-5 pb-2 border-t border-border pt-3 bg-bg-warm/95 backdrop-blur-sm">
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 border border-border rounded-xl font-medium transition-all hover:bg-[rgba(55,65,81,0.08)] hover:border-[rgba(55,65,81,0.45)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
        >
          <ChevronLeft className="w-5 h-5" />
          Previous
        </button>
        <button
          onClick={handleNext}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-[#374151] text-white rounded-xl font-medium transition-all hover:bg-[#1F2937] hover:-translate-y-0.5 hover:shadow-lg"
        >
          {currentIndex < totalWords - 1 ? 'Next' : 'Finish'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
