import { AppProvider, useApp } from './contexts/AppContext';
import type { LessonBand } from './types/lesson.types';
import LanguageSelect from './components/LanguageSelect';
import LevelSelect from './components/LevelSelect';
import UnitSelect from './components/UnitSelect';
import LessonScreen from './components/LessonScreen';
import LessonComplete from './components/LessonComplete';
import MandarinTones from './components/MandarinTones';
import HomeDashboard from './components/HomeDashboard';
import AboutSonusScreen from './components/AboutSonusScreen';
import ProfileScreen from './components/ProfileScreen';
import ProfileProgressScreen from './components/ProfileProgressScreen';
import { useCallback, useEffect, useState } from 'react';
import { saveOnboardingSelectionSafe } from './lib/backendApi';
import { trackEvent } from './lib/analytics';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://127.0.0.1:4000';

type ProgressPayload = {
  progress?: {
    currentBandId?: string | null;
    currentUnitId?: string | null;
    currentLessonIdx?: number | null;
  };
};

function AppRouter() {
  const [showMandarinTones, setShowMandarinTones] = useState(false);
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showProfileProgress, setShowProfileProgress] = useState(false);
  const [showAboutSonus, setShowAboutSonus] = useState(false);
  const { state, selectLanguage, selectLevel, startLesson, openLessonPath, restartLesson, exitLesson, setLessonMode } =
    useApp();
  const { selectedLanguage, currentLevel, activeLesson, lessonWordIndex } = state;

  const goHome = () => {
    setShowMandarinTones(false);
    setShowLevelSelect(false);
    setShowProfile(false);
    setShowProfileProgress(false);
    setShowAboutSonus(false);
    exitLesson();
    void selectLevel(null);
  };

  const goProfile = () => {
    setShowMandarinTones(false);
    setShowLevelSelect(false);
    setShowProfileProgress(false);
    setShowAboutSonus(false);
    setShowProfile(true);
  };

  const switchLearningLanguage = async (languageId: string) => {
    setShowMandarinTones(false);
    setShowLevelSelect(false);
    setShowProfileProgress(false);
    setShowAboutSonus(false);
    await selectLevel(null);
    selectLanguage(languageId);
    setShowProfile(true);
  };

  const goLearn = useCallback(async () => {
    setShowMandarinTones(false);
    setShowProfile(false);
    setShowProfileProgress(false);
    setShowAboutSonus(false);

    try {
      const response = await fetch(`${API_BASE_URL}/v1/me/progress`);
      if (response.ok) {
        const payload = (await response.json()) as ProgressPayload;
        const currentBandId = payload.progress?.currentBandId;
        const currentUnitId = payload.progress?.currentUnitId;
        const currentLessonIdx = payload.progress?.currentLessonIdx;

        if (
          typeof currentBandId === 'string' &&
          typeof currentUnitId === 'string' &&
          typeof currentLessonIdx === 'number'
        ) {
          if (selectedLanguage !== 'zh') {
            selectLanguage('zh');
          }
          const resumed = await openLessonPath(currentBandId, currentUnitId, currentLessonIdx);
          if (resumed) {
            setShowLevelSelect(false);
            return;
          }
        }
      }
    } catch {
      // If progress cannot be loaded, fall back to level selection.
    }

    if (!selectedLanguage) {
      selectLanguage('zh');
    }
    setShowLevelSelect(true);
  }, [openLessonPath, selectLanguage, selectedLanguage]);

  useEffect(() => {
    const handler = () => {
      void goLearn();
    };
    window.addEventListener('sonus:learn', handler);
    return () => {
      window.removeEventListener('sonus:learn', handler);
    };
  }, [goLearn]);

  const isLessonComplete = activeLesson && lessonWordIndex >= activeLesson.words.length;

  if (isLessonComplete) {
    return (
      <LessonComplete
        onGoHome={goHome}
        onOpenProfile={goProfile}
        onBack={() => {
          exitLesson();
        }}
        onStartQuiz={() => {
          restartLesson();
          setLessonMode('quiz');
        }}
        onContinue={() => {
          exitLesson();
        }}
        onRestart={() => {
          restartLesson();
        }}
      />
    );
  }

  if (activeLesson) {
    return <LessonScreen onGoHome={goHome} onOpenProfile={goProfile} />;
  }

  if (showProfileProgress) {
    return (
      <ProfileProgressScreen
        onGoHome={goHome}
        onGoProfile={() => {
          setShowProfileProgress(false);
          setShowProfile(true);
        }}
        onBack={() => {
          setShowProfileProgress(false);
          setShowProfile(true);
        }}
      />
    );
  }

  if (showAboutSonus) {
    return (
      <AboutSonusScreen
        onGoHome={goHome}
        onGoProfile={() => {
          setShowAboutSonus(false);
          setShowProfile(true);
        }}
        onBack={() => {
          setShowAboutSonus(false);
          setShowProfile(true);
        }}
      />
    );
  }

  if (showProfile) {
    return (
      <ProfileScreen
        onGoHome={goHome}
        currentLearningLanguage={selectedLanguage}
        onRequestLearningLanguageChange={switchLearningLanguage}
        onOpenProgress={() => {
          setShowProfile(false);
          setShowProfileProgress(true);
        }}
        onOpenAbout={() => {
          setShowProfile(false);
          setShowAboutSonus(true);
        }}
        onBack={() => {
          setShowProfile(false);
        }}
      />
    );
  }

  if (selectedLanguage === 'zh' && showMandarinTones && !currentLevel) {
    return (
      <MandarinTones
        onBack={() => setShowMandarinTones(false)}
        onHome={goHome}
        onOpenProfile={goProfile}
      />
    );
  }

  if (currentLevel) {
    return (
      <UnitSelect
        onGoHome={goHome}
        onOpenProfile={goProfile}
        onBack={() => {
          selectLevel(null);
        }}
        onSelectLesson={(unitId, lessonIndex) => {
          startLesson(unitId, lessonIndex);
        }}
      />
    );
  }

  if (selectedLanguage && !showLevelSelect) {
    return (
      <HomeDashboard
        selectedLanguage={selectedLanguage}
        onOpenLevels={() => setShowLevelSelect(true)}
        onOpenWeakWords={() => setShowProfileProgress(true)}
        onOpenProfile={goProfile}
      />
    );
  }

  if (selectedLanguage) {
    return (
      <LevelSelect
        onGoHome={goHome}
        onOpenProfile={goProfile}
        onBack={() => {
          setShowMandarinTones(false);
          setShowLevelSelect(false);
        }}
        onOpenMandarinTones={() => {
          setShowMandarinTones(true);
        }}
        onSelectLevel={(level: LessonBand) => {
          setShowMandarinTones(false);
          setShowLevelSelect(false);
          selectLevel(level);
        }}
      />
    );
  }

  return (
    <LanguageSelect
      onGoHome={goHome}
      onOpenProfile={() => {
        goProfile();
      }}
      onSelectLanguage={(langId: string) => {
        const isFirstSelection = !selectedLanguage;
        setShowProfile(false);
        setShowProfileProgress(false);
        setShowAboutSonus(false);
        setShowLevelSelect(false);
        selectLanguage(langId);
        if (isFirstSelection) {
          trackEvent('onboarding_language_selected', { languageId: langId });
          saveOnboardingSelectionSafe(langId);
        }
      }}
    />
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
