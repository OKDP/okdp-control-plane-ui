import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './auth-context';
import { setUnauthorizedHandler } from '../api/http';
import { AUTH_RETURN_URL_KEY } from '../storage-keys';
import { resolveInitialRoute } from '../context/space';
import { logger } from '../services/logger';

function shouldRedirect(target: string): boolean {
  // Use window.location.pathname to get the absolute truth from the browser
  const current = window.location.pathname;

  // Already inside a space: never clobber a deep link. This keeps the effect
  // idempotent — it re-runs on every navigation because `navigate` changes
  // identity with the location.
  if (current.startsWith('/admin') || current.startsWith('/project')) {
    return false;
  }
  return current !== target;
}

/**
 * Post-login navigation (AuthRedirectService equivalent): once the user is
 * authenticated, restore the saved deep link or route to the preferred space.
 * Also registers the 401/403 handler that forces a logout and returns to the
 * login page (auth interceptor equivalent).
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

    const next = resolveInitialRoute({ profile: auth.profile, roles: auth.roles });
    if (shouldRedirect(next)) {
      navigate(next);
    }
  }, [auth.ready, auth.isAuthenticated, auth.profile, auth.roles, navigate]);

  return null;
}
