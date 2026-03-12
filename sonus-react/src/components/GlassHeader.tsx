import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronLeft,
  FolderKanban,
  House,
  Layers3,
  ListChecks,
  LogOut,
} from 'lucide-react';
import { toTitleCase } from '../lib/textCase';
import { getKnownLanguageLabels, getLanguageRuntime, normalizeLanguageId } from '../lib/languageRuntime';
import { useAuth } from '../contexts/AuthContext';
import { resolveLearnQuickStage } from '../lib/learnPath';

const NATIVE_LANGUAGE_LABEL_BY_ENGLISH: Record<string, string> = {
  japanese: '日本語',
  korean: '한국어',
  french: 'Français',
  italian: 'Italiano',
  spanish: 'Español',
};
const LANGUAGE_ID_BY_ENGLISH: Record<string, string> = {
  japanese: 'ja',
  korean: 'kr',
  french: 'fr',
  italian: 'it',
  spanish: 'es',
};
const NATIVE_LANGUAGE_LABEL_BY_ID: Record<string, string> = {
  ja: '日本語',
  kr: '한국어',
  fr: 'Français',
  it: 'Italiano',
  es: 'Español',
};
const LAST_LANGUAGE_KEY = 'sonus.last_language';

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
  const { signOut, isDemo } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [headerHeightPx, setHeaderHeightPx] = useState<number | null>(null);
  const [desktopLearnMenuOpenRouteKey, setDesktopLearnMenuOpenRouteKey] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const headerRef = useRef<HTMLDivElement | null>(null);
  const desktopLearnMenuRef = useRef<HTMLDivElement | null>(null);

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

  const routeKey = `${location.pathname}${location.search}`;
  const desktopLearnMenuOpen = desktopLearnMenuOpenRouteKey === routeKey;

  useEffect(() => {
    if (!desktopLearnMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!desktopLearnMenuRef.current || !target) return;
      if (!desktopLearnMenuRef.current.contains(target)) {
        setDesktopLearnMenuOpenRouteKey(null);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDesktopLearnMenuOpenRouteKey(null);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, [desktopLearnMenuOpen]);

  const showBackButton = isStandalone && location.pathname !== '/home';
  const showMobileLogo = showLogo && !isStandalone && !hideLogoOnMobile;
  const showDesktopLogo = showLogo && !isStandalone;
  const showStandaloneLogo = showLogo && isStandalone && !hideLogoOnMobile;
  const displayTitle = toTitleCase(title);
  const knownLanguageLabels = getKnownLanguageLabels();
  const isLanguageHeader = knownLanguageLabels.some(
    (label) => label.toLowerCase() === displayTitle.toLowerCase()
  );
  const titleNativeLanguageLabel = NATIVE_LANGUAGE_LABEL_BY_ENGLISH[displayTitle.toLowerCase()] || '';
  const resolvedLanguageId = useMemo(() => {
    const fromTitle = Object.entries(NATIVE_LANGUAGE_LABEL_BY_ENGLISH).find(
      ([englishLabel]) => englishLabel === displayTitle.toLowerCase()
    );
    if (fromTitle) {
      return LANGUAGE_ID_BY_ENGLISH[fromTitle[0]] || null;
    }
    try {
      const value = window.localStorage.getItem(LAST_LANGUAGE_KEY);
      if (!value) return null;
      return normalizeLanguageId(value);
    } catch {
      return null;
    }
  }, [displayTitle]);
  const resolvedLanguageLabel = resolvedLanguageId ? getLanguageRuntime(resolvedLanguageId).label : '';
  const resolvedNativeLanguageLabel = resolvedLanguageId
    ? (NATIVE_LANGUAGE_LABEL_BY_ID[resolvedLanguageId] || '')
    : titleNativeLanguageLabel;
  const showLanguagePill = Boolean(resolvedLanguageLabel && resolvedNativeLanguageLabel);
  const centerDesktopLanguageBlock = showDesktopLogo && isLanguageHeader;
  const standaloneTitleWords = displayTitle.trim().split(/\s+/);
  const standaloneFirstWord = standaloneTitleWords[0] ?? displayTitle;
  const standaloneRemainingWords = standaloneTitleWords.slice(1).join(' ');
  const mobileHeightClass = compactMobile ? 'h-[3.4rem]' : 'h-[4.2rem]';
  const isDesktopAppNavPath = useMemo(
    () => /^\/(home|learn|travel|profile|about)(\/|$)/.test(location.pathname),
    [location.pathname]
  );
  const showDesktopCenterNav = !isStandalone && isDesktopAppNavPath;
  const desktopLearnStage = resolveLearnQuickStage(location.pathname, location.search);
  const desktopHomeActive = location.pathname === '/home' || location.pathname.startsWith('/travel');
  const desktopProfileActive = location.pathname.startsWith('/profile') || location.pathname.startsWith('/about');
  const desktopLessonsActive = location.pathname.startsWith('/learn');
  const desktopTitleHiddenByNav = showDesktopCenterNav && !isStandalone;
  const useLightDesktopChrome =
    /(?:^|\s)text-white(?:\s|$)/.test(`${titleClassName} ${scrolledTitleClassName}`) ||
    /(?:^|\s)border-white(?:\s|$)/.test(`${className} ${scrolledClassName}`);
  const headerLogoSrc = useLightDesktopChrome
    ? '/branding/Sonus-White-Transparent.png'
    : '/branding/logo_name_solo.png';
  const headerLogoSrcSet = useLightDesktopChrome
    ? '/branding/Sonus-White-Transparent-500.png 500w, /branding/Sonus-White-Transparent.png 1000w'
    : '/branding/logo_name_solo-500.png 500w, /branding/logo_name_solo.png 2000w';

  const runDesktopLearnAction = (target: 'main' | 'levels' | 'units' | 'lessons') => {
    setDesktopLearnMenuOpenRouteKey(null);
    if (target === 'main') {
      window.dispatchEvent(new CustomEvent('sonus:learn:main'));
      return;
    }
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

  const desktopNavLinkClass = (active: boolean) =>
    `inline-flex relative h-11 items-center px-5 text-[1.03rem] transition-colors ${
      active
        ? (
            useLightDesktopChrome
              ? 'text-white font-semibold'
              : 'text-[#15364A] font-semibold'
          )
        : (useLightDesktopChrome ? 'text-white hover:text-white' : 'text-text-med hover:text-text-dark')
    }`;

  const desktopLearnItemClass = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[0.95rem] transition-colors ${
      active
        ? (useLightDesktopChrome ? 'bg-white/18 text-white' : 'bg-[rgba(24,110,149,0.12)] text-[#144E6A]')
        : (useLightDesktopChrome ? 'text-white/88 hover:bg-white/12' : 'text-text-dark hover:bg-[rgba(15,23,42,0.06)]')
    }`;

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
                    className={`absolute left-0 md:left-2 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 rounded-full border inline-flex items-center justify-center ${
                      useLightDesktopChrome
                        ? 'border-white/45 bg-white/10 text-white'
                        : 'border-[rgba(31,42,55,0.22)] bg-white/72 text-text-dark'
                    }`}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                ) : null}
                {isLanguageHeader && titleNativeLanguageLabel ? (
                  <div className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => navigate('/home')}
                      aria-label="Go to home"
                      className="inline-flex items-center justify-center shrink-0"
                    >
                      <img
                        src={headerLogoSrc} srcSet={headerLogoSrcSet} sizes="(max-width: 768px) 160px, 240px" width={2000} height={500}
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
                      {titleNativeLanguageLabel}
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
                          src={headerLogoSrc} srcSet={headerLogoSrcSet} sizes="(max-width: 768px) 160px, 240px" width={2000} height={500}
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
                className={`absolute left-3 md:left-6 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 rounded-full border inline-flex items-center justify-center ${
                  useLightDesktopChrome
                    ? 'border-white/45 bg-white/10 text-white'
                    : 'border-[rgba(31,42,55,0.22)] bg-white/72 text-text-dark'
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : null}
            {showMobileLogo && !isLanguageHeader ? (
              <button
                type="button"
                onClick={() => navigate('/home')}
                aria-label="Go to home"
                className="min-[951px]:hidden inline-flex items-center justify-center mb-1"
              >
                <img
                  src={headerLogoSrc} srcSet={headerLogoSrcSet} sizes="(max-width: 768px) 160px, 240px" width={2000} height={500}
                  alt="Sonus"
                  className="h-[18px] max-h-[18px] w-auto object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              </button>
            ) : null}
            {showDesktopLogo && (!centerDesktopLanguageBlock || showDesktopCenterNav) ? (
              <button
                type="button"
                onClick={() => navigate('/home')}
                aria-label="Go to home"
                className="hidden min-[951px]:inline-flex absolute left-6 items-center justify-center"
              >
                <img
                  src={headerLogoSrc} srcSet={headerLogoSrcSet} sizes="(max-width: 768px) 160px, 240px" width={2000} height={500}
                  alt="Sonus"
                  className="h-6 md:h-7 w-auto object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              </button>
            ) : null}
            {showDesktopCenterNav ? (
              <div className="hidden min-[951px]:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
                <div className="relative inline-flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => navigate('/home')}
                    className={desktopNavLinkClass(desktopHomeActive)}
                    aria-current={desktopHomeActive ? 'page' : undefined}
                  >
                    <span className="relative z-[1] inline-flex items-center justify-center px-1">
                      {desktopHomeActive ? (
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 font-mono text-[0.95rem] ${
                            useLightDesktopChrome ? 'text-white/42' : 'text-[#186E95]/42'
                          }`}
                        >
                          [
                        </span>
                      ) : null}
                      <span className="relative z-[1] px-2">Home</span>
                      {desktopHomeActive ? (
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 font-mono text-[0.95rem] ${
                            useLightDesktopChrome ? 'text-white/42' : 'text-[#186E95]/42'
                          }`}
                        >
                          ]
                        </span>
                      ) : null}
                    </span>
                  </button>
                  <div ref={desktopLearnMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setDesktopLearnMenuOpenRouteKey((openKey) =>
                          openKey === routeKey ? null : routeKey
                        )
                      }
                      className={desktopNavLinkClass(desktopLessonsActive)}
                      aria-expanded={desktopLearnMenuOpen}
                      aria-haspopup="menu"
                    >
                      <span className="relative z-[1] inline-flex items-center justify-center px-1">
                        {desktopLessonsActive ? (
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 font-mono text-[0.95rem] ${
                              useLightDesktopChrome ? 'text-white/42' : 'text-[#186E95]/42'
                            }`}
                          >
                            [
                          </span>
                        ) : null}
                        {desktopLessonsActive ? (
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 font-mono text-[0.95rem] ${
                              useLightDesktopChrome ? 'text-white/42' : 'text-[#186E95]/42'
                            }`}
                          >
                            ]
                          </span>
                        ) : null}
                        <span className="relative z-[1] px-2">Lessons</span>
                      </span>
                      <ChevronDown className="ml-1.5 h-4 w-4" />
                    </button>
                    {desktopLearnMenuOpen ? (
                      <div
                        className={`absolute left-1/2 top-[calc(100%+0.6rem)] z-[75] w-56 -translate-x-1/2 rounded-xl p-2 shadow-[0_24px_48px_-28px_rgba(15,23,42,0.45)] ${
                          useLightDesktopChrome
                            ? 'border border-white/30 bg-[#223447]/94'
                            : 'border border-[rgba(31,42,55,0.12)] bg-[#FDFDFB]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => runDesktopLearnAction('main')}
                          className={desktopLearnItemClass(desktopLearnStage === 'main')}
                        >
                          <House className="h-4 w-4" />
                          <span>Main</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => runDesktopLearnAction('levels')}
                          className={desktopLearnItemClass(desktopLearnStage === 'levels')}
                        >
                          <Layers3 className="h-4 w-4" />
                          <span>Levels</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => runDesktopLearnAction('units')}
                          className={desktopLearnItemClass(desktopLearnStage === 'units')}
                        >
                          <FolderKanban className="h-4 w-4" />
                          <span>Units</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => runDesktopLearnAction('lessons')}
                          className={desktopLearnItemClass(desktopLearnStage === 'lessons')}
                        >
                          <ListChecks className="h-4 w-4" />
                          <span>Lessons</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/profile')}
                    className={desktopNavLinkClass(desktopProfileActive)}
                    aria-current={desktopProfileActive ? 'page' : undefined}
                  >
                    <span className="relative z-[1] inline-flex items-center justify-center px-1">
                      {desktopProfileActive ? (
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 font-mono text-[0.95rem] ${
                            useLightDesktopChrome ? 'text-white/42' : 'text-[#186E95]/42'
                          }`}
                        >
                          [
                        </span>
                      ) : null}
                      <span className="relative z-[1] px-2">Profile</span>
                      {desktopProfileActive ? (
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 font-mono text-[0.95rem] ${
                            useLightDesktopChrome ? 'text-white/42' : 'text-[#186E95]/42'
                          }`}
                        >
                          ]
                        </span>
                      ) : null}
                    </span>
                  </button>
                </div>
              </div>
            ) : null}
            {showDesktopCenterNav || showLanguagePill ? (
              <div className="hidden min-[951px]:flex absolute right-6 top-1/2 -translate-y-1/2 items-center gap-2">
                {showLanguagePill ? (
                  <span
                    className={`main-font inline-flex h-11 items-center gap-1.5 rounded-xl border px-4 text-[0.85rem] ${
                      useLightDesktopChrome
                        ? 'border-white/70 bg-white/8 text-white'
                        : 'border-[#1F2A37]/40 bg-white/90 text-[#1F2A37]'
                    }`}
                  >
                    <span>{resolvedLanguageLabel}</span>
                    <span className={useLightDesktopChrome ? 'text-white/72' : 'text-[#1F2A37]/55'}>|</span>
                    <span>{resolvedNativeLanguageLabel}</span>
                  </span>
                ) : null}
                {showDesktopCenterNav ? (
                  <button
                    type="button"
                    onClick={signOut}
                    className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-[1rem] transition-colors ${
                      useLightDesktopChrome
                        ? 'border-white/45 bg-white/8 text-white hover:bg-white/14'
                        : 'border-[rgba(31,42,55,0.14)] bg-white/72 text-text-dark hover:bg-white'
                    }`}
                    aria-label={isDemo ? 'Exit Demo' : 'Sign Out'}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{isDemo ? 'Exit Demo' : 'Sign Out'}</span>
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="text-center">
              {isLanguageHeader && titleNativeLanguageLabel ? (
                <div className="min-[951px]:hidden inline-flex items-center justify-center gap-1.5 whitespace-nowrap absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <button
                    type="button"
                    onClick={() => navigate('/home')}
                    aria-label="Go to home"
                    className="inline-flex items-center justify-center shrink-0"
                  >
                    <img
                      src={headerLogoSrc} srcSet={headerLogoSrcSet} sizes="(max-width: 768px) 160px, 240px" width={2000} height={500}
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
                      {titleNativeLanguageLabel}
                    </span>
                  </div>
                ) : null}
              {centerDesktopLanguageBlock && !desktopTitleHiddenByNav ? (
                <div className="hidden min-[951px]:flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/home')}
                    aria-label="Go to home"
                    className="inline-flex items-center justify-center"
                  >
                    <img
                      src={headerLogoSrc} srcSet={headerLogoSrcSet} sizes="(max-width: 768px) 160px, 240px" width={2000} height={500}
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
                  {titleNativeLanguageLabel ? (
                    <>
                      <span className="mx-2 text-text-light">|</span>
                      <span className="secondary-font text-[0.84rem] lg:text-[1.2rem]">{titleNativeLanguageLabel}</span>
                    </>
                  ) : null}
                </h1>
                </div>
              ) : null}
              <h1
                className={`main-font text-[1.85rem] md:text-4xl font-normal leading-tight transition-colors ${titleClassName} ${isScrolled ? scrolledTitleClassName : ''} ${centerDesktopLanguageBlock ? 'min-[951px]:hidden' : ''} ${isLanguageHeader ? 'hidden' : ''} ${desktopTitleHiddenByNav ? 'min-[951px]:hidden' : ''}`}
              >
                {isLanguageHeader && titleNativeLanguageLabel
                  ? `${displayTitle} | ${titleNativeLanguageLabel}`
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
      {showDesktopCenterNav ? (
        <div className="hidden lg:block fixed bottom-0 left-0 right-0 z-40 border-t border-white/45 bg-[#2B3440]/95 backdrop-blur-xl">
          <div className="mx-auto flex h-8 max-w-[1600px] items-center justify-center gap-2 px-4 text-[0.58rem] leading-none font-light text-[#C7D0DC]">
            <Link to="/privacy" className="underline-offset-2 hover:underline font-mono">
              Privacy
            </Link>
            <span aria-hidden="true">|</span>
            <Link to="/terms" className="underline-offset-2 hover:underline font-mono">
              Terms
            </Link>
            <span aria-hidden="true">|</span>
            <Link to="/contact" className="underline-offset-2 hover:underline font-mono">
              Contact
            </Link>
            <span aria-hidden="true">|</span>
            <Link to="/attributions" className="underline-offset-2 hover:underline font-mono">
              Attributions
            </Link>
            <span aria-hidden="true">|</span>
            <span className="font-mono">© {new Date().getFullYear()} Sonus</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
