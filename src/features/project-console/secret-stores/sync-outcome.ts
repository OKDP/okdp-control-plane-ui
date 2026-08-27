import type { ExternalSecretStatusDetail } from '../../../core/api/external-secret-api';

/** How often the status is asked for while waiting on the first sync. */
export const SYNC_POLL_MS = 1500;
/**
 * How long to wait before handing the question back to the list.
 *
 * Long enough for the controller to have tried once on a healthy cluster,
 * short enough that a dialog does not hold someone hostage: past it the import
 * exists and its row carries the answer.
 */
export const SYNC_TIMEOUT_MS = 15000;

/**
 * Whether a status is settled, so waiting can stop.
 *
 * Pending and Unknown are the two the controller passes through before it has
 * tried anything, which is exactly what the caller is waiting past.
 */
export function isSettled(status: ExternalSecretStatusDetail['status']): boolean {
  return status === 'Synced' || status === 'Error';
}

export interface SyncOutcome {
  settled: boolean;
  synced: boolean;
  message: string;
}

/**
 * Turns the status of a freshly created import into one sentence.
 *
 * A creation that answered 201 says nothing about whether the import can read
 * its key: the controller finds that out on its first sync. Announcing success
 * on the 201 alone is what let a broken import look created and fine.
 */
export function describeSyncOutcome(
  name: string,
  detail: ExternalSecretStatusDetail | null,
): SyncOutcome {
  if (!detail || !isSettled(detail.status)) {
    return {
      settled: false,
      synced: false,
      message: `Import "${name}" created. It has not synced yet, its row will say when it does.`,
    };
  }
  if (detail.status === 'Synced') {
    return { settled: true, synced: true, message: `Import "${name}" created and synced.` };
  }
  // The controller's own message is short and rarely names the cause, so the
  // sentence points at the field that does.
  const reason = detail.lastError?.trim();
  return {
    settled: true,
    synced: false,
    message: reason
      ? `Import "${name}" was created but could not sync: ${reason}. Check the remote key.`
      : `Import "${name}" was created but could not sync. Check the remote key.`,
  };
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Asks for the status until it settles, or until the wait is over.
 *
 * This is the half of the feedback that works whatever the store's auth
 * method. A store using Kubernetes auth cannot be asked about a key ahead of
 * time, so its only honest report comes from the controller having tried.
 *
 * A failing status call is not treated as a verdict: the import may be fine
 * and the read may simply have raced the object's creation, so the wait
 * continues and an unsettled result is reported as unsettled.
 */
export async function waitForSyncOutcome(
  getStatus: () => Promise<ExternalSecretStatusDetail>,
  options: { pollMs?: number; timeoutMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<ExternalSecretStatusDetail | null> {
  const pollMs = options.pollMs ?? SYNC_POLL_MS;
  const timeoutMs = options.timeoutMs ?? SYNC_TIMEOUT_MS;
  const sleep = options.sleep ?? wait;

  const attempts = Math.max(1, Math.ceil(timeoutMs / pollMs));
  let last: ExternalSecretStatusDetail | null = null;

  for (let i = 0; i < attempts; i++) {
    try {
      last = await getStatus();
      if (isSettled(last.status)) return last;
    } catch {
      last = null;
    }
    if (i < attempts - 1) await sleep(pollMs);
  }
  return last;
}
