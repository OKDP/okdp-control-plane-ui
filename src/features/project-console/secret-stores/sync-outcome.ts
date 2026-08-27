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
  /** What just happened, so an update is never reported as a creation. */
  action: 'created' | 'updated' = 'created',
  /** The status before the write, when there was one. */
  previous?: ExternalSecretStatusDetail | null,
): SyncOutcome {
  // Unchanged: the controller either has not acted on the new generation yet or
  // acted and landed on the same status, and nothing it publishes tells the two
  // apart. Neither reading is a confirmation, so this never reports success.
  if (detail && previous && !statusMoved(detail, previous)) {
    if (detail.status === 'Error') {
      const reason = detail.lastError?.trim().replace(/\.+$/, '');
      return {
        settled: true,
        synced: false,
        message: reason
          ? `Import "${name}" ${action}. Its status has not changed and still reports: ${reason}. Check the remote key.`
          : `Import "${name}" ${action}. Its status has not changed and still reports a failure. Check the remote key.`,
      };
    }
    // Still Synced from before the write is not proof this write synced: the
    // controller may simply not have reached it yet. Claiming success here was
    // the false green this whole path exists to remove.
    return {
      settled: false,
      synced: false,
      message: `Import "${name}" ${action}. Its status has not changed yet, its row will say when it does.`,
    };
  }
  if (!detail || !isSettled(detail.status)) {
    return {
      settled: false,
      synced: false,
      message: `Import "${name}" ${action}. It has not synced yet, its row will say when it does.`,
    };
  }
  if (detail.status === 'Synced') {
    return { settled: true, synced: true, message: `Import "${name}" ${action} and synced.` };
  }
  // The controller's own message is short and rarely names the cause, so the
  // sentence points at the field that does.
  // The controller's message sometimes ends with a period of its own, which
  // would render as "timeout.. Check" once this sentence adds its own.
  const reason = detail.lastError?.trim().replace(/\.+$/, '');
  return {
    settled: true,
    synced: false,
    message: reason
      ? `Import "${name}" was ${action} but could not sync: ${reason}. Check the remote key.`
      : `Import "${name}" was ${action} but could not sync. Check the remote key.`,
  };
}

/**
 * Whether a status is indistinguishable from one seen before the operation.
 *
 * Compared on what the controller actually publishes: the phase, the refresh
 * time behind lastSyncedAt, and the error text. There is no transition counter
 * to lean on, which is why a failure repeating verbatim cannot be told from one
 * that has not run again, and why the caller is told the status did not move
 * rather than given a verdict.
 */
function isSameStatus(
  a: ExternalSecretStatusDetail,
  b: ExternalSecretStatusDetail | null | undefined,
): boolean {
  if (!b) return false;
  return (
    a.status === b.status && a.lastSyncedAt === b.lastSyncedAt && a.lastError === b.lastError
  );
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
  options: {
    pollMs?: number;
    timeoutMs?: number;
    sleep?: (ms: number) => Promise<void>;
    /**
     * A status already settled before the call, which must not be mistaken for
     * the result of what just happened.
     *
     * On an update the object already exists and its status is already Synced
     * or Error, so the first read returns the state from BEFORE the edit.
     * Taken as the answer, correcting a broken import reports the failure it
     * has just fixed. Passing the previous status makes the wait skip past it.
     */
    ignoreUntilChanged?: ExternalSecretStatusDetail | null;
  } = {},
): Promise<ExternalSecretStatusDetail | null> {
  const pollMs = options.pollMs ?? SYNC_POLL_MS;
  const timeoutMs = options.timeoutMs ?? SYNC_TIMEOUT_MS;
  const sleep = options.sleep ?? wait;

  const attempts = Math.max(1, Math.ceil(timeoutMs / pollMs));
  let last: ExternalSecretStatusDetail | null = null;
  // Once anything other than the previous status has been seen, the controller
  // has acted and every reading after it describes the new attempt. Without
  // this, an Error that repeats verbatim after a Pending is compared to the
  // status from before the edit and ignored, and a real reconcile goes
  // unreported.
  let moved = false;

  for (let i = 0; i < attempts; i++) {
    try {
      last = await getStatus();
      if (!isSameStatus(last, options.ignoreUntilChanged)) moved = true;
      if (isSettled(last.status) && (moved || !isSameStatus(last, options.ignoreUntilChanged))) return last;
    } catch {
      // Deliberately keeps `last`: a failing read is not a verdict, and
      // forgetting a status already seen would report less than was known.
    }
    if (i < attempts - 1) await sleep(pollMs);
  }
  // Skipping the previous status inside the loop is not enough: handing it back
  // here would report the pre-edit failure all the same, just later. Nothing
  // new was seen, so nothing is the honest answer.
  return last;
}

/**
 * Whether the wait ever saw anything other than the status handed to it.
 *
 * external-secrets does not move refreshTime on a failed sync, so a reconcile
 * that fails exactly as before is indistinguishable from one that has not run.
 * Rather than guess, the caller is told the status never moved and says so.
 */
export function statusMoved(
  observed: ExternalSecretStatusDetail | null,
  previous: ExternalSecretStatusDetail | null | undefined,
): boolean {
  if (!observed) return false;
  return !isSameStatus(observed, previous);
}
