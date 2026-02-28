import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import BottomNav from './BottomNav';
import { loadWordLookup, type WordLookup } from '../lib/wordLookup';
import GlassHeader from './GlassHeader';
import { apiFetch } from '../lib/apiClient';
import { useApp } from '../contexts/AppContext';

type NeedsWorkItem = {
  wordId: string;
  priorityScore: number;
  totalMisses?: number;
  reasons: string[];
  pronunciationRisk: number;
  missedQuizCount: number;
  mispronounceCount: number;
};

interface WeakWordsScreenProps {
  onGoHome: () => void;
  onGoProfile: () => void;
}

function reasonLabel(reason: string) {
  switch (reason) {
    case 'quiz_overdue':
      return 'Quiz Overdue';
    case 'missed_quiz':
      return 'Missed Quiz';
    case 'pronunciation_risk':
      return 'Pronunciation Risk';
    default:
      return reason;
  }
}

export default function WeakWordsScreen({ onGoHome, onGoProfile }: WeakWordsScreenProps) {
  const { state } = useApp();
  const languageId = state.selectedLanguage === 'jp' ? 'ja' : (state.selectedLanguage || 'zh');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendOffline, setBackendOffline] = useState(false);
  const [needsWork, setNeedsWork] = useState<NeedsWorkItem[]>([]);
  const [wordLookup, setWordLookup] = useState<WordLookup>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setBackendOffline(false);
      try {
        const response = await apiFetch(`/v1/me/needs-work?limit=30&minTotalMisses=1&language=${encodeURIComponent(languageId)}`);
        if (!response.ok) throw new Error('Failed to load words to work on');
        const json = (await response.json()) as { needsWork: NeedsWorkItem[] };
        const normalized = (json.needsWork || [])
          .map((item) => ({
            ...item,
            totalMisses: item.totalMisses ?? item.missedQuizCount + item.mispronounceCount,
          }))
          .filter((item) => item.totalMisses >= 1);
        setNeedsWork(normalized);
      } catch {
        setBackendOffline(true);
        setError(null);
        setNeedsWork([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
    void (async () => {
      const lookup = await loadWordLookup(languageId);
      setWordLookup(lookup);
    })();
  }, [languageId]);

  return (
    <div className="min-h-screen page-shell px-6 with-bottom-nav">
      <GlassHeader title="Words To Work On" />

      <div className="mb-5 flex justify-end">
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-lg text-sm font-medium hover:bg-[rgba(31,42,55,0.08)] disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {backendOffline && (
        <div className="bg-white border border-border rounded-2xl p-4 text-sm text-text-med mb-4">
          Backend appears offline. Word tracking is unavailable right now.
        </div>
      )}

      {error && (
        <div className="bg-white border border-[#C2410C] rounded-2xl p-4 text-sm text-[#C2410C] mb-4">
          {error}
        </div>
      )}

      <div className="bg-white border border-border rounded-2xl p-5 mb-4">
        {needsWork.length === 0 ? (
          <div className="text-sm text-text-med">
            No words to work on right now. Missed words appear here after the first miss.
          </div>
        ) : (
          <div className="space-y-2">
            {needsWork.map((item) => (
              <div key={item.wordId} className="border border-border rounded-xl p-3">
                {wordLookup[item.wordId] ? (
                  <div className="mb-2">
                    <div className="secondary-font text-2xl text-text-dark leading-none">
                      {wordLookup[item.wordId].simp}
                    </div>
                    <div className="text-sm text-text-med mt-1">{wordLookup[item.wordId].pinyin}</div>
                    <div className="text-sm text-text-light mt-0.5">{wordLookup[item.wordId].en}</div>
                  </div>
                ) : null}

                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-text-dark">Needs Work</div>
                  <div className="text-sm text-[#C2410C] font-semibold">
                    {item.totalMisses ?? item.missedQuizCount + item.mispronounceCount} misses
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-2">
                  {item.reasons.map((reason) => (
                    <span
                      key={reason}
                      className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-mono bg-[rgba(24,110,149,0.12)] text-[#186E95]"
                    >
                      {reasonLabel(reason)}
                    </span>
                  ))}
                </div>

                <div className="text-xs text-text-med">
                  Priority {item.priorityScore} · Risk {item.pronunciationRisk.toFixed(2)} · Quiz misses {item.missedQuizCount}{' '}
                  · Speak misses {item.mispronounceCount}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav active="profile" onHome={onGoHome} onProfile={onGoProfile} />
    </div>
  );
}
