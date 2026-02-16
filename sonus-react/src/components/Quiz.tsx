import { useState } from 'react';
import type { Word } from '../types/lesson.types';
import { useAudio } from '../hooks/useAudio';
import { Volume2, ChevronRight } from 'lucide-react';
import { sendQuizAttemptSafe } from '../lib/backendApi';
import { trackEvent } from '../lib/analytics';
import { useApp } from '../contexts/AppContext';
import WordProgressRail from './WordProgressRail';

interface QuizProps {
  word: Word;
  allWords: Word[];
  currentIndex: number;
  totalWords: number;
  listeningMode?: boolean;
  onNext: () => void;
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
}: QuizProps) {
  const { state, recordQuizResult } = useApp();
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

  return (
    <div className="flex flex-col min-h-full">
      {/* Progress Bar */}
      <WordProgressRail
        total={totalWords}
        currentIndex={currentIndex}
        resultsByIndex={state.quizResultsByIndex}
      />

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
            {!selectedAnswer ? (
              <>
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
              </>
            ) : (
              <div className="py-1">
                <div
                  className={`text-xl font-semibold mb-2 ${
                    isCorrect ? 'text-[#3E5648]' : 'text-[#C2410C]'
                  }`}
                >
                  {isCorrect ? 'Correct!' : 'Not Quite'}
                </div>
                <div className="text-xs uppercase tracking-wider font-mono text-text-light mb-1">
                  Why This Answer
                </div>
                <div className="text-[1.2rem] text-text-med">{word.pinyin}</div>
                <div className="text-xl font-semibold text-text-dark">{word.en}</div>
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
