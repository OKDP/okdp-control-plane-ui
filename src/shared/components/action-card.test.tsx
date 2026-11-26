import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActionCard } from './action-card';

describe('ActionCard external URL safety', () => {
  it('renders an external http(s) link', () => {
    render(
      <MemoryRouter>
        <ActionCard
          to="https://trino.example.com"
          external
          icon="pi pi-database"
          tone="primary"
          title="Trino"
          description="Open Trino"
        />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: /Trino/ });
    expect(link).toHaveAttribute('href', 'https://trino.example.com');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it.each(['javascript:alert(1)', 'data:text/html,boom', 'not-a-url'])(
    'suppresses unsafe external URL %s',
    (badUrl) => {
      render(
        <MemoryRouter>
          <ActionCard
            to={badUrl}
            external
            icon="pi pi-database"
            tone="primary"
            title="Unsafe"
            description="Blocked"
          />
        </MemoryRouter>,
      );
      expect(screen.getByText('Unsafe')).toBeInTheDocument();
      expect(document.querySelector('a')).toBeNull();
    },
  );
});
