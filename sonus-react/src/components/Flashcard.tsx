import { useState } from 'react';
import type { Word } from '../types/lesson.types';
import { useAudio } from '../hooks/useAudio';
import { Volume2, Snail, ChevronLeft, ChevronRight } from 'lucide-react';
import WordProgressRail from './WordProgressRail';
import { useApp } from '../contexts/AppContext';

interface FlashcardProps {
  word: Word;
  currentIndex: number;
  totalWords: number;
  onPrev: () => void;
  onNext: () => void;
}

export default function Flashcard({
  word,
  currentIndex,
  totalWords,
  onPrev,
  onNext,
}: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const { state } = useApp();
  const { speak } = useAudio();
  const meaningList = (word.defs && word.defs.length > 0 ? word.defs : [word.en]).slice(0, 3);
  const hasPoliteTag = [...(word.tags || []), ...(word.meta?.grammarTags || [])]
    .some((tag) => tag.trim().toLowerCase() === 'polite');

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
      <WordProgressRail total={totalWords} currentIndex={currentIndex} />

      {/* Flashcard */}
      <div className="flex-1 flex items-center justify-center px-5 py-2">
        <div
          onClick={handleFlip}
          className={`relative w-full max-w-md min-h-[220px] md:min-h-[255px] rounded-3xl shadow-[0_18px_38px_-28px_rgba(15,23,42,0.45)] border cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_46px_-28px_rgba(15,23,42,0.42)] flex items-center justify-center p-6 ${
            isFlipped ? 'bg-[#1F2A37] border-[#1F2A37]' : 'bg-white border-border'
          }`}
        >
          {hasPoliteTag ? (
            <div className={`absolute top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${
              isFlipped ? 'bg-white/15 text-white/90 border border-white/20' : 'bg-[#1F2A37]/8 text-[#1F2A37] border border-[#1F2A37]/20'
            }`}>
              Polite
            </div>
          ) : null}
          {!isFlipped ? (
            // Front side
            <div className={`text-center w-full ${hasPoliteTag ? 'pt-7' : ''}`}>
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
            <div className={`text-center w-full ${hasPoliteTag ? 'pt-7' : ''}`}>
              <div className="mt-1 flex justify-center">
                <div className="w-full max-w-sm text-center space-y-4">
                {meaningList.map((def, idx) => (
                  <div
                    key={idx}
                    className="text-base md:text-lg text-white leading-relaxed font-medium"
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
          onClick={() => speak(word.simp, word.pinyin, false, state.selectedLanguage)}
          className="flex items-center gap-2 px-6 py-3 bg-[#186E95] text-white rounded-2xl font-semibold tracking-wide transition-all hover:bg-[#186E95] hover:-translate-y-0.5 hover:shadow-lg"
        >
          <Volume2 className="w-5 h-5" />
          Listen
        </button>
        <button
          onClick={() => speak(word.simp, word.pinyin, true, state.selectedLanguage)}
          className="flex items-center gap-2 px-6 py-3 bg-white border border-[rgba(31,42,55,0.40)] text-[#1F2A37] rounded-2xl font-semibold tracking-wide transition-all hover:bg-[rgba(31,42,55,0.08)]"
        >
          <Snail className="w-5 h-5" />
          Slow
        </button>
      </div>

      {/* Navigation Buttons */}
      <div className="fixed left-0 right-0 z-40 px-5 pb-2 border-t border-border pt-2 bg-bg-warm/95 backdrop-blur-sm bottom-[calc(var(--sonus-bottom-nav-height,5rem)+env(safe-area-inset-bottom,0px))]">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onPrev}
            disabled={currentIndex === 0}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-white border border-[rgba(31,42,55,0.35)] text-[#1F2A37] rounded-2xl font-semibold tracking-wide transition-all hover:bg-[rgba(31,42,55,0.08)] disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>
          <button
            onClick={handleNext}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-[#1F2A37] text-white rounded-2xl font-semibold tracking-wide transition-all hover:bg-[#1F2A37] hover:-translate-y-0.5 hover:shadow-lg"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
