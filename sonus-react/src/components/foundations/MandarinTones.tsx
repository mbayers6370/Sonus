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
      border: 'border-[#D2DEE7]',
      badgeBg: 'bg-[rgba(24,110,149,0.12)]',
      badgeText: 'text-[#186E95]',
      shadow: 'hover:shadow-[0_20px_40px_-24px_rgba(15,23,42,0.20)]',
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
      border: 'border-[#D2DEE7]',
      badgeBg: 'bg-[rgba(62,86,72,0.12)]',
      badgeText: 'text-[#3E5648]',
      shadow: 'hover:shadow-[0_20px_40px_-24px_rgba(15,23,42,0.20)]',
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
      border: 'border-[#D2DEE7]',
      badgeBg: 'bg-[rgba(31,42,55,0.10)]',
      badgeText: 'text-[#1F2A37]',
      shadow: 'hover:shadow-[0_20px_40px_-24px_rgba(15,23,42,0.20)]',
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
      border: 'border-[#D2DEE7]',
      badgeBg: 'bg-[rgba(194,65,12,0.12)]',
      badgeText: 'text-[#C2410C]',
      shadow: 'hover:shadow-[0_20px_40px_-24px_rgba(15,23,42,0.20)]',
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
      border: 'border-[#D2DEE7]',
      badgeBg: 'bg-gray-100/90',
      badgeText: 'text-gray-700',
      shadow: 'hover:shadow-[0_20px_40px_-24px_rgba(107,114,128,0.18)]',
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
    speak(hanzi, pinyin);
  };

  return (
    <div className="min-h-screen page-shell px-6 with-bottom-nav bg-[linear-gradient(180deg,#F7FAFD_0%,#EEF4F8_100%)]">
      <GlassHeader
        title="Tone Foundations"
        spacerClassName="mb-10"
        className="bg-white/12 border-white/25"
        scrolledClassName="bg-[#186E95]/88 border-white/35"
        titleClassName="text-[#1F2A37]"
        scrolledTitleClassName="text-white"
      />

      <div className="max-w-6xl mx-auto space-y-4">
        <section className="dashboard-card-enter rounded-3xl border-2 border-[#1F2A37] bg-[#1F2A37] p-5 sm:p-6 text-white shadow-[0_22px_45px_-32px_rgba(31,42,55,0.60)]">
          <div className="text-[11px] uppercase tracking-[0.2em] font-mono text-[#B5D8EA]">Mandarin Foundations</div>
          <h2 className="main-font mt-2 text-[2rem] leading-tight">Tune Your Ear to Tone Shape</h2>
          <p className="mt-2 text-sm text-white/90">
            Train each contour clearly. Tap play, repeat out loud, and lock pitch movement before speed.
          </p>
        </section>

      <section className="dashboard-card-enter rounded-3xl border border-[#2B3440] bg-[#1F2A37] p-4 sm:p-5 shadow-[0_16px_34px_-26px_rgba(15,23,42,0.28)]">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {TONE_CARDS.map((tone, index) => (
          <div
            key={tone.id}
            className={`dashboard-card-enter bg-white border ${tone.accent.border} rounded-3xl p-5 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)] transition-all duration-200 hover:-translate-y-0.5 ${tone.accent.shadow}`}
            style={{ animationDelay: `${index * 45 + 40}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <span
                className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider font-mono ${tone.accent.badgeBg} ${tone.accent.badgeText}`}
              >
                {tone.label}
              </span>
              <button
                type="button"
                onClick={() => handlePlay(tone.hanzi, tone.pinyin)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#D2DEE7] text-xs font-semibold uppercase tracking-wider font-mono text-[#1F2A37] bg-white hover:bg-[#F4F8FC] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#9CC8DE]"
                aria-label={`Play ${tone.label}`}
              >
                <AudioLines className="w-3.5 h-3.5" />
                Play
              </button>
            </div>

            <div className="main-font text-3xl leading-none text-text-dark mb-2">{tone.pinyin}</div>
            <div className="secondary-font text-2xl leading-none text-text-dark mb-3">{tone.hanzi}</div>
            <div className="text-sm text-text-med mb-3">{tone.subtitle}</div>
            <div className="inline-flex items-center gap-2 mb-3 text-[#1F2A37]">
              <svg viewBox="0 0 28 20" className="w-8 h-5" fill="none" aria-hidden="true">
                <path d={tone.contour} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <span className="text-xs font-mono tracking-wide">{tone.example}</span>
            </div>
            <div className="text-xs text-text-med leading-relaxed">{tone.englishExample}</div>
          </div>
        ))}
      </div>
      </section>
      </div>

      <BottomNav active="learn" onHome={onHome} onProfile={onOpenProfile} />
    </div>
  );
}
