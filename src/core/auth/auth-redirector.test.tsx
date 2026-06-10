import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLayoutEffect } from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AUTH_RETURN_URL_KEY } from '../storage-keys';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
  resolveInitialRoute: vi.fn(),
}));

vi.mock('./auth-context', () => ({ useAuth: mocks.useAuth }));
vi.mock('../api/http', () => ({ setUnauthorizedHandler: mocks.setUnauthorizedHandler }));
vi.mock('../context/space', () => ({ resolveInitialRoute: mocks.resolveInitialRoute }));

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
    mocks.resolveInitialRoute.mockReturnValue('/project');
  });

  describe('Deep links', () => {
    it('should keep a /project deep link (regression: redirect loop after React migration)', async () => {
      renderAt('/project/test');
      await flushEffects();

      expect(currentPath).toBe('/project/test');
    });

    it('should keep an /admin deep link even when the preferred space is project', async () => {
      renderAt('/admin/projects');
      await flushEffects();

      expect(currentPath).toBe('/admin/projects');
    });
  });

  describe('Post-login routing', () => {
    it('should route an authenticated user from /login to the preferred space', async () => {
      renderAt('/login');

      await waitFor(() => expect(currentPath).toBe('/project'));
    });

    it('should restore and consume the saved return URL', async () => {
      sessionStorage.setItem(AUTH_RETURN_URL_KEY, '/project/test/services');

      renderAt('/login');

      await waitFor(() => expect(currentPath).toBe('/project/test/services'));
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
