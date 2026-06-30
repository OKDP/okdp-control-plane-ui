import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { PlatformService } from '../../../core/models/service.model';

// Controllable hook + API stubs so the component renders without network.
const useCatalogMock = vi.fn();
vi.mock('./use-catalog', () => ({ useCatalog: () => useCatalogMock() }));
vi.mock('../../../core/api/catalog-api', () => ({
  catalogApi: {
    listServices: vi.fn(),
    createService: vi.fn(),
    updateService: vi.fn(),
    deleteService: vi.fn(),
  },
}));
// Decouples the delete dialog from the localStorage-backed preferences store.
vi.mock('../../../core/preferences/confirm-prefs-context', () => ({
  useConfirmPrefs: () => ({ typedDeleteEnabled: true, setTypedDeleteEnabled: vi.fn() }),
}));

import { CatalogList } from './catalog-list';

const SERVICES: PlatformService[] = [
  {
    name: 'jupyterhub',
    versions: ['1.0.0', '1.1.0'],
    defaultVersion: '1.1.0',
    description: 'Notebooks',
    category: 'Data Science',
  },
];

function renderList() {
  return render(<CatalogList />);
}

describe('CatalogList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCatalogMock.mockReturnValue({
      services: SERVICES,
      loading: false,
      error: false,
      refresh: vi.fn(),
    });
  });

  it('renders the catalog rows with versions and the default marker', () => {
    renderList();
    expect(screen.getByText('jupyterhub')).toBeInTheDocument();
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('Data Science')).toBeInTheDocument();
    // The default version is flagged in its tag.
    expect(screen.getByText('(default)')).toBeInTheDocument();
  });

  it('shows the error empty-state with a retry when loading failed', () => {
    useCatalogMock.mockReturnValue({
      services: [],
      loading: false,
      error: true,
      refresh: vi.fn(),
    });
    renderList();
    expect(screen.getByText('Failed to load the catalog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('opens the add dialog with the confirm button disabled until the form is valid', async () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: /add service/i }));

    const dialog = await screen.findByRole('dialog');
    // Empty name + no versions → the confirm button is disabled.
    const confirm = within(dialog).getByRole('button', { name: /add service/i });
    expect(confirm).toBeDisabled();
  });
});
