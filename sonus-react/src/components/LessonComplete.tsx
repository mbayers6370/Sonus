import { useApp } from '../contexts/AppContext';
import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';
import { SPEAK_PASS_PERCENT } from '../lib/passCriteria';
import { useLocation } from 'react-router-dom';
import { getWordReading } from '../lib/languageFields';

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
    <div className="w-6 h-6 text-[var(--sonus-palette-green)] font-semibold text-[13px] leading-none flex items-center justify-center" aria-hidden="true">
      Aa
    </div>
  );
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
  const hideLogoOnMobile = true;
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
  const normalizeScriptText = (value: string) => (value || '').replace(/[^\u3400-\u9FFF]/g, '');
  const getDimensions = (index: number) => {
    const breakdown = speakBreakdownByIndex[index];
    if (!breakdown) return [];
    if (breakdown.dimensions?.length) return breakdown.dimensions;
    const fallback = [
      { key: 'onset', label: 'Onset', pass: breakdown.onset?.pass ?? breakdown.initial?.pass },
      { key: 'rime', label: 'Rime', pass: breakdown.rime?.pass ?? breakdown.final?.pass },
      { key: 'prosody', label: 'Prosody', pass: breakdown.prosody?.pass ?? breakdown.tone?.pass },
    ].filter((dimension) => typeof dimension.pass === 'boolean') as Array<{
      key: string;
      label: string;
      pass: boolean;
    }>;
    return fallback;
  };

  const getSpeakSuggestions = (index: number) => {
    const breakdown = speakBreakdownByIndex[index];
    const word = activeLesson.words[index];
    const dimensions = getDimensions(index);
    if (!breakdown || (dimensions.length > 0 && dimensions.every((dimension) => dimension.pass))) return [];
    if (breakdown.source === 'no-speech') {
      return ['Try again slowly and clearly.'];
    }
    const reliability = breakdown.feedbackReliability || 'high';
    const reason = breakdown.feedbackReason || 'strong_alignment';
    if (reliability === 'low') {
      if (reason === 'partial_capture') {
        return ['Only part of the word was captured. Say the full word again slowly in one pass.'];
      }
      if (reason === 'short_utterance_ambiguous') {
        return ['Short capture was ambiguous. Repeat once clearly and hold the vowel a bit longer.'];
      }
      if (reason === 'low_confidence_capture') {
        return ['Capture confidence was low. Repeat once with a steady voice and less background noise.'];
      }
      return ['Capture was unclear. Try the full word again slowly and clearly.'];
    }

    const mediumReliability = reliability === 'medium';
    const suggestions: string[] = [];
    const dimensionMap = new Map(
      dimensions.map((dimension) => [dimension.key, dimension.pass])
    );
    const wordPass = dimensionMap.get('word');
    if (wordPass === false) {
      suggestions.push('Pronunciation did not match this word. Repeat once slowly and clearly.');
    }
    const firstFailedDimension = dimensions.find((dimension) => !dimension.pass);
    if (!suggestions.length && firstFailedDimension) {
      suggestions.push(`${firstFailedDimension.label} needs refinement. Listen once, then repeat with steady pacing.`);
    }
    if (!suggestions.length) {
      suggestions.push(`Repeat "${getWordReading(word) || word.simp}" once with clear pacing.`);
    }
    if (mediumReliability) {
      return suggestions.slice(0, 2);
    }
    return suggestions;
  };

  const speakingRows = activeLesson.words.map((word, index) => {
    const breakdown = speakBreakdownByIndex[index];
    const hasSpeakResult = Object.prototype.hasOwnProperty.call(speakResultsByIndex, index);
    const isSpeakCorrect = Boolean(speakResultsByIndex[index]);
    const missing = !hasSpeakResult;
    const heardScript = normalizeScriptText(breakdown?.heardText || '');
    const targetScript = normalizeScriptText(word.simp || '');
    const homophoneScripts = new Set<string>(
      (word.homophoneGroup?.members || [])
        .map((member) => normalizeScriptText(member.simp || ''))
        .filter(Boolean)
    );
    homophoneScripts.add(targetScript);
    const acceptedHomophone =
      Boolean(heardScript) &&
      Boolean(targetScript) &&
      heardScript !== targetScript &&
      homophoneScripts.has(heardScript);
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
        <div className={`w-full ${isSpeakCompletion ? 'max-w-4xl' : 'max-w-md lg:max-w-6xl'}`}>
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
          <p className="mb-5 text-center text-[var(--sonus-palette-rust)] max-w-2xl mx-auto">
            Score below {SPEAK_FULL_RETRY_PERCENT}%: return to Learn, then retake Quiz and Speak.
          </p>
        )}

        {isSpeakCompletion && (
          <div className={`${surfaceCardClass} p-3 mb-4 w-full lg:mb-3`}>
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
                        {word.simp} <span className="text-text-med font-normal">({getWordReading(word)})</span>
                      </div>
                      {!missing && (
                        <span
                          className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider ${
                            isSpeakCorrect
                              ? 'bg-[rgba(25,50,50,0.14)] text-[var(--sonus-palette-green)]'
                              : 'bg-[rgba(194,65,12,0.14)] text-[var(--sonus-palette-rust)]'
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
                          {breakdown.detectedTransliteration ? (
                            <>
                              {' · '}Detected: <span className="text-text-dark">{breakdown.detectedTransliteration}</span>
                            </>
                          ) : null}
                        </div>
                        {breakdown.source === 'no-speech' ? (
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-mono uppercase tracking-wider">
                            <span className="px-2 py-1 rounded bg-[rgba(194,65,12,0.14)] text-[var(--sonus-palette-rust)]">
                              Try Again
                            </span>
                          </div>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-mono uppercase tracking-wider">
                            {getDimensions(index).map((dimension) => (
                                  <span
                                    key={dimension.key}
                                    className={`px-2 py-1 rounded ${dimension.pass ? 'bg-[rgba(25,50,50,0.14)] text-[var(--sonus-palette-green)]' : 'bg-[rgba(194,65,12,0.14)] text-[var(--sonus-palette-rust)]'}`}
                                  >
                                    {dimension.label} {dimension.pass ? 'OK' : 'Fix'}
                                  </span>
                                ))}
                          </div>
                        )}
                        {suggestions.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {suggestions.map((suggestion) => (
                              <div key={suggestion} className="text-xs text-[var(--sonus-palette-rust)]">
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
                <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--sonus-palette-green)] mb-1.5">Accepted Homophone Matches</div>
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
        <div className={`${surfaceCardClass} p-6 mb-5 w-full ${isSpeakCompletion ? 'max-w-xl mx-auto lg:mb-4' : ''}`}>
          <div className="space-y-6">
            {/* Lesson summary */}
            <div className={`flex ${centerWordsPracticedCard ? 'flex-col items-center justify-center text-center gap-2' : 'items-center gap-3'}`}>
              <div className="w-12 h-12 rounded-full bg-[rgba(25,50,50,0.16)] flex items-center justify-center">
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
        <div className={`flex flex-col gap-3 w-full ${isSpeakCompletion ? 'max-w-4xl' : 'max-w-md lg:max-w-6xl'}`}>
          {isQuizCompletion && !quizReadyForSpeak && (
            <>
              {quizMissedTotalCount > 0 && (
                <button
                  onClick={onReviewMissed}
                  className="w-full py-4 px-6 bg-white text-[var(--sonus-palette-charcoal)] border-2 border-[#94A3B8] rounded-xl font-medium transition-all hover:bg-[#EEF2F6] active:bg-[#E2E8F0]"
                >
                  Review Missed Words
                </button>
              )}
              <button
                onClick={onStartQuiz}
                className="w-full py-4 px-6 bg-[var(--sonus-palette-charcoal)] text-white rounded-xl border sonus-drenched-border-charcoal font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                Retake Quiz
              </button>
              <button
                onClick={onStartSpeak}
                className="self-center text-sm font-medium text-[var(--sonus-palette-charcoal)] underline underline-offset-4 hover:text-[#0F172A]"
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
                  className="w-full py-4 px-6 bg-white text-[var(--sonus-palette-charcoal)] border-2 border-[#94A3B8] rounded-xl font-medium transition-all hover:bg-[#EEF2F6] active:bg-[#E2E8F0]"
                >
                  Review Missed Words
                </button>
              )}
              <button
                onClick={onStartSpeak}
                className="w-full py-4 px-6 bg-[var(--sonus-palette-charcoal)] text-white rounded-xl border sonus-drenched-border-charcoal font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                Continue to Speak
              </button>
            </>
          )}
          {!isQuizCompletion && !isSpeakCompletion && !isApplyCompletion && (
            <>
              <button
                onClick={onStartQuiz}
                className="w-full py-4 px-6 bg-[var(--sonus-palette-charcoal)] text-white rounded-xl border sonus-drenched-border-charcoal font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                Start Quiz
              </button>
              <button
                onClick={onStartSpeak}
                className="w-full py-4 px-6 bg-white text-[var(--sonus-palette-charcoal)] border-2 border-[#94A3B8] rounded-xl font-medium transition-all hover:bg-[#EEF2F6] active:bg-[#E2E8F0]"
              >
                Start Speak
              </button>
              <button
                onClick={onRestart}
                className="self-center text-sm font-medium text-[var(--sonus-palette-charcoal)] underline underline-offset-4 hover:text-[#0F172A]"
              >
                Review Flashcards Again
              </button>
            </>
          )}
          {isApplyCompletion && (
            <>
              <button
                onClick={onContinue}
                className="w-full py-4 px-6 bg-[var(--sonus-palette-green)] text-white rounded-xl border sonus-drenched-border-green font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                Continue Learning
              </button>
              <button
                onClick={onRestart}
                className="self-center text-sm font-medium text-[var(--sonus-palette-charcoal)] underline underline-offset-4 hover:text-[#0F172A]"
              >
                {applyCompletionVariant === 'characters' ? 'Review Characters Again' : 'Review Sentences Again'}
              </button>
            </>
          )}
          {isSpeakCompletion && !speakNeedsFullLessonRetry && !speakPassed && (
            <button
              onClick={onStartSpeak}
              className="w-full py-4 px-6 bg-[var(--sonus-palette-charcoal)] text-white rounded-xl border sonus-drenched-border-charcoal font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              Retake Speaking
            </button>
          )}
          {isSpeakCompletion && speakNeedsFullLessonRetry && (
            <button
              onClick={onRestart}
              className="w-full py-4 px-6 bg-[var(--sonus-palette-rust)] text-white rounded-xl font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              Return to Full Lesson Flow
            </button>
          )}
          {isSpeakCompletion && !speakNeedsFullLessonRetry && (
            <button
              onClick={onContinue}
              className="w-full py-4 px-6 bg-[var(--sonus-palette-green)] text-white rounded-xl border sonus-drenched-border-green font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
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
