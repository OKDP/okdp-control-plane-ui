import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CustomViewsSection from './custom-views-section';
import type { CustomView } from '../../../core/preferences/custom-views-context';

const mockViews: CustomView[] = [
  {
    id: 'safe-1',
    label: 'Grafana',
    url: 'https://grafana.example.com/d/1',
    icon: 'pi pi-chart-line',
    category: 'Monitoring',
    inMenu: true,
  },
  {
    id: 'unsafe-js',
    label: 'BadJS',
    url: 'javascript:alert(1)',
    icon: 'pi pi-globe',
    category: 'Monitoring',
    inMenu: false,
  },
  {
    id: 'unsafe-cred',
    label: 'Spoofed',
    url: 'https://okdp-ui@evil.example/',
    icon: 'pi pi-globe',
    category: 'Monitoring',
    inMenu: false,
  },
  {
    id: 'unsafe-rel',
    label: 'RelativeScheme',
    url: 'https:/admin',
    icon: 'pi pi-globe',
    category: 'Monitoring',
    inMenu: false,
  },
];

vi.mock('../../../core/preferences/custom-views-context', () => ({
  useCustomViews: () => ({
    viewsFor: () => mockViews,
    addView: vi.fn(),
    updateView: vi.fn(),
    removeView: vi.fn(),
  }),
}));

describe('CustomViewsSection external URL safety', () => {
  it('links safe http(s) URLs with noopener noreferrer and renders unsafe URLs as plain text', () => {
    render(<CustomViewsSection projectName="team-a" />);

    const safeLink = screen.getByRole('link', { name: 'https://grafana.example.com/d/1' });
    expect(safeLink).toHaveAttribute('href', 'https://grafana.example.com/d/1');
    expect(safeLink).toHaveAttribute('rel', 'noopener noreferrer');

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByText('javascript:alert(1)').tagName).toBe('SPAN');
    expect(screen.getByText('https://okdp-ui@evil.example/').tagName).toBe('SPAN');
    expect(screen.getByText('https:/admin').tagName).toBe('SPAN');
  });
});
