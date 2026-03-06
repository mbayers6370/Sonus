import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';

interface AboutSonusScreenProps {
  onGoHome: () => void;
  onGoProfile: () => void;
}

export default function AboutSonusScreen({ onGoHome, onGoProfile }: AboutSonusScreenProps) {
  const frameworks = [
    {
      language: 'Mandarin',
      system: 'HSK 3.0',
      range: 'Bands 1-9',
      accent: 'border-[#3E5648]/26 bg-[rgba(62,86,72,0.08)] text-[#3E5648]',
    },
    {
      language: 'Japanese',
      system: 'JLPT',
      range: 'N5-N1',
      accent: 'border-[#1F2A37]/26 bg-[rgba(31,42,55,0.08)] text-[#1F2A37]',
    },
    {
      language: 'Korean',
      system: 'TOPIK',
      range: 'Level-based track',
      accent: 'border-[#3E5648]/26 bg-[rgba(62,86,72,0.08)] text-[#3E5648]',
    },
    {
      language: 'French',
      system: 'CEFR',
      range: 'A1-C2 path',
      accent: 'border-[#1F2A37]/26 bg-[rgba(31,42,55,0.08)] text-[#1F2A37]',
    },
  ];

  const principles = [
    {
      title: 'Clear progression',
      body: 'Levels and units map to official frameworks, so each step has a defined difficulty target.',
    },
    {
      title: 'Practical first',
      body: 'Lessons prioritize high-frequency, high-utility language before low-value edge cases.',
    },
    {
      title: 'Adaptive reinforcement',
      body: 'Practice Focus blends weak words with reinforcement reps so gains are retained.',
    },
  ];

  const workflow = [
    {
      step: '1',
      title: 'Choose a path',
      body: 'Start in your current level and move unit by unit through a sequence designed for usable communication.',
    },
    {
      step: '2',
      title: 'Run lesson cycles',
      body: 'Each lesson checks recognition and recall through learn, quiz, and speaking steps.',
    },
    {
      step: '3',
      title: 'Train weak spots',
      body: 'Adaptive practice applies a 70/30 weak-word to reinforcement mix to close gaps without losing momentum.',
    },
    {
      step: '4',
      title: 'Review intentionally',
      body: 'Missed words reappear in targeted queues so review stays focused and efficient.',
    },
  ];

  return (
    <div className="min-h-screen page-shell px-6 with-bottom-nav">
      <GlassHeader title="About Sonus" />

      <div className="space-y-4">
        <section className="dashboard-card-enter border border-[#1F2A37]/90 rounded-3xl overflow-hidden shadow-[0_22px_48px_-36px_rgba(31,42,55,0.45)] bg-[linear-gradient(160deg,#1F2A37_0%,#2B3440_45%,#24303A_100%)] text-white">
          <div className="px-6 py-7">
            <div className="text-[11px] uppercase tracking-[0.18em] font-mono mb-2 text-white/70">Method</div>
            <h3 className="main-font text-4xl leading-tight">Built on Real Frameworks</h3>
            <p className="text-sm text-white/92 mt-2 max-w-2xl">
              Sonus follows the official proficiency systems used by each language so progress is structured, comparable, and practical.
            </p>
          </div>
        </section>

        <section className="dashboard-card-enter bg-white border border-border rounded-3xl p-5 shadow-[0_22px_48px_-36px_rgba(31,42,55,0.30)]">
          <div className="text-xs uppercase tracking-[0.16em] font-mono text-text-light mb-3">Framework Mapping</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {frameworks.map((item) => (
              <div key={item.language} className={`rounded-2xl border px-4 py-3 ${item.accent}`}>
                <div className="text-sm font-semibold">{item.language}</div>
                <div className="text-xs uppercase tracking-wider font-mono mt-1 opacity-90">{item.system}</div>
                <div className="text-sm mt-1.5 text-text-dark">{item.range}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard-card-enter bg-white border border-border rounded-3xl p-5 shadow-[0_22px_48px_-36px_rgba(31,42,55,0.30)]">
          <div className="text-xs uppercase tracking-[0.16em] font-mono text-text-light mb-3">The Structure</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {principles.map((item) => (
              <div key={item.title} className="rounded-2xl border border-border bg-[#FBFBF9] px-3.5 py-3">
                <div className="text-sm font-semibold text-text-dark">{item.title}</div>
                <div className="mt-1.5 text-sm text-text-med">{item.body}</div>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <div className="text-xs uppercase tracking-[0.16em] font-mono text-text-light mb-2.5">How Sonus Works</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {workflow.map((item) => (
                <div key={item.title} className="rounded-2xl border border-border bg-white px-3.5 py-3">
                  <div className="inline-flex items-center gap-2">
                    <span className="inline-flex w-5 h-5 rounded-full bg-[rgba(62,86,72,0.12)] text-[#3E5648] items-center justify-center text-[11px] font-semibold font-mono">
                      {item.step}
                    </span>
                    <div className="text-sm font-semibold text-text-dark">{item.title}</div>
                  </div>
                  <div className="mt-1.5 text-sm text-text-med">{item.body}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-[#3E5648]/24 bg-[linear-gradient(135deg,rgba(62,86,72,0.10),rgba(31,42,55,0.04))] px-4 py-3.5">
            <div className="text-[11px] uppercase tracking-wider font-mono text-[#3E5648] mb-1.5">Core Principle</div>
            <p className="text-sm text-text-med">
              Frameworks provide structure, but every screen is tuned for one outcome: confident communication in real situations.
            </p>
          </div>
        </section>

        <section className="dashboard-card-enter border border-[#1F2A37]/90 rounded-3xl p-5 shadow-[0_22px_48px_-36px_rgba(31,42,55,0.45)] bg-[linear-gradient(160deg,#1F2A37_0%,#2B3440_45%,#24303A_100%)] text-white">
          <div className="text-[11px] uppercase tracking-[0.16em] font-mono text-white/70 mb-2">Why I Built This</div>
          <h4 className="main-font text-2xl leading-tight text-white">Creating a Language Learning Platform</h4>
          <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-white/88">
            <p>
              Many language apps use proprietary lesson structures rather than building directly on official proficiency standards.
            </p>
            <p>
              I wanted something different: language learning built on official standards, the actual frameworks countries use to measure proficiency.
            </p>
            <p>
              For Mandarin, that is HSK 3.0 (China&apos;s government-backed certification system). For Japanese, it is JLPT. For Korean, TOPIK.
              Real standards, implemented properly, with pronunciation feedback that actually tells you what you are doing wrong.
            </p>
            <p>
              I also care about languages that get ignored. Iu Mien, Hmong, Hawaiian: languages with heritage speakers but no good learning tools.
              I intend to build those too, using preservation frameworks that respect the language and the community.
            </p>
            <p>
              I&apos;ve learned small bits of seven languages throughout my life. However, I know what works: structured progression, 
              spaced repetition, and feedback specific enough to improve from. That is what I built here.
            </p>
            <p>
              If you want to learn a language seriously, whether for fun, heritage connection, or real fluency, this is for you.
              Welcome to Sonus.
            </p>
          </div>
        </section>
      </div>

      <BottomNav active="profile" onHome={onGoHome} onProfile={onGoProfile} />
    </div>
  );
}
