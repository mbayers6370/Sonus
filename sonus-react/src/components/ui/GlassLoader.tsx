import type { CSSProperties } from 'react';

interface GlassLoaderProps {
  message?: string;
  className?: string;
  compact?: boolean;
}

const DOT_COUNT = 16;

export default function GlassLoader({
  message = 'Loading...',
  className = '',
  compact = false,
}: GlassLoaderProps) {
  return (
    <div className={`sonus-loader-wrap ${compact ? 'sonus-loader-wrap--compact' : ''} ${className}`}>
      <div
        className="sonus-loader"
        role="status"
        aria-live="polite"
        aria-label={message}
        style={{ '--dot-total': DOT_COUNT } as CSSProperties}
      >
        <div className="sonus-loader__core" aria-hidden="true">
          <span className="sonus-loader__wordmark">SONUS</span>
        </div>
        <div className="sonus-loader__ring" aria-hidden="true" />
        {Array.from({ length: DOT_COUNT }, (_, idx) => (
          <span
            // Varying lift makes the ring read as a wave even before animation starts.
            key={idx}
            className="sonus-loader__dot"
            style={
              {
                '--dot-index': idx,
                '--dot-lift': `${Math.sin((idx / DOT_COUNT) * Math.PI * 2) * 0.24}rem`,
              } as CSSProperties
            }
            aria-hidden="true"
          />
        ))}
      </div>
      <p className="sonus-loader__message">{message}</p>
    </div>
  );
}
