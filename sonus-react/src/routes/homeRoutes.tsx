import { Navigate } from 'react-router-dom';
import LanguageSelect from '../components/LanguageSelect';
import HomeDashboard from '../components/HomeDashboard';
import { saveOnboardingSelectionSafe } from '../lib/backendApi';
import { trackEvent } from '../lib/analytics';

type LanguageRouteProps = {
  selectedLanguage: string | null;
  languageResolved: boolean;
  onGoHome: () => void;
  onOpenProfile: () => void;
  onSelectLanguage: (languageId: string) => void;
};

export function LanguageRoute(props: LanguageRouteProps) {
  const { selectedLanguage, languageResolved, onGoHome, onOpenProfile, onSelectLanguage } = props;

  if (!selectedLanguage && !languageResolved) {
    return (
      <div className="min-h-screen page-shell flex items-center justify-center text-text-med">
        Loading language…
      </div>
    );
  }
  if (selectedLanguage) return <Navigate to="/home" replace />;

  return (
    <LanguageSelect
      onGoHome={onGoHome}
      onOpenProfile={onOpenProfile}
      onSelectLanguage={(langId: string) => {
        const isFirstSelection = !selectedLanguage;
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
  onResumeToUnit: (target: { bandId: string; unitId: string; lessonIndex: number; isCheckpoint: boolean }) => void;
  onOpenPractice: (kind: 'listening' | 'speaking', bandId?: string | null) => void;
  onOpenWeakWords: () => void;
  onOpenProfile: () => void;
  onOpenTravelMode: (sectionId?: string) => void;
  onOpenDailyPractice: (bandId?: string | null) => void;
};

export function HomeRoute(props: HomeRouteProps) {
  const {
    selectedLanguage,
    onOpenLevels,
    onResumeToUnit,
    onOpenPractice,
    onOpenWeakWords,
    onOpenProfile,
    onOpenTravelMode,
    onOpenDailyPractice,
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
      onOpenTravelMode={onOpenTravelMode}
      onOpenDailyPractice={onOpenDailyPractice}
    />
  );
}
