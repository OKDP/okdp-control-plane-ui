import { describe, expect, it } from 'vitest';
import { clearUiCache, readUiCache, writeUiCache } from './ui-cache';

describe('ui-cache', () => {
  it('clears all cached entries on clearUiCache', () => {
    writeUiCache('services:team-a', ['lake']);
    writeUiCache('metrics:team-a', { cpu: 1 });
    expect(readUiCache<string[]>('services:team-a')).toEqual(['lake']);

    clearUiCache();

    expect(readUiCache('services:team-a')).toBeUndefined();
    expect(readUiCache('metrics:team-a')).toBeUndefined();
  });
});
