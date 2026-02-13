import { useState } from 'react';
import type { Word } from '../types/lesson.types';
import { useAudio } from '../hooks/useAudio';
import { Volume2, ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { sendQuizAttemptSafe } from '../lib/backendApi';
import { trackEvent } from '../lib/analytics';
import { useApp } from '../contexts/AppContext';

interface QuizProps {
  word: Word;
  allWords: Word[];
  currentIndex: number;
  totalWords: number;
  listeningMode?: boolean;
  onNext: () => void;
  onPrev: () => void;
}

function shuffleArray<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildChoices(word: Word, allWords: Word[]) {
  const wrongAnswers = shuffleArray(allWords.filter((w) => w.simp !== word.simp))
    .slice(0, 3)
    .map((w) => w.en);
  return shuffleArray([word.en, ...wrongAnswers]);
}

export default function Quiz({
  word,
  allWords,
  currentIndex,
  totalWords,
  listeningMode = false,
  onNext,
  onPrev,
}: QuizProps) {
  const { recordQuizResult } = useApp();
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [allChoices, setAllChoices] = useState<string[]>(() => buildChoices(word, allWords));
  const { speak } = useAudio();

  const handleAnswer = (choice: string) => {
    if (selectedAnswer) return; // Already answered

    setSelectedAnswer(choice);
    const correct = choice === word.en;
    setIsCorrect(correct);

    sendQuizAttemptSafe({
      wordId: word.id,
      isCorrect: correct,
      isReview: Boolean(word.isReview),
      answerText: choice,
    });
    recordQuizResult(currentIndex, correct);
    trackEvent('quiz_answered', {
      wordId: word.id,
      isCorrect: correct,
      isReview: Boolean(word.isReview),
    });
    if (correct && word.isReview) {
      trackEvent('weak_word_resolved', {
        wordId: word.id,
        context: 'quiz',
      });
    }
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setIsCorrect(null);
    const nextWord = allWords[Math.min(currentIndex + 1, allWords.length - 1)] || word;
    setAllChoices(buildChoices(nextWord, allWords));
    onNext();
  };

  const handlePrev = () => {
    setSelectedAnswer(null);
    setIsCorrect(null);
    const prevWord = allWords[Math.max(currentIndex - 1, 0)] || word;
    setAllChoices(buildChoices(prevWord, allWords));
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

      {/* Quiz Question */}
      <div className="flex-1 px-5">
        <div
          className={`rounded-2xl p-3 mb-3 relative ${
            listeningMode
              ? 'bg-[#1E3A8A] text-white border border-[#1E3A8A]/30'
              : 'bg-[rgba(55,65,81,0.08)]'
          }`}
        >
            <div className="text-center">
              {word.isReview && (
                <div
                  className={`inline-flex mb-2 items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono ${
                    listeningMode
                      ? 'bg-white/20 text-white'
                      : 'bg-[rgba(30,58,138,0.16)] text-[#1E3A8A]'
                  }`}
                >
                  Review
                </div>
              )}
              <div className={`text-sm mb-2 font-medium ${listeningMode ? 'text-white/90' : 'text-text-med'}`}>
                {listeningMode ? 'Listen and choose the meaning' : 'What does this mean?'}
              </div>
            {!listeningMode ? (
              <>
                <div className="font-noto-serif text-3xl mb-1 text-text-dark">
                  {word.simp}
                </div>
                {word.pinyin && (
                  <div className="text-lg text-text-med">{word.pinyin}</div>
                )}
              </>
            ) : (
              <div className="text-xs uppercase tracking-wider font-mono text-white/85">
                Audio first
              </div>
            )}
          </div>

          {/* Audio Button */}
          <button
            onClick={() => speak(word.simp, word.pinyin)}
            className={`absolute ${listeningMode ? 'right-3 top-1/2 -translate-y-1/2 w-11 h-11 text-[#1E3A8A] border border-[#1E3A8A]/15' : 'top-4 right-4 w-10 h-10'} rounded-full bg-white shadow-md flex items-center justify-center hover:bg-[#1E3A8A] hover:text-white transition-all`}
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </div>

        {/* Answer Choices */}
        <div className="space-y-2 mb-4">
          {allChoices.map((choice, idx) => {
            const isSelected = selectedAnswer === choice;
            const isCorrectAnswer = choice === word.en;

            let buttonClass = 'w-full p-2.5 rounded-xl font-medium text-left transition-all border-2 ';

            if (selectedAnswer) {
              // After answering
              if (isCorrectAnswer) {
                buttonClass += 'bg-[rgba(77,124,15,0.12)] border-[#4D7C0F] text-[#4D7C0F]';
              } else if (isSelected) {
                buttonClass += 'bg-[rgba(194,65,12,0.12)] border-[#C2410C] text-[#C2410C]';
              } else {
                buttonClass += 'border-border text-text-med opacity-50';
              }
            } else {
              // Before answering
              buttonClass += 'border-border hover:border-[#1E3A8A] hover:bg-[rgba(30,58,138,0.08)] cursor-pointer';
            }

            return (
              <button
                key={idx}
                onClick={() => handleAnswer(choice)}
                disabled={!!selectedAnswer}
                className={buttonClass}
              >
                {choice}
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {selectedAnswer && (
          <div className="mb-4">
            {isCorrect ? (
              <div className="flex items-center gap-3 p-4 bg-[rgba(77,124,15,0.12)] border border-[#4D7C0F] rounded-xl text-[#4D7C0F]">
                <CheckCircle className="w-6 h-6" />
                <span className="font-semibold">
                  {word.isReview ? 'Recovered: you got this review word right.' : 'Correct!'}
                </span>
              </div>
            ) : (
              <div className="p-4 bg-[rgba(194,65,12,0.12)] border border-[#C2410C] rounded-xl text-[#C2410C]">
                <div className="flex items-center gap-3">
                  <XCircle className="w-6 h-6" />
                  <span className="font-semibold">
                    {word.isReview ? 'Needs reinforcement: this review word will come back.' : 'Not quite. Try again next time!'}
                  </span>
                </div>
                {listeningMode && (
                  <div className="mt-2 text-sm">
                    Correct word: <span className="font-semibold text-text-dark">{word.simp}</span>
                    {word.pinyin ? <span className="text-text-med"> ({word.pinyin})</span> : null}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
