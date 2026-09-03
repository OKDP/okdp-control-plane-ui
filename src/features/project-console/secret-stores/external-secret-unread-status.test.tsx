import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ExternalSecret } from '../../../core/api/external-secret-api';

const existing: ExternalSecret = {
  name: 'my-import',
  namespace: 'demo',
  secretStoreRef: 'token-store',
  target: { name: 'my-import', creationPolicy: 'Owner' },
  refreshInterval: '1h',
  data: [{ secretKey: 'PWD', remoteRef: { key: 'external-client' } }],
  status: 'Error',
  lastError: 'old failure',
};

vi.mock('../../../core/api/external-secret-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  externalSecretApi: {
    list: vi.fn(async () => [existing]),
    update: vi.fn(async () => undefined),
    // The read made just before the save fails, as when the API is unreachable.
    getStatus: vi.fn(async () => {
      throw new Error('network');
    }),
  },
}));
vi.mock('../../../core/api/secret-store-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  secretStoreApi: {
    list: vi.fn(async () => [{ name: 'token-store', provider: 'vault', status: 'Ready' }]),
  },
}));
// Decouples the delete dialog from the localStorage-backed preferences store.
vi.mock('../../../core/preferences/confirm-prefs-context', () => ({
  useConfirmPrefs: () => ({ typedDeleteEnabled: false, setTypedDeleteEnabled: vi.fn() }),
}));

import { ExternalSecretList } from './external-secret-list';
import { externalSecretApi } from '../../../core/api/external-secret-api';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/projects/demo/secret-stores']}>
      <Routes>
        <Route path="/projects/:projectId/secret-stores" element={<ExternalSecretList />} />
      </Routes>
    </MemoryRouter>,
  );
}

// With no status to compare against, the wait after the save cannot tell a
// new reading from the old one: the answer is known before it starts.
describe('editing an import when the status before the save cannot be read', () => {
  it('reports it at once instead of waiting on more reads', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /actions for my-import/i }));
    fireEvent.click(await screen.findByText('Edit'));
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /^save$/i }));
    });

    expect(await screen.findByText(/could not be read/)).toBeTruthy();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    // One read, the failed one before the save; none spent waiting after it.
    expect(vi.mocked(externalSecretApi.getStatus)).toHaveBeenCalledTimes(1);
  });
});
