import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import type { LessonBand, LessonMode } from '../types/lesson.types';
import LevelSelect from '../components/LevelSelect';
import UnitSelect from '../components/UnitSelect';
import AboutSonusScreen from '../components/AboutSonusScreen';
import ProfileProgressScreen from '../components/ProfileProgressScreen';
import JapaneseIntroScreen from '../components/JapaneseIntroScreen';
import JapaneseKanaChartScreen from '../components/JapaneseKanaChartScreen';
import LessonRouteController from './LessonRouteController';
import { LEVEL_BY_ID, isMandarinBandLocked, tierForBand } from './lessonRouting';
import { apiFetch } from '../lib/apiClient';
import { LanguageRoute, HomeRoute } from './homeRoutes';
import { CharactersRoute, FoundationsRoute, PinyinRoute, TonesRoute } from './foundationRoutes';
import { ProfileRoute, TravelRoute, TravelSectionRoute } from './profileTravelRoutes';

type ProgressPayload = {
  progress?: {
    currentBandId?: string | null;
  };
};

const LAST_LANGUAGE_KEY = 'sonus.last_language';

const isMandarinLevel = (levelId: string) => /^band\d+$/i.test(levelId) || levelId === 'advanced';
const isJapaneseLevel = (levelId: string) => /^n[1-5]$/i.test(levelId);
const levelMatchesLanguage = (levelId: string, languageId: string | null) => {
  if (!languageId) return true;
  const normalizedLanguage = languageId === 'jp' ? 'ja' : languageId;
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

  const goHome = useCallback(() => {
    exitLesson();
    void selectLevel(null);
    navigate('/home');
  }, [exitLesson, navigate, selectLevel]);

  const goProfile = useCallback(() => {
    exitLesson();
    navigate('/profile');
  }, [exitLesson, navigate]);

  const goLearn = useCallback(async () => {
    exitLesson();
    if (!selectedLanguage) {
      navigate('/');
      return;
    }
    if (currentLevel && levelMatchesLanguage(currentLevel.id, selectedLanguage)) {
      navigate(`/learn/${tierForBand(currentLevel.id)}/${currentLevel.id}`);
      return;
    }

    try {
      const response = await apiFetch('/v1/me/progress');
      if (response.ok) {
        const payload = (await response.json()) as ProgressPayload;
        const currentBandId = payload.progress?.currentBandId;
        const level = typeof currentBandId === 'string' ? LEVEL_BY_ID[currentBandId] : undefined;
        if (level && levelMatchesLanguage(level.id, selectedLanguage)) {
          if (isMandarinLevel(level.id) && isMandarinBandLocked(level.id, state.unlockedLevels)) {
            navigate('/learn');
            return;
          }
          await selectLevel(level);
          navigate(`/learn/${tierForBand(level.id)}/${level.id}`);
          return;
        }
      }
    } catch {
      // Fall through to generic learn page.
    }

    navigate('/learn');
  }, [currentLevel, exitLesson, navigate, selectLevel, selectedLanguage, state.unlockedLevels]);

  const openPracticeFromHome = useCallback(
    (kind: 'listening' | 'speaking', bandId?: string | null) => {
      const isJapanese = selectedLanguage === 'ja' || selectedLanguage === 'jp';
      const requestedBandId = isJapanese
        ? (
            bandId && /^n[1-5]$/i.test(bandId)
              ? bandId
              : (/^n[1-5]$/i.test(currentLevel?.id || '') ? currentLevel!.id : 'n5')
          )
        : (
            bandId && (/^band\d+$/i.test(bandId) || bandId === 'advanced') ? bandId : 'band1'
          );
      navigate(`/practice/${kind}/${requestedBandId}`);
    },
    [currentLevel, navigate, selectedLanguage]
  );

  const openResumeFromHome = useCallback(
    async (target: { bandId: string; unitId: string; lessonIndex: number; isCheckpoint: boolean; mode?: LessonMode }) => {
      void target.lessonIndex;
      exitLesson();
      const level = LEVEL_BY_ID[target.bandId];
      if (!level || (isMandarinLevel(level.id) && isMandarinBandLocked(level.id, state.unlockedLevels))) {
        navigate('/learn');
        return;
      }
      if (!levelMatchesLanguage(level.id, selectedLanguage)) {
        navigate('/learn');
        return;
      }
      await selectLevel(level);
      const basePath = `/learn/${tierForBand(level.id)}/${level.id}`;
      if (target.isCheckpoint) {
        navigate(basePath);
        return;
      }
      if (target.mode && (target.mode === 'quiz' || target.mode === 'speak')) {
        navigate(`${basePath}/unit/${encodeURIComponent(target.unitId)}/lesson/${target.lessonIndex}/${target.mode}`);
        return;
      }
      navigate(`${basePath}?unit=${encodeURIComponent(target.unitId)}`);
    },
    [exitLesson, navigate, selectLevel, selectedLanguage, state.unlockedLevels]
  );

  useEffect(() => {
    const handler = () => {
      void goLearn();
    };
    window.addEventListener('sonus:learn', handler);
    return () => {
      window.removeEventListener('sonus:learn', handler);
    };
  }, [goLearn]);

  function LearnRoute() {
    return (
      <LevelSelect
        onGoHome={goHome}
        onOpenProfile={goProfile}
        onOpenFoundations={() => navigate('/learn/foundations')}
        onOpenLanguageIntro={() => navigate('/learn/language-intro')}
        onSelectLevel={(level: LessonBand) => {
          if (selectedLanguage === 'zh' && isMandarinBandLocked(level.id, state.unlockedLevels)) {
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
    if (isMandarinLevel(level.id) && isMandarinBandLocked(level.id, state.unlockedLevels)) return <Navigate to="/learn" replace />;
    if (!currentLevel || currentLevel.id !== level.id || !state.activeBandData) {
      return <div className="min-h-screen page-shell flex items-center justify-center text-text-med">Loading units…</div>;
    }

    const tier = tierForBand(level.id);
    return (
      <UnitSelect
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
    const isJapaneseBand = Boolean(band && /^n[1-5]$/i.test(band));
    const targetBand = isJapaneseBand
      ? (band as string)
      : (band && (/^band\d+$/i.test(band) || band === 'advanced') ? band : 'band1');
    const resolvedBand = isJapaneseBand
      ? targetBand
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

    useEffect(() => {
      // Try requested band first, then fall back to Band 1 practice routes.
      void openLessonPath(resolvedBand, targetUnitId, 0).then((opened) => {
        if (opened) {
          navigate(
            `/learn/${tierForBand(resolvedBand)}/${resolvedBand}/unit/${targetUnitId}/lesson/0/${targetMode}`,
            { replace: true }
          );
          return;
        }
        if (isJapaneseBand) {
          void openLessonPath('n5', `n5-${targetKind}`, 0).then((fallbackOpened) => {
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
        void openLessonPath('band1', `b1-${targetKind}`, 0).then((fallbackOpened) => {
          if (fallbackOpened) {
            navigate(`/learn/beginner/band1/unit/b1-${targetKind}/lesson/0/${targetMode}`, {
              replace: true,
            });
            return;
          }
          navigate('/learn', { replace: true });
        });
      });
    }, [isJapaneseBand, resolvedBand, targetKind, targetMode, targetUnitId]);

    return <div className="min-h-screen page-shell flex items-center justify-center text-text-med">Loading practice…</div>;
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

    return <div className="min-h-screen page-shell flex items-center justify-center text-text-med">Building daily set…</div>;
  }

  const languageRouteState = (location.state || {}) as {
    mode?: 'switch';
    returnTo?: string;
  };
  const isLanguageSwitchMode = location.pathname === '/language' && languageRouteState.mode === 'switch';
  const languageSwitchReturnTo = languageRouteState.returnTo || '/home';

  return (
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
            onOpenLanguageSelection={() =>
              navigate('/language', { state: { mode: 'switch', returnTo: '/home' } })
            }
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
      <Route path="*" element={<Navigate to={selectedLanguage ? '/home' : '/'} replace />} />
    </Routes>
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
