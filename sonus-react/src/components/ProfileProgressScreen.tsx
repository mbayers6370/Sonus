import { useEffect, useState } from 'react';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import BottomNav from './BottomNav';
import { loadWordLookup, type WordLookup } from '../lib/wordLookup';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://127.0.0.1:4000';

type Progress = {
  streak: number;
  lastActiveDate: string | null;
};

type ProgressEvent = {
  eventType: string;
  streakDelta: number;
  createdAt: string;
};

type NeedsWorkItem = {
  wordId: string;
  totalMisses: number;
  reasons: string[];
  pronunciationRisk: number;
  missedQuizCount: number;
  mispronounceCount: number;
};

interface ProfileProgressScreenProps {
  onBack: () => void;
  onGoHome: () => void;
  onGoProfile: () => void;
}

export default function ProfileProgressScreen({ onBack, onGoHome, onGoProfile }: ProfileProgressScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendOffline, setBackendOffline] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [recentEvents, setRecentEvents] = useState<ProgressEvent[]>([]);
  const [needsWork, setNeedsWork] = useState<NeedsWorkItem[]>([]);
  const [wordLookup, setWordLookup] = useState<WordLookup>({});
  const [showAllNeedsWork, setShowAllNeedsWork] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    setBackendOffline(false);
    try {
      const [progressResponse, needsWorkResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/v1/me/progress`),
        fetch(`${API_BASE_URL}/v1/me/needs-work?limit=40&minTotalMisses=3`),
      ]);
      if (!progressResponse.ok) throw new Error('Failed to load progress');
      const json = (await progressResponse.json()) as { progress: Progress; recentEvents: ProgressEvent[] };
      setProgress(json.progress);
      setRecentEvents(json.recentEvents || []);

      if (needsWorkResponse.ok) {
        const weakJson = (await needsWorkResponse.json()) as { needsWork: NeedsWorkItem[] };
        setNeedsWork(weakJson.needsWork || []);
      } else {
        setNeedsWork([]);
      }
    } catch {
      setBackendOffline(true);
      setError(null);
      setProgress({ streak: 0, lastActiveDate: null });
      setRecentEvents([]);
      setNeedsWork([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void (async () => {
      const lookup = await loadWordLookup();
      setWordLookup(lookup);
    })();
  }, []);

  const visibleNeedsWork = showAllNeedsWork ? needsWork : needsWork.slice(0, 10);

  return (
    <div className="min-h-screen page-shell px-6 pt-14 pb-24">
      <div className="relative mb-8">
        <button
          onClick={onBack}
          className="absolute left-0 -top-1 inline-flex items-center gap-1.5 p-2 -ml-2 text-text-dark hover:opacity-70 transition-opacity"
        >
          <ChevronLeft className="w-4.5 h-4.5" />
          <span className="text-sm">Back</span>
        </button>
        <div className="text-center px-12">
          <h1 className="font-playfair text-5xl font-normal text-text-dark mb-2">Progress</h1>
          <h2 className="text-base text-text-med italic">Learning metrics</h2>
        </div>
      </div>

      <div className="mb-5 flex justify-end">
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-lg text-sm font-medium hover:bg-[rgba(55,65,81,0.08)] disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {backendOffline && (
        <div className="bg-white border border-border rounded-2xl p-4 text-sm text-text-med mb-4">
          Backend appears offline. Showing cached/empty progress.
        </div>
      )}

      {error && (
        <div className="bg-white border border-[#C2410C] rounded-2xl p-4 text-sm text-[#C2410C] mb-4">
          {error}
        </div>
      )}

      <div className="bg-white border border-border rounded-2xl p-5 mb-4">
        <h3 className="font-semibold text-text-dark mb-3">Current Stats</h3>
        <div className="grid grid-cols-1 gap-4">
          <div className="p-3 rounded-xl bg-[rgba(77,124,15,0.10)]">
            <div className="text-xs uppercase tracking-wider font-mono text-text-light mb-1">Streak</div>
            <div className="text-2xl font-semibold text-[#4D7C0F]">{progress?.streak ?? 0}</div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-border rounded-2xl p-5">
        <h3 className="font-semibold text-text-dark mb-3">Recent Events</h3>
        {recentEvents.length === 0 ? (
          <div className="text-sm text-text-med">No recent progress events.</div>
        ) : (
          <div className="space-y-2">
            {recentEvents.map((event, idx) => (
              <div key={`${event.eventType}-${event.createdAt}-${idx}`} className="border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-semibold text-text-dark">{event.eventType}</div>
                  <div className="text-xs text-text-light">{new Date(event.createdAt).toLocaleString()}</div>
                </div>
                <div className="text-xs text-text-med">
                  Streak {event.streakDelta >= 0 ? '+' : ''}{event.streakDelta}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-border rounded-2xl p-5 mt-4">
        <h3 className="font-semibold text-text-dark mb-3">Words To Work On</h3>
        {needsWork.length === 0 ? (
          <div className="text-sm text-text-med">No words currently in your needs-work list.</div>
        ) : (
          <>
            <div className="space-y-2">
              {visibleNeedsWork.map((item) => (
                <div key={item.wordId} className="border border-border rounded-xl p-3">
                  {wordLookup[item.wordId] ? (
                    <div className="mb-2">
                      <div className="font-noto-serif text-2xl text-text-dark leading-none">
                        {wordLookup[item.wordId].simp}
                      </div>
                      <div className="text-sm text-text-med mt-1">{wordLookup[item.wordId].pinyin}</div>
                      <div className="text-sm text-text-light mt-0.5">{wordLookup[item.wordId].en}</div>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-semibold text-text-dark">Needs Work</div>
                    <div className="text-xs text-[#C2410C] font-semibold">{item.totalMisses} misses</div>
                  </div>
                  <div className="text-xs text-text-med">
                    Risk {item.pronunciationRisk.toFixed(2)} · Quiz misses {item.missedQuizCount} · Speak misses{' '}
                    {item.mispronounceCount}
                  </div>
                </div>
              ))}
            </div>
            {needsWork.length > 10 && (
              <button
                onClick={() => setShowAllNeedsWork((prev) => !prev)}
                className="mt-3 text-sm font-medium text-[#1E3A8A] hover:opacity-80"
              >
                {showAllNeedsWork ? 'Show less' : `View all (${needsWork.length})`}
              </button>
            )}
          </>
        )}
      </div>

      <BottomNav active="profile" onHome={onGoHome} onProfile={onGoProfile} />
    </div>
  );
}
