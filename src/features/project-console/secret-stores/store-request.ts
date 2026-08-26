import type { SecretStoreRequest, VaultAuthType } from '../../../core/api/secret-store-api';

/** The dialog's fields, before they become a request. */
export interface StoreForm {
  storeName: string;
  vaultServer: string;
  vaultPath: string;
  vaultVersion: 'v1' | 'v2';
  caBundle: string;
  authType: VaultAuthType;
  authToken: string;
  authMountPath: string;
  authRole: string;
  authServiceAccount: string;
  isDefault: boolean;
}

export const EMPTY_FORM: StoreForm = {
  storeName: '',
  vaultServer: '',
  vaultPath: '',
  vaultVersion: 'v2',
  caBundle: '',
  authType: 'token',
  authToken: '',
  authMountPath: '',
  authRole: '',
  authServiceAccount: '',
  isDefault: false,
};

/**
 * Turns the dialog's fields into the request the API expects.
 *
 * Every optional field is omitted rather than sent empty, so the server applies
 * its own defaults instead of storing a blank the caller never chose. Fields
 * belonging to the other auth method are dropped too: sending a role alongside
 * a token would describe an identity Vault never sees.
 */
export function buildStoreRequest(form: StoreForm): SecretStoreRequest {
  const kubernetes = form.authType === 'kubernetes';
  const token = form.authType === 'token';

  return {
    name: form.storeName,
    provider: 'vault',
    vault: {
      server: form.vaultServer,
      path: form.vaultPath,
      version: form.vaultVersion,
      caBundle: form.caBundle || undefined,
    },
    auth: {
      type: form.authType,
      config: {
        token: token ? form.authToken || undefined : undefined,
        mountPath: kubernetes ? form.authMountPath || undefined : undefined,
        role: kubernetes ? form.authRole || undefined : undefined,
        serviceAccount: kubernetes ? form.authServiceAccount || undefined : undefined,
      },
    },
    isDefault: form.isDefault,
  };
}
