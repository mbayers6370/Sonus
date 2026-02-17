import { useState } from 'react';
import type { ReactNode } from 'react';
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

function normalizeAnswerText(text: string) {
  return text.trim().toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function maskExample(example: string, targets: string[]) {
  const source = example.trim();
  if (!source) return '';

  // Prefer direct term replacement, then fall back to whole-word matching.
  for (const target of targets) {
    const term = target.trim();
    if (!term) continue;
    if (source.includes(term)) {
      return source.replace(term, '_____');
    }
    const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i');
    if (regex.test(source)) {
      return source.replace(regex, '_____');
    }
  }

  return source;
}

function highlightFirstMatch(
  source: string,
  targets: string[],
  highlightClass: string,
  caseInsensitive = false
): ReactNode {
  const text = source.trim();
  if (!text) return source;

  for (const rawTarget of targets) {
    const target = rawTarget.trim();
    if (!target) continue;

    let start = -1;
    if (caseInsensitive) {
      start = text.toLowerCase().indexOf(target.toLowerCase());
    } else {
      start = text.indexOf(target);
    }
    if (start < 0) continue;
    const end = start + target.length;
    return (
      <>
        {text.slice(0, start)}
        <span className={highlightClass}>{text.slice(start, end)}</span>
        {text.slice(end)}
      </>
    );
  }

  return text;
}

function buildChoices(word: Word, allWords: Word[]) {
  const correctAnswer = word.en.trim();
  const correctKey = normalizeAnswerText(correctAnswer);

  // Build distractors from lesson vocabulary while deduplicating near-identical
  // answers after normalization.
  const uniqueDistractors = new Map<string, string>();
  for (const candidate of shuffleArray(allWords)) {
    if (candidate.simp === word.simp) continue;
    const answer = candidate.en.trim();
    if (!answer) continue;
    const key = normalizeAnswerText(answer);
    if (key === correctKey) continue;
    if (!uniqueDistractors.has(key)) {
      uniqueDistractors.set(key, answer);
    }
  }

  const wrongAnswers = Array.from(uniqueDistractors.values()).slice(0, 3);
  return shuffleArray([correctAnswer, ...wrongAnswers]);
}

export default function Quiz({
  word,
  allWords,
  currentIndex,
  totalWords,
  listeningMode = false,
  onNext,
}: QuizProps) {
  const { state, recordQuizResult, recordWordOutcome } = useApp();
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
    if (isCorrect === null) return;
    // Persist spaced-review outcome before advancing to the next prompt.
    recordWordOutcome(word, isCorrect, isCorrect ? 'sure' : 'unsure', 'quiz');
    setSelectedAnswer(null);
    setIsCorrect(null);
    const nextWord = allWords[Math.min(currentIndex + 1, allWords.length - 1)] || word;
    setAllChoices(buildChoices(nextWord, allWords));
    onNext();
  };

  const clozeZh = word.example?.zh
    ? maskExample(word.example.zh, [word.simp, word.trad])
    : '';
  const fullZh = word.example?.zh?.trim() || '';
  const fullEn = word.example?.en?.trim() || '';
  const clozeEn = fullEn
    ? maskExample(fullEn, [word.en, ...(word.defs || [])])
    : '';
  const highlightClass = 'text-[#3E5648] font-semibold';
  const zhFilled = fullZh
    ? highlightFirstMatch(fullZh, [word.simp, word.trad], highlightClass)
    : '';
  const enFilled = fullEn
    ? highlightFirstMatch(fullEn, [word.en, ...(word.defs || [])], highlightClass, true)
    : '';

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
              ? 'bg-[#EAF3F8] border-[#AFCFE0]'
              : 'bg-[#F0F2F5] border-[#D1D5DB]'
          }`}
        >
          <div className="text-center">
            <>
              {!listeningMode ? (
                <>
                  <div className="secondary-font text-4xl mb-1 text-text-dark leading-tight">
                    {word.simp}
                  </div>
                  {word.pinyin && (
                    <div className="text-[1.2rem] text-text-med">{word.pinyin}</div>
                  )}
                  {(clozeZh || clozeEn || fullEn) && (
                    <div className="mt-2 text-center space-y-1">
                      {selectedAnswer && fullZh ? (
                        <div className="text-sm text-text-light leading-relaxed">{zhFilled}</div>
                      ) : null}
                      {selectedAnswer && fullEn ? (
                        <div className="text-xs text-text-light leading-relaxed">{enFilled}</div>
                      ) : null}
                    </div>
                  )}
                  {selectedAnswer ? (
                    <div
                      className={`mt-2 text-base font-semibold ${
                        isCorrect ? 'text-[#3E5648]' : 'text-[#C2410C]'
                      }`}
                    >
                      {isCorrect ? 'Correct!' : 'Not Quite!'}
                    </div>
                  ) : null}
                  {!selectedAnswer ? (
                    <div className="mt-2">
                      <button
                        onClick={() => speak(word.simp, word.pinyin)}
                        className="mx-auto w-12 h-12 rounded-full border border-[#374151]/35 bg-transparent text-[#374151] flex items-center justify-center hover:bg-[rgba(55,65,81,0.08)] transition-all"
                        aria-label="Play audio"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="mt-1">
                  <button
                    onClick={() => speak(word.simp, word.pinyin)}
                    className="mx-auto w-12 h-12 rounded-full border-2 border-[#186E95] bg-white text-[#186E95] flex items-center justify-center hover:bg-[rgba(24,110,149,0.08)] transition-all"
                    aria-label="Play audio"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                  {selectedAnswer ? (
                    <div className="mt-2 text-center">
                      <div className="secondary-font text-3xl text-white leading-tight">{word.simp}</div>
                      {word.pinyin ? (
                        <div className="text-sm text-white/85 mt-0.5">{word.pinyin}</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </>
          </div>

        </div>

        {/* Answer Choices */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {allChoices.map((choice, idx) => {
            const isSelected = selectedAnswer === choice;
            const isCorrectAnswer = choice === word.en;

            let buttonClass = 'w-full min-h-[56px] p-3 rounded-2xl font-medium text-center transition-all border-2 ';

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
                key={`${choice}-${idx}`}
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
