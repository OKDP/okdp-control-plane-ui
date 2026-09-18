import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const SERVER_MESSAGE =
  'Vault answered. The Kubernetes role is verified by the operator at sync time.';

vi.mock('../../../core/api/secret-store-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  secretStoreApi: {
    list: vi.fn(async () => []),
    testConnection: vi.fn(async () => ({ message: SERVER_MESSAGE })),
  },
}));
// Decouples the delete dialog from the localStorage-backed preferences store.
vi.mock('../../../core/preferences/confirm-prefs-context', () => ({
  useConfirmPrefs: () => ({ typedDeleteEnabled: false, setTypedDeleteEnabled: vi.fn() }),
}));

import { SecretStoreList } from './secret-store-list';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/projects/demo/secret-stores']}>
      <Routes>
        <Route path="/projects/:projectId/secret-stores" element={<SecretStoreList />} />
      </Routes>
    </MemoryRouter>,
  );
}

// The server now says what the test proved. Shown as a fixed "Connection
// successful!", a Kubernetes-auth store looked verified when only Vault had
// answered.
describe('Test Connection on a Kubernetes-auth store', () => {
  it('shows the message the server answered with', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /add secret store/i }));
    fireEvent.change(await screen.findByPlaceholderText('e.g., vault-main'), {
      target: { value: 'vault-store' },
    });
    fireEvent.change(screen.getByPlaceholderText('https://vault.example.com:8200'), {
      target: { value: 'https://vault.example.com:8200' },
    });
    fireEvent.click(screen.getByRole('radio', { name: /kubernetes/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g., my-app-role'), {
      target: { value: 'demo-role' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /test connection/i }));
    });

    expect(await screen.findByText(SERVER_MESSAGE)).toBeTruthy();
    expect(screen.queryByText('Connection successful!')).toBeNull();
  });
});
