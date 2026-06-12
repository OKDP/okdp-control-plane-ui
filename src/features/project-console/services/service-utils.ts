import { HttpError } from '../../../core/api/http';
import type { StatusTone } from '../../../shared/components/status-tag';

/** Map an instance status to its StatusTag tone. */
export function statusTone(status: string): StatusTone {
  switch (status) {
    case 'Ready':
    case 'Running':
      return 'success';
    case 'Installing':
    case 'Updating':
      return 'warning';
    case 'Error':
    case 'CrashLoopBackOff':
    case 'Failed':
      return 'danger';
    default:
      return 'info';
  }
}

/** In-flight instance states — rendered with the animated activity dot. */
export function isTransitioning(status: string): boolean {
  return status === 'Installing' || status === 'Updating';
}

export interface ServiceArea {
  /** Breadcrumb / back-link label. */
  label: string;
  /** URL segments of the service area under /projects/:projectId. */
  basePath: string[];
}

/**
 * Registry mapping a platform service name to its console area. Single
 * source for breadcrumb labels and area base paths (the route quadruples in
 * app-routes.tsx and the sidebar links mirror these paths).
 */
export const SERVICE_AREAS: Record<string, ServiceArea> = {
  jupyterhub: { label: 'JupyterHub', basePath: ['jupyterhub'] },
  'spark-history-server': { label: 'History Server', basePath: ['spark', 'history-server'] },
  trino: { label: 'Trino', basePath: ['trino'] },
  polaris: { label: 'Polaris', basePath: ['polaris'] },
  superset: { label: 'Superset', basePath: ['superset'] },
  airflow: { label: 'Airflow', basePath: ['airflow'] },
};

/** Breadcrumb back-link label for a service name. */
export function parentLabel(service: string | undefined | null): string {
  return SERVICE_AREAS[service ?? '']?.label || service || 'Services';
}

/** URL segments of a service's console area, defaulting to the generic list. */
export function areaBasePath(service: string | undefined | null): string[] {
  return SERVICE_AREAS[service ?? '']?.basePath ?? ['jupyterhub'];
}

/**
 * Extract the backend `error` (or `message`) field from a failed request,
 * with fallback — mirrors the legacy `err?.error?.error || err?.error?.message`.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpError && err.body) {
    try {
      const parsed = JSON.parse(err.body);
      if (parsed && typeof parsed.error === 'string') {
        return parsed.error;
      }
      if (parsed && typeof parsed.message === 'string') {
        return parsed.message;
      }
    } catch {
      // not JSON — fall through
    }
  }
  return fallback;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** True when the schema declares a profile-editor widget (e.g. JupyterHub). */
export function hasProfileEditorWidget(schema: any): boolean {
  if (!schema?.properties) return false;
  return Object.values<any>(schema.properties).some(
    (def) => def['x-ui-widget'] === 'profile-editor',
  );
}

/** Remove profile-editor fields from a schema (rendered by ProfileListEditor instead). */
export function stripProfileEditorFields(schema: any): any {
  if (!schema?.properties) return schema;
  const filtered = { ...schema, properties: { ...schema.properties } };
  for (const [key, def] of Object.entries<any>(filtered.properties)) {
    if (def['x-ui-widget'] === 'profile-editor') {
      delete filtered.properties[key];
    }
  }
  return filtered;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/** Mirror of the backend's formatCPU: compact human-readable core count. */
export function formatCpuCores(cores: number): string {
  if (cores === 0) return '0';
  return cores < 1 ? cores.toFixed(3) : cores.toFixed(2);
}

/** Mirror of the backend's formatMemory: byte value in binary units. */
export function formatMemoryBytes(bytes: number): string {
  if (bytes === 0) return '0';
  const units: [number, string][] = [
    [1024 ** 3, 'Gi'],
    [1024 ** 2, 'Mi'],
    [1024, 'Ki'],
  ];
  for (const [threshold, suffix] of units) {
    if (bytes >= threshold) return `${(bytes / threshold).toFixed(2)}${suffix}`;
  }
  return `${bytes.toFixed(0)}B`;
}

/** Angular `date: 'mediumDate'` equivalent (e.g. "Jun 10, 2026"). */
export function formatMediumDate(value: string | undefined | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Angular `date: 'medium'` equivalent (e.g. "Jun 10, 2026, 1:15:00 PM"). */
export function formatMediumDateTime(value: string | undefined | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}
