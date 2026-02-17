import { useApp } from '../contexts/AppContext';
import { BookOpen } from 'lucide-react';
import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';
import { SPEAK_PASS_PERCENT } from '../lib/passCriteria';

interface LessonCompleteProps {
  onStartQuiz: () => void;
  onStartSpeak: () => void;
  onContinue: () => void;
  onRestart: () => void;
  onReviewMissed: () => void;
  onGoHome: () => void;
  onOpenProfile: () => void;
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
  const { state } = useApp();
  const { activeLesson, lessonMode, quizResultsByIndex, speakResultsByIndex, speakBreakdownByIndex } = state;

  if (!activeLesson) return null;

  const isQuizCompletion = lessonMode === 'quiz';
  const coreIndexes = activeLesson.words
    .map((word, index) => ({ word, index }))
    .filter(({ word }) => !word.isReview)
    .map(({ index }) => index);
  const totalQuizItems = coreIndexes.length;
  const quizCorrectCount = coreIndexes.filter((index) => Boolean(quizResultsByIndex[index])).length;
  const quizScorePercent =
    totalQuizItems > 0 ? Math.round((quizCorrectCount / totalQuizItems) * 100) : 0;
  const quizReviewThresholdPercent = 90;
  const quizReadyForSpeak = quizScorePercent >= quizReviewThresholdPercent;
  const quizMissedCount = Math.max(0, totalQuizItems - quizCorrectCount);
  const isSpeakCompletion = lessonMode === 'speak';
  const isLearnCompletion = !isQuizCompletion && !isSpeakCompletion;
  const speakCorrectCount = coreIndexes.filter((index) => Boolean(speakResultsByIndex[index])).length;
  const speakScorePercent = totalQuizItems > 0 ? Math.round((speakCorrectCount / totalQuizItems) * 100) : 0;
  const speakPassed = speakScorePercent >= SPEAK_PASS_PERCENT;

  const getSpeakSuggestions = (index: number) => {
    const breakdown = speakBreakdownByIndex[index];
    const word = activeLesson.words[index];
    if (!breakdown || (breakdown.initial.pass && breakdown.final.pass && breakdown.tone.pass)) return [];
    const suggestions: string[] = [];
    if (!breakdown.initial.pass) {
      suggestions.push(`Initial: isolate the starting consonant in "${word.pinyin}" and repeat slowly.`);
    }
    if (!breakdown.final.pass) {
      suggestions.push(`Final: hold the ending vowel in "${word.pinyin}" for a clean finish.`);
    }
    if (!breakdown.tone.pass) {
      suggestions.push(`Tone: exaggerate the tone contour in "${word.pinyin}" before saying it at normal speed.`);
    }
    return suggestions;
  };

  return (
    <div className="flex flex-col h-[100dvh] page-shell">
      <div className="px-6">
        <GlassHeader
          title={
            isQuizCompletion
              ? (quizReadyForSpeak ? 'Lesson Complete' : 'Lesson Review')
              : isLearnCompletion
                ? 'Learn Complete'
                : isSpeakCompletion
                  ? 'Lesson Review'
                  : 'Lesson Complete'
          }
        />
      </div>

      <div
        className={`flex-1 flex flex-col items-center justify-start px-6 pt-2 overflow-y-auto ${
          isSpeakCompletion ? 'pb-[18rem] sm:pb-[14rem]' : 'pb-[12.5rem] sm:pb-10'
        }`}
      >
        {isQuizCompletion && !quizReadyForSpeak ? (
          <div className="mb-5 text-center">
            <p className="text-lg text-text-med"><b>Close!</b></p>
            <p className="text-lg text-text-med">
              {`${quizMissedCount} ${quizMissedCount === 1 ? 'word needs' : 'words need'} refinement.`}
            </p>
          </div>
        ) : (
          <p className="text-lg text-text-med mb-5 text-center">
            {isSpeakCompletion
              ? `Speak score: ${speakScorePercent}% (${speakCorrectCount}/${totalQuizItems})`
              : isQuizCompletion
                ? `Quiz score: ${quizScorePercent}% (${quizCorrectCount}/${totalQuizItems})`
                : `${totalQuizItems} words introduced.`}
          </p>
        )}

        {isSpeakCompletion && (
          <div className="bg-white border border-border rounded-2xl p-4 mb-5 w-full max-w-md">
            <div className="text-sm font-semibold text-text-dark mb-3">Speaking Breakdown</div>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {activeLesson.words.map((word, index) => {
                const breakdown = speakBreakdownByIndex[index];
                const missing = !breakdown;
                const suggestions = getSpeakSuggestions(index);
                return (
                  <div key={`${word.id}-${index}`} className="rounded-xl border border-border p-3">
                    <div className="text-sm text-text-dark font-semibold">
                      {word.simp} <span className="text-text-med font-normal">({word.pinyin})</span>
                    </div>
                    {missing ? (
                      <div className="text-xs text-text-light mt-1">No speaking submission captured.</div>
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
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-mono uppercase tracking-wider">
                          <span className={`px-2 py-1 rounded ${breakdown.initial.pass ? 'bg-[rgba(62,86,72,0.14)] text-[#3E5648]' : 'bg-[rgba(194,65,12,0.14)] text-[#C2410C]'}`}>
                            Initial {breakdown.initial.pass ? 'OK' : 'Fix'}
                          </span>
                          <span className={`px-2 py-1 rounded ${breakdown.final.pass ? 'bg-[rgba(62,86,72,0.14)] text-[#3E5648]' : 'bg-[rgba(194,65,12,0.14)] text-[#C2410C]'}`}>
                            Final {breakdown.final.pass ? 'OK' : 'Fix'}
                          </span>
                          <span className={`px-2 py-1 rounded ${breakdown.tone.pass ? 'bg-[rgba(62,86,72,0.14)] text-[#3E5648]' : 'bg-[rgba(194,65,12,0.14)] text-[#C2410C]'}`}>
                            Tone {breakdown.tone.pass ? 'OK' : 'Fix'}
                          </span>
                        </div>
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
          </div>
        )}

        {/* Stats Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-5 w-full max-w-md">
          <div className="space-y-6">
            {/* Lesson summary */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[rgba(62,86,72,0.16)] flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-[#3E5648]" />
              </div>
              <div>
                <p className="text-sm text-text-med">Words Practiced</p>
                <p className="text-2xl font-bold text-text-dark">{activeLesson.words.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 w-full max-w-md">
          {isQuizCompletion && !quizReadyForSpeak && (
            <>
              <button
                onClick={onReviewMissed}
                className="w-full py-4 px-6 bg-white text-[#374151] border-2 border-[rgba(55,65,81,0.30)] rounded-xl font-medium transition-all hover:bg-[rgba(55,65,81,0.08)] active:bg-[rgba(55,65,81,0.12)]"
              >
                Review Missed Words
              </button>
              <button
                onClick={onStartQuiz}
                className="w-full py-4 px-6 bg-[#186E95] text-white rounded-xl font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                Retake Quiz
              </button>
              <button
                onClick={onStartSpeak}
                className="self-center text-sm font-medium text-[#186E95] underline underline-offset-4 hover:text-[#145775]"
              >
                Continue to Speak
              </button>
            </>
          )}
          {isQuizCompletion && quizReadyForSpeak && (
            <button
              onClick={onStartSpeak}
              className="w-full py-4 px-6 bg-[#186E95] text-white rounded-xl font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              Continue to Speak
            </button>
          )}
          {!isQuizCompletion && !isSpeakCompletion && (
            <>
              <button
                onClick={onStartQuiz}
                className="w-full py-4 px-6 bg-[#186E95] text-white rounded-xl font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                Start Quiz
              </button>
              <button
                onClick={onStartSpeak}
                className="w-full py-4 px-6 bg-white text-[#374151] border-2 border-[rgba(55,65,81,0.30)] rounded-xl font-medium transition-all hover:bg-[rgba(55,65,81,0.08)] active:bg-[rgba(55,65,81,0.12)]"
              >
                Start Speak
              </button>
              <button
                onClick={onRestart}
                className="self-center text-sm font-medium text-[#186E95] underline underline-offset-4 hover:text-[#145775]"
              >
                Review Flashcards Again
              </button>
            </>
          )}
          {isSpeakCompletion && !speakPassed && (
            <button
              onClick={onStartSpeak}
              className="w-full py-4 px-6 bg-[#186E95] text-white rounded-xl font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              Retake Speaking
            </button>
          )}
          {isSpeakCompletion && (
            <>
              <button
                onClick={onContinue}
                className="w-full py-4 px-6 bg-[#3E5648] text-white rounded-xl font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                Continue Learning
              </button>
              <button
                onClick={onRestart}
                className="self-center text-sm font-medium text-[#186E95] underline underline-offset-4 hover:text-[#145775]"
              >
                Practice Again
              </button>
            </>
          )}
        </div>
        <div className={isSpeakCompletion ? 'h-36 sm:h-24' : 'h-24 sm:h-0'} />
      </div>

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
