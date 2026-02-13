import { BookOpen, Languages, User } from 'lucide-react';

interface BottomNavProps {
  onHome: () => void;
  onProfile: () => void;
  onLearn?: () => void;
  active?: 'home' | 'learn' | 'profile';
}

export default function BottomNav({ onHome, onProfile, onLearn, active = 'home' }: BottomNavProps) {
  const handleLearn = () => {
    if (onLearn) {
      onLearn();
      return;
    }
    window.dispatchEvent(new CustomEvent('sonus:learn'));
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-bg-warm/95 backdrop-blur-xl border-t border-border flex items-center justify-center gap-8 z-50">
      <button
        onClick={onHome}
        className={`flex flex-col items-center gap-1 px-6 py-2 transition-colors ${
          active === 'home' ? 'text-text-dark' : 'text-text-light hover:text-text-dark'
        }`}
      >
        <Languages className="w-6 h-6" />
        <span className="text-xs">Home</span>
      </button>
      <button
        onClick={handleLearn}
        className={`flex flex-col items-center gap-1 px-6 py-2 transition-colors ${
          active === 'learn' ? 'text-text-dark' : 'text-text-light hover:text-text-dark'
        }`}
      >
        <BookOpen className="w-6 h-6" />
        <span className="text-xs">Learn</span>
      </button>
      <button
        onClick={onProfile}
        className={`flex flex-col items-center gap-1 px-6 py-2 transition-colors ${
          active === 'profile' ? 'text-text-dark' : 'text-text-light hover:text-text-dark'
        }`}
      >
        <User className="w-6 h-6" />
        <span className="text-xs">Profile</span>
      </button>
    </div>
  );
}
