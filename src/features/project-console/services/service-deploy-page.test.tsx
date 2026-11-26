import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { Toast } from 'primereact/toast';
import ServiceDeployPage from './service-deploy-page';
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
    getProfileImages: vi.fn(),
    getPlatformServices: vi.fn(),
    getServiceInputs: vi.fn(),
    getServiceSchema: vi.fn(),
    deployService: vi.fn(),
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

const trino: ServiceInstance = {
  name: 'trino',
  releaseName: 'trino',
  service: 'trino',
  serviceTag: '0.1.0',
  status: 'Installing',
  targetNamespace: 'team-a',
  parameters: { replicas: 1 },
};

function failure(status: number, body: unknown): HttpError {
  return new HttpError(status, 'x', JSON.stringify(body), '/api/projects/team-a/services');
}

/** Stands in for the page a deploy lands on, showing the notice and query it carries. */
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

function renderDeploy(
  caps: Capabilities,
  entry = '/projects/team-a/trino/deploy?service=trino',
  extra?: ReactNode,
) {
  vi.mocked(capabilitiesApi.get).mockResolvedValue(caps);
  render(
    <MemoryRouter initialEntries={[entry]}>
      <CapabilitiesProvider>
        <Routes>
          <Route
            path="/projects/:projectId/trino/deploy"
            element={
              <>
                <ServiceDeployPage />
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

/** Walks the wizard to its last step and deploys. */
async function deploy() {
  await screen.findByText('Next');
  while (!screen.queryByText('Deploy instance')) {
    fireEvent.click(screen.getByText('Next'));
    await Promise.resolve();
  }
  const button = screen.getByText('Deploy instance').closest('button')!;
  await vi.waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

describe('ServiceDeployPage write outcome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(serviceApi.getProfileImages).mockResolvedValue({});
    vi.mocked(serviceApi.getPlatformServices).mockResolvedValue([
      { name: 'trino', versions: ['0.1.0'], defaultVersion: '0.1.0', description: 'Trino' },
    ]);
    vi.mocked(serviceApi.getServiceInputs).mockResolvedValue([]);
    vi.mocked(serviceApi.getServiceSchema).mockResolvedValue({
      properties: { replicas: { type: 'integer', default: 1 } },
    });
  });

  it('goes to the list with the usual toast when the answer has no operation', async () => {
    vi.mocked(serviceApi.deployService).mockResolvedValue(trino);
    renderDeploy(legacy);
    await deploy();

    expect(await screen.findByText('list')).toBeInTheDocument();
    expect(await screen.findByText('trino is being provisioned.')).toBeInTheDocument();
  });

  it('keeps the neutral toast for an accepted write that carries a revision', async () => {
    vi.mocked(serviceApi.deployService).mockResolvedValue({
      ...trino,
      desiredRevision: REVISION,
      operation: { outcome: 'accepted' },
    });
    renderDeploy(withEngine);
    await deploy();

    expect(await screen.findByText('trino is being provisioned.')).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(REVISION))).not.toBeInTheDocument();
  });

  it('stays on the wizard with a readable message when the name is taken (409)', async () => {
    vi.mocked(serviceApi.deployService).mockRejectedValueOnce(
      failure(409, {
        error: "Instance 'trino' already exists in project 'team-a'",
        code: 'instance-exists',
        operation: {
          outcome: 'rejected',
          problems: [
            {
              code: 'instance-exists',
              message: 'releases.kubocd.kubotal.io "team-a-trino" already exists',
            },
          ],
        },
      }),
    );
    renderDeploy(withEngine);
    await deploy();

    expect(
      await screen.findByText("Instance 'trino' already exists in project 'team-a'"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/releases\.kubocd/)).not.toBeInTheDocument();
    expect(screen.getByText('Deployment refused')).toBeInTheDocument();
    expect(screen.queryByText('list')).not.toBeInTheDocument();

    // The form is back, with its values, and can be submitted again.
    vi.mocked(serviceApi.deployService).mockResolvedValueOnce(trino);
    const button = (await screen.findByText('Deploy instance')).closest('button')!;
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(await screen.findByText('list')).toBeInTheDocument();
    expect(vi.mocked(serviceApi.deployService).mock.calls[1][1]).toMatchObject({
      instanceName: 'trino',
      parameters: { replicas: 1 },
    });
  });

  it('opens the instance detail with a warning on a 500 with an unknown outcome', async () => {
    vi.mocked(serviceApi.deployService).mockRejectedValue(
      failure(500, {
        error: 'push timed out',
        code: 'outcome-unknown',
        operation: { outcome: 'unknown' },
      }),
    );
    renderDeploy(withEngine);
    await deploy();

    expect(await screen.findByText('detail')).toBeInTheDocument();
    expect(await screen.findByText(/did not confirm the change/)).toBeInTheDocument();
  });

  it('reports a 500 without operation as before', async () => {
    vi.mocked(serviceApi.deployService).mockRejectedValue(failure(500, { error: 'helm exploded' }));
    renderDeploy(legacy);
    await deploy();

    expect(await screen.findByText('helm exploded')).toBeInTheDocument();
    expect(screen.queryByText('Deployment refused')).not.toBeInTheDocument();
    expect(screen.queryByText('detail')).not.toBeInTheDocument();
  });

  it('opens detail with area returnTo on a bare 504 gateway timeout', async () => {
    vi.mocked(serviceApi.deployService).mockRejectedValue(
      new HttpError(504, 'Gateway Timeout', '', '/api/projects/team-a/services'),
    );
    renderDeploy(withEngine);
    await deploy();

    expect(await screen.findByText('detail')).toBeInTheDocument();
    expect(await screen.findByText(/did not confirm the change/)).toBeInTheDocument();
    expect(screen.getByTestId('landing-search').textContent).toBe(
      `?returnTo=${encodeURIComponent('/projects/team-a/trino')}`,
    );
  });

  it('preserves a safe returnTo query param when redirecting on 504', async () => {
    vi.mocked(serviceApi.deployService).mockRejectedValue(
      new HttpError(504, 'Gateway Timeout', '', '/api/projects/team-a/services'),
    );
    const returnTo = '/projects/team-a/trino?status=Ready';
    renderDeploy(
      withEngine,
      `/projects/team-a/trino/deploy?service=trino&returnTo=${encodeURIComponent(returnTo)}`,
    );
    await deploy();

    expect(await screen.findByText('detail')).toBeInTheDocument();
    expect(screen.getByTestId('landing-search').textContent).toBe(
      `?returnTo=${encodeURIComponent(returnTo)}`,
    );
  });

  it('resets the deploying progress screen when the project changes mid-flight', async () => {
    let answerDeploy: (value: ServiceWriteResult) => void = () => undefined;
    vi.mocked(serviceApi.deployService).mockImplementation(
      () => new Promise((resolve) => (answerDeploy = resolve)),
    );
    renderDeploy(
      withEngine,
      '/projects/team-a/trino/deploy?service=trino',
      <GoTo path="/projects/team-b/trino/deploy?service=trino" />,
    );
    await deploy();

    expect(await screen.findByText('Validating parameters')).toBeInTheDocument();

    fireEvent.click(screen.getByText('go'));

    expect(await screen.findByText('Deploy instance')).toBeInTheDocument();
    expect(screen.queryByText('Validating parameters')).not.toBeInTheDocument();

    // Settling the stale deploy from team-a must not navigate or show a toast.
    await act(async () => answerDeploy(trino));
    expect(screen.queryByText('list')).not.toBeInTheDocument();
    expect(screen.getByText('Deploy instance')).toBeInTheDocument();
  });

  it('shows a creation-specific refusal message on a 409 conflict', async () => {
    vi.mocked(serviceApi.deployService).mockRejectedValue(
      failure(409, { error: 'conflict', code: 'conflict' }),
    );
    renderDeploy(withEngine);
    await deploy();

    expect(await screen.findByText('Deployment refused')).toBeInTheDocument();
    expect(screen.getByText(/creating this instance/i)).toBeInTheDocument();
    expect(screen.queryByText(/changed since it was loaded/i)).not.toBeInTheDocument();
  });
});
