import { ScrollText, Landmark, MessagesSquare, Feather } from 'lucide-react';
import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';

const CARD_ACCENTS = [
  {
    borderColor: 'border-[#186E95]/55',
    badgeBg: 'bg-[rgba(24,110,149,0.16)]',
    badgeText: 'text-[#186E95]',
    hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(24,110,149,0.45)]',
  },
  {
    borderColor: 'border-[#3E5648]/55',
    badgeBg: 'bg-[rgba(62,86,72,0.16)]',
    badgeText: 'text-[#3E5648]',
    hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(62,86,72,0.40)]',
  },
  {
    borderColor: 'border-[#374151]/55',
    badgeBg: 'bg-[rgba(55,65,81,0.14)]',
    badgeText: 'text-[#374151]',
    hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(55,65,81,0.42)]',
  },
  {
    borderColor: 'border-[#C2410C]/55',
    badgeBg: 'bg-[rgba(194,65,12,0.16)]',
    badgeText: 'text-[#C2410C]',
    hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(194,65,12,0.45)]',
  },
] as const;

const languages = [
  {
    id: 'zh',
    name: 'Mandarin',
    nativeName: '普通话',
    nativeClassName: 'font-secondary',
    icon: ScrollText,
    framework: 'HSK 3.0 · Bands 1 - 9',
  },
  {
    id: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    nativeClassName: 'font-secondary',
    icon: Landmark,
    framework: 'JLPT · N5 - N1',
  },
  {
    id: 'kr',
    name: 'Korean',
    nativeName: '한국어',
    nativeClassName: 'font-secondary',
    icon: MessagesSquare,
    framework: 'TOPIK · Levels 1 - 6',
  },
  {
    id: 'fr',
    name: 'French',
    nativeName: 'Français',
    nativeClassName: 'font-secondary',
    icon: Feather,
    framework: 'CEFR · A1 - C2',
  },
];

interface LanguageSelectProps {
  onSelectLanguage: (langId: string) => void;
  onOpenProfile?: () => void;
  onGoHome?: () => void;
}

export default function LanguageSelect({ onSelectLanguage, onOpenProfile, onGoHome }: LanguageSelectProps) {

  return (
    <div className="min-h-screen page-shell px-6 with-bottom-nav">
      <GlassHeader title="Choose a Language" />

      {/* Language Cards */}
      <div className="space-y-4">
        {languages.map((lang, index) => {
          const Icon = lang.icon;
          const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
          const isAvailable = lang.id === 'zh' || lang.id === 'ja';
          return (
            <button
              key={lang.id}
              onClick={() => {
                if (!isAvailable) return;
                onSelectLanguage(lang.id);
              }}
              disabled={!isAvailable}
              className={`w-full bg-white border ${accent.borderColor} rounded-3xl p-6 text-center transition-all ${
                isAvailable
                  ? `hover:-translate-y-1 hover:shadow-xl ${accent.hoverShadow} active:translate-y-0`
                  : 'cursor-not-allowed'
              }`}
            >
              <div className="flex justify-between items-start">
                <span />
                {!isAvailable && (
                  <span className="inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider font-mono bg-[rgba(55,65,81,0.12)] text-[#374151]">
                    Coming Soon
                  </span>
                )}
              </div>

              <div className="flex justify-center mt-1">
                {/* Icon Badge */}
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${accent.badgeBg}`}>
                  <Icon className={`w-3 h-3 ${accent.badgeText}`} />
                  <span className={`text-xs font-semibold uppercase tracking-wider font-mono ${accent.badgeText}`}>
                    {lang.name}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="mt-4">
                <h2 className={`main-font text-2xl font-normal mb-1 ${isAvailable ? 'text-text-dark' : 'text-[#6B7280]'}`}>
                  {lang.name}
                </h2>
                <p className={`text-lg mb-3 ${isAvailable ? 'text-text-med' : 'text-[#6B7280]'} ${lang.nativeClassName}`}>
                  {lang.nativeName}
                </p>
                <p className={`text-xs font-mono uppercase tracking-wider ${isAvailable ? 'text-text-med' : 'text-[#9CA3AF]'}`}>
                  {lang.framework}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-center mt-12 text-sm text-text-light">
        <i>Mandarin and Japanese are live now. More languages are on the way.</i>
      </div>

      <BottomNav
        active="home"
        onHome={() => {
          onGoHome?.();
        }}
        onProfile={() => {
          onOpenProfile?.();
        }}
      />
    </div>
  );
}
