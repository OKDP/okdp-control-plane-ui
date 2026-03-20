import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { LoggerService } from '../services/logger.service';

/**
 * HTTP Interceptor that catches 401 Unauthorized and 403 Forbidden errors
 * and triggers a logout/redirect to the login page.
 *
 * This is the modern functional interceptor pattern (Angular 15+).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const logger = inject(LoggerService);

    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            if (error.status === 401 || error.status === 403) {
                logger.warn(`Caught ${error.status} error. Session may have expired.`);

                // Clear local state and redirect to login
                // Use forceLogout to ensure cleanup even if backend is unreachable
                authService.forceLogout();

                // Navigate to login page
                router.navigate(['/login'], {
                    queryParams: { sessionExpired: 'true' }
                });
            }

            // Re-throw the error so that component-level error handling still works
            return throwError(() => error);
        })
    );
};
