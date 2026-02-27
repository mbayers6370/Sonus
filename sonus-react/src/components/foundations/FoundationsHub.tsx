import { BookOpenText, PenLine, Music2, ChevronRight } from 'lucide-react';
import BottomNav from '../BottomNav';
import GlassHeader from '../GlassHeader';

interface FoundationsHubProps {
  onGoHome: () => void;
  onOpenProfile: () => void;
  onOpenTones: () => void;
  onOpenPinyin: () => void;
  onOpenCharacters: () => void;
}

const MODULES = [
  {
    id: 'tones',
    title: 'Tones',
    subtitle: 'Pitch patterns and ear training',
    icon: Music2,
    accent: 'text-[#186E95]',
    border: 'border-[#186E95]/55',
    badge: 'bg-[rgba(24,110,149,0.12)] text-[#186E95]',
  },
  {
    id: 'pinyin',
    title: 'Pinyin',
    subtitle: 'Initials, finals, and contrast pairs',
    icon: BookOpenText,
    accent: 'text-[#3E5648]',
    border: 'border-[#3E5648]/55',
    badge: 'bg-[rgba(62,86,72,0.12)] text-[#3E5648]',
  },
  {
    id: 'characters',
    title: 'Characters',
    subtitle: 'Components, meaning clues, and memory hooks',
    icon: PenLine,
    accent: 'text-[#C2410C]',
    border: 'border-[#C2410C]/55',
    badge: 'bg-[rgba(194,65,12,0.12)] text-[#C2410C]',
  },
] as const;

export default function FoundationsHub({
  onGoHome,
  onOpenProfile,
  onOpenTones,
  onOpenPinyin,
  onOpenCharacters,
}: FoundationsHubProps) {
  return (
    <div className="min-h-screen page-shell px-6 with-bottom-nav">
      <GlassHeader title="Foundations" />

      <div className="space-y-4">
        <div className="rounded-3xl border text-center border-[#186E95] bg-[#186E95] p-5 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.45)]">
          <div className="text-xs uppercase tracking-wider font-mono text-white/80">Mandarin Core Tools</div>
          <h2 className="main-font text-[2rem] leading-tight text-white mt-2">Build Sound + Script Confidence</h2>
          <p className="text-sm text-white/90 mt-2">
            Use these short modules alongside level lessons to improve pronunciation accuracy and character recognition.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MODULES.map((module) => {
            const Icon = module.icon;
            const onClick =
              module.id === 'tones' ? onOpenTones : module.id === 'pinyin' ? onOpenPinyin : onOpenCharacters;
            return (
              <button
                key={module.id}
                onClick={onClick}
                className={`w-full bg-white border ${module.border} rounded-3xl min-h-[165px] p-5 text-left shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono ${module.badge}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {module.title}
                  </span>
                  <ChevronRight className="w-5 h-5 text-text-light" />
                </div>

                <div className="mt-5">
                  <h3 className={`main-font text-[1.9rem] leading-tight font-normal ${module.accent}`}>{module.title}</h3>
                  <p className="text-[1.02rem] text-text-med mt-1">{module.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
