import { useApp } from '../contexts/AppContext';
import { BookOpen, ChevronLeft } from 'lucide-react';
import BottomNav from './BottomNav';

interface LessonCompleteProps {
  onBack: () => void;
  onStartQuiz: () => void;
  onStartSpeak: () => void;
  onContinue: () => void;
  onRestart: () => void;
  onGoHome: () => void;
  onOpenProfile: () => void;
}

export default function LessonComplete({
  onBack,
  onStartQuiz,
  onStartSpeak,
  onContinue,
  onRestart,
  onGoHome,
  onOpenProfile,
}: LessonCompleteProps) {
  const { state } = useApp();
  const { activeLesson, lessonMode, quizResultsByIndex, speakBreakdownByIndex } = state;

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
  const quizPassed = quizScorePercent >= 80;
  const isSpeakCompletion = lessonMode === 'speak';

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
    <div className="flex flex-col h-[100dvh] page-shell pt-14">
      <div className="relative px-6">
        <button
          onClick={onBack}
          className="absolute left-6 -top-1 inline-flex items-center gap-1.5 p-2 -ml-2 text-text-dark hover:opacity-70 transition-opacity"
        >
          <ChevronLeft className="w-4.5 h-4.5" />
          <span className="text-sm">Back</span>
        </button>
        <div className="h-8" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-start px-6 pt-2 pb-4 overflow-y-auto">
        {/* Brand image */}
        <div className="mb-4">
          <img
            src="/branding/bird.png"
            alt="Sonus bird"
            className="w-20 h-20 md:w-24 md:h-24 object-contain drop-shadow-xl"
          />
        </div>

        <h1 className="font-playfair text-4xl font-normal text-text-dark mb-1 text-center">
          {isQuizCompletion && !quizPassed ? 'Please Try Again' : 'Lesson Complete!'}
        </h1>
        <p className="text-lg text-text-med mb-5 text-center">
          {isQuizCompletion
            ? `Quiz score: ${quizScorePercent}% (${quizCorrectCount}/${totalQuizItems})`
            : 'Amazing work!'}
        </p>

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
                          <span className={`px-2 py-1 rounded ${breakdown.initial.pass ? 'bg-[rgba(77,124,15,0.14)] text-[#4D7C0F]' : 'bg-[rgba(194,65,12,0.14)] text-[#C2410C]'}`}>
                            Initial {breakdown.initial.pass ? 'OK' : 'Fix'}
                          </span>
                          <span className={`px-2 py-1 rounded ${breakdown.final.pass ? 'bg-[rgba(77,124,15,0.14)] text-[#4D7C0F]' : 'bg-[rgba(194,65,12,0.14)] text-[#C2410C]'}`}>
                            Final {breakdown.final.pass ? 'OK' : 'Fix'}
                          </span>
                          <span className={`px-2 py-1 rounded ${breakdown.tone.pass ? 'bg-[rgba(77,124,15,0.14)] text-[#4D7C0F]' : 'bg-[rgba(194,65,12,0.14)] text-[#C2410C]'}`}>
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
              <div className="w-12 h-12 rounded-full bg-[rgba(77,124,15,0.16)] flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-[#4D7C0F]" />
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
          {!isSpeakCompletion && (
            <button
              onClick={isQuizCompletion ? (quizPassed ? onStartSpeak : onStartQuiz) : onStartQuiz}
              className="w-full py-4 px-6 bg-[#1E3A8A] text-white rounded-xl font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              {isQuizCompletion ? (quizPassed ? 'Practice Speaking' : 'Retake Quiz') : 'Start Quiz'}
            </button>
          )}
          <button
            onClick={onContinue}
            className="w-full py-4 px-6 bg-[#4D7C0F] text-white rounded-xl font-bold text-lg transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
          >
            Continue Learning
          </button>
          <button
            onClick={onRestart}
            className="w-full py-4 px-6 bg-white text-[#374151] border-2 border-[rgba(55,65,81,0.30)] rounded-xl font-medium transition-all hover:bg-[rgba(55,65,81,0.08)] active:bg-[rgba(55,65,81,0.12)]"
          >
            Practice Again
          </button>
        </div>
      </div>

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
