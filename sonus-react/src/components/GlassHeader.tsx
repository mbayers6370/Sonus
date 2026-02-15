import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface GlassHeaderProps {
  title: string;
  className?: string;
  spacerClassName?: string;
  titleClassName?: string;
  scrolledClassName?: string;
  scrolledTitleClassName?: string;
  scrollThreshold?: number;
  showLogo?: boolean;
}

export default function GlassHeader({
  title,
  className = '',
  spacerClassName = '',
  titleClassName = 'text-text-dark',
  scrolledClassName = '',
  scrolledTitleClassName = '',
  scrollThreshold = 8,
  showLogo = true,
}: GlassHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > scrollThreshold);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [scrollThreshold]);

  return (
    <>
      <div
        className={`fixed top-0 left-0 right-0 z-50 h-20 border-b border-white/45 bg-white/62 backdrop-blur-2xl transition-colors ${className} ${isScrolled ? scrolledClassName : ''}`}
      >
        <div className="h-full px-6 flex items-center justify-center relative">
          {showLogo ? (
            <button
              type="button"
              onClick={() => navigate('/home')}
              aria-label="Go to home"
              className="absolute left-6 inline-flex items-center justify-center"
            >
              <img
                src="/branding/logo_name_solo.png"
                alt="Sonus"
                className="h-6 md:h-7 w-auto object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </button>
          ) : null}
          <h1
            className={`text-center main-font text-4xl font-normal leading-tight transition-colors ${titleClassName} ${isScrolled ? scrolledTitleClassName : ''}`}
          >
            {title}
          </h1>
        </div>
      </div>
      <div className={`h-20 mb-6 ${spacerClassName}`} />
    </>
  );
}
