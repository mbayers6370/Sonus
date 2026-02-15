import { useEffect } from 'react';
import { AudioLines } from 'lucide-react';
import { useAudio } from '../hooks/useAudio';
import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';

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
      border: 'border-[#186E95]/55',
      badgeBg: 'bg-[rgba(24,110,149,0.12)]',
      badgeText: 'text-[#186E95]',
      shadow: 'hover:shadow-[0_20px_40px_-24px_rgba(24,110,149,0.28)]',
    },
    contour: 'M2 10 L26 10',
  },
  {
    id: 'tone2',
    label: 'Tone 2',
    subtitle: 'Rising',
    pinyin: 'má',
    hanzi: '麻',
    example: 'rise like asking “huh?”',
    englishExample: 'English analogy: the rise at the end of "what?"',
    accent: {
      border: 'border-[#3E5648]/55',
      badgeBg: 'bg-[rgba(62,86,72,0.12)]',
      badgeText: 'text-[#3E5648]',
      shadow: 'hover:shadow-[0_20px_40px_-24px_rgba(62,86,72,0.26)]',
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
      border: 'border-[#374151]/55',
      badgeBg: 'bg-[rgba(55,65,81,0.10)]',
      badgeText: 'text-[#374151]',
      shadow: 'hover:shadow-[0_20px_40px_-24px_rgba(55,65,81,0.24)]',
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
      border: 'border-[#C2410C]/55',
      badgeBg: 'bg-[rgba(194,65,12,0.12)]',
      badgeText: 'text-[#C2410C]',
      shadow: 'hover:shadow-[0_20px_40px_-24px_rgba(194,65,12,0.30)]',
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
      border: 'border-gray-400/60',
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
    <div className="min-h-screen page-shell px-6 pb-24">
      <GlassHeader title="Mandarin Tones" spacerClassName="mb-10" />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {TONE_CARDS.map((tone, index) => (
          <div
            key={tone.id}
            className={`dashboard-card-enter bg-white/95 border ${tone.accent.border} rounded-3xl p-5 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)] transition-all duration-200 hover:-translate-y-0.5 ${tone.accent.shadow}`}
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
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-xs font-semibold uppercase tracking-wider font-mono ${tone.accent.badgeText} ${tone.accent.badgeBg} hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-current`}
                aria-label={`Play ${tone.label}`}
              >
                <AudioLines className="w-3.5 h-3.5" />
                Play
              </button>
            </div>

            <div className="main-font text-3xl leading-none text-text-dark mb-2">{tone.pinyin}</div>
            <div className="secondary-font text-2xl leading-none text-text-dark mb-3">{tone.hanzi}</div>
            <div className="text-sm text-text-med mb-3">{tone.subtitle}</div>
            <div className={`inline-flex items-center gap-2 mb-3 ${tone.accent.badgeText}`}>
              <svg viewBox="0 0 28 20" className="w-8 h-5" fill="none" aria-hidden="true">
                <path d={tone.contour} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <span className="text-xs font-mono tracking-wide">{tone.example}</span>
            </div>
            <div className="text-xs text-text-med leading-relaxed">{tone.englishExample}</div>
          </div>
        ))}
      </div>

      <BottomNav active="learn" onHome={onHome} onProfile={onOpenProfile} />
    </div>
  );
}
