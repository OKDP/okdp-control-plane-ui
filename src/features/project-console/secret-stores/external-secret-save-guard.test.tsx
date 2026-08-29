import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ExternalSecretList } from './external-secret-list';
import { ConfirmPrefsProvider } from '../../../core/preferences/confirm-prefs-context';

vi.mock('../../../core/api/external-secret-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  externalSecretApi: {
    list: vi.fn(async () => []),
    checkRemoteKey: vi.fn(() => new Promise(() => undefined)),
    getStatus: vi.fn(async () => ({ status: 'Synced', conditions: [] })),
  },
}));
vi.mock('../../../core/api/secret-store-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  secretStoreApi: {
    list: vi.fn(async () => [
      { name: 'store-jeton', provider: 'vault', status: 'Ready' },
    ]),
  },
}));

// This jsdom build carries no localStorage, which ConfirmPrefsProvider reads.
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => undefined,
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/projects/demo/secret-stores']}>
      <ConfirmPrefsProvider>
        <Routes>
          <Route path="/projects/:projectId/secret-stores" element={<ExternalSecretList />} />
        </Routes>
      </ConfirmPrefsProvider>
    </MemoryRouter>,
  );
}

// Saving while the check is in flight creates the very key the check was about
// to call absent.
describe('the dialog while Check keys is running', () => {
  it('locks Create until the verdict lands', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /add external secret/i }));

    fireEvent.change(await screen.findByPlaceholderText('e.g., db-credentials'), {
      target: { value: 'mon-import' },
    });
    fireEvent.click(screen.getAllByText('Select a secret store')[0]);
    fireEvent.click(await screen.findByText('store-jeton'));
    fireEvent.change(screen.getByPlaceholderText('e.g., DB_PASSWORD'), {
      target: { value: 'PWD' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g., myapp/db'), {
      target: { value: 'client-externe' },
    });

    const create = screen.getByRole('button', { name: /create/i });
    expect(create).toHaveProperty('disabled', false);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /check keys/i }));
    });

    expect(create).toHaveProperty('disabled', true);
    expect(vi.mocked((await import('../../../core/api/external-secret-api')).externalSecretApi.checkRemoteKey)).toHaveBeenCalled();
  });
});
