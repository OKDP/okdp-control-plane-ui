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
