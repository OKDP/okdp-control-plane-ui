import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CapabilitiesProvider, useCapabilities } from './capabilities-context';
import { capabilitiesApi, type Capabilities } from '../api/capabilities-api';

vi.mock('../api/capabilities-api', () => ({
  capabilitiesApi: { get: vi.fn() },
}));

const get = vi.mocked(capabilitiesApi.get);

function caps(userManagement: boolean, provider: string): Capabilities {
  return {
    identity: { provider, userManagement },
    oidcProvisioning: { provider: 'none' },
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return <CapabilitiesProvider>{children}</CapabilitiesProvider>;
}

describe('CapabilitiesProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('follows the platform when it serves user management', async () => {
    get.mockResolvedValue(caps(true, 'kubauth'));

    const { result } = renderHook(() => useCapabilities(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.userManagement).toBe(true);
    expect(result.current.capabilities?.identity.provider).toBe('kubauth');
  });

  it('reports no user management on an external provider', async () => {
    get.mockResolvedValue(caps(false, 'external'));

    const { result } = renderHook(() => useCapabilities(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.userManagement).toBe(false);
  });

  it('keeps the area visible when the platform does not answer', async () => {
    get.mockRejectedValue(new Error('404 Not Found'));

    const { result } = renderHook(() => useCapabilities(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.capabilities).toBeNull();
    expect(result.current.userManagement).toBe(true);
  });

  it('is read once, not per consumer', async () => {
    get.mockResolvedValue(caps(true, 'kubauth'));

    const { result, rerender } = renderHook(() => useCapabilities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender();

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('keeps the area visible and the defaults while the platform has not answered', () => {
    get.mockReturnValue(new Promise<Capabilities>(() => undefined));

    const { result } = renderHook(() => useCapabilities(), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.userManagement).toBe(true);
    expect(result.current.engine).toEqual({ renderedValues: false, suspend: false });
  });
});

describe('useCapabilities engine resolution', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([true, false])(
    'defaults the engine on a server without engine fields (userManagement %s)',
    async (userManagement) => {
      get.mockResolvedValue(caps(userManagement, userManagement ? 'kubauth' : 'external'));

      const { result } = renderHook(() => useCapabilities(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.userManagement).toBe(userManagement);
      expect(result.current.engine).toEqual({ renderedValues: false, suspend: false });
    },
  );

  it('defaults the engine when the platform does not answer', async () => {
    get.mockRejectedValue(new Error('404 Not Found'));

    const { result } = renderHook(() => useCapabilities(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.engine).toEqual({ renderedValues: false, suspend: false });
  });

  it('surfaces the resolved engine capability and ignores unrelated fields', async () => {
    get.mockResolvedValue({
      ...caps(true, 'kubauth'),
      engine: { name: 'kubocd', renderedValues: true, suspend: false },
      storage: { backend: 'custom', revisions: true },
    } as Capabilities);

    const { result } = renderHook(() => useCapabilities(), { wrapper });

    await waitFor(() => expect(result.current.engine.name).toBe('kubocd'));
    expect(result.current.engine).toEqual({
      name: 'kubocd',
      renderedValues: true,
      suspend: false,
    });
  });
});
