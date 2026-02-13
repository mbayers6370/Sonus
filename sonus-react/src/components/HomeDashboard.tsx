import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bolt,
  BookOpenText,
  Headphones,
  ListChecks,
  Mic,
} from 'lucide-react';
import BottomNav from './BottomNav';
import { getUnitMetadata } from '../data/unitMetadata';
import { useAudio } from '../hooks/useAudio';

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

type HitokotoResponse = {
  hitokoto: string;
  from?: string;
  from_who?: string | null;
};

type DailyPhraseCache = {
  date: string;
  spotlight: {
    text: string;
    source: string;
  };
  motivation: {
    text: string;
    source: string;
  };
  translation: string;
};

interface HomeDashboardProps {
  selectedLanguage: string;
  onOpenLevels: () => void;
  onOpenPractice: (kind: 'listening' | 'speaking', bandId?: string | null) => void;
  onOpenWeakWords: () => void;
  onOpenProfile: () => void;
}

const LANGUAGE_LABELS: Record<string, string> = {
  zh: 'Mandarin',
  jp: 'Japanese',
  kr: 'Korean',
  fr: 'French',
};

const ZH_SPOTLIGHT_FALLBACK = {
  text: '学而时习之，不亦说乎。',
  translation: 'To learn and practice often, is that not a joy?',
  source: '《论语》',
};

const ZH_MOTIVATION_FALLBACK = {
  text: '千里之行，始于足下。',
  source: '《道德经》',
};

const DAILY_PHRASE_CACHE_KEY = 'sonus:daily-phrases:zh';

const PG13_BLOCKLIST = [
  /自杀/u,
  /杀人/u,
  /血/u,
  /尸/u,
  /强奸/u,
  /色情/u,
  /性爱/u,
  /\bsex\b/i,
  /\bsuicide\b/i,
  /\bkill\b/i,
  /\bmurder\b/i,
  /\brape\b/i,
  /\bnude\b/i,
  /\bporn\b/i,
  /\bdrugs?\b/i,
];

function isPg13Text(value: string) {
  const text = value.trim();
  if (!text) return false;
  return !PG13_BLOCKLIST.some((rule) => rule.test(text));
}

async function fetchChinesePhrase(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('phrase fetch failed');
  const json = (await response.json()) as HitokotoResponse;
  if (!json.hitokoto) throw new Error('empty phrase');
  return {
    text: json.hitokoto,
    source: [json.from_who, json.from].filter(Boolean).join(' · ') || '一言',
  };
}

async function fetchChinesePhrasePg13(url: string, attempts = 6) {
  for (let i = 0; i < attempts; i += 1) {
    const phrase = await fetchChinesePhrase(url);
    if (isPg13Text(phrase.text) && isPg13Text(phrase.source)) {
      return phrase;
    }
  }
  throw new Error('No PG-13 phrase found');
}

export default function HomeDashboard({
  selectedLanguage,
  onOpenLevels,
  onOpenPractice,
  onOpenWeakWords,
  onOpenProfile,
}: HomeDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Progress>({
    streak: 0,
    currentBandId: null,
    currentUnitId: null,
    currentLessonIdx: null,
  });
  const [needsWorkCount, setNeedsWorkCount] = useState(0);
  const [spotlightPhrase, setSpotlightPhrase] = useState({
    text: ZH_SPOTLIGHT_FALLBACK.text,
    source: ZH_SPOTLIGHT_FALLBACK.source,
  });
  const [motivationPhrase, setMotivationPhrase] = useState(ZH_MOTIVATION_FALLBACK);
  const [spotlightTranslation, setSpotlightTranslation] = useState(ZH_SPOTLIGHT_FALLBACK.translation);
  const { speak } = useAudio();

  const languageLabel = LANGUAGE_LABELS[selectedLanguage] || 'Language';
  const hasSavedLessonPath =
    Boolean(progress.currentBandId) &&
    Boolean(progress.currentUnitId) &&
    progress.currentLessonIdx !== null;
  const lessonNumber = progress.currentLessonIdx !== null ? progress.currentLessonIdx + 1 : null;

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

  const speakPhrase = () => {
    if (!spotlightPhrase.text) return;
    speak(spotlightPhrase.text, spotlightPhrase.text);
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

        if (mounted && selectedLanguage === 'zh') {
          const today = new Date().toISOString().slice(0, 10);
          try {
            const cachedRaw = localStorage.getItem(DAILY_PHRASE_CACHE_KEY);
            if (cachedRaw) {
              const cached = JSON.parse(cachedRaw) as DailyPhraseCache;
              if (cached.date === today) {
                setSpotlightPhrase(cached.spotlight);
                setMotivationPhrase(cached.motivation);
                setSpotlightTranslation(cached.translation);
                return;
              }
            }
          } catch {
            // cache parse/read errors should not block fetch
          }

          try {
            const [spotlight, motivation] = await Promise.all([
              fetchChinesePhrasePg13('https://v1.hitokoto.cn/?c=i&c=d&encode=json&max_length=22'),
              fetchChinesePhrasePg13('https://v1.hitokoto.cn/?c=k&c=i&encode=json&max_length=22'),
            ]);
            setSpotlightPhrase(spotlight);
            setMotivationPhrase(motivation);
            setSpotlightTranslation('');
            let translationText = '';

            try {
              const translateRes = await fetch(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(spotlight.text)}&langpair=zh-CN|en-US`
              );
              if (translateRes.ok) {
                const translateJson = (await translateRes.json()) as {
                  responseData?: { translatedText?: string };
                };
                const translated = translateJson.responseData?.translatedText?.trim();
                if (translated && isPg13Text(translated)) {
                  translationText = translated;
                  setSpotlightTranslation(translated);
                }
              }
            } catch {
              setSpotlightTranslation('');
            }

            try {
              const payload: DailyPhraseCache = {
                date: today,
                spotlight,
                motivation,
                translation: translationText,
              };
              localStorage.setItem(DAILY_PHRASE_CACHE_KEY, JSON.stringify(payload));
            } catch {
              // Cache write failures should not block phrase rendering.
            }
          } catch {
            setSpotlightPhrase(ZH_SPOTLIGHT_FALLBACK);
            setMotivationPhrase(ZH_MOTIVATION_FALLBACK);
            setSpotlightTranslation(ZH_SPOTLIGHT_FALLBACK.translation);
          }
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
    <div className="min-h-screen page-shell px-6 pt-14 pb-24 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-br from-[#1E3A8A]/18 via-[#4D7C0F]/10 to-transparent pointer-events-none" />

      <div className="mb-8 relative text-center">
        <h1 className="font-playfair text-5xl font-normal text-text-dark mb-2 leading-tight">Home</h1>
        <h2 className="text-base text-text-med italic">
          Built around your daily rhythm in <span className="font-playfair">{languageLabel}</span>
        </h2>
      </div>

      <div className="mb-3 relative">
        <div className="inline-flex items-center rounded-full px-3 py-1 text-[10px] uppercase tracking-wider font-mono bg-white/70 border border-border text-text-med">
          <span className="font-playfair normal-case tracking-normal text-xs mr-1">{languageLabel}</span>
          Learning Hub
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 auto-rows-[minmax(180px,auto)] relative">

        <section className="bg-white text-text-dark border border-[#1E3A8A]/35 rounded-2xl p-5 min-h-[210px] shadow-[0_20px_40px_-28px_rgba(30,58,138,0.28)]">
          <div className="font-playfair text-2xl leading-none mb-3 text-[#1E3A8A]">Resume</div>
          {hasSavedLessonPath ? (
            <>
              <div className="text-xs uppercase tracking-wider font-mono text-text-light mb-2">Lesson Path</div>
              <div className="text-sm text-text-med mb-1">
                <span className="font-semibold text-text-dark">{formatBandLabel(progress.currentBandId)}</span>
              </div>
              <div className="text-sm text-text-med mb-1">
                <span className="font-semibold text-text-dark">{formatUnitLabel(progress.currentUnitId)}</span>
              </div>
              <div className="text-sm text-text-med mb-4">
                Lesson{' '}
                <span className="font-semibold text-text-dark">{lessonNumber}</span>
              </div>
            </>
          ) : (
            <div className="text-sm text-text-med mb-4">
              No saved lesson path yet. Start your first lesson and Sonus will remember exactly where to continue.
            </div>
          )}
          <button
            onClick={onOpenLevels}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#1E3A8A] text-white font-semibold hover:bg-[#182F74] transition-colors"
          >
            {hasSavedLessonPath ? 'Continue Learning' : 'Start Learning'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </section>

        <section className="bg-white text-text-dark border border-[#1E3A8A]/35 rounded-2xl p-5 min-h-[210px] shadow-[0_20px_40px_-28px_rgba(30,58,138,0.28)]">
          <div className="font-playfair text-2xl leading-none mb-3 text-[#1E3A8A]">Today</div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-[rgba(77,124,15,0.10)] border border-[#4D7C0F]/20">
              <div className="text-[10px] uppercase tracking-wider font-mono text-text-light mb-1">Streak</div>
              <div className="text-xl font-semibold text-[#4D7C0F]">{progress.streak}</div>
            </div>
            <div className="p-3 rounded-xl bg-[rgba(55,65,81,0.08)] border border-[#374151]/20">
              <div className="text-[10px] uppercase tracking-wider font-mono text-text-light mb-1">Needs Work</div>
              <div className="text-xl font-semibold text-[#374151]">{needsWorkCount}</div>
            </div>
          </div>
        </section>

        <section className="bg-white text-text-dark border border-[#C2410C]/35 rounded-2xl p-5 min-h-[260px] shadow-[0_20px_40px_-28px_rgba(194,65,12,0.26)]">
          <div className="font-playfair text-2xl leading-none mb-3 text-[#C2410C]">Daily Phrase</div>
          {selectedLanguage === 'zh' ? (
            <>
              <p className="font-noto-serif text-xl text-text-dark mb-1">{spotlightPhrase.text}</p>
              <p className="text-xs text-text-med">{spotlightPhrase.source}</p>
              {spotlightTranslation ? (
                <p className="text-xs text-text-med mt-2 italic">English: {spotlightTranslation}</p>
              ) : null}
              <button
                onClick={speakPhrase}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[rgba(194,65,12,0.10)] border border-[#C2410C]/25 text-[#C2410C] text-sm font-medium hover:bg-[rgba(194,65,12,0.16)] transition-colors"
              >
                <Mic className="w-4 h-4" />
                Pronounce Phrase
              </button>
            </>
          ) : (
            <p className="text-sm text-text-med">New phrase drops here for your active language.</p>
          )}
        </section>

        <section className="bg-[#4D7C0F] text-white border border-[#4D7C0F] rounded-2xl p-5 min-h-[260px] shadow-[0_20px_40px_-28px_rgba(77,124,15,0.36)]">
          <div className="font-playfair text-2xl leading-none mb-2 text-white">Practice Focus</div>
          <p className="text-sm text-white/85 mb-4">
            {selectedLanguage === 'zh'
              ? 'Run focused listening and speaking reps for your current band.'
              : 'Practice labs are currently available for Mandarin.'}
          </p>
          {selectedLanguage === 'zh' ? (
            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={() => onOpenPractice('listening', progress.currentBandId)}
                className="w-full inline-flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/14 border border-white/25 hover:bg-white/20 transition-colors"
              >
                <span className="inline-flex items-center gap-2 text-sm font-medium text-white">
                  <Headphones className="w-4 h-4" />
                  Listening Practice
                </span>
                <ArrowRight className="w-4 h-4 text-white/85" />
              </button>
              <button
                onClick={() => onOpenPractice('speaking', progress.currentBandId)}
                className="w-full inline-flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/14 border border-white/25 hover:bg-white/20 transition-colors"
              >
                <span className="inline-flex items-center gap-2 text-sm font-medium text-white">
                  <Mic className="w-4 h-4" />
                  Speaking Practice
                </span>
                <ArrowRight className="w-4 h-4 text-white/85" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLevels}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white text-[#4D7C0F] font-semibold hover:bg-[#F3F4F6] transition-colors"
            >
              Continue Learning
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {selectedLanguage === 'zh' && (
            <p className="text-xs text-white/75 mt-3">
              {motivationPhrase.text}
              {motivationPhrase.source ? ` · ${motivationPhrase.source}` : ''}
            </p>
          )}
        </section>

        <section className="col-span-2 bg-white text-text-dark border border-[#374151]/35 rounded-2xl p-5 shadow-[0_20px_40px_-28px_rgba(55,65,81,0.22)]">
          <div className="font-playfair text-2xl leading-none mb-3 text-[#374151]">Shortcuts</div>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={onOpenWeakWords}
              className="w-full flex items-center justify-between px-3 py-3 rounded-xl border border-border hover:bg-[rgba(55,65,81,0.06)]"
            >
              <span className="inline-flex items-center gap-2 text-sm text-text-dark">
                <ListChecks className="w-4 h-4 text-[#4D7C0F]" />
                Progress Check
              </span>
              <ArrowRight className="w-4 h-4 text-text-light" />
            </button>
            <button
              onClick={onOpenLevels}
              className="w-full flex items-center justify-between px-3 py-3 rounded-xl border border-border hover:bg-[rgba(55,65,81,0.06)]"
            >
              <span className="inline-flex items-center gap-2 text-sm text-text-dark">
                <BookOpenText className="w-4 h-4 text-[#1E3A8A]" />
                Continue Learning
              </span>
              <ArrowRight className="w-4 h-4 text-text-light" />
            </button>
            <button
              onClick={onOpenProfile}
              className="w-full flex items-center justify-between px-3 py-3 rounded-xl border border-border hover:bg-[rgba(55,65,81,0.06)]"
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
