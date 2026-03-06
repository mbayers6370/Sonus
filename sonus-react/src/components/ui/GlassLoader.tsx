import { useMemo } from 'react';

interface GlassLoaderProps {
  message?: string;
  className?: string;
  compact?: boolean;
}

const CHEEKY_LOADER_LINES = [
  'Loading language learning',
  'Polishing your fluency runway',
  'Packing your next phrasebook',
  'Tuning your pronunciation engine',
  'Warming up your travel vocabulary',
  'Calibrating your language instincts',
] as const;

export default function GlassLoader({
  message,
  className = '',
  compact = false,
}: GlassLoaderProps) {
  const fallbackMessage = useMemo(
    () => CHEEKY_LOADER_LINES[Math.floor(Math.random() * CHEEKY_LOADER_LINES.length)],
    []
  );
  const resolvedMessage = (message || '').trim() || fallbackMessage;

  return (
    <div className={`sonus-loader-wrap ${compact ? 'sonus-loader-wrap--compact' : ''} ${className}`}>
      <div className="sonus-loader" role="status" aria-live="polite" aria-label={`${resolvedMessage}...`}>
        <span className="sonus-loader__wordmark">SONUS</span>
        <p className="sonus-loader__message">
          {resolvedMessage}
          <span className="sonus-loader__dots" aria-hidden="true" />
        </p>
      </div>
    </div>
  );
}
