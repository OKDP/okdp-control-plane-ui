import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ServiceList } from './service-list';
import { clearApiCache } from '../../../core/api/http';
import { CapabilitiesProvider } from '../../../core/context/capabilities-context';
import { capabilitiesApi } from '../../../core/api/capabilities-api';
import type { StreamSubscriber } from '../../../core/api/sse';
import type { ServiceEvent, ServiceInstance } from '../../../core/models/service.model';

// The real service API and GET cache, with fetch and the stream replaced.
let stream: StreamSubscriber<ServiceEvent> | undefined;

vi.mock('../../../core/api/sse', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../core/api/sse')>()),
  subscribeJsonStream: (_url: string, subscriber: StreamSubscriber<ServiceEvent>) => {
    stream = subscriber;
    return () => undefined;
  },
}));

vi.mock('../../../core/api/capabilities-api', () => ({
  capabilitiesApi: { get: vi.fn() },
}));

vi.mock('../../../core/preferences/confirm-prefs-context', () => ({
  useConfirmPrefs: () => ({ typedDeleteEnabled: true, setTypedDeleteEnabled: vi.fn() }),
}));

function instance(name: string): ServiceInstance {
  return {
    name,
    releaseName: `rel-${name}`,
    service: 'trino',
    serviceTag: '0.1.0',
    status: 'Ready',
    phase: 'Ready',
    targetNamespace: 'cache-a',
    parameters: {},
  };
}

const fetchMock = vi.fn();

function page() {
  return (
    <MemoryRouter initialEntries={['/projects/cache-a/trino']}>
      <CapabilitiesProvider>
        <Routes>
          <Route
            path="/projects/:projectId/trino"
            element={<ServiceList serviceFilter="trino" basePath={['trino']} onDeploy={vi.fn()} />}
          />
        </Routes>
      </CapabilitiesProvider>
    </MemoryRouter>
  );
}

function rowOf(name: string) {
  return screen.queryByText(name, { selector: 'td *, td' });
}

describe('ServiceList and the GET cache', () => {
  beforeEach(() => {
    clearApiCache();
    stream = undefined;
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(capabilitiesApi.get).mockResolvedValue({
      identity: { provider: 'kubauth', userManagement: true },
      oidcProvisioning: { provider: 'none' },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('does not bring back an instance the stream deleted when the page is left and reopened within the cache window', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify([instance('lake'), instance('sea')]), { status: 200 }),
      ),
    );
    const first = render(page());
    await screen.findByText('lake', { selector: 'td *, td' });

    act(() => stream!.next({ type: 'DELETED', object: instance('lake') }));
    expect(rowOf('lake')).not.toBeInTheDocument();
    first.unmount();

    // Reopened at once, well within the 5 s the GET cache keeps an answer.
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify([instance('sea')]), { status: 200 })),
    );
    render(page());
    await screen.findByText('sea', { selector: 'td *, td' });
    await act(async () => undefined);

    expect(rowOf('lake')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
