import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './auth-context';
import { setUnauthorizedHandler } from '../api/http';
import { AUTH_RETURN_URL_KEY } from '../storage-keys';
import { logger } from '../services/logger';

function shouldRedirect(target: string): boolean {
  // Use window.location.pathname to get the absolute truth from the browser
  const current = window.location.pathname;

  // Already inside a space: never clobber a deep link. This keeps the effect
  // idempotent — it re-runs on every navigation because `navigate` changes
  // identity with the location.
  const spacePrefixes = ['/home', '/projects', '/identity'];
  if (spacePrefixes.some((p) => current.startsWith(p))) {
    return false;
  }
  return current !== target;
}

/**
 * Post-login navigation (AuthRedirectService equivalent): once the user is
 * authenticated, restore the saved deep link or land on /home, which routes
 * to the default project (or the getting-started view). Also registers the
 * 401/403 handler that forces a logout and returns to the login page (auth
 * interceptor equivalent).
 */
export function AuthRedirector() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setUnauthorizedHandler((status) => {
      logger.warn(`Caught ${status} error. Session may have expired.`);
      auth.forceLogout();
      navigate('/login?sessionExpired=true');
    });
    return () => setUnauthorizedHandler(null);
  }, [auth, navigate]);

  useEffect(() => {
    if (!auth.ready || !auth.isAuthenticated) {
      return;
    }

    // Check for saved return URL
    const returnUrl = sessionStorage.getItem(AUTH_RETURN_URL_KEY);
    if (returnUrl) {
      sessionStorage.removeItem(AUTH_RETURN_URL_KEY);
      navigate(returnUrl);
      return;
    }

    if (shouldRedirect('/home')) {
      navigate('/home');
    }
  }, [auth.ready, auth.isAuthenticated, navigate]);

  return null;
}
