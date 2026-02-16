import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface GlassHeaderProps {
  title: string;
  className?: string;
  spacerClassName?: string;
  titleClassName?: string;
  scrolledClassName?: string;
  scrolledTitleClassName?: string;
  scrollThreshold?: number;
  showLogo?: boolean;
}

export default function GlassHeader({
  title,
  className = '',
  spacerClassName = '',
  titleClassName = 'text-text-dark',
  scrolledClassName = '',
  scrolledTitleClassName = '',
  scrollThreshold = 8,
  showLogo = true,
}: GlassHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > scrollThreshold);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [scrollThreshold]);

  useEffect(() => {
    const checkStandalone = () => {
      const nav = navigator as Navigator & { standalone?: boolean };
      const standaloneByMedia =
        typeof window.matchMedia === 'function' &&
        (window.matchMedia('(display-mode: standalone)').matches ||
          window.matchMedia('(display-mode: fullscreen)').matches);
      setIsStandalone(Boolean(nav.standalone) || standaloneByMedia);
    };

    checkStandalone();
    const mq = window.matchMedia ? window.matchMedia('(display-mode: standalone)') : null;
    const onChange = () => checkStandalone();
    mq?.addEventListener?.('change', onChange);
    window.addEventListener('resize', onChange);

    return () => {
      mq?.removeEventListener?.('change', onChange);
      window.removeEventListener('resize', onChange);
    };
  }, []);

  const showStandaloneBack = isStandalone && location.pathname !== '/home';
  const standaloneTitleWords = title.trim().split(/\s+/);
  const standaloneFirstWord = standaloneTitleWords[0] ?? title;
  const standaloneRemainingWords = standaloneTitleWords.slice(1).join(' ');

  return (
    <>
      <div
        className={`fixed top-0 left-0 right-0 z-50 h-24 md:h-20 border-b border-white/45 bg-white/62 backdrop-blur-2xl transition-colors ${className} ${isScrolled ? scrolledClassName : ''}`}
      >
        <div className="h-full px-4 md:px-6 flex flex-col md:flex-row items-center justify-center relative">
          {showStandaloneBack ? (
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) navigate(-1);
                else navigate('/home');
              }}
              aria-label="Go back"
              className="md:hidden absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full border border-[rgba(55,65,81,0.22)] bg-white/72 text-text-dark inline-flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : null}
          {showLogo ? (
            <button
              type="button"
              onClick={() => navigate('/home')}
              aria-label="Go to home"
              className="md:hidden inline-flex items-center justify-center mb-1"
            >
              <img
                src="/branding/logo_name_solo.png"
                alt="Sonus"
                className="h-5 w-auto object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </button>
          ) : null}
          {showLogo ? (
            <button
              type="button"
              onClick={() => navigate('/home')}
              aria-label="Go to home"
              className="hidden md:inline-flex absolute left-6 items-center justify-center"
            >
              <img
                src="/branding/logo_name_solo.png"
                alt="Sonus"
                className="h-6 md:h-7 w-auto object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </button>
          ) : null}
          <h1
            className={`text-center main-font text-3xl md:text-4xl font-normal leading-tight transition-colors ${titleClassName} ${isScrolled ? scrolledTitleClassName : ''}`}
          >
            {showStandaloneBack && standaloneRemainingWords ? (
              <>
                <span className="block md:inline">{standaloneFirstWord}</span>
                <span className="block md:inline md:ml-2">{standaloneRemainingWords}</span>
              </>
            ) : (
              title
            )}
          </h1>
        </div>
      </div>
      <div className={`h-24 md:h-20 mb-6 ${spacerClassName}`} />
    </>
  );
}
