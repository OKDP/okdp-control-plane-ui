import { environment } from '../../config/environment';
import { http } from './http';

export type ExternalSecretStatus = 'Synced' | 'Error' | 'Pending' | 'Unknown';

export interface ExternalSecretDataRef {
  secretKey: string;
  remoteRef: {
    key: string;
    property?: string;
  };
}

export interface ExternalSecretCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
}

export interface ExternalSecretStatusDetail {
  status: ExternalSecretStatus;
  conditions: ExternalSecretCondition[];
  lastSyncedAt?: string;
  lastError?: string;
}

export interface ExternalSecret {
  name: string;
  namespace: string;
  secretStoreRef: string;
  target: {
    name: string;
    creationPolicy: string;
  };
  refreshInterval: string;
  data: ExternalSecretDataRef[];
  status: ExternalSecretStatus;
  lastSyncedAt?: string;
  lastError?: string;
  createdAt?: string;
}

/**
 * What the control plane could establish about a remote key, asked before an
 * import exists.
 *
 * `verifiable` carries its own weight: false is not a verdict on the key, it
 * means the answer is unknown, and must never be shown as a success. A store
 * using Kubernetes auth answers that way, because the control plane cannot
 * borrow the store's identity to ask Vault.
 */
export interface RemoteKeyCheck {
  verifiable: boolean;
  found: boolean;
  /** Property NAMES the key holds. The server never returns the values. */
  properties?: string[];
  message: string;
}

export interface RemoteKeyCheckRequest {
  secretStoreRef: string;
  remoteRef: {
    key: string;
    property?: string;
  };
}

export interface ExternalSecretRequest {
  name: string;
  secretStoreRef: string;
  target: {
    name: string;
  };
  refreshInterval: string;
  data: ExternalSecretDataRef[];
}

const seg = encodeURIComponent;

function baseUrl(projectId: string): string {
  return `${environment.apiBaseUrl}/api/projects/${seg(projectId)}/external-secrets`;
}

export const externalSecretApi = {
  list(projectId: string): Promise<ExternalSecret[]> {
    return http.getList<ExternalSecret>(baseUrl(projectId));
  },

  create(projectId: string, request: ExternalSecretRequest): Promise<ExternalSecret> {
    return http.post<ExternalSecret>(baseUrl(projectId), request);
  },

  update(projectId: string, name: string, request: ExternalSecretRequest): Promise<ExternalSecret> {
    return http.put<ExternalSecret>(`${baseUrl(projectId)}/${seg(name)}`, request);
  },

  delete(projectId: string, name: string): Promise<void> {
    return http.delete(`${baseUrl(projectId)}/${seg(name)}`);
  },

  getStatus(projectId: string, name: string): Promise<ExternalSecretStatusDetail> {
    return http.get<ExternalSecretStatusDetail>(`${baseUrl(projectId)}/${seg(name)}/status`);
  },

  checkRemoteKey(projectId: string, request: RemoteKeyCheckRequest): Promise<RemoteKeyCheck> {
    return http.post<RemoteKeyCheck>(`${baseUrl(projectId)}/check`, request);
  },
};
