import { useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { PrimeReactProvider } from 'primereact/api';
import { AuthProvider, useAuth } from './core/auth/auth-context';
import { AuthRedirector } from './core/auth/auth-redirector';
import { ProjectContextProvider } from './core/context/project-context';
import { ThemeProvider } from './core/theme/theme-context';
import { AppRoutes } from './app-routes';

// Gate rendering until the OIDC check completes (APP_INITIALIZER equivalent)
function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready } = useAuth();
  if (!ready) {
    return null;
  }
  return children;
}

// Scroll to top on navigation (withInMemoryScrolling equivalent)
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <PrimeReactProvider value={{ ripple: true }}>
      <ThemeProvider>
        <BrowserRouter>
          <ScrollToTop />
          <AuthProvider>
            <AuthGate>
              <AuthRedirector />
              <ProjectContextProvider>
                <AppRoutes />
              </ProjectContextProvider>
            </AuthGate>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </PrimeReactProvider>
  );
}
