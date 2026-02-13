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

const CHINESE_LEVEL_BY_ID: Record<string, LessonBand> = {
  intro: {
    id: 'intro',
    band: 0,
    name: 'Introduction',
    title: '',
    subtitle: '',
    wordCount: 0,
    wordRange: '',
    color: 'bg-gray-400',
    description: 'Start here',
    units: [],
  },
  band1: {
    id: 'band1',
    band: 1,
    name: 'Elementary I',
    title: 'Elementary I',
    subtitle: 'Foundations · Everyday Use',
    wordCount: 500,
    wordRange: '0–500',
    color: 'bg-green-500',
    description: 'Foundations · Everyday Use',
    units: [],
  },
  band2: {
    id: 'band2',
    band: 2,
    name: 'Elementary II',
    title: 'Elementary II',
    subtitle: 'Expanded Daily Life',
    wordCount: 1272,
    wordRange: '500–1272',
    color: 'bg-green-600',
    description: 'Expanded Daily Life',
    units: [],
  },
  band3: {
    id: 'band3',
    band: 3,
    name: 'Pre‑Intermediate',
    title: 'Pre‑Intermediate',
    subtitle: 'Simple Narratives',
    wordCount: 2245,
    wordRange: '1272–2245',
    color: 'bg-blue-500',
    description: 'Simple Narratives',
    units: [],
  },
  band4: {
    id: 'band4',
    band: 4,
    name: 'Intermediate I',
    title: 'Intermediate I',
    subtitle: 'Intermediate Topics',
    wordCount: 3245,
    wordRange: '2245–3245',
    color: 'bg-blue-600',
    description: 'Intermediate Topics',
    units: [],
  },
  band5: {
    id: 'band5',
    band: 5,
    name: 'Intermediate II',
    title: 'Intermediate II',
    subtitle: 'Broader Expression',
    wordCount: 4316,
    wordRange: '3245–4316',
    color: 'bg-purple-500',
    description: 'Broader Expression',
    units: [],
  },
  band6: {
    id: 'band6',
    band: 6,
    name: 'Upper‑Intermediate',
    title: 'Upper‑Intermediate',
    subtitle: 'Abstract Themes',
    wordCount: 5456,
    wordRange: '4316–5456',
    color: 'bg-purple-600',
    description: 'Abstract Themes',
    units: [],
  },
  band7: {
    id: 'band7',
    band: 7,
    name: 'Advanced I',
    title: 'Advanced I',
    subtitle: 'Complex topics · High range',
    wordCount: 7356,
    wordRange: '5456–7356',
    color: 'bg-red-500',
    description: 'Complex topics · High range',
    units: [],
  },
  band8: {
    id: 'band8',
    band: 8,
    name: 'Advanced II',
    title: 'Advanced II',
    subtitle: 'Formal language · Precision',
    wordCount: 9256,
    wordRange: '7356–9256',
    color: 'bg-slate-500',
    description: 'Formal language · Precision',
    units: [],
  },
  band9: {
    id: 'band9',
    band: 9,
    name: 'Advanced III',
    title: 'Advanced III',
    subtitle: 'Near-native range · Depth',
    wordCount: 11092,
    wordRange: '9256–11092',
    color: 'bg-slate-900',
    description: 'Near-native range · Depth',
    units: [],
  },
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
    exitLesson();
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
    setShowLevelSelect(false);
    setShowProfile(false);
    setShowProfileProgress(false);
    setShowAboutSonus(false);
    const hasActiveLesson = Boolean(activeLesson);
    if (hasActiveLesson) {
      exitLesson();
    }

    // If a level is already selected, Learn should return to its unit selector.
    if (currentLevel) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/v1/me/progress`);
      if (response.ok) {
        const payload = (await response.json()) as ProgressPayload;
        const currentBandId = payload.progress?.currentBandId;
        const currentLevelFromProgress =
          typeof currentBandId === 'string' ? CHINESE_LEVEL_BY_ID[currentBandId] : undefined;

        if (currentLevelFromProgress) {
          if (selectedLanguage !== 'zh') {
            selectLanguage('zh');
          }
          await selectLevel(currentLevelFromProgress);
          setShowLevelSelect(false);
          return;
        }
      }
    } catch {
      // If progress cannot be loaded, fall back to level selection.
    }

    if (!selectedLanguage) {
      selectLanguage('zh');
    }
    setShowLevelSelect(true);
  }, [activeLesson, currentLevel, exitLesson, selectLanguage, selectLevel, selectedLanguage]);

  const openPracticeFromHome = useCallback(
    async (kind: 'listening' | 'speaking', bandId?: string | null) => {
      setShowMandarinTones(false);
      setShowLevelSelect(false);
      setShowProfile(false);
      setShowProfileProgress(false);
      setShowAboutSonus(false);
      exitLesson();

      if (selectedLanguage !== 'zh') {
        selectLanguage('zh');
      }

      const requestedBandId = (bandId && /^band\d+$/i.test(bandId) ? bandId : 'band1') as string;
      const bandNumMatch = requestedBandId.match(/^band(\d+)$/i);
      const unitBandNum = bandNumMatch ? bandNumMatch[1] : '1';
      const requestedUnitId = `b${unitBandNum}-${kind}`;

      // Prefer same-band practice so user context feels continuous.
      const openedRequested = await openLessonPath(requestedBandId, requestedUnitId, 0);
      if (openedRequested) return;

      // Fallback to Band 1 practice units if the current band doesn't define them.
      const fallbackOpened = await openLessonPath('band1', `b1-${kind}`, 0);
      if (fallbackOpened) return;

      setShowLevelSelect(true);
    },
    [exitLesson, openLessonPath, selectLanguage, selectedLanguage]
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
        onStartSpeak={() => {
          restartLesson();
          setLessonMode('speak');
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
        onOpenPractice={(unitId) => {
          startLesson(unitId, 0);
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
        onOpenPractice={(kind, bandId) => {
          void openPracticeFromHome(kind, bandId);
        }}
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
