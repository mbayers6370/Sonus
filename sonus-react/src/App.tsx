import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import GlassLoader from './components/ui/GlassLoader';
const AuthScreen = lazy(() => import('./components/AuthScreen'));
const PublicLanding = lazy(() => import('./components/PublicLanding'));
const PrivacyPage = lazy(() => import('./components/public/PrivacyPage'));
const TermsPage = lazy(() => import('./components/public/TermsPage'));
const ContactPage = lazy(() => import('./components/public/ContactPage'));
const AttributionsPage = lazy(() => import('./components/public/AttributionsPage'));
const EssentialJapaneseTravelPhrasesPillarPage = lazy(() =>
  import('./components/public/TravelSeoPages').then((module) => ({ default: module.EssentialJapaneseTravelPhrasesPillarPage }))
);
const SignedInApp = lazy(() => import('./components/internal/SignedInApp'));
const SupportConsolePage = lazy(() => import('./components/internal/SupportConsolePage'));

const HAS_VISITED_KEY = 'sonus.has_visited';
const LAST_LANGUAGE_KEY = 'sonus.last_language';

function hasReturningVisitorSignal() {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(
      window.localStorage.getItem(HAS_VISITED_KEY) === '1' ||
      (window.localStorage.getItem(LAST_LANGUAGE_KEY) || '').trim()
    );
  } catch {
    return false;
  }
}

function markVisited() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HAS_VISITED_KEY, '1');
  } catch {
    // Ignore storage failures.
  }
}

function normalizeLegacyHashRouteIfNeeded() {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash || '';
  if (!hash.startsWith('#/')) return;
  const nextPath = hash.slice(1);
  const nextUrl = `${window.location.origin}${nextPath}`;
  window.location.replace(nextUrl);
}

function AppShell() {
  const { status, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [reauthModalDismissed, setReauthModalDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    console.info('[sonus] boot', {
      authStatus: status,
      pathname: window.location.pathname,
      hash: window.location.hash,
    });
  }, [status]);

  const showReauthModal = useMemo(() => {
    if (status !== 'signed_out') return false;
    if (location.pathname.startsWith('/internal/support')) return false;
    return typeof error === 'string' && /please sign in again/i.test(error);
  }, [error, location.pathname, status]);

  useEffect(() => {
    if (!showReauthModal) {
      setReauthModalDismissed(false);
    }
  }, [showReauthModal]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen page-shell flex items-center justify-center">
        <GlassLoader />
      </div>
    );
  }

  if (status === 'signed_out') {
    return (
      <Suspense
        fallback={(
          <div className="min-h-screen page-shell flex items-center justify-center">
            <GlassLoader compact message="Loading page..." />
          </div>
        )}
      >
        <Routes>
          <Route path="/" element={<PublicEntryRoute />} />
          <Route path="/landing" element={<PublicLanding />} />
          <Route path="/login" element={<AuthScreen initialMode="signin" />} />
          <Route path="/signup" element={<AuthScreen initialMode="signup" />} />
          <Route path="/demo" element={<AuthScreen initialMode="demo" />} />
          <Route path="/forgot-password" element={<AuthScreen initialMode="forgot" />} />
          <Route path="/reset-password" element={<AuthScreen initialMode="reset" />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/attributions" element={<AttributionsPage />} />
          <Route path="/essential-japanese-travel-phrases" element={<EssentialJapaneseTravelPhrasesPillarPage />} />
          <Route
            path="/internal/support/*"
            element={(
              <Suspense
                fallback={(
                  <div className="min-h-screen page-shell flex items-center justify-center">
                    <GlassLoader compact message="Loading support console..." />
                  </div>
                )}
              >
                <SupportConsolePage />
              </Suspense>
            )}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {showReauthModal && !reauthModalDismissed && (
          <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 px-4">
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Session expired"
              className="w-full max-w-md rounded-2xl border border-white/30 bg-white p-5 shadow-2xl"
            >
              <h2 className="main-font text-center text-xl font-semibold text-[#1F2A37]">Please Sign In Again</h2>
              <p className="font-secondary mt-2 text-sm leading-6 text-[#334155]">
                Your session has ended. Please continue to sign in and resume where you left off.
              </p>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setReauthModalDismissed(true);
                    navigate('/login');
                  }}
                  className="font-mono rounded-lg bg-[#1F2A37] px-4 py-2 text-sm font-semibold text-white"
                >
                  Continue
                </button>
              </div>
            </section>
          </div>
        )}
      </Suspense>
    );
  }

  return (
    <Routes>
      <Route path="/landing" element={<PublicLanding />} />
      <Route path="/essential-japanese-travel-phrases" element={<EssentialJapaneseTravelPhrasesPillarPage />} />
      <Route
        path="*"
        element={(
          <Suspense
            fallback={(
              <div className="min-h-screen page-shell flex items-center justify-center">
                <GlassLoader compact message="Loading app..." />
              </div>
            )}
          >
            <SignedInApp />
          </Suspense>
        )}
      />
    </Routes>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}

function PublicEntryRoute() {
  const returningVisitor = hasReturningVisitorSignal();

  useEffect(() => {
    if (returningVisitor) return;
    markVisited();
  }, [returningVisitor]);

  if (returningVisitor) {
    return <Navigate to="/login" replace />;
  }
  return <PublicLanding />;
}

export default function App() {
  normalizeLegacyHashRouteIfNeeded();

  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
}
