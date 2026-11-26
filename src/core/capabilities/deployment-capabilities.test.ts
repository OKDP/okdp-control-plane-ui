import { describe, expect, it } from 'vitest';
import type { Capabilities } from '../api/capabilities-api';
import { DEFAULT_ENGINE_CAPABILITY, resolveEngineCapability } from './deployment-capabilities';

const identityOnly: Capabilities = {
  identity: { provider: 'external', userManagement: false },
  oidcProvisioning: { provider: 'none' },
};

function withEngine(extra: Partial<Capabilities>): Capabilities {
  return { ...identityOnly, ...extra };
}

describe('resolveEngineCapability', () => {
  it('falls back to the defaults when the server sends no engine fields', () => {
    expect(resolveEngineCapability(identityOnly)).toEqual({
      renderedValues: false,
      suspend: false,
    });
  });

  it('falls back to the defaults when capabilities are missing', () => {
    expect(resolveEngineCapability(null)).toBe(DEFAULT_ENGINE_CAPABILITY);
    expect(resolveEngineCapability(undefined)).toBe(DEFAULT_ENGINE_CAPABILITY);
  });

  it('reads the engine name and flags', () => {
    expect(
      resolveEngineCapability(
        withEngine({ engine: { name: ' kubocd ', renderedValues: true, suspend: false } }),
      ),
    ).toEqual({ name: 'kubocd', renderedValues: true, suspend: false });
  });

  it('fills a partial engine with the defaults', () => {
    expect(resolveEngineCapability(withEngine({ engine: {} }))).toEqual({
      renderedValues: false,
      suspend: false,
    });
    expect(resolveEngineCapability(withEngine({ engine: { suspend: true } }))).toEqual({
      renderedValues: false,
      suspend: true,
    });
  });

  it('ignores mistyped flags and names', () => {
    expect(
      resolveEngineCapability(
        withEngine({ engine: { name: 42, renderedValues: 'yes', suspend: 1 } }),
      ),
    ).toEqual({ renderedValues: false, suspend: false });
  });

  it('ignores fields other than the engine', () => {
    const caps = {
      ...identityOnly,
      engine: { name: 'kubocd', suspend: true },
      storage: { backend: 'custom', revisionLink: 'https://forge/c/{rev}' },
    } as Capabilities;
    expect(resolveEngineCapability(caps)).toEqual({
      name: 'kubocd',
      renderedValues: false,
      suspend: true,
    });
  });
});
