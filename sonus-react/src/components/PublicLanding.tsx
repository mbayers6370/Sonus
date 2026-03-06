import { useEffect, useMemo, useState } from 'react';
import { Plane, User } from 'lucide-react';
import AuthScreen from './AuthScreen';
import PublicFooter from './public/PublicFooter';
import SEOHead from './public/SEOHead';

type AuthMode = 'signin' | 'signup';
type ModalMode = AuthMode | 'demo';
type DemoCard = {
  title: string;
  body: string;
};

export default function PublicLanding() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
  );
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 1024px)');
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!modalMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModalMode(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalMode]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const previous = document.body.style.overflow;
    if (modalMode) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [modalMode]);

  const authCtaLabel = useMemo(() => 'Log In / Sign Up', []);
  const landingDescription = useMemo(
    () =>
      'Sonus is a language learning platform built on real fluency frameworks like HSK and JLPT. Practice vocabulary, speaking, and travel phrases through structured lessons.',
    []
  );
  const demoCards = useMemo<DemoCard[]>(
    () => [
      {
        title: 'Speaking Feedback',
        body: 'Real-time feedback on pronunciation and tone.',
      },
      {
        title: 'Practice Focus',
        body: 'Adaptive training that targets weak words first.',
      },
      {
        title: 'Travel Sprint',
        body: 'Essential language for airports, hotels, and getting around.',
      },
    ],
    []
  );
  const heroLineVariants = useMemo(
    () => [
      'Language learning built to last.',
      '続く語学学習を。',
      '持久有效的语言学习。',
      '오래 가는 언어 학습.',
      "Apprentissage des langues concu pour durer.",
      'Aprendizaje de idiomas pensado para durar.',
      'Language learning built to last.',
    ],
    []
  );
  const [heroLineVariantIdx, setHeroLineVariantIdx] = useState(0);

  const openAuth = (mode: ModalMode) => {
    setModalMode(mode);
  };

  useEffect(() => {
    if (heroLineVariants.length <= 1) return;
    if (heroLineVariantIdx >= heroLineVariants.length - 1) return;
    const timer = window.setTimeout(() => {
      setHeroLineVariantIdx((prev) => prev + 1);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [heroLineVariantIdx, heroLineVariants.length]);

  useEffect(() => {
    const scriptId = 'sonus-webapp-jsonld';
    const existing = document.getElementById(scriptId);
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Sonus',
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      url: 'https://sonuslearning.com/',
      description: landingDescription,
      publisher: {
        '@type': 'Organization',
        name: 'Sonus Learning',
      },
    });
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [landingDescription]);

  return (
    <div
      className="min-h-screen font-normal text-[#1F2A37]"
      style={{
        backgroundColor: '#1F2A37',
        backgroundImage:
          "linear-gradient(rgba(31,42,55,0.9), rgba(31,42,55,0.9)), url('/branding/Transparent_Background.png')",
        backgroundSize: 'cover, cover',
        backgroundPosition: 'center, center',
        backgroundRepeat: 'no-repeat, no-repeat',
        backgroundAttachment: 'fixed, fixed',
      }}
    >
      <SEOHead
        title="Sonus | Language Learning Built on Real Fluency Frameworks"
        description={landingDescription}
        canonical="https://sonuslearning.com/"
        ogTitle="Sonus | Language Learning Built on Real Fluency Frameworks"
        ogUrl="https://sonuslearning.com/"
      />
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/45 bg-white/62 backdrop-blur-2xl shadow-[0_10px_26px_-22px_rgba(15,23,42,0.55)]">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-8">
            <img src="/branding/logo_name_solo.png" alt="Sonus" className="h-7 sm:h-8" />
            {isDesktop ? (
              <button
                type="button"
                onClick={() => openAuth('signin')}
                className="text-sm text-[#1F2A37] underline-offset-4 transition-colors hover:underline hover:text-[#111827] sm:text-base"
              >
                {authCtaLabel}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openAuth('signin')}
                aria-label="Log in"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#1F2A37] transition-colors hover:bg-[#1F2A37]/10 active:bg-[#1F2A37]/15"
              >
                <User className="h-5 w-5" />
              </button>
            )}
        </div>
      </header>

      <main className="pt-16">
        <div aria-hidden="true" className="-mt-16 h-16 bg-[#145B7A]" />
        <div className="relative">
          <article className="relative w-full overflow-hidden bg-[#145B7A] px-5 py-8 shadow-[0_20px_40px_-32px_rgba(20,91,122,0.72)] sm:px-10 sm:py-10">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="absolute left-[4%] top-[12%] rotate-[-16deg] main-font text-[2.65rem] tracking-[0.1em] text-white/[0.045] sm:left-[9%] sm:top-[18%] sm:rotate-[-14deg] sm:text-[3.8rem] sm:tracking-[0.16em] sm:text-white/[0.03]">
                    こんにちは
                  </div>
                  <div className="absolute right-[2%] top-[18%] rotate-[14deg] main-font text-[2.1rem] tracking-[0.04em] text-white/[0.045] sm:right-[9%] sm:top-[20%] sm:rotate-[11deg] sm:text-[3.25rem] sm:tracking-[0.1em] sm:text-white/[0.03]">
                    안녕하세요
                  </div>
                  <div className="absolute left-[18%] top-[53%] hidden rotate-[-8deg] font-mono text-[1.15rem] uppercase tracking-[0.34em] text-white/[0.03] sm:block sm:text-[1.75rem]">
                    hola
                  </div>
                  <div className="absolute right-[18%] top-[56%] hidden rotate-[9deg] font-mono text-[1.08rem] uppercase tracking-[0.3em] text-white/[0.03] sm:block sm:text-[1.65rem]">
                    bonjour
                  </div>
                  <div className="absolute left-[8%] top-[74%] hidden rotate-[-6deg] font-mono text-[0.9rem] uppercase tracking-[0.4em] text-white/[0.03] sm:left-[11%] sm:block sm:text-[1.3rem]">
                    hello
                  </div>
                  <div className="absolute right-[8%] top-[74%] hidden rotate-[7deg] font-mono text-[1rem] tracking-[0.2em] text-white/[0.03] sm:right-[11%] sm:block sm:text-[1.45rem]">
                    你好
                  </div>
                  <div className="absolute right-[18%] top-[34%] hidden rotate-[10deg] font-mono text-[0.88rem] uppercase tracking-[0.18em] text-white/[0.03] sm:right-[20%] sm:block sm:text-[1.2rem]">
                    kumusta
                  </div>
                  <div className="absolute left-[6%] top-[62%] rotate-[-9deg] font-mono text-[1.35rem] uppercase tracking-[0.22em] text-white/[0.04] sm:hidden">
                    hola
                  </div>
                  <div className="absolute right-[6%] top-[58%] rotate-[11deg] font-mono text-[1.25rem] uppercase tracking-[0.18em] text-white/[0.04] sm:hidden">
                    bonjour
                  </div>
                  <div className="absolute left-[10%] top-[76%] rotate-[-8deg] font-mono text-[1.05rem] uppercase tracking-[0.25em] text-white/[0.04] sm:hidden">
                    hello
                  </div>
                  <div className="absolute right-[10%] top-[73%] rotate-[8deg] font-mono text-[1.15rem] tracking-[0.15em] text-white/[0.04] sm:hidden">
                    你好
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#104A64]/34" />
                </div>
                <div className="relative z-10 text-center">
                  <h1 className="main-font mx-auto max-w-6xl text-[2.95rem] leading-tight text-white sm:mt-4 sm:text-[3.15rem]">
                    <span
                      key={`${heroLineVariants[heroLineVariantIdx]}-${heroLineVariantIdx}`}
                      className="dashboard-card-enter inline-block"
                    >
                      {heroLineVariants[heroLineVariantIdx]}
                    </span>
                  </h1>
                  <p
                    className="font-mono mx-auto mt-3 max-w-3xl font-light leading-relaxed text-[#D6E2EE] sm:mt-4 sm:text-[1.2rem]"
                    style={{ fontSize: '1.35em' }}
                  >
                    Built on real <br className="sm:hidden" />
                    fluency&nbsp;frameworks.
                  </p>
                  <div className="mb-1 mt-6 flex flex-wrap items-center justify-center gap-2.5 sm:mt-7 sm:mb-0 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => openAuth('demo')}
                      className="rounded-xl border border-white bg-[#145B7A] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#104A64] sm:px-7 sm:text-base"
                    >
                      Try Demo
                    </button>
                    <button
                      type="button"
                      onClick={() => openAuth('signup')}
                      className="rounded-xl border border-white bg-[#145B7A] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#104A64] sm:px-7 sm:text-base"
                    >
                      Start Learning
                    </button>
                  </div>
                </div>
          </article>

          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 sm:gap-7">
              <article className="rounded-3xl bg-[#F8FBFF] p-4 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.55)] sm:p-6">
                <h2 className="main-font mt-2 text-center text-2xl text-[#1F2A37] sm:text-5xl">Explore the Platform</h2>
                <div className="mx-auto mt-6 max-w-5xl">
                  <div className="md:hidden">
                    <MobileExploreStepper cards={demoCards} />
                  </div>
                  <div className="hidden md:grid md:grid-cols-3 md:gap-5">
                    {demoCards.map((card) => (
                      <ExploreDemoCard key={card.title} card={card} />
                    ))}
                  </div>
                </div>
              </article>

              <article className="rounded-3xl bg-white p-4 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.55)] sm:p-6">
                <h2 className="main-font mt-2 text-center text-2xl text-[#1F2A37] sm:text-5xl">Languages</h2>
                <p className="mx-auto mt-3 max-w-3xl text-center secondary-font text-sm leading-relaxed text-[#475569] sm:text-base">
                  Structured paths with pronunciation, recall, and travel-ready practice.
                </p>
                <div className="mx-auto mt-6 grid max-w-5xl gap-4 sm:grid-cols-2 sm:gap-5">
                  <article className="rounded-2xl bg-[#1F2A37] p-4 text-white shadow-[0_14px_24px_-20px_rgba(15,23,42,0.62)] sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="main-font text-2xl leading-tight text-white sm:text-3xl">Mandarin</h3>
                        <p className="mt-1 secondary-font text-sm text-[#C9D8E7] sm:text-base">普通话 · 汉语</p>
                      </div>
                      <span className="rounded-full border border-[#186E95] bg-[#186E95] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-white">
                        Active
                      </span>
                    </div>
                    <p className="secondary-font mt-3 text-sm font-light leading-relaxed text-[#E3EDF6] sm:text-base">
                      Curriculum and speech training in active development.
                    </p>
                    <div className="mt-3 rounded-xl bg-[#145B7A] px-3 py-2">
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#D7E7EE]">Focus</p>
                      <p className="mt-1 secondary-font text-sm text-white">HSK-aligned progression, speaking feedback, and practical dialog.</p>
                    </div>
                  </article>

                  <article className="rounded-2xl bg-[#3E5648] p-4 text-white shadow-[0_14px_24px_-20px_rgba(31,42,55,0.55)] sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="main-font text-2xl leading-tight text-white sm:text-3xl">Japanese</h3>
                        <p className="mt-1 secondary-font text-sm text-[#DCE7E1] sm:text-base">日本語</p>
                      </div>
                      <span className="rounded-full border border-[#2F4439] bg-[#2F4439] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-white">
                        Available
                      </span>
                    </div>
                    <p className="secondary-font mt-3 text-sm font-light leading-relaxed text-[#E8EFEA] sm:text-base">
                      Foundational lessons currently available.
                    </p>
                    <div className="mt-3 rounded-xl bg-[#2F4439] px-3 py-2">
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#DCE7E1]">Focus</p>
                      <p className="mt-1 secondary-font text-sm text-white">JLPT-style foundations with kana, core vocabulary, and speaking reps.</p>
                    </div>
                  </article>
                </div>
                <p className="mx-auto mt-5 max-w-4xl text-center font-mono text-sm font-light leading-relaxed text-[#475569] sm:mt-6 sm:text-sm">
                  More languages will be introduced as the system expands.
                </p>
              </article>
            </div>
          </div>
        </div>

        <PublicFooter />
      </main>

      {modalMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/45 px-4 py-8"
          role="dialog"
          aria-modal="true"
          onClick={() => setModalMode(null)}
        >
          <div className="relative w-full max-w-lg" onClick={(event) => event.stopPropagation()}>
            <AuthScreen
              initialMode={modalMode}
              variant="modal"
              showDemoTab={modalMode === 'demo'}
              showAuthTabs={modalMode !== 'demo'}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ExploreCardPreview({ title }: { title: string }) {
  if (title === 'Speaking Feedback') {
    return (
      <div className="h-full rounded-lg bg-[#1F2A37] p-2.5 text-white sm:p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wide text-[#8DD3AE] sm:text-[11px]">
            Excellent
          </span>
          <span className="text-[9px] text-white/70 sm:text-[10px]">Speak Result</span>
        </div>
        <div className="mt-2 space-y-1.5">
          <MiniScoreRow label="Initial" />
          <MiniScoreRow label="Final" />
          <MiniScoreRow label="Tone" />
        </div>
        <div className="mt-2 space-y-1 text-[9px] leading-snug text-white/95 sm:mt-2.5 sm:space-y-1.5 sm:text-[11px] sm:leading-relaxed">
          <p>
            <span className="font-semibold text-[#BCEAD2]">Excellent:</span> Great initial, final, and tone control.
          </p>
          <p>
            <span className="font-semibold text-white">Next Goal:</span> keep this same clarity on the next word.
          </p>
        </div>
      </div>
    );
  }
  if (title === 'Practice Focus') return <MiniPracticeFocusPreview />;
  if (title === 'Travel Sprint') return <MiniTravelPreview />;
  return <div className="h-full rounded-lg bg-[#B6C3D4]" />;
}

function ExploreDemoCard({ card }: { card: DemoCard }) {
  return (
    <article className="h-[306px] overflow-hidden rounded-2xl bg-white shadow-[0_10px_24px_-20px_rgba(15,23,42,0.35)] sm:min-h-[290px] sm:h-auto">
      <div className="h-[202px] bg-[#1F2A37] p-3 sm:h-[198px]">
        <ExploreCardPreview title={card.title} />
      </div>
      <div className="h-[104px] p-2.5 sm:h-auto sm:p-4">
        <h3 className="main-font text-xl leading-tight sm:text-2xl">{card.title}</h3>
        <p className="secondary-font mt-1.5 text-xs leading-relaxed text-[#334155] sm:mt-2 sm:text-sm">{card.body}</p>
      </div>
    </article>
  );
}

function MobileExploreStepper({ cards }: { cards: DemoCard[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (cards.length <= 1) return;
    const FADE_MS = 500;
    const HOLD_MS = 5000;
    let swapTimer: number | null = null;

    const cycleTimer = window.setInterval(() => {
      setVisible(false);
      if (swapTimer) window.clearTimeout(swapTimer);
      swapTimer = window.setTimeout(() => {
        setActiveIdx((prev) => (prev + 1) % cards.length);
        setVisible(true);
      }, FADE_MS);
    }, HOLD_MS + FADE_MS);

    return () => {
      window.clearInterval(cycleTimer);
      if (swapTimer) window.clearTimeout(swapTimer);
    };
  }, [cards.length]);

  return (
    <div className="relative">
      <div className={`transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
        <ExploreDemoCard card={cards[activeIdx]} />
      </div>
    </div>
  );
}

function MiniScoreRow({ label }: { label: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[8px] text-white/75 sm:text-[9px]">
        <span>{label}</span>
        <span>100%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/18">
        <div className="h-full w-full rounded-full bg-[#8DD3AE] animate-[pulse_3s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}

function MiniPracticeFocusPreview() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const FADE_MS = 240;
    const HOLD_MS = 1650;
    let swapTimer: number | null = null;
    const timer = window.setInterval(() => {
      setVisible(false);
      if (swapTimer) window.clearTimeout(swapTimer);
      swapTimer = window.setTimeout(() => {
        setStep((prev) => (prev + 1) % 3);
        setVisible(true);
      }, FADE_MS);
    }, HOLD_MS + FADE_MS);

    return () => {
      window.clearInterval(timer);
      if (swapTimer) window.clearTimeout(swapTimer);
    };
  }, []);

  const frame =
    step === 0 ? (
      <div className="text-[21px] font-medium leading-none text-[#C2410C] sm:text-[22px]">nin ho</div>
    ) : step === 1 ? (
      <div className="text-[20px] leading-none sm:text-[21px]">
        <span className="text-white">n</span>
        <span className="text-[#8DD3AE]">ǐ</span>
        <span className="text-white"> </span>
        <span className="text-white">h</span>
        <span className="text-[#8DD3AE]">ǎo</span>
      </div>
    ) : (
      <div className="flex items-center justify-center gap-1 text-[20px] leading-none text-[#8DD3AE] sm:text-[21px]">
        <span>你好</span>
        <span>✓</span>
      </div>
    );

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center rounded-lg bg-[#1F2A37] p-2.5 text-center text-white sm:p-3">
      <div className={`transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}>
        {frame}
      </div>
    </div>
  );
}

function MiniTravelPreview() {
  const stops = ['Airport', 'Hotel', 'Transit'];
  const travelPath = [0, 1, 2, 1] as const;
  const [pathStep, setPathStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPathStep((prev) => (prev + 1) % travelPath.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [travelPath.length]);

  const activeStop = travelPath[pathStep];
  const travelPercent = activeStop === 0 ? 8 : activeStop === 1 ? 49 : 89;
  const samples = [
    { script: '请问，航站楼怎么走？', reading: 'qǐngwèn, hángzhànlóu zěnme zǒu?' },
    { script: '请问，地铁站在哪里？', reading: 'qǐngwèn, dìtiě zhàn zài nǎlǐ?' },
    { script: '我要去这个地址。', reading: 'wǒ yào qù zhège dìzhǐ.' },
  ] as const;
  const sample = samples[activeStop];

  return (
    <div className="relative flex h-full w-full flex-col rounded-lg bg-[#1F2A37] p-2.5 text-white sm:p-3">
      <div className="text-[8px] font-mono uppercase tracking-[0.18em] text-white/70 sm:text-[9px]">
        Travel Sprint
      </div>

      <div className="relative mt-2 h-7">
        <div className="absolute left-[8%] right-[8%] top-1/2 -translate-y-1/2 border-t border-dashed border-white/35" />
        {stops.map((stop, idx) => {
          const left = idx === 0 ? '8%' : idx === 1 ? '49%' : '89%';
          const isActive = idx === activeStop;
          return (
            <span
              key={stop}
              className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                isActive ? 'bg-[#8DD3AE] shadow-[0_0_0_4px_rgba(141,211,174,0.18)] animate-pulse' : 'bg-white/35'
              }`}
              style={{ left }}
            />
          );
        })}
        <Plane
          className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white transition-all duration-700 ease-out sm:h-4 sm:w-4"
          style={{ left: `${travelPercent}%` }}
        />
      </div>

      <div className="mt-2 rounded-md border border-white/15 bg-white/8 px-2 py-1.5">
        <div className="text-[9px] text-white/85 sm:text-[10px]">{sample.script}</div>
        <div className="mt-1 text-[8px] text-[#D6E2EE] sm:text-[9px]">{sample.reading}</div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-1">
        {stops.map((stop, idx) => (
          <span
            key={`${stop}-chip`}
            className={`rounded px-1.5 py-0.5 text-[7px] font-mono uppercase tracking-wide sm:text-[8px] ${
              idx === activeStop ? 'bg-white/22 text-white' : 'bg-white/10 text-white/65'
            }`}
          >
            {stop}
          </span>
        ))}
      </div>
    </div>
  );
}
