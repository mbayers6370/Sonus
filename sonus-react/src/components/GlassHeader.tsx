import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { toTitleCase } from '../lib/textCase';
import { getKnownLanguageLabels } from '../lib/languageRuntime';

const NATIVE_LANGUAGE_LABEL_BY_ENGLISH: Record<string, string> = {
  mandarin: '普通话',
  japanese: '日本語',
  korean: '한국어',
  french: 'Français',
  italian: 'Italiano',
  spanish: 'Español',
};

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
  compactMobile?: boolean;
  compactStandaloneTitle?: boolean;
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
  compactMobile = false,
  compactStandaloneTitle = true,
}: GlassHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [headerHeightPx, setHeaderHeightPx] = useState<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const headerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Keep header treatment responsive to scroll depth for readability and contrast.
    const onScroll = () => {
      setIsScrolled(window.scrollY > scrollThreshold);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [scrollThreshold]);

  useEffect(() => {
    // Detect PWA standalone mode on both iOS and standards-based display-mode media queries.
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

  useEffect(() => {
    // Measure live header height so page spacer stays accurate when layout wraps.
    if (!headerRef.current) return;
    const node = headerRef.current;
    const updateHeight = () => {
      setHeaderHeightPx(node.getBoundingClientRect().height);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    window.addEventListener('resize', updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [subtitle, isStandalone, showLogo, hideLogoOnMobile]);

  const showBackButton = isStandalone && location.pathname !== '/home';
  const showMobileLogo = showLogo && !isStandalone && !hideLogoOnMobile;
  const showDesktopLogo = showLogo && !isStandalone;
  const showStandaloneLogo = showLogo && isStandalone && !hideLogoOnMobile;
  const displayTitle = toTitleCase(title);
  const knownLanguageLabels = getKnownLanguageLabels();
  const isLanguageHeader = knownLanguageLabels.some(
    (label) => label.toLowerCase() === displayTitle.toLowerCase()
  );
  const nativeLanguageLabel = NATIVE_LANGUAGE_LABEL_BY_ENGLISH[displayTitle.toLowerCase()] || '';
  const centerDesktopLanguageBlock = showDesktopLogo && isLanguageHeader;
  const standaloneTitleWords = displayTitle.trim().split(/\s+/);
  const standaloneFirstWord = standaloneTitleWords[0] ?? displayTitle;
  const standaloneRemainingWords = standaloneTitleWords.slice(1).join(' ');
  const mobileHeightClass = compactMobile ? 'h-[3.4rem]' : 'h-[4.2rem]';

  return (
    <>
      <div
        ref={headerRef}
        className={`fixed top-0 left-0 right-0 z-50 border-b border-white/45 bg-white/62 backdrop-blur-2xl transition-colors ${className} ${isScrolled ? scrolledClassName : ''}`}
      >
        {showStandaloneLogo ? (
          <div className="px-4 md:px-6">
            <div className={`${mobileHeightClass} md:h-[5.15rem] flex flex-col justify-center gap-1`}>
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
                {isLanguageHeader && nativeLanguageLabel ? (
                  <div className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => navigate('/home')}
                      aria-label="Go to home"
                      className="inline-flex items-center justify-center shrink-0"
                    >
                      <img
                        src="/branding/logo_name_solo.png" srcSet="/branding/logo_name_solo-500.png 500w, /branding/logo_name_solo.png 2000w" sizes="(max-width: 768px) 160px, 240px"
                        alt="Sonus"
                        className="h-[18px] max-h-[18px] md:h-6 md:max-h-none w-auto object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </button>
                    <span className="text-text-light text-base leading-none">|</span>
                    <span className={`main-font text-[1.12rem] md:text-[1.45rem] font-medium leading-none ${titleClassName} ${isScrolled ? scrolledTitleClassName : ''}`}>
                      {displayTitle}
                    </span>
                    <span className="text-text-light text-base leading-none">|</span>
                    <span className={`secondary-font text-[0.94rem] md:text-[1.2rem] leading-none ${titleClassName} ${isScrolled ? scrolledTitleClassName : ''}`}>
                      {nativeLanguageLabel}
                    </span>
                  </div>
                ) : (
                  <>
                    {!compactStandaloneTitle ? (
                      <button
                        type="button"
                        onClick={() => navigate('/home')}
                        aria-label="Go to home"
                        className="self-center inline-flex items-center justify-center"
                      >
                        <img
                          src="/branding/logo_name_solo.png" srcSet="/branding/logo_name_solo-500.png 500w, /branding/logo_name_solo.png 2000w" sizes="(max-width: 768px) 160px, 240px"
                          alt="Sonus"
                          className="h-[18px] max-h-[18px] md:h-6 md:max-h-none w-auto object-contain"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </button>
                    ) : null}
                    <div className={`text-center ${compactStandaloneTitle ? 'mx-auto max-w-[calc(100%-4.5rem)] md:max-w-none' : ''}`}>
                      <h1
                        className={`main-font ${compactStandaloneTitle ? 'text-[1.4rem] md:text-4xl whitespace-nowrap overflow-hidden text-ellipsis' : 'text-[1.85rem] md:text-4xl'} font-normal leading-tight transition-colors ${titleClassName} ${isScrolled ? scrolledTitleClassName : ''}`}
                      >
                        {!compactStandaloneTitle && showBackButton && standaloneRemainingWords ? (
                          <>
                            <span className="block md:inline">{standaloneFirstWord}</span>
                            <span className="block md:inline md:ml-2">{standaloneRemainingWords}</span>
                          </>
                        ) : (
                          displayTitle
                        )}
                      </h1>
                      {subtitle ? (
                        <div className="sr-only" />
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </div>
            {subtitle ? (
              <div className={`pb-2 -mt-1 text-center ${subtitleClassName}`}>
                {subtitle}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="px-4 md:px-6">
            <div className={`${mobileHeightClass} md:h-[5.15rem] flex flex-col items-center justify-center relative`}>
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
            {showMobileLogo && !isLanguageHeader ? (
              <button
                type="button"
                onClick={() => navigate('/home')}
                aria-label="Go to home"
                className="md:hidden inline-flex items-center justify-center mb-1"
              >
                <img
                  src="/branding/logo_name_solo.png" srcSet="/branding/logo_name_solo-500.png 500w, /branding/logo_name_solo.png 2000w" sizes="(max-width: 768px) 160px, 240px"
                  alt="Sonus"
                  className="h-[18px] max-h-[18px] w-auto object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              </button>
            ) : null}
            {showDesktopLogo && !centerDesktopLanguageBlock ? (
              <button
                type="button"
                onClick={() => navigate('/home')}
                aria-label="Go to home"
                className="hidden md:inline-flex absolute left-6 items-center justify-center"
              >
                <img
                  src="/branding/logo_name_solo.png" srcSet="/branding/logo_name_solo-500.png 500w, /branding/logo_name_solo.png 2000w" sizes="(max-width: 768px) 160px, 240px"
                  alt="Sonus"
                  className="h-6 md:h-7 w-auto object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              </button>
            ) : null}
            <div className="text-center">
              {isLanguageHeader && nativeLanguageLabel ? (
                <div className="md:hidden inline-flex items-center justify-center gap-1.5 whitespace-nowrap absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <button
                    type="button"
                    onClick={() => navigate('/home')}
                    aria-label="Go to home"
                    className="inline-flex items-center justify-center shrink-0"
                  >
                    <img
                      src="/branding/logo_name_solo.png" srcSet="/branding/logo_name_solo-500.png 500w, /branding/logo_name_solo.png 2000w" sizes="(max-width: 768px) 160px, 240px"
                      alt="Sonus"
                      className="h-[18px] max-h-[18px] w-auto object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </button>
                  <span className="text-text-light text-base leading-none">|</span>
                  <span className={`main-font text-[1.12rem] font-medium leading-none ${titleClassName} ${isScrolled ? scrolledTitleClassName : ''}`}>
                    {displayTitle}
                  </span>
                  <span className="text-text-light text-base leading-none">|</span>
                  <span className={`secondary-font text-[0.94rem] leading-none ${titleClassName} ${isScrolled ? scrolledTitleClassName : ''}`}>
                    {nativeLanguageLabel}
                  </span>
                </div>
              ) : null}
              {centerDesktopLanguageBlock ? (
                <div className="hidden md:flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/home')}
                    aria-label="Go to home"
                    className="inline-flex items-center justify-center"
                  >
                    <img
                      src="/branding/logo_name_solo.png" srcSet="/branding/logo_name_solo-500.png 500w, /branding/logo_name_solo.png 2000w" sizes="(max-width: 768px) 160px, 240px"
                      alt="Sonus"
                      className="h-6 lg:h-7 w-auto object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </button>
                  <span className="text-text-light text-xl leading-none">|</span>
                <h1
                  className={`main-font text-[0.92rem] lg:text-[1.45rem] font-normal leading-tight transition-colors ${titleClassName} ${isScrolled ? scrolledTitleClassName : ''}`}
                >
                  <span className="text-[1.02rem] lg:text-[1.55rem] font-medium">{displayTitle}</span>
                  {nativeLanguageLabel ? (
                    <>
                      <span className="mx-2 text-text-light">|</span>
                      <span className="secondary-font text-[0.84rem] lg:text-[1.2rem]">{nativeLanguageLabel}</span>
                    </>
                  ) : null}
                </h1>
                </div>
              ) : null}
              <h1
                className={`main-font text-[1.85rem] md:text-4xl font-normal leading-tight transition-colors ${titleClassName} ${isScrolled ? scrolledTitleClassName : ''} ${centerDesktopLanguageBlock ? 'md:hidden' : ''} ${isLanguageHeader ? 'hidden' : ''}`}
              >
                {isLanguageHeader && nativeLanguageLabel
                  ? `${displayTitle} | ${nativeLanguageLabel}`
                  : displayTitle}
              </h1>
              {subtitle ? (
                <div className="sr-only" />
              ) : null}
            </div>
            </div>
            {subtitle ? (
              <div className={`pb-2 -mt-1 text-center ${subtitleClassName}`}>
                {subtitle}
              </div>
            ) : null}
          </div>
        )}
      </div>
      <div
        className={`${spacerClassName || 'mb-2'}`}
        style={{ height: headerHeightPx ?? 68 }}
      />
    </>
  );
}
