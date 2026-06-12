/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { NAV_HIDDEN_KEY, NAV_SIZE_KEY } from '../storage-keys';

export type NavMenuSize = 'compact' | 'default' | 'large' | 'xl';

/** Factor each size applies to the menu's font/icon/padding metrics — the
 *  value of `--nav-item-scale` on the sidebar (1 everywhere else). One
 *  choice covers both collapse states: entries when expanded, icons on
 *  the rail. */
export const NAV_SIZE_SCALE: Record<NavMenuSize, number> = {
  compact: 0.9,
  default: 1,
  large: 1.2,
  xl: 1.4,
};

export interface NavPrefsContextValue {
  /** Effective visibility: the user's explicit choice when there is one,
   *  the item's `defaultHidden` flag otherwise. */
  isNavItemHidden: (label: string, defaultHidden?: boolean) => boolean;
  setNavItemHidden: (label: string, hidden: boolean) => void;
  menuSize: NavMenuSize;
  setMenuSize: (size: NavMenuSize) => void;
}

const NavPrefsContext = createContext<NavPrefsContextValue | null>(null);

/** Stored per-item overrides (label → hidden). Items the user never touched
 *  are absent and follow their default. The legacy format was a plain array
 *  of hidden labels — folded into overrides on read. */
function storedOverrides(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NAV_HIDDEN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[] | Record<string, boolean>;
      if (Array.isArray(parsed)) {
        return Object.fromEntries(parsed.map((label) => [label, true]));
      }
      return parsed;
    }
  } catch {
    // corrupt value — fall back to defaults
  }
  return {};
}

function isNavMenuSize(value: unknown): value is NavMenuSize {
  return value === 'compact' || value === 'default' || value === 'large' || value === 'xl';
}

/** Stored size choice. The legacy format was a per-collapse-state object
 *  ({expanded, collapsed}) — folded into its `expanded` choice on read. */
function storedSize(): NavMenuSize {
  const raw = localStorage.getItem(NAV_SIZE_KEY);
  if (!raw) return 'default';
  if (isNavMenuSize(raw)) return raw;
  try {
    const parsed = JSON.parse(raw) as { expanded?: unknown };
    if (isNavMenuSize(parsed?.expanded)) return parsed.expanded;
  } catch {
    // corrupt value — fall back to the default
  }
  return 'default';
}

/** Which lateral-menu entries the user hid or re-enabled, and how large the
 *  menu renders. Persisted per browser; shared between the project console
 *  (reader) and the settings page (writer). */
export function NavPrefsProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>(storedOverrides);
  const [menuSize, setMenuSizeState] = useState<NavMenuSize>(storedSize);

  const isNavItemHidden = useCallback(
    (label: string, defaultHidden?: boolean) => overrides[label] ?? defaultHidden ?? false,
    [overrides],
  );

  const setNavItemHidden = useCallback((label: string, hidden: boolean) => {
    setOverrides((prev) => {
      const next = { ...prev, [label]: hidden };
      localStorage.setItem(NAV_HIDDEN_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setMenuSize = useCallback((size: NavMenuSize) => {
    localStorage.setItem(NAV_SIZE_KEY, size);
    setMenuSizeState(size);
  }, []);

  return (
    <NavPrefsContext.Provider value={{ isNavItemHidden, setNavItemHidden, menuSize, setMenuSize }}>
      {children}
    </NavPrefsContext.Provider>
  );
}

export function useNavPrefs(): NavPrefsContextValue {
  const ctx = useContext(NavPrefsContext);
  if (!ctx) {
    throw new Error('useNavPrefs must be used within a NavPrefsProvider');
  }
  return ctx;
}
