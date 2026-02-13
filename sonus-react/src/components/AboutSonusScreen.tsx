import { ChevronLeft } from 'lucide-react';
import BottomNav from './BottomNav';

interface AboutSonusScreenProps {
  onBack: () => void;
  onGoHome: () => void;
  onGoProfile: () => void;
}

export default function AboutSonusScreen({ onBack, onGoHome, onGoProfile }: AboutSonusScreenProps) {
  return (
    <div className="min-h-screen page-shell px-6 pt-14 pb-24">
      <div className="relative mb-8">
        <button
          onClick={onBack}
          className="absolute left-0 -top-1 inline-flex items-center gap-1.5 p-2 -ml-2 text-text-dark hover:opacity-70 transition-opacity"
        >
          <ChevronLeft className="w-4.5 h-4.5" />
          <span className="text-sm">Back</span>
        </button>
        <div className="text-center px-12">
          <h1 className="font-playfair text-5xl font-normal text-text-dark mb-2">About Sonus</h1>
          <h2 className="text-base text-text-med italic">Why the learning system is structured this way</h2>
        </div>
      </div>

      <section className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 bg-[#C2410C] text-white">
          <div className="text-xs uppercase tracking-wider font-mono mb-1 text-white/80">Method</div>
          <h3 className="font-playfair text-3xl">Built on Real Frameworks</h3>
          <p className="text-sm text-white/90 mt-1">
            Sonus follows official proficiency systems used by each language.
          </p>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <div className="text-xs uppercase tracking-wider font-mono text-text-light mb-2">Framework Mapping</div>
            <div className="grid grid-cols-1 gap-2 text-sm text-text-dark">
              <div className="rounded-lg border border-border px-3 py-2">
                <span className="font-semibold text-[#1E3A8A]">Mandarin:</span> HSK 3.0 (Bands 1-9)
              </div>
              <div className="rounded-lg border border-border px-3 py-2">
                <span className="font-semibold text-[#C2410C]">Japanese:</span> JLPT (N5-N1)
              </div>
              <div className="rounded-lg border border-border px-3 py-2">
                <span className="font-semibold text-[#4D7C0F]">Korean:</span> TOPIK
              </div>
              <div className="rounded-lg border border-border px-3 py-2">
                <span className="font-semibold text-[#374151]">French:</span> CEFR
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider font-mono text-text-light mb-2">Why This Structure</div>
            <div className="space-y-2 text-sm text-text-med">
              <p>You get clear milestones and a progression you can actually measure.</p>
              <p>Your level aligns with real exams and compatible outside resources.</p>
              <p>Practice is targeted by weak words and pronunciation gaps, not random drills.</p>
            </div>
          </div>

          <div className="rounded-xl border border-[#1E3A8A]/20 bg-[rgba(30,58,138,0.06)] p-4">
            <div className="text-xs uppercase tracking-wider font-mono text-[#1E3A8A] mb-1">Important Note</div>
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
