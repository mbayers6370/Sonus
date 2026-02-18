import {
  BedDouble,
  CarTaxiFront,
  MessageCircle,
  Plane,
  ShoppingBag,
  Smartphone,
  Stethoscope,
  Utensils,
} from 'lucide-react';
import BottomNav from './BottomNav';
import type { LucideIcon } from 'lucide-react';
import GlassHeader from './GlassHeader';

type TravelSection = {
  id: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
};

const travelPageSections: TravelSection[] = [
  { id: 'airport-arrival', title: 'Airport & Arrival', icon: Plane },
  { id: 'transport', title: 'Transport & Getting Around', icon: CarTaxiFront },
  { id: 'hotel', title: 'Hotel & Accommodation', icon: BedDouble },
  { id: 'restaurants', title: 'Restaurants & Ordering Food', icon: Utensils },
  { id: 'shopping', title: 'Shopping & Payments', icon: ShoppingBag },
  { id: 'emergency', title: 'Emergencies & Health', icon: Stethoscope },
  { id: 'small-talk', title: 'Everyday Small Talk', icon: MessageCircle },
  { id: 'digital', title: 'Tech & Digital China', icon: Smartphone },
];

interface TravelModePageProps {
  onGoHome: () => void;
  onOpenProfile: () => void;
  onOpenSection: (sectionId: string) => void;
}

function renderTileTitle(title: string) {
  const parts = title.trim().split(/\s+/);
  const [first, ...rest] = parts;
  const restText = rest.join(' ');

  return (
    <h3 className="text-center leading-tight flex flex-col items-center gap-1.5 text-white">
      <span className="secondary-font font-semibold text-[1.6rem] tracking-tight">{first}</span>
      {restText ? <span className="main-font text-[1.65rem]">{restText}</span> : null}
    </h3>
  );
}

export default function TravelModePage({ onGoHome, onOpenProfile, onOpenSection }: TravelModePageProps) {
  return (
    <div className="min-h-screen page-shell px-6 with-bottom-nav">
      <GlassHeader
        title="Travel Mode"
        className="bg-white/18 border-white/30"
        scrolledClassName="bg-white/76 border-white/55"
        titleClassName="text-[#374151]"
        scrolledTitleClassName="text-[#374151]"
      />

      <div>
        <section className="rounded-3xl border border-[#3E5648]/45 bg-[#3E5648] text-white px-6 py-6 mb-5 shadow-[0_24px_44px_-30px_rgba(62,86,72,0.45)]">
          <div className="inline-flex items-center gap-2 text-[11px] tracking-wide font-mono text-white/85 mb-3">
            <Plane className="w-4 h-4" />
            Travel Sprint
          </div>
          <h2 className="main-font text-[2.2rem] leading-tight mb-3">Leaving Soon?</h2>
          <p className="text-[15px] leading-relaxed text-white/90 max-w-4xl">
            Travel Mode is built for real-world Mandarin right before your trip. Instead of giant word lists,
            you train high-utility phrases for airports, transport, hotels, food, payments, and emergencies.
          </p>
          <p className="text-[15px] leading-relaxed text-white mt-3 font-semibold max-w-4xl">
            Pick a situation, practice the lines, and get day-one confidence fast.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-white/16 text-[11px] font-mono uppercase tracking-wider">8 scenarios</span>
            <span className="px-2.5 py-1 rounded-lg bg-white/16 text-[11px] font-mono uppercase tracking-wider">Audio + speak drills</span>
            <span className="px-2.5 py-1 rounded-lg bg-white/16 text-[11px] font-mono uppercase tracking-wider">Emergency-ready phrases</span>
          </div>
        </section>

        <section className="w-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {travelPageSections.map((section, index) => {
            const SectionIcon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onOpenSection(section.id)}
                className="dashboard-card-enter relative w-full text-left rounded-3xl border border-[#3E5648]/90 p-4 transition-all duration-200 bg-[#3E5648] min-h-[208px] flex flex-col hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_rgba(62,86,72,0.36)] shadow-[0_18px_36px_-28px_rgba(62,86,72,0.42)]"
                aria-label={section.title}
                style={{
                  animationDelay: `${index * 40 + 30}ms`,
                }}
              >
                <div className="h-full flex flex-col items-center justify-center gap-3">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-white/28 bg-white/12 text-white backdrop-blur-sm">
                    <SectionIcon className="w-5 h-5 text-white" />
                  </div>
                  {renderTileTitle(section.title)}
                </div>
              </button>
            );
          })}
        </section>
      </div>

      <BottomNav active="home" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
