import { HttpError } from '../../../core/api/http';

/** Map an instance/pod status to the okdp tag color class. */
export function tagClass(status: string): string {
  switch (status) {
    case 'Ready':
    case 'Running':
      return 'okdp-tag-success';
    case 'Installing':
    case 'Updating':
      return 'okdp-tag-warn';
    case 'Error':
    case 'CrashLoopBackOff':
    case 'Failed':
      return 'okdp-tag-danger';
    default:
      return 'okdp-tag-info';
  }
}

export interface ServiceArea {
  /** Breadcrumb / back-link label. */
  label: string;
  /** URL segments of the service area under /project/:projectId. */
  basePath: string[];
}

/**
 * Registry mapping a platform service name to its console area. Single
 * source for breadcrumb labels and area base paths (the route quadruples in
 * app-routes.tsx and the sidebar links mirror these paths).
 */
export const SERVICE_AREAS: Record<string, ServiceArea> = {
  jupyterhub: { label: 'Jupyter', basePath: ['services'] },
  'spark-history-server': { label: 'History Server', basePath: ['spark', 'history-server'] },
  trino: { label: 'Trino', basePath: ['lakehouse', 'trino'] },
  polaris: { label: 'Polaris', basePath: ['lakehouse', 'polaris'] },
  superset: { label: 'Superset', basePath: ['bi', 'superset'] },
  airflow: { label: 'Airflow', basePath: ['data-engineering', 'airflow'] },
};

/** Breadcrumb back-link label for a service name. */
export function parentLabel(service: string | undefined | null): string {
  return SERVICE_AREAS[service ?? '']?.label || service || 'Services';
}

/** URL segments of a service's console area, defaulting to the generic list. */
export function areaBasePath(service: string | undefined | null): string[] {
  return SERVICE_AREAS[service ?? '']?.basePath ?? ['services'];
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
