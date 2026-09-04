import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { RemoteKeyCheck } from '../../../core/api/external-secret-api';

// The check stays in flight until the test answers it.
let answerCheck: (check: RemoteKeyCheck) => void = () => undefined;

vi.mock('../../../core/api/external-secret-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  externalSecretApi: {
    list: vi.fn(async () => []),
    checkRemoteKey: vi.fn(
      () =>
        new Promise<RemoteKeyCheck>((resolve) => {
          answerCheck = resolve;
        }),
    ),
    getStatus: vi.fn(async () => ({ status: 'Synced', conditions: [] })),
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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/projects/demo/secret-stores']}>
      <Routes>
        <Route path="/projects/:projectId/secret-stores" element={<ExternalSecretList />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function openDialogWithOneMapping() {
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: /add external secret/i }));
  fireEvent.change(await screen.findByPlaceholderText('e.g., db-credentials'), {
    target: { value: 'my-import' },
  });
  fireEvent.click(screen.getAllByText('Select a secret store')[0]);
  fireEvent.click(await screen.findByText('token-store'));
  fireEvent.change(screen.getByPlaceholderText('e.g., DB_PASSWORD'), { target: { value: 'PWD' } });
  fireEvent.change(screen.getByPlaceholderText('e.g., myapp/db'), {
    target: { value: 'external-client' },
  });
  return screen.getByRole('button', { name: /create/i });
}

// Saving while the check is in flight submits a mapping the check was about to
// flag, and the verdict lands on a closed dialog.
describe('the dialog while Check keys is running', () => {
  it('locks Create until the verdict lands', async () => {
    const create = await openDialogWithOneMapping();
    expect(create).toHaveProperty('disabled', false);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /check keys/i }));
    });

    expect(create).toHaveProperty('disabled', true);
  });

  it('gives Create back once the verdict lands', async () => {
    const create = await openDialogWithOneMapping();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /check keys/i }));
    });
    expect(create).toHaveProperty('disabled', true);

    await act(async () => {
      answerCheck({ verifiable: true, found: false, message: 'Key not found' });
    });

    await waitFor(() => expect(create).toHaveProperty('disabled', false));
  });
});
