import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';
import { normalizeLanguageId } from '../lib/languageRuntime';

const CARD_ACCENTS_BY_LANGUAGE: Record<string, {
  borderColor: string;
  innerBorderColor: string;
  surfaceTint: string;
  hoverShadow: string;
}> = {
  zh: {
    borderColor: 'border-[#DE2910]/58',
    innerBorderColor: 'border-[#DE2910]/34',
    surfaceTint: 'bg-white',
    hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(222,41,16,0.42)]',
  },
  ja: {
    borderColor: 'border-[#BC002D]/58',
    innerBorderColor: 'border-[#BC002D]/34',
    surfaceTint: 'bg-white',
    hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(188,0,45,0.40)]',
  },
  kr: {
    borderColor: 'border-[#0047A0]/58',
    innerBorderColor: 'border-[#0047A0]/34',
    surfaceTint: 'bg-white',
    hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(0,71,160,0.40)]',
  },
  fr: {
    borderColor: 'border-[#0055A4]/58',
    innerBorderColor: 'border-[#0055A4]/34',
    surfaceTint: 'bg-white',
    hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(0,85,164,0.40)]',
  },
  it: {
    borderColor: 'border-[#009246]/58',
    innerBorderColor: 'border-[#009246]/34',
    surfaceTint: 'bg-white',
    hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(0,146,70,0.40)]',
  },
  es: {
    borderColor: 'border-[#AA151B]/58',
    innerBorderColor: 'border-[#AA151B]/34',
    surfaceTint: 'bg-white',
    hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(170,21,27,0.40)]',
  },
};

const languages = [
  {
    id: 'zh',
    name: 'Mandarin',
    nativeName: '普通话',
    nativeClassName: 'font-secondary',
    framework: 'HSK 3.0 · Levels 1 - 9',
  },
  {
    id: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    nativeClassName: 'font-secondary',
    framework: 'JLPT · N5 - N1',
  },
  {
    id: 'kr',
    name: 'Korean',
    nativeName: '한국어',
    nativeClassName: 'font-secondary',
    framework: 'TOPIK · Levels 1 - 6',
  },
  {
    id: 'fr',
    name: 'French',
    nativeName: 'Français',
    nativeClassName: 'font-secondary',
    framework: 'CEFR · A1 - C2',
  },
  {
    id: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    nativeClassName: 'font-secondary',
    framework: 'CEFR · A1 - C2',
  },
  {
    id: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    nativeClassName: 'font-secondary',
    framework: 'CEFR · A1 - C2',
  },
];

interface LanguageSelectProps {
  onSelectLanguage: (langId: string) => void;
  onOpenProfile?: () => void;
  onGoHome?: () => void;
  currentLanguage?: string | null;
  switchMode?: boolean;
  onCancelSwitch?: () => void;
}

export default function LanguageSelect({
  onSelectLanguage,
  onOpenProfile,
  onGoHome,
  currentLanguage,
  switchMode = false,
  onCancelSwitch,
}: LanguageSelectProps) {
  const normalizedCurrent = currentLanguage ? normalizeLanguageId(currentLanguage) : null;
  const title = switchMode ? 'Switch Language' : 'Choose a Language';

  return (
    <div className="min-h-screen page-shell px-6 with-bottom-nav">
      <GlassHeader title={title} />

      {/* Language Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {languages.map((lang) => {
          const accent = CARD_ACCENTS_BY_LANGUAGE[lang.id] || CARD_ACCENTS_BY_LANGUAGE.zh;
          const isAvailable = lang.id === 'zh' || lang.id === 'ja';
          const isCurrent = normalizedCurrent === lang.id;
          const isSwitchCurrent = switchMode && isCurrent;
          return (
            <button
              key={lang.id}
              onClick={() => {
                if (!isAvailable) return;
                if (switchMode) {
                  if (isCurrent) {
                    onCancelSwitch?.();
                    return;
                  }
                  const confirmed = window.confirm(`Switch learning language to ${lang.name}?`);
                  if (!confirmed) return;
                }
                onSelectLanguage(lang.id);
              }}
              disabled={!isAvailable}
              className={`group relative overflow-hidden w-full h-[216px] sm:h-[236px] rounded-2xl sm:rounded-3xl p-4 sm:p-5 text-center transition-all flex items-center justify-center border outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 ${
                isAvailable
                  ? `hover:-translate-y-1 hover:shadow-xl ${accent.hoverShadow} active:translate-y-0`
                  : 'cursor-not-allowed'
              } ${
                isSwitchCurrent
                  ? 'bg-[#C2410C] border-[#C2410C]/90 ring-2 ring-[#C2410C]/28 sm:bg-[#1F2A37] sm:border-[#1F2A37]/90 sm:ring-[#1F2A37]/35 sm:hover:bg-[#C2410C] sm:hover:border-[#C2410C]/90 sm:hover:ring-[#C2410C]/32'
                  : isCurrent
                    ? 'bg-[#1F2A37] border-[#1F2A37]/90 ring-2 ring-[#1F2A37]/35'
                  : `${accent.surfaceTint} ${accent.borderColor}`
              }`}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/18 to-transparent" />
              <div
                className={`pointer-events-none absolute inset-[7px] rounded-2xl sm:rounded-3xl border ${
                  isCurrent ? 'border-white/18' : accent.innerBorderColor
                }`}
              />

              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
                {!isAvailable && (
                  <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] font-mono bg-[rgba(31,42,55,0.05)] text-[#4D6075]">
                    Coming Soon
                  </span>
                )}
                {isCurrent && isAvailable && (
                  <span className="inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider font-mono bg-white/16 text-white border border-white/28">
                    Current
                  </span>
                )}
              </div>

              <div className="relative z-10 w-full flex flex-col items-center justify-center">
                <div className="mt-2 sm:mt-3">
                <h2 className={`main-font text-[1.45rem] sm:text-2xl font-normal mb-1 ${isCurrent ? 'text-white' : (isAvailable ? 'text-text-dark' : 'text-[#6B7280]')}`}>
                  {lang.name}
                </h2>
                <p className={`text-base sm:text-lg mb-2 sm:mb-3 ${isCurrent ? 'text-white/90' : (isAvailable ? 'text-text-med' : 'text-[#6B7280]')} ${lang.nativeClassName}`}>
                  {lang.nativeName}
                </p>
                <p className={`text-[10px] sm:text-xs font-mono uppercase tracking-wider ${isCurrent ? 'text-white/85' : (isAvailable ? 'text-text-med' : 'text-[#9CA3AF]')}`}>
                  {lang.framework}
                </p>
                {isSwitchCurrent && (
                  <p className="text-[10px] sm:text-xs font-mono uppercase tracking-wider mt-2 text-white/78">
                    Tap to cancel
                  </p>
                )}
                </div>
              </div>
            </button>
          );
        })}
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
