import { BookOpen, House, LogOut, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface BottomNavProps {
  onHome: () => void;
  onProfile: () => void;
  onLearn?: () => void;
  active?: 'home' | 'learn' | 'profile';
}

export default function BottomNav({ onHome, onProfile, onLearn, active = 'home' }: BottomNavProps) {
  const { signOut, isDemo } = useAuth();
  const handleLearn = () => {
    if (onLearn) {
      onLearn();
      return;
    }
    window.dispatchEvent(new CustomEvent('sonus:learn'));
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-bg-warm/95 backdrop-blur-xl border-t border-border z-50"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: 'calc(var(--sonus-bottom-nav-height, 6.1rem) + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
      }}
    >
      <div className="h-full w-full relative px-4">
        <div className="flex h-[82%] items-center justify-center pt-1.5">
          <div className="flex items-center justify-center gap-4 sm:gap-6">
          <button
            onClick={onHome}
            className={`flex flex-col items-center gap-1 px-6 py-2 transition-colors ${
              active === 'home' ? 'text-[#186E95] font-semibold' : 'text-text-light hover:text-text-dark'
            }`}
          >
            <House className="w-6 h-6" />
            <span className={`text-xs ${active === 'home' ? 'font-semibold' : ''}`}>Home</span>
          </button>
          <button
            onClick={handleLearn}
            className={`flex flex-col items-center gap-1 px-6 py-2 transition-colors ${
              active === 'learn' ? 'text-[#186E95] font-semibold' : 'text-text-light hover:text-text-dark'
            }`}
          >
            <BookOpen className="w-6 h-6" />
            <span className={`text-xs ${active === 'learn' ? 'font-semibold' : ''}`}>Learn</span>
          </button>
          <button
            onClick={onProfile}
            className={`flex flex-col items-center gap-1 px-6 py-2 transition-colors ${
              active === 'profile' ? 'text-[#186E95] font-semibold' : 'text-text-light hover:text-text-dark'
            }`}
          >
            <User className="w-6 h-6" />
            <span className={`text-xs ${active === 'profile' ? 'font-semibold' : ''}`}>Profile</span>
          </button>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[18%] bg-[#2B3440] border-t border-white/10">
          <div className="flex h-full items-center justify-center gap-2 px-3 text-[0.52rem] leading-none font-light text-[#C7D0DC] sm:text-[0.58rem]">
            <Link to="/privacy" className="underline-offset-2 hover:underline font-mono">
            Privacy
            </Link>
            <span aria-hidden="true">|</span>
            <Link to="/terms" className="underline-offset-2 hover:underline font-mono">
              Terms
            </Link>
            <span aria-hidden="true">|</span>
            <Link to="/contact" className="underline-offset-2 hover:underline font-mono">
            Contact
            </Link>
            <span aria-hidden="true">|</span>
            <span className="font-mono">© {new Date().getFullYear()} Sonus</span>
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="hidden lg:flex absolute right-4 top-[41%] -translate-y-1/2 items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium leading-none text-text-light transition-colors hover:text-text-dark"
          aria-label={isDemo ? 'Exit Demo' : 'Sign Out'}
          title={isDemo ? 'Exit Demo' : 'Sign Out'}
        >
          <LogOut className="w-4 h-4" />
          <span>{isDemo ? 'Exit Demo' : 'Sign Out'}</span>
        </button>
      </div>
    </div>
  );
}
