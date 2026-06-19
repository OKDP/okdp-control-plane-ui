/**
 * Minimal stale-while-revalidate cache for slow API reads (instance lists,
 * per-instance metrics). Pages revisited shortly after leaving paint
 * instantly from here while the fresh request always runs and overwrites —
 * cached values are UI snapshots only, never a reason to skip a fetch.
 *
 * In-memory and per-tab on purpose: it empties on reload and never outlives
 * the session. The TTL only bounds how old a snapshot may be to be worth
 * painting.
 */
const TTL_MS = 60_000;

const cache = new Map<string, { value: unknown; at: number }>();

export function readUiCache<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.at > TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function writeUiCache<T>(key: string, value: T): void {
  cache.set(key, { value, at: Date.now() });
}
