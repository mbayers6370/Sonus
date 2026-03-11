import { Navigate } from 'react-router-dom';
import TravelModePage from '../components/TravelModePage';
import TravelSectionPage from '../components/TravelSectionPage';
import ProfileScreen from '../components/ProfileScreen';
import GlassLoader from '../components/ui/GlassLoader';
import { getTravelSectionById } from '../data/travelModeData';
import { useApp } from '../contexts/AppContext';
import { normalizeLanguageId } from '../lib/languageRuntime';

type TravelRouteProps = {
  onGoHome: () => void;
  onOpenProfile: () => void;
  onOpenSection: (sectionId: string) => void;
};

export function TravelRoute({ onGoHome, onOpenProfile, onOpenSection }: TravelRouteProps) {
  const { state } = useApp();
  const selectedTravelLanguage = resolveTravelLanguage(state);
  return (
    <TravelModePage
      onGoHome={onGoHome}
      onOpenProfile={onOpenProfile}
      onOpenSection={onOpenSection}
      selectedLanguage={selectedTravelLanguage}
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
  const selectedTravelLanguage = resolveTravelLanguage(state);
  const section = sectionId ? getTravelSectionById(sectionId, selectedTravelLanguage) : undefined;
  if (!section) return <Navigate to="/travel" replace />;

  return (
    <TravelSectionPage
      key={section.id}
      section={section}
      onGoHome={onGoHome}
      onOpenProfile={onOpenProfile}
      selectedLanguage={selectedTravelLanguage}
    />
  );
}

function resolveTravelLanguage(state: ReturnType<typeof useApp>['state']): string {
  const activeBandId =
    state.currentLevel?.id ||
    state.activeBandId ||
    state.resumeCheckpoint?.bandId ||
    null;

  if (activeBandId && /^n[1-5]$/i.test(activeBandId)) return 'ja';
  if (activeBandId && (/^band\d+$/i.test(activeBandId) || activeBandId === 'advanced')) return 'ja';

  const normalized = normalizeLanguageId(state.selectedLanguage);
  if (normalized === 'ja') return normalized;
  return 'ja';
}

type ProfileRouteProps = {
  selectedLanguage: string | null;
  languageResolved: boolean;
  onGoHome: () => void;
  onOpenProgress: () => void;
  onOpenAbout: () => void;
  onSwitchLanguage: (languageId: string) => void | Promise<void>;
};

export function ProfileRoute(props: ProfileRouteProps) {
  const {
    selectedLanguage,
    languageResolved,
    onGoHome,
    onOpenProgress,
    onOpenAbout,
    onSwitchLanguage,
  } = props;

  if (!selectedLanguage) {
    if (!languageResolved) {
      return (
        <div className="min-h-screen page-shell flex items-center justify-center">
          <GlassLoader compact message="Loading language..." />
        </div>
      );
    }
    return <Navigate to="/" replace />;
  }

  return (
    <ProfileScreen
      onGoHome={onGoHome}
      currentLearningLanguage={selectedLanguage}
      onSwitchLanguage={onSwitchLanguage}
      onOpenProgress={onOpenProgress}
      onOpenAbout={onOpenAbout}
    />
  );
}
