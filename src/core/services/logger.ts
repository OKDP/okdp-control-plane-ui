/**
 * Centralized logging module.
 * - In development: logs to console
 * - In production: can be extended to send to observability platform
 */
const isDev = import.meta.env.DEV;

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.info(`[INFO] ${message}`, ...args);
    }
  },

  warn(message: string, ...args: unknown[]): void {
    // Warnings are always logged (useful for production debugging)
    console.warn(`[WARN] ${message}`, ...args);
  },

  error(message: string, error?: unknown): void {
    // Errors are always logged
    console.error(`[ERROR] ${message}`, error ?? '');
  },
};
