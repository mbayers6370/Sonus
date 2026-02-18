import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';

interface AboutSonusScreenProps {
  onGoHome: () => void;
  onGoProfile: () => void;
}

export default function AboutSonusScreen({ onGoHome, onGoProfile }: AboutSonusScreenProps) {
  return (
    <div className="min-h-screen page-shell px-6 with-bottom-nav">
      <GlassHeader title="About Sonus" />

      <section className="bg-white border border-border rounded-3xl overflow-hidden shadow-[0_22px_48px_-36px_rgba(31,42,55,0.35)]">
        <div className="px-6 py-6 bg-gradient-to-r from-[#C2410C] via-[#D2571A] to-[#E0702B] text-white text-center">
          <div className="text-xs uppercase tracking-wider font-mono mb-2 text-white/80">Method</div>
          <h3 className="main-font text-4xl leading-tight">Built on Real Frameworks</h3>
          <p className="text-sm text-white/90 mt-2 max-w-2xl mx-auto">
            Sonus follows official proficiency systems used by each language.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="text-xs uppercase tracking-wider font-mono text-text-light mb-3">Framework Mapping</div>
            <div className="grid grid-cols-1 gap-2.5 text-sm text-text-dark">
              <div className="rounded-xl border border-[#186E95]/25 bg-[rgba(24,110,149,0.04)] px-4 py-2.5">
                <span className="font-semibold text-[#186E95]">Mandarin:</span> HSK 3.0 (Bands 1-9)
              </div>
              <div className="rounded-xl border border-[#C2410C]/25 bg-[rgba(194,65,12,0.04)] px-4 py-2.5">
                <span className="font-semibold text-[#C2410C]">Japanese:</span> JLPT (N5-N1)
              </div>
              <div className="rounded-xl border border-[#3E5648]/25 bg-[rgba(62,86,72,0.05)] px-4 py-2.5">
                <span className="font-semibold text-[#3E5648]">Korean:</span> TOPIK
              </div>
              <div className="rounded-xl border border-[#374151]/25 bg-[rgba(55,65,81,0.04)] px-4 py-2.5">
                <span className="font-semibold text-[#374151]">French:</span> CEFR
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider font-mono text-text-light mb-3">Why This Structure</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-text-med">
              <div className="rounded-xl border border-border bg-[#FBFBF9] p-3.5">
                You get clear milestones and a progression you can actually measure.
              </div>
              <div className="rounded-xl border border-border bg-[#FBFBF9] p-3.5">
                Your level aligns with real exams and compatible outside resources.
              </div>
              <div className="rounded-xl border border-border bg-[#FBFBF9] p-3.5">
                Practice is targeted by weak words and pronunciation gaps, not random drills.
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#186E95]/22 bg-[linear-gradient(135deg,rgba(24,110,149,0.08),rgba(24,110,149,0.03))] p-4">
            <div className="text-xs uppercase tracking-wider font-mono text-[#186E95] mb-1.5">Important Note</div>
            <p className="text-sm text-text-med">
              Frameworks guide the path, but the goal is practical communication in real situations.
            </p>
          </div>
        </div>
      </section>

      <BottomNav active="profile" onHome={onGoHome} onProfile={onGoProfile} />
    </div>
  );
}
