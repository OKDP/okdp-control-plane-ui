import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isSettled, describeSyncOutcome, waitForSyncOutcome, statusMoved } from './sync-outcome';
import { logger } from '../../../core/services/logger';
import type { ExternalSecretStatusDetail } from '../../../core/api/external-secret-api';

const detail = (
  status: ExternalSecretStatusDetail['status'],
  lastError?: string,
): ExternalSecretStatusDetail => ({ status, conditions: [], lastError });

/**
 * A clock the wait drives itself: sleeping advances it instead of waiting on
 * it, so a deadline written in milliseconds is reached in no time at all. The
 * wait bounds itself on this clock, so handing it a sleep that never advances
 * anything would leave it turning until the real one caught up.
 */
function fakeClock() {
  let t = 0;
  return {
    now: () => t,
    sleep: (ms: number) => {
      t += ms;
      return Promise.resolve();
    },
  };
}

// A failing status read is expected in several of these, and its warning is
// what the code under test is meant to emit. Silenced here so the run stays
// readable; the test that cares asserts on the spy.
let warned: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warned = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  warned.mockRestore();
});

describe('isSettled', () => {
  it('waits past the states the controller passes through before trying', () => {
    expect(isSettled('Pending')).toBe(false);
    expect(isSettled('Unknown')).toBe(false);
    expect(isSettled('Synced')).toBe(true);
    expect(isSettled('Error')).toBe(true);
  });
});

describe('describeSyncOutcome', () => {
  // The regression this guards: a 201 says the object was written, not that it
  // can read its key. Announcing success on the 201 alone let a broken import
  // look created and fine.
  it('does not claim success while the status is unsettled', () => {
    const o = describeSyncOutcome('my-import', detail('Pending'));
    expect(o.settled).toBe(false);
    expect(o.synced).toBe(false);
    expect(o.message).not.toContain('synced.');
  });

  it('does not claim success when the status could not be read at all', () => {
    const o = describeSyncOutcome('my-import', null);
    expect(o.settled).toBe(false);
    expect(o.synced).toBe(false);
  });

  it('confirms a real sync', () => {
    const o = describeSyncOutcome('my-import', detail('Synced'));
    expect(o).toMatchObject({ settled: true, synced: true });
    expect(o.message).toContain('created and synced');
  });

  it('reports a failed sync and points at the key', () => {
    const o = describeSyncOutcome('my-import', detail('Error', 'could not get secret data'));
    expect(o).toMatchObject({ settled: true, synced: false });
    expect(o.message).toContain('could not get secret data');
    expect(o.message).toContain('remote key');
  });

  // The controller does not always fill lastError, and an empty reason must not
  // produce a dangling sentence.
  it('still reports a failure with no reason attached', () => {
    for (const empty of [undefined, '', '   ']) {
      const o = describeSyncOutcome('my-import', detail('Error', empty));
      expect(o.synced).toBe(false);
      expect(o.message).not.toContain('::');
      expect(o.message.trim().endsWith('.')).toBe(true);
    }
  });
});

describe('waitForSyncOutcome', () => {
  it('stops as soon as the status settles', async () => {
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce(detail('Pending'))
      .mockResolvedValueOnce(detail('Synced'));

    const result = await waitForSyncOutcome(getStatus, {
      pollMs: 1,
      timeoutMs: 100,
      ...fakeClock(),
    });

    expect(result?.status).toBe('Synced');
    expect(getStatus).toHaveBeenCalledTimes(2);
  });

  // A dialog must not hold someone hostage: past the wait the import exists and
  // its row carries the answer.
  it('gives up after the wait and returns what it last saw', async () => {
    const getStatus = vi.fn().mockResolvedValue(detail('Pending'));

    const result = await waitForSyncOutcome(getStatus, {
      pollMs: 10,
      timeoutMs: 30,
      ...fakeClock(),
    });

    expect(result?.status).toBe('Pending');
    // Four, not three: the wait is bounded by the clock, so it reads once more
    // when the deadline itself falls on a poll instead of stopping short of it.
    expect(getStatus).toHaveBeenCalledTimes(4);
  });

  // The status read can race the object's creation. A failure there is not a
  // verdict on the import, so the wait continues.
  it('keeps waiting when a status read fails', async () => {
    const getStatus = vi
      .fn()
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValueOnce(detail('Synced'));

    const result = await waitForSyncOutcome(getStatus, {
      pollMs: 1,
      timeoutMs: 100,
      ...fakeClock(),
    });

    expect(result?.status).toBe('Synced');
  });

  it('reports nothing rather than a verdict when every read fails', async () => {
    const getStatus = vi.fn().mockRejectedValue(new Error('boom'));

    const result = await waitForSyncOutcome(getStatus, {
      pollMs: 1,
      timeoutMs: 3,
      ...fakeClock(),
    });

    expect(result).toBeNull();
    expect(describeSyncOutcome('my-import', result).synced).toBe(false);
  });

  it('always asks at least once, whatever the timings say', async () => {
    const getStatus = vi.fn().mockResolvedValue(detail('Pending'));
    await waitForSyncOutcome(getStatus, { pollMs: 100, timeoutMs: 0, ...fakeClock() });
    expect(getStatus).toHaveBeenCalledTimes(1);
  });
});

describe('waitForSyncOutcome, editing an import that already has a status', () => {
  // The regression this guards. On an update the object already exists and its
  // status is already settled, so the first read returns the state from BEFORE
  // the edit. Taken as the answer, correcting a broken import reported the
  // failure it had just fixed.
  it('does not take the pre-edit status for the result of the edit', async () => {
    const before = detail('Error', 'could not get secret data from provider');
    const after = detail('Synced');
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);

    const result = await waitForSyncOutcome(getStatus, {
      pollMs: 1,
      timeoutMs: 100,
      ...fakeClock(),
      ignoreUntilChanged: before,
    });

    expect(result?.status).toBe('Synced');
    expect(describeSyncOutcome('my-import', result, 'updated').synced).toBe(true);
  });

  // A status that never moves is not proof the edit worked, and not proof it
  // failed either: external-secrets does not move refreshTime on a failed sync,
  // so a retry that fails identically looks like no retry at all. Saying it has
  // not synced would hide a failure sitting on screen; naming it is true in
  // both cases.
  it('names the unchanged failure instead of hiding it', async () => {
    const before = detail('Error', 'could not get secret data from provider');
    const getStatus = vi.fn().mockResolvedValue(before);

    const result = await waitForSyncOutcome(getStatus, {
      pollMs: 1,
      timeoutMs: 3,
      ...fakeClock(),
      ignoreUntilChanged: before,
    });

    const outcome = describeSyncOutcome('my-import', result, 'updated', before);
    expect(outcome.synced).toBe(false);
    expect(outcome.message).toContain('has not changed');
    expect(outcome.message).toContain('could not get secret data from provider');
  });

  // Creation has no previous status, so nothing is skipped.
  it('still settles immediately when there is no previous status', async () => {
    const getStatus = vi.fn().mockResolvedValue(detail('Synced'));
    const result = await waitForSyncOutcome(getStatus, { pollMs: 1, timeoutMs: 100, ...fakeClock() });
    expect(result?.status).toBe('Synced');
    expect(getStatus).toHaveBeenCalledTimes(1);
  });

  // A failing read is not a verdict, so a status already seen must survive it.
  it('keeps the last status it managed to read', async () => {
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce(detail('Pending'))
      .mockRejectedValue(new Error('network'));

    const result = await waitForSyncOutcome(getStatus, { pollMs: 1, timeoutMs: 4, ...fakeClock() });
    expect(result?.status).toBe('Pending');
  });
});

describe('describeSyncOutcome, wording and punctuation', () => {
  it('says updated for an update and created for a creation', () => {
    expect(describeSyncOutcome('x', detail('Synced'), 'updated').message).toContain('updated');
    expect(describeSyncOutcome('x', detail('Synced'), 'updated').message).not.toContain('created');
    expect(describeSyncOutcome('x', detail('Error', 'e'), 'updated').message).toContain('was updated');
  });

  // The controller's message sometimes ends with a period of its own.
  it('does not double the punctuation after the controller message', () => {
    const m = describeSyncOutcome('x', detail('Error', 'connection timed out.'), 'created').message;
    expect(m).not.toContain('..');
    expect(m).toContain('connection timed out. Check');
  });
});

describe('waitForSyncOutcome, a reconcile that repeats the same message', () => {
  // Error(old) then Pending then Error(new) with the same wording: the second
  // Error is indistinguishable from the first by content, so comparing it to
  // the pre-edit status ignored a reconcile that really happened, and the wait
  // reported nothing at all.
  it('reports the new failure once a transition has been seen', async () => {
    const before = detail('Error', 'could not get secret data from provider');
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(detail('Pending'))
      .mockResolvedValueOnce(detail('Error', 'could not get secret data from provider'));

    const result = await waitForSyncOutcome(getStatus, {
      pollMs: 1,
      timeoutMs: 100,
      ...fakeClock(),
      ignoreUntilChanged: before,
    });

    expect(result?.status).toBe('Error');
    const outcome = describeSyncOutcome('my-import', result, 'updated');
    expect(outcome.settled).toBe(true);
    expect(outcome.synced).toBe(false);
  });

  // A transition through Pending that ends in success is reported too.
  it('reports a success reached after a transition', async () => {
    const before = detail('Error', 'boom');
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(detail('Pending'))
      .mockResolvedValueOnce(detail('Synced'));

    const result = await waitForSyncOutcome(getStatus, {
      pollMs: 1,
      timeoutMs: 100,
      ...fakeClock(),
      ignoreUntilChanged: before,
    });
    expect(describeSyncOutcome('my-import', result, 'updated').synced).toBe(true);
  });

  // statusMoved is what tells the caller the difference, so it must say false
  // for a status that never budged and true as soon as anything differs.
  it('reports whether the status ever moved', async () => {
    const before = detail('Error', 'boom');
    expect(statusMoved(before, before)).toBe(false);
    expect(statusMoved(detail('Synced'), before)).toBe(true);
    expect(statusMoved(null, before)).toBe(false);
    expect(statusMoved(before, null)).toBe(true);
  });
});

describe('describeSyncOutcome, an unchanged status is never a confirmation', () => {
  // Editing an import that was already Synced: if the controller has not
  // reached the new generation within the wait, the status read back is the one
  // from before the write. Reporting "updated and synced" claimed a success
  // nobody observed.
  it('does not call an unchanged Synced a success', () => {
    const before = detail('Synced');
    const o = describeSyncOutcome('my-import', before, 'updated', before);
    expect(o.synced).toBe(false);
    expect(o.settled).toBe(false);
    expect(o.message).not.toContain('and synced');
  });

  // A status that did move to Synced is a real confirmation.
  it('confirms a Synced that differs from the one before', () => {
    const before = detail('Error', 'boom');
    const o = describeSyncOutcome('my-import', detail('Synced'), 'updated', before);
    expect(o.synced).toBe(true);
    expect(o.message).toContain('and synced');
  });

  // With no previous status there is nothing to compare, so a creation still
  // reports its own result.
  it('still confirms a creation, which has no previous status', () => {
    expect(describeSyncOutcome('my-import', detail('Synced'), 'created').synced).toBe(true);
  });

  it('still names an unchanged failure', () => {
    const before = detail('Error', 'could not get secret data');
    const o = describeSyncOutcome('my-import', before, 'updated', before);
    expect(o.synced).toBe(false);
    expect(o.message).toContain('has not changed');
  });
});

describe('waitForSyncOutcome, what the wait costs', () => {
  // The regression this guards. The wait counted attempts, so the reads were
  // free: ten of them at one second each plus nine pauses of 1.5s came to 23.5s
  // for a figure that announced 15, and 33.5s at two seconds of latency.
  it('bounds itself on the clock, reads included', async () => {
    let t = 0;
    const latencyMs = 1000;
    const getStatus = vi.fn().mockImplementation(() => {
      t += latencyMs;
      return Promise.resolve(detail('Pending'));
    });

    await waitForSyncOutcome(getStatus, {
      pollMs: 1500,
      timeoutMs: 15000,
      now: () => t,
      sleep: (ms: number) => {
        t += ms;
        return Promise.resolve();
      },
    });

    // No read starts past the deadline, so the wait overruns by at most the one
    // already in flight when it arrives.
    expect(t).toBeLessThanOrEqual(15000 + latencyMs);
  });

  // A read that fails for a reason of its own reads on screen exactly like an
  // import that has not synced yet, so it must not go by in silence.
  it('does not swallow a failing read without a word', async () => {
    const getStatus = vi.fn().mockRejectedValue(new TypeError('getStatus is not a function'));

    const result = await waitForSyncOutcome(getStatus, { pollMs: 1, timeoutMs: 1, ...fakeClock() });

    expect(result).toBeNull();
    expect(warned).toHaveBeenCalled();
    expect(warned.mock.calls[0][1]).toBeInstanceOf(TypeError);
  });
});

describe('describeSyncOutcome, the pre-edit status could not be read', () => {
  // The pre-write read fails, the first read after the write returns the
  // pre-edit Synced, and nothing tells the two apart. Claiming success here is
  // the false green this module exists to remove.
  it('never claims success on an edit with no status to compare against', () => {
    const o = describeSyncOutcome('my-import', detail('Synced'), 'updated', 'unread');
    expect(o.synced).toBe(false);
    expect(o.settled).toBe(false);
    expect(o.message).not.toContain('and synced');
    expect(o.message).toContain('could not be read');
  });

  it('does not blame the import for a pre-edit failure either', () => {
    const o = describeSyncOutcome('my-import', detail('Error', 'old failure'), 'updated', 'unread');
    expect(o.synced).toBe(false);
    expect(o.message).not.toContain('old failure');
  });

  it('a creation still reports its own result', () => {
    expect(describeSyncOutcome('my-import', detail('Synced'), 'created', null).synced).toBe(true);
  });
});
