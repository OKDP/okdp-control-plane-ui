import { Injectable, isDevMode } from '@angular/core';

/**
 * Centralized logging service.
 * - In development: logs to console
 * - In production: can be extended to send to observability platform
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
    private readonly isDev = isDevMode();

    debug(message: string, ...args: unknown[]): void {
        if (this.isDev) {
            // eslint-disable-next-line no-console
            console.debug(`[DEBUG] ${message}`, ...args);
        }
    }

    info(message: string, ...args: unknown[]): void {
        if (this.isDev) {
            // eslint-disable-next-line no-console
            console.info(`[INFO] ${message}`, ...args);
        }
    }

    warn(message: string, ...args: unknown[]): void {
        // Warnings are always logged (useful for production debugging)
        console.warn(`[WARN] ${message}`, ...args);
    }

    error(message: string, error?: unknown): void {
        // Errors are always logged
        console.error(`[ERROR] ${message}`, error ?? '');

        // TODO: In production, could send to error tracking service (Sentry, etc.)
        // if (!this.isDev && error) {
        //   this.sendToErrorTracker(message, error);
        // }
    }
}
