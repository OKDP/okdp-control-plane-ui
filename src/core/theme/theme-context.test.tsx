import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ThemeProvider, useTheme } from './theme-context';
import { THEME_STORAGE_KEY } from '../storage-keys';

type ChangeListener = () => void;

let osPrefersDark = false;
let changeListeners: ChangeListener[] = [];

function mockMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' && osPrefersDark,
    media: query,
    addEventListener: (_: string, cb: ChangeListener) => changeListeners.push(cb),
    removeEventListener: (_: string, cb: ChangeListener) => {
      changeListeners = changeListeners.filter((l) => l !== cb);
    },
  }));
}

// Node's experimental localStorage global shadows jsdom's with a stub that
// lacks clear()/persistence; replace it with a real in-memory implementation.
function mockLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  });
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

const bodyIsDark = () => document.body.classList.contains('dark-mode');

describe('ThemeProvider', () => {
  beforeEach(() => {
    mockLocalStorage();
    document.body.classList.remove('dark-mode');
    osPrefersDark = false;
    changeListeners = [];
    mockMatchMedia();
  });

  it('defaults to system and follows the OS scheme', () => {
    osPrefersDark = true;
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('system');
    expect(bodyIsDark()).toBe(true);
  });

  it('reacts to OS scheme changes while in system mode', () => {
    renderHook(() => useTheme(), { wrapper });
    expect(bodyIsDark()).toBe(false);

    osPrefersDark = true;
    act(() => changeListeners.forEach((cb) => cb()));
    expect(bodyIsDark()).toBe(true);
  });

  it('applies and persists an explicit choice', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => result.current.setTheme('dark'));
    expect(bodyIsDark()).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    act(() => result.current.setTheme('light'));
    expect(bodyIsDark()).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('ignores the OS scheme when an explicit mode is chosen', () => {
    osPrefersDark = true;
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('light');
    expect(bodyIsDark()).toBe(false);
    // No system listener should be registered in an explicit mode.
    expect(changeListeners).toHaveLength(0);
  });
});
