import { useState } from 'react';
import { Square, SquareCheckBig, Volume2 } from 'lucide-react';
import BottomNav from './BottomNav';
import { useAudio } from '../hooks/useAudio';
import type { TravelSectionData } from '../data/travelModeData';
import GlassHeader from './GlassHeader';

interface TravelSectionPageProps {
  section: TravelSectionData;
  onGoHome: () => void;
  onOpenProfile: () => void;
}

type RecallMode = 'en_to_zh' | 'zh_to_speak' | 'audio_only';

function shuffleArray<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildRecallQueue(total: number, size: number): number[] {
  return shuffleArray(Array.from({ length: total }, (_, idx) => idx)).slice(0, size);
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = Number.parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getRecallMode(index: number): RecallMode {
  if (index % 3 === 0) return 'en_to_zh';
  if (index % 3 === 1) return 'zh_to_speak';
  return 'audio_only';
}

export default function TravelSectionPage({ section, onGoHome, onOpenProfile }: TravelSectionPageProps) {
  const { speak } = useAudio();
  const [learned, setLearned] = useState<Record<string, boolean>>({});
  const initialRecallSize = Math.min(10, section.phrases.length);
  const [recallQueue, setRecallQueue] = useState<number[]>(() => buildRecallQueue(section.phrases.length, initialRecallSize));
  const [recallStep, setRecallStep] = useState(0);
  const [revealRecall, setRevealRecall] = useState(false);

  const recallPhraseIndex = recallQueue[recallStep];
  const recallPhrase = typeof recallPhraseIndex === 'number' ? section.phrases[recallPhraseIndex] : undefined;
  const recallMode = getRecallMode(recallStep);
  const recallDone = recallStep >= recallQueue.length;

  const resetRecallSprint = () => {
    const size = Math.min(10, section.phrases.length);
    setRecallQueue(buildRecallQueue(section.phrases.length, size));
    setRecallStep(0);
    setRevealRecall(false);
  };

  const goToNextRecallPrompt = () => {
    setRevealRecall(false);
    setRecallStep((v) => Math.min(v + 1, recallQueue.length));
  };

  const goToPreviousRecallPrompt = () => {
    setRevealRecall(false);
    setRecallStep((v) => Math.max(v - 1, 0));
  };

  const renderRecallPrompt = () => {
    if (!recallPhrase) return null;
    if (recallMode === 'en_to_zh') {
      return (
        <>
          <div className="text-xs uppercase tracking-wider font-mono text-white/75">English → Speak Chinese</div>
          <div className="text-lg text-white mt-1">{recallPhrase.english}</div>
        </>
      );
    }
    if (recallMode === 'zh_to_speak') {
      return (
        <>
          <div className="text-xs uppercase tracking-wider font-mono text-white/75">Chinese → Speak</div>
          <div className="text-3xl secondary-font text-white mt-2">{recallPhrase.hanzi}</div>
        </>
      );
    }
    return (
      <>
        <div className="text-xs uppercase tracking-wider font-mono text-white/75">Audio Only → Respond</div>
        <button
          onClick={() => speak(recallPhrase.hanzi, recallPhrase.pinyin)}
          className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/14 border border-white/28 text-white text-sm"
        >
          <Volume2 className="w-4 h-4" />
          Play Audio
        </button>
      </>
    );
  };

  const theme = section.themeColor;

  return (
    <div
      className="min-h-screen px-6 with-bottom-nav"
      style={{
        backgroundColor: hexToRgba(theme, 0.36),
      }}
    >
      <GlassHeader
        title={section.title}
        className="bg-white/14 border-white/28"
        scrolledClassName="bg-white/22 border-white/36"
        titleClassName="text-white"
        scrolledTitleClassName="text-white"
      />

      <div className="min-h-[calc(100vh-10.75rem)]">
        <div className="w-full grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-4 lg:gap-5">
          <div className="space-y-4">
            <section
              className="rounded-3xl border-2 bg-white/95 p-4 sm:p-5 md:p-6 shadow-[0_16px_32px_-26px_rgba(15,23,42,0.34)]"
              style={{ borderColor: theme }}
            >
              <div className="mx-auto max-w-4xl text-center">
                <div className="main-font text-[1.05rem] sm:text-[1.1rem] tracking-wide mb-2" style={{ color: theme }}>
                  Local Guide
                </div>
                <h2 className="text-[1.28rem] sm:text-[1.4rem] font-semibold text-[#1F2A37] leading-snug text-pretty">
                  {section.focus}
                </h2>
                <p className="text-[0.7rem] text-[#374151] mt-2 mb-3.5 leading-relaxed text-pretty">{section.scene}</p>

                <div className="flex flex-wrap gap-1.5 justify-center mb-3">
                  {section.subclusters.map((item) => (
                    <span
                      key={`${section.id}-cluster-${item}`}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider border"
                      style={{ borderColor: hexToRgba(theme, 0.28), color: theme, backgroundColor: hexToRgba(theme, 0.08) }}
                    >
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mx-auto h-px w-full max-w-2xl bg-[#E5E7EB] mb-3.5" />

                <div className="space-y-2 text-[0.8rem] leading-relaxed text-[#374151] text-pretty">
                  {section.culturalNotes.map((note, idx) => (
                    <p key={`${section.id}-tip-${idx}`}>
                      {note}
                    </p>
                  ))}
                </div>
              </div>
            </section>

            <section
              className="rounded-3xl border p-4 shadow-[0_16px_32px_-26px_rgba(15,23,42,0.34)]"
              style={{ borderColor: theme, backgroundColor: theme }}
            >
              <div className="text-[11px] tracking-wide font-mono text-center mb-2 text-white/85">Rapid recall mode</div>
              <div className="rounded-2xl border p-3.5 bg-white/12 backdrop-blur-sm" style={{ borderColor: 'rgba(255,255,255,0.24)' }}>
                {!recallDone && recallPhrase ? (
                  <div className="text-center">
                <div className="text-xs tracking-wide font-mono text-white/75 mb-2">
                  Prompt {Math.min(recallStep + 1, recallQueue.length)} / {Math.max(1, recallQueue.length)}
                </div>
                <div className="mb-2 min-h-[140px] flex items-center justify-center">
                  {revealRecall ? (
                    <div className="text-center">
                      <div className="text-xs uppercase tracking-wider font-mono text-white/75">Revealed answer</div>
                      <div className="text-lg secondary-font text-white mt-1">{recallPhrase.hanzi}</div>
                      <div className="text-sm text-white/80">{recallPhrase.pinyin}</div>
                      <div className="text-sm text-white mt-1">{recallPhrase.english}</div>
                    </div>
                  ) : (
                    renderRecallPrompt()
                  )}
                </div>

                {!revealRecall ? (
                  <div className="mt-3 flex justify-center">
                        <button
                          onClick={() => setRevealRecall(true)}
                          className="px-4 py-2 rounded-2xl border border-white/28 bg-white/12 text-sm text-white hover:bg-white/18"
                    >
                      Reveal answer
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2">
                    <button
                      onClick={goToPreviousRecallPrompt}
                      disabled={recallStep === 0}
                      className="w-full sm:w-auto px-4 py-2 rounded-2xl border border-white/28 bg-white/10 text-white text-sm font-semibold hover:bg-white/18 disabled:cursor-not-allowed disabled:bg-white/8 disabled:text-white/55"
                    >
                      Previous
                    </button>
                    <button
                      onClick={goToNextRecallPrompt}
                      className="w-full sm:w-auto px-4 py-2 rounded-2xl border border-white/28 bg-white/18 text-white text-sm font-semibold tracking-wide hover:bg-white/24"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <div className="text-xs tracking-wide font-mono text-white/75 mb-2">Sprint complete</div>
                <div className="text-sm text-white/85 mb-2">All prompts reviewed.</div>
                <button
                  onClick={resetRecallSprint}
                  className="px-4 py-2 rounded-2xl border border-white/28 bg-white/18 text-white text-sm font-semibold tracking-wide hover:bg-white/24"
                    >
                      Start another sprint
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>

          <section
            className="travel-scroll-hidden rounded-3xl border p-4 md:p-5 shadow-[0_16px_34px_-26px_rgba(15,23,42,0.34)] lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto lg:pb-3 lg:pr-1"
            style={{ borderColor: theme, backgroundColor: theme }}
          >
            <div className="mb-4 text-center">
              <div className="text-[11px] tracking-wide font-mono text-white/75">Essential phrases ({section.phrases.length})</div>
              <div className="text-sm text-white/85 mt-1">
                Use the top-right checkbox when you have it down. Checked cards are dimmed and locked until unchecked.
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {section.phrases.map((phrase) => {
                const isLearned = Boolean(learned[phrase.id]);
                return (
                  <div
                    key={phrase.id}
                    className={`relative rounded-2xl border p-4 text-center md:min-h-[188px] flex flex-col justify-center ${
                      isLearned ? 'bg-white/10' : 'bg-white/14'
                    }`}
                    style={{ borderColor: 'rgba(255,255,255,0.24)' }}
                  >
                    <button
                      type="button"
                      onClick={() => setLearned((prev) => ({ ...prev, [phrase.id]: !prev[phrase.id] }))}
                      className={`absolute top-3 right-3 inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors ${
                        isLearned
                          ? 'border-white/35 bg-white/20 text-white'
                          : 'border-white/25 bg-white/12 text-white/70 hover:text-white'
                      }`}
                      aria-label={isLearned ? `Unmark ${phrase.english}` : `Mark ${phrase.english} as learned`}
                      title={isLearned ? 'Uncheck to unlock card' : "Check when you've got this down"}
                    >
                      {isLearned ? <SquareCheckBig className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>

                    <div className={isLearned ? 'opacity-55' : ''}>
                      <div className="text-2xl secondary-font text-white">{phrase.hanzi}</div>
                      <div className="text-sm text-white/80">{phrase.pinyin}</div>
                      <div className="text-sm text-white mt-1">{phrase.english}</div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                      <button
                        onClick={() => speak(phrase.hanzi, phrase.pinyin)}
                        disabled={isLearned}
                        className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-white/28 bg-white/16 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={`Play ${phrase.english}`}
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <BottomNav active="home" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
