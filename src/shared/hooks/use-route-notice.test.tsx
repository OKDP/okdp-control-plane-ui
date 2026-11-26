import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Toast } from 'primereact/toast';
import { useRef } from 'react';
import { useRouteNotice, withNotice } from './use-route-notice';

function Landing({
  onState,
  onLocation,
}: {
  onState: (state: unknown) => void;
  onLocation?: (url: string) => void;
}) {
  const toast = useRef<Toast>(null);
  const location = useLocation();
  useRouteNotice(toast);
  onState(location.state);
  onLocation?.(`${location.pathname}${location.search}${location.hash}`);
  return <Toast ref={toast} />;
}

describe('useRouteNotice', () => {
  it('shows the notice the navigation carries, then drops it from the history entry', async () => {
    const onState = vi.fn();
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/list',
            state: withNotice({
              severity: 'warn',
              summary: 'Not confirmed',
              detail: 'Reading again',
            }),
          },
        ]}
      >
        <Routes>
          <Route path="/list" element={<Landing onState={onState} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Reading again')).toBeInTheDocument();
    expect(onState).toHaveBeenLastCalledWith(null);
  });

  it('shows nothing without a notice', () => {
    render(
      <MemoryRouter initialEntries={['/list']}>
        <Routes>
          <Route path="/list" element={<Landing onState={vi.fn()} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(document.querySelector('.p-toast-message')).toBeNull();
  });

  it('preserves search and hash when dropping the notice from history state', async () => {
    const onState = vi.fn();
    const onLocation = vi.fn();
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/list',
            search: '?tab=pods',
            hash: '#logs',
            state: withNotice({
              severity: 'success',
              summary: 'Done',
              detail: 'Updated',
            }),
          },
        ]}
      >
        <Routes>
          <Route path="/list" element={<Landing onState={onState} onLocation={onLocation} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Updated')).toBeInTheDocument();
    expect(onState).toHaveBeenLastCalledWith(null);
    expect(onLocation).toHaveBeenLastCalledWith('/list?tab=pods#logs');
  });
});
