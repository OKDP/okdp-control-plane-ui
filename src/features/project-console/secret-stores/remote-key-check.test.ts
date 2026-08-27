import { describe, it, expect } from 'vitest';
import { describeCheck, describeCheckFailure } from './remote-key-check';

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
