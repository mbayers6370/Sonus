import { useApp } from '../contexts/AppContext';
import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';
import { SPEAK_PASS_PERCENT } from '../lib/passCriteria';
import { useLocation } from 'react-router-dom';

interface LessonCompleteProps {
  onStartQuiz: () => void;
  onStartSpeak: () => void;
  onContinue: () => void;
  onRestart: () => void;
  onReviewMissed: () => void;
  onGoHome: () => void;
  onOpenProfile: () => void;
}

function WordsIcon() {
  return (
    <div className="w-6 h-6 text-[#3E5648] font-semibold text-[13px] leading-none flex items-center justify-center" aria-hidden="true">
      Aa
    </div>
  );
}

const TONE_CHAR_TO_VALUE: Record<string, number> = {
  ā: 1, ē: 1, ī: 1, ō: 1, ū: 1, ǖ: 1,
  á: 2, é: 2, í: 2, ó: 2, ú: 2, ǘ: 2,
  ǎ: 3, ě: 3, ǐ: 3, ǒ: 3, ǔ: 3, ǚ: 3,
  à: 4, è: 4, ì: 4, ò: 4, ù: 4, ǜ: 4,
};

function extractToneValues(pinyin: string): number[] {
  const values = new Set<number>();
  const lower = (pinyin || '').toLowerCase();
  for (const ch of lower) {
    const fromDiacritic = TONE_CHAR_TO_VALUE[ch];
    if (fromDiacritic) values.add(fromDiacritic);
    if (/[1-4]/.test(ch)) values.add(Number(ch));
  }
  return Array.from(values).sort((a, b) => a - b);
}

function toneCoachingForPinyin(pinyin: string) {
  const tones = extractToneValues(pinyin);
  if (!tones.length) return `Tone: listen and copy the tone pattern in "${pinyin}" carefully.`;
  const parts = tones.map((tone) => {
    if (tone === 1) return 'Tone 1: keep it high and level.';
    if (tone === 2) return 'Tone 2: rise clearly from mid to high.';
    if (tone === 3) return 'Tone 3: dip low, then rise.';
    return 'Tone 4: start high and drop sharply.';
  });
  return `Tone: ${parts.join(' ')}`;
}

export default function LessonComplete({
  onStartQuiz,
  onStartSpeak,
  onContinue,
  onRestart,
  onReviewMissed,
  onGoHome,
  onOpenProfile,
}: LessonCompleteProps) {
  const location = useLocation();
  const { state } = useApp();
  const { activeLesson, lessonMode, quizResultsByIndex, speakResultsByIndex, speakBreakdownByIndex, activeBandId } = state;

  if (!activeLesson) return null;

  const isQuizCompletion = lessonMode === 'quiz';
  const isApplyCompletion = lessonMode === 'apply';
  const hideLogoOnMobile = /^band\d+$/i.test(activeBandId || '') || activeBandId === 'advanced' || isApplyCompletion;
  const applyVariantKey = location.pathname.replace(/\/(intro|quiz|speak|apply|review|complete)$/, '/apply');
  const applyCompletionVariant = (() => {
    if (!isApplyCompletion) return 'context';
    try {
      return window.sessionStorage.getItem(`sonus.apply.complete:${applyVariantKey}`) === 'characters'
        ? 'characters'
        : 'context';
    } catch {
      return 'context';
    }
  })();
  const coreIndexes = activeLesson.words
    .map((word, index) => ({ word, index }))
    .filter(({ word }) => !word.isReview)
    .map(({ index }) => index);
  const totalCoreItems = coreIndexes.length;
  const totalQuizItems = activeLesson.words.length;
  const quizCorrectCoreCount = coreIndexes.filter((index) => Boolean(quizResultsByIndex[index])).length;
  const quizCorrectCount = activeLesson.words.filter((_, index) => Boolean(quizResultsByIndex[index])).length;
  const quizScorePercentCore =
    totalCoreItems > 0 ? Math.round((quizCorrectCoreCount / totalCoreItems) * 100) : 0;
  const quizScorePercent = totalQuizItems > 0 ? Math.round((quizCorrectCount / totalQuizItems) * 100) : 0;
  const quizReviewThresholdPercent = 90;
  const quizReadyForSpeak = quizScorePercentCore >= quizReviewThresholdPercent;
  const quizMissedTotalCount = Math.max(0, totalQuizItems - quizCorrectCount);
  const isSpeakCompletion = lessonMode === 'speak';
  const isLearnCompletion = !isQuizCompletion && !isSpeakCompletion && !isApplyCompletion;
  const centerWordsPracticedCard = isQuizCompletion || isLearnCompletion;
  const isJapaneseSpeak = /^n[1-5]$/i.test(activeBandId || '');
  const speakCorrectCoreCount = coreIndexes.filter((index) => Boolean(speakResultsByIndex[index])).length;
  const speakCorrectCount = activeLesson.words.filter((_, index) => Boolean(speakResultsByIndex[index])).length;
  const speakScorePercentCore =
    totalCoreItems > 0 ? Math.round((speakCorrectCoreCount / totalCoreItems) * 100) : 0;
  const speakScorePercent = totalQuizItems > 0 ? Math.round((speakCorrectCount / totalQuizItems) * 100) : 0;
  const speakPassed = speakScorePercentCore >= SPEAK_PASS_PERCENT;
  const SPEAK_FULL_RETRY_PERCENT = 60;
  const speakNeedsFullLessonRetry = speakScorePercentCore < SPEAK_FULL_RETRY_PERCENT;
  const characterCount = Array.from(
    new Set(
      activeLesson.words.flatMap((word) => Array.from(word.simp || '')).filter((char) => /[\u3400-\u9FFF]/.test(char))
    )
  ).length;
  const normalizeHanzi = (value: string) => (value || '').replace(/[^\u3400-\u9FFF]/g, '');

  const getSpeakSuggestions = (index: number) => {
    const breakdown = speakBreakdownByIndex[index];
    const word = activeLesson.words[index];
    if (!breakdown || (breakdown.initial.pass && breakdown.final.pass && breakdown.tone.pass)) return [];
    if (breakdown.source === 'no-speech') {
      return ['Try again slowly and clearly.'];
    }
    const suggestions: string[] = [];
    if (!breakdown.initial.pass) {
      suggestions.push(`Initial: isolate the starting consonant in "${word.pinyin}" and repeat slowly.`);
    }
    if (!breakdown.final.pass) {
      suggestions.push(`Final: hold the ending vowel in "${word.pinyin}" for a clean finish.`);
    }
    if (!breakdown.tone.pass) {
      suggestions.push(toneCoachingForPinyin(word.pinyin || ''));
    }
    return suggestions;
  };

  const speakingRows = activeLesson.words.map((word, index) => {
    const breakdown = speakBreakdownByIndex[index];
    const hasSpeakResult = Object.prototype.hasOwnProperty.call(speakResultsByIndex, index);
    const isSpeakCorrect = Boolean(speakResultsByIndex[index]);
    const missing = !hasSpeakResult;
    const heardHanzi = normalizeHanzi(breakdown?.heardText || '');
    const targetHanzi = normalizeHanzi(word.simp || '');
    const homophoneChars = new Set<string>(
      (word.homophoneGroup?.members || [])
        .map((member) => normalizeHanzi(member.simp || ''))
        .filter(Boolean)
    );
    homophoneChars.add(targetHanzi);
    const acceptedHomophone =
      Boolean(heardHanzi) &&
      Boolean(targetHanzi) &&
      heardHanzi !== targetHanzi &&
      homophoneChars.has(heardHanzi);
    return {
      word,
      index,
      breakdown,
      hasSpeakResult,
      isSpeakCorrect,
      missing,
      acceptedHomophone,
      suggestions: getSpeakSuggestions(index),
    };
  });
  const speakingIssueRows = speakingRows.filter((row) => row.missing || !row.isSpeakCorrect);
  const acceptedHomophoneRows = speakingRows.filter((row) => row.isSpeakCorrect && row.acceptedHomophone);
  const surfaceCardClass = 'bg-white border border-border rounded-2xl shadow-[0_12px_28px_-22px_rgba(15,23,42,0.38)]';

  return (
    <div className="flex flex-col h-[100svh] min-h-[100svh] overflow-hidden page-shell">
      <div className="px-6">
        <GlassHeader
          title={
            isQuizCompletion
              ? (quizReadyForSpeak ? 'Quiz Complete' : 'Quiz Review')
              : isApplyCompletion
                ? 'Apply Complete'
              : isLearnCompletion
                ? 'Learn Complete'
                : isSpeakCompletion
                  ? (speakPassed ? 'Lesson Complete' : 'Speaking Review')
                  : 'Lesson Complete'
          }
          hideLogoOnMobile={hideLogoOnMobile}
        />
      </div>

      <div
        className={`flex-1 flex flex-col items-center justify-start px-6 pt-2 overflow-y-auto ${
          isSpeakCompletion ? 'pb-[18rem] sm:pb-[14rem] lg:pb-8' : 'pb-[12.5rem] sm:pb-10 lg:pb-8'
        }`}
      >
        <div className={`w-full max-w-md lg:max-w-6xl ${isSpeakCompletion ? 'lg:grid lg:grid-cols-12 lg:gap-4 lg:items-start' : ''}`}>
        {isQuizCompletion && !quizReadyForSpeak ? (
          <div className="mb-5 text-center">
            <p className="text-lg text-text-med"><b>Close!</b></p>
            <p className="text-lg text-text-med">
              {`${quizMissedTotalCount} ${quizMissedTotalCount === 1 ? 'word needs' : 'words need'} refinement.`}
            </p>
          </div>
        ) : !isSpeakCompletion ? (
          <p className="text-lg text-text-med mb-5 text-center">
            {isQuizCompletion
                ? `Quiz score: ${quizScorePercent}% (${quizCorrectCount}/${totalQuizItems}) · Core: ${quizScorePercentCore}%`
                : isApplyCompletion
                  ? applyCompletionVariant === 'characters'
                    ? `${characterCount} character cards completed.`
                    : `${totalCoreItems} sentence prompts completed.`
                : `${totalCoreItems} words introduced.`}
          </p>
        ) : null}
        {isSpeakCompletion && speakNeedsFullLessonRetry && (
          <p className="mb-5 text-center text-[#C2410C]">
            Score below {SPEAK_FULL_RETRY_PERCENT}%: return to Learn, then retake Quiz and Speak.
          </p>
        )}

        {isSpeakCompletion && (
          <div className={`${surfaceCardClass} p-3 mb-4 w-full lg:col-span-7 lg:mb-3`}>
            <div className="text-sm font-semibold text-text-dark mb-3">Speaking Breakdown</div>
            <div className="text-sm text-text-med mb-3">
              {`Speak score: ${speakScorePercent}% (${speakCorrectCount}/${totalQuizItems}) · Core: ${speakScorePercentCore}%`}
            </div>
            <div className="space-y-2.5 max-h-44 lg:max-h-[30svh] overflow-y-auto pr-1">
              {speakingIssueRows.length === 0 ? (
                <div className="rounded-xl border border-border p-3 text-xs text-text-med">
                  No speaking issues in this lesson.
                </div>
              ) : speakingIssueRows.map(({ word, index, breakdown, missing, isSpeakCorrect, suggestions }) => {
                return (
                  <div key={`${word.id}-${index}`} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-text-dark font-semibold">
                        {word.simp} <span className="text-text-med font-normal">({word.pinyin})</span>
                      </div>
                      {!missing && (
                        <span
                          className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider ${
                            isSpeakCorrect
                              ? 'bg-[rgba(62,86,72,0.14)] text-[#3E5648]'
                              : 'bg-[rgba(194,65,12,0.14)] text-[#C2410C]'
                          }`}
                        >
                          {isSpeakCorrect ? 'Correct' : 'Needs work'}
                        </span>
                      )}
                    </div>
                    {missing ? (
                      <div className="text-xs text-text-light mt-1">No speaking submission captured.</div>
                    ) : isJapaneseSpeak ? (
                      <div className="text-xs text-text-med mt-1">
                        Heard: <span className="text-text-dark">{breakdown?.heardText || '...'}</span>
                      </div>
                    ) : (
                      <>
                        <div className="text-xs text-text-med mt-1">
                          Heard: <span className="text-text-dark">{breakdown.heardText || '...'}</span>
                          {breakdown.detectedPinyin ? (
                            <>
                              {' · '}Detected: <span className="text-text-dark">{breakdown.detectedPinyin}</span>
                            </>
                          ) : null}
                        </div>
                        {breakdown.source === 'no-speech' ? (
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-mono uppercase tracking-wider">
                            <span className="px-2 py-1 rounded bg-[rgba(194,65,12,0.14)] text-[#C2410C]">
                              Try Again
                            </span>
                          </div>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-mono uppercase tracking-wider">
                            {(breakdown.dimensions?.length
                              ? breakdown.dimensions
                              : [
                                  { key: 'initial', label: 'Initial', pass: breakdown.initial.pass },
                                  { key: 'final', label: 'Final', pass: breakdown.final.pass },
                                  { key: 'tone', label: 'Tone', pass: breakdown.tone.pass },
                                ]).map((dimension) => (
                                  <span
                                    key={dimension.key}
                                    className={`px-2 py-1 rounded ${dimension.pass ? 'bg-[rgba(62,86,72,0.14)] text-[#3E5648]' : 'bg-[rgba(194,65,12,0.14)] text-[#C2410C]'}`}
                                  >
                                    {dimension.label} {dimension.pass ? 'OK' : 'Fix'}
                                  </span>
                                ))}
                          </div>
                        )}
                        {suggestions.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {suggestions.map((suggestion) => (
                              <div key={suggestion} className="text-xs text-[#C2410C]">
                                {suggestion}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            {acceptedHomophoneRows.length > 0 && (
              <div className="mt-3 rounded-xl border border-border p-3 bg-[#F3F7F5]">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#3E5648] mb-1.5">Accepted Homophone Matches</div>
                <div className="space-y-1">
                  {acceptedHomophoneRows.map(({ word, index, breakdown }) => (
                    <div key={`homophone-${word.id}-${index}`} className="text-xs text-text-med">
                      <span className="text-text-dark font-semibold">{breakdown?.heardText || '...'}</span>
                      {' matched '}
                      <span className="text-text-dark font-semibold">{word.simp}</span>
                      {' by pronunciation.'}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stats Card */}
        <div className={`${surfaceCardClass} p-6 mb-5 w-full ${isSpeakCompletion ? 'lg:col-span-5 lg:mb-4' : ''}`}>
          <div className="space-y-6">
            {/* Lesson summary */}
            <div className={`flex ${centerWordsPracticedCard ? 'flex-col items-center justify-center text-center gap-2' : 'items-center gap-3'}`}>
              <div className="w-12 h-12 rounded-full bg-[rgba(62,86,72,0.16)] flex items-center justify-center">
                <WordsIcon />
              </div>
              <div>
                <p className="text-sm text-text-med">
                  {isApplyCompletion && applyCompletionVariant === 'characters' ? 'Characters Practiced' : 'Words Practiced'}
                </p>
                <p className="text-2xl font-bold text-text-dark">
                  {isApplyCompletion && applyCompletionVariant === 'characters' ? characterCount : activeLesson.words.length}
                </p>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 w-full max-w-md lg:max-w-6xl">
          {isQuizCompletion && !quizReadyForSpeak && (
            <>
              {quizMissedTotalCount > 0 && (
                <button
                  onClick={onReviewMissed}
                  className="w-full py-4 px-6 bg-white text-[#1F2A37] border-2 border-[#94A3B8] rounded-xl font-medium transition-all hover:bg-[#EEF2F6] active:bg-[#E2E8F0]"
                >
                  Review Missed Words
                </button>
              )}
              <button
                onClick={onStartQuiz}
                className="w-full py-4 px-6 bg-[#1F2A37] text-white rounded-xl font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                Retake Quiz
              </button>
              <button
                onClick={onStartSpeak}
                className="self-center text-sm font-medium text-[#1F2A37] underline underline-offset-4 hover:text-[#0F172A]"
              >
                Continue to Speak
              </button>
            </>
          )}
          {isQuizCompletion && quizReadyForSpeak && (
            <>
              {quizMissedTotalCount > 0 && (
                <button
                  onClick={onReviewMissed}
                  className="w-full py-4 px-6 bg-white text-[#1F2A37] border-2 border-[#94A3B8] rounded-xl font-medium transition-all hover:bg-[#EEF2F6] active:bg-[#E2E8F0]"
                >
                  Review Missed Words
                </button>
              )}
              <button
                onClick={onStartSpeak}
                className="w-full py-4 px-6 bg-[#1F2A37] text-white rounded-xl font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                Continue to Speak
              </button>
            </>
          )}
          {!isQuizCompletion && !isSpeakCompletion && !isApplyCompletion && (
            <>
              <button
                onClick={onStartQuiz}
                className="w-full py-4 px-6 bg-[#1F2A37] text-white rounded-xl font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                Start Quiz
              </button>
              <button
                onClick={onStartSpeak}
                className="w-full py-4 px-6 bg-white text-[#1F2A37] border-2 border-[#94A3B8] rounded-xl font-medium transition-all hover:bg-[#EEF2F6] active:bg-[#E2E8F0]"
              >
                Start Speak
              </button>
              <button
                onClick={onRestart}
                className="self-center text-sm font-medium text-[#1F2A37] underline underline-offset-4 hover:text-[#0F172A]"
              >
                Review Flashcards Again
              </button>
            </>
          )}
          {isApplyCompletion && (
            <>
              <button
                onClick={onContinue}
                className="w-full py-4 px-6 bg-[#3E5648] text-white rounded-xl font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                Continue Learning
              </button>
              <button
                onClick={onRestart}
                className="self-center text-sm font-medium text-[#1F2A37] underline underline-offset-4 hover:text-[#0F172A]"
              >
                {applyCompletionVariant === 'characters' ? 'Review Characters Again' : 'Review Sentences Again'}
              </button>
            </>
          )}
          {isSpeakCompletion && !speakNeedsFullLessonRetry && !speakPassed && (
            <button
              onClick={onStartSpeak}
              className="w-full py-4 px-6 bg-[#1F2A37] text-white rounded-xl font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              Retake Speaking
            </button>
          )}
          {isSpeakCompletion && speakNeedsFullLessonRetry && (
            <button
              onClick={onRestart}
              className="w-full py-4 px-6 bg-[#C2410C] text-white rounded-xl font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              Return to Full Lesson Flow
            </button>
          )}
          {isSpeakCompletion && !speakNeedsFullLessonRetry && (
            <button
              onClick={onContinue}
              className="w-full py-4 px-6 bg-[#3E5648] text-white rounded-xl font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              Continue Learning
            </button>
          )}
        </div>
        <div className={isSpeakCompletion ? 'h-36 sm:h-24 lg:h-0' : 'h-24 sm:h-0 lg:h-0'} />
      </div>

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
