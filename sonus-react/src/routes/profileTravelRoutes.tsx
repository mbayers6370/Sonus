import { Navigate } from 'react-router-dom';
import TravelModePage from '../components/TravelModePage';
import TravelSectionPage from '../components/TravelSectionPage';
import ProfileScreen from '../components/ProfileScreen';
import { getTravelSectionById } from '../data/travelModeData';

type TravelRouteProps = {
  onGoHome: () => void;
  onOpenProfile: () => void;
  onOpenSection: (sectionId: string) => void;
};

export function TravelRoute({ onGoHome, onOpenProfile, onOpenSection }: TravelRouteProps) {
  return (
    <TravelModePage
      onGoHome={onGoHome}
      onOpenProfile={onOpenProfile}
      onOpenSection={onOpenSection}
    />
  );
}

type TravelSectionRouteProps = {
  sectionId?: string;
  onGoHome: () => void;
  onOpenProfile: () => void;
};

export function TravelSectionRoute({ sectionId, onGoHome, onOpenProfile }: TravelSectionRouteProps) {
  const section = sectionId ? getTravelSectionById(sectionId) : undefined;
  if (!section) return <Navigate to="/travel" replace />;

  return (
    <TravelSectionPage
      key={section.id}
      section={section}
      onGoHome={onGoHome}
      onOpenProfile={onOpenProfile}
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
