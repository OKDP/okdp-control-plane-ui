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
    return parsed && typeof parsed === 'object' ? parsed : {};
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
}

export function clearProjectColor(name: string): void {
  const map = readMap();
  if (name in map) {
    delete map[name];
    writeMap(map);
  }
}
