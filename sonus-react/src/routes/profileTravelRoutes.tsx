import { Navigate } from 'react-router-dom';
import TravelModePage from '../components/TravelModePage';
import TravelSectionPage from '../components/TravelSectionPage';
import ProfileScreen from '../components/ProfileScreen';
import { getTravelSectionById } from '../data/travelModeData';
import { useApp } from '../contexts/AppContext';

type TravelRouteProps = {
  onGoHome: () => void;
  onOpenProfile: () => void;
  onOpenSection: (sectionId: string) => void;
};

export function TravelRoute({ onGoHome, onOpenProfile, onOpenSection }: TravelRouteProps) {
  const { state } = useApp();
  return (
    <TravelModePage
      onGoHome={onGoHome}
      onOpenProfile={onOpenProfile}
      onOpenSection={onOpenSection}
      selectedLanguage={state.selectedLanguage}
    />
  );
}

type TravelSectionRouteProps = {
  sectionId?: string;
  onGoHome: () => void;
  onOpenProfile: () => void;
};

export function TravelSectionRoute({ sectionId, onGoHome, onOpenProfile }: TravelSectionRouteProps) {
  const { state } = useApp();
  const section = sectionId ? getTravelSectionById(sectionId, state.selectedLanguage) : undefined;
  if (!section) return <Navigate to="/travel" replace />;

  return (
    <TravelSectionPage
      key={section.id}
      section={section}
      onGoHome={onGoHome}
      onOpenProfile={onOpenProfile}
      selectedLanguage={state.selectedLanguage}
    />
  );
}

type ProfileRouteProps = {
  selectedLanguage: string | null;
  languageResolved: boolean;
  onGoHome: () => void;
  onOpenProgress: () => void;
  onOpenAbout: () => void;
  onChangeLearningLanguage: (languageId: string) => Promise<void>;
};

export function ProfileRoute(props: ProfileRouteProps) {
  const {
    selectedLanguage,
    languageResolved,
    onGoHome,
    onOpenProgress,
    onOpenAbout,
    onChangeLearningLanguage,
  } = props;

  if (!selectedLanguage) {
    if (!languageResolved) {
      return (
        <div className="min-h-screen page-shell flex items-center justify-center text-text-med">
          Loading language…
        </div>
      );
    }
    return <Navigate to="/" replace />;
  }

  return (
    <ProfileScreen
      onGoHome={onGoHome}
      currentLearningLanguage={selectedLanguage}
      onRequestLearningLanguageChange={onChangeLearningLanguage}
      onOpenProgress={onOpenProgress}
      onOpenAbout={onOpenAbout}
    />
  );
}
