import type { ServiceDeleteAnswer, ServiceWriteResult } from '../../../core/models/service.model';
import { HttpError } from '../../../core/api/http';

/** What a page does with the answer to an instance write. */
export type WriteOutcome =
  /** The engine took the write. */
  | { kind: 'accepted' }
  /** The engine refused it: stay on the form and show why. */
  | { kind: 'rejected'; message: string }
  /** The instance moved past the revision the write expected (If-Match): the
   *  page must read it again before another try. */
  | { kind: 'conflict' }
  /** No definite answer: read the instance again before assuming anything. */
  | { kind: 'unknown' };

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/** Codes of a refusal because the instance name is taken. Their problems carry
 *  the engine's raw error, the server's `error` text is the readable one. */
const NAME_TAKEN_CODES = new Set(['instance-exists', 'already-exists']);

export const NAME_TAKEN_DETAIL = 'An instance with this name already exists in this project.';

/** Code of a refusal because the instance moved past the expected revision. */
const CONFLICT_CODE = 'conflict';

export const CONFLICT_DETAIL =
  'This instance changed since it was loaded. Reload it to see its current state, then try again.';

/** The outcome an `operation` object states, if it states one. Tolerates any
 *  JSON: a malformed operation states nothing. `errorText` and `code` come from
 *  the error body around it, when there is one. */
function stated(operation: unknown, errorText?: string, code?: unknown): WriteOutcome | null {
  if (!operation || typeof operation !== 'object') return null;
  const op = operation as Record<string, unknown>;
  if (op.outcome === 'unknown') return { kind: 'unknown' };
  if (op.outcome !== 'rejected') return null;
  const problems = Array.isArray(op.problems) ? op.problems : [];
  const firstCode = (problems[0] as Record<string, unknown> | null | undefined)?.code;
  const refusal = text(code) ?? (typeof firstCode === 'string' ? firstCode : undefined);
  if (refusal === CONFLICT_CODE) return { kind: 'conflict' };
  if (refusal && NAME_TAKEN_CODES.has(refusal)) {
    return { kind: 'rejected', message: errorText ?? NAME_TAKEN_DETAIL };
  }
  const messages = problems
    .map((p) => {
      if (!p || typeof p !== 'object') return undefined;
      const { field, message } = p as Record<string, unknown>;
      const m = text(message);
      return m && text(field) ? `${field}: ${m}` : m;
    })
    .filter((m): m is string => !!m);
  return {
    kind: 'rejected',
    message: messages.length
      ? messages.join('\n')
      : (text(op.message) ?? errorText ?? 'The deployment engine refused the change.'),
  };
}

/** Classifies the 2xx answer to an instance write. A server that predates
 *  pluggable engines sends no `operation`: that is an accepted write. */
export function classifyWrite(result: ServiceWriteResult | null | undefined): WriteOutcome {
  return stated(result?.operation) ?? { kind: 'accepted' };
}

/** Classifies a failed instance write: rejected writes (409 or 500 with
 *  `operation`), revision conflicts (409 with code `conflict`), and unknown
 *  outcomes (504, with or without `operation`). Returns null when the page
 *  should report the error without an operation-specific action. */
export function classifyWriteError(
  err: unknown,
): Exclude<WriteOutcome, { kind: 'accepted' }> | null {
  if (!(err instanceof HttpError)) return null;
  let body: unknown;
  try {
    body = err.body ? JSON.parse(err.body) : undefined;
  } catch {
    body = undefined;
  }
  if (body && typeof body === 'object') {
    const { operation, error, code } = body as Record<string, unknown>;
    if (err.status === 409 && code === CONFLICT_CODE) return { kind: 'conflict' };
    const outcome = stated(operation, text(error), code);
    if (outcome && outcome.kind !== 'accepted') return outcome;
  }
  return err.status === 504 ? { kind: 'unknown' } : null;
}

/** What a page does with the answer to an instance deletion. */
export type DeleteOutcome =
  /** The instance is gone, or going without anything left to wait for. */
  | { kind: 'deleted' }
  /** The engine took the deletion and carries it out asynchronously: the
   *  instance stays shown until the live stream reports it DELETED. */
  | { kind: 'accepted' }
  | { kind: 'rejected'; message: string }
  | { kind: 'conflict' }
  | { kind: 'unknown' };

/** Classifies the 2xx answer to an instance deletion. An operation that says
 *  rejected, conflict or unknown wins. Only a 202 announces an asynchronous
 *  deletion: with an accepted operation it is accepted, without one nothing
 *  can be relied on (unknown). Any other 2xx (204, 200) is a deletion done. */
export function classifyDelete(answer: ServiceDeleteAnswer | null | undefined): DeleteOutcome {
  const operation = answer?.result?.operation;
  const outcome = stated(operation);
  if (outcome && outcome.kind !== 'accepted') return outcome;
  if (answer?.status !== 202) return { kind: 'deleted' };
  return operation && typeof operation === 'object' && operation.outcome === 'accepted'
    ? { kind: 'accepted' }
    : { kind: 'unknown' };
}

/** Toast copy for an accepted asynchronous deletion. */
export function acceptedDeletionDetail(name: string): string {
  return `Deletion of ${name} requested. It will be removed once reconciled.`;
}

export const UNKNOWN_DELETE_DETAIL =
  'The deployment engine did not confirm the deletion. Showing the instance as it stands now.';

export const UNKNOWN_WRITE_DETAIL =
  'The deployment engine did not confirm the change. Showing the instance as it stands now.';
