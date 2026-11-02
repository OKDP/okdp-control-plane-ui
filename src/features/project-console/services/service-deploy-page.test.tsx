import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ServiceDeployPage from './service-deploy-page';
import { serviceApi } from '../../../core/api/service-api';

vi.mock('../../../core/api/service-api', () => ({
  serviceApi: {
    getPlatformServices: vi.fn(),
    getProfileImages: vi.fn(),
    getServiceInputs: vi.fn(),
    getServiceSchema: vi.fn(),
    deployService: vi.fn(),
  },
}));

const getPlatformServices = vi.mocked(serviceApi.getPlatformServices);
const getProfileImages = vi.mocked(serviceApi.getProfileImages);
const getServiceInputs = vi.mocked(serviceApi.getServiceInputs);
const getServiceSchema = vi.mocked(serviceApi.getServiceSchema);

// A Trino-like service with a single boolean parameter, defaulting on — the
// "Enable OPA" toggle from the bug report.
const trino = {
  name: 'trino',
  versions: ['480.0.0-p05'],
  defaultVersion: '480.0.0-p05',
  description: 'Trino',
};

const schema = {
  properties: {
    enableOPA: { type: 'boolean', default: true, 'x-ui-group': 'Security' },
  },
};

function renderDeploy() {
  render(
    <MemoryRouter initialEntries={['/projects/demo/deploy/trino']}>
      <Routes>
        <Route path="/projects/:projectId/deploy/:svcType" element={<ServiceDeployPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const switchOn = (el: HTMLElement) => el.getAttribute('aria-checked') === 'true';

describe('ServiceDeployPage — wizard state across steps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPlatformServices.mockResolvedValue([trino] as any);
    getProfileImages.mockResolvedValue({});
    getServiceInputs.mockResolvedValue([]);
    getServiceSchema.mockResolvedValue(schema);
  });

  // Regression (#38): the Parameters step was unmounted on the way to Review, so
  // the schema form re-seeded its defaults on the way back and a toggle the user
  // had turned off came back on. The step now stays mounted across the wizard.
  it('preserves a toggled-off parameter when navigating to Review and back', async () => {
    renderDeploy();

    // Basics → Parameters.
    fireEvent.click(await screen.findByRole('button', { name: /Next/i }));

    // The OPA toggle starts on (its schema default).
    const toggle = await screen.findByRole('switch');
    expect(switchOn(toggle)).toBe(true);

    // Turn it off.
    fireEvent.click(toggle);
    await waitFor(() => expect(switchOn(screen.getByRole('switch'))).toBe(false));

    // Parameters → Review. The step is hidden now, so its switch leaves the
    // accessibility tree, and the last step offers Deploy.
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    await screen.findByRole('button', { name: /Deploy instance/i });
    expect(screen.queryByRole('switch')).toBeNull();

    // Review → Parameters. The toggle is back and still off.
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    const toggleAgain = await screen.findByRole('switch');
    expect(switchOn(toggleAgain)).toBe(false);
  });
});
