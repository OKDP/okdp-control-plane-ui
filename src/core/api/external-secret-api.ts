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

export interface ExternalSecretRequest {
  name: string;
  secretStoreRef: string;
  target: {
    name: string;
  };
  refreshInterval: string;
  data: ExternalSecretDataRef[];
}

function baseUrl(projectId: string): string {
  return `${environment.apiBaseUrl}/api/projects/${projectId}/external-secrets`;
}

export const externalSecretApi = {
  async list(projectId: string): Promise<ExternalSecret[]> {
    return (await http.get<ExternalSecret[]>(baseUrl(projectId))) || [];
  },

  create(projectId: string, request: ExternalSecretRequest): Promise<ExternalSecret> {
    return http.post<ExternalSecret>(baseUrl(projectId), request);
  },

  update(projectId: string, name: string, request: ExternalSecretRequest): Promise<ExternalSecret> {
    return http.put<ExternalSecret>(`${baseUrl(projectId)}/${name}`, request);
  },

  delete(projectId: string, name: string): Promise<void> {
    return http.delete(`${baseUrl(projectId)}/${name}`);
  },

  getStatus(projectId: string, name: string): Promise<ExternalSecretStatusDetail> {
    return http.get<ExternalSecretStatusDetail>(`${baseUrl(projectId)}/${name}/status`);
  },
};
