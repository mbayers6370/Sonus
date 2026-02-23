import { Navigate } from 'react-router-dom';
import FoundationsHub from '../components/foundations/FoundationsHub';
import MandarinTones from '../components/foundations/MandarinTones';
import PinyinFoundations from '../components/foundations/PinyinFoundations';
import CharacterFoundations from '../components/foundations/CharacterFoundations';

type SharedProps = {
  selectedLanguage: string | null;
  onGoHome: () => void;
  onOpenProfile: () => void;
};

export function TonesRoute({ selectedLanguage, onGoHome, onOpenProfile }: SharedProps) {
  if (selectedLanguage !== 'zh') return <Navigate to="/learn" replace />;
  return <MandarinTones onHome={onGoHome} onOpenProfile={onOpenProfile} />;
}

type FoundationsRouteProps = SharedProps & {
  onOpenTones: () => void;
  onOpenPinyin: () => void;
  onOpenCharacters: () => void;
};

export function FoundationsRoute(props: FoundationsRouteProps) {
  const {
    selectedLanguage,
    onGoHome,
    onOpenProfile,
    onOpenTones,
    onOpenPinyin,
    onOpenCharacters,
  } = props;
  if (selectedLanguage !== 'zh') return <Navigate to="/learn" replace />;
  return (
    <FoundationsHub
      onGoHome={onGoHome}
      onOpenProfile={onOpenProfile}
      onOpenTones={onOpenTones}
      onOpenPinyin={onOpenPinyin}
      onOpenCharacters={onOpenCharacters}
    />
  );
}

export function PinyinRoute({ selectedLanguage, onGoHome, onOpenProfile }: SharedProps) {
  if (selectedLanguage !== 'zh') return <Navigate to="/learn" replace />;
  return <PinyinFoundations onGoHome={onGoHome} onOpenProfile={onOpenProfile} />;
}

export function CharactersRoute({ selectedLanguage, onGoHome, onOpenProfile }: SharedProps) {
  if (selectedLanguage !== 'zh') return <Navigate to="/learn" replace />;
  return <CharacterFoundations onGoHome={onGoHome} onOpenProfile={onOpenProfile} />;
}
