import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

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

@Injectable({
    providedIn: 'root'
})
export class ExternalSecretApiService {
    private readonly http = inject(HttpClient);
    private readonly apiBase = environment.apiBaseUrl;

    private baseUrl(projectId: string): string {
        return `${this.apiBase}/api/projects/${projectId}/external-secrets`;
    }

    list(projectId: string): Observable<ExternalSecret[]> {
        return this.http.get<ExternalSecret[]>(this.baseUrl(projectId)).pipe(
            map(data => data || [])
        );
    }

    create(projectId: string, request: ExternalSecretRequest): Observable<ExternalSecret> {
        return this.http.post<ExternalSecret>(this.baseUrl(projectId), request);
    }

    update(projectId: string, name: string, request: ExternalSecretRequest): Observable<ExternalSecret> {
        return this.http.put<ExternalSecret>(`${this.baseUrl(projectId)}/${name}`, request);
    }

    delete(projectId: string, name: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl(projectId)}/${name}`);
    }

    getStatus(projectId: string, name: string): Observable<ExternalSecretStatusDetail> {
        return this.http.get<ExternalSecretStatusDetail>(`${this.baseUrl(projectId)}/${name}/status`);
    }
}
