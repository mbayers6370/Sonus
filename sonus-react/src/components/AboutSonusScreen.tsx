import BottomNav from './BottomNav';
import GlassHeader from './GlassHeader';

interface AboutSonusScreenProps {
  onGoHome: () => void;
  onGoProfile: () => void;
}

export default function AboutSonusScreen({ onGoHome, onGoProfile }: AboutSonusScreenProps) {
  // Content collections are data-driven so copy and ordering can be edited without touching layout.
  const frameworks = [
    {
      language: 'Japanese',
      system: 'JLPT',
      range: 'N5-N1',
      accent: 'text-[var(--sonus-palette-blue)]',
    },
    {
      language: 'Korean',
      system: 'TOPIK',
      range: 'Level-based track',
      accent: 'text-[var(--sonus-palette-blue)]',
    },
    {
      language: 'French',
      system: 'CEFR',
      range: 'A1-C2 path',
      accent: 'text-[var(--sonus-palette-blue)]',
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
    <div className="min-h-screen bg-[var(--sonus-palette-charcoal)] px-6 with-bottom-nav">
      <GlassHeader
        title="About Sonus"
        hideLogoOnMobile
        className="bg-[var(--sonus-palette-charcoal)]/96 border-white/25"
        scrolledClassName="bg-[var(--sonus-palette-charcoal)]/96 border-white/30"
        titleClassName="text-white"
        scrolledTitleClassName="text-white"
      />

      <div className="mx-auto max-w-6xl pb-8">
        <header className="dashboard-card-enter py-2">
          <h3 className="main-font mt-2 text-4xl sm:text-5xl text-[var(--sonus-palette-blue)] leading-[1.05] text-center">Built on Real Frameworks</h3>
          <p className="mt-4 mx-auto max-w-3xl text-center text-white leading-relaxed">
            Sonus follows the official proficiency systems used by each language so progress is structured, comparable, and practical.
          </p>
        </header>

        <section className="dashboard-card-enter mt-7 rounded-3xl border border-white/25 bg-white/[0.03] px-5 py-6 sm:px-6">
          <div className="text-xs uppercase tracking-[0.16em] font-mono text-[var(--sonus-palette-blue)]">Framework Mapping</div>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-5">
            {frameworks.map((item) => (
              <article key={item.language} className="border-t border-white/20 pt-3 first:border-t-0 first:pt-0 md:border-t-0 md:border-l-2 md:border-white/25 md:pt-0 md:pl-4">
                <div className={`text-[11px] uppercase tracking-[0.16em] font-mono ${item.accent}`}>{item.system}</div>
                <h4 className="mt-2 text-lg font-semibold text-[var(--sonus-palette-blue)]">{item.language}</h4>
                <p className="mt-1 text-sm text-white">{item.range}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="dashboard-card-enter mt-7 border-t border-white/20 pt-7">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-8">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] font-mono text-[var(--sonus-palette-blue)]">The Structure</div>
              <div className="mt-5 space-y-4">
                {principles.map((item) => (
                  <article key={item.title} className="border-b border-white/12 pb-4 last:border-b-0 last:pb-0">
                    <h4 className="text-lg font-semibold text-[var(--sonus-palette-blue)]">{item.title}</h4>
                    <p className="mt-2 text-sm leading-relaxed text-white">{item.body}</p>
                  </article>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.16em] font-mono text-[var(--sonus-palette-blue)]">How Sonus Works</div>
              <div className="mt-5 space-y-4">
                {workflow.map((item) => (
                  <article key={item.title} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 border-b border-white/12 pb-4 last:border-b-0 last:pb-0">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--sonus-palette-blue)]/55 text-xs font-mono font-semibold text-[var(--sonus-palette-blue)]">
                      {item.step}
                    </span>
                    <div>
                      <h4 className="text-base font-semibold text-[var(--sonus-palette-blue)]">{item.title}</h4>
                      <p className="mt-1.5 text-sm leading-relaxed text-white">{item.body}</p>
                    </div>
                  </article>
                ))}
              </div>
              <div className="mt-4 border-t border-[var(--sonus-palette-blue)]/35 pt-3 md:border-t-0 md:border-l-2 md:border-[var(--sonus-palette-blue)]/45 md:pt-0 md:pl-4">
                <div className="text-[11px] uppercase tracking-[0.16em] font-mono text-[var(--sonus-palette-blue)]">Core Principle</div>
                <p className="mt-1.5 text-sm leading-relaxed text-white">
                  Frameworks provide structure, but every screen is tuned for one outcome: confident communication in real situations.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-card-enter mt-7 border-t border-white/20 pt-7">
          <div className="text-[11px] uppercase tracking-[0.16em] font-mono text-[var(--sonus-palette-blue)] mb-2">Why I Built This</div>
          <h4 className="main-font text-2xl sm:text-3xl leading-tight text-[var(--sonus-palette-blue)]">Some apps teach you a language. Sonus lets you meet one.</h4>
          <div className="mt-4 max-w-4xl space-y-3 text-[15px] leading-relaxed text-white">
            <p>
              Built directly on the standards that matter: JLPT for Japanese and TOPIK for Korean. Not proprietary systems designed to keep you subscribed. Real frameworks, implemented properly, with pronunciation feedback specific enough to actually improve from.
            </p>
            <p>
              I&apos;ve picked up pieces of seven languages throughout my life. I know what works: structured progression, real scripts, and feedback that tells you something true.
            </p>
            <p>
              I also care about languages that get left behind. Languages with living communities and almost no good tools. Those are coming too as we continue to grow, and can acquire more resources.
            </p>
            <p>
              Sonus is a quiet place to meet a language as it is truly written, spoken, and lived.
            </p>
            <p>
              Welcome.
            </p>
          </div>
        </section>
      </div>

      <BottomNav active="profile" onHome={onGoHome} onProfile={onGoProfile} />
    </div>
  );
}
