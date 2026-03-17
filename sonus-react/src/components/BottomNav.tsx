import { Book, BookOpen, FolderKanban, House, Layers3, ListChecks, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { resolveLearnQuickStage } from '../lib/learnPath';

interface BottomNavProps {
  onHome: () => void;
  onProfile: () => void;
  onLearn?: () => void;
  active?: 'home' | 'learn' | 'profile';
}

export default function BottomNav({ onHome, onProfile, onLearn, active = 'home' }: BottomNavProps) {
  const location = useLocation();
  const routeKey = `${location.pathname}${location.search}`;
  const [learnMenuOpenRouteKey, setLearnMenuOpenRouteKey] = useState<string | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 950px)').matches : false
  );
  const mobileLearnMenuOpen = isMobileViewport && learnMenuOpenRouteKey === routeKey;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 950px)');
    const onChange = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches);
      if (!event.matches) {
        setLearnMenuOpenRouteKey(null);
      }
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const handleLearn = () => {
    if (isMobileViewport) {
      setLearnMenuOpenRouteKey((openKey) => (openKey === routeKey ? null : routeKey));
      return;
    }
    if (onLearn) {
      onLearn();
      return;
    }
    window.dispatchEvent(new CustomEvent('sonus:learn'));
  };

  const runLearnAction = (target: 'levels' | 'units' | 'lessons') => {
    setLearnMenuOpenRouteKey(null);
    if (target === 'levels') {
      window.dispatchEvent(new CustomEvent('sonus:learn:levels'));
      return;
    }
    if (target === 'units') {
      window.dispatchEvent(new CustomEvent('sonus:learn:units'));
      return;
    }
    window.dispatchEvent(new CustomEvent('sonus:learn:lessons'));
  };

  const learnActive = active === 'learn' || mobileLearnMenuOpen;
  const quickStage = resolveLearnQuickStage(location.pathname, location.search);
  const quickActive = {
    levels: quickStage === 'levels',
    units: quickStage === 'units',
    lessons: quickStage === 'lessons',
  } as const;
  const quickButtonClass = (isCurrent: boolean) =>
    `flex flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-text-dark transition-colors ${
      isCurrent
        ? 'border-[var(--sonus-palette-rust)]/45 bg-[rgba(194,65,12,0.10)] text-[var(--sonus-palette-rust)] shadow-[inset_0_0_0_1px_rgba(194,65,12,0.22)]'
        : 'border-[#E2E8F0] bg-white hover:bg-[#F8F8F6]'
    }`;
  const bottomNavHeight = 'calc(var(--sonus-bottom-nav-height, 6.1rem) + env(safe-area-inset-bottom, 0px))';

  return (
    <>
      {mobileLearnMenuOpen && (
        <button
          type="button"
          aria-label="Close learn quick menu"
          onClick={() => setLearnMenuOpenRouteKey(null)}
          className="fixed left-0 right-0 top-0 z-[58] bg-[var(--sonus-palette-charcoal)]/24 backdrop-blur-[1.5px] min-[951px]:hidden"
          style={{
            bottom: bottomNavHeight,
          }}
        />
      )}
      {mobileLearnMenuOpen && (
        <div
          className="fixed left-1/2 z-[59] w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-[#E4E9EF] bg-[#FBFBF9] p-5 backdrop-blur-sm shadow-[0_20px_40px_-24px_rgba(15,23,42,0.40)] min-[951px]:hidden"
          style={{
            bottom: `calc(${bottomNavHeight} + 0.6rem)`,
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => runLearnAction('levels')}
              className={`col-span-2 ${quickButtonClass(quickActive.levels)}`}
              aria-current={quickActive.levels ? 'page' : undefined}
            >
              <Layers3 className="h-4 w-4" />
              <span className="text-xs font-medium">Levels</span>
            </button>
            <button
              type="button"
              onClick={() => runLearnAction('units')}
              className={quickButtonClass(quickActive.units)}
              aria-current={quickActive.units ? 'page' : undefined}
            >
              <FolderKanban className="h-4 w-4" />
              <span className="text-xs font-medium">Units</span>
            </button>
            <button
              type="button"
              onClick={() => runLearnAction('lessons')}
              className={quickButtonClass(quickActive.lessons)}
              aria-current={quickActive.lessons ? 'page' : undefined}
            >
              <ListChecks className="h-4 w-4" />
              <span className="text-xs font-medium">Lessons</span>
            </button>
          </div>
        </div>
      )}
      <div
        className="fixed bottom-0 left-0 right-0 bg-bg-warm/95 backdrop-blur-xl border-t border-border z-[60] min-[951px]:hidden"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: bottomNavHeight,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
      <div className="h-full w-full relative px-4">
        <div className="flex h-[82%] items-center justify-center pt-1.5">
          <div className="flex items-center justify-center gap-4 sm:gap-6">
          <button
            onClick={onHome}
            className={`flex flex-col items-center gap-1 px-6 py-2 transition-colors ${
              active === 'home' ? 'text-[var(--sonus-palette-blue)] font-semibold' : 'text-text-light hover:text-text-dark'
            }`}
          >
            <House className="w-6 h-6" />
            <span className={`text-xs ${active === 'home' ? 'font-semibold' : ''}`}>Home</span>
          </button>
          <button
            onClick={handleLearn}
            className={`flex flex-col items-center gap-1 px-6 py-2 transition-colors ${
              learnActive ? 'text-[var(--sonus-palette-blue)] font-semibold' : 'text-text-light hover:text-text-dark'
            }`}
          >
            {mobileLearnMenuOpen ? <BookOpen className="w-6 h-6" /> : <Book className="w-6 h-6" />}
            <span className={`text-xs ${learnActive ? 'font-semibold' : ''}`}>Learn</span>
          </button>
          <button
            onClick={onProfile}
            className={`flex flex-col items-center gap-1 px-6 py-2 transition-colors ${
              active === 'profile' ? 'text-[var(--sonus-palette-blue)] font-semibold' : 'text-text-light hover:text-text-dark'
            }`}
          >
            <User className="w-6 h-6" />
            <span className={`text-xs ${active === 'profile' ? 'font-semibold' : ''}`}>Profile</span>
          </button>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[18%] bg-[#2B3440] border-t border-white/10">
          <div className="flex h-full items-center justify-center gap-2 px-3 text-[6px] leading-none font-light text-[#C7D0DC] sm:text-[6px]">
            <Link to="/privacy" className="underline-offset-2 hover:underline font-mono text-[6px]">
            Privacy
            </Link>
            <span aria-hidden="true">|</span>
            <Link to="/terms" className="underline-offset-2 hover:underline font-mono text-[6px]">
              Terms
            </Link>
            <span aria-hidden="true">|</span>
            <Link to="/contact" className="underline-offset-2 hover:underline font-mono text-[6px]">
            Contact
            </Link>
            <span aria-hidden="true">|</span>
            <Link to="/attributions" className="underline-offset-2 hover:underline font-mono text-[6px]">
              Attributions
            </Link>
            <span aria-hidden="true">|</span>
            <span className="font-mono text-[6px]">© {new Date().getFullYear()} Sonus</span>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
