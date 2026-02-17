import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import BottomNav from './BottomNav';
import { loadWordLookup, type WordLookup } from '../lib/wordLookup';
import GlassHeader from './GlassHeader';
import { apiFetch } from '../lib/apiClient';

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
  onGoHome: () => void;
  onGoProfile: () => void;
}

const ROWS_PER_PAGE = 2;

function getNeedsWorkColumns(width: number) {
  if (width >= 1024) return 4;
  if (width >= 640) return 3;
  return 2;
}

export default function ProfileProgressScreen({ onGoHome, onGoProfile }: ProfileProgressScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendOffline, setBackendOffline] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [recentEvents, setRecentEvents] = useState<ProgressEvent[]>([]);
  const [needsWork, setNeedsWork] = useState<NeedsWorkItem[]>([]);
  const [wordLookup, setWordLookup] = useState<WordLookup>({});
  const [visibleRows, setVisibleRows] = useState(ROWS_PER_PAGE);
  const [needsWorkColumns, setNeedsWorkColumns] = useState(() =>
    typeof window === 'undefined' ? 4 : getNeedsWorkColumns(window.innerWidth)
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    setBackendOffline(false);
    try {
      const [progressResponse, needsWorkResponse] = await Promise.all([
        apiFetch('/v1/me/progress'),
        apiFetch('/v1/me/needs-work?limit=40&minTotalMisses=3'),
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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateColumns = () => {
      setNeedsWorkColumns(getNeedsWorkColumns(window.innerWidth));
    };

    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  useEffect(() => {
    setVisibleRows(ROWS_PER_PAGE);
  }, [needsWork.length]);

  const visibleNeedsWorkCount = Math.min(needsWork.length, visibleRows * needsWorkColumns);
  const visibleNeedsWork = needsWork.slice(0, visibleNeedsWorkCount);
  const hasMoreNeedsWork = visibleNeedsWorkCount < needsWork.length;

  return (
    <div className="min-h-screen page-shell px-6 pb-24">
      <GlassHeader title="Progress" />

      <div className="space-y-4">
        <div className="flex justify-end">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/95 border border-border rounded-xl text-sm font-medium hover:bg-[rgba(55,65,81,0.08)] disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {backendOffline && (
          <div className="bg-white/95 border border-border rounded-2xl p-4 text-sm text-text-med">
            Backend appears offline. Showing cached/empty progress.
          </div>
        )}

        {error && (
          <div className="bg-white/95 border border-[#C2410C] rounded-2xl p-4 text-sm text-[#C2410C]">
            {error}
          </div>
        )}

        <div className="bg-white/95 border border-border rounded-3xl p-5 shadow-[0_20px_42px_-34px_rgba(31,42,55,0.28)]">
          <h3 className="font-semibold text-text-dark mb-3">Current Stats</h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="p-3 rounded-xl border border-[rgba(62,86,72,0.22)] bg-[rgba(62,86,72,0.10)]">
              <div className="text-xs uppercase tracking-wider font-mono text-text-light mb-1">Streak</div>
              <div className="text-2xl font-semibold text-[#3E5648]">{progress?.streak ?? 0}</div>
            </div>
          </div>
        </div>

        <div className="bg-white/95 border border-border rounded-3xl p-5">
          <h3 className="font-semibold text-text-dark mb-3">Recent Events</h3>
          {recentEvents.length === 0 ? (
            <div className="text-sm text-text-med">No recent progress events.</div>
          ) : (
            <div className="space-y-2">
              {recentEvents.map((event, idx) => (
                <div key={`${event.eventType}-${event.createdAt}-${idx}`} className="border border-border rounded-xl p-3 bg-[#FBFBF9]">
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

        <div className="bg-white/95 border border-border rounded-3xl p-5">
          <h3 className="font-semibold text-text-dark mb-3">Words To Work On</h3>
          {needsWork.length === 0 ? (
            <div className="text-sm text-text-med">No words currently in your needs-work list.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {visibleNeedsWork.map((item) => (
                  <div
                    key={item.wordId}
                    className="border border-border rounded-xl p-2 bg-[#FBFBF9] min-h-[116px] sm:min-h-[124px] flex flex-col items-center justify-center text-center"
                  >
                    {wordLookup[item.wordId] ? (
                      <div>
                        <div className="secondary-font text-2xl text-text-dark leading-none">
                          {wordLookup[item.wordId].simp}
                        </div>
                        <div className="text-xs text-text-med mt-1">{wordLookup[item.wordId].pinyin}</div>
                        <div className="text-xs text-text-light mt-0.5">{wordLookup[item.wordId].en}</div>
                      </div>
                    ) : <div className="text-xs text-text-med">Word</div>}
                    <div className="mt-1 text-xs text-[#C2410C] font-semibold">
                      {item.totalMisses} misses
                    </div>
                  </div>
                ))}
              </div>
              {hasMoreNeedsWork && (
                <button
                  onClick={() => setVisibleRows((prev) => prev + ROWS_PER_PAGE)}
                  className="mt-3 text-sm font-medium text-[#186E95] hover:opacity-80"
                >
                  Show more ({needsWork.length})
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <BottomNav active="profile" onHome={onGoHome} onProfile={onGoProfile} />
    </div>
  );
}
