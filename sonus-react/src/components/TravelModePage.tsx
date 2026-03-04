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
import { toTitleCase } from '../lib/textCase';
import { getTravelModeSections } from '../data/travelModeData';
import { normalizeLanguageId } from '../lib/languageRuntime';

const travelSectionIcons: Record<string, LucideIcon> = {
  'airport-arrival': Plane,
  transport: CarTaxiFront,
  hotel: BedDouble,
  restaurants: Utensils,
  shopping: ShoppingBag,
  emergency: Stethoscope,
  'small-talk': MessageCircle,
  digital: Smartphone,
};

interface TravelModePageProps {
  onGoHome: () => void;
  onOpenProfile: () => void;
  onOpenSection: (sectionId: string) => void;
  selectedLanguage?: string | null;
}

function renderTileTitle(title: string) {
  const parts = toTitleCase(title).trim().split(/\s+/);
  const [first, ...rest] = parts;
  const restText = rest.join(' ');

  return (
    <h3 className="text-center leading-[1.12] flex flex-col items-center gap-0.5 text-white px-1 max-w-full break-words">
      <span className="secondary-font font-semibold text-[0.92rem] sm:text-[0.98rem] tracking-tight break-words">{first}</span>
      {restText ? <span className="main-font text-[0.96rem] sm:text-[1.02rem] break-words">{restText}</span> : null}
    </h3>
  );
}

export default function TravelModePage({ onGoHome, onOpenProfile, onOpenSection, selectedLanguage }: TravelModePageProps) {
  const normalizedLanguage = normalizeLanguageId(selectedLanguage);
  const sections = getTravelModeSections(normalizedLanguage);
  const isJapanese = normalizedLanguage === 'ja';
  const targetLabel = isJapanese ? 'Japanese' : 'Mandarin';
  return (
    <div className="relative min-h-screen page-shell px-6 overflow-hidden pb-[calc(var(--sonus-bottom-nav-height)+env(safe-area-inset-bottom,0px)+1rem)] lg:pb-0 lg:h-[100svh]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundColor: '#186E95',
          backgroundImage: 'linear-gradient(145deg, #186E95 0%, #1b6f96 42%, #205f83 100%)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[#186E95]/72" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.2,
          backgroundImage: "url('/branding/Transparent_Background.png')",
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
        }}
      />
      <div className="pointer-events-none absolute -top-28 -left-16 h-72 w-72 rounded-full bg-white/10 blur-3xl animate-pulse" />
      <div
        className="pointer-events-none absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-[#3E5648]/20 blur-3xl animate-pulse"
        style={{ animationDelay: '1200ms' }}
      />
      <GlassHeader
        title="Travel Sprint"
        className="bg-white/12 border-white/25"
        scrolledClassName="bg-[#186E95]/88 border-white/35"
        titleClassName="text-white"
        scrolledTitleClassName="text-white"
      />

      <div className="relative z-10 min-h-[calc(100vh-10.75rem)] flex items-center lg:min-h-[calc(100svh-10.75rem)] lg:justify-center lg:overflow-hidden">
        <section className="w-full rounded-3xl text-white px-3 py-4 sm:px-4 sm:py-5 mb-3 lg:mb-0 lg:px-0 lg:py-0 lg:max-h-full">
          <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr] lg:gap-4 items-center">
            <div className="text-center flex flex-col items-center justify-center min-h-[210px]">
            <div className="inline-flex items-center gap-2 text-[11px] tracking-wide font-mono text-white/85 mb-2">
              <Plane className="w-4 h-4" />
              Travel Sprint
            </div>
            <h2 className="main-font text-[1.8rem] sm:text-[2rem] leading-tight mb-2">Leaving Soon?</h2>
            <p className="text-[14px] leading-relaxed text-white/90 max-w-2xl mx-auto">
              Travel Sprint prepares you for real-world {targetLabel} with essential phrases for airports,
              transport, hotels, food, payments, and emergencies, giving you exactly what you need before your trip.
            </p>
            <p className="text-[14px] leading-relaxed text-white mt-2 font-semibold max-w-2xl mx-auto">
              Pick a situation, practice the lines, and get day-one confidence fast.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5 justify-center">
              <span className="px-2.5 py-1 rounded-lg bg-white/16 text-[11px] font-mono uppercase tracking-wider">8 scenarios</span>
              <span className="px-2.5 py-1 rounded-lg bg-white/16 text-[11px] font-mono uppercase tracking-wider">Audio + Rapid Recall</span>
              <span className="px-2.5 py-1 rounded-lg bg-white/16 text-[11px] font-mono uppercase tracking-wider">Emergency-ready phrases</span>
            </div>
          </div>

            <div className="bg-white/8 backdrop-blur-sm p-2.5 rounded-2xl flex items-center">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 w-full">
              {sections.map((section, index) => {
                const SectionIcon = travelSectionIcons[section.id] || Plane;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => onOpenSection(section.id)}
                    className="dashboard-card-enter relative w-full min-w-0 text-left rounded-2xl border-2 border-white/65 p-2.5 sm:p-3 transition-all duration-200 h-[158px] sm:h-[166px] lg:h-[172px] flex flex-col hover:-translate-y-1 active:translate-y-0 bg-white/[0.06] shadow-[0_14px_30px_-24px_rgba(255,255,255,0.28)] hover:shadow-[0_20px_34px_-20px_rgba(255,255,255,0.45)] overflow-hidden"
                    aria-label={section.title}
                    style={{
                      animationDelay: `${index * 40 + 30}ms`,
                    }}
                  >
                    <div className="h-full flex flex-col items-center justify-center gap-1.5">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-white/45 bg-white/12 backdrop-blur-sm">
                        <SectionIcon className="w-4 h-4 text-white" />
                      </div>
                      {renderTileTitle(section.title)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          </div>
        </section>
      </div>

      <BottomNav active="home" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
