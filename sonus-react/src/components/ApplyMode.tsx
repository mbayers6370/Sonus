import { useMemo } from 'react';
import type { Word } from '../types/lesson.types';
import { useAudio } from '../hooks/useAudio';
import { Volume2, Snail, ChevronLeft, ChevronRight } from 'lucide-react';
import WordProgressRail from './WordProgressRail';

interface ApplyModeProps {
  word: Word;
  allWords: Word[];
  currentIndex: number;
  totalWords: number;
  onPrev: () => void;
  onNext: () => void;
}

function highlightLessonTerms(text: string, focusWord: string, allWords: Word[]) {
  const source = text.trim();
  const focus = focusWord.trim();
  if (!source) return source;

  const lessonTerms = Array.from(
    new Set(
      allWords
        .map((candidate) => candidate.simp?.trim())
        .filter((candidate): candidate is string => Boolean(candidate))
    )
  ).sort((a, b) => b.length - a.length);

  const focusTerms = lessonTerms.filter((candidate) => candidate === focus);
  const otherTerms = lessonTerms.filter((candidate) => candidate !== focus);

  const chunks: Array<{ text: string; className?: string }> = [];
  let index = 0;

  while (index < source.length) {
    const focusMatch = focusTerms.find((candidate) => source.startsWith(candidate, index));
    if (focusMatch) {
      chunks.push({ text: focusMatch, className: 'font-semibold text-[#186E95]' });
      index += focusMatch.length;
      continue;
    }

    const lessonMatch = otherTerms.find((candidate) => source.startsWith(candidate, index));
    if (lessonMatch) {
      chunks.push({ text: lessonMatch, className: 'font-semibold text-[#3E5648]' });
      index += lessonMatch.length;
      continue;
    }

    chunks.push({ text: source[index] });
    index += 1;
  }

  return (
    <>
      {chunks.map((chunk, chunkIndex) =>
        chunk.className ? (
          <span key={`${chunk.text}-${chunkIndex}`} className={chunk.className}>
            {chunk.text}
          </span>
        ) : (
          <span key={`${chunk.text}-${chunkIndex}`}>{chunk.text}</span>
        )
      )}
    </>
  );
}

function highlightEnTerm(text: string, term: string) {
  const source = text.trim();
  const target = term.trim();
  if (!source || !target) return source;
  const idx = source.toLowerCase().indexOf(target.toLowerCase());
  if (idx < 0) return source;
  const end = idx + target.length;
  return (
    <>
      {source.slice(0, idx)}
      <span className="font-semibold text-[#186E95]">{source.slice(idx, end)}</span>
      {source.slice(end)}
    </>
  );
}

export default function ApplyMode({
  word,
  allWords,
  currentIndex,
  totalWords,
  onPrev,
  onNext,
}: ApplyModeProps) {
  const { speak } = useAudio();

  const zh = word.example?.zh?.trim() || word.simp;
  const en = word.example?.en?.trim() || 'Translation unavailable for this prompt.';
  const sentencePinyin = word.example?.pinyin?.trim() || '';
  const highlighted = useMemo(
    () => highlightLessonTerms(zh, word.simp, allWords),
    [zh, word.simp, allWords]
  );
  const highlightedEn = useMemo(
    () => highlightEnTerm(en, word.en),
    [en, word.en]
  );

  const handleNext = () => {
    onNext();
  };

  return (
    <div className="flex flex-col min-h-full">
      <WordProgressRail total={totalWords} currentIndex={currentIndex} />

      <div className="flex-1 flex items-center justify-center px-5 py-2">
        <div className="w-full max-w-2xl bg-white/95 rounded-3xl shadow-[0_18px_38px_-28px_rgba(15,23,42,0.45)] border border-border p-6 text-center">
          <div className="inline-flex mb-2 items-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono bg-[rgba(24,110,149,0.14)] text-[#186E95]">
            Apply In Context
          </div>
          <div className="secondary-font text-4xl text-text-dark leading-tight">
            {highlighted}
          </div>
          {sentencePinyin ? <div className="mt-3 text-base text-text-med">{sentencePinyin}</div> : null}
          <div className="mt-3 text-sm text-text-med">
            Focus word: <span className="font-semibold text-text-dark">{word.simp}</span> ({word.pinyin})
          </div>
          <div className="mt-4 rounded-xl border border-border bg-[rgba(55,65,81,0.06)] px-4 py-3 text-text-dark text-center">
            {highlightedEn}
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-center px-5 pb-4">
        <button
          onClick={() => speak(zh, word.pinyin, false)}
          className="flex items-center gap-2 px-6 py-3 bg-[#186E95] text-white rounded-2xl font-semibold tracking-wide transition-all hover:bg-[#145C7C] hover:-translate-y-0.5 hover:shadow-lg"
        >
          <Volume2 className="w-5 h-5" />
          Listen
        </button>
        <button
          onClick={() => speak(zh, word.pinyin, true)}
          className="flex items-center gap-2 px-6 py-3 bg-white border border-[rgba(55,65,81,0.40)] text-[#374151] rounded-2xl font-semibold tracking-wide transition-all hover:bg-[rgba(55,65,81,0.08)]"
        >
          <Snail className="w-5 h-5" />
          Slow
        </button>
      </div>

      <div className="fixed bottom-20 left-0 right-0 z-40 px-5 pb-2 border-t border-border pt-3 bg-bg-warm/95 backdrop-blur-sm">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onPrev}
            disabled={currentIndex === 0}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-white border border-[rgba(55,65,81,0.35)] text-[#374151] rounded-2xl font-semibold tracking-wide transition-all hover:bg-[rgba(55,65,81,0.08)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>
          <button
            onClick={handleNext}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-[#374151] text-white rounded-2xl font-semibold tracking-wide transition-all hover:bg-[#1F2937] hover:-translate-y-0.5 hover:shadow-lg"
          >
            {currentIndex < totalWords - 1 ? 'Next' : 'Finish'}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
