import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { BandData, Word } from '../types/lesson.types';
import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';
import { apiFetch } from '../lib/apiClient';

type ReviewQueueItem = {
  wordId: string;
  quizDueAt: string;
  quizIntervalDays: number;
  quizEase: number;
  pronunciationRisk: number;
  missedQuizCount: number;
  mispronounceCount: number;
  lastSeenAt: string | null;
  lastCorrectAt: string | null;
  priorityScore: number;
  overdueDays: number;
  reasons: string[];
};

type ReviewQueueResponse = {
  count: number;
  limit: number;
  queue: ReviewQueueItem[];
};

interface ReviewQueueProps {
  selectedLanguage: string;
  onGoHome: () => void;
  onOpenProfile: () => void;
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

type WordLookup = Record<string, Pick<Word, 'id' | 'simp' | 'pinyin' | 'en'>>;

async function loadWordLookup(selectedLanguage: string): Promise<WordLookup> {
  if (selectedLanguage !== 'zh') return {};

  const bandIds = ['band1', 'band2', 'band3', 'band4', 'band5', 'band6', 'band7', 'band8', 'band9'];
  const responses = await Promise.all(
    bandIds.map(async (bandId) => {
      const response = await fetch(`/data/zh/${bandId}.json`, { cache: 'no-store' });
      if (!response.ok) return null;
      return (await response.json()) as BandData;
    })
  );

  const lookup: WordLookup = {};
  for (const bandData of responses) {
    if (!bandData) continue;
    const unitEntries = Object.values(bandData.units || {});
    for (const unit of unitEntries) {
      for (const word of unit.words || []) {
        lookup[word.id] = {
          id: word.id,
          simp: word.simp,
          pinyin: word.pinyin,
          en: word.en,
        };
      }
    }
  }

  return lookup;
}

export default function ReviewQueue({
  selectedLanguage,
  onGoHome,
  onOpenProfile,
}: ReviewQueueProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [wordLookup, setWordLookup] = useState<WordLookup>({});

  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch('/v1/me/review-queue?limit=30');
      if (!response.ok) throw new Error(`Failed to load review queue (${response.status})`);
      const json = (await response.json()) as ReviewQueueResponse;
      setQueue(json.queue || []);
    } catch (err) {
      setError((err as Error).message || 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, []);

  useEffect(() => {
    let mounted = true;
    void loadWordLookup(selectedLanguage)
      .then((lookup) => {
        if (!mounted) return;
        setWordLookup(lookup);
      })
      .catch(() => {
        if (!mounted) return;
        setWordLookup({});
      });
    return () => {
      mounted = false;
    };
  }, [selectedLanguage]);

  return (
    <div className="min-h-screen page-shell px-6 with-bottom-nav">
      <GlassHeader title="Review Queue" />

      <div className="mb-5 flex justify-end">
        <button
          onClick={() => void loadQueue()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-lg text-sm font-medium hover:bg-[rgba(31,42,55,0.08)] disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="bg-white border border-border rounded-2xl p-6 text-sm text-text-med">
          Loading review queue...
        </div>
      )}

      {!loading && error && (
        <div className="bg-white border border-[#C2410C] rounded-2xl p-6 text-sm text-[#C2410C]">
          {error}
        </div>
      )}

      {!loading && !error && queue.length === 0 && (
        <div className="bg-white border border-border rounded-2xl p-6 text-sm text-text-med">
          No words are currently due. Keep practicing and this queue will fill automatically.
        </div>
      )}

      {!loading && !error && queue.length > 0 && (
        <div className="space-y-3">
          {queue.map((item) => (
            <div key={item.wordId} className="bg-white border border-border rounded-2xl p-5">
              {wordLookup[item.wordId] ? (
                <div className="mb-3">
                  <div className="secondary-font text-3xl text-text-dark leading-none">
                    {wordLookup[item.wordId].simp}
                  </div>
                  <div className="text-sm text-text-med mt-1">
                    {wordLookup[item.wordId].pinyin}
                  </div>
                  <div className="text-sm text-text-light mt-0.5">
                    {wordLookup[item.wordId].en}
                  </div>
                </div>
              ) : null}

              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="main-font text-2xl text-text-dark">
                  {wordLookup[item.wordId]?.simp || 'Word'}
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wider font-mono text-text-light mb-1">Priority</div>
                  <div className="text-xl font-semibold text-[#186E95]">{item.priorityScore}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {item.reasons.map((reason) => (
                  <span
                    key={reason}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-[rgba(24,110,149,0.12)] text-[#186E95]"
                  >
                    {reasonLabel(reason)}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-y-1 text-sm text-text-med">
                <div>Overdue: <span className="text-text-dark font-medium">{item.overdueDays} days</span></div>
                <div>Pronunciation risk: <span className="text-text-dark font-medium">{item.pronunciationRisk.toFixed(2)}</span></div>
                <div>Missed quiz count: <span className="text-text-dark font-medium">{item.missedQuizCount}</span></div>
                <div>Mispronounce count: <span className="text-text-dark font-medium">{item.mispronounceCount}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
