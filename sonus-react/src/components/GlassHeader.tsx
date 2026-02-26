import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { toTitleCase } from '../lib/textCase';

interface GlassHeaderProps {
  title: string;
  subtitle?: ReactNode;
  className?: string;
  spacerClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  scrolledClassName?: string;
  scrolledTitleClassName?: string;
  scrollThreshold?: number;
  showLogo?: boolean;
  hideLogoOnMobile?: boolean;
}

export default function GlassHeader({
  title,
  subtitle,
  className = '',
  spacerClassName = '',
  titleClassName = 'text-text-dark',
  subtitleClassName = 'text-text-med',
  scrolledClassName = '',
  scrolledTitleClassName = '',
  scrollThreshold = 8,
  showLogo = true,
  hideLogoOnMobile = false,
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

  const showBackButton = isStandalone && location.pathname !== '/home';
  const showMobileLogo = showLogo && !isStandalone && !hideLogoOnMobile;
  const showDesktopLogo = showLogo && !isStandalone;
  const showStandaloneLogo = showLogo && isStandalone && !hideLogoOnMobile;
  const headerHeightClass = showStandaloneLogo ? 'h-28 md:h-24' : 'h-24 md:h-20';
  const displayTitle = toTitleCase(title);
  const standaloneTitleWords = displayTitle.trim().split(/\s+/);
  const standaloneFirstWord = standaloneTitleWords[0] ?? displayTitle;
  const standaloneRemainingWords = standaloneTitleWords.slice(1).join(' ');

  return (
    <>
      <div
        className={`fixed top-0 left-0 right-0 z-50 ${headerHeightClass} border-b border-white/45 bg-white/62 backdrop-blur-2xl transition-colors ${className} ${isScrolled ? scrolledClassName : ''}`}
      >
        {showStandaloneLogo ? (
          <div className="h-full px-4 md:px-6 flex flex-col justify-center gap-1.5">
            <button
              type="button"
              onClick={() => navigate('/home')}
              aria-label="Go to home"
              className="self-center inline-flex items-center justify-center"
            >
              <img
                src="/branding/logo_name_solo.png"
                alt="Sonus"
                className="h-5 md:h-6 w-auto object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </button>
            <div className="relative flex items-center justify-center">
              {showBackButton ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.history.length > 1) navigate(-1);
                    else navigate('/home');
                  }}
                  aria-label="Go back"
                  className="absolute left-0 md:left-2 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 rounded-full border border-[rgba(31,42,55,0.22)] bg-white/72 text-text-dark inline-flex items-center justify-center"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              ) : null}
              <div className="text-center">
                <h1
                  className={`main-font text-3xl md:text-4xl font-normal leading-tight transition-colors ${titleClassName} ${isScrolled ? scrolledTitleClassName : ''}`}
                >
                  {showBackButton && standaloneRemainingWords ? (
                    <>
                      <span className="block md:inline">{standaloneFirstWord}</span>
                      <span className="block md:inline md:ml-2">{standaloneRemainingWords}</span>
                    </>
                  ) : (
                    displayTitle
                  )}
                </h1>
                {subtitle ? (
                  <div className={`mt-1 ${subtitleClassName}`}>
                    {subtitle}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full px-4 md:px-6 flex flex-col items-center justify-center relative">
            {showBackButton ? (
              <button
                type="button"
                onClick={() => {
                  if (window.history.length > 1) navigate(-1);
                  else navigate('/home');
                }}
                aria-label="Go back"
                className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 rounded-full border border-[rgba(31,42,55,0.22)] bg-white/72 text-text-dark inline-flex items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : null}
            {showMobileLogo ? (
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
            {showDesktopLogo ? (
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
            <div className="text-center">
              <h1
                className={`main-font text-3xl md:text-4xl font-normal leading-tight transition-colors ${titleClassName} ${isScrolled ? scrolledTitleClassName : ''}`}
              >
                {displayTitle}
              </h1>
              {subtitle ? (
                <div className={`mt-1 ${subtitleClassName}`}>
                  {subtitle}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
      <div className={`${headerHeightClass} mb-6 ${spacerClassName}`} />
    </>
  );
}
