import { describe, it, expect } from 'vitest';
import type { SecretStoreRequest, VaultAuthType } from '../../../core/api/secret-store-api';

/**
 * Mirrors the request the form builds, so the mapping is covered without
 * mounting the whole dialog. The list component keeps the shape inline; this
 * pins the part that decides which identity Vault sees.
 */
function buildAuthConfig(form: {
  authType: VaultAuthType;
  authToken: string;
  authMountPath: string;
  authRole: string;
  authServiceAccount: string;
}): SecretStoreRequest['auth'] {
  return {
    type: form.authType,
    config: {
      token: form.authType === 'token' ? form.authToken : undefined,
      mountPath: form.authType === 'kubernetes' ? form.authMountPath || undefined : undefined,
      role: form.authType === 'kubernetes' ? form.authRole || undefined : undefined,
      serviceAccount:
        form.authType === 'kubernetes' ? form.authServiceAccount || undefined : undefined,
    },
  };
}

const KUBERNETES = {
  authType: 'kubernetes' as VaultAuthType,
  authToken: '',
  authMountPath: 'kubernetes',
  authRole: 'demo-role',
  authServiceAccount: '',
};

describe('secret store kubernetes auth', () => {
  // Vault matches the role's bound_service_account_names against this account,
  // so a project must be able to name one instead of borrowing the namespace
  // default that every workload already shares.
  it('sends the chosen ServiceAccount', () => {
    const auth = buildAuthConfig({ ...KUBERNETES, authServiceAccount: 'vault-reader' });
    expect(auth.config.serviceAccount).toBe('vault-reader');
  });

  // Empty must stay absent rather than travel as an empty string, so the server
  // applies its own fallback and stores created before the field are unaffected.
  it('omits the ServiceAccount when left empty', () => {
    const auth = buildAuthConfig(KUBERNETES);
    expect(auth.config.serviceAccount).toBeUndefined();
  });

  // Token auth has no service account to report; sending one would describe an
  // identity Vault never sees.
  it('never sends a ServiceAccount for token auth', () => {
    const auth = buildAuthConfig({
      authType: 'token',
      authToken: 'hvs.example',
      authMountPath: '',
      authRole: '',
      authServiceAccount: 'vault-reader',
    });
    expect(auth.config.serviceAccount).toBeUndefined();
    expect(auth.config.token).toBe('hvs.example');
  });
});
