import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import ServiceDetailPage from './service-detail-page';
import { CapabilitiesProvider } from '../../../core/context/capabilities-context';
import { capabilitiesApi, type Capabilities } from '../../../core/api/capabilities-api';
import { HttpError } from '../../../core/api/http';
import { serviceApi } from '../../../core/api/service-api';
import type { StreamSubscriber } from '../../../core/api/sse';
import type {
  Pod,
  ServiceDeleteAnswer,
  ServiceEvent,
  ServiceInstance,
  ServiceMetrics,
} from '../../../core/models/service.model';

vi.mock('../../../core/api/capabilities-api', () => ({
  capabilitiesApi: { get: vi.fn() },
}));

vi.mock('../../../core/preferences/confirm-prefs-context', () => ({
  useConfirmPrefs: () => ({ typedDeleteEnabled: true, setTypedDeleteEnabled: vi.fn() }),
}));

vi.mock('../../../core/api/service-api', () => ({
  serviceApi: {
    forgetServiceReads: vi.fn(),
    getService: vi.fn(),
    getPods: vi.fn(),
    getServiceMetrics: vi.fn(),
    subscribeServices: vi.fn(),
    deleteService: vi.fn(),
  },
}));

function lake(status: string, phase?: string): ServiceInstance {
  return {
    ...(phase ? { phase } : {}),
    name: 'lake',
    releaseName: 'lake',
    service: 'trino',
    serviceTag: '0.1.0',
    status,
    targetNamespace: 'team-a',
    parameters: {},
  };
}

let stream: StreamSubscriber<ServiceEvent> | undefined;

const PENDING_TEXT = 'The deployment engine accepted the change and has not applied it yet.';

function emit(event: ServiceEvent) {
  act(() => stream!.next(event));
}

/** The status pill next to the instance name. */
function headerStatus(): string | null | undefined {
  return document.querySelector('.header-title-row .okdp-tag')?.textContent;
}

/** The list route: shows the notice its navigation carries. */
function ListProbe() {
  const notice = (useLocation().state as { notice?: { detail: string } } | null)?.notice;
  return (
    <>
      <p>instance list</p>
      {notice && <p>notice: {notice.detail}</p>}
    </>
  );
}

function renderDetail(entry = '/projects/team-a/trino/lake', extra?: ReactNode) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <CapabilitiesProvider>
        <Routes>
          <Route
            path="/projects/:projectId/trino/:serviceName"
            element={
              <>
                <ServiceDetailPage />
                {extra}
              </>
            }
          />
          <Route path="/projects/:projectId/trino" element={<ListProbe />} />
          <Route path="/elsewhere" element={<p>elsewhere</p>} />
        </Routes>
      </CapabilitiesProvider>
    </MemoryRouter>,
  );
}

describe('ServiceDetailPage live instance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stream = undefined;
    vi.mocked(capabilitiesApi.get).mockResolvedValue({
      identity: { provider: 'kubauth', userManagement: true },
      oidcProvisioning: { provider: 'none' },
    });
    vi.mocked(serviceApi.getPods).mockResolvedValue([]);
    vi.mocked(serviceApi.getServiceMetrics).mockRejectedValue(new Error('no metrics'));
    vi.mocked(serviceApi.subscribeServices).mockImplementation((_project, subscriber) => {
      stream = subscriber;
      return () => undefined;
    });
  });

  it('reads the instance again, bypassing the cache, when the stream announces a change', async () => {
    vi.mocked(serviceApi.getService)
      .mockResolvedValueOnce(lake('Pending'))
      .mockResolvedValueOnce(lake('Ready'));
    renderDetail();
    expect(await screen.findByText(PENDING_TEXT)).toBeInTheDocument();

    emit({ type: 'MODIFIED', object: lake('Ready') });

    await vi.waitFor(() => expect(headerStatus()).toBe('Ready'));
    expect(screen.queryByText(PENDING_TEXT)).not.toBeInTheDocument();
    expect(serviceApi.getService).toHaveBeenLastCalledWith('team-a', 'lake', true);
  });

  it('ignores the events of other instances', async () => {
    vi.mocked(serviceApi.getService).mockResolvedValue(lake('Pending'));
    renderDetail();
    await screen.findByText(PENDING_TEXT);

    emit({ type: 'MODIFIED', object: { ...lake('Ready'), name: 'sea' } });

    expect(serviceApi.getService).toHaveBeenCalledTimes(1);
  });

  it('keeps the newer read when the initial one lands last', async () => {
    let answerInitial: (value: ServiceInstance) => void = () => undefined;
    vi.mocked(serviceApi.getService)
      .mockImplementationOnce(() => new Promise((resolve) => (answerInitial = resolve)))
      .mockResolvedValueOnce(lake('Ready'));
    renderDetail();
    await vi.waitFor(() => expect(stream).toBeDefined());

    emit({ type: 'ADDED', object: lake('Ready') });
    await vi.waitFor(() => expect(headerStatus()).toBe('Ready'));

    await act(async () => answerInitial(lake('Pending')));

    expect(headerStatus()).toBe('Ready');
    expect(screen.queryByText(PENDING_TEXT)).not.toBeInTheDocument();
  });

  it('shows the instance as gone once the stream reports it deleted', async () => {
    vi.mocked(serviceApi.getService).mockResolvedValue(lake('Ready'));
    renderDetail();
    await vi.waitFor(() => expect(headerStatus()).toBe('Ready'));

    emit({ type: 'DELETED', object: lake('Ready') });

    expect(await screen.findByText('Instance not found')).toBeInTheDocument();
  });

  it('keeps a successful initial load when a later read fails', async () => {
    let answerInitial: (value: ServiceInstance) => void = () => undefined;
    vi.mocked(serviceApi.getService)
      .mockImplementationOnce(() => new Promise((resolve) => (answerInitial = resolve)))
      .mockRejectedValueOnce(new Error('503'));
    renderDetail();
    await vi.waitFor(() => expect(stream).toBeDefined());

    emit({ type: 'MODIFIED', object: lake('Ready') });
    await act(async () => answerInitial(lake('Pending')));

    await vi.waitFor(() => expect(headerStatus()).toBe('Pending'));
  });

  it('reads the instance uncached, on load as on Refresh', async () => {
    vi.mocked(serviceApi.getService).mockResolvedValue(lake('Ready'));
    renderDetail();
    await vi.waitFor(() => expect(headerStatus()).toBe('Ready'));

    expect(serviceApi.getService).toHaveBeenCalledWith('team-a', 'lake', true);
    expect(serviceApi.getService).not.toHaveBeenCalledWith('team-a', 'lake');
  });

  it('drops a stream read still in flight when the page moves to another instance', async () => {
    let holdLake = false;
    let answerLake: (value: ServiceInstance) => void = () => undefined;
    let answerSea: (value: ServiceInstance) => void = () => undefined;
    const sea = { ...lake('Ready'), name: 'sea' };
    vi.mocked(serviceApi.getService).mockImplementation((_project, name) => {
      if (name === 'sea') return new Promise((resolve) => (answerSea = resolve));
      if (holdLake) return new Promise((resolve) => (answerLake = resolve));
      return Promise.resolve(lake('Pending'));
    });
    render(
      <MemoryRouter initialEntries={['/projects/team-a/trino/lake']}>
        <CapabilitiesProvider>
          <Routes>
            <Route
              path="/projects/:projectId/trino/:serviceName"
              element={
                <>
                  <ServiceDetailPage />
                  <GoTo path="/projects/team-a/trino/sea" />
                </>
              }
            />
          </Routes>
        </CapabilitiesProvider>
      </MemoryRouter>,
    );
    await vi.waitFor(() => expect(headerStatus()).toBe('Pending'));
    holdLake = true;
    emit({ type: 'MODIFIED', object: lake('Ready') });

    fireEvent.click(screen.getByText('go'));
    // The lake read lands first, while sea is still loading.
    await act(async () => answerLake(lake('Installing')));
    expect(headerStatus()).not.toBe('Installing');

    await act(async () => answerSea(sea));
    expect(screen.getByRole('heading', { name: 'sea' })).toBeInTheDocument();
    expect(headerStatus()).toBe('Ready');
  });

  it('shows the phase over the historical status', async () => {
    vi.mocked(serviceApi.getService).mockResolvedValue(lake('Installing', 'Pending'));
    renderDetail();

    expect(await screen.findByText(PENDING_TEXT)).toBeInTheDocument();
    expect(headerStatus()).toBe('Pending');
  });

  it('keeps the historical status when the server sends no phase', async () => {
    vi.mocked(serviceApi.getService).mockResolvedValue(lake('Installing'));
    renderDetail();

    expect(
      await screen.findByText('The deployment engine is installing this instance.'),
    ).toBeInTheDocument();
    expect(headerStatus()).toBe('Installing');
  });

  it('shows how far each connection got, or whether it resolved without a state', async () => {
    vi.mocked(serviceApi.getService).mockResolvedValue({
      ...lake('Ready'),
      connections: [
        { name: 'pg', kind: 'Connection', resolved: true, state: 'bound' },
        { name: 'hive', kind: 'Connection', resolved: true },
        { name: 's3', kind: 'Connection', resolved: false },
      ],
    });
    renderDetail();

    const pill = async (name: string) =>
      (await screen.findByText(name, { selector: 'li span.mono' }))
        .closest('li')
        ?.querySelector('.okdp-tag')?.textContent;
    expect(await pill('pg')).toBe('Bound');
    expect(await pill('hive')).toBe('Resolved');
    expect(await pill('s3')).toBe('Waiting');
  });
});

function GoTo({ path, label = 'go' }: { path: string; label?: string }) {
  const navigate = useNavigate();
  return <button onClick={() => navigate(path)}>{label}</button>;
}

const REVISION = '7f3e9a1c';
const base: Capabilities = {
  identity: { provider: 'kubauth', userManagement: true },
  oidcProvisioning: { provider: 'none' },
};

function setUp(caps: Capabilities = base) {
  vi.clearAllMocks();
  stream = undefined;
  vi.mocked(capabilitiesApi.get).mockResolvedValue(caps);
  vi.mocked(serviceApi.getPods).mockResolvedValue([]);
  vi.mocked(serviceApi.getServiceMetrics).mockRejectedValue(new Error('no metrics'));
  vi.mocked(serviceApi.subscribeServices).mockImplementation((_project, subscriber) => {
    stream = subscriber;
    return () => undefined;
  });
}

/** Deletes the instance through the header button and the typed confirmation. */
async function deleteInstance() {
  fireEvent.click(await screen.findByText('Delete', { selector: '.header-actions button' }));
  const input = await screen.findByPlaceholderText('lake');
  fireEvent.change(input, { target: { value: 'lake' } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

function headerButton(label: string): HTMLElement {
  return screen.getByText(label, { selector: '.header-actions button' });
}

const acceptedAnswer: ServiceDeleteAnswer = {
  status: 202,
  result: { operation: { outcome: 'accepted' } },
};

describe('ServiceDetailPage deletion', () => {
  it('goes back to the list on an empty 204, sending the revision the instance holds', async () => {
    setUp();
    vi.mocked(serviceApi.getService).mockResolvedValue({ ...lake('Ready'), desiredRevision: '7' });
    vi.mocked(serviceApi.deleteService).mockResolvedValue({ status: 204 });
    renderDetail();
    await vi.waitFor(() => expect(headerStatus()).toBe('Ready'));
    await deleteInstance();

    expect(await screen.findByText('instance list')).toBeInTheDocument();
    expect(screen.getByText('notice: "lake" has been removed')).toBeInTheDocument();
    expect(serviceApi.deleteService).toHaveBeenCalledWith('team-a', 'lake', '7');
  });

  it('shows an accepted 202 deletion as Deleting and leaves once the stream reports it DELETED', async () => {
    setUp();
    vi.mocked(serviceApi.getService).mockResolvedValue({
      ...lake('Ready'),
      desiredRevision: REVISION,
    });
    vi.mocked(serviceApi.deleteService).mockResolvedValue(acceptedAnswer);
    renderDetail();
    await vi.waitFor(() => expect(headerStatus()).toBe('Ready'));
    await deleteInstance();

    expect(await screen.findByText('Deletion requested')).toBeInTheDocument();
    expect(
      screen.getByText('Deletion of lake requested. It will be removed once reconciled.'),
    ).toBeInTheDocument();
    expect(serviceApi.deleteService).toHaveBeenCalledWith('team-a', 'lake', REVISION);
    expect(headerStatus()).toBe('Deleting…');
    expect(screen.getByText('The instance is being removed.')).toBeInTheDocument();
    expect(headerButton('Edit')).toBeDisabled();
    expect(headerButton('Delete')).toBeDisabled();
    expect(screen.queryByText('instance list')).not.toBeInTheDocument();

    emit({ type: 'DELETED', object: lake('Ready') });

    expect(await screen.findByText('instance list')).toBeInTheDocument();
    expect(screen.queryByText('Instance not found')).not.toBeInTheDocument();
  });

  it('warns and reads the instance again on a 202 without an accepted operation', async () => {
    setUp();
    vi.mocked(serviceApi.getService).mockResolvedValue(lake('Ready'));
    vi.mocked(serviceApi.deleteService).mockResolvedValue({ status: 202 });
    renderDetail();
    await vi.waitFor(() => expect(headerStatus()).toBe('Ready'));
    await deleteInstance();

    expect(await screen.findByText('Deletion not confirmed')).toBeInTheDocument();
    await vi.waitFor(() => expect(serviceApi.getService).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('instance list')).not.toBeInTheDocument();
    expect(headerButton('Delete')).toBeEnabled();
  });

  it('stays and reads the instance again on a 409 conflict', async () => {
    setUp();
    vi.mocked(serviceApi.getService).mockResolvedValue({
      ...lake('Ready'),
      desiredRevision: REVISION,
    });
    vi.mocked(serviceApi.deleteService).mockRejectedValue(
      new HttpError(409, 'Conflict', JSON.stringify({ error: 'stale', code: 'conflict' }), '/x'),
    );
    renderDetail();
    await vi.waitFor(() => expect(headerStatus()).toBe('Ready'));
    await deleteInstance();

    expect(await screen.findByText('Instance not deleted')).toBeInTheDocument();
    expect(screen.getByText(/changed since it was loaded/)).toBeInTheDocument();
    await vi.waitFor(() => expect(serviceApi.getService).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('instance list')).not.toBeInTheDocument();
  });

  it('warns and reads the instance again on a 500 with an unknown outcome', async () => {
    setUp();
    vi.mocked(serviceApi.getService).mockResolvedValue(lake('Ready'));
    vi.mocked(serviceApi.deleteService).mockRejectedValue(
      new HttpError(
        500,
        'x',
        JSON.stringify({
          error: 'timeout',
          code: 'outcome-unknown',
          operation: { outcome: 'unknown' },
        }),
        '/x',
      ),
    );
    renderDetail();
    await vi.waitFor(() => expect(headerStatus()).toBe('Ready'));
    await deleteInstance();

    expect(await screen.findByText('Deletion not confirmed')).toBeInTheDocument();
    await vi.waitFor(() => expect(serviceApi.getService).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('instance list')).not.toBeInTheDocument();
  });

  it('warns and reads the instance again on a 504 gateway timeout', async () => {
    setUp();
    vi.mocked(serviceApi.getService).mockResolvedValue(lake('Ready'));
    vi.mocked(serviceApi.deleteService).mockRejectedValue(
      new HttpError(504, 'Gateway Timeout', '', '/x'),
    );
    renderDetail();
    await vi.waitFor(() => expect(headerStatus()).toBe('Ready'));
    await deleteInstance();

    expect(await screen.findByText('Deletion not confirmed')).toBeInTheDocument();
    await vi.waitFor(() => expect(serviceApi.getService).toHaveBeenCalledTimes(2));
  });

  it('warns and reads the instance again when the answer says the outcome is unknown', async () => {
    setUp();
    vi.mocked(serviceApi.getService).mockResolvedValue(lake('Ready'));
    vi.mocked(serviceApi.deleteService).mockResolvedValue({
      status: 200,
      result: { operation: { outcome: 'unknown' } },
    });
    renderDetail();
    await vi.waitFor(() => expect(headerStatus()).toBe('Ready'));
    await deleteInstance();

    expect(await screen.findByText('Deletion not confirmed')).toBeInTheDocument();
    await vi.waitFor(() => expect(serviceApi.getService).toHaveBeenCalledTimes(2));
    expect(serviceApi.deleteService).toHaveBeenCalledWith('team-a', 'lake', undefined);
  });

  it('locks an instance the server reports Deleting and leaves once it is DELETED', async () => {
    setUp();
    vi.mocked(serviceApi.getService).mockResolvedValue(lake('Ready', 'Deleting'));
    renderDetail();

    expect(await screen.findByText('The instance is being removed.')).toBeInTheDocument();
    expect(headerStatus()).toBe('Deleting');
    expect(headerButton('Edit')).toBeDisabled();
    expect(headerButton('Delete')).toBeDisabled();

    emit({ type: 'DELETED', object: lake('Ready', 'Deleting') });

    expect(await screen.findByText('instance list')).toBeInTheDocument();
  });
});

describe('ServiceDetailPage deletion seen on the stream', () => {
  it('leaves when the stream reports Deleting then DELETED before any read lands', async () => {
    setUp();
    vi.mocked(serviceApi.getService).mockImplementation(() => new Promise(() => undefined));
    renderDetail();
    await vi.waitFor(() => expect(stream).toBeDefined());

    emit({ type: 'MODIFIED', object: lake('Ready', 'Deleting') });
    emit({ type: 'DELETED', object: lake('Ready', 'Deleting') });

    expect(await screen.findByText('instance list')).toBeInTheDocument();
    expect(screen.queryByText('Instance not found')).not.toBeInTheDocument();
  });
});

describe('ServiceDetailPage engine neutrality', () => {
  it('shows the engine message of an instance that stays Ready', async () => {
    setUp();
    vi.mocked(serviceApi.getService).mockResolvedValue({
      ...lake('Ready', 'Ready'),
      statusMessage: 'upgrade failed: invalid replicas',
    });
    renderDetail();

    expect(await screen.findByText('upgrade failed: invalid replicas')).toBeInTheDocument();
    expect(screen.getByText('Message from the deployment engine')).toBeInTheDocument();
    expect(headerStatus()).toBe('Ready');
  });

  it('shows no revision and no storage wording, whatever the server sends', async () => {
    setUp({
      ...base,
      engine: { name: 'kubocd' },
      persistence: { mode: 'git', commit: true, revisionLink: 'https://forge/c/{rev}' },
    } as Capabilities);
    vi.mocked(serviceApi.getService).mockResolvedValue({
      ...lake('Installing', 'Pending'),
      desiredRevision: REVISION,
    });
    renderDetail();

    expect(await screen.findByText(PENDING_TEXT)).toBeInTheDocument();
    const page = document.body.textContent ?? '';
    expect(page).not.toMatch(/revision/i);
    expect(page).not.toMatch(/commit/i);
    expect(page).not.toMatch(/\bgit\b/i);
    expect(page).not.toContain(REVISION);
    expect(screen.queryByLabelText('Synchronization')).not.toBeInTheDocument();
  });
});

describe('ServiceDetailPage project switch during a deletion', () => {
  const lakeA = { ...lake('Ready', 'Ready'), serviceTag: '1.0.0-a' };
  const lakeB = { ...lake('Ready', 'Ready'), serviceTag: '2.0.0-b' };
  let answerDelete: (value: ServiceDeleteAnswer) => void = () => undefined;

  async function deleteOnAThenOpenB() {
    setUp();
    vi.mocked(serviceApi.getService).mockImplementation((project) =>
      Promise.resolve(project === 'team-b' ? lakeB : lakeA),
    );
    vi.mocked(serviceApi.deleteService).mockImplementation(
      () => new Promise((resolve) => (answerDelete = resolve)),
    );
    renderDetail('/projects/team-a/trino/lake', <GoTo path="/projects/team-b/trino/lake" />);
    await screen.findByText('1.0.0-a', { selector: '.page-desc .mono' });
    await deleteInstance();
    fireEvent.click(screen.getByText('go'));
    await screen.findByText('2.0.0-b', { selector: '.page-desc .mono' });
  }

  it('closes a confirmation opened for one project when the page moves to the next', async () => {
    setUp();
    vi.mocked(serviceApi.getService).mockImplementation((project) =>
      Promise.resolve(project === 'team-b' ? lakeB : lakeA),
    );
    renderDetail('/projects/team-a/trino/lake', <GoTo path="/projects/team-b/trino/lake" />);
    await screen.findByText('1.0.0-a', { selector: '.page-desc .mono' });
    fireEvent.click(headerButton('Delete'));
    expect(await screen.findByPlaceholderText('lake')).toBeInTheDocument();

    fireEvent.click(screen.getByText('go'));
    await screen.findByText('2.0.0-b', { selector: '.page-desc .mono' });

    expect(screen.queryByPlaceholderText('lake')).not.toBeInTheDocument();
    expect(serviceApi.deleteService).not.toHaveBeenCalled();
  });

  it.each([
    ['accepted (202)', acceptedAnswer],
    ['done (204)', { status: 204 }],
  ])(
    'ignores an earlier deletion answer, %s, after a round trip back to the same instance',
    async (_label, deleteAnswer) => {
      setUp();
      vi.mocked(serviceApi.getService).mockImplementation((project) =>
        Promise.resolve(project === 'team-b' ? lakeB : lakeA),
      );
      vi.mocked(serviceApi.deleteService).mockImplementation(
        () => new Promise((resolve) => (answerDelete = resolve)),
      );
      renderDetail(
        '/projects/team-a/trino/lake',
        <>
          <GoTo path="/projects/team-b/trino/lake" />
          <GoTo path="/projects/team-a/trino/lake" label="back" />
        </>,
      );
      await screen.findByText('1.0.0-a', { selector: '.page-desc .mono' });
      await deleteInstance();
      fireEvent.click(screen.getByText('go'));
      await screen.findByText('2.0.0-b', { selector: '.page-desc .mono' });
      fireEvent.click(screen.getByText('back'));
      await screen.findByText('1.0.0-a', { selector: '.page-desc .mono' });

      await act(async () => answerDelete(deleteAnswer));

      expect(screen.queryByText('instance list')).not.toBeInTheDocument();
      expect(headerStatus()).toBe('Ready');
      expect(headerButton('Delete')).toBeEnabled();
    },
  );

  it('does not navigate when a deletion answers after the page was left', async () => {
    setUp();
    vi.mocked(serviceApi.getService).mockResolvedValue(lakeA);
    vi.mocked(serviceApi.deleteService).mockImplementation(
      () => new Promise((resolve) => (answerDelete = resolve)),
    );
    renderDetail('/projects/team-a/trino/lake', <GoTo path="/elsewhere" />);
    await screen.findByText('1.0.0-a', { selector: '.page-desc .mono' });
    await deleteInstance();
    fireEvent.click(screen.getByText('go'));
    await screen.findByText('elsewhere');

    await act(async () => answerDelete({ status: 204 }));

    expect(screen.getByText('elsewhere')).toBeInTheDocument();
    expect(screen.queryByText('instance list')).not.toBeInTheDocument();
  });

  it('stays on the same-named instance of the next project when the earlier deletion answers 204', async () => {
    await deleteOnAThenOpenB();

    await act(async () => answerDelete({ status: 204 }));

    expect(screen.queryByText('instance list')).not.toBeInTheDocument();
    expect(screen.getByText('2.0.0-b', { selector: '.page-desc .mono' })).toBeInTheDocument();
    expect(headerStatus()).toBe('Ready');
    expect(headerButton('Delete')).toBeEnabled();
  });

  it('does not lock the same-named instance when the earlier deletion is accepted (202)', async () => {
    await deleteOnAThenOpenB();

    await act(async () => answerDelete(acceptedAnswer));
    emit({ type: 'DELETED', object: lake('Ready') });
    await act(async () => undefined);

    expect(screen.queryByText('Deletion requested')).not.toBeInTheDocument();
    expect(screen.queryByText('instance list')).not.toBeInTheDocument();
  });

  it('does not take a Deleting phase seen in one project for the same name in the next', async () => {
    setUp();
    vi.mocked(serviceApi.getService).mockImplementation((project) =>
      Promise.resolve(project === 'team-b' ? lakeB : { ...lakeA, phase: 'Deleting' }),
    );
    renderDetail('/projects/team-a/trino/lake', <GoTo path="/projects/team-b/trino/lake" />);
    await screen.findByText('1.0.0-a', { selector: '.page-desc .mono' });
    fireEvent.click(screen.getByText('go'));
    await screen.findByText('2.0.0-b', { selector: '.page-desc .mono' });

    expect(headerButton('Delete')).toBeEnabled();
    emit({ type: 'DELETED', object: lake('Ready') });

    expect(await screen.findByText('Instance not found')).toBeInTheDocument();
    expect(screen.queryByText('instance list')).not.toBeInTheDocument();
  });
});

describe('ServiceDetailPage untrusted values', () => {
  it('neither links nor opens a URL that is not http(s)', async () => {
    setUp();
    vi.mocked(serviceApi.getService).mockResolvedValue({
      ...lake('Ready', 'Ready'),
      url: 'javascript:alert(1)',
    });
    renderDetail();

    expect(await screen.findByText('javascript:alert(1)')).toBeInTheDocument();
    expect(document.querySelector('a[href^="javascript"]')).toBeNull();
    expect(screen.queryByText('Open', { selector: '.header-actions button' })).toBeNull();
  });

  it('links an http(s) URL', async () => {
    setUp();
    vi.mocked(serviceApi.getService).mockResolvedValue({
      ...lake('Ready', 'Ready'),
      url: 'https://lake.example/ui',
    });
    renderDetail();

    expect(await screen.findByText('https://lake.example/ui')).toHaveAttribute(
      'href',
      'https://lake.example/ui',
    );
    expect(headerButton('Open')).toBeEnabled();
  });

  it.each(['//evil.example/x', '/\\evil.example', '/\t/evil.example/x', 'https://evil.example'])(
    'goes back to the service area instead of returnTo=%s',
    async (returnTo) => {
      setUp();
      vi.mocked(serviceApi.getService).mockResolvedValue(lake('Ready', 'Ready'));
      renderDetail(`/projects/team-a/trino/lake?returnTo=${encodeURIComponent(returnTo)}`);
      await vi.waitFor(() => expect(headerStatus()).toBe('Ready'));

      fireEvent.click(screen.getByText('Trino', { selector: '.breadcrumb-link' }));

      expect(await screen.findByText('instance list')).toBeInTheDocument();
    },
  );

  it('clears a pending deletion and shows the instance gone when Refresh gets 404', async () => {
    setUp();
    vi.mocked(serviceApi.getService)
      .mockResolvedValueOnce(lake('Ready', 'Ready'))
      .mockRejectedValueOnce(new HttpError(404, 'Not Found', '', '/api/projects/team-a/services/lake'));
    renderDetail();
    await vi.waitFor(() => expect(headerStatus()).toBe('Ready'));

    fireEvent.click(headerButton('Refresh'));

    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
    expect(serviceApi.forgetServiceReads).toHaveBeenCalledWith('team-a');
  });

  it('keeps the instance visible when pod listing fails', async () => {
    setUp();
    vi.mocked(serviceApi.getService).mockResolvedValue(lake('Ready', 'Ready'));
    vi.mocked(serviceApi.getPods).mockRejectedValue(new Error('pods unavailable'));
    renderDetail();

    await vi.waitFor(() => expect(headerStatus()).toBe('Ready'));
  });
});

describe('ServiceDetailPage pre-PR fixes', () => {
  const samplePod = (name: string): Pod => ({
    name,
    status: 'Running',
    ready: '1/1',
    restarts: 0,
    age: '1m',
    containers: [],
  });

  const sampleMetrics: ServiceMetrics = {
    cpu: { usedRaw: 0.5, limitRaw: 1, used: '0.500', limit: '1.00', pct: 0.5, available: true },
    memory: { usedRaw: 1, limitRaw: 2, used: '512Mi', limit: '1Gi', pct: 0.5, available: true },
  };

  it('resets deletion marks and metrics on an A (202) -> B -> A (Ready) round trip without unmount', async () => {
    setUp();
    let teamAVisits = 0;
    const lakeAFirst = {
      ...lake('Ready', 'Ready'),
      serviceTag: '1.0.0-a',
      url: 'https://lake-a.example/ui',
    };
    const lakeAReady = {
      ...lake('Ready', 'Ready'),
      serviceTag: '1.1.0-a',
      url: 'https://lake-a.example/ui',
    };
    const lakeB = { ...lake('Ready', 'Ready'), serviceTag: '2.0.0-b' };
    vi.mocked(serviceApi.getService).mockImplementation((project) => {
      if (project === 'team-b') return Promise.resolve(lakeB);
      teamAVisits += 1;
      return Promise.resolve(teamAVisits === 1 ? lakeAFirst : lakeAReady);
    });
    vi.mocked(serviceApi.getServiceMetrics).mockImplementation((project) =>
      project === 'team-a' && teamAVisits === 1
        ? Promise.resolve(sampleMetrics)
        : Promise.reject(new Error('no metrics')),
    );
    vi.mocked(serviceApi.deleteService).mockResolvedValue(acceptedAnswer);

    renderDetail(
      '/projects/team-a/trino/lake',
      <>
        <GoTo path="/projects/team-b/trino/lake" />
        <GoTo path="/projects/team-a/trino/lake" label="back" />
      </>,
    );
    expect(await screen.findByText('0.500')).toBeInTheDocument();
    await deleteInstance();
    expect(await screen.findByText('Deletion requested')).toBeInTheDocument();
    expect(headerStatus()).toBe('Deleting…');
    expect(headerButton('Open')).toBeDisabled();

    fireEvent.click(screen.getByText('go'));
    await screen.findByText('2.0.0-b', { selector: '.page-desc .mono' });
    expect(screen.queryByText('0.500')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('back'));
    await screen.findByText('1.1.0-a', { selector: '.page-desc .mono' });

    expect(headerStatus()).toBe('Ready');
    expect(headerButton('Edit')).toBeEnabled();
    expect(headerButton('Delete')).toBeEnabled();
    expect(headerButton('Open')).toBeEnabled();
    expect(screen.queryByText('0.500')).not.toBeInTheDocument();
  });

  it('locks Edit, Delete and Open while DELETE is in flight and avoids Instance not found if SSE DELETED arrives first', async () => {
    setUp();
    let answerDelete: (value: ServiceDeleteAnswer) => void = () => undefined;
    vi.mocked(serviceApi.getService).mockResolvedValue({
      ...lake('Ready', 'Ready'),
      url: 'https://lake.example/ui',
    });
    vi.mocked(serviceApi.deleteService).mockImplementation(
      () => new Promise((resolve) => (answerDelete = resolve)),
    );
    renderDetail();
    await vi.waitFor(() => expect(headerStatus()).toBe('Ready'));

    await deleteInstance();

    expect(headerButton('Edit')).toBeDisabled();
    expect(headerButton('Delete')).toBeDisabled();
    expect(headerButton('Open')).toBeDisabled();

    // SSE DELETED arrives before the HTTP DELETE response settles.
    emit({ type: 'DELETED', object: lake('Ready', 'Ready') });

    expect(await screen.findByText('instance list')).toBeInTheDocument();
    expect(screen.getByText('notice: "lake" has been removed')).toBeInTheDocument();
    expect(screen.queryByText('Instance not found')).not.toBeInTheDocument();

    // Late HTTP answer after unmount changes nothing.
    await act(async () => answerDelete({ status: 204 }));
    expect(screen.getByText('instance list')).toBeInTheDocument();
  });

  it('re-enables Edit, Delete and Open when an in-flight DELETE fails', async () => {
    setUp();
    let rejectDelete: (err: unknown) => void = () => undefined;
    vi.mocked(serviceApi.getService).mockResolvedValue({
      ...lake('Ready', 'Ready'),
      url: 'https://lake.example/ui',
    });
    vi.mocked(serviceApi.deleteService).mockImplementation(
      () => new Promise((_resolve, reject) => (rejectDelete = reject)),
    );
    renderDetail();
    await vi.waitFor(() => expect(headerStatus()).toBe('Ready'));

    await deleteInstance();
    expect(headerButton('Edit')).toBeDisabled();
    expect(headerButton('Delete')).toBeDisabled();
    expect(headerButton('Open')).toBeDisabled();

    await act(async () => rejectDelete(new Error('network error')));

    expect(await screen.findByText('Failed to delete instance')).toBeInTheDocument();
    expect(headerButton('Edit')).toBeEnabled();
    expect(headerButton('Delete')).toBeEnabled();
    expect(headerButton('Open')).toBeEnabled();
  });

  it('refreshes pods live when SSE announces a MODIFIED or ADDED event and skips stale loadAll pod fetches', async () => {
    setUp();
    vi.mocked(serviceApi.getService)
      .mockResolvedValueOnce(lake('Pending', 'Pending'))
      .mockResolvedValueOnce(lake('Ready', 'Ready'));
    vi.mocked(serviceApi.getPods)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([samplePod('lake-0')]);
    renderDetail();
    expect(await screen.findByText('0 / 0 running')).toBeInTheDocument();

    emit({ type: 'MODIFIED', object: lake('Ready', 'Ready') });

    expect(await screen.findByText('lake-0')).toBeInTheDocument();
    expect(screen.getByText('1 / 1 running')).toBeInTheDocument();
    expect(serviceApi.getPods).toHaveBeenCalledTimes(2);
  });

  it('does not fetch pods from a stale loadAll superseded by a newer stream read', async () => {
    setUp();
    let answerInitial: (value: ServiceInstance) => void = () => undefined;
    vi.mocked(serviceApi.getService)
      .mockImplementationOnce(() => new Promise((resolve) => (answerInitial = resolve)))
      .mockResolvedValueOnce(lake('Ready', 'Ready'));
    vi.mocked(serviceApi.getPods).mockResolvedValue([samplePod('lake-fresh')]);
    renderDetail();
    await vi.waitFor(() => expect(stream).toBeDefined());

    emit({ type: 'ADDED', object: lake('Ready', 'Ready') });
    expect(await screen.findByText('lake-fresh')).toBeInTheDocument();
    expect(serviceApi.getPods).toHaveBeenCalledTimes(1);

    await act(async () => answerInitial(lake('Pending', 'Pending')));
    expect(serviceApi.getPods).toHaveBeenCalledTimes(1);
    expect(screen.getByText('lake-fresh')).toBeInTheDocument();
  });

  it('derives the parent route from location.pathname instead of /projects/:id/services when instance is null', async () => {
    setUp();
    vi.mocked(serviceApi.getService).mockRejectedValue(
      new HttpError(404, 'Not Found', '', '/api/projects/team-a/services/missing'),
    );
    render(
      <MemoryRouter initialEntries={['/projects/team-a/spark/history-server/missing']}>
        <CapabilitiesProvider>
          <Routes>
            <Route
              path="/projects/:projectId/spark/history-server/:serviceName"
              element={<ServiceDetailPage />}
            />
            <Route
              path="/projects/:projectId/spark/history-server"
              element={<p>spark history list</p>}
            />
            <Route path="/projects/:projectId/services" element={<p>dead services route</p>} />
          </Routes>
        </CapabilitiesProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Instance not found')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Back to instances'));

    expect(await screen.findByText('spark history list')).toBeInTheDocument();
    expect(screen.queryByText('dead services route')).not.toBeInTheDocument();
  });

  it('falls back to /projects/:projectId when instance is null and pathname is outside /projects/:projectId/', async () => {
    setUp();
    vi.mocked(serviceApi.getService).mockRejectedValue(
      new HttpError(404, 'Not Found', '', '/api/projects/team-a/services/missing'),
    );
    render(
      <MemoryRouter initialEntries={['/custom/team-a/missing']}>
        <CapabilitiesProvider>
          <Routes>
            <Route path="/custom/:projectId/:serviceName" element={<ServiceDetailPage />} />
            <Route path="/projects/:projectId" element={<p>project home</p>} />
            <Route path="/projects/:projectId/services" element={<p>dead services route</p>} />
          </Routes>
        </CapabilitiesProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Instance not found')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Back to instances'));

    expect(await screen.findByText('project home')).toBeInTheDocument();
    expect(screen.queryByText('dead services route')).not.toBeInTheDocument();
  });

  it.each([
    ['encoded traversal + backslash', '/projects/..%2F%5Cevil.com/trino/missing', '/projects/..%2F%5Cevil.com/trino'],
    ['encoded traversal to /admin outside project prefix', '/custom/..%2Fadmin/missing', '/projects/..%2Fadmin'],
    ['lowercase encoded traversal to /admin', '/projects/..%2fadmin/trino/missing', '/projects/..%2Fadmin'],
  ])(
    'keeps fallbackBackPath encoded and inside /projects on 404 for %s',
    async (_label, entry, expectedPath) => {
      setUp();
      vi.mocked(serviceApi.getService).mockRejectedValue(
        new HttpError(404, 'Not Found', '', '/api/projects/x/services/missing'),
      );
      function PathProbe({ label }: { label: string }) {
        const loc = useLocation();
        return (
          <>
            <p>{label}</p>
            <p data-testid="landed-path">{loc.pathname}</p>
          </>
        );
      }
      render(
        <MemoryRouter initialEntries={[entry]}>
          <CapabilitiesProvider>
            <Routes>
              <Route path="/projects/:projectId/trino/:serviceName" element={<ServiceDetailPage />} />
              <Route path="/custom/:projectId/:serviceName" element={<ServiceDetailPage />} />
              <Route path="/projects/:projectId/trino" element={<PathProbe label="safe trino" />} />
              <Route path="/projects/:projectId" element={<PathProbe label="safe project" />} />
              <Route path="/admin" element={<p>escaped to admin</p>} />
              <Route path="*" element={<PathProbe label="other" />} />
            </Routes>
          </CapabilitiesProvider>
        </MemoryRouter>,
      );

      expect(await screen.findByText('Instance not found')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Back to instances'));

      expect(await screen.findByTestId('landed-path')).toHaveTextContent(expectedPath);
      expect(screen.queryByText('escaped to admin')).not.toBeInTheDocument();
    },
  );
});
