import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ServiceInstance } from '../../../core/models/service.model';
import { ConfirmPrefsProvider } from '../../../core/preferences/confirm-prefs-context';

vi.mock('../../../core/api/service-api', () => ({
  serviceApi: {
    getService: vi.fn(),
    getPods: vi.fn(),
    getServiceMetrics: vi.fn(),
  },
}));

import { serviceApi } from '../../../core/api/service-api';
import ServiceDetailPage from './service-detail-page';

const INSTALLING: ServiceInstance = {
  name: 'trino',
  releaseName: 'my-project-trino',
  service: 'trino',
  serviceTag: '480.0.0-1.0.1',
  status: 'Installing',
  targetNamespace: 'my-project',
  parameters: {},
};

function renderPage() {
  return render(
    <ConfirmPrefsProvider>
      <MemoryRouter initialEntries={['/projects/my-project/trino/trino']}>
        <Routes>
          <Route path="/projects/:projectId/trino/:serviceName" element={<ServiceDetailPage />} />
        </Routes>
      </MemoryRouter>
    </ConfirmPrefsProvider>,
  );
}

describe('ServiceDetailPage', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    });
    vi.mocked(serviceApi.getService).mockResolvedValue(INSTALLING);
    vi.mocked(serviceApi.getServiceMetrics).mockRejectedValue(new Error('500'));
  });

  it('shows the instance when the pods request fails', async () => {
    vi.mocked(serviceApi.getPods).mockRejectedValue(new Error('500'));

    renderPage();

    expect(await screen.findByRole('heading', { name: 'trino' })).toBeInTheDocument();
    expect(screen.queryByText('Instance not found')).not.toBeInTheDocument();
  });

  it('shows "Instance not found" when the instance request fails', async () => {
    vi.mocked(serviceApi.getService).mockRejectedValue(new Error('404'));
    vi.mocked(serviceApi.getPods).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('Instance not found')).toBeInTheDocument();
  });
});
