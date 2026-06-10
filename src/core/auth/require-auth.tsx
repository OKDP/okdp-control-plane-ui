import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';

/**
 * Route guard that ensures the user is authenticated.
 * If not authenticated, redirects to the login page with a returnUrl.
 * The router is only rendered once auth is ready (see App), so no
 * loading state is needed here.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, isAuthenticated } = useAuth();
  const location = useLocation();

  if (ready && !isAuthenticated) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }

  return children;
}
