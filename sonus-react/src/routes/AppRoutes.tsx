import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import type { LessonBand, LessonMode } from '../types/lesson.types';
import { LEVEL_BY_ID, isMandarinBandLocked, tierForBand } from './lessonRouting';
import { apiFetch } from '../lib/apiClient';
import { normalizeLanguageId } from '../lib/languageRuntime';
import { readCachedCurrentPath, writeCachedCurrentPath } from '../lib/currentPathStore';
import { deriveJapaneseSectionIdFromUnitId } from '../lib/learnPath';
import GlassLoader from '../components/ui/GlassLoader';
import PrivacyPage from '../components/public/PrivacyPage';
import TermsPage from '../components/public/TermsPage';
import ContactPage from '../components/public/ContactPage';
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

const LAST_LANGUAGE_KEY = 'sonus.last_language';

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

export default function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const [languageResolved, setLanguageResolved] = useState(false);
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

  function LearnRoute() {
    return (
      <LevelSelect
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
      <Route path="*" element={<Navigate to={selectedLanguage ? '/home' : '/'} replace />} />
      </Routes>
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
