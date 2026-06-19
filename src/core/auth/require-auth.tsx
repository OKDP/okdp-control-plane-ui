import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';
import { AUTH_RETURN_URL_KEY } from '../storage-keys';

/**
 * Route guard that ensures the user is authenticated.
 * If not authenticated, saves the current location for post-login restore and
 * redirects to the login page. The router is only rendered once auth is ready
 * (see App); the `!ready` guard fails closed should that invariant ever break.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, isAuthenticated } = useAuth();
  const location = useLocation();

  // Persist the deep link before bouncing to /login so AuthRedirector can
  // restore it after re-login — covers mid-session expiry (silent-renew
  // failure, 401 forced logout), where auth-context's mount-time save is long
  // gone. Mirrors its guard: never save the landing/login pages.
  const expired = ready && !isAuthenticated;
  const returnUrl = location.pathname + location.search;
  useEffect(() => {
    if (expired && location.pathname !== '/' && !location.pathname.includes('login')) {
      sessionStorage.setItem(AUTH_RETURN_URL_KEY, returnUrl);
    }
  }, [expired, returnUrl, location.pathname]);

  if (!ready) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
