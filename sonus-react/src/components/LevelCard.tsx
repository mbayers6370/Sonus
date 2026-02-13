const CARD_ACCENT_ORDER = ['navy', 'sage', 'graphite', 'rust'] as const;

type LevelCardProps = {
  bandNumber: number;                 // 1..9
  badgeText?: string;                 // e.g. "BAND 1" or "N5"
  title: string;                      // "Elementary I"
  subtitle?: string;                  // "Foundations • Everyday Use"
  vocabRange?: string;                // "0–500"
  unitsCount?: number;                // 21
  description?: string;               // 1-sentence summary
  ctaText?: string;                   // "Start learning"
  railColorClassName?: string;
  disabled?: boolean;
  disabledText?: string;              // "Complete previous levels to unlock"
  onClick?: () => void;
};

const ACCENT = {
  navy: { badgeBg: 'bg-[rgba(30,58,138,0.16)]', badgeText: 'text-[#1E3A8A]', ctaText: 'text-[#1E3A8A]', hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(30,58,138,0.45)]', leftBorder: 'border-[#1E3A8A]' },
  sage: { badgeBg: 'bg-[rgba(77,124,15,0.16)]', badgeText: 'text-[#4D7C0F]', ctaText: 'text-[#4D7C0F]', hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(77,124,15,0.40)]', leftBorder: 'border-[#4D7C0F]' },
  graphite: { badgeBg: 'bg-[rgba(55,65,81,0.14)]', badgeText: 'text-[#374151]', ctaText: 'text-[#374151]', hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(55,65,81,0.42)]', leftBorder: 'border-[#374151]' },
  rust: { badgeBg: 'bg-[rgba(194,65,12,0.16)]', badgeText: 'text-[#C2410C]', ctaText: 'text-[#C2410C]', hoverShadow: 'hover:shadow-[0_18px_42px_-24px_rgba(194,65,12,0.45)]', leftBorder: 'border-[#C2410C]' },
  gray: { badgeBg: 'bg-gray-100', badgeText: 'text-gray-700', ctaText: 'text-gray-700', hoverShadow: 'hover:shadow-gray-500/10', leftBorder: 'border-gray-400' },
} as const;

export default function LevelCard(props: LevelCardProps) {
  const {
    bandNumber,
    badgeText,
    title,
    subtitle,
    vocabRange,
    unitsCount,
    description,
    ctaText = "Start learning",
    disabled,
    disabledText,
    onClick,
  } = props;

  const accent =
    disabled
      ? 'gray'
      : CARD_ACCENT_ORDER[Math.max(0, (bandNumber || 1) - 1) % CARD_ACCENT_ORDER.length];
  const a = ACCENT[accent];

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={[
        `w-full bg-white border-l-4 ${a.leftBorder} rounded-2xl p-6 text-left transition-all`,
        'hover:shadow-xl hover:-translate-y-1',
        a.hoverShadow,
        disabled ? 'opacity-50 cursor-not-allowed hover:shadow-none hover:translate-y-0' : '',
      ].join(' ')}
    >
      <div className="w-full">
        <div className="mb-4">
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider font-mono ${a.badgeBg} ${a.badgeText}`}>
            {badgeText ?? `BAND ${bandNumber}`}
          </span>
        </div>

        <div className="font-playfair text-2xl font-normal text-text-dark mb-1">{title}</div>
        {subtitle ? <div className="text-lg text-text-med mb-3">{subtitle}</div> : null}

        {(vocabRange || unitsCount != null) && (
          <div className="mb-4 flex gap-10">
            {vocabRange && (
              <div>
                <div className="text-xl font-semibold text-text-dark">{vocabRange}</div>
                <div className="text-xs tracking-widest text-text-med uppercase">Vocabulary</div>
              </div>
            )}
            {unitsCount != null && (
              <div>
                <div className="text-xl font-semibold text-text-dark">{unitsCount}</div>
                <div className="text-xs tracking-widest text-text-med uppercase">Units</div>
              </div>
            )}
          </div>
        )}

        {description ? (
          <div className="text-xs text-text-med font-mono uppercase tracking-wider mb-3">{description}</div>
        ) : null}

        <div className={`${a.ctaText} font-semibold`}>
          {ctaText} <span aria-hidden>→</span>
        </div>

        {disabled && disabledText ? (
          <div className="mt-2 text-xs text-text-med">{disabledText}</div>
        ) : null}
      </div>
    </button>
  );
}
