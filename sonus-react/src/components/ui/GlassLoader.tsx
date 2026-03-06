import { useId, useMemo } from 'react';

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
  const loaderId = useId();
  const lineIdx = useMemo(() => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint32Array(1);
      crypto.getRandomValues(bytes);
      return bytes[0] % CHEEKY_LOADER_LINES.length;
    }
    // Deterministic fallback for environments without crypto.
    let hash = 0;
    for (let idx = 0; idx < loaderId.length; idx += 1) {
      hash = (hash << 5) - hash + loaderId.charCodeAt(idx);
      hash |= 0;
    }
    return Math.abs(hash) % CHEEKY_LOADER_LINES.length;
  }, [loaderId]);

  const resolvedMessage = useMemo(() => {
    const explicit = (message || '').trim();
    if (explicit) return explicit;
    return CHEEKY_LOADER_LINES[lineIdx] || CHEEKY_LOADER_LINES[0];
  }, [lineIdx, message]);

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
