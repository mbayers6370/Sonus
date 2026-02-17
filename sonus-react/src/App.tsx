import { BrowserRouter, HashRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import AppRoutes from './routes/AppRoutes';
import AuthScreen from './components/AuthScreen';

function AppShell() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <div className="min-h-screen page-shell flex items-center justify-center text-text-med">Loading…</div>;
  }

  if (status === 'signed_out') {
    return <AuthScreen />;
  }

  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  );
}

export default function App() {
  const Router = import.meta.env.PROD ? HashRouter : BrowserRouter;
  return (
    <AuthProvider>
      <Router>
        <AppShell />
      </Router>
    </AuthProvider>
  );
}
