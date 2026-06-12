import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLayoutEffect } from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AUTH_RETURN_URL_KEY } from '../storage-keys';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));

vi.mock('./auth-context', () => ({ useAuth: mocks.useAuth }));
vi.mock('../api/http', () => ({ setUnauthorizedHandler: mocks.setUnauthorizedHandler }));

import { AuthRedirector } from './auth-redirector';

let currentPath = '';

// shouldRedirect reads window.location.pathname while navigation happens in
// the MemoryRouter, so mirror the router location into window.history the
// way BrowserRouter would.
function LocationProbe() {
  const { pathname } = useLocation();
  currentPath = pathname;
  useLayoutEffect(() => {
    window.history.replaceState({}, '', pathname);
  }, [pathname]);
  return null;
}

// Flush pending effects so that any (unwanted) redirect has a chance to run.
const flushEffects = () => act(() => Promise.resolve());

function renderAt(path: string) {
  window.history.replaceState({}, '', path);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthRedirector />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('AuthRedirector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    currentPath = '';
    mocks.useAuth.mockReturnValue({
      ready: true,
      isAuthenticated: true,
      profile: { username: 'jdoe' },
      roles: [],
      forceLogout: vi.fn(),
    });
  });

  describe('Deep links', () => {
    it('should keep a /projects deep link (regression: redirect loop after React migration)', async () => {
      renderAt('/projects/test');
      await flushEffects();

      expect(currentPath).toBe('/projects/test');
    });

    it('should keep an /identity deep link', async () => {
      renderAt('/identity');
      await flushEffects();

      expect(currentPath).toBe('/identity');
    });

    it('should keep a /settings deep link (regression: bounced back to the project)', async () => {
      renderAt('/settings');
      await flushEffects();

      expect(currentPath).toBe('/settings');
    });

    it('should keep an /admin deep link', async () => {
      renderAt('/admin');
      await flushEffects();

      expect(currentPath).toBe('/admin');
    });
  });

  describe('Post-login routing', () => {
    it('should route an authenticated user from /login to /home', async () => {
      renderAt('/login');

      await waitFor(() => expect(currentPath).toBe('/home'));
    });

    it('should restore and consume the saved return URL', async () => {
      sessionStorage.setItem(AUTH_RETURN_URL_KEY, '/projects/test/services');

      renderAt('/login');

      await waitFor(() => expect(currentPath).toBe('/projects/test/services'));
      expect(sessionStorage.getItem(AUTH_RETURN_URL_KEY)).toBeNull();
    });
  });

  it('should not redirect while unauthenticated', async () => {
    mocks.useAuth.mockReturnValue({
      ready: true,
      isAuthenticated: false,
      profile: null,
      roles: [],
      forceLogout: vi.fn(),
    });

    renderAt('/login');
    await flushEffects();

    expect(currentPath).toBe('/login');
  });
});
