import { useEffect, useMemo, useRef, useState } from 'react';
import { Square, SquareCheckBig, Volume2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import BottomNav from './BottomNav';
import { useAudio } from '../hooks/useAudio';
import {
  getPhrasePronunciationText,
  getPhraseScriptText,
  type TravelSectionData,
} from '../data/travelModeData';
import GlassHeader from './GlassHeader';
import { getLanguageRuntime, normalizeLanguageId } from '../lib/languageRuntime';

interface TravelSectionPageProps {
  section: TravelSectionData;
  onGoHome: () => void;
  onOpenProfile: () => void;
  selectedLanguage?: string | null;
}

type RecallMode = 'meaning_to_script' | 'script_to_speak' | 'audio_only';

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

function getRecallMode(index: number): RecallMode {
  if (index % 3 === 0) return 'meaning_to_script';
  if (index % 3 === 1) return 'script_to_speak';
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

function condenseGuideNote(text: string, maxChars = 210) {
  const normalized = text
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized || normalized.length <= maxChars) return normalized;

  const sentenceChunks = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentenceChunks.length > 1) {
    const firstTwo = sentenceChunks.slice(0, 2).join(' ').trim();
    if (firstTwo.length <= maxChars) return `${firstTwo}…`;
  }

  const clipped = normalized.slice(0, maxChars);
  const safeBoundary = clipped.lastIndexOf(' ');
  const compact = (safeBoundary > 120 ? clipped.slice(0, safeBoundary) : clipped).trim();
  return `${compact}…`;
}

type GuideNoteBlock =
  | { kind: 'bullet'; text: string }
  | { kind: 'title'; title: string; bodies: string[] }
  | { kind: 'text'; text: string };

function buildGuideNoteBlocks(notes: string[]) {
  const blocks: GuideNoteBlock[] = [];

  for (const rawNote of notes) {
    const trimmed = rawNote.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('•')) {
      blocks.push({ kind: 'bullet', text: condenseGuideNote(trimmed.slice(1).trim()) });
      continue;
    }

    if (trimmed.includes('::')) {
      const [title, ...rest] = trimmed.split('::');
      const body = condenseGuideNote(rest.join('::').trim(), 230);
      blocks.push({
        kind: 'title',
        title: title.trim(),
        bodies: body ? [body] : [],
      });
      continue;
    }

    const condensed = condenseGuideNote(trimmed);
    const prev = blocks[blocks.length - 1];
    if (prev && prev.kind === 'title') {
      prev.bodies.push(condensed);
      continue;
    }
    blocks.push({ kind: 'text', text: condensed });
  }

  return blocks;
}

export default function TravelSectionPage({ section, onGoHome, onOpenProfile, selectedLanguage }: TravelSectionPageProps) {
  const { speak } = useAudio();
  const normalizedLanguage = normalizeLanguageId(selectedLanguage);
  const languageRuntime = getLanguageRuntime(normalizedLanguage);
  const konbiniLinkTarget = normalizedLanguage === 'ja'
    ? '/travel/konbini'
    : '/essential-japanese-travel-phrases';
  const targetLabel = languageRuntime.label || 'Language';
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
    if (recallMode === 'meaning_to_script') {
      return (
        <>
          <div className="text-xs uppercase tracking-wider font-mono text-white/75">{`English → Speak ${targetLabel}`}</div>
          <div className="text-lg text-white mt-1">{recallPhrase.english}</div>
        </>
      );
    }
    if (recallMode === 'script_to_speak') {
      return (
        <>
          <div className="text-xs uppercase tracking-wider font-mono text-white/75">{`${targetLabel} → Speak`}</div>
          <div className="text-3xl secondary-font text-white mt-2">{getPhraseScriptText(recallPhrase)}</div>
        </>
      );
    }
    return (
      <>
        <div className="text-xs uppercase tracking-wider font-mono text-white/75">Audio Only → Respond</div>
        <button
          onClick={() => speak(getPhraseScriptText(recallPhrase), getPhrasePronunciationText(recallPhrase))}
          className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/14 border border-white/28 text-white text-sm"
        >
          <Volume2 className="w-4 h-4" />
          Play Audio
        </button>
      </>
    );
  };

  const theme = section.themeColor;
  const accentTheme = section.accentColor || theme;
  const isCharcoalTheme = theme.toLowerCase() === '#1f2a37';
  const hasAccentTheme = accentTheme.toLowerCase() !== theme.toLowerCase();
  const panelBorderColor = hasAccentTheme ? accentTheme : theme;
  const rapidRecallBackground = hasAccentTheme ? accentTheme : theme;
  const phrasePanelBackground = hasAccentTheme ? '#FFFFFF' : theme;
  const localGuideBackground = section.id === 'shopping'
    ? '#013220'
    : (hasAccentTheme ? accentTheme : theme);
  const pageBackground = section.id === 'konbini'
    ? 'linear-gradient(145deg, #186E95 0%, #00A850 100%)'
    : theme;
  const learned = useMemo(() => learnedBySection[section.id] || {}, [learnedBySection, section.id]);
  const orderedPhrases = useMemo(() => {
    return [...section.phrases].sort((a, b) => Number(Boolean(learned[a.id])) - Number(Boolean(learned[b.id])));
  }, [section.phrases, learned]);

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
      className="relative min-h-screen px-6 with-bottom-nav overflow-hidden"
      style={{
        background: pageBackground,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.2,
          backgroundImage: "url('/branding/Transparent_Background.png')",
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
        }}
      />
      <GlassHeader
        title={section.title}
        className="bg-white/14 border-white/28"
        scrolledClassName="bg-white/22 border-white/36"
        titleClassName="text-white !text-[1.18rem] md:!text-[1.55rem]"
        scrolledTitleClassName="text-white"
        compactMobile
      />

      <div className="relative z-10 min-h-[calc(100vh-10.75rem)] lg:min-h-0">
        <div className="w-full grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-4 lg:gap-5 lg:items-stretch">
          <div ref={leftColumnRef} className="space-y-4 lg:space-y-0 lg:gap-4 lg:flex lg:flex-col lg:h-full">
            <section
              className="rounded-3xl border-2 bg-white/95 p-4 sm:p-5 md:p-6 shadow-[0_16px_32px_-26px_rgba(15,23,42,0.34)]"
              style={{ borderColor: panelBorderColor }}
            >
              <div className="mx-auto max-w-4xl text-center">
                <div
                  className="relative rounded-2xl px-4 py-4 sm:px-5 sm:py-5 mb-3.5"
                  style={{ background: localGuideBackground }}
                >
                  {section.id === 'shopping' ? (
                    <Link
                      to={konbiniLinkTarget}
                      className="absolute right-3 top-3 inline-flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-xl border border-white bg-[#013220] p-1 transition hover:scale-[1.03] hover:bg-[#1F5A40]"
                      aria-label="Open shopping local guide"
                      title="Open shopping local guide"
                    >
                      <img
                        src="/branding/Konbini_Icon.png"
                        alt="Konbini icon"
                        className="h-full w-full object-contain"
                      />
                    </Link>
                  ) : null}
                  <div className="font-mono text-[0.95rem] sm:text-[1rem] uppercase tracking-[0.12em] mb-2 text-white">
                    Local Guide
                  </div>
                  <h2 className="text-[1.28rem] sm:text-[1.4rem] main-font text-white leading-snug text-pretty">
                    {section.focus}
                  </h2>
                  <p className="text-[0.74rem] text-white/90 mt-2 mb-3.5 leading-relaxed text-pretty">{section.scene}</p>

                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {section.subclusters.map((item) => {
                      if (!hasAccentTheme) {
                        return (
                          <span
                            key={`${section.id}-cluster-${item}`}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider border border-white/40 text-white bg-white/12"
                          >
                            {item}
                          </span>
                        );
                      }

                      return (
                        <span
                          key={`${section.id}-cluster-${item}`}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider border"
                          style={{
                            borderColor: '#FFFFFF',
                            color: '#FFFFFF',
                            backgroundColor: accentTheme,
                          }}
                        >
                          {item}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="mx-auto max-w-3xl space-y-2.5 text-left text-[#1F2A37] text-pretty">
                  {buildGuideNoteBlocks(section.culturalNotes).map((block, idx) => {
                    if (block.kind === 'bullet') {
                      return (
                        <div key={`${section.id}-tip-${idx}`} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
                          <p className="pl-4 relative text-[0.9rem] leading-[1.55] text-[#334155]">
                            <span className="absolute left-0 top-[0.38rem]" style={{ color: panelBorderColor }}>•</span>
                            {renderNoteText(block.text)}
                          </p>
                        </div>
                      );
                    }

                    if (block.kind === 'title') {
                      return (
                        <div key={`${section.id}-tip-${idx}`} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
                          <p className="text-[0.84rem] font-semibold text-[#1F2A37] leading-tight mb-1">
                            {block.title}
                          </p>
                          <div className="space-y-1.5">
                            {block.bodies.map((body, bodyIdx) => (
                              <p key={`${section.id}-tip-${idx}-body-${bodyIdx}`} className="text-[0.9rem] leading-[1.55] text-[#334155]">
                                {renderNoteText(body)}
                              </p>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={`${section.id}-tip-${idx}`} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
                        <p className="text-[0.9rem] leading-[1.55] text-[#334155]">
                          {renderNoteText(block.text)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section
              ref={rapidRecallRef}
              className="rounded-3xl border p-4 shadow-[0_16px_32px_-26px_rgba(15,23,42,0.34)]"
              style={{ borderColor: 'rgba(255,255,255,0.55)', backgroundColor: rapidRecallBackground }}
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
                      <div className="text-lg secondary-font text-white mt-1">{getPhraseScriptText(recallPhrase)}</div>
                      <div className="text-sm text-white/80">{getPhrasePronunciationText(recallPhrase)}</div>
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
            style={{ borderColor: 'rgba(255,255,255,0.55)', backgroundColor: phrasePanelBackground }}
          >
            <div className="mb-4 text-center">
              <div className={`text-1.0em tracking-wide main-font ${hasAccentTheme ? 'text-[#003087]' : 'text-white/75'}`}>
                Essential Phrases ({section.phrases.length})
              </div>
              <div className={`text-xs font-mono mt-1 ${hasAccentTheme ? 'text-[#334155]' : 'text-white/85'}`}>
                Check the box to lock it in when you have learned the phrase.
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {orderedPhrases.map((phrase) => {
                const isLearned = Boolean(learned[phrase.id]);
                return (
                  <div
                    key={phrase.id}
                    className="relative rounded-2xl border p-4 sm:p-5 text-center min-h-[220px] md:min-h-[200px] md:aspect-square flex flex-col"
                    style={{
                      borderColor: hasAccentTheme ? accentTheme : 'rgba(255,255,255,0.24)',
                      backgroundColor: hasAccentTheme
                        ? (isLearned ? '#FFFFFF' : accentTheme)
                        : (isLearned ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.14)'),
                    }}
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
                        hasAccentTheme
                          ? (isLearned
                            ? ''
                            : 'border-white/75 bg-white/20 text-white')
                          : (isLearned
                            ? 'border-white/35 bg-white/20 text-white'
                            : 'border-white/25 bg-white/12 text-white/70 hover:text-white')
                      }`}
                      style={hasAccentTheme && isLearned
                        ? {
                            borderColor: accentTheme,
                            backgroundColor: `${accentTheme}1A`,
                            color: accentTheme,
                          }
                        : undefined}
                      aria-label={isLearned ? `Unmark ${phrase.english}` : `Mark ${phrase.english} as learned`}
                      title={isLearned ? 'Uncheck to unlock card' : "Check when you've got this down"}
                    >
                      {isLearned ? <SquareCheckBig className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>

                    <div className="h-full flex flex-col">
                      <div className="flex-1 flex flex-col items-center justify-center gap-1.5 pt-5">
                      <div className={`secondary-font leading-tight text-[1.2rem] lg:text-[1.2rem] xl:text-2xl ${hasAccentTheme && isLearned ? 'text-[#003087]' : 'text-white'}`}>
                          {getPhraseScriptText(phrase)}
                        </div>
                        <div
                          className={`max-w-[90%] leading-snug text-[0.78rem] lg:text-[0.78rem] xl:text-sm ${
                            hasAccentTheme && isLearned
                              ? 'text-[#334155]'
                              : (isCharcoalTheme ? 'text-[#E5F3FC]' : 'text-[#EAF6F0]')
                          }`}
                        >
                          {getPhrasePronunciationText(phrase)}
                        </div>
                        <div className={`max-w-[90%] leading-snug text-[0.9rem] lg:text-[0.9rem] xl:text-sm ${
                          hasAccentTheme && isLearned
                            ? 'text-[#0F172A]'
                            : (isCharcoalTheme ? 'text-white' : 'text-white/95')
                        }`}>
                          {phrase.english}
                        </div>
                      </div>

                      <div className="flex items-center justify-center pt-3">
                        <button
                          onClick={() => speak(getPhraseScriptText(phrase), getPhrasePronunciationText(phrase))}
                          disabled={isLearned}
                          className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border disabled:opacity-40 disabled:cursor-not-allowed ${
                            hasAccentTheme && isLearned
                              ? ''
                              : 'border-white/28 bg-white/16 text-white'
                          }`}
                          style={hasAccentTheme && isLearned
                            ? {
                                borderColor: `${accentTheme}66`,
                                backgroundColor: `${accentTheme}1F`,
                                color: accentTheme,
                              }
                            : undefined}
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
