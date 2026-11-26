import { describe, expect, it } from 'vitest';
import type { ServiceDeleteAnswer, ServiceWriteResult } from '../../../core/models/service.model';
import { HttpError } from '../../../core/api/http';
import {
  acceptedDeletionDetail,
  classifyDelete,
  classifyWrite,
  classifyWriteError,
  NAME_TAKEN_DETAIL,
} from './write-outcome';

function instance(extra: Partial<ServiceWriteResult> = {}): ServiceWriteResult {
  return {
    name: 'lake',
    releaseName: 'lake',
    service: 'trino',
    serviceTag: '1.0.0',
    status: 'Installing',
    targetNamespace: 'team-a',
    parameters: {},
    ...extra,
  };
}

describe('classifyWrite', () => {
  it('reads an answer without operation as an accepted write', () => {
    expect(classifyWrite(instance())).toEqual({ kind: 'accepted' });
    expect(classifyWrite(undefined)).toEqual({ kind: 'accepted' });
  });

  it('reads an accepted operation as accepted, whatever revision the instance carries', () => {
    const result = instance({ desiredRevision: '4', operation: { outcome: 'accepted' } });
    expect(classifyWrite(result)).toEqual({ kind: 'accepted' });
  });

  it('turns a rejected operation into an error with its problems', () => {
    const result = instance({
      operation: {
        outcome: 'rejected',
        problems: [
          { code: 'invalid-parameters', field: 'replicas', message: 'must be positive' },
          { code: 'rejected', message: 'does not compile' },
        ],
      },
    });
    expect(classifyWrite(result)).toEqual({
      kind: 'rejected',
      message: 'replicas: must be positive\ndoes not compile',
    });
    expect(classifyWrite(instance({ operation: { outcome: 'rejected' } }))).toEqual({
      kind: 'rejected',
      message: 'The deployment engine refused the change.',
    });
  });

  it('asks for a reread on an unknown outcome', () => {
    expect(classifyWrite(instance({ operation: { outcome: 'unknown' } }))).toEqual({
      kind: 'unknown',
    });
  });
});

function httpError(status: number, body: unknown): HttpError {
  return new HttpError(
    status,
    'x',
    typeof body === 'string' ? body : JSON.stringify(body),
    '/api/projects/team-a/services',
  );
}

describe('classifyWriteError', () => {
  it('shows the readable server text for a taken name, not the raw engine error', () => {
    const err = httpError(409, {
      error: "Instance 'ui1' already exists in project 'pe-demo'",
      code: 'instance-exists',
      operation: {
        outcome: 'rejected',
        desiredRevision: '',
        problems: [
          {
            code: 'instance-exists',
            message: 'releases.kubocd.kubotal.io "pe-demo-ui1" already exists',
          },
        ],
      },
    });
    expect(classifyWriteError(err)).toEqual({
      kind: 'rejected',
      message: "Instance 'ui1' already exists in project 'pe-demo'",
    });
  });

  it('says the name is taken when the body has no error text', () => {
    const err = httpError(409, {
      operation: {
        outcome: 'rejected',
        problems: [{ code: 'already-exists', message: 'raw engine text' }],
      },
    });
    expect(classifyWriteError(err)).toEqual({ kind: 'rejected', message: NAME_TAKEN_DETAIL });
  });

  it('classifies a stale If-Match as a conflict', () => {
    const err = httpError(409, {
      error: 'instance "lake" changed since revision 3',
      code: 'conflict',
      operation: {
        outcome: 'rejected',
        problems: [{ code: 'conflict', message: 'instance "lake" changed since revision 3' }],
      },
    });
    expect(classifyWriteError(err)).toEqual({ kind: 'conflict' });
  });

  it('classifies a conflict from its problem code alone', () => {
    const err = httpError(409, {
      error: 'stale',
      operation: { outcome: 'rejected', problems: [{ code: 'conflict', message: 'stale' }] },
    });
    expect(classifyWriteError(err)).toEqual({ kind: 'conflict' });
  });

  it('classifies a conflict coded without an operation', () => {
    expect(classifyWriteError(httpError(409, { error: 'stale', code: 'conflict' }))).toEqual({
      kind: 'conflict',
    });
  });

  it('keeps a taken name a rejection, not a conflict, though both are 409', () => {
    const err = httpError(409, {
      error: "Instance 'lake' already exists in project 'team-a'",
      code: 'instance-exists',
      operation: { outcome: 'rejected', problems: [{ code: 'instance-exists', message: 'raw' }] },
    });
    expect(classifyWriteError(err)?.kind).toBe('rejected');
  });

  it('treats a gateway timeout as an unknown outcome', () => {
    expect(classifyWriteError(new HttpError(504, 'Gateway Timeout', '', '/x'))).toEqual({
      kind: 'unknown',
    });
    expect(
      classifyWriteError(new HttpError(504, 'Gateway Timeout', '<html>timeout</html>', '/x')),
    ).toEqual({ kind: 'unknown' });
  });

  it('leaves a 502 or a network failure to the generic error', () => {
    expect(classifyWriteError(new HttpError(502, 'Bad Gateway', '', '/x'))).toBeNull();
    expect(classifyWriteError(new TypeError('Failed to fetch'))).toBeNull();
  });

  it('lists the fields of a schema refusal', () => {
    const err = httpError(500, {
      error: 'invalid parameters',
      code: 'invalid-parameters',
      operation: {
        outcome: 'rejected',
        problems: [
          { code: 'invalid-parameters', field: 'replicas', message: 'must be >= 1' },
          { code: 'invalid-parameters', field: 'memory', message: 'must match a quantity' },
        ],
      },
    });
    expect(classifyWriteError(err)).toEqual({
      kind: 'rejected',
      message: 'replicas: must be >= 1\nmemory: must match a quantity',
    });
  });

  it('reads a rejected write from a 500 body too', () => {
    const err = httpError(500, {
      error: 'refused',
      code: 'rejected',
      operation: { outcome: 'rejected', problems: [{ field: 'replicas', message: 'too many' }] },
    });
    expect(classifyWriteError(err)).toEqual({ kind: 'rejected', message: 'replicas: too many' });
  });

  it('falls back to the operation message, then to the error text', () => {
    expect(
      classifyWriteError(
        httpError(409, { error: 'e', operation: { outcome: 'rejected', message: 'op says no' } }),
      ),
    ).toEqual({ kind: 'rejected', message: 'op says no' });
    expect(
      classifyWriteError(
        httpError(409, { error: 'e says no', operation: { outcome: 'rejected' } }),
      ),
    ).toEqual({ kind: 'rejected', message: 'e says no' });
  });

  it('reads an unknown outcome from a 500 body', () => {
    const err = httpError(500, {
      error: 'push timed out',
      code: 'outcome-unknown',
      operation: { outcome: 'unknown', desiredRevision: '' },
    });
    expect(classifyWriteError(err)).toEqual({ kind: 'unknown' });
  });

  it('says nothing for errors without an operation, from older servers or ordinary failures', () => {
    expect(classifyWriteError(httpError(500, { error: 'boom' }))).toBeNull();
    expect(
      classifyWriteError(httpError(500, { error: 'boom', code: 'invalid-parameters' })),
    ).toBeNull();
    expect(classifyWriteError(httpError(502, '<html>bad gateway</html>'))).toBeNull();
    expect(classifyWriteError(httpError(500, ''))).toBeNull();
    expect(classifyWriteError(new Error('network'))).toBeNull();
  });

  it('tolerates malformed JSON shapes', () => {
    expect(classifyWriteError(httpError(500, 'null'))).toBeNull();
    expect(classifyWriteError(httpError(500, { operation: 'rejected' }))).toBeNull();
    expect(classifyWriteError(httpError(500, { operation: { outcome: 'accepted' } }))).toBeNull();
    expect(
      classifyWriteError(
        httpError(409, { operation: { outcome: 'rejected', problems: [null, 3, { message: 7 }] } }),
      ),
    ).toEqual({ kind: 'rejected', message: 'The deployment engine refused the change.' });
    expect(
      classifyWriteError(httpError(409, { operation: { outcome: 'rejected', problems: 'nope' } })),
    ).toEqual({ kind: 'rejected', message: 'The deployment engine refused the change.' });
  });
});

describe('classifyDelete', () => {
  const answer = (status: number, result?: unknown) =>
    (result === undefined ? { status } : { status, result }) as ServiceDeleteAnswer;
  const accepted = { operation: { outcome: 'accepted' } };

  it('reads a 204 as a deletion done', () => {
    expect(classifyDelete(answer(204))).toEqual({ kind: 'deleted' });
    expect(classifyDelete(undefined)).toEqual({ kind: 'deleted' });
  });

  it('reads a 200 as a deletion done, accepted operation or not', () => {
    expect(classifyDelete(answer(200, instance()))).toEqual({ kind: 'deleted' });
    expect(classifyDelete(answer(200, accepted))).toEqual({ kind: 'deleted' });
  });

  it('reads a 202 with an accepted operation as an asynchronous deletion', () => {
    expect(classifyDelete(answer(202, accepted))).toEqual({ kind: 'accepted' });
    expect(classifyDelete(answer(202, instance({ operation: { outcome: 'accepted' } })))).toEqual({
      kind: 'accepted',
    });
  });

  it('never reads a 202 without an accepted operation as done', () => {
    expect(classifyDelete(answer(202))).toEqual({ kind: 'unknown' });
    expect(classifyDelete(answer(202, instance()))).toEqual({ kind: 'unknown' });
    expect(classifyDelete(answer(202, { operation: 'accepted' }))).toEqual({ kind: 'unknown' });
    expect(classifyDelete(answer(202, { operation: {} }))).toEqual({ kind: 'unknown' });
  });

  it('passes an unknown, rejected or conflicting operation through, whatever the status', () => {
    const unknown = { operation: { outcome: 'unknown' } };
    expect(classifyDelete(answer(200, unknown))).toEqual({ kind: 'unknown' });
    expect(classifyDelete(answer(202, unknown))).toEqual({ kind: 'unknown' });
    const rejected = { operation: { outcome: 'rejected', problems: [{ message: 'protected' }] } };
    expect(classifyDelete(answer(202, rejected))).toEqual({
      kind: 'rejected',
      message: 'protected',
    });
    const conflict = {
      operation: { outcome: 'rejected', problems: [{ code: 'conflict', message: 'stale' }] },
    };
    expect(classifyDelete(answer(200, conflict))).toEqual({ kind: 'conflict' });
  });

  it('tolerates a malformed operation on a synchronous answer', () => {
    expect(classifyDelete(answer(200, { operation: 'accepted' }))).toEqual({ kind: 'deleted' });
  });

  it('words the toast of an asynchronous deletion without naming any storage', () => {
    expect(acceptedDeletionDetail('lake')).toBe(
      'Deletion of lake requested. It will be removed once reconciled.',
    );
  });
});
