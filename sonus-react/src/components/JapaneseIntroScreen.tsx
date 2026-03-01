import type { ReactNode } from 'react';
import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';

interface JapaneseIntroScreenProps {
  onGoHome: () => void;
  onOpenProfile: () => void;
  onBackToLearn: () => void;
  onOpenHiragana: () => void;
  onOpenKatakana: () => void;
}

const INTRO_SECTIONS = [
  {
    id: 'writing',
    title: 'Writing Systems',
  },
  {
    id: 'welcome',
    title: 'Welcome to Japanese',
  },
  {
    id: 'structure',
    title: 'Basic Structure',
  },
  {
    id: 'levels',
    title: 'Understanding the Levels',
  },
  {
    id: 'sonus',
    title: 'How to Use Sonus',
  },
  {
    id: 'before',
    title: 'Before You Begin',
  },
];

const FOUNDATION_POINTS = [
  { label: 'Scripts in Daily Use', value: '3 + romaji support' },
  { label: 'Study Priority', value: 'Hiragana first' },
  { label: 'Grammar Baseline', value: 'Verb at sentence end' },
];

const STARTING_FLOW = [
  'Learn hiragana, then add high-frequency katakana words.',
  'Read short examples aloud to connect script and sound.',
  'Use romaji briefly, then phase it out as script confidence grows.',
];

function cardContent(
  id: string,
  onOpenHiragana: () => void,
  onOpenKatakana: () => void
): ReactNode {
  if (id === 'writing') {
    return (
      <div className="mt-4 space-y-4 text-[15px] leading-7 text-white/90">
        <p>
          Japanese uses multiple scripts together. Read them as a system, not as separate tracks, and fluency becomes much more manageable.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#D2DEE7] bg-white p-3.5">
            <p className="main-font text-[1.08rem] text-text-dark">Hiragana</p>
            <p className="mt-1 text-[14px] text-text-med">Core grammar endings and many native words. First script to master.</p>
            <p className="mt-1.5 text-[13px] text-text-light">Example: これはほんです。</p>
            <button
              type="button"
              onClick={onOpenHiragana}
              className="mt-3 inline-flex items-center justify-center rounded-xl bg-[#1F2A37] px-3.5 py-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#111827]"
            >
              Open Chart
            </button>
          </div>
          <div className="rounded-2xl border border-[#D2DEE7] bg-white p-3.5">
            <p className="main-font text-[1.08rem] text-text-dark">Katakana</p>
            <p className="mt-1 text-[14px] text-text-med">Loanwords, names, and modern vocabulary.</p>
            <p className="mt-1.5 text-[13px] text-text-light">Example: コーヒーをのみます。</p>
            <button
              type="button"
              onClick={onOpenKatakana}
              className="mt-3 inline-flex items-center justify-center rounded-xl bg-[#1F2A37] px-3.5 py-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#111827]"
            >
              Open Chart
            </button>
          </div>
          <div className="rounded-2xl border border-[#D2DEE7] bg-white p-3.5">
            <p className="main-font text-[1.08rem] text-text-dark">Kanji</p>
            <p className="mt-1 text-[14px] text-text-med">Meaning-carrying characters that speed reading.</p>
            <p className="mt-1.5 text-[13px] text-text-light">Example: 山へ行きます。</p>
          </div>
          <div className="rounded-2xl border border-[#D2DEE7] bg-white p-3.5">
            <p className="main-font text-[1.08rem] text-text-dark">Romaji</p>
            <p className="mt-1 text-[14px] text-text-med">Temporary support only. Reduce early for faster fluency.</p>
          </div>
        </div>
      </div>
    );
  }

  if (id === 'welcome') {
    return (
      <div className="mt-4 space-y-3.5 text-[15px] leading-7">
        <p>Japanese can feel unfamiliar at first, especially with new scripts and different sentence rhythm. That adjustment period is normal.</p>
        <p>The language is highly consistent once you learn core patterns. Repeated structures appear quickly, and progress starts compounding.</p>
        <div className="rounded-xl border border-[#D2DEE7] bg-white px-3.5 py-3">
          <p className="text-[13px] font-mono uppercase tracking-[0.14em] text-[#186E95]">Start Here</p>
          <ul className="mt-2 space-y-1.5 text-[14px] text-text-dark">
            {STARTING_FLOW.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (id === 'structure') {
    return (
      <div className="mt-4 space-y-2.5 text-[15px] leading-7">
        <p>A common beginner pattern is Subject + Object + Verb, with the verb usually at the end. Particles mark each word's role, so you can still track meaning even when word order feels new.</p>
        <div className="rounded-xl border border-[#D2DEE7] bg-white p-3.5">
          <p className="text-[14px] text-text-dark">Example: 私はりんごを食べます。</p>
          <p className="mt-1 text-[14px] text-text-med">I eat an apple.</p>
        </div>
        <p>Here, は marks the topic and を marks the object. A practical reading strategy is to find the verb first, then work backward.</p>
      </div>
    );
  }

  if (id === 'levels') {
    return (
      <div className="mt-4 space-y-2.5 text-[15px] leading-7">
        <p>Levels increase in complexity from basic communication to high-level comprehension. As you move up, vocabulary range, grammar flexibility, and reading-listening difficulty all expand.</p>
        <div className="rounded-xl border border-[#D2DEE7] bg-white p-3.5">
          <p className="text-text-med"><span className="font-semibold text-text-dark">N5:</span> core survival language + script confidence</p>
          <p className="text-text-med"><span className="font-semibold text-text-dark">N4:</span> everyday topics + broader practical grammar</p>
          <p className="text-text-med"><span className="font-semibold text-text-dark">N3-N1:</span> wider context, denser reading, nuanced usage</p>
        </div>
      </div>
    );
  }

  if (id === 'sonus') {
    return (
      <div className="mt-4 space-y-2.5 text-[15px] leading-7">
        <p>Sonus groups words into units and lessons so your study stays structured. The flow is simple: learn a word, see it in context, then reinforce it through repetition until recognition is automatic.</p>
        <p>This approach prioritizes recognition before production, so comprehension becomes stable before output pressure increases.</p>
        <ul className="space-y-1.5">
          <li>Read examples out loud to strengthen sound-memory links.</li>
          <li>Use short, consistent sessions instead of rare long sessions.</li>
          <li>Revisit difficult words in context before forcing recall.</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2.5 text-[15px] leading-7">
      <p>Start by learning hiragana first so the rest of your input becomes readable. Use romaji only as temporary support, then phase it out as soon as possible.</p>
      <p>Focus on steady progress, not perfect performance. One clear, consistent session each day will carry you forward faster than occasional marathon study.</p>
    </div>
  );
}

export default function JapaneseIntroScreen({
  onGoHome,
  onOpenProfile,
  onOpenHiragana,
  onOpenKatakana,
}: JapaneseIntroScreenProps) {
  return (
    <div className="min-h-screen page-shell px-6 with-bottom-nav bg-[linear-gradient(180deg,#F7FAFD_0%,#EEF4F8_100%)]">

      <GlassHeader
        title="Japanese Intro"
        className="bg-white/12 border-white/25"
        scrolledClassName="bg-[#186E95]/88 border-white/35"
        titleClassName="text-white"
        scrolledTitleClassName="text-white"
      />

      <div className="max-w-6xl mx-auto">
        <section className="dashboard-card-enter mb-4 rounded-3xl border-2 border-[#1F2A37] bg-[#1F2A37] p-5 sm:p-6 text-white shadow-[0_22px_45px_-32px_rgba(31,42,55,0.60)]">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="min-w-[230px]">
              <div className="text-[11px] uppercase tracking-[0.2em] font-mono text-white/80">Orientation</div>
              <h2 className="main-font mt-2 text-[2rem] sm:text-[2.35rem] leading-tight max-w-3xl">Build a clear Japanese foundation.</h2>
              <p className="mt-3 text-[15px] leading-7 text-white/92 max-w-3xl">
                Learn how script, sentence structure, and level progression fit together so each lesson feels easier to navigate.
              </p>
            </div>

            <div className="rounded-2xl border border-[#3A4654] bg-[#2B3440] p-4 sm:p-5">
              <p className="text-[11px] uppercase tracking-[0.16em] font-mono text-white/80">At a Glance</p>
              <div className="mt-3 space-y-2.5">
                {FOUNDATION_POINTS.map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-3 rounded-xl border border-[#475466] bg-[#313B49] px-3 py-2.5">
                    <p className="text-[13px] text-white/86">{item.label}</p>
                    <p className="text-[13px] font-semibold text-white text-right">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="dashboard-card-enter max-w-6xl mx-auto rounded-3xl border border-[#2B3440] bg-[#1F2A37] shadow-[0_16px_34px_-26px_rgba(15,23,42,0.28)] overflow-hidden">
        <div className="divide-y divide-[#364252]">
          {INTRO_SECTIONS.map((section) => (
            <article key={section.id} className="px-5 py-6 sm:px-7 sm:py-7">
              <h3 className="main-font text-[1.5rem] sm:text-[1.75rem] leading-tight text-white">{section.title}</h3>
              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] font-mono text-[#B5D8EA]">Japanese Foundations</p>
              <div className="text-white/90">{cardContent(section.id, onOpenHiragana, onOpenKatakana)}</div>
            </article>
          ))}
        </div>
      </section>

      <BottomNav active="learn" onHome={onGoHome} onProfile={onOpenProfile} />
    </div>
  );
}
