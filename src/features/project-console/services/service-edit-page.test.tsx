import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { Toast } from 'primereact/toast';
import ServiceEditPage from './service-edit-page';
import { CapabilitiesProvider } from '../../../core/context/capabilities-context';
import { capabilitiesApi, type Capabilities } from '../../../core/api/capabilities-api';
import { serviceApi } from '../../../core/api/service-api';
import { HttpError } from '../../../core/api/http';
import type { ServiceInstance, ServiceWriteResult } from '../../../core/models/service.model';
import { useRouteNotice } from '../../../shared/hooks/use-route-notice';

vi.mock('../../../core/api/capabilities-api', () => ({
  capabilitiesApi: { get: vi.fn() },
}));

vi.mock('../../../core/api/service-api', () => ({
  serviceApi: {
    forgetServiceReads: vi.fn(),
    getService: vi.fn(),
    getProfileImages: vi.fn(),
    getPlatformServices: vi.fn(),
    getServiceInputs: vi.fn(),
    getServiceSchema: vi.fn(),
    updateServiceParameters: vi.fn(),
  },
}));

const REVISION = '7f3e9a1c';
const legacy: Capabilities = {
  identity: { provider: 'kubauth', userManagement: true },
  oidcProvisioning: { provider: 'none' },
};
const withEngine: Capabilities = {
  ...legacy,
  engine: { name: 'kubocd' },
};

const lake: ServiceInstance = {
  name: 'lake',
  releaseName: 'lake',
  service: 'trino',
  serviceTag: '0.1.0',
  status: 'Ready',
  targetNamespace: 'team-a',
  parameters: { replicas: 1 },
};

/** Stands in for the page a save lands on, showing the notice and query it carries. */
function Landing({ label }: { label: string }) {
  const toast = useRef<Toast>(null);
  const location = useLocation();
  useRouteNotice(toast);
  return (
    <>
      <Toast ref={toast} />
      <p>{label}</p>
      <p data-testid="landing-search">{location.search}</p>
    </>
  );
}

function GoTo({ path, label = 'go' }: { path: string; label?: string }) {
  const navigate = useNavigate();
  return <button onClick={() => navigate(path)}>{label}</button>;
}

function renderEdit(
  caps: Capabilities,
  answer: ServiceWriteResult | HttpError,
  entry = '/projects/team-a/trino/lake/edit',
  extra?: ReactNode,
) {
  vi.mocked(capabilitiesApi.get).mockResolvedValue(caps);
  if (answer instanceof HttpError) {
    vi.mocked(serviceApi.updateServiceParameters).mockRejectedValueOnce(answer);
  } else {
    vi.mocked(serviceApi.updateServiceParameters).mockResolvedValue(answer);
  }
  render(
    <MemoryRouter initialEntries={[entry]}>
      <CapabilitiesProvider>
        <Routes>
          <Route
            path="/projects/:projectId/trino/:serviceName/edit"
            element={
              <>
                <ServiceEditPage />
                {extra}
              </>
            }
          />
          <Route
            path="/projects/:projectId/trino/:serviceName"
            element={<Landing label="detail" />}
          />
          <Route path="/projects/:projectId/trino" element={<Landing label="list" />} />
        </Routes>
      </CapabilitiesProvider>
    </MemoryRouter>,
  );
}

async function save() {
  fireEvent.click(await screen.findByText('Save changes'));
}

describe('ServiceEditPage write outcome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(serviceApi.getService).mockResolvedValue(lake);
    vi.mocked(serviceApi.getProfileImages).mockResolvedValue({});
    vi.mocked(serviceApi.getPlatformServices).mockResolvedValue([]);
    vi.mocked(serviceApi.getServiceInputs).mockResolvedValue([]);
    vi.mocked(serviceApi.getServiceSchema).mockResolvedValue({
      properties: { replicas: { type: 'integer' } },
    });
  });

  it('goes back to the list with the usual toast when the answer has no operation', async () => {
    renderEdit(legacy, lake);
    await save();

    expect(await screen.findByText('list')).toBeInTheDocument();
    expect(await screen.findByText('lake has been updated.')).toBeInTheDocument();
  });

  it('keeps the neutral toast for an accepted write that carries a revision', async () => {
    renderEdit(withEngine, {
      ...lake,
      desiredRevision: REVISION,
      operation: { outcome: 'accepted' },
    });
    await save();

    expect(await screen.findByText('lake has been updated.')).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(REVISION))).not.toBeInTheDocument();
  });

  it('opens the instance detail with a warning when the outcome is unknown', async () => {
    renderEdit(withEngine, { ...lake, operation: { outcome: 'unknown' } });
    await save();

    expect(await screen.findByText('detail')).toBeInTheDocument();
    expect(await screen.findByText(/did not confirm the change/)).toBeInTheDocument();
  });

  it('stays on the form and shows the problems of a rejected write', async () => {
    renderEdit(withEngine, {
      ...lake,
      operation: {
        outcome: 'rejected',
        problems: [{ field: 'replicas', message: 'must be positive' }],
      },
    });
    await save();

    expect(await screen.findByText('replicas: must be positive')).toBeInTheDocument();
    expect(screen.getByText('Save changes')).toBeInTheDocument();
    expect(screen.queryByText('list')).not.toBeInTheDocument();
  });

  it('sends the revision the form was loaded at', async () => {
    vi.mocked(serviceApi.getService).mockResolvedValue({ ...lake, desiredRevision: REVISION });
    renderEdit(withEngine, lake);
    await save();

    await screen.findByText('list');
    expect(vi.mocked(serviceApi.updateServiceParameters).mock.calls[0][3]).toBe(REVISION);
  });

  it('sends no revision when the server reports none', async () => {
    renderEdit(legacy, lake);
    await save();

    await screen.findByText('list');
    expect(vi.mocked(serviceApi.updateServiceParameters).mock.calls[0][3]).toBeUndefined();
  });

  it('stays on the form after a 409 conflict, blocks Save, and saves again once reloaded', async () => {
    vi.mocked(serviceApi.getService)
      .mockResolvedValueOnce({ ...lake, desiredRevision: '3', parameters: { owner: 'ann' } })
      .mockResolvedValueOnce({ ...lake, desiredRevision: '4', parameters: { owner: 'carol' } });
    vi.mocked(serviceApi.getServiceSchema).mockResolvedValue({
      properties: { owner: { type: 'string' } },
    });
    renderEdit(
      withEngine,
      failure(409, {
        error: 'stale',
        code: 'conflict',
        operation: { outcome: 'rejected', problems: [{ code: 'conflict', message: 'stale form' }] },
      }),
    );
    fireEvent.change(await screen.findByDisplayValue('ann'), { target: { value: 'bob' } });
    await save();

    expect(await screen.findByText('Changes not saved')).toBeInTheDocument();
    expect(screen.getByText(/changed since it was loaded/)).toBeInTheDocument();
    expect(screen.queryByText('list')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('bob')).toBeInTheDocument();
    expect(screen.getByText('Save changes').closest('button')).toBeDisabled();
    expect(vi.mocked(serviceApi.updateServiceParameters).mock.calls[0][3]).toBe('3');

    fireEvent.click(screen.getByText('Reload'));

    expect(await screen.findByDisplayValue('carol')).toBeInTheDocument();
    expect(serviceApi.getService).toHaveBeenLastCalledWith('team-a', 'lake', true);
    expect(screen.queryByText('Changes not saved')).not.toBeInTheDocument();
    vi.mocked(serviceApi.updateServiceParameters).mockResolvedValueOnce(lake);
    await save();
    expect(await screen.findByText('list')).toBeInTheDocument();
    const calls = vi.mocked(serviceApi.updateServiceParameters).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1][2]).toMatchObject({ parameters: { owner: 'carol' } });
    expect(calls[1][3]).toBe('4');
  });

  it('keeps Save disabled after Reload until the connection inputs land', async () => {
    vi.mocked(serviceApi.getService)
      .mockResolvedValueOnce({ ...lake, desiredRevision: '3', parameters: { db: 'pg-old' } })
      .mockResolvedValueOnce({ ...lake, desiredRevision: '4', parameters: { db: 'pg-new' } });
    vi.mocked(serviceApi.getServiceSchema).mockResolvedValue({
      properties: { db: { type: 'string' } },
    });
    let answerInputs: (inputs: never[]) => void = () => undefined;
    vi.mocked(serviceApi.getServiceInputs)
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => new Promise((resolve) => (answerInputs = resolve)));
    renderEdit(withEngine, failure(409, { error: 'stale', code: 'conflict' }));
    await save();
    await screen.findByText('Changes not saved');

    fireEvent.click(screen.getByText('Reload'));

    await vi.waitFor(() => expect(serviceApi.getServiceInputs).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Changes not saved')).not.toBeInTheDocument();
    expect((await screen.findByText('Save changes')).closest('button')).toBeDisabled();
    await act(async () => answerInputs([]));
    expect(screen.getByText('Save changes').closest('button')).toBeEnabled();
  });

  it('opens the instance detail with a warning on a 504 gateway timeout', async () => {
    renderEdit(
      withEngine,
      new HttpError(504, 'Gateway Timeout', '', '/api/projects/team-a/services/lake'),
    );
    await save();

    expect(await screen.findByText('detail')).toBeInTheDocument();
    expect(await screen.findByText(/did not confirm the change/)).toBeInTheDocument();
    expect(screen.getByTestId('landing-search').textContent).toBe(
      `?returnTo=${encodeURIComponent('/projects/team-a/trino')}`,
    );
  });

  it('opens the instance detail with a warning on a 500 with an unknown outcome', async () => {
    renderEdit(
      withEngine,
      failure(500, {
        error: 'timeout',
        code: 'outcome-unknown',
        operation: { outcome: 'unknown' },
      }),
    );
    await save();

    expect(await screen.findByText('detail')).toBeInTheDocument();
    expect(await screen.findByText(/did not confirm the change/)).toBeInTheDocument();
  });

  it('reports a 500 without operation as before', async () => {
    renderEdit(legacy, failure(500, { error: 'helm exploded' }));
    await save();

    expect(await screen.findByText('helm exploded')).toBeInTheDocument();
    expect(screen.queryByText('Changes refused')).not.toBeInTheDocument();
  });

  it('lists the fields of a schema refusal and keeps the form', async () => {
    renderEdit(
      withEngine,
      failure(500, {
        error: 'invalid parameters',
        code: 'invalid-parameters',
        operation: {
          outcome: 'rejected',
          problems: [{ code: 'invalid-parameters', field: 'replicas', message: 'must be >= 1' }],
        },
      }),
    );
    await save();

    expect(await screen.findByText('replicas: must be >= 1')).toBeInTheDocument();
    expect(screen.getByText('Changes refused')).toBeInTheDocument();
    expect(screen.getByText('Save changes')).toBeInTheDocument();
  });

  it('reports a schema refusal without operation with the server text', async () => {
    renderEdit(
      withEngine,
      failure(500, { error: 'replicas: must be >= 1', code: 'invalid-parameters' }),
    );
    await save();

    expect(await screen.findByText('replicas: must be >= 1')).toBeInTheDocument();
    expect(screen.queryByText('Changes refused')).not.toBeInTheDocument();
    expect(screen.getByText('Save changes')).toBeInTheDocument();
  });

  it('always loads the instance uncached (fresh = true) on initial mount', async () => {
    renderEdit(withEngine, lake);
    await screen.findByText('Save changes');

    expect(serviceApi.getService).toHaveBeenCalledWith('team-a', 'lake', true);
  });

  it('preserves returnTo on 504 redirect and falls back to the service area when absent', async () => {
    const returnTo = '/projects/team-a/trino?filter=Ready';
    renderEdit(
      withEngine,
      new HttpError(504, 'Gateway Timeout', '', '/api/projects/team-a/services/lake'),
      `/projects/team-a/trino/lake/edit?returnTo=${encodeURIComponent(returnTo)}`,
    );
    await save();

    expect(await screen.findByText('detail')).toBeInTheDocument();
    expect(screen.getByTestId('landing-search').textContent).toBe(
      `?returnTo=${encodeURIComponent(returnTo)}`,
    );
  });

  it('resets saving and conflict state when the project or instance changes mid-flight', async () => {
    const sea: ServiceInstance = {
      ...lake,
      name: 'sea',
      releaseName: 'sea',
      targetNamespace: 'team-b',
      serviceTag: '0.2.0',
    };
    let answerSave: (value: ServiceWriteResult) => void = () => undefined;
    vi.mocked(capabilitiesApi.get).mockResolvedValue(withEngine);
    vi.mocked(serviceApi.getService).mockImplementation((project, name) =>
      Promise.resolve(project === 'team-b' && name === 'sea' ? sea : lake),
    );
    vi.mocked(serviceApi.updateServiceParameters).mockImplementation(
      () => new Promise((resolve) => (answerSave = resolve)),
    );

    render(
      <MemoryRouter initialEntries={['/projects/team-a/trino/lake/edit']}>
        <CapabilitiesProvider>
          <Routes>
            <Route
              path="/projects/:projectId/trino/:serviceName/edit"
              element={
                <>
                  <ServiceEditPage />
                  <GoTo path="/projects/team-b/trino/sea/edit" />
                </>
              }
            />
            <Route path="/projects/:projectId/trino" element={<Landing label="list" />} />
          </Routes>
        </CapabilitiesProvider>
      </MemoryRouter>,
    );
    await save();
    expect(await screen.findByText('Saving…')).toBeInTheDocument();

    fireEvent.click(screen.getByText('go'));

    expect(await screen.findByDisplayValue('sea')).toBeInTheDocument();
    expect(screen.queryByText('Saving…')).not.toBeInTheDocument();
    expect((await screen.findByText('Save changes')).closest('button')).toBeEnabled();

    // Settling the stale save from team-a/lake must not navigate.
    await act(async () => answerSave(lake));
    expect(screen.queryByText('list')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('sea')).toBeInTheDocument();
  });
});

function failure(status: number, body: unknown): HttpError {
  return new HttpError(status, 'x', JSON.stringify(body), '/api/projects/team-a/services/lake');
}
