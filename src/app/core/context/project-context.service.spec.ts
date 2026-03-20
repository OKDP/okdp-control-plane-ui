import { TestBed, fakeAsync } from '@angular/core/testing';
import { ProjectContextService } from './project-context.service';
import { ProjectApiService, Project, ProjectEvent } from '../api/project-api.service';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';

describe('ProjectContextService', () => {
    let service: ProjectContextService;
    let projectApiSpy: jest.Mocked<ProjectApiService>;
    let routerSpy: jest.Mocked<Router>;
    let sseSubject: Subject<ProjectEvent>;

    const mockProjects: Project[] = [
        { name: 'proj-a', description: 'Project A' },
        { name: 'proj-b', description: 'Project B' }
    ];

    beforeEach(() => {
        sseSubject = new Subject<ProjectEvent>();

        projectApiSpy = {
            getProjects: jest.fn().mockReturnValue(of(mockProjects)),
            getProjectsStream: jest.fn().mockReturnValue(sseSubject.asObservable())
        } as unknown as jest.Mocked<ProjectApiService>;

        routerSpy = {
            navigate: jest.fn()
        } as unknown as jest.Mocked<Router>;

        // Clear storage before each test
        sessionStorage.clear();

        TestBed.configureTestingModule({
            providers: [
                ProjectContextService,
                { provide: ProjectApiService, useValue: projectApiSpy },
                { provide: Router, useValue: routerSpy }
            ]
        });

        // We inject service inside tests usually to control initialization, 
        // but here constructor has side effects we might want to test immediately.
        // However, better to inject in each test or beforeEach if generally applicable.
        service = TestBed.inject(ProjectContextService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should load initial projects', () => {
        // Signals update synchronously when Observable emits
        expect(service.availableProjects()).toEqual(mockProjects);
        expect(service.isLoading()).toBe(false);
    });

    it('should initialize currentProjectId from storage', () => {
        sessionStorage.setItem('okdp-selected-projectId', 'proj-b');

        // Re-create service to trigger constructor logic
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [
                ProjectContextService,
                { provide: ProjectApiService, useValue: projectApiSpy },
                { provide: Router, useValue: routerSpy }
            ]
        });
        const reService = TestBed.inject(ProjectContextService);

        expect(reService.currentProjectId()).toBe('proj-b');
    });

    it('should update state on SSE ADDED event', () => {
        const newProject: Project = { name: 'proj-c', description: 'Project C' };
        sseSubject.next({ type: 'ADDED', object: newProject });

        const projects = service.availableProjects();
        expect(projects).toHaveLength(3);
        expect(projects).toContainEqual(newProject);
    });

    it('should update state on SSE DELETED event', () => {
        sseSubject.next({ type: 'DELETED', object: { name: 'proj-a' } as Project });

        const projects = service.availableProjects();
        expect(projects).toHaveLength(1);
        expect(projects.find(p => p.name === 'proj-a')).toBeUndefined();
    });

    describe('Selection & Navigation', () => {
        it('should select project, update storage and navigate', () => {
            service.selectProject('proj-a');

            expect(service.currentProjectId()).toBe('proj-a');
            expect(sessionStorage.getItem('okdp-selected-projectId')).toBe('proj-a');
            expect(routerSpy.navigate).toHaveBeenCalledWith(['/project', 'proj-a']);
        });
    });

    describe('Consistency Effect', () => {
        it('should redirect to welcome if selected project is deleted and list empty', fakeAsync(() => {
            // Setup: Selected project 'proj-a'
            service.selectProject('proj-a');

            // Trigger DELETE of all projects
            // We need to manipulate signals or streams.
            // Using a new setup might be cleaner, but lets try stream.

            // First delete proj-b
            sseSubject.next({ type: 'DELETED', object: { name: 'proj-b' } as Project });
            // Then delete proj-a (current)
            sseSubject.next({ type: 'DELETED', object: { name: 'proj-a' } as Project });

            // Effect runs asynchronously usually? 
            // In TestBed with flushEffects or tick?
            TestBed.flushEffects();

            expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin/projects']);
        }));

        it('should switch to fallback project if selected is deleted but others exist', fakeAsync(() => {
            service.selectProject('proj-a');

            // Delete proj-a, but proj-b remains
            sseSubject.next({ type: 'DELETED', object: { name: 'proj-a' } as Project });

            TestBed.flushEffects();

            // Should select proj-b (fallback logic is projects[0])
            // Since proj-a was removed, proj-b is now at index 0 (assuming order)
            expect(service.currentProjectId()).toBe('proj-b');
            expect(routerSpy.navigate).toHaveBeenCalledWith(['/project', 'proj-b']);
        }));
    });
});
