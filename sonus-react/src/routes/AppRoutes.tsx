import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import type { LessonBand, LessonMode } from '../types/lesson.types';
import { LEVEL_BY_ID, isLegacyBandLocked, tierForBand } from './lessonRouting';
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
const ProfileRoute = lazy(() => import('./profileTravelRoutes').then((m) => ({ default: m.ProfileRoute })));
const TravelRoute = lazy(() => import('./profileTravelRoutes').then((m) => ({ default: m.TravelRoute })));
const TravelSectionRoute = lazy(() => import('./profileTravelRoutes').then((m) => ({ default: m.TravelSectionRoute })));
const KonbiniGuidePage = lazy(() => import('../components/KonbiniGuidePage'));
const SupportHomePage = lazy(() =>
  import('../components/internal/support/SupportConsoleRoutePages').then((module) => ({ default: module.SupportHomePage }))
);
const SupportUsersPage = lazy(() =>
  import('../components/internal/support/SupportConsoleRoutePages').then((module) => ({ default: module.SupportUsersPage }))
);
const SupportMetricsSupportPage = lazy(() =>
  import('../components/internal/support/SupportConsoleRoutePages').then((module) => ({ default: module.SupportMetricsSupportPage }))
);
const SupportMetricsLearningPage = lazy(() =>
  import('../components/internal/support/SupportConsoleRoutePages').then((module) => ({ default: module.SupportMetricsLearningPage }))
);
const SupportMetricsImpactPage = lazy(() =>
  import('../components/internal/support/SupportConsoleRoutePages').then((module) => ({ default: module.SupportMetricsImpactPage }))
);
const SupportQualityReportsPage = lazy(() =>
  import('../components/internal/support/SupportConsoleRoutePages').then((module) => ({ default: module.SupportQualityReportsPage }))
);

const LAST_LANGUAGE_KEY = 'sonus.last_language';
const WALKTHROUGH_DONE_PREFIX = 'sonus.walkthrough.done:';
const STARTER_BAND_BY_LANGUAGE: Record<string, string> = {
  ja: 'n5',
  kr: 'topik1-1',
  fr: 'a1',
  it: 'a1',
  es: 'a1',
};

const isLegacyBandLevel = (levelId: string) => /^band\d+$/i.test(levelId) || /^advanced$/i.test(levelId);
const isJapaneseLevel = (levelId: string) => /^n[1-5]$/i.test(levelId);
const isKoreanLevel = (levelId: string) => /^topik\d+-\d+$/i.test(levelId);
const isCefrLevel = (levelId: string) => /^(a1|a2|b1|b2|c1|c2)$/i.test(levelId);
const levelMatchesLanguage = (levelId: string, languageId: string | null) => {
  const normalizedLevelId = (levelId || '').trim().toLowerCase();
  if (normalizedLevelId === 'intro') return true;
  const normalizedLanguage = normalizeLanguageId(languageId);
  if (isJapaneseLevel(normalizedLevelId) || isLegacyBandLevel(normalizedLevelId)) {
    return normalizedLanguage === 'ja';
  }
  if (isKoreanLevel(normalizedLevelId)) return normalizedLanguage === 'kr';
  if (isCefrLevel(normalizedLevelId)) {
    return normalizedLanguage === 'fr' || normalizedLanguage === 'it' || normalizedLanguage === 'es';
  }
  return true;
};

function writeLastLanguage(languageId: string) {
  try {
    window.localStorage.setItem(LAST_LANGUAGE_KEY, normalizeLanguageId(languageId));
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
  const languageBootstrapDoneRef = useRef(false);
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
  const walkthroughAlignedStepRef = useRef<number | null>(null);
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
    if (languageBootstrapDoneRef.current) return;
    languageBootstrapDoneRef.current = true;

    let cancelled = false;
    setLanguageResolved(false);

    if (isDemo) {
      const selectedLanguageNormalized =
        typeof selectedLanguage === 'string' && selectedLanguage.trim()
          ? normalizeLanguageId(selectedLanguage)
          : null;
      let storedLanguage: string | null = null;
      try {
        const raw = window.localStorage.getItem(LAST_LANGUAGE_KEY);
        if (raw && raw.trim()) storedLanguage = normalizeLanguageId(raw);
      } catch {
        // Ignore storage failures and fall back to default.
      }
      const resolvedLanguage = selectedLanguageNormalized || storedLanguage || 'ja';
      if (selectedLanguageNormalized !== resolvedLanguage) {
        selectLanguage(resolvedLanguage);
      }
      writeLastLanguage(resolvedLanguage);
      setLanguageResolved(true);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      let profileLanguage: string | null = null;
      let profileLoaded = false;

      try {
        const response = await apiFetch('/v1/me/profile');
        if (response.ok) {
          profileLoaded = true;
          const payload = (await response.json()) as { profile?: { targetLanguage?: string | null } };
          const value = payload.profile?.targetLanguage;
          if (typeof value === 'string' && value.trim()) {
            profileLanguage = normalizeLanguageId(value);
          }
        }
      } catch {
        // Continue with local/runtime fallback.
      }

      if (cancelled) return;

      const selectedLanguageNormalized =
        typeof selectedLanguage === 'string' && selectedLanguage.trim()
          ? normalizeLanguageId(selectedLanguage)
          : null;
      const resolvedLanguage = profileLoaded
        ? (profileLanguage || 'ja')
        : (selectedLanguageNormalized || 'ja');

      if (selectedLanguageNormalized !== resolvedLanguage) {
        selectLanguage(resolvedLanguage);
      }
      writeLastLanguage(resolvedLanguage);
      setLanguageResolved(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [isDemo, selectLanguage, selectedLanguage]);

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
    if (walkthroughVisible && walkthroughStep === 1) return;
    // Keep navigation deterministic on mobile: every route starts from the top.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search, walkthroughStep, walkthroughVisible]);

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
    return STARTER_BAND_BY_LANGUAGE[normalizedLanguage] || 'n5';
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
      if (!level || isLegacyBandLocked(level.id, state.unlockedLevels)) return null;
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
      if (!level || isLegacyBandLocked(level.id, state.unlockedLevels)) return null;
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

  const navigateLearnStage = useCallback(async (stage: 'levels' | 'units' | 'lessons') => {
    exitLesson();
    if (!selectedLanguage) {
      navigate('/');
      return;
    }
    const normalizedLanguage = normalizeLanguageId(selectedLanguage);
    if (stage === 'levels') {
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

    // Japanese flow: Levels (N5..N1 cards with section links) -> Units -> Lessons
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
    const isKorean = normalizedLanguage === 'kr';
    const isScriptFocusedLanguage = isJapanese || isKorean;
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
        title: 'Levels',
        body: isJapanese
          ? 'This is your Japanese roadmap. Start at the right JLPT level (N5 to N1), then use Core, Expansion, and Integration on each card to enter that track directly.'
          : `This is your ${effectiveLabel} roadmap. Start in the right tier and progress step by step.`,
        path: tourRoutes.levelsPath,
      },
      {
        title: 'Units',
        body: isJapanese
          ? 'After choosing a JLPT section, Units break study into focused themes so you can progress in a clear sequence.'
          : `Structured level pathways for ${effectiveLabel} are prepared and will activate automatically as content is published.`,
        path: tourRoutes.unitsPath,
      },
      {
        title: 'Lessons',
        body: hasStructuredTour
          ? (
              <>
                Open a lesson card to begin. Each lesson then runs through Learn, Quiz, and Speak.
                To pass, reach 90% Quiz and 75% Speak; mastery is earned on a later mastery attempt after completion.
                {isScriptFocusedLanguage && (
                  <>
                    <br />
                    <br />
                    <span className="font-semibold text-[var(--sonus-palette-rust)]">
                      Pay close attention to native script (characters/kana/hangul): mastery emphasizes script recall,
                      not romanized aids like transliteration or romaji.
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
    const starterBandId = STARTER_BAND_BY_LANGUAGE[normalizedLanguage] || 'n5';
    const starterTier = tierForBand(starterBandId);
    const defaultLevelsPath = '/learn';
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
      const starterBandId = STARTER_BAND_BY_LANGUAGE[normalizedLanguage] || 'n5';
      const requestedBandId = isJapanese
        ? (
            bandId && /^n[1-5]$/i.test(bandId)
              ? bandId
              : (/^n[1-5]$/i.test(currentLevel?.id || '') ? currentLevel!.id : 'n5')
          )
        : (
            bandId && (/^band\d+$/i.test(bandId) || bandId === 'advanced') ? bandId : starterBandId
          );
      const resolvedBand = isLegacyBandLocked(requestedBandId, state.unlockedLevels)
        ? starterBandId
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
      if (!level || isLegacyBandLocked(level.id, state.unlockedLevels)) {
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
      void goLearnLevels();
    };
    const mainHandler = () => {
      void goLearnLevels();
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
  }, [goLearnLevels, goLearnUnits, goLearnLessons]);

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
                ? 'tour-units-first-card'
                : walkthroughStep === 3
                  ? 'tour-lessons-first-card'
              : walkthroughStep === 4
                  ? 'tour-travel-sprint-card'
                  : walkthroughStep === 5
                  ? 'tour-practice-focus-card'
                    : walkthroughStep === 6
                      ? 'tour-profile-switch-language-button'
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
    let retryIntervalId = 0;
    let retryDeadlineId = 0;
    let observedTarget: HTMLElement | null = null;
    let observer: ResizeObserver | null = null;
    let layoutObserver: ResizeObserver | null = null;
    let domObserver: MutationObserver | null = null;
    const isMobileViewport = window.matchMedia('(max-width: 768px)').matches;
    const alignTargetForMobileWalkthrough = (target: HTMLElement) => {
      const rect = target.getBoundingClientRect();
      const walkthroughSheet = document.querySelector<HTMLElement>('[aria-label="First-time walkthrough"]');
      const sheetTop = walkthroughSheet?.getBoundingClientRect().top ?? window.innerHeight;
      const safetyGap = isMobileViewport ? 10 : 14;
      const minTop = isMobileViewport ? 72 : 74;
      const maxBottom = sheetTop - safetyGap;
      // Center first; if it overlaps the walkthrough sheet, move it up until fully clear.
      const centeredTop = (window.innerHeight - rect.height) / 2;
      const maxTopForFullVisibility = maxBottom - rect.height;
      const desiredTop = Math.max(minTop, Math.min(centeredTop, maxTopForFullVisibility));
      const delta = rect.top - desiredTop;
      if (Math.abs(delta) < 2) return;
      window.scrollTo({
        top: Math.max(0, window.scrollY + delta),
        behavior: 'auto',
      });
    };

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
      const disableAutoAlignForLevelsStep = walkthroughStep === 1;
      if (!disableAutoAlignForLevelsStep && walkthroughAlignedStepRef.current !== walkthroughStep) {
        alignTargetForMobileWalkthrough(target);
        walkthroughAlignedStepRef.current = walkthroughStep;
      } else if (disableAutoAlignForLevelsStep) {
        walkthroughAlignedStepRef.current = walkthroughStep;
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
    // Some step targets (units/lessons) mount after async data hydration.
    // Keep resolving for a short window so we always attach the same glow logic.
    retryIntervalId = window.setInterval(() => {
      resolveAndObserveTarget();
    }, 180);
    retryDeadlineId = window.setTimeout(() => {
      window.clearInterval(retryIntervalId);
      retryIntervalId = 0;
    }, 4000);
    // Also watch DOM mutations so delayed card mounts still pick up the shared glow.
    domObserver = new MutationObserver(() => {
      resolveAndObserveTarget();
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
    // Fonts/images/layout shifts can move the target without resizing it directly.
    // Watch document-level layout and re-sync the glow rect when that happens.
    layoutObserver = new ResizeObserver(() => {
      queueUpdate();
    });
    layoutObserver.observe(document.documentElement);
    window.addEventListener('resize', queueUpdate);
    window.addEventListener('scroll', queueUpdate, { passive: true });

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
      if (retryIntervalId) window.clearInterval(retryIntervalId);
      if (retryDeadlineId) window.clearTimeout(retryDeadlineId);
      window.removeEventListener('resize', queueUpdate);
      window.removeEventListener('scroll', queueUpdate);
      if (observer) observer.disconnect();
      if (layoutObserver) layoutObserver.disconnect();
      if (domObserver) domObserver.disconnect();
      layoutObserver = null;
      domObserver = null;
      observer = null;
      observedTarget = null;
    };
  }, [walkthroughStep, walkthroughVisible, location.pathname, location.search]);

  function LearnRoute() {
    return (
      <LevelSelect
        walkthroughHighlightMainPath={walkthroughVisible && walkthroughStep === 1}
        walkthroughHighlightLevels={walkthroughVisible && walkthroughStep === 2}
        onGoHome={goHome}
        onOpenProfile={goProfile}
        onOpenLanguageIntro={() => navigate('/learn/language-intro')}
        onSelectLevel={(level: LessonBand, options) => {
          if (isLegacyBandLocked(level.id, state.unlockedLevels)) {
            return;
          }
          void selectLevel(level);
          const basePath = `/learn/${tierForBand(level.id)}/${level.id}`;
          const sectionId =
            /^n[1-5]$/i.test(level.id)
              ? (options?.sectionId || 'core')
              : null;
          navigate(
            sectionId
              ? `${basePath}?section=${encodeURIComponent(sectionId)}`
              : basePath
          );
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
    if (isLegacyBandLocked(level.id, state.unlockedLevels)) return <Navigate to="/learn" replace />;
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
        walkthroughHighlightLevels={false}
        walkthroughHighlightUnits={walkthroughVisible && walkthroughStep === 2}
        walkthroughHighlightLessons={walkthroughVisible && walkthroughStep === 3}
        onGoHome={goHome}
        onOpenProfile={goProfile}
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
    const normalizedLanguage = normalizeLanguageId(selectedLanguage);
    const isJapaneseBand = normalizedLanguage === 'ja';
    const starterBandId = STARTER_BAND_BY_LANGUAGE[normalizedLanguage] || 'n5';
    const targetBand = isJapaneseBand
      ? (band && /^n[1-5]$/i.test(band) ? band : starterBandId)
      : (band && (/^band\d+$/i.test(band) || band === 'advanced') ? band : starterBandId);
    const resolvedBand = isLegacyBandLocked(targetBand, state.unlockedLevels) ? starterBandId : targetBand;
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

      // Try requested band first, then fall back to the language starter practice routes.
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
        void openLessonPath(starterBandId, `${starterBandId}-${targetKind}`, 0).then(async (fallbackOpened) => {
          await waitForMinimumLoader();
          if (cancelled) return;
          if (fallbackOpened) {
            navigate(`/learn/${tierForBand(starterBandId)}/${starterBandId}/unit/${starterBandId}-${targetKind}/lesson/0/${targetMode}`, {
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
    }, [isJapaneseBand, resolvedBand, starterBandId, targetKind, targetMode, targetUnitId]);

    return (
      <div className="min-h-screen page-shell flex items-center justify-center">
        <GlassLoader compact message="Loading practice..." />
      </div>
    );
  }

  function DailyPracticeRoute() {
    const { band } = useParams<{ band: string }>();
    const normalizedLanguage = normalizeLanguageId(selectedLanguage);
    const starterBandId = STARTER_BAND_BY_LANGUAGE[normalizedLanguage] || 'n5';
    const targetBand = normalizedLanguage === 'ja'
      ? (band && /^n[1-5]$/i.test(band) ? band : starterBandId)
      : (band && (/^band\d+$/i.test(band) || band === 'advanced') ? band : starterBandId);
    const resolvedBand = isLegacyBandLocked(targetBand, state.unlockedLevels) ? starterBandId : targetBand;

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
        path="/travel/konbini"
        element={
          <KonbiniGuidePage
            onGoHome={goHome}
            onOpenProfile={goProfile}
            selectedLanguage={selectedLanguage}
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
      <Route path="/internal/support" element={<SupportHomePage />} />
      <Route path="/internal/support/users" element={<SupportUsersPage />} />
      <Route path="/internal/support/metrics/support" element={<SupportMetricsSupportPage />} />
      <Route path="/internal/support/metrics/learning" element={<SupportMetricsLearningPage />} />
      <Route path="/internal/support/metrics/impact-outcomes" element={<SupportMetricsImpactPage />} />
      <Route path="/internal/support/quality-reports" element={<SupportQualityReportsPage />} />
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
