import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceInstance } from '../models/service.model';
import { createDeletionGuard, forgetDeletedInstance, keptDeletions } from './service-deletions';
import { serviceApi } from './service-api';
import { readUiCache, writeUiCache } from './ui-cache';

vi.mock('./service-api', () => ({ serviceApi: { forgetServiceReads: vi.fn() } }));

function instance(name: string): ServiceInstance {
  return {
    name,
    releaseName: name,
    service: 'trino',
    serviceTag: '0.1.0',
    status: 'Ready',
    targetNamespace: 'team-a',
    parameters: {},
  };
}

describe('createDeletionGuard', () => {
  it('drops from a read the instances deleted after it started', () => {
    const guard = createDeletionGuard('guard-a');
    const before = guard.startRead();
    guard.track({ type: 'DELETED', object: instance('lake') });
    const after = guard.startRead();

    const data = [instance('lake'), instance('sea')];
    expect(before.reconcile(data).map((s) => s.name)).toEqual(['sea']);
    expect(after.reconcile(data).map((s) => s.name)).toEqual(['lake', 'sea']);
  });

  it('lifts a deletion once its own stream reports the instance again', () => {
    const guard = createDeletionGuard('guard-b');
    const before = guard.startRead();
    guard.track({ type: 'DELETED', object: instance('lake') });
    guard.track({ type: 'ADDED', object: instance('lake') });

    expect(before.reconcile([instance('lake')])).toHaveLength(1);
  });

  it('keeps a deletion when only another, late stream reports the instance', () => {
    const screenA = createDeletionGuard('guard-c');
    const screenB = createDeletionGuard('guard-c');
    const readA = screenA.startRead();
    const readB = screenB.startRead();

    screenA.track({ type: 'DELETED', object: instance('lake') });
    // Stream B is behind: its MODIFIED predates the deletion.
    screenB.track({ type: 'MODIFIED', object: instance('lake') });

    expect(readA.reconcile([instance('lake'), instance('sea')]).map((s) => s.name)).toEqual([
      'sea',
    ]);
    readB.release();
  });
});

describe('deletions shared across a project', () => {
  it('protects every read of the project from a deletion another screen confirmed', () => {
    const read = createDeletionGuard('shared-a').startRead();

    forgetDeletedInstance('shared-a', 'lake');

    expect(read.reconcile([instance('lake'), instance('sea')]).map((s) => s.name)).toEqual(['sea']);
  });

  it('leaves the same name in another project alone', () => {
    const read = createDeletionGuard('shared-b').startRead();

    forgetDeletedInstance('shared-c', 'lake');

    expect(read.reconcile([instance('lake')])).toHaveLength(1);
  });

  it('keeps a deletion only while a read started before it is in flight', () => {
    const guard = createDeletionGuard('shared-d');
    const landing = guard.startRead();
    const failing = guard.startRead();
    forgetDeletedInstance('shared-d', 'lake');
    guard.track({ type: 'DELETED', object: instance('pond') });
    expect(keptDeletions()).toBe(2);

    landing.reconcile([]);
    expect(keptDeletions()).toBe(2);
    failing.release();
    expect(keptDeletions()).toBe(0);

    forgetDeletedInstance('shared-d', 'reed');
    expect(keptDeletions()).toBe(0);
  });
});

describe('forgetDeletedInstance', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forgets the cached reads of the project and drops the instance from its snapshot', () => {
    writeUiCache('services:forget-a', [instance('lake'), instance('sea')]);
    writeUiCache('services:forget-b', [instance('lake')]);

    forgetDeletedInstance('forget-a', 'lake');

    expect(serviceApi.forgetServiceReads).toHaveBeenCalledWith('forget-a');
    expect(readUiCache<ServiceInstance[]>('services:forget-a')?.map((s) => s.name)).toEqual([
      'sea',
    ]);
    expect(readUiCache<ServiceInstance[]>('services:forget-b')).toHaveLength(1);
  });
});
