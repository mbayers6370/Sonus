import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Word } from '../types/lesson.types';
import { useAudio } from '../hooks/useAudio';
import { Volume2, ChevronRight } from 'lucide-react';
import { sendQuizAttemptSafe } from '../lib/backendApi';
import { trackEvent } from '../lib/analytics';
import { useApp } from '../contexts/AppContext';
import { getExampleNative, getWordReading } from '../lib/languageFields';
import { romanizeJapaneseForDisplay } from '../lib/speakRuntime';
import WordProgressRail from './WordProgressRail';

interface QuizProps {
  word: Word;
  allWords: Word[];
  currentIndex: number;
  totalWords: number;
  listeningMode?: boolean;
  hideReadingAndMeaning?: boolean;
  showNeedReviewAction?: boolean;
  onNeedReview?: () => void;
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
  hideReadingAndMeaning = false,
  showNeedReviewAction = false,
  onNeedReview,
  onNext,
}: QuizProps) {
  const { state, recordQuizResult, recordWordOutcome } = useApp();
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [allChoices, setAllChoices] = useState<string[]>(() => buildChoices(word, allWords));
  const { speak } = useAudio();

  useEffect(() => {
    setSelectedAnswer(null);
    setIsCorrect(null);
    setAllChoices(buildChoices(word, allWords));
  }, [word.id, currentIndex, allWords]);
  const isJapanese = (state.selectedLanguage || '').trim().toLowerCase() === 'ja';
  const ttsText = isJapanese ? (word.hiragana || word.reading || word.simp) : word.simp;
  const ttsReading = getWordReading(word);
  const displayReading = !hideReadingAndMeaning
    ? (
        isJapanese
          ? (
              romanizeJapaneseForDisplay(
                word.reading || word.hiragana || getWordReading(word) || word.simp || ''
              ) || ''
            )
          : (getWordReading(word) || '')
      )
    : '';
  const hasPoliteTag = [...(word.tags || []), ...(word.meta?.grammarTags || [])]
    .some((tag) => tag.trim().toLowerCase() === 'polite');
  const isReviewWord = Boolean(word.isReview);

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
    onNext();
  };

  const nativeSentence = getExampleNative(word.example);
  const clozeNativeSentence = nativeSentence
    ? maskExample(nativeSentence, [word.simp, word.trad])
    : '';
  const fullNativeSentence = nativeSentence;
  const fullEn = word.example?.en?.trim() || '';
  const clozeEn = fullEn
    ? maskExample(fullEn, [word.en, ...(word.defs || [])])
    : '';
  const highlightClass = listeningMode ? 'text-[var(--sonus-palette-green)] font-semibold' : 'text-[#B7E4CC] font-semibold';
  const nativeFilled = fullNativeSentence
    ? highlightFirstMatch(fullNativeSentence, [word.simp, word.trad], highlightClass)
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
          className={`rounded-3xl p-5 mb-3 border relative ${
            listeningMode
              ? 'bg-[var(--sonus-palette-charcoal)] border-[var(--sonus-palette-charcoal)]'
              : 'bg-[var(--sonus-palette-charcoal)] border-[var(--sonus-palette-charcoal)]'
          }`}
        >
          {isReviewWord ? (
            <div
              className="absolute top-3 left-3 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] border bg-[var(--sonus-palette-blue)]/30 text-[#D8F2FF] border-[#7CC7EA]/45"
            >
              Review
            </div>
          ) : null}
          {hasPoliteTag ? (
            <div
              className={`absolute top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${
                listeningMode
                  ? 'bg-white/12 text-white border border-white/25'
                  : 'bg-white/15 text-white/90 border border-white/20'
              }`}
            >
              Polite
            </div>
          ) : null}
          <div className="text-center">
            <>
              {!listeningMode ? (
                <>
                  <div className={`secondary-font text-4xl mb-1 text-white leading-tight ${hasPoliteTag ? 'mt-7' : ''}`}>
                    {word.simp}
                  </div>
                  {displayReading ? (
                    <div className="text-[1.2rem] text-white/80">{displayReading}</div>
                  ) : null}
                  {!hideReadingAndMeaning && (clozeNativeSentence || clozeEn || fullEn) && (
                    <div className="mt-2 text-center space-y-1">
                      {selectedAnswer && fullNativeSentence ? (
                        <div className="text-sm text-white/80 leading-relaxed">{nativeFilled}</div>
                      ) : null}
                      {selectedAnswer && fullEn ? (
                        <div className="text-xs text-white/75 leading-relaxed">{enFilled}</div>
                      ) : null}
                    </div>
                  )}
                  {selectedAnswer ? (
                    <div
                      className={`mt-2 text-base font-semibold ${
                        isCorrect ? 'text-[#8DD3AE]' : 'text-[#FCA5A5]'
                      }`}
                    >
                      {isCorrect ? 'Correct!' : 'Not Quite!'}
                    </div>
                  ) : null}
                  {!selectedAnswer ? (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => speak(ttsText, ttsReading, false, state.selectedLanguage)}
                        className="mx-auto w-12 h-12 rounded-full border border-white/35 bg-transparent text-white flex items-center justify-center hover:bg-white/10 transition-all"
                        aria-label="Play audio"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className={hasPoliteTag ? 'mt-7' : 'mt-1'}>
                  <button
                    type="button"
                    onClick={() => speak(ttsText, ttsReading, false, state.selectedLanguage)}
                    className="mx-auto w-12 h-12 rounded-full bg-white text-[var(--sonus-palette-charcoal)] flex items-center justify-center hover:bg-[#E5E7EB] transition-all"
                    aria-label="Play audio"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                  {selectedAnswer ? (
                    <div className="mt-2 text-center">
                      <div className="secondary-font text-3xl text-white leading-tight">{word.simp}</div>
                      {displayReading ? (
                        <div className="text-sm text-white/80 mt-0.5">{displayReading}</div>
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

            let buttonClass = 'w-full min-h-[48px] sm:min-h-[56px] p-2.5 sm:p-3 rounded-2xl text-[12px] sm:text-[13px] font-medium text-center transition-all border-2 bg-white ';

            if (selectedAnswer) {
              // After answering
              if (isCorrectAnswer) {
                buttonClass += 'bg-[rgba(25,50,50,0.12)] border-[var(--sonus-palette-green)] text-[var(--sonus-palette-green)]';
              } else if (isSelected) {
                buttonClass += 'bg-[rgba(194,65,12,0.12)] border-[var(--sonus-palette-rust)] text-[var(--sonus-palette-rust)]';
              } else {
                buttonClass += 'bg-white border-border text-text-med';
              }
            } else {
              // Before answering
              buttonClass += 'border-border hover:border-[#7FA9C0] hover:bg-[#E6EDF3] hover:text-text-dark cursor-pointer';
            }

            return (
              <button
                key={`${choice}-${idx}`}
                type="button"
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
      <div className="fixed left-0 right-0 z-40 px-5 pb-2 border-t border-border pt-2 bg-bg-warm/95 backdrop-blur-sm bottom-[calc(var(--sonus-bottom-nav-height,5rem)+env(safe-area-inset-bottom,0px))]">
        <div className={`grid gap-2 ${showNeedReviewAction ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {showNeedReviewAction ? (
            <button
              type="button"
              onClick={() => onNeedReview?.()}
              className="w-full flex items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-3 sm:py-3.5 bg-white border border-[var(--sonus-palette-rust)] text-[var(--sonus-palette-rust)] rounded-2xl text-[15px] sm:text-base font-semibold tracking-wide transition-all hover:bg-[rgba(194,65,12,0.08)]"
            >
              Need Review
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleNext}
            className="w-full flex items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-3 sm:py-3.5 bg-[var(--sonus-palette-charcoal)] text-white rounded-2xl text-[15px] sm:text-base font-semibold tracking-wide transition-all hover:bg-[var(--sonus-palette-charcoal)] hover:-translate-y-0.5 hover:shadow-lg"
          >
            Next
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
