import { useEffect, useState } from 'react';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import type { BandData, Word } from '../types/lesson.types';
import BottomNav from './BottomNav';

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
  onBack: () => void;
  selectedLanguage: string;
  onGoHome: () => void;
  onOpenProfile: () => void;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://127.0.0.1:4000';

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
      const response = await fetch(`/data/zh/${bandId}.json`);
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
  onBack,
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
      const response = await fetch(`${API_BASE_URL}/v1/me/review-queue?limit=30`);
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
          <h1 className="font-playfair text-5xl font-normal text-text-dark mb-2">
            Review Queue
          </h1>
          <h2 className="text-base text-text-med italic">Words that need repetition now</h2>
        </div>
      </div>

      <div className="mb-5 flex justify-end">
        <button
          onClick={() => void loadQueue()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-lg text-sm font-medium hover:bg-[rgba(55,65,81,0.08)] disabled:opacity-60"
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
                  <div className="font-noto-serif text-3xl text-text-dark leading-none">
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
                <div className="font-playfair text-2xl text-text-dark">
                  {wordLookup[item.wordId]?.simp || 'Word'}
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wider font-mono text-text-light mb-1">Priority</div>
                  <div className="text-xl font-semibold text-[#1E3A8A]">{item.priorityScore}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {item.reasons.map((reason) => (
                  <span
                    key={reason}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-[rgba(30,58,138,0.12)] text-[#1E3A8A]"
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
