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
  const explanationDefs = (word.defs && word.defs.length > 0 ? word.defs : [word.en]).slice(0, 2);

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
      <div className="w-full h-2 bg-gray-200/90 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-[#186E95] to-[#C2410C] transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / totalWords) * 100}%` }}
        />
      </div>

      {/* Quiz Question */}
      <div className="flex-1 px-4">
        <div
          className={`rounded-3xl p-3.5 mb-3 border relative ${
            listeningMode
              ? 'bg-[#186E95] text-white border-[#186E95]/30 shadow-[0_14px_32px_-24px_rgba(24,110,149,0.45)]'
              : 'bg-[rgba(55,65,81,0.08)] border-border/80'
          }`}
        >
            <div className="text-center">
              {word.isReview && (
                <>
                  <div
                    className={`inline-flex mb-1 items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono ${
                      listeningMode
                        ? 'bg-white/20 text-white'
                        : 'bg-[rgba(24,110,149,0.16)] text-[#186E95]'
                    }`}
                  >
                    Review Word
                  </div>
                  <div className={`mb-2 text-[11px] ${listeningMode ? 'text-white/80' : 'text-text-light'}`}>
                    {word.reviewReason || 'Reinforcement word from your Needs Work queue.'}
                  </div>
                </>
              )}
              <div className={`text-[1.05rem] mb-2 font-medium ${listeningMode ? 'text-white/90' : 'text-text-med'}`}>
                {listeningMode ? 'Listen and choose the meaning' : 'What does this mean?'}
              </div>
            {!listeningMode ? (
              <>
                <div className="secondary-font text-4xl mb-1 text-text-dark leading-tight">
                  {word.simp}
                </div>
                {word.pinyin && (
                  <div className="text-[1.2rem] text-text-med">{word.pinyin}</div>
                )}
                <div className="mt-2">
                  <button
                    onClick={() => speak(word.simp, word.pinyin)}
                    className="mx-auto w-12 h-12 rounded-full border border-[#374151]/35 bg-transparent text-[#374151] flex items-center justify-center hover:bg-[rgba(55,65,81,0.08)] transition-all"
                    aria-label="Play audio"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-1">
                <button
                  onClick={() => speak(word.simp, word.pinyin)}
                  className="mx-auto w-12 h-12 rounded-full border border-white/70 bg-white/10 text-white flex items-center justify-center hover:bg-white/18 transition-all"
                  aria-label="Play audio"
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Answer Choices */}
        <div className="space-y-2 mb-3">
          {allChoices.map((choice, idx) => {
            const isSelected = selectedAnswer === choice;
            const isCorrectAnswer = choice === word.en;

            let buttonClass = 'w-full min-h-[46px] p-3 rounded-2xl font-medium text-center transition-all border-2 ';

            if (selectedAnswer) {
              // After answering
              if (isCorrectAnswer) {
                buttonClass += 'bg-[rgba(62,86,72,0.12)] border-[#3E5648] text-[#3E5648]';
              } else if (isSelected) {
                buttonClass += 'bg-[rgba(194,65,12,0.12)] border-[#C2410C] text-[#C2410C]';
              } else {
                buttonClass += 'border-border text-text-med opacity-50';
              }
            } else {
              // Before answering
              buttonClass += 'border-border hover:border-[#186E95] hover:bg-[rgba(24,110,149,0.08)] cursor-pointer';
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
          <div className="mb-4 space-y-2">
            {isCorrect ? (
              <div className="flex items-center gap-3 p-4 bg-[rgba(62,86,72,0.12)] border border-[#3E5648] rounded-2xl text-[#3E5648]">
                <CheckCircle className="w-6 h-6" />
                <span className="font-semibold">
                  {word.isReview ? 'Recovered: you got this review word right.' : 'Correct!'}
                </span>
              </div>
            ) : (
              <div className="p-4 bg-[rgba(194,65,12,0.12)] border border-[#C2410C] rounded-2xl text-[#C2410C]">
                <div className="flex items-center gap-3">
                  <XCircle className="w-6 h-6" />
                  <span className="font-semibold">
                    {word.isReview ? 'Needs reinforcement: this review word will come back.' : 'Not quite. Let’s review it quickly.'}
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
            <div className="rounded-2xl border border-border bg-white p-3.5">
              <div className="text-xs uppercase tracking-wider font-mono text-text-light mb-1">
                Why This Answer
              </div>
              <div className="text-sm text-text-dark font-semibold">
                {word.simp}
                {word.pinyin ? <span className="font-normal text-text-med"> ({word.pinyin})</span> : null}
                {' · '}
                {word.en}
              </div>
              <div className="mt-1 space-y-1">
                {explanationDefs.map((def) => (
                  <div key={def} className="text-sm text-text-med">
                    • {def}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="fixed bottom-20 left-0 right-0 z-40 flex gap-3 px-5 pb-2 border-t border-border pt-3 bg-bg-warm/95 backdrop-blur-sm">
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 border border-border rounded-2xl font-medium transition-all hover:bg-[rgba(55,65,81,0.08)] hover:border-[rgba(55,65,81,0.45)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
        >
          <ChevronLeft className="w-5 h-5" />
          Previous
        </button>
        <button
          onClick={handleNext}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-[#374151] text-white rounded-2xl font-semibold tracking-wide transition-all hover:bg-[#1F2937] hover:-translate-y-0.5 hover:shadow-lg"
        >
          {currentIndex < totalWords - 1 ? 'Next' : 'Finish'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
