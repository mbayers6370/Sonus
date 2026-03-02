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
    accent: 'text-[#1F2A37]',
    border: 'border-[#D2DEE7]',
    badge: 'bg-[rgba(181,216,234,0.35)] text-[#186E95]',
  },
  {
    id: 'pinyin',
    title: 'Pinyin',
    subtitle: 'Initials, finals, and contrast pairs',
    icon: BookOpenText,
    accent: 'text-[#1F2A37]',
    border: 'border-[#D2DEE7]',
    badge: 'bg-[rgba(181,216,234,0.35)] text-[#186E95]',
  },
  {
    id: 'characters',
    title: 'Characters',
    subtitle: 'Components, meaning clues, and memory hooks',
    icon: PenLine,
    accent: 'text-[#1F2A37]',
    border: 'border-[#D2DEE7]',
    badge: 'bg-[rgba(181,216,234,0.35)] text-[#186E95]',
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
    <div className="min-h-screen page-shell px-6 with-bottom-nav bg-[linear-gradient(180deg,#F7FAFD_0%,#EEF4F8_100%)]">
      <GlassHeader
        title="Foundations"
        className="bg-white/12 border-white/25"
        scrolledClassName="bg-[#186E95]/88 border-white/35"
        titleClassName="text-[#1F2A37]"
        scrolledTitleClassName="text-white"
      />

      <div className="max-w-6xl mx-auto space-y-4">
        <div className="dashboard-card-enter rounded-3xl border-2 text-center border-[#1F2A37] bg-[#1F2A37] p-5 sm:p-6 shadow-[0_22px_45px_-32px_rgba(31,42,55,0.60)]">
          <div className="text-[11px] uppercase tracking-[0.2em] font-mono text-[#B5D8EA]">Mandarin Core Tools</div>
          <h2 className="main-font text-[2rem] leading-tight text-white mt-2">Build Sound + Script Confidence</h2>
          <p className="text-sm text-white/92 mt-2">
            Use these short modules alongside level lessons to improve pronunciation accuracy and character recognition.
          </p>
        </div>

        <div className="dashboard-card-enter rounded-3xl border border-[#2B3440] bg-[#1F2A37] p-4 sm:p-5 shadow-[0_16px_34px_-26px_rgba(15,23,42,0.28)]">
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
      </div>

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
