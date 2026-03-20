import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoggerService } from '../services/logger.service';

export interface Project {
    name: string;
    description: string;
}

export interface ProjectEvent {
    type: 'ADDED' | 'MODIFIED' | 'DELETED';
    object: Project;
}

@Injectable({
    providedIn: 'root'
})
export class ProjectApiService {
    private readonly http = inject(HttpClient);
    private readonly logger = inject(LoggerService);
    private readonly baseUrl = `${environment.apiBaseUrl}/api/projects`;

    getProjects(): Observable<Project[]> {
        return this.http.get<Project[]>(this.baseUrl).pipe(
            map(data => data || [])
        );
    }

    createProject(project: Project): Observable<Project> {
        return this.http.post<Project>(this.baseUrl, project);
    }

    deleteProject(name: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${name}`);
    }

    getProjectsStream(): Observable<ProjectEvent> {
        return new Observable<ProjectEvent>(observer => {
            const eventSource = new EventSource(`${this.baseUrl}/stream`);

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    observer.next(data);
                } catch (e) {
                    this.logger.error('Failed to parse SSE message', e);
                }
            };

            eventSource.onerror = (error) => {
                this.logger.error('SSE error', error);
                // If connection is closed, we might want to reconnect or just complete.
                // EventSource auto-reconnects by default, but if the server closes it, we might need to handle it.
                // For now, let's keep it simple.
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
}
