import type { RemoteKeyCheck } from '../../../core/api/external-secret-api';

/**
 * How a checked key reads in the form.
 *
 * `unknown` is a state of its own rather than a flavour of failure: the control
 * plane could not ask, so the key may well be fine. Folding it into either
 * `found` or `absent` would put a verdict on screen that nobody established.
 */
export type CheckTone = 'found' | 'absent' | 'unknown' | 'checking';

export interface CheckDisplay {
  tone: CheckTone;
  message: string;
  /** Property names the key holds, offered as the correction to a typo. */
  properties: string[];
}

export function describeCheck(check: RemoteKeyCheck): CheckDisplay {
  if (!check.verifiable) {
    return { tone: 'unknown', message: check.message, properties: [] };
  }
  return {
    tone: check.found ? 'found' : 'absent',
    message: check.message,
    properties: check.properties ?? [],
  };
}

/** Reads as a request that was refused, not as a key that is missing. */
export function describeCheckFailure(message: string): CheckDisplay {
  return { tone: 'unknown', message, properties: [] };
}

/** Placeholder posted for each row before its answer comes back. */
export const CHECKING: CheckDisplay = { tone: 'checking', message: 'Checking...', properties: [] };

/**
 * Applies answers to the rows that are still waiting for them.
 *
 * A row edited while the requests are in flight has its entry deleted, and the
 * answer that arrives afterwards describes a value that no longer exists.
 * Keeping the result only for rows still marked as being checked is what stops
 * a stale verdict from being put back.
 */
export function applyCheckResults(
  current: Record<number, CheckDisplay>,
  results: { indexes: number[]; display: CheckDisplay }[],
): Record<number, CheckDisplay> {
  const next = { ...current };
  for (const { indexes, display } of results) {
    for (const index of indexes) {
      if (next[index]?.tone === 'checking') next[index] = display;
    }
  }
  return next;
}

/**
 * Groups rows by the remote reference they ask about.
 *
 * Rows sharing a key share an answer, and each request costs the server a
 * credentials read and a Vault round trip.
 */
export function groupByRemoteRef(
  rows: { index: number; key: string; property?: string }[],
): { indexes: number[]; key: string; property?: string }[] {
  const byRef = new Map<string, { indexes: number[]; key: string; property?: string }>();
  for (const row of rows) {
    const id = `${row.key}\u0000${row.property ?? ''}`;
    const seen = byRef.get(id);
    if (seen) seen.indexes.push(row.index);
    else byRef.set(id, { indexes: [row.index], key: row.key, property: row.property });
  }
  return [...byRef.values()];
}
