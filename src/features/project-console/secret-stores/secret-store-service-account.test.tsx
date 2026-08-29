import { describe, it, expect } from 'vitest';
import { buildStoreRequest, EMPTY_FORM, type StoreForm } from './store-request';

/**
 * Exercises the real mapping the dialog uses, so removing a field from
 * buildStoreRequest fails here instead of shipping.
 */
const KUBERNETES: StoreForm = {
  ...EMPTY_FORM,
  storeName: 'store',
  vaultServer: 'https://vault.example.com:8200',
  vaultPath: 'secret',
  authType: 'kubernetes',
  authMountPath: 'kubernetes',
  authRole: 'demo-role',
};

describe('buildStoreRequest, kubernetes auth', () => {
  // Vault matches the role's bound_service_account_names against this account,
  // so a project must be able to name one instead of borrowing the namespace
  // default that every workload already shares.
  it('sends the chosen ServiceAccount', () => {
    const request = buildStoreRequest({ ...KUBERNETES, authServiceAccount: 'vault-reader' });
    expect(request.auth.config.serviceAccount).toBe('vault-reader');
  });

  // An emptied field must travel as an empty string, not vanish. The server
  // reads an absent account as "keep the stored one", so dropping it would make
  // the default unreachable: a store given its own identity could never be
  // handed back to the namespace default.
  it('sends an empty ServiceAccount rather than dropping it', () => {
    const request = buildStoreRequest(KUBERNETES);
    expect(request.auth.config.serviceAccount).toBe('');
    expect(JSON.parse(JSON.stringify(request)).auth.config).toHaveProperty('serviceAccount', '');
  });

  // The role and mount path belong to this method and must reach the server.
  it('carries the role and mount path', () => {
    const request = buildStoreRequest(KUBERNETES);
    expect(request.auth.config.role).toBe('demo-role');
    expect(request.auth.config.mountPath).toBe('kubernetes');
    expect(request.auth.config.token).toBeUndefined();
  });
});

describe('buildStoreRequest, token auth', () => {
  const TOKEN: StoreForm = {
    ...EMPTY_FORM,
    storeName: 'store',
    vaultServer: 'https://vault.example.com:8200',
    vaultPath: 'secret',
    authType: 'token',
    authToken: 'hvs.example',
  };

  // Token auth has no service account to report; sending one would describe an
  // identity Vault never sees.
  it('never sends kubernetes fields', () => {
    const request = buildStoreRequest({
      ...TOKEN,
      authServiceAccount: 'vault-reader',
      authRole: 'demo-role',
      authMountPath: 'kubernetes',
    });
    expect(request.auth.config.serviceAccount).toBeUndefined();
    expect(request.auth.config.role).toBeUndefined();
    expect(request.auth.config.mountPath).toBeUndefined();
    expect(request.auth.config.token).toBe('hvs.example');
  });

  // An empty CA must be omitted so the server falls back to the system roots,
  // rather than being handed a blank bundle to parse.
  it('omits an empty CA bundle', () => {
    const request = buildStoreRequest(TOKEN);
    expect(request.vault.caBundle).toBeUndefined();
  });
});
