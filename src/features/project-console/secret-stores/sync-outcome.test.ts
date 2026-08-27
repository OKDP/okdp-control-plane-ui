import { describe, it, expect, vi } from 'vitest';
import { isSettled, describeSyncOutcome, waitForSyncOutcome } from './sync-outcome';
import type { ExternalSecretStatusDetail } from '../../../core/api/external-secret-api';

const detail = (
  status: ExternalSecretStatusDetail['status'],
  lastError?: string,
): ExternalSecretStatusDetail => ({ status, conditions: [], lastError });

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
    const o = describeSyncOutcome('mon-import', detail('Pending'));
    expect(o.settled).toBe(false);
    expect(o.synced).toBe(false);
    expect(o.message).not.toContain('synced.');
  });

  it('does not claim success when the status could not be read at all', () => {
    const o = describeSyncOutcome('mon-import', null);
    expect(o.settled).toBe(false);
    expect(o.synced).toBe(false);
  });

  it('confirms a real sync', () => {
    const o = describeSyncOutcome('mon-import', detail('Synced'));
    expect(o).toMatchObject({ settled: true, synced: true });
    expect(o.message).toContain('created and synced');
  });

  it('reports a failed sync and points at the key', () => {
    const o = describeSyncOutcome('mon-import', detail('Error', 'could not get secret data'));
    expect(o).toMatchObject({ settled: true, synced: false });
    expect(o.message).toContain('could not get secret data');
    expect(o.message).toContain('remote key');
  });

  // The controller does not always fill lastError, and an empty reason must not
  // produce a dangling sentence.
  it('still reports a failure with no reason attached', () => {
    for (const empty of [undefined, '', '   ']) {
      const o = describeSyncOutcome('mon-import', detail('Error', empty));
      expect(o.synced).toBe(false);
      expect(o.message).not.toContain('::');
      expect(o.message.trim().endsWith('.')).toBe(true);
    }
  });
});

describe('waitForSyncOutcome', () => {
  const noSleep = () => Promise.resolve();

  it('stops as soon as the status settles', async () => {
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce(detail('Pending'))
      .mockResolvedValueOnce(detail('Synced'));

    const result = await waitForSyncOutcome(getStatus, {
      pollMs: 1,
      timeoutMs: 100,
      sleep: noSleep,
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
      sleep: noSleep,
    });

    expect(result?.status).toBe('Pending');
    expect(getStatus).toHaveBeenCalledTimes(3);
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
      sleep: noSleep,
    });

    expect(result?.status).toBe('Synced');
  });

  it('reports nothing rather than a verdict when every read fails', async () => {
    const getStatus = vi.fn().mockRejectedValue(new Error('boom'));

    const result = await waitForSyncOutcome(getStatus, {
      pollMs: 1,
      timeoutMs: 3,
      sleep: noSleep,
    });

    expect(result).toBeNull();
    expect(describeSyncOutcome('mon-import', result).synced).toBe(false);
  });

  it('always asks at least once, whatever the timings say', async () => {
    const getStatus = vi.fn().mockResolvedValue(detail('Pending'));
    await waitForSyncOutcome(getStatus, { pollMs: 100, timeoutMs: 0, sleep: noSleep });
    expect(getStatus).toHaveBeenCalledTimes(1);
  });
});

describe('waitForSyncOutcome, editing an import that already has a status', () => {
  const noSleep = () => Promise.resolve();

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
      sleep: noSleep,
      ignoreUntilChanged: before,
    });

    expect(result?.status).toBe('Synced');
    expect(describeSyncOutcome('my-import', result, 'updated').synced).toBe(true);
  });

  // A status that never moves must not be reported as the edit's outcome
  // either: unsettled is the honest answer, and the row carries the rest.
  it('reports nothing settled when the status never moves', async () => {
    const before = detail('Error', 'boom');
    const getStatus = vi.fn().mockResolvedValue(before);

    const result = await waitForSyncOutcome(getStatus, {
      pollMs: 1,
      timeoutMs: 3,
      sleep: noSleep,
      ignoreUntilChanged: before,
    });

    expect(describeSyncOutcome('my-import', result, 'updated').settled).toBe(false);
  });

  // Creation has no previous status, so nothing is skipped.
  it('still settles immediately when there is no previous status', async () => {
    const getStatus = vi.fn().mockResolvedValue(detail('Synced'));
    const result = await waitForSyncOutcome(getStatus, { pollMs: 1, timeoutMs: 100, sleep: noSleep });
    expect(result?.status).toBe('Synced');
    expect(getStatus).toHaveBeenCalledTimes(1);
  });

  // A failing read is not a verdict, so a status already seen must survive it.
  it('keeps the last status it managed to read', async () => {
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce(detail('Pending'))
      .mockRejectedValue(new Error('network'));

    const result = await waitForSyncOutcome(getStatus, { pollMs: 1, timeoutMs: 4, sleep: noSleep });
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
  const noSleep = () => Promise.resolve();

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
      sleep: noSleep,
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
      sleep: noSleep,
      ignoreUntilChanged: before,
    });
    expect(describeSyncOutcome('my-import', result, 'updated').synced).toBe(true);
  });

  // Nothing moving at all still reports nothing, so a status untouched by the
  // edit is never presented as its result.
  it('still reports nothing when the status never moves', async () => {
    const before = detail('Error', 'boom');
    const getStatus = vi.fn().mockResolvedValue(before);

    const result = await waitForSyncOutcome(getStatus, {
      pollMs: 1,
      timeoutMs: 3,
      sleep: noSleep,
      ignoreUntilChanged: before,
    });
    expect(result).toBeNull();
  });
});
