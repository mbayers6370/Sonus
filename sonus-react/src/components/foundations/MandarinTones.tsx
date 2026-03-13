import { useEffect } from 'react';
import { AudioLines } from 'lucide-react';
import { useAudio } from '../../hooks/useAudio';
import BottomNav from '../BottomNav';
import GlassHeader from '../GlassHeader';

interface MandarinTonesProps {
  onHome: () => void;
  onOpenProfile: () => void;
}

const TONE_CARDS = [
  {
    id: 'tone1',
    label: 'Tone 1',
    subtitle: 'High Level',
    pinyin: 'mā',
    hanzi: '妈',
    example: 'steady high pitch',
    englishExample: 'English analogy: saying "okay." in a flat, sustained voice.',
    accent: {
      border: 'border-[#CBD5E1]',
      chip: 'bg-[#E6F0F6] text-[#145A7D]',
      contour: 'text-[#145A7D]',
      tone: 'text-[#145A7D]',
    },
    contour: 'M2 10 L26 10',
  },
  {
    id: 'tone2',
    label: 'Tone 2',
    subtitle: 'Rising',
    pinyin: 'má',
    hanzi: '麻',
    example: 'rise like asking "huh?"',
    englishExample: 'English analogy: the rise at the end of "what?"',
    accent: {
      border: 'border-[#CBD5E1]',
      chip: 'bg-[#EAF2EC] text-[#2F5A4A]',
      contour: 'text-[#2F5A4A]',
      tone: 'text-[#2F5A4A]',
    },
    contour: 'M2 16 L26 4',
  },
  {
    id: 'tone3',
    label: 'Tone 3',
    subtitle: 'Dip Then Rise',
    pinyin: 'mǎ',
    hanzi: '马',
    example: 'fall low, then rise',
    englishExample: 'English analogy: uncertain "well..." (dips then lifts).',
    accent: {
      border: 'border-[#CBD5E1]',
      chip: 'bg-[#ECEFF3] text-[var(--sonus-palette-charcoal)]',
      contour: 'text-[var(--sonus-palette-charcoal)]',
      tone: 'text-[var(--sonus-palette-charcoal)]',
    },
    contour: 'M2 6 Q10 18 16 11 T26 4',
  },
  {
    id: 'tone4',
    label: 'Tone 4',
    subtitle: 'Sharp Falling',
    pinyin: 'mà',
    hanzi: '骂',
    example: 'quick, strong drop',
    englishExample: 'English analogy: a firm command like "No!"',
    accent: {
      border: 'border-[#CBD5E1]',
      chip: 'bg-[#F8ECE6] text-[#B1461B]',
      contour: 'text-[#B1461B]',
      tone: 'text-[#B1461B]',
    },
    contour: 'M2 4 L26 16',
  },
  {
    id: 'tone0',
    label: 'Neutral',
    subtitle: 'Light Tone',
    pinyin: 'ma',
    hanzi: '吗',
    example: 'short, light, unstressed',
    englishExample: 'English analogy: the unstressed "a" in "about".',
    accent: {
      border: 'border-[#CBD5E1]',
      chip: 'bg-[#F1F5F9] text-[#475569]',
      contour: 'text-[#475569]',
      tone: 'text-[#475569]',
    },
    contour: 'M2 10 Q9 9 16 10 T26 10',
  },
] as const;

export default function MandarinTones({ onHome, onOpenProfile }: MandarinTonesProps) {
  const { speak } = useAudio();
  useEffect(() => {
    window.speechSynthesis?.getVoices?.();
  }, []);

  const handlePlay = (hanzi: string, pinyin: string) => {
    window.speechSynthesis?.cancel?.();
    window.speechSynthesis?.resume?.();
    speak(hanzi, pinyin, false, 'zh');
  };

  return (
    <div className="min-h-screen page-shell px-6 with-bottom-nav bg-[linear-gradient(180deg,#F7FAFD_0%,#EEF4F8_100%)]">
      <GlassHeader
        title="Tone Foundations"
        hideLogoOnMobile
        spacerClassName="mb-10"
        className="bg-white/12 border-white/25"
        scrolledClassName="bg-[var(--sonus-palette-blue)]/88 border-white/35"
        titleClassName="text-[var(--sonus-palette-charcoal)]"
        scrolledTitleClassName="text-white"
      />

      <div className="max-w-6xl mx-auto space-y-4">
        <section className="dashboard-card-enter rounded-3xl border-2 border-[var(--sonus-palette-charcoal)] bg-[var(--sonus-palette-charcoal)] p-5 sm:p-6 text-white shadow-[0_22px_45px_-32px_rgba(31,42,55,0.60)]">
          <div className="text-[11px] uppercase tracking-[0.2em] font-mono text-[#B5D8EA]">Mandarin Foundations</div>
          <h2 className="main-font mt-2 text-[2rem] leading-tight">Tune Your Ear to Tone Shape</h2>
          <p className="mt-2 text-sm text-white/90">
            Train each contour clearly. Tap play, repeat out loud, and lock pitch movement before speed.
          </p>
        </section>

      <section className="dashboard-card-enter rounded-3xl border border-[#2B3440] bg-[var(--sonus-palette-charcoal)] p-4 sm:p-5 shadow-[0_16px_34px_-26px_rgba(15,23,42,0.28)]">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {TONE_CARDS.map((tone, index) => (
          <div
            key={tone.id}
            className={`dashboard-card-enter bg-[#FCFDFC] border ${tone.accent.border} rounded-2xl p-5 shadow-[0_10px_22px_-20px_rgba(15,23,42,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_28px_-22px_rgba(15,23,42,0.32)]`}
            style={{ animationDelay: `${index * 45 + 40}ms` }}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-[0.14em] font-mono ${tone.accent.chip}`}
                >
                  {tone.label}
                </span>
                <div className="mt-2 text-sm text-[#5B6776]">{tone.subtitle}</div>
              </div>
              <button
                type="button"
                onClick={() => handlePlay(tone.hanzi, tone.pinyin)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#CBD5E1] text-[11px] font-semibold uppercase tracking-[0.14em] font-mono text-[var(--sonus-palette-charcoal)] bg-white hover:bg-[#F7FAFC] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#9CC8DE]"
                aria-label={`Play ${tone.label}`}
              >
                <AudioLines className="w-3.5 h-3.5" />
                Play
              </button>
            </div>

            <div className="flex items-end justify-between gap-3 border-t border-[#E2E8F0] pt-4">
              <div>
                <div className={`main-font text-[2.05rem] leading-none mb-1 ${tone.accent.tone}`}>{tone.pinyin}</div>
                <div className="secondary-font text-[1.8rem] leading-none text-[var(--sonus-palette-charcoal)]">{tone.hanzi}</div>
              </div>
              <div className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[#F7FAFC] ${tone.accent.contour}`}>
                <svg viewBox="0 0 28 20" className="w-8 h-5" fill="none" aria-hidden="true">
                <path d={tone.contour} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
                <span className="text-[11px] font-mono tracking-wide">{tone.example}</span>
              </div>
            </div>
            <div className="mt-4 text-[12px] text-[#64748B] leading-relaxed">{tone.englishExample}</div>
          </div>
        ))}
      </div>
      </section>
      </div>

      <BottomNav active="learn" onHome={onHome} onProfile={onOpenProfile} />
    </div>
  );
}
