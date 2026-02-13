import { Sparkles, LayoutGrid, MessageSquare, Feather } from 'lucide-react';
import BottomNav from './BottomNav';

const CARD_ACCENTS = [
  {
    leftBorder: 'border-[#1E3A8A]',
    badgeBg: 'bg-[rgba(30,58,138,0.16)]',
    badgeText: 'text-[#1E3A8A]',
    hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(30,58,138,0.45)]',
  },
  {
    leftBorder: 'border-[#4D7C0F]',
    badgeBg: 'bg-[rgba(77,124,15,0.16)]',
    badgeText: 'text-[#4D7C0F]',
    hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(77,124,15,0.40)]',
  },
  {
    leftBorder: 'border-[#374151]',
    badgeBg: 'bg-[rgba(55,65,81,0.14)]',
    badgeText: 'text-[#374151]',
    hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(55,65,81,0.42)]',
  },
  {
    leftBorder: 'border-[#C2410C]',
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
    icon: Sparkles,
    framework: 'HSK 3.0 · Bands 1 - 9',
  },
  {
    id: 'jp',
    name: 'Japanese',
    nativeName: '日本語',
    icon: LayoutGrid,
    framework: 'JLPT · N5 - N1',
  },
  {
    id: 'kr',
    name: 'Korean',
    nativeName: '한국어',
    icon: MessageSquare,
    framework: 'TOPIK · Levels 1 - 6',
  },
  {
    id: 'fr',
    name: 'French',
    nativeName: 'Français',
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
    <div className="min-h-screen page-shell px-6 pt-8 pb-24">
      {/* Header */}
      <div className="text-center mb-10">
        <img
          src="/branding/logo_name_solo.png"
          alt="Sonus"
          className="h-16 md:h-20 w-auto mx-auto mb-2 object-contain"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <h1 className="font-playfair text-5xl font-normal text-text-dark mb-2 sr-only">
          Sonus
        </h1>
        <h1 className="text-base text-text-med italic">
          Choose <span className="font-playfair">a language</span>
        </h1>
      </div>

      {/* Language Cards */}
      <div className="space-y-4">
        {languages.map((lang, index) => {
          const Icon = lang.icon;
          const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
          return (
            <button
              key={lang.id}
              onClick={() => onSelectLanguage(lang.id)}
              className={`w-full bg-white border-l-4 ${accent.leftBorder} rounded-2xl p-6 text-left transition-all hover:-translate-y-1 hover:shadow-xl ${accent.hoverShadow} active:translate-y-0`}
            >
              <div className="flex items-start gap-4">
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
                <h2 className="font-playfair text-2xl font-normal text-text-dark mb-1">
                  {lang.name}
                </h2>
                <p className="text-lg text-text-med mb-3 font-noto-serif">
                  {lang.nativeName}
                </p>
                <p className="text-xs text-text-med font-mono uppercase tracking-wider">
                  {lang.framework}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-center mt-12 text-sm text-text-light">
        <i>Start your language learning journey today!</i>
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
