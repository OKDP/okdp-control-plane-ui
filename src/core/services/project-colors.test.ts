import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PROJECT_COLOR_PALETTE,
  clearProjectColor,
  getProjectColor,
  setProjectColor,
} from './project-colors';

// Node's experimental localStorage global shadows jsdom's with a stub that
// lacks persistence; replace it with a real in-memory implementation.
function mockLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  });
}

describe('project colors', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it('falls back to a stable palette color derived from the name', () => {
    const color = getProjectColor('analytics');
    expect(PROJECT_COLOR_PALETTE).toContain(color);
    expect(getProjectColor('analytics')).toBe(color);
  });

  it('returns the stored choice once one is made', () => {
    setProjectColor('analytics', '#ec4899');
    expect(getProjectColor('analytics')).toBe('#ec4899');
  });

  it('clears a stored choice back to the fallback', () => {
    const fallback = getProjectColor('analytics');
    setProjectColor('analytics', '#22c55e');
    clearProjectColor('analytics');
    expect(getProjectColor('analytics')).toBe(fallback);
  });

  it('survives corrupted storage content', () => {
    localStorage.setItem('okdp-project-colors', '{not json');
    expect(PROJECT_COLOR_PALETTE).toContain(getProjectColor('analytics'));
  });
});
