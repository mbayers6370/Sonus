import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bolt,
  BriefcaseConveyorBelt,
  Headphones,
  ListChecks,
  Mic,
} from 'lucide-react';
import BottomNav from './BottomNav';
import { getUnitMetadata } from '../data/unitMetadata';
import GlassHeader from './GlassHeader';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://127.0.0.1:4000';

type Progress = {
  streak: number;
  currentBandId: string | null;
  currentUnitId: string | null;
  currentLessonIdx: number | null;
};

type NeedsWorkResponse = {
  needsWork?: Array<{ wordId: string }>;
};

interface HomeDashboardProps {
  selectedLanguage: string;
  onOpenLevels: () => void;
  onOpenPractice: (kind: 'listening' | 'speaking', bandId?: string | null) => void;
  onOpenWeakWords: () => void;
  onOpenProfile: () => void;
  onOpenTravelMode: (sectionId?: string) => void;
}

const LANGUAGE_LABELS: Record<string, string> = {
  zh: 'Mandarin',
  jp: 'Japanese',
  kr: 'Korean',
  fr: 'French',
};

export default function HomeDashboard({
  selectedLanguage,
  onOpenLevels,
  onOpenPractice,
  onOpenWeakWords,
  onOpenProfile,
  onOpenTravelMode,
}: HomeDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Progress>({
    streak: 0,
    currentBandId: null,
    currentUnitId: null,
    currentLessonIdx: null,
  });
  const [needsWorkCount, setNeedsWorkCount] = useState(0);

  const languageLabel = LANGUAGE_LABELS[selectedLanguage] || 'Language';
  const hasSavedLessonPath =
    Boolean(progress.currentBandId) &&
    Boolean(progress.currentUnitId) &&
    progress.currentLessonIdx !== null;
  const lessonNumber = progress.currentLessonIdx !== null ? progress.currentLessonIdx + 1 : null;
  const cardShell =
    'dashboard-card-enter rounded-3xl border p-6 sm:p-5 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.35)] transition-all duration-200 hover:-translate-y-0.5';

  const formatBandLabel = (bandId: string | null) => {
    if (!bandId) return 'Band';
    const matched = /^band(\d+)$/i.exec(bandId);
    if (matched) return `Band ${matched[1]}`;
    return bandId.toUpperCase();
  };

  const formatUnitLabel = (unitId: string | null) => {
    if (!unitId) return 'Unit';
    const fromMetadata =
      progress.currentBandId && progress.currentUnitId
        ? getUnitMetadata(progress.currentBandId, progress.currentUnitId)?.name
        : undefined;
    if (fromMetadata) return fromMetadata;
    return unitId
      .replace(/^[a-z]\d+-/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  useEffect(() => {
    let mounted = true;
    void (async () => {
      setLoading(true);
      try {
        const [progressRes, weakRes] = await Promise.all([
          fetch(`${API_BASE_URL}/v1/me/progress`),
          fetch(`${API_BASE_URL}/v1/me/needs-work?limit=30&minTotalMisses=3`),
        ]);

        if (mounted && progressRes.ok) {
          const json = (await progressRes.json()) as { progress?: Progress };
          if (json.progress) setProgress(json.progress);
        }

        if (mounted && weakRes.ok) {
          const json = (await weakRes.json()) as NeedsWorkResponse;
          setNeedsWorkCount((json.needsWork || []).length);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedLanguage]);

  return (
    <div className="min-h-screen page-shell px-6 pb-24 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-br from-[#186E95]/18 via-[#3E5648]/10 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-white/45 via-white/15 to-transparent pointer-events-none" />

      <GlassHeader title={`${languageLabel}`} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-[minmax(180px,auto)] relative">
        <section
          className={`${cardShell} md:order-1 bg-white/95 text-text-dark border-[#186E95]/35 min-h-[210px] text-center flex flex-col justify-center`}
          style={{ animationDelay: '35ms' }}
        >
          <div className="main-font text-2xl leading-none mb-3 text-[#186E95]">Resume</div>
          {hasSavedLessonPath ? (
            <>
              <div className="text-[11px] tracking-wide font-mono text-text-light mb-2">Lesson path</div>
              <div className="text-sm text-text-dark font-medium mb-1">{formatBandLabel(progress.currentBandId)}</div>
              <div className="text-sm text-text-med mb-4">
                {formatUnitLabel(progress.currentUnitId)} · Lesson {lessonNumber}
              </div>
            </>
          ) : (
            <div className="text-sm text-text-med mb-4">
              No saved lesson path yet. Start your first lesson and Sonus will remember exactly where to continue.
            </div>
          )}
          <div className="max-w-md mx-auto">
            <button
              onClick={onOpenLevels}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#186E95] text-white font-semibold hover:bg-[#145C7C] transition-colors"
            >
              {hasSavedLessonPath ? 'Continue learning' : 'Start learning'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        <section
          className={`${cardShell} md:order-3 md:col-span-2 bg-[#3E5648] text-white border-[#3E5648]/90 min-h-[260px] shadow-[0_20px_40px_-28px_rgba(62,86,72,0.36)] text-center flex flex-col justify-center`}
          style={{ animationDelay: '135ms' }}
        >
          <div className="main-font text-2xl leading-none mb-2 text-white">Travel Mode</div>
          <p className="text-sm leading-relaxed text-white/86 mb-4 max-w-md mx-auto">
            Leaving soon? Prioritize high-utility {languageLabel} for airports, hotels, transport, food, and emergencies so you can handle real situations with confidence.
          </p>
          <div className="grid grid-cols-3 gap-2 mb-4 max-w-md mx-auto">
            <button onClick={() => onOpenTravelMode('airport-arrival')} className="px-2 py-2 rounded-xl text-xs bg-white/10 border border-white/20 hover:bg-white/15 transition-colors">
              Airport
            </button>
            <button onClick={() => onOpenTravelMode('hotel')} className="px-2 py-2 rounded-xl text-xs bg-white/10 border border-white/20 hover:bg-white/15 transition-colors">
              Hotel
            </button>
            <button onClick={() => onOpenTravelMode('emergency')} className="px-2 py-2 rounded-xl text-xs bg-white/10 border border-white/20 hover:bg-white/15 transition-colors">
              Emergency
            </button>
          </div>
          <div className="max-w-md mx-auto">
            <button
              onClick={() => onOpenTravelMode()}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl bg-white/12 border border-white/30 hover:bg-white/18 transition-colors"
            >
              <BriefcaseConveyorBelt className="w-4 h-4" />
              Explore travel content
              <ArrowRight className="w-4 h-4 text-white/85" />
            </button>
          </div>
        </section>

        <section
          className={`${cardShell} md:order-2 bg-[#186E95] text-white border-[#186E95]/90 min-h-[210px] shadow-[0_20px_40px_-28px_rgba(24,110,149,0.36)] text-center flex flex-col justify-center`}
          style={{ animationDelay: '85ms' }}
        >
          <div className="main-font text-2xl leading-none mb-2 text-white">Practice Focus</div>
          <div className="inline-flex w-fit mx-auto flex-col items-center gap-0.5 px-2 py-1 rounded-md border border-white/30 bg-white/12 text-white/90 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-mono leading-tight">Adaptive Mix</span>
            <span className="text-[11px] uppercase tracking-wider font-mono leading-tight">70% Weak Words</span>
            <span className="text-[11px] uppercase tracking-wider font-mono leading-tight">30% Reinforce</span>
          </div>
          <p className="text-sm leading-relaxed text-white/86 mb-4 max-w-md mx-auto">
            {selectedLanguage === 'zh'
              ? needsWorkCount > 0
                ? `${needsWorkCount} words are in your practice queue. Let's work on those first, then reinforce with current-band reps!`
                : 'No active weak-word queue right now. Run focused reps to keep performance sharp and prevent backslide.'
              : `Practice labs are currently available for ${languageLabel}.`}
          </p>
          {selectedLanguage === 'zh' ? (
            <div className="flex items-center justify-center gap-3 max-w-md mx-auto">
              <button
                onClick={() => onOpenPractice('listening', progress.currentBandId)}
                className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/14 border border-white/25 hover:bg-white/20 transition-colors"
                aria-label="Listening practice"
                title="Listening practice"
              >
                <Headphones className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => onOpenPractice('speaking', progress.currentBandId)}
                className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/14 border border-white/25 hover:bg-white/20 transition-colors"
                aria-label="Speaking practice"
                title="Speaking practice"
              >
                <Mic className="w-5 h-5 text-white" />
              </button>
            </div>
          ) : (
            <div className="max-w-md mx-auto">
              <button
                onClick={onOpenLevels}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white text-[#186E95] font-semibold hover:bg-[#F3F4F6] transition-colors"
              >
                Continue learning
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </section>

        <section
          className={`${cardShell} md:order-4 md:col-span-2 bg-white/95 text-text-dark border-[#374151]/35 flex flex-col justify-center`}
          style={{ animationDelay: '235ms' }}
        >
          <div className="main-font text-2xl leading-none mb-3 text-[#374151]">Shortcuts</div>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={onOpenWeakWords}
              className="w-full flex items-center justify-between px-3 py-3 rounded-2xl border border-border hover:bg-[rgba(55,65,81,0.06)] transition-colors"
            >
              <span className="inline-flex items-center gap-2 text-sm text-text-dark">
                <ListChecks className="w-4 h-4 text-[#3E5648]" />
                Progress Check
              </span>
              <ArrowRight className="w-4 h-4 text-text-light" />
            </button>
            <button
              onClick={onOpenProfile}
              className="w-full flex items-center justify-between px-3 py-3 rounded-2xl border border-border hover:bg-[rgba(55,65,81,0.06)] transition-colors"
            >
              <span className="inline-flex items-center gap-2 text-sm text-text-dark">
                <Bolt className="w-4 h-4 text-[#374151]" />
                Profile Settings
              </span>
              <ArrowRight className="w-4 h-4 text-text-light" />
            </button>
          </div>
        </section>
      </div>

      {loading && <div className="mt-4 text-xs text-text-light">Refreshing dashboard data...</div>}

      <BottomNav active="home" onHome={() => {}} onProfile={onOpenProfile} />
    </div>
  );
}
