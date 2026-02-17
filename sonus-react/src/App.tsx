import { useCallback, useEffect, useRef } from 'react';
import { Navigate, BrowserRouter, HashRouter, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import type { LessonBand, LessonMode } from './types/lesson.types';
import LanguageSelect from './components/LanguageSelect';
import LevelSelect from './components/LevelSelect';
import UnitSelect from './components/UnitSelect';
import LessonScreen from './components/LessonScreen';
import LessonComplete from './components/LessonComplete';
import LessonReview from './components/LessonReview';
import MandarinTones from './components/MandarinTones';
import HomeDashboard from './components/HomeDashboard';
import TravelModePage from './components/TravelModePage';
import TravelSectionPage from './components/TravelSectionPage';
import AboutSonusScreen from './components/AboutSonusScreen';
import ProfileScreen from './components/ProfileScreen';
import ProfileProgressScreen from './components/ProfileProgressScreen';
import { saveOnboardingSelectionSafe } from './lib/backendApi';
import { trackEvent } from './lib/analytics';
import { getTravelSectionById } from './data/travelModeData';
import { makeLessonKey } from './lib/lessonProgress';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://127.0.0.1:4000';

type ProgressPayload = {
  progress?: {
    currentBandId?: string | null;
  };
};

const CHINESE_LEVEL_BY_ID: Record<string, LessonBand> = {
  intro: { id: 'intro', band: 0, name: 'Introduction', title: '', subtitle: '', wordCount: 0, wordRange: '', color: 'bg-gray-400', description: 'Start here', units: [] },
  band1: { id: 'band1', band: 1, name: 'Elementary I', title: 'Elementary I', subtitle: 'Foundations · Everyday Use', wordCount: 500, wordRange: '0–500', color: 'bg-[#3E5648]', description: 'Foundations · Everyday Use', units: [] },
  band2: { id: 'band2', band: 2, name: 'Elementary II', title: 'Elementary II', subtitle: 'Expanded Daily Life', wordCount: 1272, wordRange: '500–1272', color: 'bg-[#3E5648]', description: 'Expanded Daily Life', units: [] },
  band3: { id: 'band3', band: 3, name: 'Pre‑Intermediate', title: 'Pre‑Intermediate', subtitle: 'Simple Narratives', wordCount: 2245, wordRange: '1272–2245', color: 'bg-[#186E95]', description: 'Simple Narratives', units: [] },
  band4: { id: 'band4', band: 4, name: 'Intermediate I', title: 'Intermediate I', subtitle: 'Intermediate Topics', wordCount: 3245, wordRange: '2245–3245', color: 'bg-[#186E95]', description: 'Intermediate Topics', units: [] },
  band5: { id: 'band5', band: 5, name: 'Intermediate II', title: 'Intermediate II', subtitle: 'Broader Expression', wordCount: 4316, wordRange: '3245–4316', color: 'bg-purple-500', description: 'Broader Expression', units: [] },
  band6: { id: 'band6', band: 6, name: 'Upper‑Intermediate', title: 'Upper‑Intermediate', subtitle: 'Abstract Themes', wordCount: 5456, wordRange: '4316–5456', color: 'bg-purple-600', description: 'Abstract Themes', units: [] },
  band7: { id: 'band7', band: 7, name: 'Advanced I', title: 'Advanced I', subtitle: 'Complex topics · High range', wordCount: 7356, wordRange: '5456–7356', color: 'bg-red-500', description: 'Complex topics · High range', units: [] },
  band8: { id: 'band8', band: 8, name: 'Advanced II', title: 'Advanced II', subtitle: 'Formal language · Precision', wordCount: 9256, wordRange: '7356–9256', color: 'bg-slate-500', description: 'Formal language · Precision', units: [] },
  band9: { id: 'band9', band: 9, name: 'Advanced III', title: 'Advanced III', subtitle: 'Near-native range · Depth', wordCount: 11092, wordRange: '9256–11092', color: 'bg-slate-900', description: 'Near-native range · Depth', units: [] },
  advanced: { id: 'advanced', band: 7, name: 'Advanced', title: 'Advanced', subtitle: 'Bands 7–9 · Mastery', wordCount: 0, wordRange: 'Band 7–9', color: 'bg-red-500', description: 'Macro-unit track for Bands 7-9', units: [] },
};

function tierForBand(bandId: string) {
  if (bandId === 'advanced' || /^band[7-9]$/i.test(bandId)) return 'advanced';
  if (/^band[4-6]$/i.test(bandId)) return 'intermediate';
  return 'beginner';
}

function isMandarinBandLocked(bandId: string, unlockedLevels: string[]) {
  if (!(/^band\d+$/i.test(bandId) || bandId === 'advanced')) return false;
  return !unlockedLevels.includes(bandId);
}

  function LessonRoutePage({
  onGoHome,
  onOpenProfile,
}: {
  onGoHome: () => void;
  onOpenProfile: () => void;
}) {
  const navigate = useNavigate();
  const { state, openLessonPath, restartLesson, exitLesson, setLessonMode, selectLanguage } = useApp();
  const { activeLesson, lessonWordIndex, activeBandId, lessonProgress } = state;
  const { band, unitId, lessonIndex, mode } = useParams<{
    tier: string;
    band: string;
    unitId: string;
    lessonIndex: string;
    mode: string;
  }>();
  const parsedLessonIndex = Number(lessonIndex ?? '0');
  const routeMode = mode ?? 'intro';
  const isCompleteRoute = routeMode === 'complete';
  const isReviewRoute = routeMode === 'review';
  const lessonMode: LessonMode =
    routeMode === 'quiz' || routeMode === 'speak' || routeMode === 'intro'
      ? routeMode
      : 'intro';
  const level = band ? CHINESE_LEVEL_BY_ID[band] : undefined;
  const pendingLoadKeyRef = useRef<string>('');

  useEffect(() => {
    if (!band || !unitId || !Number.isFinite(parsedLessonIndex)) return;
    if (isMandarinBandLocked(band, state.unlockedLevels)) {
      navigate('/learn', { replace: true });
      return;
    }
    const loadKey = `${band}:${unitId}:${parsedLessonIndex}`;

    // Keep the hydrated in-memory lesson when it already matches the route.
    // This prevents refreshes from rebuilding/shuffling a different lesson instance.
    const hasLegacyReattemptWords = Boolean(
      state.activeLesson?.words?.some(
        (word) => Boolean(word.isReattempt) || Boolean(word.reattemptOfWordId)
      )
    );
    if (
      state.activeBandId === band &&
      state.activeLesson?.unitId === unitId &&
      state.activeLesson?.lessonIndex === parsedLessonIndex &&
      state.activeLesson.words.length > 0 &&
      !hasLegacyReattemptWords
    ) {
      return;
    }

    if (
      unitId === 'daily-review' &&
      state.activeLesson?.unitId === 'daily-review' &&
      state.activeBandId === band
    ) {
      return;
    }

    if (pendingLoadKeyRef.current === loadKey) return;
    pendingLoadKeyRef.current = loadKey;

    if (state.selectedLanguage !== 'zh') {
      selectLanguage('zh');
    }

    void openLessonPath(band, unitId, parsedLessonIndex)
      .then((opened) => {
        if (!opened) navigate(`/learn/${tierForBand(band)}/${band}`, { replace: true });
      })
      .finally(() => {
        if (pendingLoadKeyRef.current === loadKey) {
          pendingLoadKeyRef.current = '';
        }
      });
  }, [band, unitId, parsedLessonIndex, navigate, selectLanguage, state.selectedLanguage, state.activeBandId, state.activeLesson, state.unlockedLevels]);

  useEffect(() => {
    if (!activeLesson || isCompleteRoute || isReviewRoute || !level) return;
    const lessonKey = makeLessonKey(
      level.id,
      activeLesson.unitId,
      activeLesson.lessonIndex
    );
    const status = lessonProgress[lessonKey];
    const isMasterySession = Boolean(status?.completed) && !Boolean(status?.mastered);
    if (isMasterySession && lessonMode === 'intro') {
      navigate(
        `/learn/${tierForBand(level.id)}/${level.id}/unit/${activeLesson.unitId}/lesson/${activeLesson.lessonIndex}/quiz`,
        { replace: true }
      );
      return;
    }
    if (state.lessonMode !== lessonMode) {
      setLessonMode(lessonMode);
    }
  }, [activeLesson, isCompleteRoute, isReviewRoute, lessonMode, setLessonMode, state.lessonMode, lessonProgress, navigate, level]);

  if (!level) return <Navigate to="/learn" replace />;
  if (!activeLesson || activeBandId !== level.id) {
    return <div className="min-h-screen page-shell flex items-center justify-center text-text-med">Loading lesson…</div>;
  }

  const isComplete = lessonWordIndex >= activeLesson.words.length;
  if (!isCompleteRoute && !isReviewRoute && isComplete && state.lessonMode === lessonMode) {
    return (
      <Navigate
        to={`/learn/${tierForBand(level.id)}/${level.id}/unit/${activeLesson.unitId}/lesson/${activeLesson.lessonIndex}/complete`}
        replace
      />
    );
  }

  if (isCompleteRoute) {
    return (
      <LessonComplete
        onGoHome={onGoHome}
        onOpenProfile={onOpenProfile}
        onStartQuiz={() => {
          restartLesson();
          navigate(`/learn/${tierForBand(level.id)}/${level.id}/unit/${activeLesson.unitId}/lesson/${activeLesson.lessonIndex}/quiz`);
        }}
        onStartSpeak={() => {
          restartLesson();
          navigate(`/learn/${tierForBand(level.id)}/${level.id}/unit/${activeLesson.unitId}/lesson/${activeLesson.lessonIndex}/speak`);
        }}
        onContinue={() => {
          exitLesson();
          navigate(`/learn/${tierForBand(level.id)}/${level.id}`);
        }}
        onRestart={() => {
          restartLesson();
          navigate(`/learn/${tierForBand(level.id)}/${level.id}/unit/${activeLesson.unitId}/lesson/${activeLesson.lessonIndex}/intro`);
        }}
        onReviewMissed={() => {
          navigate(`/learn/${tierForBand(level.id)}/${level.id}/unit/${activeLesson.unitId}/lesson/${activeLesson.lessonIndex}/review`);
        }}
      />
    );
  }

  if (isReviewRoute) {
    return (
      <LessonReview
        onGoHome={onGoHome}
        onOpenProfile={onOpenProfile}
        onRetakeQuiz={() => {
          restartLesson();
          navigate(`/learn/${tierForBand(level.id)}/${level.id}/unit/${activeLesson.unitId}/lesson/${activeLesson.lessonIndex}/quiz`);
        }}
        onContinueToSpeak={() => {
          restartLesson();
          navigate(`/learn/${tierForBand(level.id)}/${level.id}/unit/${activeLesson.unitId}/lesson/${activeLesson.lessonIndex}/speak`);
        }}
        onBackToResults={() => {
          navigate(`/learn/${tierForBand(level.id)}/${level.id}/unit/${activeLesson.unitId}/lesson/${activeLesson.lessonIndex}/complete`);
        }}
      />
    );
  }

  return (
    <LessonScreen
      onGoHome={onGoHome}
      onOpenProfile={onOpenProfile}
      onModeChange={(nextMode) => {
        if (nextMode === lessonMode) return;
        navigate(
          `/learn/${tierForBand(level.id)}/${level.id}/unit/${activeLesson.unitId}/lesson/${activeLesson.lessonIndex}/${nextMode}`
        );
      }}
    />
  );
}

function AppPages() {
  const navigate = useNavigate();
  const {
    state,
    selectLanguage,
    selectLevel,
    openLessonPath,
    exitLesson,
    generateDailyReviewSet,
  } = useApp();
  const { selectedLanguage, currentLevel } = state;

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
    if (currentLevel) {
      navigate(`/learn/${tierForBand(currentLevel.id)}/${currentLevel.id}`);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/v1/me/progress`);
      if (response.ok) {
        const payload = (await response.json()) as ProgressPayload;
        const currentBandId = payload.progress?.currentBandId;
        const level = typeof currentBandId === 'string' ? CHINESE_LEVEL_BY_ID[currentBandId] : undefined;
        if (level) {
          if (isMandarinBandLocked(level.id, state.unlockedLevels)) {
            navigate('/learn');
            return;
          }
          if (selectedLanguage !== 'zh') selectLanguage('zh');
          await selectLevel(level);
          navigate(`/learn/${tierForBand(level.id)}/${level.id}`);
          return;
        }
      }
    } catch {
      // fall through to generic learn page
    }

    if (!selectedLanguage) selectLanguage('zh');
    navigate('/learn');
  }, [currentLevel, exitLesson, navigate, selectLanguage, selectLevel, selectedLanguage, state.unlockedLevels]);

  const openPracticeFromHome = useCallback(
    (kind: 'listening' | 'speaking', bandId?: string | null) => {
      const requestedBandId =
        bandId && (/^band\d+$/i.test(bandId) || bandId === 'advanced') ? bandId : 'band1';
      navigate(`/practice/${kind}/${requestedBandId}`);
    },
    [navigate]
  );

  const openDailyFromHome = useCallback(
    (bandId?: string | null) => {
      const requestedBandId =
        bandId && (/^band\d+$/i.test(bandId) || bandId === 'advanced') ? bandId : 'band1';
      navigate(`/practice/daily/${requestedBandId}`);
    },
    [navigate]
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

  function LanguageRoute() {
    if (selectedLanguage) return <Navigate to="/home" replace />;
    return (
      <LanguageSelect
        onGoHome={goHome}
        onOpenProfile={goProfile}
        onSelectLanguage={(langId: string) => {
          const isFirstSelection = !selectedLanguage;
          selectLanguage(langId);
          if (isFirstSelection) {
            trackEvent('onboarding_language_selected', { languageId: langId });
            saveOnboardingSelectionSafe(langId);
          }
          navigate('/home');
        }}
      />
    );
  }

  function HomeRoute() {
    if (!selectedLanguage) return <Navigate to="/" replace />;
    return (
      <HomeDashboard
        selectedLanguage={selectedLanguage}
        onOpenLevels={() => navigate('/learn')}
        onOpenPractice={(kind, bandId) => openPracticeFromHome(kind, bandId)}
        onOpenWeakWords={() => navigate('/profile/progress')}
        onOpenProfile={() => navigate('/profile')}
        onOpenTravelMode={(sectionId) =>
          navigate(sectionId ? `/travel/${sectionId}` : '/travel')
        }
        onOpenDailyPractice={(bandId) => openDailyFromHome(bandId)}
      />
    );
  }

  function LearnRoute() {
    return (
      <LevelSelect
        onGoHome={goHome}
        onOpenProfile={goProfile}
        onOpenMandarinTones={() => navigate('/learn/tones')}
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

  function TonesRoute() {
    if (selectedLanguage !== 'zh') return <Navigate to="/learn" replace />;
    return <MandarinTones onHome={goHome} onOpenProfile={goProfile} />;
  }

  function UnitsRoute() {
    const { band } = useParams<{ tier: string; band: string }>();
    const level = band ? CHINESE_LEVEL_BY_ID[band] : undefined;

    useEffect(() => {
      if (!level) return;
      if (selectedLanguage !== 'zh') selectLanguage('zh');
      if (currentLevel?.id !== level.id) {
        void selectLevel(level);
      }
    }, [level]);

    if (!level) return <Navigate to="/learn" replace />;
    if (isMandarinBandLocked(level.id, state.unlockedLevels)) return <Navigate to="/learn" replace />;
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
    const targetBand = band && (/^band\d+$/i.test(band) || band === 'advanced') ? band : 'band1';
    const resolvedBand = isMandarinBandLocked(targetBand, state.unlockedLevels) ? 'band1' : targetBand;
    const targetKind = kind === 'speaking' ? 'speaking' : 'listening';
    const targetUnitId =
      resolvedBand === 'advanced'
        ? `b79-${targetKind}`
        : `b${resolvedBand.match(/^band(\d+)$/i)?.[1] ?? '1'}-${targetKind}`;
    const targetMode: LessonMode = targetKind === 'listening' ? 'quiz' : 'speak';

    useEffect(() => {
      void openLessonPath(resolvedBand, targetUnitId, 0).then((opened) => {
        if (opened) {
          navigate(
            `/learn/${tierForBand(resolvedBand)}/${resolvedBand}/unit/${targetUnitId}/lesson/0/${targetMode}`,
            { replace: true }
          );
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
    }, [resolvedBand, targetKind, targetMode, targetUnitId]);

    return <div className="min-h-screen page-shell flex items-center justify-center text-text-med">Loading practice…</div>;
  }

  function DailyPracticeRoute() {
    const { band } = useParams<{ band: string }>();
    const targetBand = band && (/^band\d+$/i.test(band) || band === 'advanced') ? band : 'band1';
    const resolvedBand = isMandarinBandLocked(targetBand, state.unlockedLevels) ? 'band1' : targetBand;

    useEffect(() => {
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
    }, [generateDailyReviewSet, navigate, resolvedBand]);

    return <div className="min-h-screen page-shell flex items-center justify-center text-text-med">Building daily set…</div>;
  }

  function ProfileRoute() {
    return (
      <ProfileScreen
        onGoHome={goHome}
        currentLearningLanguage={selectedLanguage}
        onRequestLearningLanguageChange={async (languageId) => {
          await selectLevel(null);
          selectLanguage(languageId);
          navigate('/profile');
        }}
        onOpenProgress={() => navigate('/profile/progress')}
        onOpenAbout={() => navigate('/about')}
      />
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LanguageRoute />} />
      <Route path="/language" element={<LanguageRoute />} />
      <Route path="/home" element={<HomeRoute />} />
      <Route
        path="/travel"
        element={
          <TravelModePage
            onGoHome={goHome}
            onOpenProfile={goProfile}
            onOpenSection={(sectionId) => navigate(`/travel/${sectionId}`)}
          />
        }
      />
      <Route
        path="/travel/:sectionId"
        element={
          <TravelSectionRoute
            onGoHome={goHome}
            onOpenProfile={goProfile}
          />
        }
      />
      <Route path="/learn" element={<LearnRoute />} />
      <Route path="/learn/tones" element={<TonesRoute />} />
      <Route path="/learn/:tier/:band" element={<UnitsRoute />} />
      <Route
        path="/learn/:tier/:band/unit/:unitId/lesson/:lessonIndex/:mode"
        element={<LessonRoutePage onGoHome={goHome} onOpenProfile={goProfile} />}
      />
      <Route path="/practice/daily/:band" element={<DailyPracticeRoute />} />
      <Route path="/practice/:kind/:band" element={<PracticeRedirectRoute />} />
      <Route path="/profile" element={<ProfileRoute />} />
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

function TravelSectionRoute({ onGoHome, onOpenProfile }: { onGoHome: () => void; onOpenProfile: () => void }) {
  const { sectionId } = useParams<{ sectionId: string }>();
  const section = sectionId ? getTravelSectionById(sectionId) : undefined;

  if (!section) return <Navigate to="/travel" replace />;

  return (
    <TravelSectionPage
      section={section}
      onGoHome={onGoHome}
      onOpenProfile={onOpenProfile}
    />
  );
}

export default function App() {
  const Router = import.meta.env.PROD ? HashRouter : BrowserRouter;
  return (
    <AppProvider>
      <Router>
        <AppPages />
      </Router>
    </AppProvider>
  );
}
