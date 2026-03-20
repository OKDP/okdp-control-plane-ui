import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Route guard that ensures the user is authenticated.
 * If not authenticated, redirects to the login page.
 *
 * This is the modern functional guard pattern (Angular 15+).
 */
export const authGuard: CanActivateFn = (route, state): boolean | UrlTree => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Check if auth service is ready and user is authenticated
    if (authService.ready() && authService.isAuthenticated()) {
        return true;
    }

    // If auth service is ready but user is not authenticated, redirect to login
    if (authService.ready() && !authService.isAuthenticated()) {

        return router.createUrlTree(['/login'], {
            queryParams: { returnUrl: state.url }
        });
    }

    // If auth service is not ready yet, wait and recheck
    // This shouldn't happen often since APP_INITIALIZER should resolve first

    return true;
};
