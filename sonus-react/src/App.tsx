import { BrowserRouter, HashRouter } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  const Router = import.meta.env.PROD ? HashRouter : BrowserRouter;
  return (
    <AppProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AppProvider>
  );
}
