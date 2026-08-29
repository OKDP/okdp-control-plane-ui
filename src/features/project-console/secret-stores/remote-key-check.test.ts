import { describe, it, expect } from 'vitest';
import {
  describeCheck,
  describeCheckFailure,
  applyCheckResults,
  groupByRemoteRef,
  CHECKING,
  type CheckDisplay,
} from './remote-key-check';

describe('describeCheck', () => {
  it('reads a key that is there as found, with its property names', () => {
    const d = describeCheck({
      verifiable: true,
      found: true,
      properties: ['api_token', 'db_password'],
      message: 'key "client-externe" found, 2 propertie(s)',
    });
    expect(d.tone).toBe('found');
    expect(d.properties).toEqual(['api_token', 'db_password']);
  });

  it('reads a key that is not there as absent', () => {
    const d = describeCheck({
      verifiable: true,
      found: false,
      message: 'no key "nexistepas" under mount "secret"',
    });
    expect(d.tone).toBe('absent');
    expect(d.message).toContain('nexistepas');
  });

  // The whole point of carrying a third state: a store the control plane cannot
  // question says nothing about the key. Folding this into found or absent puts
  // a verdict on screen that nobody established.
  it('never turns an unverifiable answer into a verdict', () => {
    const d = describeCheck({
      verifiable: false,
      found: false,
      message: 'this store authenticates with the Kubernetes method',
    });
    expect(d.tone).toBe('unknown');
    expect(d.tone).not.toBe('absent');
  });

  // An unverifiable answer still reports found:false on the wire; the tone must
  // come from verifiable, not from found.
  it('ignores found when the answer is not verifiable', () => {
    expect(describeCheck({ verifiable: false, found: true, message: '' }).tone).toBe('unknown');
  });

  it('copes with a response carrying no properties', () => {
    expect(describeCheck({ verifiable: true, found: true, message: '' }).properties).toEqual([]);
  });
});

describe('describeCheckFailure', () => {
  // A refused request is not a missing key either.
  it('reads a failed request as unknown, not as absent', () => {
    const d = describeCheckFailure('The key could not be checked');
    expect(d.tone).toBe('unknown');
    expect(d.message).toBe('The key could not be checked');
  });
});

describe('applyCheckResults', () => {
  const found: CheckDisplay = { tone: 'found', message: 'ok', properties: [] };

  it('fills in the rows that were waiting', () => {
    const next = applyCheckResults({ 0: CHECKING, 1: CHECKING }, [{ indexes: [0, 1], display: found }]);
    expect(next[0]).toBe(found);
    expect(next[1]).toBe(found);
  });

  // The race this guards. A row edited while the requests are in flight has its
  // entry deleted by patchMapping; the answer that lands afterwards describes a
  // value that no longer exists and must not be put back.
  it('does not restore a result for a row edited mid-flight', () => {
    const next = applyCheckResults({ 1: CHECKING }, [{ indexes: [0, 1], display: found }]);
    expect(next[0]).toBeUndefined();
    expect(next[1]).toBe(found);
  });

  // A row that already carries a settled answer was re-marked or re-edited, so
  // an older in-flight answer must not overwrite it either.
  it('leaves a row that already holds a settled answer alone', () => {
    const older: CheckDisplay = { tone: 'absent', message: 'stale', properties: [] };
    const next = applyCheckResults({ 0: older }, [{ indexes: [0], display: found }]);
    expect(next[0]).toBe(older);
  });

  it('leaves the input untouched', () => {
    const current = { 0: CHECKING };
    applyCheckResults(current, [{ indexes: [0], display: found }]);
    expect(current[0]).toBe(CHECKING);
  });
});

describe('groupByRemoteRef', () => {
  // Each request costs the server a credentials read and a Vault round trip,
  // so rows asking the same question ask it once.
  it('asks once for rows sharing a remote reference', () => {
    const groups = groupByRemoteRef([
      { index: 0, key: 'app/db', property: 'password' },
      { index: 1, key: 'app/db', property: 'password' },
      { index: 2, key: 'app/api' },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].indexes).toEqual([0, 1]);
    expect(groups[1].indexes).toEqual([2]);
  });

  // The same key with different properties is a different question.
  it('keeps a different property apart', () => {
    const groups = groupByRemoteRef([
      { index: 0, key: 'app/db', property: 'password' },
      { index: 1, key: 'app/db', property: 'user' },
    ]);
    expect(groups).toHaveLength(2);
  });

  // A key that happens to contain the separator must not collide with another.
  it('does not merge keys that differ only around the separator', () => {
    const groups = groupByRemoteRef([
      { index: 0, key: 'a', property: 'b' },
      { index: 1, key: 'a b' },
    ]);
    expect(groups).toHaveLength(2);
  });
});
