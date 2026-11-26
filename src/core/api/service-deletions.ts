import type { ServiceEvent, ServiceInstance } from '../models/service.model';
import { serviceApi } from './service-api';
import { readUiCache, writeUiCache } from './ui-cache';

// Deletions seen in this tab, shared by every list of a project: a deletion
// one screen learns about protects the reads of the others. Each entry keeps
// the sequence number of its deletion, and lives only while a read started
// before it is still in flight.
let seq = 0;
let nextReadId = 0;
const deletedAt = new Map<string, number>();
const openReads = new Map<number, number>();
const entry = (projectId: string, name: string) => `${projectId}\n${name}`;

function recordDeletion(projectId: string, name: string): void {
  seq += 1;
  deletedAt.set(entry(projectId, name), seq);
  prune();
}

/** Removes deletion records once no pending read predates them. */
function prune(): void {
  let oldest = Infinity;
  for (const startedAt of openReads.values()) oldest = Math.min(oldest, startedAt);
  for (const [key, at] of deletedAt) {
    if (at <= oldest) deletedAt.delete(key);
  }
}

/** Number of deletions kept. Exposed for tests. */
export function keptDeletions(): number {
  return deletedAt.size;
}

/** One list read in flight. */
export interface GuardedRead {
  /** What the read may show once it lands. Ends the read. */
  reconcile(data: ServiceInstance[]): ServiceInstance[];
  /** Ends a read that will not land (failed or abandoned). */
  release(): void;
}

/** Keeps the instances deleted after a list read started out of that read:
 *  such a read may land after the deletion and would bring the instance
 *  back. */
export interface DeletionGuard {
  startRead(): GuardedRead;
  /** Follows one event of this screen's stream. An ADDED or MODIFIED after a
   *  deletion lifts it for this screen only: another stream may be late. */
  track(event: ServiceEvent): void;
}

export function createDeletionGuard(projectId: string): DeletionGuard {
  // Instances this screen's stream reported again after their deletion.
  const seenAt = new Map<string, number>();
  const kept = (name: string, startedAt: number) => {
    const deleted = deletedAt.get(entry(projectId, name));
    return deleted === undefined || deleted <= startedAt || (seenAt.get(name) ?? 0) > deleted;
  };
  return {
    startRead() {
      const id = (nextReadId += 1);
      const startedAt = seq;
      openReads.set(id, startedAt);
      const release = () => {
        if (openReads.delete(id)) prune();
      };
      return {
        reconcile(data) {
          const shown = data.filter((s) => kept(s.name, startedAt));
          release();
          return shown;
        },
        release,
      };
    },
    track(event) {
      if (event.type === 'DELETED') {
        seenAt.delete(event.object.name);
        recordDeletion(projectId, event.object.name);
      } else {
        seq += 1;
        seenAt.set(event.object.name, seq);
      }
    },
  };
}

/** Forgets a deleted instance everywhere a later read could show it from: the
 *  reads of its project still in flight, its cached GET answers and the list
 *  snapshot pages paint first. */
export function forgetDeletedInstance(projectId: string, name: string): void {
  recordDeletion(projectId, name);
  serviceApi.forgetServiceReads(projectId);
  const key = `services:${projectId}`;
  const cached = readUiCache<ServiceInstance[]>(key);
  if (cached?.some((s) => s.name === name)) {
    writeUiCache(
      key,
      cached.filter((s) => s.name !== name),
    );
  }
}
