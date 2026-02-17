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
  const [recallGot, setRecallGot] = useState(0);
  const [recallMissed, setRecallMissed] = useState(0);

  const recallPhraseIndex = recallQueue[recallStep];
  const recallPhrase = typeof recallPhraseIndex === 'number' ? section.phrases[recallPhraseIndex] : undefined;
  const recallMode = getRecallMode(recallStep);
  const recallDone = recallStep >= recallQueue.length;

  const resetRecallSprint = () => {
    const size = Math.min(10, section.phrases.length);
    setRecallQueue(buildRecallQueue(section.phrases.length, size));
    setRecallStep(0);
    setRevealRecall(false);
    setRecallGot(0);
    setRecallMissed(0);
  };

  const scoreRecallPrompt = (gotIt: boolean) => {
    if (gotIt) {
      setRecallGot((v) => v + 1);
    } else {
      setRecallMissed((v) => v + 1);
    }
    setRevealRecall(false);
    setRecallStep((v) => v + 1);
  };

  const renderRecallPrompt = () => {
    if (!recallPhrase) return null;
    if (recallMode === 'en_to_zh') {
      return (
        <>
          <div className="text-xs uppercase tracking-wider font-mono text-text-light">English → Speak Chinese</div>
          <div className="text-lg text-text-dark mt-1">{recallPhrase.english}</div>
        </>
      );
    }
    if (recallMode === 'zh_to_speak') {
      return (
        <>
          <div className="text-xs uppercase tracking-wider font-mono text-text-light">Chinese → Speak</div>
          <div className="text-3xl secondary-font text-text-dark mt-2">{recallPhrase.hanzi}</div>
        </>
      );
    }
    return (
      <>
        <div className="text-xs uppercase tracking-wider font-mono text-text-light">Audio Only → Respond</div>
        <button
          onClick={() => speak(recallPhrase.hanzi, recallPhrase.pinyin)}
          className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#186E95] text-white text-sm"
        >
          <Volume2 className="w-4 h-4" />
          Play Audio
        </button>
      </>
    );
  };

  const theme = section.themeColor;
  const soft = hexToRgba(theme, 0.16);
  const lighter = hexToRgba(theme, 0.1);

  return (
    <div
      className="min-h-screen px-6 pb-24"
      style={{
        backgroundColor: hexToRgba(theme, 0.36),
      }}
    >
      <GlassHeader
        title={section.title}
        className="bg-white/16 border-white/28"
        scrolledClassName="bg-white/80 border-white/60"
        titleClassName="text-[#374151]"
        scrolledTitleClassName="text-[#374151]"
      />

      <div>
        <section
          className="rounded-3xl border p-4 sm:p-5 md:p-6 mb-4 shadow-[0_16px_32px_-26px_rgba(15,23,42,0.34)]"
          style={{ borderColor: theme, backgroundColor: theme }}
        >
          <div className="mx-auto max-w-xl px-2 sm:px-3">
            <div className="text-center text-xs secondary-font font-bold uppercase tracking-wider mb-1.5 text-white/86">
              Local Guide
            </div>
            <div className="text-center text-sm font-mono font-bold text-white mb-1.5 leading-tight text-pretty">{section.focus}</div>
            <div className="text-center text-sm text-white/84 mb-2 leading-snug text-pretty">{section.scene}</div>
            <div className="flex flex-wrap gap-1.5 justify-center mb-2.5">
              {section.subclusters.map((item) => (
                <span
                  key={`${section.id}-cluster-${item}`}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider border"
                  style={{ borderColor: 'rgba(255,255,255,0.32)', color: 'white', backgroundColor: 'rgba(255,255,255,0.12)' }}
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="space-y-1.5 text-center text-sm text-white/92 text-pretty">
              {section.culturalNotes.map((note, idx) => (
                <div key={`${section.id}-tip-${idx}`} className="leading-snug">{note}</div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-4 mb-4 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.26)]" style={{ borderColor: soft }}>
          <div className="text-[11px] tracking-wide font-mono text-center mb-2" style={{ color: theme }}>Rapid recall mode</div>
          <div className="rounded-2xl border p-3.5 bg-white" style={{ borderColor: soft }}>
            {!recallDone && recallPhrase ? (
              <div className="text-center">
                <div className="text-xs tracking-wide font-mono text-text-light mb-2">
                  Prompt {Math.min(recallStep + 1, recallQueue.length)} / {Math.max(1, recallQueue.length)}
                </div>
                <div className="mb-2">{renderRecallPrompt()}</div>

                {revealRecall ? (
                  <div className="mt-3 rounded-2xl border p-3" style={{ backgroundColor: lighter, borderColor: soft }}>
                    <div className="text-lg secondary-font text-text-dark">{recallPhrase.hanzi}</div>
                    <div className="text-sm text-text-med">{recallPhrase.pinyin}</div>
                    <div className="text-sm text-text-dark mt-1">{recallPhrase.english}</div>
                  </div>
                ) : null}

                {!revealRecall ? (
                  <div className="mt-3 flex justify-center">
                    <button
                      onClick={() => setRevealRecall(true)}
                      className="px-4 py-2 rounded-2xl border border-border text-sm text-text-dark hover:bg-[rgba(55,65,81,0.05)]"
                    >
                      Reveal answer
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2">
                    <button
                      onClick={() => scoreRecallPrompt(false)}
                      className="w-full sm:w-auto px-4 py-2 rounded-2xl border border-[#C2410C]/35 text-[#C2410C] text-sm font-semibold hover:bg-[rgba(194,65,12,0.08)]"
                    >
                      Missed it
                    </button>
                    <button
                      onClick={() => scoreRecallPrompt(true)}
                      style={{ backgroundColor: theme }}
                      className="w-full sm:w-auto px-4 py-2 rounded-2xl text-white text-sm font-semibold tracking-wide"
                    >
                      Got it
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <div className="text-xs tracking-wide font-mono text-text-light mb-2">Sprint complete</div>
                <div className="text-sm text-text-med mb-2">
                  Mastered <span className="font-semibold text-text-dark">{recallGot}</span> ·
                  Missed <span className="font-semibold text-text-dark">{recallMissed}</span>
                </div>
                <button
                  onClick={resetRecallSprint}
                  style={{ backgroundColor: theme }}
                  className="px-4 py-2 rounded-2xl text-white text-sm font-semibold tracking-wide"
                >
                  Start another sprint
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-white p-4 md:p-5 mb-4 shadow-[0_14px_34px_-26px_rgba(15,23,42,0.28)]" style={{ borderColor: soft }}>
          <div className="mb-4 text-center">
            <div className="text-[11px] tracking-wide font-mono text-text-light">Essential phrases ({section.phrases.length})</div>
            <div className="text-sm text-text-med mt-1">
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
                    isLearned ? 'bg-[#F6F7F5]' : 'bg-white'
                  }`}
                  style={{ borderColor: soft }}
                >
                  <button
                    type="button"
                    onClick={() => setLearned((prev) => ({ ...prev, [phrase.id]: !prev[phrase.id] }))}
                    className={`absolute top-3 right-3 inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors ${
                      isLearned
                        ? 'border-[#3E5648] bg-[rgba(62,86,72,0.12)] text-[#3E5648]'
                        : 'border-border bg-white text-text-light hover:text-text-med'
                    }`}
                    aria-label={isLearned ? `Unmark ${phrase.english}` : `Mark ${phrase.english} as learned`}
                    title={isLearned ? 'Uncheck to unlock card' : "Check when you've got this down"}
                  >
                    {isLearned ? <SquareCheckBig className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>

                  <div className={isLearned ? 'opacity-55' : ''}>
                    <div className="text-2xl secondary-font text-text-dark">{phrase.hanzi}</div>
                    <div className="text-sm text-text-med">{phrase.pinyin}</div>
                    <div className="text-sm text-text-dark mt-1">{phrase.english}</div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                    <button
                      onClick={() => speak(phrase.hanzi, phrase.pinyin)}
                      disabled={isLearned}
                      style={{ backgroundColor: theme }}
                      className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-white disabled:opacity-40 disabled:cursor-not-allowed"
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

      <BottomNav active="home" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
