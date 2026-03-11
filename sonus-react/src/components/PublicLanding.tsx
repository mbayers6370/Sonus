import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Check, Menu, Mic, Plane, Volume2, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import PublicFooter from './public/PublicFooter';
import SEOHead from './public/SEOHead';
import { useAuth } from '../contexts/AuthContext';
const AuthScreen = lazy(() => import('./AuthScreen'));

type AuthMode = 'signin' | 'signup';
type ModalMode = AuthMode | 'demo';
type DemoCard = {
  title: string;
  body: string;
};

export default function PublicLanding() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
  );
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileEmail, setMobileEmail] = useState('');
  const [mobilePassword, setMobilePassword] = useState('');
  const [mobileRememberMe, setMobileRememberMe] = useState(true);
  const [mobileLoginError, setMobileLoginError] = useState<string | null>(null);
  const [mobileLoginLoading, setMobileLoginLoading] = useState(false);

  useEffect(() => {
    // Keep desktop/mobile CTA behavior in sync with runtime viewport changes.
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 1024px)');
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    // Support Esc-to-close for all modal modes.
    if (!modalMode && !mobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModalMode(null);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalMode, mobileMenuOpen]);

  useEffect(() => {
    // Prevent background scroll while auth/demo modal is open.
    if (typeof document === 'undefined') return;
    const previous = document.body.style.overflow;
    if (modalMode || mobileMenuOpen) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [modalMode, mobileMenuOpen]);

  useEffect(() => {
    if (!isDesktop) return;
    setMobileMenuOpen(false);
  }, [isDesktop]);

  const authCtaLabel = useMemo(() => 'Login', []);
  const landingDescription = useMemo(
    () =>
      'Sonus is a language learning platform built on real fluency frameworks like JLPT. Practice vocabulary, speaking, and travel phrases through structured lessons.',
    []
  );
  const demoCards = useMemo<DemoCard[]>(
    () => [
      {
        title: 'Precision',
        body: 'Hear the sound. Shape the pronunciation.',
      },
      {
        title: 'Reinforcement',
        body: 'Strengthen weak words.',
      },
      {
        title: 'Real Context',
        body: 'Use language naturally.',
      },
    ],
    []
  );
  const heroLineVariants = useMemo(
    () => [
      'Language learning built to last.',
      '続く語学学習を。',
      '오래 가는 언어 학습.',
      "Apprentissage des langues concu pour durer.",
      'Aprendizaje de idiomas pensado para durar.',
      'Language learning built to last.',
    ],
    []
  );
  const [heroLineVariantIdx, setHeroLineVariantIdx] = useState(0);
  const activeHeroLine = heroLineVariants[heroLineVariantIdx] || '';
  const useCompactHeroLine = activeHeroLine.length > 24;

  const openAuth = (mode: ModalMode) => {
    setMobileMenuOpen(false);
    setMobileLoginError(null);
    setModalMode(mode);
  };

  const submitMobileLogin = async () => {
    if (mobileLoginLoading) return;
    setMobileLoginError(null);
    const email = mobileEmail.trim();
    const password = mobilePassword;
    if (!email || !password) {
      setMobileLoginError('Enter your email and password.');
      return;
    }

    setMobileLoginLoading(true);
    try {
      await signIn(email, password, mobileRememberMe);
      setMobileMenuOpen(false);
      navigate('/', { replace: true });
    } catch (error) {
      const source = (error as Error).message || 'Unable to sign in.';
      if (/too many/i.test(source)) {
        setMobileLoginError(source);
      } else {
        setMobileLoginError('Invalid email or password.');
      }
    } finally {
      setMobileLoginLoading(false);
    }
  };

  useEffect(() => {
    // One-time line shuffle to add motion without an infinite ticker.
    if (heroLineVariants.length <= 1) return;
    if (heroLineVariantIdx >= heroLineVariants.length - 1) return;
    const timer = window.setTimeout(() => {
      setHeroLineVariantIdx((prev) => prev + 1);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [heroLineVariantIdx, heroLineVariants.length]);

  useEffect(() => {
    // Keep structured metadata aligned with current landing copy.
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
    >
      <SEOHead
        title="Sonus | Language Learning Built on Real Fluency Frameworks"
        description={landingDescription}
        canonical="https://sonuslearning.com/"
        ogTitle="Sonus | Language Learning Built on Real Fluency Frameworks"
        ogUrl="https://sonuslearning.com/"
      />
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/96 backdrop-blur-2xl shadow-[0_10px_26px_-22px_rgba(15,44,66,0.35)]">
        <div className="mx-auto grid h-16 w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-8">
            <div className="justify-self-start" />
            <img
              src="/branding/logo_name_solo.png"
              srcSet="/branding/logo_name_solo-500.png 500w, /branding/logo_name_solo.png 1000w"
              sizes="(max-width: 768px) 180px, 260px"
              width={1000}
              height={200}
              alt="Sonus"
              className="h-7 w-auto object-contain justify-self-center sm:h-8"
            />
            <div className="justify-self-end">
              {isDesktop ? (
                <button
                  type="button"
                  onClick={() => openAuth('signin')}
                  className="text-sm text-[#1F2A37] underline-offset-4 transition-colors hover:underline hover:text-[#0C4A6E] sm:text-base"
                >
                  {authCtaLabel}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((open) => !open)}
                  aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#1F2A37] transition-colors hover:bg-[#EAF3F9] active:bg-[#DCECF6]"
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              )}
            </div>
        </div>
        {!isDesktop && mobileMenuOpen && (
          <div className="border-t border-[#4B5563]/20 bg-white px-4 pb-4 pt-3 sm:px-8">
            <div className="mx-auto w-full max-w-6xl">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitMobileLogin();
                }}
                className="rounded-xl border border-[#4B5563]/30 bg-white p-2.5"
              >
                <div className="grid grid-cols-1 gap-1.5">
                  <label className="sr-only" htmlFor="mobile-header-email">Email</label>
                  <input
                    id="mobile-header-email"
                    type="email"
                    value={mobileEmail}
                    onChange={(event) => setMobileEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="Email"
                    className="h-9 rounded-lg border border-[#4B5563]/35 bg-white px-2.5 text-xs text-[#1F2A37] placeholder:text-[#1F2A37]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2A37]/35"
                  />
                  <label className="sr-only" htmlFor="mobile-header-password">Password</label>
                  <input
                    id="mobile-header-password"
                    type="password"
                    value={mobilePassword}
                    onChange={(event) => setMobilePassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Password"
                    className="h-9 rounded-lg border border-[#4B5563]/35 bg-white px-2.5 text-xs text-[#1F2A37] placeholder:text-[#1F2A37]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F2A37]/35"
                  />
                  <button
                    type="submit"
                    disabled={mobileLoginLoading}
                    className="h-9 rounded-lg bg-[#0C4A6E] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#0A3B57] disabled:opacity-60"
                  >
                    {mobileLoginLoading ? '...' : 'Login'}
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-[#1F2A37]">
                    <input
                      type="checkbox"
                      checked={mobileRememberMe}
                      onChange={(event) => setMobileRememberMe(event.target.checked)}
                      className="h-3.5 w-3.5 rounded border-[#4B5563]/45 bg-white text-[#1F2A37] focus:ring-[#1F2A37]/35"
                    />
                    <span>Remember me</span>
                  </label>
                  {mobileLoginError && (
                    <p className="text-[11px] text-[#1F2A37]" role="status" aria-live="polite">
                      {mobileLoginError}
                    </p>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </header>

      <main
        className="pt-16"
        style={{
          backgroundColor: '#F7F8FA',
          backgroundImage: 'linear-gradient(180deg, #FAFBFC 0%, #F4F6F8 60%, #F7F8FA 100%)',
        }}
      >
        <div className="relative overflow-hidden">
          <section className="relative w-full py-8 sm:py-12 lg:py-14">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-8">
              <div className="grid items-start gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
                <div className="text-center lg:text-left">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#0C4A6E]">Sonus Learning Platform</p>
                  <h1 className="main-font mt-4 text-4xl leading-[1.04] text-[#1F2A37] sm:text-5xl lg:text-[4rem]">
                    Speak with clarity.
                    <br />
                    Learn with structure.
                  </h1>
                  <p className="secondary-font mx-auto mt-6 max-w-[38ch] text-base leading-relaxed text-[#334155] sm:text-lg lg:mx-0">
                    Sonus combines framework-based language paths with speaking reps, feedback, and recall loops so learners build durable fluency instead of short-term memorization.
                  </p>
                  <p className="secondary-font mt-5 text-center text-lg font-semibold text-[#186E95] sm:mt-6 sm:text-xl lg:mx-0 lg:text-left">
                    <span
                      key={`${heroLineVariants[heroLineVariantIdx]}-${heroLineVariantIdx}`}
                      className={`dashboard-card-enter mx-auto block min-h-[2.6em] max-w-[24ch] font-semibold leading-tight lg:mx-0 ${
                        useCompactHeroLine ? 'text-[1rem] sm:text-[1.08rem]' : 'text-[1.08rem] sm:text-[1.22rem]'
                      }`}
                    >
                      {activeHeroLine}
                    </span>
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-3 sm:mt-6 lg:justify-start">
                    <button
                      type="button"
                      onClick={() => openAuth('signup')}
                      className="rounded-xl bg-[#1F2A37] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#111827] sm:text-base"
                    >
                      Start Free
                    </button>
                    <button
                      type="button"
                      onClick={() => openAuth('demo')}
                      className="rounded-xl border border-[#4B5563] bg-white px-6 py-3 text-sm font-semibold text-[#1F2A37] transition-colors hover:bg-[#F8FBFD] sm:text-base"
                    >
                      Guided Walkthrough
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-[#475569] sm:text-sm">Free, no account needed to explore.</p>
                </div>

                <aside className="grid gap-3 pt-1">
                  <HeroMethodCard
                    kicker="01"
                    title="Practice Rhythm"
                    subtitle="Flexible Pace"
                    body="Practice in short or extended sessions."
                    accent="#186E95"
                    motif="wave"
                    className="lg:w-[86%] lg:-translate-x-2"
                  />
                  <HeroMethodCard
                    kicker="02"
                    title="Learning Tracks"
                    subtitle="JLPT"
                    body="Framework-aligned progression."
                    accent="#0C4A6E"
                    motif="grid"
                    className="lg:w-[90%] lg:translate-x-2"
                  />
                  <HeroMethodCard
                    kicker="03"
                    title="Practice Modes"
                    subtitle="3 Core Modes"
                    body="Speak, Focus, and Travel."
                    accent="#C56A3D"
                    motif="route"
                    className="lg:w-[84%] lg:translate-x-0"
                  />
                </aside>
              </div>
            </div>
          </section>
        </div>

        <section className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-8">
          <aside className="overflow-hidden rounded-3xl border border-[#0F172A] bg-[#1F2A37] text-white shadow-[0_16px_30px_-24px_rgba(15,23,42,0.55)]">
            <div className="px-5 py-6 text-center sm:px-8 sm:py-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#186E95]">About Sonus</p>
              <h2 className="main-font mt-2 text-2xl leading-[1.15] text-white sm:text-[2rem]">Built for real language use</h2>
              <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-[#D6E2EE] sm:text-base">
                Sonus is a structured language platform focused on practical speaking, reliable progression, and long-term retention.
              </p>

              <div className="mx-auto mt-6 grid max-w-5xl gap-4 text-center sm:grid-cols-3 sm:gap-0">
                <div className="px-2 sm:px-5 sm:border-r sm:border-[#334155]">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#186E95]">Framework-grounded</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#D6E2EE]">Progression aligned to JLPT levels.</p>
                </div>
                <div className="px-2 sm:px-5 sm:border-r sm:border-[#334155]">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#186E95]">Speaking-first</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#D6E2EE]">Practice loops emphasize pronunciation and recall.</p>
                </div>
                <div className="px-2 sm:px-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#186E95]">Built to stick</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#D6E2EE]">Reinforcement targets weak points before they fade.</p>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-8">
          <article className="rounded-3xl border border-[#4B5563] bg-white p-4 shadow-[0_20px_42px_-34px_rgba(31,42,55,0.28)] sm:p-6">
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.16em] text-[#186E95]">Process</p>
            <h2 className="main-font mt-2 text-center text-2xl text-[#1F2A37] sm:text-5xl">How Sonus Works</h2>
            <p className="mx-auto mt-3 max-w-3xl text-center text-sm leading-relaxed text-[#475569] sm:text-base">
              Structured practice loops that move from precision to spontaneous use.
            </p>
            <div className="mx-auto mt-6 grid max-w-6xl gap-4 md:grid-cols-3 md:gap-5">
              {demoCards.map((card) => (
                <ExploreDemoCard key={card.title} card={card} />
              ))}
            </div>
          </article>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-4 pb-10 sm:px-8 sm:pb-12">
          <article className="rounded-3xl border border-[#4B5563] bg-white p-4 shadow-[0_20px_42px_-34px_rgba(31,42,55,0.28)] sm:p-6">
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.16em] text-[#186E95]">In Progress</p>
            <h2 className="main-font mt-2 text-center text-2xl text-[#1F2A37] sm:text-5xl">Languages</h2>
            <p className="mx-auto mt-3 max-w-3xl text-center secondary-font text-sm leading-relaxed text-[#475569] sm:text-base">
              Structured paths with pronunciation, recall, and travel-ready practice.
            </p>
            <div className="mx-auto mt-6 grid max-w-5xl gap-4 sm:grid-cols-2 sm:gap-5">
              <article className="rounded-3xl border border-[#6B7280] bg-[#FBFCFD] p-5 text-[#1F2A37] shadow-[0_16px_30px_-24px_rgba(15,23,42,0.35)] sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="main-font text-2xl leading-tight text-[#1F2A37] sm:text-3xl">Japanese</h3>
                    <p className="mt-1 secondary-font text-sm text-[#334155] sm:text-base">日本語</p>
                  </div>
                  <span className="rounded-full border border-[#0C4A6E] bg-[#0C4A6E] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-white">
                    Active
                  </span>
                </div>
                <p className="secondary-font mt-3 text-sm leading-relaxed text-[#334155] sm:text-base">
                  Structured curriculum and speaking practice are available now.
                </p>
                <div className="mt-4 rounded-xl border border-[#1F2A37] bg-[#1F2A37] px-3 py-2.5">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#C3D7E8]">Focus</p>
                  <p className="mt-1 secondary-font text-sm text-white">JLPT-style progression, speaking feedback, and practical dialog.</p>
                </div>
              </article>

              <article className="rounded-3xl border border-[#6B7280] bg-[#FBFCFD] p-5 text-[#1F2A37] shadow-[0_16px_30px_-24px_rgba(15,23,42,0.35)] sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="main-font text-2xl leading-tight text-[#1F2A37] sm:text-3xl">More Languages</h3>
                    <p className="mt-1 secondary-font text-sm text-[#334155] sm:text-base">Coming soon</p>
                  </div>
                  <span className="rounded-full border border-[#475569] bg-[#475569] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-white">
                    Planned
                  </span>
                </div>
                <p className="secondary-font mt-3 text-sm leading-relaxed text-[#334155] sm:text-base">
                  Additional tracks will roll out as curriculum and tooling are finalized.
                </p>
                <div className="mt-4 rounded-xl border border-[#0C4A6E] bg-[#0C4A6E] px-3 py-2.5">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#DCE7F1]">Focus</p>
                  <p className="mt-1 secondary-font text-sm text-white">Clear proficiency frameworks, speaking-first practice, and durable progression loops.</p>
                </div>
              </article>
            </div>
            <p className="mx-auto mt-5 max-w-4xl text-center font-mono text-sm font-light leading-relaxed text-[#475569] sm:mt-6 sm:text-sm">
              More languages will be introduced as the system expands.
            </p>
          </article>
        </section>

        <PublicFooter />
      </main>

      {modalMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/45 px-4 py-8"
          role="dialog"
          aria-modal="true"
          onClick={() => setModalMode(null)}
        >
          <div className="relative w-full max-w-[42rem]" onClick={(event) => event.stopPropagation()}>
            <Suspense fallback={null}>
              <AuthScreen
                initialMode={modalMode}
                variant="modal"
                showDemoTab={modalMode === 'demo'}
                showAuthTabs={false}
                onClose={() => setModalMode(null)}
              />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}

function ExploreCardPreview({ title }: { title: string }) {
  if (title === 'Precision') {
    return (
      <div className="mx-auto h-full w-full max-w-[90%] text-white">
        <div className="text-center">
          <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-[#D6E5F3] sm:text-[10px]">Precision</span>
        </div>

        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <div className="relative rounded-lg border border-[#3C4B5E] bg-[#243345] px-2 py-1.5">
            <Volume2 className="absolute right-1 top-1 h-2.5 w-2.5 text-[#EAF3FA]" />
            <p className="text-[8px] uppercase tracking-[0.14em] text-[#A9BCD0]">Target</p>
            <p className="mt-0.5 text-[17px] leading-none text-[#EAF3FA] sm:text-[18px]">你好</p>
          </div>
          <div className="relative rounded-lg border border-[#3C4B5E] bg-[#233041] px-2 py-1.5">
            <Mic className="absolute right-1 top-1 h-2.5 w-2.5 text-[#EAF3FA]" />
            <p className="text-[8px] uppercase tracking-[0.14em] text-[#A9BCD0]">Heard</p>
            <p className="mt-0.5 text-[17px] leading-none text-[#EAF3FA] sm:text-[18px]">nǐ hǎo</p>
          </div>
        </div>

        <div className="mt-1.5 space-y-1">
          <div>
            <div className="flex items-center justify-between text-[8px] uppercase tracking-[0.14em] text-[#A9BCD0]">
              <span>Initial</span>
              <span className="text-[#EAF3FA]">100%</span>
            </div>
            <div className="mt-0.5 h-1 rounded-full bg-[#314154]">
              <div className="h-full w-full rounded-full bg-[#EAF3FA] shadow-[0_0_10px_rgba(234,243,250,0.42)]" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-[8px] uppercase tracking-[0.14em] text-[#A9BCD0]">
              <span>Final</span>
              <span className="text-[#EAF3FA]">100%</span>
            </div>
            <div className="mt-0.5 h-1 rounded-full bg-[#314154]">
              <div className="h-full w-full rounded-full bg-[#EAF3FA] shadow-[0_0_10px_rgba(234,243,250,0.42)]" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-[8px] uppercase tracking-[0.14em] text-[#A9BCD0]">
              <span>Tone</span>
              <span className="text-[#EAF3FA]">100%</span>
            </div>
            <div className="mt-0.5 h-1 rounded-full bg-[#314154]">
              <div className="h-full w-full rounded-full bg-[#EAF3FA] shadow-[0_0_10px_rgba(234,243,250,0.42)]" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (title === 'Reinforcement') return <MiniPracticeFocusPreview />;
  if (title === 'Real Context') return <MiniTravelPreview />;
  return <div className="h-full rounded-lg bg-[#B6C3D4]" />;
}

function HeroMethodCard({
  kicker,
  title,
  subtitle,
  body,
  accent,
  motif,
  className,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  body: string;
  accent: string;
  motif: 'wave' | 'grid' | 'route';
  className?: string;
}) {
  const stroke = `${accent}55`;
  const fill = `${accent}1F`;

  return (
    <article className={`group relative min-h-[144px] overflow-hidden rounded-2xl border border-[#CBD5E1] bg-white p-3.5 text-center shadow-[0_14px_28px_-24px_rgba(15,23,42,0.35)] transition-all hover:-translate-y-0.5 ${className || ''}`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <svg viewBox="0 0 320 220" className="h-full w-full" aria-hidden="true" focusable="false">
          {motif === 'wave' ? (
            <>
              <circle cx="252" cy="58" r="44" fill={fill} />
              <path d="M24 174c28-18 58-23 92-17 32 6 60 5 85-8" stroke={stroke} strokeWidth="1.6" fill="none" strokeLinecap="round" />
              <path d="M24 192c28-18 58-23 92-17 32 6 60 5 85-8" stroke={stroke} strokeWidth="1.6" fill="none" strokeLinecap="round" />
            </>
          ) : null}
          {motif === 'grid' ? (
            <>
              <circle cx="250" cy="56" r="40" fill={fill} />
              <path d="M210 56h80M250 16v80M224 30h52M224 82h52M236 42v28M264 42v28" stroke={stroke} strokeWidth="1.6" fill="none" strokeLinecap="round" />
              <path d="M40 190c34-18 76-20 114-8" stroke={stroke} strokeWidth="1.6" fill="none" strokeLinecap="round" />
            </>
          ) : null}
          {motif === 'route' ? (
            <>
              <circle cx="250" cy="56" r="36" fill={fill} />
              <path d="M44 188c30-24 64-37 100-36 34 1 64 13 94 35" stroke={stroke} strokeWidth="1.6" fill="none" strokeLinecap="round" />
              <circle cx="56" cy="188" r="4" fill={accent} />
              <circle cx="238" cy="188" r="4" fill={accent} />
            </>
          ) : null}
        </svg>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/70 to-transparent" />
      <div className="pointer-events-none absolute inset-[8px] rounded-xl border" style={{ borderColor: `${accent}40` }} />
      <div className="relative z-10 flex h-full flex-col items-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: accent }}>
          {kicker} {title}
        </p>
        <div className="-mt-1 flex flex-1 flex-col items-center justify-center">
          <h3 className="main-font text-[1.45rem] leading-tight text-[#1F2A37]">{subtitle}</h3>
          <p className="mx-auto mt-1.5 max-w-[26ch] text-[11px] font-semibold leading-relaxed text-[#475569]">{body}</p>
        </div>
      </div>
    </article>
  );
}

function ExploreDemoCard({ card }: { card: DemoCard }) {
  const isTravelCard = card.title === 'Real Context';
  const stepLabel =
    card.title === 'Precision'
      ? '01 Precision'
      : card.title === 'Reinforcement'
        ? '02 Reinforcement'
        : '03 Real Context';

  return (
    <article className="h-[316px] overflow-hidden rounded-3xl border border-[#6B7280] bg-[#FBFCFD] shadow-[0_16px_30px_-24px_rgba(15,23,42,0.35)] sm:min-h-[300px] sm:h-auto">
      <div className="h-[188px] bg-[#1F2A37] p-3 sm:h-[188px]">
        <ExploreCardPreview title={card.title} />
      </div>
      <div className="h-[128px] p-3 sm:h-auto sm:p-4">
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]">{stepLabel}</p>
        <h3 className="main-font text-center text-xl leading-tight sm:text-[1.85rem]">{card.title}</h3>
        <p className="secondary-font mt-1.5 text-center text-xs leading-relaxed text-[#334155] sm:mt-2 sm:text-sm">{card.body}</p>
        {isTravelCard ? (
          <nav className="sr-only" aria-label="Travel Sprint guides">
            <Link to="/essential-japanese-travel-phrases">Essential Japanese Travel Phrases</Link>
          </nav>
        ) : null}
      </div>
    </article>
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

  const weakWords = ['こんにちは', 'ありがとう', 'すみません'] as const;
  const activeWord = weakWords[step % weakWords.length];
  const wordResolved = step % 2 === 1;

  return (
    <div className="relative mx-auto flex h-full w-full max-w-[90%] flex-col text-white">
      <div className="text-center">
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#B6C8D8] sm:text-[11px]">Practice Focus</div>
      </div>
      <div className={`flex flex-1 flex-col items-center justify-center transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="mt-2 flex items-center gap-2 text-[30px] sm:text-[40px]">
          <span className={`transition-colors duration-300 ${wordResolved ? 'text-[#EAF3FA]' : 'text-[#F87171]'}`}>{activeWord}</span>
          {wordResolved ? <Check className="h-4 w-4 text-[#8DD3AE]" /> : null}
        </div>
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
    { script: 'すみません、搭乗口はどこですか。', reading: 'sumimasen, toujouguchi wa doko desu ka?' },
    { script: 'すみません、駅はどこですか。', reading: 'sumimasen, eki wa doko desu ka?' },
    { script: 'この住所までお願いします。', reading: 'kono juusho made onegaishimasu.' },
  ] as const;
  const sample = samples[activeStop];

  return (
    <div className="relative mx-auto flex h-full w-full max-w-[90%] flex-col text-white">
      <div className="text-center text-[8px] font-mono uppercase tracking-[0.18em] text-[#B6C8D8] sm:text-[9px]">
        Real Context
      </div>

      <div className="relative mt-2 h-7">
        <div className="absolute left-[8%] right-[8%] top-1/2 h-px -translate-y-1/2 bg-[#5E7086]" />
        {stops.map((stop, idx) => {
          const left = idx === 0 ? '8%' : idx === 1 ? '49%' : '89%';
          const isActive = idx === activeStop;
          return (
            <span
              key={stop}
              className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                isActive ? 'bg-[#CFE3F1] shadow-[0_0_0_3px_rgba(207,227,241,0.2)]' : 'bg-[#7B8DA1]'
              }`}
              style={{ left }}
            />
          );
        })}
        <Plane
          className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#EAF3FA] transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] sm:h-4 sm:w-4"
          style={{ left: `${travelPercent}%` }}
        />
      </div>

      <div className="mt-2 text-[9px] text-[#EAF3FA] sm:text-[10px]">{sample.script}</div>
      <div className="mt-1 text-[8px] text-[#C3D5E4] sm:text-[9px]">{sample.reading}</div>

      <div className="mt-2 flex items-center justify-between gap-1">
        {stops.map((stop, idx) => (
          <span
            key={`${stop}-chip`}
            className={`px-0.5 text-[7px] font-mono uppercase tracking-wide sm:text-[8px] ${
              idx === activeStop ? 'text-[#EAF3FA] underline underline-offset-4 decoration-[#9FC1DA]' : 'text-[#9CB0C2]'
            }`}
          >
            {stop}
          </span>
        ))}
      </div>
    </div>
  );
}
