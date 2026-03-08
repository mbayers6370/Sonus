import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import type { LessonBand, LessonMode } from '../types/lesson.types';
import { LEVEL_BY_ID, isMandarinBandLocked, tierForBand } from './lessonRouting';
import { apiFetch } from '../lib/apiClient';
import {
  getLanguageRuntime,
  normalizeBandDataPayload,
  normalizeLanguageId,
  resolveBandDataPath,
} from '../lib/languageRuntime';
import { readCachedCurrentPath, writeCachedCurrentPath } from '../lib/currentPathStore';
import { deriveJapaneseSectionIdFromUnitId } from '../lib/learnPath';
import { completeOnboardingWalkthrough } from '../lib/backendApi';
import GlassLoader from '../components/ui/GlassLoader';
import FirstTimeWalkthrough from '../components/FirstTimeWalkthrough';
import PrivacyPage from '../components/public/PrivacyPage';
import TermsPage from '../components/public/TermsPage';
import ContactPage from '../components/public/ContactPage';
import AttributionsPage from '../components/public/AttributionsPage';
import { isCheckpointUnitId, isPracticeUnitId } from '../data/unitMetadata';

const LevelSelect = lazy(() => import('../components/LevelSelect'));
const UnitSelect = lazy(() => import('../components/UnitSelect'));
const AboutSonusScreen = lazy(() => import('../components/AboutSonusScreen'));
const ProfileProgressScreen = lazy(() => import('../components/ProfileProgressScreen'));
const JapaneseIntroScreen = lazy(() => import('../components/JapaneseIntroScreen'));
const JapaneseKanaChartScreen = lazy(() => import('../components/JapaneseKanaChartScreen'));
const LessonRouteController = lazy(() => import('./LessonRouteController'));
const LanguageRoute = lazy(() => import('./homeRoutes').then((m) => ({ default: m.LanguageRoute })));
const HomeRoute = lazy(() => import('./homeRoutes').then((m) => ({ default: m.HomeRoute })));
const CharactersRoute = lazy(() => import('./foundationRoutes').then((m) => ({ default: m.CharactersRoute })));
const FoundationsRoute = lazy(() => import('./foundationRoutes').then((m) => ({ default: m.FoundationsRoute })));
const PinyinRoute = lazy(() => import('./foundationRoutes').then((m) => ({ default: m.PinyinRoute })));
const TonesRoute = lazy(() => import('./foundationRoutes').then((m) => ({ default: m.TonesRoute })));
const ProfileRoute = lazy(() => import('./profileTravelRoutes').then((m) => ({ default: m.ProfileRoute })));
const TravelRoute = lazy(() => import('./profileTravelRoutes').then((m) => ({ default: m.TravelRoute })));
const TravelSectionRoute = lazy(() => import('./profileTravelRoutes').then((m) => ({ default: m.TravelSectionRoute })));
const SupportConsolePage = lazy(() => import('../components/internal/SupportConsolePage'));

const LAST_LANGUAGE_KEY = 'sonus.last_language';
const WALKTHROUGH_DONE_PREFIX = 'sonus.walkthrough.done:';
const STARTER_BAND_BY_LANGUAGE: Record<string, string> = {
  zh: 'band1',
  ja: 'n5',
  kr: 'topik1-1',
  fr: 'a1',
  it: 'a1',
  es: 'a1',
};

const isMandarinLevel = (levelId: string) => /^band\d+$/i.test(levelId) || levelId === 'advanced';
const isJapaneseLevel = (levelId: string) => /^n[1-5]$/i.test(levelId);
const levelMatchesLanguage = (levelId: string, languageId: string | null) => {
  if (!languageId) return true;
  const normalizedLanguage = normalizeLanguageId(languageId);
  if (normalizedLanguage === 'zh') return isMandarinLevel(levelId);
  if (normalizedLanguage === 'ja') return isJapaneseLevel(levelId);
  return true;
};

function readLastLanguage(): string | null {
  try {
    const value = window.localStorage.getItem(LAST_LANGUAGE_KEY);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

function writeLastLanguage(languageId: string) {
  try {
    window.localStorage.setItem(LAST_LANGUAGE_KEY, languageId);
  } catch {
    // Ignore storage failures.
  }
}

function walkthroughStorageKey(email: string | null) {
  const scope = (email || 'anon').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_');
  return `${WALKTHROUGH_DONE_PREFIX}${scope}`;
}

function readWalkthroughComplete(email: string | null) {
  try {
    return window.localStorage.getItem(walkthroughStorageKey(email)) === '1';
  } catch {
    return false;
  }
}

function writeWalkthroughComplete(email: string | null) {
  try {
    window.localStorage.setItem(walkthroughStorageKey(email), '1');
  } catch {
    // Ignore storage failures.
  }
}

export default function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const { email, isDemo } = useAuth();
  const [languageResolved, setLanguageResolved] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState<'loading' | 'complete' | 'incomplete'>('loading');
  const [walkthroughVisible, setWalkthroughVisible] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [walkthroughSaving, setWalkthroughSaving] = useState(false);
  const [walkthroughHighlightRect, setWalkthroughHighlightRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
    borderRadius: string;
  } | null>(null);
  const walkthroughHighlightRectRef = useRef<{
    top: number;
    left: number;
    width: number;
    height: number;
    borderRadius: string;
  } | null>(null);
  const walkthroughStartedRef = useRef(false);
  const [tourRoutes, setTourRoutes] = useState<{
    mainPath: string;
    levelsPath: string;
    unitsPath: string;
    lessonsPath: string;
    hasStructuredTour: boolean;
    languageLabel: string;
  }>({
    mainPath: '/learn',
    levelsPath: '/learn',
    unitsPath: '/learn',
    lessonsPath: '/learn',
    hasStructuredTour: false,
    languageLabel: 'Language',
  });
  const {
    state,
    selectLanguage,
    selectLevel,
    openLessonPath,
    exitLesson,
    generateDailyReviewSet,
  } = useApp();
  const { selectedLanguage, currentLevel } = state;

  useEffect(() => {
    if (isDemo) {
      // Demo users always see the walkthrough at session start.
      setOnboardingStatus('incomplete');
      return;
    }
    if (readWalkthroughComplete(email)) {
      setOnboardingStatus('complete');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await apiFetch('/v1/me/profile');
        if (!response.ok) {
          if (!cancelled) setOnboardingStatus('complete');
          return;
        }
        const payload = (await response.json()) as { profile?: { onboardingComplete?: boolean } };
        if (cancelled) return;
        setOnboardingStatus(payload.profile?.onboardingComplete ? 'complete' : 'incomplete');
      } catch {
        if (!cancelled) setOnboardingStatus('complete');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [email, isDemo]);

  useEffect(() => {
    let cancelled = false;

    if (selectedLanguage) {
      setLanguageResolved(true);
      return () => {
        cancelled = true;
      };
    }

    setLanguageResolved(false);

    const cachedLanguage = readLastLanguage();
    if (cachedLanguage) {
      selectLanguage(cachedLanguage);
      navigate('/home', { replace: true });
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const response = await apiFetch('/v1/me/profile');
        if (!response.ok) {
          if (!cancelled) setLanguageResolved(true);
          return;
        }
        const payload = (await response.json()) as { profile?: { targetLanguage?: string | null } };
        const profileLanguage = payload.profile?.targetLanguage;
        if (!cancelled && typeof profileLanguage === 'string' && profileLanguage.trim()) {
          const resolvedLanguage = profileLanguage.trim();
          writeLastLanguage(resolvedLanguage);
          selectLanguage(resolvedLanguage);
          navigate('/home', { replace: true });
          return;
        }
      } catch {
        // Fall back to onboarding language selection.
      }

      if (!cancelled) setLanguageResolved(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedLanguage, navigate, selectLanguage]);

  useEffect(() => {
    if (!selectedLanguage) return;
    writeLastLanguage(selectedLanguage);
  }, [selectedLanguage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const { scrollRestoration } = window.history;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = scrollRestoration;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Keep navigation deterministic on mobile: every route starts from the top.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search]);

  const goHome = useCallback(() => {
    exitLesson();
    void selectLevel(null);
    navigate('/home');
  }, [exitLesson, navigate, selectLevel]);

  const goProfile = useCallback(() => {
    exitLesson();
    navigate('/profile');
  }, [exitLesson, navigate]);

  const resolveFallbackBandId = useCallback(() => {
    const normalizedLanguage = normalizeLanguageId(selectedLanguage);
    if (normalizedLanguage === 'ja') return 'n5';
    if (normalizedLanguage === 'zh') return 'band1';
    return null;
  }, [selectedLanguage]);

  const resolveContinueLearnTarget = useCallback(async () => {
    const normalizedLanguage = normalizeLanguageId(selectedLanguage);
    try {
      const response = await apiFetch('/v1/me/progress');
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        progress?: {
          currentBandId?: string | null;
          currentUnitId?: string | null;
          currentLessonIdx?: number | null;
        };
      };
      const bandId = payload.progress?.currentBandId || null;
      const unitId = payload.progress?.currentUnitId || null;
      const lessonIdx = payload.progress?.currentLessonIdx ?? 0;
      if (!bandId || !unitId) return null;
      if (!levelMatchesLanguage(bandId, normalizedLanguage)) return null;
      const level = LEVEL_BY_ID[bandId];
      if (!level || isMandarinBandLocked(level.id, state.unlockedLevels)) return null;
      if (isPracticeUnitId(unitId) || isCheckpointUnitId(unitId) || unitId === 'daily-review') return null;
      writeCachedCurrentPath({ bandId, unitId, lessonIndex: Math.max(0, lessonIdx) });
      return {
        bandId,
        unitId,
        lessonIdx: Math.max(0, lessonIdx),
      };
    } catch {
      const fallback = readCachedCurrentPath(selectedLanguage);
      if (!fallback) return null;
      if (!levelMatchesLanguage(fallback.bandId, normalizedLanguage)) return null;
      const level = LEVEL_BY_ID[fallback.bandId];
      if (!level || isMandarinBandLocked(level.id, state.unlockedLevels)) return null;
      if (
        isPracticeUnitId(fallback.unitId) ||
        isCheckpointUnitId(fallback.unitId) ||
        fallback.unitId === 'daily-review'
      ) {
        return null;
      }
      return {
        bandId: fallback.bandId,
        unitId: fallback.unitId,
        lessonIdx: fallback.lessonIndex,
      };
    }
  }, [selectedLanguage, state.unlockedLevels]);

  const navigateLearnStage = useCallback(async (stage: 'main' | 'levels' | 'units' | 'lessons') => {
    exitLesson();
    if (!selectedLanguage) {
      navigate('/');
      return;
    }
    const normalizedLanguage = normalizeLanguageId(selectedLanguage);
    if (stage === 'main') {
      navigate('/learn');
      return;
    }

    const continueTarget = await resolveContinueLearnTarget();
    const fallbackBandId = resolveFallbackBandId();
    const bandId = continueTarget?.bandId || fallbackBandId;
    if (!bandId) {
      navigate('/learn');
      return;
    }

    // Japanese has a 4-step hierarchy: Main -> Levels(N5..N1) -> Units(Section) -> Lessons(Unit)
    if (normalizedLanguage === 'ja' && /^n[1-5]$/i.test(bandId)) {
      const basePath = `/learn/jlpt/${bandId}`;
      const currentBandSections =
        state.currentLevel?.id === bandId && Array.isArray(state.activeBandData?.sections)
          ? state.activeBandData.sections
          : [];
      const primarySection =
        currentBandSections.find((section) => section.id === 'core') ||
        currentBandSections[0] ||
        null;
      const fallbackUnitId =
        (Array.isArray(primarySection?.unitIds) ? primarySection?.unitIds?.[0] : null) ||
        `${bandId}-core-01`;
      const unitId = continueTarget?.unitId || fallbackUnitId;
      const sectionId = deriveJapaneseSectionIdFromUnitId(bandId, unitId) || 'core';

      if (stage === 'levels') {
        navigate(basePath);
        return;
      }
      if (stage === 'units') {
        navigate(sectionId ? `${basePath}?section=${encodeURIComponent(sectionId)}` : basePath);
        return;
      }
      const params = new URLSearchParams();
      if (sectionId) params.set('section', sectionId);
      if (unitId) params.set('unit', unitId);
      const query = params.toString();
      navigate(query ? `${basePath}?${query}` : basePath);
      return;
    }

    if (stage === 'levels') {
      const tier = tierForBand(bandId);
      navigate(tier ? `/learn?tier=${encodeURIComponent(tier)}` : '/learn');
      return;
    }

    const basePath = `/learn/${tierForBand(bandId)}/${bandId}`;
    if (stage === 'units') {
      navigate(basePath);
      return;
    }

    const unitId = continueTarget?.unitId || null;
    navigate(unitId ? `${basePath}?unit=${encodeURIComponent(unitId)}` : basePath);
  }, [
    exitLesson,
    navigate,
    resolveFallbackBandId,
    resolveContinueLearnTarget,
    selectedLanguage,
    state.activeBandData?.sections,
    state.currentLevel?.id,
  ]);

  const goLearnMain = useCallback(() => {
    void navigateLearnStage('main');
  }, [navigateLearnStage]);

  const goLearnLevels = useCallback(() => {
    void navigateLearnStage('levels');
  }, [navigateLearnStage]);

  const goLearnUnits = useCallback(() => {
    void navigateLearnStage('units');
  }, [navigateLearnStage]);

  const goLearnLessons = useCallback(() => {
    void navigateLearnStage('lessons');
  }, [navigateLearnStage]);

  const walkthroughSteps = useMemo(() => {
    const normalizedLanguage = normalizeLanguageId(selectedLanguage);
    const isJapanese = normalizedLanguage === 'ja';
    const isMandarin = normalizedLanguage === 'zh';
    const isKorean = normalizedLanguage === 'kr';
    const isScriptFocusedLanguage = isMandarin || isJapanese || isKorean;
    const runtime = getLanguageRuntime(normalizedLanguage);
    const languageLabel = runtime.label || 'this language';
    const effectiveLabel = tourRoutes.languageLabel || languageLabel;
    const hasStructuredTour = tourRoutes.hasStructuredTour;

    return [
      {
        title: 'Home',
        body: 'Welcome to Sonus. This Home screen is your control center for starting lessons, resuming progress, and accessing core learning paths.',
        path: '/home',
      },
      {
        title: 'Main',
        body: isJapanese
          ? 'This is your Japanese roadmap. Choose a JLPT level (N5 to N1) to match your current proficiency and goals.'
          : 'This is your Mandarin roadmap. Start in the right tier (Beginner, Intermediate, Advanced) and progress step by step.',
        path: tourRoutes.mainPath,
      },
      {
        title: 'Levels',
        body: isJapanese
          ? 'Within each JLPT level, sections are structured by learning purpose: Core, Expansion, and Integration.'
          : isMandarin
            ? 'Each tier contains guided levels (for example Elementary I, Elementary II, and Pre-Intermediate) designed for steady progression.'
            : `Structured level pathways for ${effectiveLabel} are prepared and will activate automatically as content is published.`,
        path: tourRoutes.levelsPath,
      },
      {
        title: 'Unit',
        body: hasStructuredTour
          ? 'Units break each level into practical themes, helping you focus on one meaningful topic at a time.'
          : `Unit navigation for ${effectiveLabel} is ready and will route here once units are available.`,
        path: tourRoutes.unitsPath,
      },
      {
        title: 'Lessons',
        body: hasStructuredTour
          ? (
              <>
                Each lesson has Learn (flashcards), Quiz, and Speak modes. To pass, reach 90% Quiz and 75% Speak;
                mastery is earned on a later mastery attempt after the lesson is already completed.
                {isScriptFocusedLanguage && (
                  <>
                    <br />
                    <br />
                    <span className="font-semibold text-[#C2410C]">
                      Pay close attention to native script (characters/kana/hangul): mastery emphasizes script recall,
                      not romanized aids like pinyin or romaji.
                    </span>
                  </>
                )}
              </>
            )
          : `Lesson routing for ${effectiveLabel} is ready and will route here once lesson content is enabled.`,
        path: tourRoutes.lessonsPath,
      },
      {
        title: 'Travel Sprint',
        body: 'Travel Sprint is for quick, practical phrase prep when you need useful language fast and do not have time for a full lesson flow.',
        path: '/home',
      },
      {
        title: 'Practice Focus',
        body: 'Practice Focus uses a 70/30 balance: 70% learning and 30% reinforcing. Use it to sharpen weak areas and build retention between structured lessons.',
        path: '/home',
      },
      {
        title: 'Profile',
        body: 'Use Profile to manage your account, review progress, and change your active learning language at any time while keeping your saved streak and lesson history.',
        path: '/profile',
      },
    ];
  }, [selectedLanguage, tourRoutes]);

  useEffect(() => {
    const normalizedLanguage = normalizeLanguageId(selectedLanguage);
    const runtime = getLanguageRuntime(normalizedLanguage);
    const starterBandId = STARTER_BAND_BY_LANGUAGE[normalizedLanguage] || 'band1';
    const starterTier = tierForBand(starterBandId);
    const defaultLevelsPath = normalizedLanguage === 'zh'
      ? '/learn?tier=beginner'
      : (normalizedLanguage === 'ja' ? '/learn/jlpt/n5' : '/learn');
    const defaultState = {
      mainPath: '/learn',
      levelsPath: defaultLevelsPath,
      unitsPath: '/learn',
      lessonsPath: '/learn',
      hasStructuredTour: false,
      languageLabel: runtime.label || 'Language',
    };
    setTourRoutes(defaultState);

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(resolveBandDataPath(normalizedLanguage, starterBandId), { cache: 'no-store' });
        if (!response.ok) return;
        const raw = (await response.json()) as unknown;
        const bandData = normalizeBandDataPayload(raw, starterBandId, normalizedLanguage);
        if (!bandData) return;

        const units = Array.isArray(bandData.units)
          ? bandData.units.map((unit) => unit?.id || '').filter(Boolean)
          : Object.keys(bandData.units || {});
        const firstCoreUnitId = units.find((unitId) =>
          unitId !== '_unallocated' && !isPracticeUnitId(unitId) && !isCheckpointUnitId(unitId)
        );
        if (!firstCoreUnitId) return;

        const basePath = `/learn/${starterTier}/${starterBandId}`;
        const sectionId = normalizedLanguage === 'ja'
          ? (deriveJapaneseSectionIdFromUnitId(starterBandId, firstCoreUnitId) || 'core')
          : null;
        const unitsPath = sectionId
          ? `${basePath}?section=${encodeURIComponent(sectionId)}`
          : basePath;
        const lessonsPath = sectionId
          ? `${basePath}?section=${encodeURIComponent(sectionId)}&unit=${encodeURIComponent(firstCoreUnitId)}`
          : `${basePath}?unit=${encodeURIComponent(firstCoreUnitId)}`;

        if (!cancelled) {
          setTourRoutes({
            mainPath: '/learn',
            levelsPath: defaultLevelsPath,
            unitsPath,
            lessonsPath,
            hasStructuredTour: true,
            languageLabel: runtime.label || 'Language',
          });
        }
      } catch {
        // Keep defaults when starter content is not yet available.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedLanguage]);

  const openPracticeFromHome = useCallback(
    (kind: 'listening' | 'speaking', bandId?: string | null) => {
      const normalizedLanguage = normalizeLanguageId(selectedLanguage);
      const isJapanese = normalizedLanguage === 'ja';
      const requestedBandId = isJapanese
        ? (
            bandId && /^n[1-5]$/i.test(bandId)
              ? bandId
              : (/^n[1-5]$/i.test(currentLevel?.id || '') ? currentLevel!.id : 'n5')
          )
        : (
            bandId && (/^band\d+$/i.test(bandId) || bandId === 'advanced') ? bandId : 'band1'
          );
      const resolvedBand = isMandarinBandLocked(requestedBandId, state.unlockedLevels)
        ? (isJapanese ? 'n5' : 'band1')
        : requestedBandId;
      const targetUnitId = isJapanese
        ? `${resolvedBand}-${kind}`
        : (
            resolvedBand === 'advanced'
              ? `b79-${kind}`
              : `b${resolvedBand.match(/^band(\d+)$/i)?.[1] ?? '1'}-${kind}`
          );
      const targetMode: LessonMode = kind === 'listening' ? 'quiz' : 'speak';
      navigate(`/learn/${tierForBand(resolvedBand)}/${resolvedBand}/unit/${targetUnitId}/lesson/0/${targetMode}`);
    },
    [currentLevel, navigate, selectedLanguage, state.unlockedLevels]
  );

  const openResumeFromHome = useCallback(
    (target: { bandId: string; unitId: string; lessonIndex: number; isCheckpoint: boolean; mode?: LessonMode }) => {
      void target.lessonIndex;
      void target.isCheckpoint;
      void target.mode;
      exitLesson();
      const level = LEVEL_BY_ID[target.bandId];
      if (!level || isMandarinBandLocked(level.id, state.unlockedLevels)) {
        navigate('/learn');
        return;
      }
      if (!levelMatchesLanguage(level.id, selectedLanguage)) {
        navigate('/learn');
        return;
      }
      const basePath = `/learn/${tierForBand(level.id)}/${level.id}`;
      // Navigate directly to the unit context; UnitsRoute will ensure level data is loaded.
      navigate(`${basePath}?unit=${encodeURIComponent(target.unitId)}`);
    },
    [exitLesson, navigate, selectedLanguage, state.unlockedLevels]
  );

  useEffect(() => {
    const handler = () => {
      void goLearnUnits();
    };
    const mainHandler = () => {
      void goLearnMain();
    };
    const levelsHandler = () => {
      void goLearnLevels();
    };
    const unitsHandler = () => {
      void goLearnUnits();
    };
    const lessonsHandler = () => {
      void goLearnLessons();
    };
    window.addEventListener('sonus:learn', handler);
    window.addEventListener('sonus:learn:main', mainHandler);
    window.addEventListener('sonus:learn:levels', levelsHandler);
    window.addEventListener('sonus:learn:units', unitsHandler);
    window.addEventListener('sonus:learn:lessons', lessonsHandler);
    return () => {
      window.removeEventListener('sonus:learn', handler);
      window.removeEventListener('sonus:learn:main', mainHandler);
      window.removeEventListener('sonus:learn:levels', levelsHandler);
      window.removeEventListener('sonus:learn:units', unitsHandler);
      window.removeEventListener('sonus:learn:lessons', lessonsHandler);
    };
  }, [goLearnMain, goLearnLevels, goLearnUnits, goLearnLessons]);

  useEffect(() => {
    if (onboardingStatus !== 'incomplete' || !selectedLanguage) {
      setWalkthroughVisible(false);
      walkthroughStartedRef.current = false;
      return;
    }
    if (walkthroughStartedRef.current) return;
    walkthroughStartedRef.current = true;
    setWalkthroughVisible(true);
    setWalkthroughStep(0);
    navigate(walkthroughSteps[0]?.path || '/home', { replace: true });
  }, [navigate, onboardingStatus, selectedLanguage, walkthroughSteps]);

  const completeWalkthrough = useCallback(async () => {
    setWalkthroughSaving(true);
    try {
      if (!isDemo) {
        await completeOnboardingWalkthrough();
      }
    } catch {
      // Do not block completion on transient write failures.
    } finally {
      if (!isDemo) {
        writeWalkthroughComplete(email);
      }
      setOnboardingStatus('complete');
      setWalkthroughVisible(false);
      setWalkthroughStep(0);
      setWalkthroughSaving(false);
      navigate('/home', { replace: true });
    }
  }, [email, isDemo, navigate]);

  const handleWalkthroughBack = useCallback(() => {
    setWalkthroughStep((prev) => {
      const nextStep = Math.max(0, prev - 1);
      const targetPath = walkthroughSteps[nextStep]?.path;
      if (targetPath) navigate(targetPath);
      return nextStep;
    });
  }, [navigate, walkthroughSteps]);

  const handleWalkthroughNext = useCallback(() => {
    if (walkthroughStep >= walkthroughSteps.length - 1) {
      void completeWalkthrough();
      return;
    }
    setWalkthroughStep((prev) => {
      const nextStep = Math.min(walkthroughSteps.length - 1, prev + 1);
      const targetPath = walkthroughSteps[nextStep]?.path;
      if (targetPath) navigate(targetPath);
      return nextStep;
    });
  }, [completeWalkthrough, navigate, walkthroughStep, walkthroughSteps]);

  useEffect(() => {
    const targetId = walkthroughVisible
      ? (
          walkthroughStep === 0
            ? 'tour-begin-here-button'
            : walkthroughStep === 1
              ? 'tour-main-first-path-card'
              : walkthroughStep === 2
                ? 'tour-levels-first-card'
                : walkthroughStep === 3
                  ? 'tour-units-first-card'
              : walkthroughStep === 4
                ? 'tour-lessons-first-card'
                : walkthroughStep === 5
                  ? 'tour-travel-sprint-card'
                  : walkthroughStep === 6
                    ? 'tour-practice-focus-card'
                    : walkthroughStep === 7
                      ? 'tour-profile-language-card'
                : null
        )
      : null;
    if (!targetId) {
      walkthroughHighlightRectRef.current = null;
      setWalkthroughHighlightRect(null);
      return;
    }

    let frameId = 0;
    let timeoutId = 0;
    let intervalId = 0;
    let observedTarget: HTMLElement | null = null;
    let observer: ResizeObserver | null = null;
    const updateRect = () => {
      const target = document.getElementById(targetId);
      if (!target) {
        walkthroughHighlightRectRef.current = null;
        setWalkthroughHighlightRect(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      const computed = window.getComputedStyle(target);
      const nextRect = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        borderRadius: computed.borderRadius || '1rem',
      };
      const prevRect = walkthroughHighlightRectRef.current;
      const hasMeaningfulChange =
        !prevRect ||
        Math.abs(prevRect.top - nextRect.top) > 0.5 ||
        Math.abs(prevRect.left - nextRect.left) > 0.5 ||
        Math.abs(prevRect.width - nextRect.width) > 0.5 ||
        Math.abs(prevRect.height - nextRect.height) > 0.5 ||
        prevRect.borderRadius !== nextRect.borderRadius;
      if (!hasMeaningfulChange) return;
      walkthroughHighlightRectRef.current = nextRect;
      setWalkthroughHighlightRect(nextRect);
    };

    const queueUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateRect);
    };

    const resolveAndObserveTarget = () => {
      const target = document.getElementById(targetId);
      if (!target) {
        walkthroughHighlightRectRef.current = null;
        setWalkthroughHighlightRect(null);
        return;
      }
      if (
        targetId === 'tour-travel-sprint-card' ||
        targetId === 'tour-practice-focus-card' ||
        targetId === 'tour-profile-language-card'
      ) {
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
      }
      if (observedTarget === target) {
        queueUpdate();
        return;
      }
      if (observer) observer.disconnect();
      observedTarget = target;
      observer = new ResizeObserver(() => {
        queueUpdate();
      });
      observer.observe(target);
      queueUpdate();
    };

    resolveAndObserveTarget();
    timeoutId = window.setTimeout(resolveAndObserveTarget, 120);
    intervalId = window.setInterval(resolveAndObserveTarget, 250);
    window.addEventListener('resize', resolveAndObserveTarget);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      window.removeEventListener('resize', resolveAndObserveTarget);
      if (observer) observer.disconnect();
      observer = null;
      observedTarget = null;
    };
  }, [walkthroughStep, walkthroughVisible, location.pathname]);

  function LearnRoute() {
    return (
      <LevelSelect
        walkthroughHighlightMainPath={walkthroughVisible && walkthroughStep === 1}
        walkthroughHighlightLevels={walkthroughVisible && walkthroughStep === 2}
        onGoHome={goHome}
        onOpenProfile={goProfile}
        onOpenFoundations={() => navigate('/learn/foundations')}
        onOpenLanguageIntro={() => navigate('/learn/language-intro')}
        onSelectLevel={(level: LessonBand) => {
          if (isMandarinBandLocked(level.id, state.unlockedLevels)) {
            return;
          }
          void selectLevel(level);
          navigate(`/learn/${tierForBand(level.id)}/${level.id}`);
        }}
      />
    );
  }

  function UnitsRoute() {
    const { band } = useParams<{ tier: string; band: string }>();
    const level = band ? LEVEL_BY_ID[band] : undefined;

    useEffect(() => {
      if (!level) return;
      // Ensure band payload is loaded when route band changes.
      if (currentLevel?.id !== level.id) {
        void selectLevel(level);
      }
    }, [level]);

    if (!level) return <Navigate to="/learn" replace />;
    if (!selectedLanguage || !levelMatchesLanguage(level.id, selectedLanguage)) {
      return <Navigate to="/learn" replace />;
    }
    if (isMandarinBandLocked(level.id, state.unlockedLevels)) return <Navigate to="/learn" replace />;
    if (!currentLevel || currentLevel.id !== level.id || !state.activeBandData) {
      return (
        <div className="min-h-screen page-shell flex items-center justify-center">
          <GlassLoader compact message="Loading units..." />
        </div>
      );
    }

    const tier = tierForBand(level.id);
    return (
      <UnitSelect
        walkthroughHighlightLevels={walkthroughVisible && walkthroughStep === 2}
        walkthroughHighlightUnits={walkthroughVisible && walkthroughStep === 3}
        walkthroughHighlightLessons={walkthroughVisible && walkthroughStep === 4}
        onGoHome={goHome}
        onOpenProfile={goProfile}
        onGoLevels={(tierId) => navigate(tierId ? `/learn?tier=${encodeURIComponent(tierId)}` : '/learn')}
        onOpenPractice={(unitId) => {
          const mode: LessonMode = /listening$/i.test(unitId) ? 'quiz' : 'speak';
          navigate(`/learn/${tier}/${level.id}/unit/${unitId}/lesson/0/${mode}`);
        }}
        onSelectLesson={(unitId, lessonIndex, mode = 'intro') => {
          navigate(`/learn/${tier}/${level.id}/unit/${unitId}/lesson/${lessonIndex}/${mode}`);
        }}
      />
    );
  }

  function PracticeRedirectRoute() {
    const { kind, band } = useParams<{ kind: string; band: string }>();
    const isJapaneseBand = Boolean(band && /^n[1-5]$/i.test(band));
    const targetBand = isJapaneseBand
      ? (band as string)
      : (band && (/^band\d+$/i.test(band) || band === 'advanced') ? band : 'band1');
    const resolvedBand = isJapaneseBand
      ? (isMandarinBandLocked(targetBand, state.unlockedLevels) ? 'n5' : targetBand)
      : (isMandarinBandLocked(targetBand, state.unlockedLevels) ? 'band1' : targetBand);
    const targetKind = kind === 'speaking' ? 'speaking' : 'listening';
    const targetUnitId = isJapaneseBand
      ? `${resolvedBand}-${targetKind}`
      : (
          resolvedBand === 'advanced'
            ? `b79-${targetKind}`
            : `b${resolvedBand.match(/^band(\d+)$/i)?.[1] ?? '1'}-${targetKind}`
        );
    const targetMode: LessonMode = targetKind === 'listening' ? 'quiz' : 'speak';
    const startedRef = useRef(false);

    useEffect(() => {
      if (startedRef.current) return;
      startedRef.current = true;
      let cancelled = false;
      const startedAt = Date.now();
      const MIN_LOADER_MS = 650;
      const waitForMinimumLoader = async () => {
        const elapsed = Date.now() - startedAt;
        const remaining = MIN_LOADER_MS - elapsed;
        if (remaining > 0) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, remaining));
        }
      };

      // Try requested band first, then fall back to Band 1 practice routes.
      void openLessonPath(resolvedBand, targetUnitId, 0).then(async (opened) => {
        await waitForMinimumLoader();
        if (cancelled) return;
        if (opened) {
          navigate(
            `/learn/${tierForBand(resolvedBand)}/${resolvedBand}/unit/${targetUnitId}/lesson/0/${targetMode}`,
            { replace: true }
          );
          return;
        }
        if (isJapaneseBand) {
          void openLessonPath('n5', `n5-${targetKind}`, 0).then(async (fallbackOpened) => {
            await waitForMinimumLoader();
            if (cancelled) return;
            if (fallbackOpened) {
              navigate(`/learn/jlpt/n5/unit/n5-${targetKind}/lesson/0/${targetMode}`, {
                replace: true,
              });
              return;
            }
            navigate('/learn', { replace: true });
          });
          return;
        }
        void openLessonPath('band1', `b1-${targetKind}`, 0).then(async (fallbackOpened) => {
          await waitForMinimumLoader();
          if (cancelled) return;
          if (fallbackOpened) {
            navigate(`/learn/beginner/band1/unit/b1-${targetKind}/lesson/0/${targetMode}`, {
              replace: true,
            });
            return;
          }
          navigate('/learn', { replace: true });
        });
      });

      return () => {
        cancelled = true;
      };
    }, [isJapaneseBand, resolvedBand, targetKind, targetMode, targetUnitId]);

    return (
      <div className="min-h-screen page-shell flex items-center justify-center">
        <GlassLoader compact message="Loading practice..." />
      </div>
    );
  }

  function DailyPracticeRoute() {
    const { band } = useParams<{ band: string }>();
    const targetBand = band && (/^band\d+$/i.test(band) || band === 'advanced') ? band : 'band1';
    const resolvedBand = isMandarinBandLocked(targetBand, state.unlockedLevels) ? 'band1' : targetBand;

    useEffect(() => {
      // Build a fresh daily set and route directly into its quiz lesson.
      void generateDailyReviewSet(resolvedBand).then((opened) => {
        if (opened) {
          navigate(
            `/learn/${tierForBand(resolvedBand)}/${resolvedBand}/unit/daily-review/lesson/0/quiz`,
            { replace: true }
          );
          return;
        }
        navigate('/home', { replace: true });
      });
    }, [resolvedBand]);

    return (
      <div className="min-h-screen page-shell flex items-center justify-center">
        <GlassLoader compact message="Building daily set..." />
      </div>
    );
  }

  const languageRouteState = (location.state || {}) as {
    mode?: 'switch';
    returnTo?: string;
  };
  const isLanguageSwitchMode = location.pathname === '/language' && languageRouteState.mode === 'switch';
  const languageSwitchReturnTo = languageRouteState.returnTo || '/home';

  return (
    <Suspense
      fallback={
        <div className="min-h-screen page-shell flex items-center justify-center">
          <GlassLoader compact message="Loading screen..." />
        </div>
      }
    >
      <Routes>
      <Route
        path="/"
        element={
          <LanguageRoute
            selectedLanguage={selectedLanguage}
            languageResolved={languageResolved}
            onGoHome={goHome}
            onOpenProfile={goProfile}
            onSelectLanguage={(langId) => {
              writeLastLanguage(langId);
              selectLanguage(langId);
              navigate('/home');
            }}
          />
        }
      />
      <Route
        path="/language"
        element={
          <LanguageRoute
            selectedLanguage={selectedLanguage}
            languageResolved={languageResolved}
            onGoHome={goHome}
            onOpenProfile={goProfile}
            switchMode={isLanguageSwitchMode || !selectedLanguage}
            onCancelSwitch={() => navigate(languageSwitchReturnTo)}
            onSelectLanguage={(langId) => {
              writeLastLanguage(langId);
              selectLanguage(langId);
              navigate(isLanguageSwitchMode ? languageSwitchReturnTo : '/home');
            }}
          />
        }
      />
      <Route
        path="/home"
        element={
          <HomeRoute
            selectedLanguage={selectedLanguage}
            onOpenLevels={() => navigate('/learn')}
            onResumeToUnit={openResumeFromHome}
            onOpenPractice={(kind, bandId) => openPracticeFromHome(kind, bandId)}
            onOpenWeakWords={() => navigate('/profile/progress')}
            onOpenProfile={() => navigate('/profile')}
            onOpenAbout={() => navigate('/about')}
            onOpenTravelMode={(sectionId) => navigate(sectionId ? `/travel/${sectionId}` : '/travel')}
          />
        }
      />
      <Route
        path="/travel"
        element={
          <TravelRoute
            onGoHome={goHome}
            onOpenProfile={goProfile}
            onOpenSection={(sectionId) => navigate(`/travel/${sectionId}`)}
          />
        }
      />
      <Route
        path="/travel/:sectionId"
        element={<TravelSectionRouteWithParams onGoHome={goHome} onOpenProfile={goProfile} />}
      />
      <Route path="/learn" element={<LearnRoute />} />
      <Route
        path="/learn/language-intro"
        element={
          <JapaneseIntroScreen
            onGoHome={goHome}
            onOpenProfile={goProfile}
            onBackToLearn={() => navigate('/learn')}
            onOpenHiragana={() => navigate('/learn/language-intro/hiragana')}
            onOpenKatakana={() => navigate('/learn/language-intro/katakana')}
          />
        }
      />
      <Route
        path="/learn/language-intro/hiragana"
        element={
          <JapaneseKanaChartScreen
            script="hiragana"
            onGoHome={goHome}
            onOpenProfile={goProfile}
          />
        }
      />
      <Route
        path="/learn/language-intro/katakana"
        element={
          <JapaneseKanaChartScreen
            script="katakana"
            onGoHome={goHome}
            onOpenProfile={goProfile}
          />
        }
      />
      <Route path="/learn/tones" element={<Navigate to="/learn/foundations/tones" replace />} />
      <Route
        path="/learn/foundations"
        element={
          <FoundationsRoute
            selectedLanguage={selectedLanguage}
            onGoHome={goHome}
            onOpenProfile={goProfile}
            onOpenTones={() => navigate('/learn/foundations/tones')}
            onOpenPinyin={() => navigate('/learn/foundations/pinyin')}
            onOpenCharacters={() => navigate('/learn/foundations/characters')}
          />
        }
      />
      <Route
        path="/learn/foundations/tones"
        element={<TonesRoute selectedLanguage={selectedLanguage} onGoHome={goHome} onOpenProfile={goProfile} />}
      />
      <Route
        path="/learn/foundations/pinyin"
        element={<PinyinRoute selectedLanguage={selectedLanguage} onGoHome={goHome} onOpenProfile={goProfile} />}
      />
      <Route
        path="/learn/foundations/characters"
        element={<CharactersRoute selectedLanguage={selectedLanguage} onGoHome={goHome} onOpenProfile={goProfile} />}
      />
      <Route path="/learn/:tier/:band" element={<UnitsRoute />} />
      <Route
        path="/learn/:tier/:band/unit/:unitId/lesson/:lessonIndex/:mode"
        element={<LessonRouteController onGoHome={goHome} onOpenProfile={goProfile} />}
      />
      <Route path="/practice/daily/:band" element={<DailyPracticeRoute />} />
      <Route path="/practice/:kind/:band" element={<PracticeRedirectRoute />} />
      <Route
        path="/profile"
        element={
          <ProfileRoute
            selectedLanguage={selectedLanguage}
            languageResolved={languageResolved}
            onGoHome={goHome}
            onOpenProgress={() => navigate('/profile/progress')}
            onOpenAbout={() => navigate('/about')}
            onSwitchLanguage={(langId) => {
              writeLastLanguage(langId);
              selectLanguage(langId);
            }}
          />
        }
      />
      <Route
        path="/profile/progress"
        element={<ProfileProgressScreen onGoHome={goHome} onGoProfile={() => navigate('/profile')} />}
      />
      <Route
        path="/about"
        element={<AboutSonusScreen onGoHome={goHome} onGoProfile={() => navigate('/profile')} />}
      />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/attributions" element={<AttributionsPage />} />
      <Route path="/internal/support/*" element={<SupportConsolePage />} />
      <Route path="*" element={<Navigate to={selectedLanguage ? '/home' : '/'} replace />} />
      </Routes>
      {walkthroughVisible && walkthroughSteps[walkthroughStep] && (
        <FirstTimeWalkthrough
          title={walkthroughSteps[walkthroughStep].title}
          body={walkthroughSteps[walkthroughStep].body}
          stepIndex={walkthroughStep}
          stepCount={walkthroughSteps.length}
          highlightRect={walkthroughHighlightRect}
          canGoBack={walkthroughStep > 0}
          canGoNext={!walkthroughSaving}
          saving={walkthroughSaving}
          onBack={handleWalkthroughBack}
          onNext={handleWalkthroughNext}
          onSkip={() => {
            void completeWalkthrough();
          }}
        />
      )}
    </Suspense>
  );
}

function TravelSectionRouteWithParams({
  onGoHome,
  onOpenProfile,
}: {
  onGoHome: () => void;
  onOpenProfile: () => void;
}) {
  const { sectionId } = useParams<{ sectionId: string }>();
  return <TravelSectionRoute sectionId={sectionId} onGoHome={onGoHome} onOpenProfile={onOpenProfile} />;
}
