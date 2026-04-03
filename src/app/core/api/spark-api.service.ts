import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoggerService } from '../services/logger.service';
import {
    SparkAppRequest,
    SparkAppYAMLRequest,
    SparkAppInstance,
    SparkAppUpdateRequest,
    SparkAppEvent,
    SparkConfig,
    SparkUIInfo,
} from '../models/spark.model';

@Injectable({
    providedIn: 'root'
})
export class SparkApiService {
    private readonly http = inject(HttpClient);
    private readonly logger = inject(LoggerService);
    private readonly baseUrl = environment.apiBaseUrl;

    getSparkConfig(): Observable<SparkConfig> {
        return this.http.get<SparkConfig>(`${this.baseUrl}/api/spark-config`);
    }

    getAppSchema(): Observable<Record<string, any>> {
        return this.http.get<Record<string, any>>(`${this.baseUrl}/api/spark-app-schema`);
    }

    submitApp(projectId: string, req: SparkAppRequest): Observable<SparkAppInstance> {
        return this.http.post<SparkAppInstance>(
            `${this.baseUrl}/api/projects/${projectId}/spark-apps`, req
        );
    }

    submitAppYAML(projectId: string, req: SparkAppYAMLRequest): Observable<SparkAppInstance> {
        return this.http.post<SparkAppInstance>(
            `${this.baseUrl}/api/projects/${projectId}/spark-apps/yaml`, req
        );
    }

    listApps(projectId: string): Observable<SparkAppInstance[]> {
        return this.http.get<SparkAppInstance[]>(
            `${this.baseUrl}/api/projects/${projectId}/spark-apps`
        ).pipe(map(data => data || []));
    }

    getApp(projectId: string, appName: string): Observable<SparkAppInstance> {
        return this.http.get<SparkAppInstance>(
            `${this.baseUrl}/api/projects/${projectId}/spark-apps/${appName}`
        );
    }

    updateApp(projectId: string, appName: string, req: SparkAppUpdateRequest): Observable<SparkAppInstance> {
        return this.http.put<SparkAppInstance>(
            `${this.baseUrl}/api/projects/${projectId}/spark-apps/${appName}`, req
        );
    }

    getSparkUI(projectId: string, appName: string): Observable<SparkUIInfo> {
        return this.http.get<SparkUIInfo>(
            `${this.baseUrl}/api/projects/${projectId}/spark-apps/${appName}/ui`
        );
    }

    deleteApp(projectId: string, appName: string): Observable<void> {
        return this.http.delete<void>(
            `${this.baseUrl}/api/projects/${projectId}/spark-apps/${appName}`
        );
    }

    streamApps(projectId: string): Observable<SparkAppEvent> {
        return new Observable<SparkAppEvent>(observer => {
            const eventSource = new EventSource(
                `${this.baseUrl}/api/projects/${projectId}/spark-apps/stream`
            );

            eventSource.onmessage = (event) => {
                try {
                    observer.next(JSON.parse(event.data));
                } catch (e) {
                    this.logger.error('Failed to parse Spark SSE message', e);
                }
            };

            eventSource.onerror = (error) => {
                this.logger.error('Spark SSE error', error);
                if (eventSource.readyState === EventSource.CLOSED) {
                    observer.complete();
                } else {
                    observer.error(error);
                }
            };

            return () => eventSource.close();
        });
    }

    getDriverLogs(projectId: string, appName: string, tailLines = 100, container?: string): Observable<string> {
        let url = `${this.baseUrl}/api/projects/${projectId}/spark-apps/${appName}/logs?tailLines=${tailLines}`;
        if (container) {
            url += `&container=${encodeURIComponent(container)}`;
        }
        return this.http.get(url, { responseType: 'text' });
    }

    streamDriverLogs(projectId: string, appName: string, tailLines = 100): Observable<string> {
        return new Observable<string>(observer => {
            const url = `${this.baseUrl}/api/projects/${projectId}/spark-apps/${appName}/logs?follow=true&tailLines=${tailLines}`;
            const eventSource = new EventSource(url);
            eventSource.onmessage = (event) => observer.next(event.data);
            eventSource.onerror = () => {
                eventSource.close();
                observer.complete();
            };
            return () => eventSource.close();
        });
    }
}
