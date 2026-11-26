import { useCallback, useState } from 'react';
import { serviceApi } from '../../../core/api/service-api';
import type {
  PlatformService,
  ServiceConnection,
  ServiceInstance,
} from '../../../core/models/service.model';
import type { StatusTone } from '../../../shared/components/status-tag';
import { safeExternalUrl } from '../../../shared/utils/safe-url';

const COMMON_PHASES = new Set([
  'Pending',
  'Installing',
  'Updating',
  'Ready',
  'Degraded',
  'Error',
  'Suspended',
  'Deleting',
  'Unknown',
]);

/** The state an instance shows: its common `phase` when the server sends one
 *  of the nine, else its historical `status` (Ready, Error, Updating,
 *  Installing), which is all an older server sends. */
export function instancePhase(instance: Pick<ServiceInstance, 'status' | 'phase'>): string {
  return instance.phase && COMMON_PHASES.has(instance.phase) ? instance.phase : instance.status;
}

/** Whether an instance belongs under the list's Error chip: Degraded counts,
 *  as the historical status reports it as Error. */
export function needsAttention(phase: string): boolean {
  return phase === 'Error' || phase === 'Degraded';
}

const CONNECTION_STATES: Record<string, { label: string; tone: StatusTone }> = {
  ready: { label: 'Ready', tone: 'success' },
  bound: { label: 'Bound', tone: 'info' },
  published: { label: 'Published', tone: 'warning' },
  declared: { label: 'Declared', tone: 'warning' },
};

/** Pill for one connection of an instance: its state when the server sends
 *  one of the four, else whether it resolved, which is all an older server
 *  sends. */
export function connectionStateTag(connection: Pick<ServiceConnection, 'resolved' | 'state'>): {
  label: string;
  tone: StatusTone;
} {
  const known =
    connection.state && Object.hasOwn(CONNECTION_STATES, connection.state)
      ? CONNECTION_STATES[connection.state]
      : undefined;
  if (known) return known;
  return connection.resolved
    ? { label: 'Resolved', tone: 'success' }
    : { label: 'Waiting', tone: 'warning' };
}

/** Map an instance status to its StatusTag tone. Covers the phases common to
 *  every engine: Pending, Installing, Updating, Ready, Degraded, Error,
 *  Suspended, Deleting, Unknown. */
export function statusTone(status: string): StatusTone {
  switch (status) {
    case 'Ready':
    case 'Running':
      return 'success';
    case 'Installing':
    case 'Updating':
    case 'Degraded':
    case 'Deleting':
      return 'warning';
    case 'Error':
    case 'CrashLoopBackOff':
    case 'Failed':
      return 'danger';
    case 'Suspended':
    case 'Unknown':
      return 'neutral';
    default:
      return 'info';
  }
}

/** In-flight instance states, rendered with the animated activity dot. */
export function isTransitioning(status: string): boolean {
  return isInProgress(status);
}

/** States the instance moves out of on its own: accepted and not yet observed,
 *  being installed, updated or deleted. Unknown is not one of them, the engine
 *  cannot tell. */
export function isInProgress(status: string): boolean {
  return (
    status === 'Pending' ||
    status === 'Installing' ||
    status === 'Updating' ||
    status === 'Deleting'
  );
}

/** Stages the deploy wizard shows while its write is in flight. They end when
 *  the engine accepts the write: what follows is observed on the instance. */
export const DEPLOY_STAGES: readonly { label: string }[] = Object.freeze([
  { label: 'Validating parameters' },
  { label: 'Submitting to the deployment engine' },
]);

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
  'hive-metastore': { label: 'Hive Metastore', basePath: ['hive-metastore'] },
};

/** Breadcrumb back-link label for a service name. */
export function parentLabel(service: string | undefined | null): string {
  return SERVICE_AREAS[service ?? '']?.label || service || 'Services';
}

/** URL segments of a service's console area. Services with a bespoke area use
 *  it; any other catalog service falls back to the generic `services/<name>`
 *  area (rendered by the same list/deploy/detail pages) instead of being
 *  wrongly nested under jupyterhub. */
export function areaBasePath(service: string | undefined | null): string[] {
  if (!service) return ['services'];
  return SERVICE_AREAS[service]?.basePath ?? ['services', service];
}

export { safeExternalUrl };

/** Open an external (cluster-workload) URL without handing it window.opener.
 *  Anything but an http(s) URL is ignored. */
export function openInNewTab(url: string): void {
  const safe = safeExternalUrl(url);
  if (safe) window.open(safe, '_blank', 'noopener,noreferrer');
}

/** A `returnTo` query value when it is a path inside the console, else
 *  undefined. URL parsing drops tabs and line breaks and reads a backslash as
 *  a slash, so `/\host` or `/<tab>/host` would leave the console like
 *  `//host`: such values are refused, and what remains must resolve to the
 *  console's own origin. */
export function safeReturnTo(value: string | null | undefined): string | undefined {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return undefined;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0020\u007f\\]/.test(value)) return undefined;
  try {
    const { origin } = window.location;
    const parsed = new URL(value, origin);
    if (parsed.origin !== origin || parsed.pathname.startsWith('//')) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

/** Version dropdown options for a platform service, flagging the default. */
export function versionOptionsFor(svc: PlatformService): { label: string; value: string }[] {
  return (svc.versions ?? []).map((v) => ({
    label: v === svc.defaultVersion ? `${v} (recommended)` : v,
    value: v,
  }));
}

// Lives in core/api/http (next to HttpError) so non-project-console features
// can surface backend error messages without importing from this module.
export { apiErrorMessage } from '../../../core/api/http';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** True when the schema declares a profile-editor widget (e.g. JupyterHub). */
export function hasProfileEditorWidget(schema: any): boolean {
  if (!schema?.properties) return false;
  return Object.values<any>(schema.properties).some(
    (def) => def['x-ui-widget'] === 'profile-editor',
  );
}

/**
 * Schema loading shared by the deploy and edit pages: holds the schema and
 * its loading flag, and warns (via the page's showWarn) on fetch failure —
 * `unavailableDetail` carries the page-specific copy.
 */
export function useServiceSchema(
  showWarn: (detail: string, summary: string) => void,
  unavailableDetail: string,
) {
  const [schema, setSchema] = useState<any>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const loadSchema = useCallback(
    (service: string, tag: string) => {
      setSchemaLoading(true);
      serviceApi
        .getServiceSchema(service, tag)
        .then((loaded) => {
          setSchema(loaded);
          setSchemaLoading(false);
        })
        .catch(() => {
          showWarn(unavailableDetail, 'Schema unavailable');
          setSchemaLoading(false);
        });
    },
    [showWarn, unavailableDetail],
  );
  return { schema, setSchema, schemaLoading, loadSchema };
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
