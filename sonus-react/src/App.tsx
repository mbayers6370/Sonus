import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import GlassLoader from './components/ui/GlassLoader';
const AuthScreen = lazy(() => import('./components/AuthScreen'));
const PublicLanding = lazy(() => import('./components/PublicLanding'));
const PrivacyPage = lazy(() => import('./components/public/PrivacyPage'));
const TermsPage = lazy(() => import('./components/public/TermsPage'));
const ContactPage = lazy(() => import('./components/public/ContactPage'));
const AttributionsPage = lazy(() => import('./components/public/AttributionsPage'));
const TravelMandarinPhrasesPage = lazy(() =>
  import('./components/public/TravelSeoPages').then((module) => ({ default: module.TravelMandarinPhrasesPage }))
);
const MandarinAirportPhrasesPage = lazy(() =>
  import('./components/public/TravelSeoPages').then((module) => ({ default: module.MandarinAirportPhrasesPage }))
);
const MandarinTaxiPhrasesPage = lazy(() =>
  import('./components/public/TravelSeoPages').then((module) => ({ default: module.MandarinTaxiPhrasesPage }))
);
const OrderFoodInChinesePage = lazy(() =>
  import('./components/public/TravelSeoPages').then((module) => ({ default: module.OrderFoodInChinesePage }))
);
const SpeakChineseForTravelPage = lazy(() =>
  import('./components/public/TravelSeoPages').then((module) => ({ default: module.SpeakChineseForTravelPage }))
);
const DirectionsInChinesePage = lazy(() =>
  import('./components/public/TravelSeoPages').then((module) => ({ default: module.DirectionsInChinesePage }))
);
const HskMandarinForTravelersPage = lazy(() =>
  import('./components/public/TravelSeoPages').then((module) => ({ default: module.HskMandarinForTravelersPage }))
);
const AskForBillInChinesePage = lazy(() =>
  import('./components/public/TravelSeoPages').then((module) => ({ default: module.AskForBillInChinesePage }))
);
const MandarinHotelPhrasesPage = lazy(() =>
  import('./components/public/TravelSeoPages').then((module) => ({ default: module.MandarinHotelPhrasesPage }))
);
const MandarinEmergencyPhrasesPage = lazy(() =>
  import('./components/public/TravelSeoPages').then((module) => ({ default: module.MandarinEmergencyPhrasesPage }))
);
const ChineseShoppingPhrasesPage = lazy(() =>
  import('./components/public/TravelSeoPages').then((module) => ({ default: module.ChineseShoppingPhrasesPage }))
);
const DigitalChinaTravelPhrasesPage = lazy(() =>
  import('./components/public/TravelSeoPages').then((module) => ({ default: module.DigitalChinaTravelPhrasesPage }))
);
const ChineseSmallTalkForTravelPage = lazy(() =>
  import('./components/public/TravelSeoPages').then((module) => ({ default: module.ChineseSmallTalkForTravelPage }))
);
const EssentialMandarinTravelPhrasesPillarPage = lazy(() =>
  import('./components/public/TravelSeoPages').then((module) => ({ default: module.EssentialMandarinTravelPhrasesPillarPage }))
);
const EssentialJapaneseTravelPhrasesPillarPage = lazy(() =>
  import('./components/public/TravelSeoPages').then((module) => ({ default: module.EssentialJapaneseTravelPhrasesPillarPage }))
);
const SignedInApp = lazy(() => import('./components/internal/SignedInApp'));
const SupportConsolePage = lazy(() => import('./components/internal/SupportConsolePage'));

type RouterKind = 'browser' | 'hash';
const HAS_VISITED_KEY = 'sonus.has_visited';
const LAST_LANGUAGE_KEY = 'sonus.last_language';
const SEO_PUBLIC_PATHS = new Set([
  '/essential-mandarin-travel-phrases',
  '/travel-mandarin-phrases',
  '/mandarin-airport-phrases',
  '/mandarin-taxi-phrases',
  '/how-to-order-food-in-chinese',
  '/speak-chinese-for-travel',
  '/how-to-ask-for-directions-in-chinese',
  '/hsk-mandarin-for-travelers',
  '/how-to-ask-for-the-bill-in-chinese',
  '/mandarin-hotel-phrases',
  '/mandarin-emergency-phrases',
  '/chinese-shopping-phrases',
  '/digital-china-travel-phrases',
  '/chinese-small-talk-for-travel',
  '/essential-japanese-travel-phrases',
]);

function normalizePathname(pathname: string) {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === '/') return '/';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function shouldUseBrowserRouterInProd() {
  if (typeof window === 'undefined') return false;
  const normalizedPath = normalizePathname(window.location.pathname);
  return SEO_PUBLIC_PATHS.has(normalizedPath);
}

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

function resolveRouterKind(): RouterKind {
  const configured = (import.meta.env.VITE_ROUTER_MODE || '').trim().toLowerCase();
  if (configured === 'browser') return 'browser';
  if (configured === 'hash') return 'hash';
  if (import.meta.env.PROD && shouldUseBrowserRouterInProd()) return 'browser';
  return import.meta.env.PROD ? 'hash' : 'browser';
}

function normalizeHashDeepLinkIfNeeded(routerKind: RouterKind) {
  if (typeof window === 'undefined' || routerKind !== 'hash') return;
  const { pathname, search, hash } = window.location;
  if (hash) return;

  // Keep the public landing canonical at '/'.
  if (!pathname || pathname === '/') return;

  const nextUrl = `${window.location.origin}/#${pathname}${search}`;
  window.location.replace(nextUrl);
}

function AppShell({ routerKind }: { routerKind: RouterKind }) {
  const { status, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showReauthModal, setShowReauthModal] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    console.info('[sonus] boot', {
      router: routerKind,
      authStatus: status,
      pathname: window.location.pathname,
      hash: window.location.hash,
    });
  }, [routerKind, status]);

  useEffect(() => {
    if (status !== 'signed_out') {
      setShowReauthModal(false);
      return;
    }
    if (location.pathname.startsWith('/internal/support')) {
      setShowReauthModal(false);
      return;
    }
    const requiresReauth = typeof error === 'string' && /please sign in again/i.test(error);
    if (requiresReauth) setShowReauthModal(true);
  }, [error, location.pathname, status]);

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
          <Route path="/essential-mandarin-travel-phrases" element={<EssentialMandarinTravelPhrasesPillarPage />} />
          <Route path="/travel-mandarin-phrases" element={<TravelMandarinPhrasesPage />} />
          <Route path="/mandarin-airport-phrases" element={<MandarinAirportPhrasesPage />} />
          <Route path="/mandarin-taxi-phrases" element={<MandarinTaxiPhrasesPage />} />
          <Route path="/how-to-order-food-in-chinese" element={<OrderFoodInChinesePage />} />
          <Route path="/speak-chinese-for-travel" element={<SpeakChineseForTravelPage />} />
          <Route path="/how-to-ask-for-directions-in-chinese" element={<DirectionsInChinesePage />} />
          <Route path="/hsk-mandarin-for-travelers" element={<HskMandarinForTravelersPage />} />
          <Route path="/how-to-ask-for-the-bill-in-chinese" element={<AskForBillInChinesePage />} />
          <Route path="/mandarin-hotel-phrases" element={<MandarinHotelPhrasesPage />} />
          <Route path="/mandarin-emergency-phrases" element={<MandarinEmergencyPhrasesPage />} />
          <Route path="/chinese-shopping-phrases" element={<ChineseShoppingPhrasesPage />} />
          <Route path="/digital-china-travel-phrases" element={<DigitalChinaTravelPhrasesPage />} />
          <Route path="/chinese-small-talk-for-travel" element={<ChineseSmallTalkForTravelPage />} />
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
        {showReauthModal && (
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
                    setShowReauthModal(false);
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
      <Route path="/essential-mandarin-travel-phrases" element={<EssentialMandarinTravelPhrasesPillarPage />} />
      <Route path="/travel-mandarin-phrases" element={<TravelMandarinPhrasesPage />} />
      <Route path="/mandarin-airport-phrases" element={<MandarinAirportPhrasesPage />} />
      <Route path="/mandarin-taxi-phrases" element={<MandarinTaxiPhrasesPage />} />
      <Route path="/how-to-order-food-in-chinese" element={<OrderFoodInChinesePage />} />
      <Route path="/speak-chinese-for-travel" element={<SpeakChineseForTravelPage />} />
      <Route path="/how-to-ask-for-directions-in-chinese" element={<DirectionsInChinesePage />} />
      <Route path="/hsk-mandarin-for-travelers" element={<HskMandarinForTravelersPage />} />
      <Route path="/how-to-ask-for-the-bill-in-chinese" element={<AskForBillInChinesePage />} />
      <Route path="/mandarin-hotel-phrases" element={<MandarinHotelPhrasesPage />} />
      <Route path="/mandarin-emergency-phrases" element={<MandarinEmergencyPhrasesPage />} />
      <Route path="/chinese-shopping-phrases" element={<ChineseShoppingPhrasesPage />} />
      <Route path="/digital-china-travel-phrases" element={<DigitalChinaTravelPhrasesPage />} />
      <Route path="/chinese-small-talk-for-travel" element={<ChineseSmallTalkForTravelPage />} />
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
  const routerKind = resolveRouterKind();
  normalizeHashDeepLinkIfNeeded(routerKind);
  const Router = routerKind === 'browser' ? BrowserRouter : HashRouter;

  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <AppShell routerKind={routerKind} />
      </Router>
    </AuthProvider>
  );
}
