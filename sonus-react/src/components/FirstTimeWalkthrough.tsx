import { useEffect } from 'react';
import type { ReactNode } from 'react';

type FirstTimeWalkthroughProps = {
  title: string;
  body: ReactNode;
  stepIndex: number;
  stepCount: number;
  highlightRect?: {
    top: number;
    left: number;
    width: number;
    height: number;
    borderRadius: string;
  } | null;
  canGoBack: boolean;
  canGoNext: boolean;
  saving?: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
};

export default function FirstTimeWalkthrough({
  title,
  body,
  stepIndex,
  stepCount,
  highlightRect = null,
  canGoBack,
  canGoNext,
  saving = false,
  onBack,
  onNext,
  onSkip,
}: FirstTimeWalkthroughProps) {
  const isLastStep = stepIndex >= stepCount - 1;

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyTouchAction = document.body.style.touchAction;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.touchAction = previousBodyTouchAction;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[220] flex items-end justify-center bg-black/45 px-4 pt-4"
      style={{
        // Keep the tour sheet anchored low on mobile so it can cover bottom nav/legal bars.
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.25rem)',
      }}
    >
      {highlightRect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[1] rounded-2xl border-[1.5px] border-white"
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
            borderRadius: highlightRect.borderRadius,
            boxShadow: '0 0 0 2px rgba(255,255,255,0.36), 0 0 18px rgba(255,255,255,0.56), 0 0 30px rgba(255,255,255,0.38)',
          }}
        />
      )}
      <section
        role="dialog"
        aria-modal="true"
        aria-label="First-time walkthrough"
        className="relative z-[2] w-full max-w-xl rounded-2xl border border-white/30 bg-white p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-[#4D6075]">
            Step {stepIndex + 1} of {stepCount}
          </p>
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#4D6075] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Skip Tour
          </button>
        </div>

        <h2 className="main-font text-center text-xl font-semibold text-[var(--sonus-palette-charcoal)]">{title}</h2>
        <div className="font-secondary mt-2 text-sm leading-6 text-[#334155]">{body}</div>

        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
          <div
            className="h-full rounded-full bg-[var(--sonus-palette-charcoal)] transition-all"
            style={{ width: `${((stepIndex + 1) / stepCount) * 100}%` }}
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={!canGoBack || saving}
            className="font-mono rounded-lg border border-[#CBD5E1] px-4 py-2 text-sm font-semibold text-[#334155] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canGoNext || saving}
            className="font-mono rounded-lg bg-[var(--sonus-palette-charcoal)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving...' : isLastStep ? 'Finish' : 'Next'}
          </button>
        </div>
      </section>
    </div>
  );
}
