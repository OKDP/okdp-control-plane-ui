import { Injectable, inject, signal, computed, DestroyRef, effect } from '@angular/core';
import { Router } from '@angular/router';
import { Project, ProjectApiService, ProjectEvent } from '../api/project-api.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { merge, scan, catchError, EMPTY, tap } from 'rxjs';
import { LoggerService } from '../services/logger.service';

@Injectable({
    providedIn: 'root'
})
export class ProjectContextService {
    private readonly router = inject(Router);
    private readonly projectApi = inject(ProjectApiService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly logger = inject(LoggerService);
    private readonly storageKey = 'okdp-selected-projectId';

    // State Signals
    readonly availableProjects = signal<Project[]>([]);
    readonly currentProjectId = signal<string | null>(null);
    readonly isLoading = signal(true);

    readonly currentProject = computed(() => {
        const id = this.currentProjectId();
        const projects = this.availableProjects();

        return projects?.find(p => p.name === id) || null;
    });

    constructor() {
        // Enforce Consistency Effect
        effect(() => {
            const projects = this.availableProjects();
            const currentId = this.currentProjectId();
            const loading = this.isLoading();

            // Do not intervene during initial load
            if (loading) return;

            // Scenario 1: Current project is selected but not in the list (e.g. was deleted)
            if (currentId && !projects.find(p => p.name === currentId)) {
                this.logger.warn(`Selected project '${currentId}' is no longer available.`);

                if (projects.length === 0) {
                    this.clearContext();
                    if (!this.router.url.startsWith('/admin')) {
                        this.router.navigate(['/admin/projects']);
                    }
                } else {
                    const fallback = projects[0].name;

                    this.selectProject(fallback);
                }
            }
            // Scenario 2: No project selected but list is not empty (e.g. forced navigation to root)
            else if (!currentId && projects.length > 0) {
                // Potentially auto-select first one, or wait for Guard?
                // Let's leave this to Guard for now to avoid fighting with routing.
            }
        });

        // 1. Initialize currentProjectId from sessionStorage immediately
        const storedId = sessionStorage.getItem(this.storageKey);
        if (storedId) {

            this.currentProjectId.set(storedId);
        }

        // 2. Subscribe to projects stream (API + SSE)
        this.createProjectsStream().pipe(
            takeUntilDestroyed(this.destroyRef),
            tap(projects => {

                this.availableProjects.set(projects);
                this.isLoading.set(false);
            }),
            catchError(err => {
                this.logger.error('Fatal error in projects stream', err);
                this.isLoading.set(false);
                return EMPTY;
            })
        ).subscribe();
    }

    private createProjectsStream() {
        return merge(
            this.projectApi.getProjects(),
            this.projectApi.getProjectsStream().pipe(
                catchError(err => {
                    this.logger.error('SSE Stream error', err);
                    return EMPTY;
                })
            )
        ).pipe(
            scan((currentList: Project[], eventOrList: Project[] | ProjectEvent) => {
                // 1. Initial Load (Array)
                if (Array.isArray(eventOrList)) {
                    return eventOrList;
                }
                // 2. Stream Update (Event)
                const event = eventOrList as ProjectEvent;
                const project = event.object;

                switch (event.type) {
                    case 'ADDED':
                        return currentList.some(p => p.name === project.name)
                            ? currentList
                            : [...currentList, project];
                    case 'MODIFIED':
                        return currentList.map(p => p.name === project.name ? project : p);
                    case 'DELETED':
                        return currentList.filter(p => p.name !== project.name);
                    default:
                        return currentList;
                }
            }, [] as Project[])
        );
    }

    selectProject(projectId: string) {
        if (!projectId) return;

        // 1. Update Signal
        this.currentProjectId.set(projectId);

        // 2. Persist
        sessionStorage.setItem(this.storageKey, projectId);

        // 3. Navigate — preserve the current sub-route (e.g. secret-stores)
        const currentUrl = this.router.url;
        const projectPathMatch = currentUrl.match(/^\/project\/[^/]+(\/.*)?$/);
        const subPath = projectPathMatch?.[1] ?? '';
        this.router.navigate([`/project/${projectId}${subPath}`]);
    }

    getLastSelectedProjectId(): string | null {
        return sessionStorage.getItem(this.storageKey);
    }

    clearContext() {
        this.currentProjectId.set(null);
        sessionStorage.removeItem(this.storageKey);
    }
}

