import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { ProjectContextService } from '../context/project-context.service';
import { ProjectApiService } from '../api/project-api.service';

export const projectContextGuard: CanActivateFn = (route) => {
    const router = inject(Router);
    const context = inject(ProjectContextService);
    const projectApi = inject(ProjectApiService);
    const routeProjectId = route.paramMap.get('projectId');

    // 1. Is Project ID in URL?
    if (routeProjectId) {
        // Yes -> Update context signal directly
        context.currentProjectId.set(routeProjectId);
        sessionStorage.setItem('okdp-selected-projectId', routeProjectId);
        return true;
    }

    // 2. No ID in URL -> Check Session
    const lastId = context.getLastSelectedProjectId();
    if (lastId) {
        // Redirect to last project
        return router.createUrlTree(['/project', lastId]);
    }

    // 3. No Session -> Fetch available projects and pick first
    return projectApi.getProjects().pipe(
        take(1),
        map(projects => {
            if (projects && projects.length > 0) {
                // Projects exist -> Force redirection to the first one
                return router.createUrlTree(['/project', projects[0].name]);
            }
            return router.createUrlTree(['/admin/projects']);
        })
    );
};
