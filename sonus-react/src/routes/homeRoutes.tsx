import { Navigate } from 'react-router-dom';
import LanguageSelect from '../components/LanguageSelect';
import HomeDashboard from '../components/HomeDashboard';
import GlassLoader from '../components/ui/GlassLoader';
import { saveOnboardingSelectionSafe } from '../lib/backendApi';
import { trackEvent } from '../lib/analytics';
import type { LessonMode } from '../types/lesson.types';

type LanguageRouteProps = {
  selectedLanguage: string | null;
  languageResolved: boolean;
  onGoHome: () => void;
  onOpenProfile: () => void;
  onSelectLanguage: (languageId: string) => void;
  switchMode?: boolean;
  onCancelSwitch?: () => void;
};

export function LanguageRoute(props: LanguageRouteProps) {
  const {
    selectedLanguage,
    languageResolved,
    onGoHome,
    onOpenProfile,
    onSelectLanguage,
    switchMode = false,
    onCancelSwitch,
  } = props;

  if (!selectedLanguage && !languageResolved) {
    return (
      <div className="min-h-screen page-shell flex items-center justify-center">
        <GlassLoader compact message="Loading language..." />
      </div>
    );
  }
  if (selectedLanguage && !switchMode) return <Navigate to="/home" replace />;

  return (
    <LanguageSelect
      onGoHome={onGoHome}
      onOpenProfile={onOpenProfile}
      currentLanguage={selectedLanguage}
      switchMode={switchMode}
      onCancelSwitch={onCancelSwitch}
      onSelectLanguage={(langId: string) => {
        const isFirstSelection = !selectedLanguage && !switchMode;
        onSelectLanguage(langId);
        if (isFirstSelection) {
          trackEvent('onboarding_language_selected', { languageId: langId });
          saveOnboardingSelectionSafe(langId);
        }
      }}
    />
  );
}

type HomeRouteProps = {
  selectedLanguage: string | null;
  onOpenLevels: () => void;
  onResumeToUnit: (target: { bandId: string; unitId: string; lessonIndex: number; isCheckpoint: boolean; mode?: LessonMode }) => void;
  onOpenPractice: (kind: 'listening' | 'speaking', bandId?: string | null) => void;
  onOpenWeakWords: () => void;
  onOpenProfile: () => void;
  onOpenAbout: () => void;
  onOpenTravelMode: (sectionId?: string) => void;
};

export function HomeRoute(props: HomeRouteProps) {
  const {
    selectedLanguage,
    onOpenLevels,
    onResumeToUnit,
    onOpenPractice,
    onOpenWeakWords,
    onOpenProfile,
    onOpenAbout,
    onOpenTravelMode,
  } = props;

  if (!selectedLanguage) return <Navigate to="/" replace />;
  return (
    <HomeDashboard
      selectedLanguage={selectedLanguage}
      onOpenLevels={onOpenLevels}
      onResumeToUnit={onResumeToUnit}
      onOpenPractice={onOpenPractice}
      onOpenWeakWords={onOpenWeakWords}
      onOpenProfile={onOpenProfile}
      onOpenAbout={onOpenAbout}
      onOpenTravelMode={onOpenTravelMode}
    />
  );
}
