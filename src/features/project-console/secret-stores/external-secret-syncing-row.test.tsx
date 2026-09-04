import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type {
  ExternalSecret,
  ExternalSecretStatusDetail,
} from '../../../core/api/external-secret-api';

const stored: ExternalSecret = {
  name: 'my-import',
  namespace: 'demo',
  secretStoreRef: 'token-store',
  target: { name: 'my-import', creationPolicy: 'Owner' },
  refreshInterval: '1h',
  data: [{ secretKey: 'PWD', remoteRef: { key: 'external-client' } }],
  status: 'Error',
  lastError: 'old failure',
};

// The list answers with the imports known so far, each with its stored, and
// still previous, status.
let existing: ExternalSecret[] = [];
// Every status read stays pending until the test answers it, in the order the
// reads were made.
let statusReads: ((detail: ExternalSecretStatusDetail) => void)[] = [];

vi.mock('../../../core/api/external-secret-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  externalSecretApi: {
    list: vi.fn(async () => existing),
    create: vi.fn(async (_project: string, request: { name: string }) => {
      existing = [
        ...existing,
        { ...stored, name: request.name, target: { ...stored.target, name: request.name } },
      ];
    }),
    update: vi.fn(async () => undefined),
    getStatus: vi.fn(
      () =>
        new Promise<ExternalSecretStatusDetail>((resolve) => {
          statusReads.push(resolve);
        }),
    ),
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

beforeEach(() => {
  existing = [];
  statusReads = [];
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/projects/demo/secret-stores']}>
      <Routes>
        <Route path="/projects/:projectId/secret-stores" element={<ExternalSecretList />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function createImport(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: /add external secret/i }));
  fireEvent.change(await screen.findByPlaceholderText('e.g., db-credentials'), {
    target: { value: name },
  });
  fireEvent.click(screen.getAllByText('Select a secret store')[0]);
  // The list may already show the store name; the menu, a portal at the end of
  // the document, comes last.
  const options = await screen.findAllByText('token-store');
  fireEvent.click(options[options.length - 1]);
  fireEvent.change(screen.getByPlaceholderText('e.g., DB_PASSWORD'), { target: { value: 'PWD' } });
  fireEvent.change(screen.getByPlaceholderText('e.g., myapp/db'), {
    target: { value: 'external-client' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
  });
}

const rowOf = (name: string) => screen.getAllByText(name)[0].closest('tr');

// Between the save and the operator's first answer, the stored status is the
// one from before the save. Shown as is, it reads as the outcome of the save.
describe('the row of an import that was just saved', () => {
  it('says Syncing while the operator has not answered', async () => {
    renderPage();
    await createImport('my-import');

    expect(await screen.findByText('Syncing')).toBeTruthy();
    expect(screen.queryByText('Error')).toBeNull();
  });

  it('shows the real status once the operator has answered', async () => {
    renderPage();
    await createImport('my-import');
    await screen.findByText('Syncing');

    await act(async () => {
      statusReads[0]({ status: 'Synced', conditions: [] });
    });

    await waitFor(() => expect(screen.queryByText('Syncing')).toBeNull());
  });

  // Two saves in flight at once: each row waits on its own answer, and the
  // first answer takes only its own row out of Syncing.
  it('keeps every unanswered save on Syncing, and releases them one by one', async () => {
    renderPage();
    await createImport('my-import');
    await createImport('other-import');
    await waitFor(() => expect(screen.getAllByText('Syncing')).toHaveLength(2));

    await act(async () => {
      statusReads[0]({ status: 'Synced', conditions: [] });
    });

    await waitFor(() => {
      expect(rowOf('my-import')?.textContent).not.toContain('Syncing');
      expect(rowOf('other-import')?.textContent).toContain('Syncing');
    });
  });

  // The case from the issue: an import in Error is edited. The read made before
  // the save returns that Error, and the row must not keep showing it.
  it('says Syncing on an edited import until the operator answers', async () => {
    existing = [stored];
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /actions for my-import/i }));
    fireEvent.click(await screen.findByText('Edit'));
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /^save$/i }));
    });
    // The read before the save answers with the status from before the edit.
    await waitFor(() => expect(statusReads).toHaveLength(1));
    await act(async () => {
      statusReads[0]({ status: 'Error', lastError: 'old failure', conditions: [] });
    });

    expect(await screen.findByText('Syncing')).toBeTruthy();
    expect(rowOf('my-import')?.textContent).not.toContain('Error');

    await waitFor(() => expect(statusReads).toHaveLength(2));
    await act(async () => {
      statusReads[1]({ status: 'Synced', conditions: [] });
    });
    await waitFor(() => expect(screen.queryByText('Syncing')).toBeNull());
  });
});
