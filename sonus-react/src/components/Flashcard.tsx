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
  const isReviewWord = Boolean(word.isReview);
  const homophoneCount = word.homophoneGroup?.count || 0;
  const homophoneChars = homophoneCount > 1
    ? Array.from(
        new Set(
          (word.homophoneGroup?.members || [])
            .map((member) => (typeof member.simp === 'string' ? member.simp.trim() : ''))
            .filter(Boolean)
        )
      )
    : [];
  const homophoneLabel = homophoneChars.length > 0
    ? `Homophones: ${homophoneChars.join(' / ')}`
    : '';
  const isJapanese = (state.selectedLanguage || '').trim().toLowerCase() === 'ja';
  const ttsText = isJapanese ? (word.hiragana || word.reading || word.simp) : word.simp;
  const ttsReading = isJapanese ? (word.reading || word.pinyin) : word.pinyin;

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    setIsFlipped(false);
    onNext();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Progress Bar */}
      <WordProgressRail total={totalWords} currentIndex={currentIndex} />

      {/* Flashcard */}
      <div className="flex-1 flex items-center justify-center px-5 py-2">
        <div
          onClick={handleFlip}
          className={`relative w-full max-w-md md:max-w-xl lg:max-w-2xl h-[220px] sm:h-[245px] md:h-[235px] lg:h-[220px] rounded-3xl shadow-[0_18px_38px_-28px_rgba(15,23,42,0.45)] border cursor-pointer transition-shadow duration-200 hover:shadow-[0_24px_46px_-28px_rgba(15,23,42,0.42)] flex items-center justify-center p-5 sm:p-6 overflow-hidden ${
            isFlipped ? 'bg-[#1F2A37] border-[#1F2A37]' : 'bg-white border-border'
          }`}
        >
          {isReviewWord ? (
            <div className={`absolute top-3 left-3 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] border ${
              isFlipped
                ? 'bg-[#186E95]/30 text-[#D8F2FF] border-[#7CC7EA]/45'
                : 'bg-[#186E95]/12 text-[#145B7A] border-[#186E95]/30'
            }`}>
              Review
            </div>
          ) : null}
          {hasPoliteTag ? (
            <div className={`absolute top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${
              isFlipped ? 'bg-white/15 text-white/90 border border-white/20' : 'bg-[#1F2A37]/8 text-[#1F2A37] border border-[#1F2A37]/20'
            }`}>
              Polite
            </div>
          ) : null}
          {homophoneCount > 1 ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIsFlipped(true);
              }}
              className={`absolute top-3 right-3 rounded-full px-2.5 py-1 text-[11px] tracking-[0.02em] border ${
                isFlipped
                  ? 'bg-[#C56A3D]/18 text-[#FDE7D8] border-[#C56A3D]/45'
                  : 'bg-[#C56A3D]/12 text-[#9A4520] border-[#C56A3D]/40 hover:bg-[#C56A3D]/18'
              }`}
              title={homophoneLabel}
            >
              {homophoneLabel}
            </button>
          ) : null}
          {!isFlipped ? (
            // Front side
            <div className={`text-center w-full h-full flex flex-col items-center justify-center ${hasPoliteTag ? 'pt-7' : ''}`}>
              <div className="secondary-font text-4xl sm:text-[2.35rem] mb-2.5 text-text-dark leading-tight break-words">
                {word.simp}
              </div>
              {word.pinyin && (
                <div className="text-[1.2rem] sm:text-[1.3rem] text-text-med mb-2.5 break-words">
                  {word.pinyin}
                </div>
              )}
              <div className="text-[13px] text-text-light italic mt-2.5">
                Tap to reveal meaning
              </div>
            </div>
          ) : (
            // Back side
            <div className={`text-center w-full h-full flex flex-col ${hasPoliteTag ? 'pt-7' : ''}`}>
              <div className="flex-1 flex items-center justify-center w-full">
                <div className="w-full max-w-sm text-center space-y-3 max-h-full overflow-y-auto px-1">
                  {meaningList.map((def, idx) => (
                    <div
                      key={idx}
                      className="text-[15px] sm:text-base md:text-[1.02rem] text-white leading-relaxed font-medium"
                    >
                      {def}
                    </div>
                  ))}
                </div>
              </div>
              {homophoneCount > 1 ? (
                <div className="pt-1 text-[10px] leading-relaxed text-[#C56A3D]">
                  Pay close attention to the character form with homophones to identify the intended word correctly.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Audio Controls */}
      <div className="flex gap-3 justify-center px-5 pb-3 mb-[4.7rem] sm:mb-[6.25rem] md:mb-[6.75rem]">
        <button
          onClick={() => speak(ttsText, ttsReading, false, state.selectedLanguage)}
          className="flex items-center gap-1.5 px-5 py-2.5 sm:px-6 sm:py-3 bg-[#186E95] text-white rounded-2xl text-[15px] sm:text-base font-semibold tracking-wide transition-colors hover:bg-[#145B7A] active:bg-[#145B7A]"
        >
          <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
          Listen
        </button>
        <button
          onClick={() => speak(ttsText, ttsReading, true, state.selectedLanguage)}
          className="flex items-center gap-1.5 px-5 py-2.5 sm:px-6 sm:py-3 bg-white border border-[rgba(31,42,55,0.40)] text-[#1F2A37] rounded-2xl text-[15px] sm:text-base font-semibold tracking-wide transition-colors hover:bg-white active:bg-white"
        >
          <Snail className="w-4 h-4 sm:w-5 sm:h-5" />
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
