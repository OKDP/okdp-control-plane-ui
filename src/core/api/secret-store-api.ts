import { environment } from '../../config/environment';
import { http } from './http';

// --- Provider-agnostic models ---

export type SecretStoreProvider = 'vault';

export type SecretStoreStatus = 'Ready' | 'Error' | 'Pending' | 'Unknown';

export type VaultAuthType = 'token' | 'kubernetes' | 'appRole';

export interface VaultAuthConfig {
  token?: string;
  mountPath?: string;
  role?: string;
  secretId?: string;
  roleId?: string;
  /**
   * The name of the ServiceAccount the store authenticates as when it uses the
   * Kubernetes auth method. Ignored by every other method.
   *
   * Three states, and the server tells them apart:
   * - absent keeps whatever account the store already uses
   * - an empty string asks for the namespace default account back
   * - a name selects that account
   *
   * The form therefore sends an empty string rather than omitting the field,
   * or a store given its own identity could never be handed back to default.
   */
  serviceAccount?: string;
}

export interface VaultProviderConfig {
  server: string;
  path: string;
  version: 'v1' | 'v2';
  caBundle?: string;
}

export interface SecretStoreAuthConfig {
  type: VaultAuthType;
  config: VaultAuthConfig;
}

export interface SecretStoreCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
}

export interface SecretStoreStatusDetail {
  status: SecretStoreStatus;
  conditions: SecretStoreCondition[];
  lastCheckedAt?: string;
  lastError?: string;
}

export interface SecretStore {
  name: string;
  provider: SecretStoreProvider;
  namespace: string;
  status: SecretStoreStatus;
  lastCheckedAt?: string;
  lastError?: string;
  isDefault: boolean;
  createdAt?: string;
  vault?: VaultProviderConfig;
  auth?: SecretStoreAuthConfig;
}

export interface SecretStoreRequest {
  name: string;
  provider: SecretStoreProvider;
  vault: VaultProviderConfig;
  auth: SecretStoreAuthConfig;
  isDefault?: boolean;
}

const seg = encodeURIComponent;

function storeUrl(projectId: string): string {
  return `${environment.apiBaseUrl}/api/projects/${seg(projectId)}/secret-stores`;
}

export const secretStoreApi = {
  list(projectId: string): Promise<SecretStore[]> {
    return http.getList<SecretStore>(storeUrl(projectId));
  },

  create(projectId: string, request: SecretStoreRequest): Promise<SecretStore> {
    return http.post<SecretStore>(storeUrl(projectId), request);
  },

  update(projectId: string, storeName: string, request: SecretStoreRequest): Promise<SecretStore> {
    return http.put<SecretStore>(`${storeUrl(projectId)}/${seg(storeName)}`, request);
  },

  delete(projectId: string, storeName: string): Promise<void> {
    return http.delete(`${storeUrl(projectId)}/${seg(storeName)}`);
  },

  testConnection(projectId: string, request: SecretStoreRequest): Promise<{ message: string }> {
    return http.post<{ message: string }>(`${storeUrl(projectId)}/test`, request);
  },

  getStatus(projectId: string, storeName: string): Promise<SecretStoreStatusDetail> {
    return http.get<SecretStoreStatusDetail>(`${storeUrl(projectId)}/${seg(storeName)}/status`);
  },
};
