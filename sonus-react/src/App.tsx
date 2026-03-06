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

function AppShell() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="min-h-screen page-shell flex items-center justify-center">
        <GlassLoader message="Preparing Sonus..." />
      </div>
    );
  }

  if (status === 'signed_out') {
    return (
      <Routes>
        <Route path="/" element={<PublicLanding />} />
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
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}

export default function App() {
  const routerMode = (import.meta.env.VITE_ROUTER_MODE || '').toLowerCase();
  const useBrowserRouter = routerMode ? routerMode !== 'hash' : !import.meta.env.PROD;
  const Router = useBrowserRouter ? BrowserRouter : HashRouter;
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <AppShell />
      </Router>
    </AuthProvider>
  );
}
