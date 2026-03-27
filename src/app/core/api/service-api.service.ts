import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoggerService } from '../services/logger.service';
import {
    PlatformService,
    DeployServiceRequest,
    ServiceEvent,
    ServiceInstance,
    CatalogCategory,
    Pod,
    ServiceMetrics,
} from '../models/service.model';

@Injectable({
    providedIn: 'root'
})
export class ServiceApiService {
    private readonly http = inject(HttpClient);
    private readonly logger = inject(LoggerService);
    private readonly baseUrl = environment.apiBaseUrl;

    // --- Platform services (managed by OKDP) ---

    getPlatformServices(): Observable<PlatformService[]> {
        return this.http.get<PlatformService[]>(`${this.baseUrl}/api/platform-services`).pipe(
            map(data => data || [])
        );
    }

    getService(projectId: string, serviceName: string): Observable<ServiceInstance> {
        return this.http.get<ServiceInstance>(`${this.baseUrl}/api/projects/${projectId}/services/${serviceName}`);
    }

    getServices(projectId: string): Observable<ServiceInstance[]> {
        return this.http.get<ServiceInstance[]>(`${this.baseUrl}/api/projects/${projectId}/services`).pipe(
            map(data => data || [])
        );
    }

    deployService(projectId: string, req: DeployServiceRequest): Observable<ServiceInstance> {
        return this.http.post<ServiceInstance>(`${this.baseUrl}/api/projects/${projectId}/services`, req);
    }

    deleteService(projectId: string, serviceName: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/api/projects/${projectId}/services/${serviceName}`);
    }

    getServicesStream(projectId: string): Observable<ServiceEvent> {
        return new Observable<ServiceEvent>(observer => {
            const eventSource = new EventSource(`${this.baseUrl}/api/projects/${projectId}/services/stream`);

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    observer.next(data);
                } catch (e) {
                    this.logger.error('Failed to parse service SSE message', e);
                }
            };

            eventSource.onerror = (error) => {
                this.logger.error('Service SSE error', error);
                if (eventSource.readyState === EventSource.CLOSED) {
                    observer.complete();
                } else {
                    observer.error(error);
                }
            };

            return () => {
                eventSource.close();
            };
        });
    }

    getServiceSchema(serviceName: string, tag?: string): Observable<any> {
        const params = tag ? `?tag=${encodeURIComponent(tag)}` : '';
        return this.http.get<any>(`${this.baseUrl}/api/platform-services/${serviceName}/schema${params}`);
    }

    getProfileImages(): Observable<Record<string, { label: string; image: string }[]>> {
        return this.http.get<Record<string, { label: string; image: string }[]>>(
            `${this.baseUrl}/api/profile-images`
        );
    }

    updateServiceParameters(projectId: string, serviceName: string, body: { tag?: string; parameters?: Record<string, any> }): Observable<ServiceInstance> {
        return this.http.patch<ServiceInstance>(
            `${this.baseUrl}/api/projects/${projectId}/services/${serviceName}/parameters`,
            body
        );
    }

    // --- Pod operations ---

    getPods(projectId: string, serviceName: string): Observable<Pod[]> {
        return this.http.get<Pod[]>(
            `${this.baseUrl}/api/projects/${projectId}/services/${serviceName}/pods`
        ).pipe(map(data => data || []));
    }

    getServiceMetrics(projectId: string, serviceName: string): Observable<ServiceMetrics> {
        return this.http.get<ServiceMetrics>(
            `${this.baseUrl}/api/projects/${projectId}/services/${serviceName}/metrics`
        );
    }

    getPodLogs(projectId: string, serviceName: string, podName: string, tailLines = 100, container?: string): Observable<string> {
        let url = `${this.baseUrl}/api/projects/${projectId}/services/${serviceName}/pods/${podName}/logs?tailLines=${tailLines}`;
        if (container) {
            url += `&container=${encodeURIComponent(container)}`;
        }
        return this.http.get(url, { responseType: 'text' });
    }

    streamPodLogs(projectId: string, serviceName: string, podName: string, container?: string, tailLines = 100): Observable<string> {
        return new Observable<string>(observer => {
            let url = `${this.baseUrl}/api/projects/${projectId}/services/${serviceName}/pods/${podName}/logs?follow=true&tailLines=${tailLines}`;
            if (container) {
                url += `&container=${encodeURIComponent(container)}`;
            }
            const eventSource = new EventSource(url);
            eventSource.onmessage = (event) => observer.next(event.data);
            eventSource.onerror = () => {
                eventSource.close();
                observer.complete();
            };
            return () => eventSource.close();
        });
    }

    // --- Catalog (client self-service) ---

    getCatalog(): Observable<CatalogCategory[]> {
        return this.http.get<CatalogCategory[]>(`${this.baseUrl}/api/catalog`).pipe(
            map(data => data || [])
        );
    }
}
