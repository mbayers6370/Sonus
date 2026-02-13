import { ChevronLeft, AudioLines } from 'lucide-react';
import { useAudio } from '../hooks/useAudio';
import BottomNav from './BottomNav';

interface MandarinTonesProps {
  onBack: () => void;
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
      border: 'border-[#1E3A8A]',
      badgeBg: 'bg-[rgba(30,58,138,0.16)]',
      badgeText: 'text-[#1E3A8A]',
      shadow: 'hover:shadow-[0_18px_42px_-24px_rgba(30,58,138,0.45)]',
    },
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
      border: 'border-[#4D7C0F]',
      badgeBg: 'bg-[rgba(77,124,15,0.16)]',
      badgeText: 'text-[#4D7C0F]',
      shadow: 'hover:shadow-[0_18px_42px_-24px_rgba(77,124,15,0.40)]',
    },
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
      border: 'border-[#374151]',
      badgeBg: 'bg-[rgba(55,65,81,0.14)]',
      badgeText: 'text-[#374151]',
      shadow: 'hover:shadow-[0_18px_42px_-24px_rgba(55,65,81,0.42)]',
    },
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
      border: 'border-[#C2410C]',
      badgeBg: 'bg-[rgba(194,65,12,0.16)]',
      badgeText: 'text-[#C2410C]',
      shadow: 'hover:shadow-[0_18px_42px_-24px_rgba(194,65,12,0.45)]',
    },
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
      border: 'border-gray-400',
      badgeBg: 'bg-gray-100',
      badgeText: 'text-gray-700',
      shadow: 'hover:shadow-gray-500/10',
    },
  },
] as const;

export default function MandarinTones({ onBack, onHome, onOpenProfile }: MandarinTonesProps) {
  const { speak } = useAudio();

  return (
    <div className="min-h-screen page-shell px-6 pt-14 pb-24">
      <div className="relative mb-10">
        <button
          onClick={onBack}
          className="absolute left-0 top-0 inline-flex items-center gap-1.5 p-2 -ml-2 text-text-dark hover:opacity-70 transition-opacity"
        >
          <ChevronLeft className="w-4.5 h-4.5" />
          <span className="text-sm">Back</span>
        </button>

        <div className="text-center">
          <h1 className="font-playfair text-5xl font-normal text-text-dark mb-2">
            Mandarin Tones
          </h1>
          <h2 className="text-base text-text-med italic">
            Beginner <span className="font-playfair">pronunciation foundations</span>
          </h2>
          <p className="text-xs text-text-light mt-2">
            English lines below are intonation analogies to help your ear.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {TONE_CARDS.map((tone) => (
          <div
            key={tone.id}
            className={`bg-white border-2 ${tone.accent.border} rounded-2xl p-5 transition-all hover:-translate-y-1 hover:shadow-xl ${tone.accent.shadow}`}
          >
            <div className="flex items-start justify-between mb-4">
              <span
                className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider font-mono ${tone.accent.badgeBg} ${tone.accent.badgeText}`}
              >
                {tone.label}
              </span>
              <button
                onClick={() => speak(tone.hanzi, tone.pinyin)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold uppercase tracking-wider font-mono ${tone.accent.badgeText} ${tone.accent.badgeBg} hover:opacity-80 transition-opacity`}
                aria-label={`Play ${tone.label}`}
              >
                <AudioLines className="w-3.5 h-3.5" />
                Play
              </button>
            </div>

            <div className="font-playfair text-3xl text-text-dark mb-1">{tone.pinyin}</div>
            <div className="font-noto-serif text-2xl text-text-dark mb-2">{tone.hanzi}</div>
            <div className="text-sm text-text-med mb-3">{tone.subtitle}</div>
            <div className="text-xs font-mono uppercase tracking-wider text-text-light mb-2">{tone.example}</div>
            <div className="text-xs text-text-med leading-relaxed">{tone.englishExample}</div>
          </div>
        ))}
      </div>

      <BottomNav active="home" onHome={onHome} onProfile={onOpenProfile} />
    </div>
  );
}
