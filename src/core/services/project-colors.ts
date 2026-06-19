import { useSyncExternalStore } from 'react';
import { PROJECT_COLORS_KEY } from '../storage-keys';

/** Palette offered when creating a project; accents from the design system. */
export const PROJECT_COLOR_PALETTE = [
  '#41928f', // teal (brand)
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // rose
  '#f59e0b', // amber
  '#22c55e', // green
  '#ef4444', // red
  '#64748b', // slate
] as const;

function readMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PROJECT_COLORS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      // A pre-fix bug could store a color under the empty name; drop it.
      delete (parsed as Record<string, string>)[''];
      return parsed as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, string>): void {
  try {
    localStorage.setItem(PROJECT_COLORS_KEY, JSON.stringify(map));
  } catch {
    // storage unavailable — colors fall back to the name hash
  }
}

/**
 * Color of a project for this user: the explicit choice when one was made,
 * else a stable palette color derived from the name — so every project has
 * a color identity even when created by someone else.
 */
export function getProjectColor(name: string): string {
  const stored = readMap()[name];
  if (stored) {
    return stored;
  }
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return PROJECT_COLOR_PALETTE[Math.abs(hash) % PROJECT_COLOR_PALETTE.length];
}

export function setProjectColor(name: string, color: string): void {
  writeMap({ ...readMap(), [name]: color });
  notifyColorChange();
}

export function clearProjectColor(name: string): void {
  const map = readMap();
  if (name in map) {
    delete map[name];
    writeMap(map);
    notifyColorChange();
  }
}

// Change notification: colors are read at render time all over the shell
// (header accent, project switcher, list dots), so editing one — e.g. from
// Project Settings — must re-render those readers.
interface ColorChangeStore {
  listeners: Set<() => void>;
  version: number;
  storageWired?: boolean;
}

// Pinned on globalThis so dev-server HMR can never split writers from
// subscribers across duplicated module instances ("the color stopped
// updating until reload").
const store: ColorChangeStore = ((
  globalThis as unknown as Record<string, ColorChangeStore | undefined>
).__okdpProjectColorStore ??= { listeners: new Set(), version: 0 });

function notifyColorChange(): void {
  store.version++;
  store.listeners.forEach((listener) => listener());
}

// Edits made in another tab arrive through the storage event — the color
// applies immediately there too, not on the next reload.
if (typeof window !== 'undefined' && !store.storageWired) {
  store.storageWired = true;
  window.addEventListener('storage', (event) => {
    if (event.key === PROJECT_COLORS_KEY) notifyColorChange();
  });
}

/** Subscribes the calling component to project-color changes: it re-renders
 *  on every edit, so plain getProjectColor reads stay fresh. */
export function useProjectColorsVersion(): number {
  return useSyncExternalStore(
    (listener) => {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    () => store.version,
  );
}
