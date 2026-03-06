import { useEffect } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import AppRoutes from './routes/AppRoutes';
import AuthScreen from './components/AuthScreen';
import PublicLanding from './components/PublicLanding';
import GlassLoader from './components/ui/GlassLoader';
import PrivacyPage from './components/public/PrivacyPage';
import TermsPage from './components/public/TermsPage';
import ContactPage from './components/public/ContactPage';

type RouterKind = 'browser' | 'hash';
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

function resolveRouterKind(): RouterKind {
  const configured = (import.meta.env.VITE_ROUTER_MODE || '').trim().toLowerCase();
  if (configured === 'browser') return 'browser';
  if (configured === 'hash') return 'hash';
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
  const { status } = useAuth();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    console.info('[sonus] boot', {
      router: routerKind,
      authStatus: status,
      pathname: window.location.pathname,
      hash: window.location.hash,
    });
  }, [routerKind, status]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen page-shell flex items-center justify-center">
        <GlassLoader />
      </div>
    );
  }

  if (status === 'signed_out') {
    return (
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/landing" element={<PublicLanding />} />
      <Route
        path="*"
        element={(
          <AppProvider>
            <AppRoutes />
          </AppProvider>
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
