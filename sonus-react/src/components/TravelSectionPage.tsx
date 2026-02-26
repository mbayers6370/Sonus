import { useEffect, useRef, useState } from 'react';
import { Square, SquareCheckBig, Volume2 } from 'lucide-react';
import BottomNav from './BottomNav';
import { useAudio } from '../hooks/useAudio';
import type { TravelSectionData } from '../data/travelModeData';
import GlassHeader from './GlassHeader';
import { normalizeLanguageId } from '../lib/languageRuntime';

interface TravelSectionPageProps {
  section: TravelSectionData;
  onGoHome: () => void;
  onOpenProfile: () => void;
  selectedLanguage?: string | null;
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

function renderNoteText(text: string) {
  const renderWithLineBreaks = (value: string, keyPrefix: string) => {
    const lines = value.split('\n');
    return lines.map((line, lineIdx) => (
      <span key={`${keyPrefix}-line-${lineIdx}`}>
        {line}
        {lineIdx < lines.length - 1 ? <br /> : null}
      </span>
    ));
  };

  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, idx) => {
    if (/^https?:\/\/[^\s]+$/.test(part)) {
      return (
        <a
          key={`url-${idx}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-[#186E95]/45 underline-offset-2 hover:text-[#186E95]"
        >
          {part}
        </a>
      );
    }
    return <span key={`txt-${idx}`}>{renderWithLineBreaks(part, `txt-${idx}`)}</span>;
  });
}

export default function TravelSectionPage({ section, onGoHome, onOpenProfile, selectedLanguage }: TravelSectionPageProps) {
  const { speak } = useAudio();
  const isJapanese = normalizeLanguageId(selectedLanguage) === 'ja';
  const targetLabel = isJapanese ? 'Japanese' : 'Chinese';
  const [learnedBySection, setLearnedBySection] = useState<Record<string, Record<string, boolean>>>(() => {
    try {
      const raw = window.localStorage.getItem('sonus.travel.learned');
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, Record<string, boolean>>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });
  const initialRecallSize = Math.min(10, section.phrases.length);
  const [recallQueue, setRecallQueue] = useState<number[]>(() => buildRecallQueue(section.phrases.length, initialRecallSize));
  const [recallStep, setRecallStep] = useState(0);
  const [revealRecall, setRevealRecall] = useState(false);
  const leftColumnRef = useRef<HTMLDivElement | null>(null);
  const rapidRecallRef = useRef<HTMLElement | null>(null);
  const rightPanelRef = useRef<HTMLElement | null>(null);

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
          <div className="text-xs uppercase tracking-wider font-mono text-white/75">{`English → Speak ${targetLabel}`}</div>
          <div className="text-lg text-white mt-1">{recallPhrase.english}</div>
        </>
      );
    }
    if (recallMode === 'zh_to_speak') {
      return (
        <>
          <div className="text-xs uppercase tracking-wider font-mono text-white/75">{`${targetLabel} → Speak`}</div>
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
  const learned = learnedBySection[section.id] || {};

  useEffect(() => {
    try {
      window.localStorage.setItem('sonus.travel.learned', JSON.stringify(learnedBySection));
    } catch {
      // Ignore storage write errors.
    }
  }, [learnedBySection]);

  useEffect(() => {
    const leftCol = leftColumnRef.current;
    const rapidRecall = rapidRecallRef.current;
    const rightPanel = rightPanelRef.current;
    if (!leftCol || !rapidRecall || !rightPanel) return;

    const syncRightPanelHeight = () => {
      if (window.innerWidth < 1024) {
        rightPanel.style.removeProperty('height');
        rightPanel.style.removeProperty('max-height');
        return;
      }

      const panelTop = rightPanel.getBoundingClientRect().top;
      const targetBottom = rapidRecall.getBoundingClientRect().bottom;
      const nextHeight = Math.max(320, Math.round(targetBottom - panelTop));
      rightPanel.style.height = `${nextHeight}px`;
      rightPanel.style.maxHeight = `${nextHeight}px`;
    };

    syncRightPanelHeight();

    const observer = new ResizeObserver(syncRightPanelHeight);
    observer.observe(leftCol);
    observer.observe(rapidRecall);
    window.addEventListener('resize', syncRightPanelHeight, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncRightPanelHeight);
    };
  }, [section.id, recallStep, revealRecall, recallDone]);

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

      <div className="min-h-[calc(100vh-10.75rem)] lg:min-h-0">
        <div className="w-full grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-4 lg:gap-5 lg:items-stretch">
          <div ref={leftColumnRef} className="space-y-4 lg:space-y-0 lg:gap-4 lg:flex lg:flex-col lg:h-full">
            <section
              className="rounded-3xl border-2 bg-white/95 p-4 sm:p-5 md:p-6 shadow-[0_16px_32px_-26px_rgba(15,23,42,0.34)]"
              style={{ borderColor: theme }}
            >
              <div className="mx-auto max-w-4xl text-center">
                <div
                  className="rounded-2xl px-4 py-4 sm:px-5 sm:py-5 mb-3.5"
                  style={{ backgroundColor: theme }}
                >
                  <div className="main-font text-[1.05rem] sm:text-[1.1rem] tracking-wide mb-2 text-white">
                    Local Guide
                  </div>
                  <h2 className="text-[1.28rem] sm:text-[1.4rem] secondary-font text-white leading-snug text-pretty">
                    {section.focus}
                  </h2>
                  <p className="text-[0.74rem] text-white/90 mt-2 mb-3.5 leading-relaxed text-pretty">{section.scene}</p>

                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {section.subclusters.map((item) => (
                      <span
                        key={`${section.id}-cluster-${item}`}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider border border-white/40 text-white bg-white/12"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mx-auto max-w-3xl space-y-3 text-left text-[#1F2A37] text-pretty">
                  {section.culturalNotes.map((note, idx) => {
                    const trimmed = note.trim();
                    if (trimmed.startsWith('•')) {
                      return (
                        <p key={`${section.id}-tip-${idx}`} className="pl-5 relative text-[0.98rem] leading-7">
                          <span className="absolute left-0 top-[0.42rem] text-[#3E5648]">•</span>
                          {renderNoteText(trimmed.slice(1).trim())}
                        </p>
                      );
                    }
                    if (trimmed.includes('::')) {
                      const [title, ...rest] = trimmed.split('::');
                      const body = rest.join('::').trim();
                      return (
                        <div key={`${section.id}-tip-${idx}`} className="pt-1">
                          <p className="text-[0.9rem] sm:text-[0.9rem] font-semibold text-[#1F2A37] leading-tight mb-1.5">
                            {title}
                          </p>
                          {body ? (
                            <p className="text-[0.8rem] leading-7">
                              {renderNoteText(body)}
                            </p>
                          ) : null}
                        </div>
                      );
                    }
                    return (
                      <p key={`${section.id}-tip-${idx}`} className="text-[0.8rem] leading-7">
                        {renderNoteText(trimmed)}
                      </p>
                    );
                  })}
                </div>
              </div>
            </section>

            <section
              ref={rapidRecallRef}
              className="rounded-3xl border p-4 shadow-[0_16px_32px_-26px_rgba(15,23,42,0.34)]"
              style={{ borderColor: theme, backgroundColor: theme }}
            >
              <div className="h-full flex flex-col">
              <div className="text-1.0em tracking-wide main-font text-center mb-2 text-white/85">Rapid Recall Mode</div>
              <div className="rounded-2xl border p-3.5 bg-white/12 backdrop-blur-sm flex-1" style={{ borderColor: 'rgba(255,255,255,0.24)' }}>
                {!recallDone && recallPhrase ? (
                  <div className="text-center h-full flex flex-col justify-center">
                <div className="text-xs tracking-wide font-mono text-white/75 mb-2">
                  Prompt {Math.min(recallStep + 1, recallQueue.length)} / {Math.max(1, recallQueue.length)}
                </div>
                <div className="mb-2 min-h-[104px] flex flex-col items-center justify-center text-center">
                  {revealRecall ? (
                    <div className="text-center">
                      <div className="text-xs uppercase tracking-wider font-mono text-white/75">answer</div>
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
              </div>
            </section>
          </div>

          <section
            ref={rightPanelRef}
            className="travel-scroll-hidden rounded-3xl border p-4 sm:p-5 md:p-6 shadow-[0_16px_34px_-26px_rgba(15,23,42,0.34)] lg:overflow-y-auto"
            style={{ borderColor: theme, backgroundColor: theme }}
          >
            <div className="mb-4 text-center">
              <div className="text-1.0em tracking-wide main-font text-white/75">Essential Phrases ({section.phrases.length})</div>
              <div className="text-xs font-mono text-white/85 mt-1">
                Checked cards are dimmed and locked until unchecked.
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {section.phrases.map((phrase) => {
                const isLearned = Boolean(learned[phrase.id]);
                return (
                  <div
                    key={phrase.id}
                    className={`relative rounded-2xl border p-4 sm:p-5 text-center min-h-[220px] md:min-h-[200px] md:aspect-square flex flex-col ${
                      isLearned ? 'bg-white/10' : 'bg-white/14'
                    }`}
                    style={{ borderColor: 'rgba(255,255,255,0.24)' }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setLearnedBySection((prev) => {
                          const current = prev[section.id] || {};
                          const next = { ...current, [phrase.id]: !current[phrase.id] };
                          return { ...prev, [section.id]: next };
                        })
                      }
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

                    <div className={`h-full flex flex-col ${isLearned ? 'opacity-55' : ''}`}>
                      <div className="flex-1 flex flex-col items-center justify-center gap-1.5 pt-5">
                        <div className="secondary-font text-white leading-tight text-[1.2rem] lg:text-[1.2rem] xl:text-2xl">
                          {phrase.hanzi}
                        </div>
                        <div className="max-w-[90%] text-white/40 leading-snug text-[0.7rem] lg:text-[0.7rem] xl:text-sm">
                          {phrase.pinyin}
                        </div>
                        <div className="max-w-[90%] text-white leading-snug text-[0.9rem] lg:text-[0.9rem] xl:text-sm">
                          {phrase.english}
                        </div>
                      </div>

                      <div className="flex items-center justify-center pt-3">
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
