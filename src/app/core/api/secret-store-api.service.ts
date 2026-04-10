import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

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

@Injectable({
    providedIn: 'root'
})
export class SecretStoreApiService {
    private readonly http = inject(HttpClient);
    private readonly apiBase = environment.apiBaseUrl;

    private storeUrl(projectId: string): string {
        return `${this.apiBase}/api/projects/${projectId}/secret-stores`;
    }

    list(projectId: string): Observable<SecretStore[]> {
        return this.http.get<SecretStore[]>(this.storeUrl(projectId)).pipe(
            map(data => data || [])
        );
    }

    create(projectId: string, request: SecretStoreRequest): Observable<SecretStore> {
        return this.http.post<SecretStore>(this.storeUrl(projectId), request);
    }

    update(projectId: string, storeName: string, request: SecretStoreRequest): Observable<SecretStore> {
        return this.http.put<SecretStore>(`${this.storeUrl(projectId)}/${storeName}`, request);
    }

    delete(projectId: string, storeName: string): Observable<void> {
        return this.http.delete<void>(`${this.storeUrl(projectId)}/${storeName}`);
    }

    testConnection(projectId: string, request: SecretStoreRequest): Observable<{ message: string }> {
        return this.http.post<{ message: string }>(`${this.storeUrl(projectId)}/test`, request);
    }

    getStatus(projectId: string, storeName: string): Observable<SecretStoreStatusDetail> {
        return this.http.get<SecretStoreStatusDetail>(`${this.storeUrl(projectId)}/${storeName}/status`);
    }
}
