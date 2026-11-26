import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { ServiceList } from './service-list';
import { serviceApi } from '../../../core/api/service-api';
import { HttpError } from '../../../core/api/http';
import { CapabilitiesProvider } from '../../../core/context/capabilities-context';
import { capabilitiesApi, type Capabilities } from '../../../core/api/capabilities-api';
import { keptDeletions } from '../../../core/api/service-deletions';
import type { StreamSubscriber } from '../../../core/api/sse';
import type {
  ServiceDeleteAnswer,
  ServiceEvent,
  ServiceInstance,
} from '../../../core/models/service.model';

vi.mock('../../../core/preferences/confirm-prefs-context', () => ({
  useConfirmPrefs: () => ({ typedDeleteEnabled: true, setTypedDeleteEnabled: vi.fn() }),
}));

vi.mock('../../../core/api/capabilities-api', () => ({
  capabilitiesApi: { get: vi.fn() },
}));

const uiCache = vi.hoisted(() => new Map<string, unknown>());

vi.mock('../../../core/api/ui-cache', () => ({
  readUiCache: (key: string) => uiCache.get(key),
  writeUiCache: (key: string, value: unknown) => uiCache.set(key, value),
}));

beforeEach(() => uiCache.clear());

vi.mock('../../../core/api/service-api', () => ({
  serviceApi: {
    forgetServiceReads: vi.fn(),
    getServices: vi.fn(),
    subscribeServices: vi.fn(),
    getProjectMetrics: vi.fn(),
    deleteService: vi.fn(),
  },
}));

function instance(name: string, status: string, phase?: string): ServiceInstance {
  return {
    name,
    releaseName: `rel-${name}`,
    service: 'trino',
    serviceTag: '0.1.0',
    status,
    ...(phase ? { phase } : {}),
    targetNamespace: 'team-a',
    parameters: {},
  };
}

let stream: StreamSubscriber<ServiceEvent> | undefined;

const legacy: Capabilities = {
  identity: { provider: 'kubauth', userManagement: true },
  oidcProvisioning: { provider: 'none' },
};

function renderList(instances: ServiceInstance[], caps: Capabilities = legacy) {
  vi.mocked(capabilitiesApi.get).mockResolvedValue(caps);
  vi.mocked(serviceApi.getServices).mockResolvedValue(instances);
  render(
    <MemoryRouter initialEntries={['/projects/team-a/trino']}>
      <CapabilitiesProvider>
        <Routes>
          <Route
            path="/projects/:projectId/trino"
            element={<ServiceList serviceFilter="trino" basePath={['trino']} onDeploy={vi.fn()} />}
          />
        </Routes>
      </CapabilitiesProvider>
    </MemoryRouter>,
  );
}

/** Count shown on a status chip. */
function chipCount(label: string): string | null {
  const chip = screen.getByText(label, { selector: '.sc-label' }).closest('button')!;
  return within(chip).getByText(/\d+/, { selector: '.sc-count' }).textContent;
}

function rowStatus(name: string): string | null | undefined {
  return screen.getByText(name, { selector: 'td *, td' }).closest('tr')?.querySelector('.okdp-tag')
    ?.textContent;
}

describe('ServiceList phases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stream = undefined;
    vi.mocked(serviceApi.getProjectMetrics).mockResolvedValue({});
    vi.mocked(serviceApi.subscribeServices).mockImplementation((_project, subscriber) => {
      stream = subscriber;
      return () => undefined;
    });
  });

  it('shows the historical status when the server sends no phase', async () => {
    renderList([
      instance('lake', 'Installing'),
      instance('sea', 'Ready'),
      instance('pond', 'Error'),
    ]);
    await screen.findByText('lake');

    expect(rowStatus('lake')).toBe('Installing');
    expect(chipCount('Ready')).toBe('1');
    expect(chipCount('In progress')).toBe('1');
    expect(chipCount('Error')).toBe('1');
  });

  it('shows the phase over the status when the server sends one', async () => {
    renderList([
      instance('lake', 'Installing', 'Pending'),
      instance('sea', 'Ready', 'Ready'),
      instance('pond', 'Error', 'Degraded'),
      instance('reed', 'Installing', 'Unknown'),
      instance('fog', 'Installing', 'Nonsense'),
    ]);
    await screen.findByText('lake');

    expect(rowStatus('lake')).toBe('Pending');
    expect(rowStatus('pond')).toBe('Degraded');
    expect(rowStatus('reed')).toBe('Unknown');
    // A phase outside the nine falls back to the status.
    expect(rowStatus('fog')).toBe('Installing');
    expect(chipCount('In progress')).toBe('2');
    expect(chipCount('Error')).toBe('1');
  });

  it('keeps a Degraded instance under the Error chip it is counted in', async () => {
    renderList([instance('pond', 'Error', 'Degraded'), instance('sea', 'Ready', 'Ready')]);
    await screen.findByText('pond');

    fireEvent.click(screen.getByText('Error', { selector: '.sc-label' }));

    expect(screen.getByText('pond', { selector: 'td *, td' })).toBeInTheDocument();
    expect(screen.queryByText('sea', { selector: 'td *, td' })).not.toBeInTheDocument();
  });

  it('follows a phase change the stream sends while the status stays', async () => {
    renderList([{ ...instance('lake', 'Ready', 'Ready'), url: 'https://lake.example' }]);
    await screen.findByText('lake', { selector: 'td *, td' });
    const open = () => screen.getByTitle('Open in a new tab');
    expect(open()).toBeEnabled();
    expect(chipCount('Ready')).toBe('1');

    act(() =>
      stream!.next({
        type: 'MODIFIED',
        object: { ...instance('lake', 'Ready', 'Deleting'), url: 'https://lake.example' },
      }),
    );

    expect(rowStatus('lake')).toBe('Deleting');
    expect(chipCount('Ready')).toBe('0');
    expect(chipCount('In progress')).toBe('1');
    expect(open()).toBeDisabled();
  });
});

/** Deletes an instance through its row button and the typed confirmation. */
async function deleteRow(name: string) {
  const row = (await screen.findByText(name, { selector: 'td *, td' })).closest('tr')!;
  fireEvent.click(within(row).getByTitle('Delete'));
  const input = await screen.findByPlaceholderText(name);
  fireEvent.change(input, { target: { value: name } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

function rowOf(name: string) {
  return screen.queryByText(name, { selector: 'td *, td' });
}

describe('ServiceList deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stream = undefined;
    vi.mocked(serviceApi.getProjectMetrics).mockResolvedValue({});
    vi.mocked(serviceApi.subscribeServices).mockImplementation((_project, subscriber) => {
      stream = subscriber;
      return () => undefined;
    });
  });

  it('removes the row on an empty 204, sending the revision the row holds', async () => {
    vi.mocked(serviceApi.deleteService).mockResolvedValue({ status: 204 });
    renderList([{ ...instance('lake', 'Ready', 'Ready'), desiredRevision: '7' }]);
    await deleteRow('lake');

    expect(await screen.findByText('"lake" has been removed')).toBeInTheDocument();
    expect(rowOf('lake')).not.toBeInTheDocument();
    expect(serviceApi.deleteService).toHaveBeenCalledWith('team-a', 'lake', '7');
  });

  it('removes the row on a 200, even with an accepted operation', async () => {
    vi.mocked(serviceApi.deleteService).mockResolvedValue({
      status: 200,
      result: { operation: { outcome: 'accepted' } },
    });
    renderList([instance('lake', 'Ready', 'Ready')]);
    await deleteRow('lake');

    expect(await screen.findByText('"lake" has been removed')).toBeInTheDocument();
    expect(rowOf('lake')).not.toBeInTheDocument();
  });

  it('keeps the row of an accepted 202 deletion as Deleting until the stream reports it DELETED', async () => {
    vi.mocked(serviceApi.deleteService).mockResolvedValue({
      status: 202,
      result: { operation: { outcome: 'accepted' } },
    });
    renderList([
      {
        ...instance('lake', 'Ready', 'Ready'),
        desiredRevision: 'abc',
        url: 'https://lake.example',
      },
    ]);
    await deleteRow('lake');

    expect(await screen.findByText('Deletion requested')).toBeInTheDocument();
    expect(
      screen.getByText('Deletion of lake requested. It will be removed once reconciled.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('"lake" has been removed')).not.toBeInTheDocument();
    const row = rowOf('lake')!.closest('tr')!;
    expect(rowStatus('lake')).toBe('Deleting…');
    expect(within(row).getByTitle('Edit')).toBeDisabled();
    expect(within(row).getByTitle('Open in a new tab')).toBeDisabled();
    expect(within(row).getByTitle('Delete')).toBeDisabled();

    act(() => stream!.next({ type: 'MODIFIED', object: instance('lake', 'Ready', 'Deleting') }));
    expect(rowStatus('lake')).toBe('Deleting…');

    act(() => stream!.next({ type: 'DELETED', object: instance('lake', 'Ready') }));

    expect(rowOf('lake')).not.toBeInTheDocument();
  });

  it('locks the actions of an instance the server reports Deleting', async () => {
    renderList([{ ...instance('lake', 'Ready', 'Deleting'), url: 'https://lake.example' }]);
    const row = (await screen.findByText('lake', { selector: 'td *, td' })).closest('tr')!;

    expect(within(row).getByTitle('Edit')).toBeDisabled();
    expect(within(row).getByTitle('Open in a new tab')).toBeDisabled();
    expect(within(row).getByTitle('Delete')).toBeDisabled();
  });

  it('does not bring back a row the stream deleted while the first read was in flight', async () => {
    let answer: (value: ServiceInstance[]) => void = () => undefined;
    vi.mocked(capabilitiesApi.get).mockResolvedValue(legacy);
    vi.mocked(serviceApi.getServices).mockImplementation(
      () => new Promise((resolve) => (answer = resolve)),
    );
    render(
      <MemoryRouter initialEntries={['/projects/team-a/trino']}>
        <CapabilitiesProvider>
          <Routes>
            <Route
              path="/projects/:projectId/trino"
              element={
                <ServiceList serviceFilter="trino" basePath={['trino']} onDeploy={vi.fn()} />
              }
            />
          </Routes>
        </CapabilitiesProvider>
      </MemoryRouter>,
    );
    await vi.waitFor(() => expect(stream).toBeDefined());

    act(() => stream!.next({ type: 'DELETED', object: instance('lake', 'Ready') }));
    await act(async () => answer([instance('lake', 'Ready', 'Ready'), instance('sea', 'Ready')]));

    expect(rowOf('sea')).toBeInTheDocument();
    expect(rowOf('lake')).not.toBeInTheDocument();
  });

  it('does not bring back a row the stream deleted while a reload was in flight', async () => {
    let answerReload: (value: ServiceInstance[]) => void = () => undefined;
    vi.mocked(serviceApi.deleteService).mockResolvedValue({ status: 202 });
    renderList([instance('lake', 'Ready', 'Ready'), instance('sea', 'Ready', 'Ready')]);
    vi.mocked(serviceApi.getServices).mockImplementation(
      () => new Promise((resolve) => (answerReload = resolve)),
    );
    await deleteRow('lake');
    await screen.findByText('Deletion not confirmed');
    await vi.waitFor(() => expect(serviceApi.getServices).toHaveBeenCalledTimes(2));

    act(() => stream!.next({ type: 'DELETED', object: instance('lake', 'Ready') }));
    await act(async () =>
      answerReload([instance('lake', 'Ready', 'Ready'), instance('sea', 'Ready', 'Ready')]),
    );

    expect(rowOf('sea')).toBeInTheDocument();
    expect(rowOf('lake')).not.toBeInTheDocument();
  });

  it('keeps a row the stream deleted out of the snapshot a revisit paints', async () => {
    let answer: (value: ServiceInstance[]) => void = () => undefined;
    vi.mocked(capabilitiesApi.get).mockResolvedValue(legacy);
    vi.mocked(serviceApi.getServices).mockImplementation(
      () => new Promise((resolve) => (answer = resolve)),
    );
    const page = () => (
      <MemoryRouter initialEntries={['/projects/team-a/trino']}>
        <CapabilitiesProvider>
          <Routes>
            <Route
              path="/projects/:projectId/trino"
              element={
                <ServiceList serviceFilter="trino" basePath={['trino']} onDeploy={vi.fn()} />
              }
            />
          </Routes>
        </CapabilitiesProvider>
      </MemoryRouter>
    );
    const first = render(page());
    await vi.waitFor(() => expect(stream).toBeDefined());
    act(() => stream!.next({ type: 'DELETED', object: instance('lake', 'Ready') }));
    await act(async () =>
      answer([instance('lake', 'Ready', 'Ready'), instance('sea', 'Ready', 'Ready')]),
    );
    expect(rowOf('lake')).not.toBeInTheDocument();
    act(() => stream!.next({ type: 'DELETED', object: instance('sea', 'Ready') }));
    first.unmount();

    // The revisit paints the cached snapshot while its own read never answers.
    render(page());

    expect(rowOf('lake')).not.toBeInTheDocument();
    expect(rowOf('sea')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading instances…')).not.toBeInTheDocument();
  });

  it('shows a row the stream added again after deleting it', async () => {
    renderList([instance('sea', 'Ready', 'Ready')]);
    await screen.findByText('sea', { selector: 'td *, td' });

    act(() => stream!.next({ type: 'DELETED', object: instance('lake', 'Ready') }));
    act(() => stream!.next({ type: 'ADDED', object: instance('lake', 'Pending', 'Pending') }));

    expect(rowOf('lake')).toBeInTheDocument();
  });

  it('releases a reload still in flight when the page goes, so deletions can be dropped', async () => {
    vi.mocked(serviceApi.deleteService).mockResolvedValue({ status: 202 });
    renderList([instance('lake', 'Ready', 'Ready')]);
    await screen.findByText('lake', { selector: 'td *, td' });
    vi.mocked(serviceApi.getServices).mockImplementation(() => new Promise(() => undefined));
    await deleteRow('lake');
    await screen.findByText('Deletion not confirmed');
    await vi.waitFor(() => expect(serviceApi.getServices).toHaveBeenCalledTimes(2));

    act(() => stream!.next({ type: 'DELETED', object: instance('pond', 'Ready') }));
    expect(keptDeletions()).toBeGreaterThan(0);
    cleanup();

    expect(keptDeletions()).toBe(0);
  });

  it('does not bring back a row a 204 deletion removed while the first read was in flight', async () => {
    let answer: (value: ServiceInstance[]) => void = () => undefined;
    uiCache.set('services:team-a', [
      instance('lake', 'Ready', 'Ready'),
      instance('sea', 'Ready', 'Ready'),
    ]);
    vi.mocked(serviceApi.deleteService).mockResolvedValue({ status: 204 });
    vi.mocked(capabilitiesApi.get).mockResolvedValue(legacy);
    vi.mocked(serviceApi.getServices).mockImplementation(
      () => new Promise((resolve) => (answer = resolve)),
    );
    render(
      <MemoryRouter initialEntries={['/projects/team-a/trino']}>
        <CapabilitiesProvider>
          <Routes>
            <Route
              path="/projects/:projectId/trino"
              element={
                <ServiceList serviceFilter="trino" basePath={['trino']} onDeploy={vi.fn()} />
              }
            />
          </Routes>
        </CapabilitiesProvider>
      </MemoryRouter>,
    );
    await deleteRow('lake');
    expect(await screen.findByText('"lake" has been removed')).toBeInTheDocument();

    await act(async () =>
      answer([instance('lake', 'Ready', 'Ready'), instance('sea', 'Ready', 'Ready')]),
    );

    expect(rowOf('sea')).toBeInTheDocument();
    expect(rowOf('lake')).not.toBeInTheDocument();
    expect((uiCache.get('services:team-a') as ServiceInstance[]).map((s) => s.name)).toEqual([
      'sea',
    ]);
  });

  it('keeps the row with a warning on a 202 without an accepted operation', async () => {
    vi.mocked(serviceApi.deleteService).mockResolvedValue({ status: 202 });
    renderList([instance('lake', 'Ready', 'Ready')]);
    await deleteRow('lake');

    expect(await screen.findByText('Deletion not confirmed')).toBeInTheDocument();
    expect(rowStatus('lake')).toBe('Ready');
    await vi.waitFor(() => expect(serviceApi.getServices).toHaveBeenCalledTimes(2));
  });

  it('keeps the row and says why on a 409 conflict', async () => {
    vi.mocked(serviceApi.deleteService).mockRejectedValue(
      new HttpError(409, 'Conflict', JSON.stringify({ error: 'stale', code: 'conflict' }), '/x'),
    );
    renderList([{ ...instance('lake', 'Ready', 'Ready'), desiredRevision: '7' }]);
    await deleteRow('lake');

    expect(await screen.findByText('Instance not deleted')).toBeInTheDocument();
    expect(screen.getByText(/changed since it was loaded/)).toBeInTheDocument();
    expect(rowStatus('lake')).toBe('Ready');
    await vi.waitFor(() => expect(serviceApi.getServices).toHaveBeenCalledTimes(2));
  });

  it('retries a deletion with the revision read again after a conflict', async () => {
    vi.mocked(serviceApi.deleteService)
      .mockRejectedValueOnce(
        new HttpError(409, 'Conflict', JSON.stringify({ error: 'stale', code: 'conflict' }), '/x'),
      )
      .mockResolvedValueOnce({ status: 204 });
    renderList([{ ...instance('lake', 'Ready', 'Ready'), desiredRevision: '7' }]);
    vi.mocked(serviceApi.getServices).mockResolvedValue([
      { ...instance('lake', 'Ready', 'Ready'), desiredRevision: '8' },
    ]);
    await deleteRow('lake');
    await screen.findByText('Instance not deleted');
    await vi.waitFor(() => expect(serviceApi.getServices).toHaveBeenCalledTimes(2));

    await deleteRow('lake');

    await vi.waitFor(() => expect(serviceApi.deleteService).toHaveBeenCalledTimes(2));
    expect(serviceApi.deleteService).toHaveBeenLastCalledWith('team-a', 'lake', '8');
  });

  it('keeps the row with a warning when the outcome is unknown', async () => {
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
    renderList([instance('lake', 'Ready', 'Ready')]);
    await deleteRow('lake');

    expect(await screen.findByText('Deletion not confirmed')).toBeInTheDocument();
    expect(rowStatus('lake')).toBe('Ready');
  });
});

function GoTo({ path, label = 'go' }: { path: string; label?: string }) {
  const navigate = useNavigate();
  return <button onClick={() => navigate(path)}>{label}</button>;
}

describe('ServiceList reload after a failed deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(capabilitiesApi.get).mockResolvedValue(legacy);
    vi.mocked(serviceApi.getProjectMetrics).mockResolvedValue({});
    vi.mocked(serviceApi.subscribeServices).mockReturnValue(() => undefined);
  });

  it('drops a reload still in flight when the page moves to another project', async () => {
    let answerReload: (value: ServiceInstance[]) => void = () => undefined;
    vi.mocked(serviceApi.getServices).mockImplementation((project) => {
      if (project === 'team-b') return Promise.resolve([instance('sea', 'Ready', 'Ready')]);
      if (vi.mocked(serviceApi.deleteService).mock.calls.length > 0) {
        return new Promise((resolve) => (answerReload = resolve));
      }
      return Promise.resolve([instance('lake', 'Ready', 'Ready')]);
    });
    vi.mocked(serviceApi.deleteService).mockRejectedValue(
      new HttpError(409, 'Conflict', JSON.stringify({ error: 'stale', code: 'conflict' }), '/x'),
    );
    render(
      <MemoryRouter initialEntries={['/projects/team-a/trino']}>
        <CapabilitiesProvider>
          <Routes>
            <Route
              path="/projects/:projectId/trino"
              element={
                <>
                  <ServiceList serviceFilter="trino" basePath={['trino']} onDeploy={vi.fn()} />
                  <GoTo path="/projects/team-b/trino" />
                </>
              }
            />
          </Routes>
        </CapabilitiesProvider>
      </MemoryRouter>,
    );
    await deleteRow('lake');
    await screen.findByText('Instance not deleted');

    fireEvent.click(screen.getByText('go'));
    await screen.findByText('sea', { selector: 'td *, td' });
    await act(async () => answerReload([instance('lake', 'Ready', 'Ready')]));

    expect(rowOf('sea')).toBeInTheDocument();
    expect(rowOf('lake')).not.toBeInTheDocument();
  });
});

describe('ServiceList project switch during a deletion', () => {
  const lakeA = { ...instance('lake', 'Ready', 'Ready'), serviceTag: '1.0.0-a' };
  const lakeB = { ...instance('lake', 'Ready', 'Ready'), serviceTag: '2.0.0-b' };
  let answerDelete: (value: ServiceDeleteAnswer) => void = () => undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    stream = undefined;
    vi.mocked(capabilitiesApi.get).mockResolvedValue(legacy);
    vi.mocked(serviceApi.getProjectMetrics).mockResolvedValue({});
    vi.mocked(serviceApi.subscribeServices).mockImplementation((_project, subscriber) => {
      stream = subscriber;
      return () => undefined;
    });
    vi.mocked(serviceApi.getServices).mockImplementation((project) =>
      Promise.resolve(project === 'team-b' ? [lakeB] : [lakeA]),
    );
    vi.mocked(serviceApi.deleteService).mockImplementation(
      () => new Promise((resolve) => (answerDelete = resolve)),
    );
  });

  function renderSwitchable() {
    render(
      <MemoryRouter initialEntries={['/projects/team-a/trino']}>
        <CapabilitiesProvider>
          <Routes>
            <Route
              path="/projects/:projectId/trino"
              element={
                <>
                  <ServiceList serviceFilter="trino" basePath={['trino']} onDeploy={vi.fn()} />
                  <GoTo path="/projects/team-b/trino" />
                </>
              }
            />
          </Routes>
        </CapabilitiesProvider>
      </MemoryRouter>,
    );
  }

  async function switchToB() {
    fireEvent.click(screen.getByText('go'));
    await screen.findByText('2.0.0-b');
  }

  function rowB() {
    return screen.getByText('2.0.0-b').closest('tr')!;
  }

  it('closes a confirmation opened in one project when the page moves to the next', async () => {
    renderSwitchable();
    const row = (await screen.findByText('lake', { selector: 'td *, td' })).closest('tr')!;
    fireEvent.click(within(row).getByTitle('Delete'));
    expect(await screen.findByPlaceholderText('lake')).toBeInTheDocument();

    await switchToB();

    expect(screen.queryByPlaceholderText('lake')).not.toBeInTheDocument();
    expect(serviceApi.deleteService).not.toHaveBeenCalled();
  });

  it('never shows the same-named instance of the next project as Deleting', async () => {
    renderSwitchable();
    await deleteRow('lake');
    expect(rowStatus('lake')).toBe('Deleting…');

    await switchToB();

    expect(rowStatus('lake')).toBe('Ready');
    expect(within(rowB()).getByTitle('Delete')).toBeEnabled();
  });

  it('neither removes nor locks the same-named instance when the earlier deletion answers 204', async () => {
    renderSwitchable();
    await deleteRow('lake');
    await switchToB();

    await act(async () => answerDelete({ status: 204 }));

    expect(screen.getByText('2.0.0-b')).toBeInTheDocument();
    expect(rowStatus('lake')).toBe('Ready');
    expect(within(rowB()).getByTitle('Edit')).toBeEnabled();
    expect(screen.queryByText('"lake" has been removed')).not.toBeInTheDocument();
    expect(serviceApi.deleteService).toHaveBeenCalledWith('team-a', 'lake', undefined);
  });

  it('ignores an earlier deletion answer after a round trip back to the first project', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/team-a/trino']}>
        <CapabilitiesProvider>
          <Routes>
            <Route
              path="/projects/:projectId/trino"
              element={
                <>
                  <ServiceList serviceFilter="trino" basePath={['trino']} onDeploy={vi.fn()} />
                  <GoTo path="/projects/team-b/trino" />
                  <GoTo path="/projects/team-a/trino" label="back" />
                </>
              }
            />
          </Routes>
        </CapabilitiesProvider>
      </MemoryRouter>,
    );
    await deleteRow('lake');
    await switchToB();
    fireEvent.click(screen.getByText('back'));
    await screen.findByText('1.0.0-a');

    await act(async () => answerDelete({ status: 204 }));

    expect(screen.getByText('1.0.0-a')).toBeInTheDocument();
    expect(rowStatus('lake')).toBe('Ready');
    expect(screen.queryByText('"lake" has been removed')).not.toBeInTheDocument();
  });

  it('does not lock the same-named instance when the earlier deletion is accepted (202)', async () => {
    renderSwitchable();
    await deleteRow('lake');
    await switchToB();

    await act(async () =>
      answerDelete({
        status: 202,
        result: { operation: { outcome: 'accepted' } },
      }),
    );

    expect(rowStatus('lake')).toBe('Ready');
    expect(within(rowB()).getByTitle('Delete')).toBeEnabled();
    expect(screen.queryByText('Deletion requested')).not.toBeInTheDocument();
  });
});
