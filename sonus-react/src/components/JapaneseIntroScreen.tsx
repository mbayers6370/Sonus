import { ArrowLeft, BookOpen, Languages, Layers, Route, Sparkles, Target } from 'lucide-react';
import type { ReactNode } from 'react';
import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';

interface JapaneseIntroScreenProps {
  onGoHome: () => void;
  onOpenProfile: () => void;
  onBackToLearn: () => void;
}

const INTRO_CARDS = [
  {
    id: 'welcome',
    title: 'Welcome to Japanese',
    icon: Sparkles,
    accent: 'border-[#374151]/90 bg-[linear-gradient(160deg,#374151_0%,#2B3440_52%,#24303A_100%)] text-white',
    badge: 'bg-white/16 text-white border border-white/35',
    bodyTone: 'text-white/92',
    span: 'lg:col-span-2',
  },
  {
    id: 'writing',
    title: 'Writing Systems',
    icon: Languages,
    accent: 'border-[#186E95]/65 bg-white text-text-dark',
    badge: 'bg-[#D2E7F3] text-[#186E95]',
    bodyTone: 'text-text-med',
    span: 'lg:col-span-2',
  },
  {
    id: 'structure',
    title: 'Basic Structure',
    icon: Layers,
    accent: 'border-[#3E5648]/65 bg-white text-text-dark',
    badge: 'bg-[#D8E5DE] text-[#3E5648]',
    bodyTone: 'text-text-med',
    span: '',
  },
  {
    id: 'levels',
    title: 'Understanding the Levels',
    icon: Target,
    accent: 'border-[#186E95]/65 bg-white text-text-dark',
    badge: 'bg-[#D7EAF5] text-[#186E95]',
    bodyTone: 'text-text-med',
    span: '',
  },
  {
    id: 'sonus',
    title: 'How to Use Sonus',
    icon: BookOpen,
    accent: 'border-[#3E5648]/65 bg-white text-text-dark',
    badge: 'bg-[#D9E6DF] text-[#3E5648]',
    bodyTone: 'text-text-med',
    span: 'lg:col-span-2',
  },
  {
    id: 'before',
    title: 'Before You Begin',
    icon: Route,
    accent: 'border-[#C2410C]/65 bg-white text-text-dark',
    badge: 'bg-[#F2DCCE] text-[#C2410C]',
    bodyTone: 'text-text-med',
    span: '',
  },
];

function cardContent(id: string): ReactNode {
  if (id === 'welcome') {
    return (
      <div className="mt-3 space-y-2.5 text-[15px] leading-relaxed">
        <p>Japanese can feel unfamiliar at first. You are seeing multiple scripts and a sentence rhythm that is different from English, so it is normal to need a short adjustment period.</p>
        <p>The key is that Japanese is highly consistent once you learn the core patterns. As you keep reading and listening, repeated structures appear quickly, and progress starts to feel much faster.</p>
      </div>
    );
  }

  if (id === 'writing') {
    return (
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed">
        <div>
          <p className="font-semibold text-text-dark main-font text-[20px]">Hiragana</p>
          <p>Hiragana is a phonetic script used for grammar endings and many native Japanese words. It appears constantly in beginner material and is the first script to master. Example: これはほんです。 This is a book.</p>
        </div>
        <div>
          <p className="font-semibold text-text-dark main-font text-[20px]">Katakana</p>
          <p>Katakana is also phonetic, but it is mainly used for loanwords, names, and emphasis. You will see it often in modern vocabulary. Example: コーヒーをのみます。 I drink coffee.</p>
        </div>
        <div>
          <p className="font-semibold text-text-dark main-font text-[20px]">Kanji</p>
          <p>Kanji are characters that carry meaning and make reading more efficient. They are introduced gradually, so you build recognition step by step instead of memorizing everything at once. Example: 山 means mountain and 川 means river.</p>
          <p>Example in context: 山へ行きます。 I am going to the mountain.</p>
        </div>
        <div>
          <p className="font-semibold text-text-dark main-font text-[20px]">Romaji</p>
          <p>Romaji writes Japanese sounds with the Roman alphabet. Sonus uses it as temporary support while you build script confidence, but it is not how Japanese is normally written. Reduce romaji reliance early to accelerate reading fluency.</p>
        </div>
      </div>
    );
  }

  if (id === 'structure') {
    return (
      <div className="mt-3 space-y-2.5 text-[15px] leading-relaxed">
        <p>A common beginner pattern is Subject + Object + Verb, with the verb usually at the end. Particles mark each word's role, so you can still track meaning even when word order feels new.</p>
        <p>Example: 私はりんごを食べます。 I eat an apple.</p>
        <p>In this sentence, は marks the topic and を marks the object. A simple reading tip is to find the verb first, then work backward to identify who is doing what.</p>
      </div>
    );
  }

  if (id === 'levels') {
    return (
      <div className="mt-3 space-y-2.5 text-[15px] leading-relaxed">
        <p>Levels increase in complexity from basic communication to high-level comprehension. As you move up, vocabulary range, grammar flexibility, and reading-listening difficulty all expand.</p>
        <p>N5 builds core survival language, essential phrases, and script confidence. N4 covers everyday topics and broader practical grammar. N3 introduces wider contexts and more abstract usage. N2 strengthens dense reading and faster listening comprehension. N1 focuses on subtle nuance and complex material.</p>
      </div>
    );
  }

  if (id === 'sonus') {
    return (
      <div className="mt-3 space-y-2.5 text-[15px] leading-relaxed">
        <p>Sonus groups words into units and lessons so your study stays structured. The flow is simple: learn a word, see it in context, then reinforce it through repetition until recognition is automatic.</p>
        <p>This approach prioritizes recognition before production, so comprehension becomes stable before output pressure increases.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Read examples out loud to strengthen sound-memory links.</li>
          <li>Use short, consistent sessions instead of rare long sessions.</li>
          <li>Revisit difficult words in context before forcing recall.</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2.5 text-[15px] leading-relaxed">
      <p>Start by learning hiragana first so the rest of your input becomes readable. Use romaji only as temporary support, then phase it out as soon as possible.</p>
      <p>Focus on steady progress, not perfect performance. One clear, consistent session each day will carry you forward faster than occasional marathon study.</p>
    </div>
  );
}

export default function JapaneseIntroScreen({
  onGoHome,
  onOpenProfile,
  onBackToLearn,
}: JapaneseIntroScreenProps) {
  return (
    <div className="relative min-h-screen page-shell px-6 with-bottom-nav overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundColor: '#186E95',
          backgroundImage: 'linear-gradient(145deg, #186E95 0%, #1B6F96 42%, #205F83 100%)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[#186E95]/78" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.16,
          backgroundImage: "url('/branding/Transparent_Background.png')",
          backgroundPosition: 'center top',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'contain',
        }}
      />
      <div className="pointer-events-none absolute -top-28 -left-16 h-72 w-72 rounded-full bg-white/12 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-[#3E5648]/20 blur-3xl" />

      <GlassHeader
        title="Japanese Intro"
        className="bg-white/12 border-white/25"
        scrolledClassName="bg-[#186E95]/88 border-white/35"
        titleClassName="text-white"
        scrolledTitleClassName="text-white"
      />

      <div className="relative z-10 max-w-6xl mx-auto">
        <section className="dashboard-card-enter mb-4 rounded-3xl border-2 border-[#374151]/90 bg-[linear-gradient(160deg,#374151_0%,#2B3440_52%,#24303A_100%)] p-6 text-white shadow-[0_22px_45px_-32px_rgba(31,42,55,0.60)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-[230px]">
              <div className="text-[11px] uppercase tracking-[0.2em] font-mono text-white/80">Orientation</div>
              <h2 className="main-font mt-2 text-3xl sm:text-4xl leading-tight">Build a clear Japanese foundation.</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-white/90 max-w-3xl">
                Learn how script, structure, and level progression fit together so each lesson feels easier to navigate.
              </p>
            </div>
            <button
              onClick={onBackToLearn}
              className="inline-flex items-center gap-2 rounded-xl border border-white/35 bg-white/14 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Levels
            </button>
          </div>
        </section>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
        {INTRO_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <section
              key={card.id}
              className={`dashboard-card-enter rounded-3xl border-2 p-5 sm:p-6 shadow-[0_16px_34px_-24px_rgba(15,23,42,0.34)] ${card.accent} ${card.span}`}
            >
              <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono ${card.badge}`}>
                <Icon className="w-3.5 h-3.5" />
                {card.title}
              </div>
              <div className={card.bodyTone}>{cardContent(card.id)}</div>
            </section>
          );
        })}
      </div>

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
