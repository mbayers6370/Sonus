import { AppProvider } from '../../contexts/AppContext';
import AppRoutes from '../../routes/AppRoutes';

export default function SignedInApp() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  );
}
