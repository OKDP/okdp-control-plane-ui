import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Toast } from 'primereact/toast';
import DeleteConfirmDialog from '../../../shared/components/delete-confirm-dialog';
import EmptyState from '../../../shared/components/empty-state';
import { HttpError } from '../../../core/api/http';
import { serviceApi } from '../../../core/api/service-api';
import { forgetDeletedInstance } from '../../../core/api/service-deletions';
import type { Pod, ServiceInstance, ServiceMetrics } from '../../../core/models/service.model';
import { useToastMessages } from '../../../shared/hooks/use-toast-messages';
import { PodList } from './pod-list';
import { PodLogViewer } from './pod-log-viewer';
import {
  apiErrorMessage,
  areaBasePath,
  connectionStateTag,
  formatMediumDateTime,
  instancePhase,
  isTransitioning,
  openInNewTab,
  parentLabel,
  safeExternalUrl,
  safeReturnTo,
  statusTone,
} from './service-utils';
import { StatusTag } from '../../../shared/components/status-tag';
import { InstanceStatusAlert } from './instance-status-alert';
import {
  acceptedDeletionDetail,
  classifyDelete,
  classifyWriteError,
  CONFLICT_DETAIL,
  UNKNOWN_DELETE_DETAIL,
  type DeleteOutcome,
} from './write-outcome';
import {
  useRouteNotice,
  withNotice,
  type RouteNotice,
} from '../../../shared/hooks/use-route-notice';

type Tab = 'overview' | 'pods' | 'logs' | 'parameters';

const TABS: Tab[] = ['overview', 'pods', 'logs', 'parameters'];

interface ResourceUsage {
  used: string;
  limit: string;
  pct: number;
  pctLabel: string;
  unbounded: boolean;
}

function resourceUsage(metrics: ServiceMetrics | null, kind: 'cpu' | 'memory'): ResourceUsage {
  if (!metrics) {
    return { used: '—', limit: '—', pct: 0, pctLabel: '—', unbounded: false };
  }
  const v = kind === 'cpu' ? metrics.cpu : metrics.memory;
  const hasLimit = v.limitRaw > 0;
  return {
    used: v.available ? v.used : '—',
    limit: hasLimit ? v.limit : '—',
    pct: v.pct,
    pctLabel: hasLimit ? `${Math.round(v.pct * 100)}%` : '',
    unbounded: v.available && !hasLimit,
  };
}

function MetricCard({
  label,
  usage,
  unit,
}: {
  label: string;
  usage: ResourceUsage;
  unit?: string;
}) {
  return (
    <div className={`metric${usage.unbounded ? ' unbounded' : ''}`}>
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        {!usage.unbounded && (
          <span className="metric-unit">
            <span className="metric-used">{usage.used}</span>
            <span className="metric-sep">/</span>
            <span>
              {usage.limit}
              {unit ? ` ${unit}` : ''}
            </span>
          </span>
        )}
      </div>
      {usage.unbounded ? (
        <div className="metric-value">
          <span className="metric-value-big">{usage.used}</span>
          {unit && <span className="muted-text small">{unit}</span>}
          <span className="metric-hint" style={{ marginLeft: 'auto' }}>
            No limit set
          </span>
        </div>
      ) : (
        <>
          <div className="metric-bar">
            <div
              className={[
                'metric-fill',
                usage.pct > 0.6 && usage.pct <= 0.8 ? 'tone-warn' : '',
                usage.pct > 0.8 ? 'tone-danger' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ width: `${usage.pct * 100}%` }}
            ></div>
          </div>
          <div className="metric-pct">{usage.pctLabel}</div>
        </>
      )}
    </div>
  );
}

/** An instance on its way out, identified within its project. */
interface DeletionMark {
  projectId: string;
  name: string;
  service: string;
}

function marks(mark: DeletionMark | null, projectId: string, name: string): boolean {
  return !!mark && mark.projectId === projectId && mark.name === name;
}

export default function ServiceDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId = '', serviceName = '' } = useParams<{
    projectId: string;
    serviceName: string;
  }>();
  const [searchParams] = useSearchParams();
  const { toast, showSuccess, showError, showWarn } = useToastMessages();
  useRouteNotice(toast);
  // Stale-response guard: only the latest loadAll call may commit state
  // (params can change mid-flight when navigating between instances).
  const reqIdRef = useRef(0);
  // Number instance requests so an older response cannot overwrite a newer
  // successful response. Failed requests do not advance the last landed number.
  const instanceReadRef = useRef(0);
  const instanceLandedRef = useRef(0);
  const landInstance = useCallback((read: number, next: ServiceInstance | null) => {
    if (read < instanceLandedRef.current) return false;
    instanceLandedRef.current = read;
    setInstance(next);
    return true;
  }, []);

  const [instance, setInstance] = useState<ServiceInstance | null>(null);
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [metrics, setMetrics] = useState<ServiceMetrics | null>(null);
  // Type-to-confirm deletion dialog visibility.
  const [deleteVisible, setDeleteVisible] = useState(false);
  // Instance whose DELETE request is currently in flight: locks actions and
  // avoids an "Instance not found" flash if SSE DELETED arrives before the HTTP
  // response.
  const [deletingInFlight, setDeletingInFlight] = useState<DeletionMark | null>(null);
  // Instance whose deletion the engine accepted asynchronously: it shows as
  // "Deleting…" until the stream reports it DELETED, and its going away is
  // that deletion landing, not an instance that could not be found. Its
  // service keeps navigation in the instance's area once the instance is gone.
  const [requestedDeletion, setRequestedDeletion] = useState<DeletionMark | null>(null);
  // Last instance seen in the Deleting phase: its going away is that deletion
  // landing too, even when it was requested from another page.
  const [seenDeleting, setSeenDeleting] = useState<DeletionMark | null>(null);

  // The page stays mounted when it moves to another instance: what it shows
  // of the previous one goes, so nothing below mistakes it for the new one.
  const navKey = `${projectId}/${serviceName}`;
  const [shownNav, setShownNav] = useState(navKey);
  // In the render that sees the move, `instance` is still the previous one.
  const navMoved = shownNav !== navKey;
  if (navMoved) {
    setShownNav(navKey);
    // A confirmation opened for the previous instance never deletes this one.
    setDeleteVisible(false);
    setDeletingInFlight(null);
    setRequestedDeletion(null);
    setSeenDeleting(null);
    setMetrics(null);
    setSelectedPod(null);
    setInstance(null);
    setPods([]);
    setLoading(true);
  }
  // Bumped on every move and when the page goes: a DELETE answer from an
  // older generation changes nothing, even once the page is back on the same
  // instance.
  const navGenerationRef = useRef(0);
  useEffect(() => {
    navGenerationRef.current += 1;
    return () => {
      navGenerationRef.current += 1;
    };
  }, [navKey]);

  const inFlightHere = marks(deletingInFlight, projectId, serviceName) ? deletingInFlight : null;
  const deletingHere = marks(requestedDeletion, projectId, serviceName) ? requestedDeletion : null;
  if (
    !navMoved &&
    instance &&
    instancePhase(instance) === 'Deleting' &&
    (!marks(seenDeleting, projectId, instance.name) || seenDeleting?.service !== instance.service)
  ) {
    setSeenDeleting({ projectId, name: instance.name, service: instance.service });
  }
  const leavingHere =
    deletingHere ??
    inFlightHere ??
    (marks(seenDeleting, projectId, serviceName) ? seenDeleting : null);
  // Edit, Delete and Open make no sense on an instance on its way out.
  const actionsLocked =
    !!inFlightHere || !!deletingHere || (!!instance && instancePhase(instance) === 'Deleting');

  const runningPods = useMemo(
    () => pods.filter((p) => p.status === 'Running' || p.status === 'Ready').length,
    [pods],
  );

  const paramEntries = useMemo(() => {
    const params = instance?.parameters || {};
    const entries: { key: string; value: string }[] = [];
    for (const [k, v] of Object.entries(params)) {
      if (k === 'profiles') continue;
      entries.push({ key: k, value: typeof v === 'object' ? JSON.stringify(v) : String(v) });
    }
    return entries;
  }, [instance]);

  const cpuUsage = resourceUsage(metrics, 'cpu');
  const memUsage = resourceUsage(metrics, 'memory');

  const loadAll = useCallback(() => {
    const reqId = ++reqIdRef.current;
    if (!projectId || !serviceName) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const read = ++instanceReadRef.current;
    // Uncached: a cached answer may predate what the stream already showed.
    // Instance and pods are fetched independently so a pod-list failure never
    // hides the instance, and an authoritative 404 clears a pending deletion.
    serviceApi
      .getService(projectId, serviceName, true)
      .then((inst) => {
        if (reqId !== reqIdRef.current) return;
        if (!landInstance(read, inst)) return;
        setLoading(false);
        serviceApi
          .getPods(projectId, serviceName)
          .then((podList) => {
            if (reqId !== reqIdRef.current || read < instanceLandedRef.current) return;
            setPods(podList);
          })
          .catch(() => {
            // Keep the loaded instance visible even if pod listing fails.
          });
      })
      .catch((err) => {
        if (reqId !== reqIdRef.current) return;
        if (err instanceof HttpError && err.status === 404) {
          forgetDeletedInstance(projectId, serviceName);
          landInstance(read, null);
          setLoading(false);
          return;
        }
        showError('Failed to load instance details');
        setLoading(false);
      });
  }, [projectId, serviceName, showError, landInstance]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Follows the instance on the project's live stream, so a status the engine
  // reports later (Pending to Ready, a write it did not confirm) shows without
  // a reload. An event only triggers a fresh read: the stream payload lacks
  // fields the GET carries (bound connections).
  useEffect(() => {
    if (!projectId || !serviceName) return;
    // A read still in flight when the page moves to another instance must not
    // land on it.
    let active = true;
    const unsubscribe = serviceApi.subscribeServices(projectId, {
      next: (event) => {
        if (!active || event.object.name !== serviceName) return;
        if (instancePhase(event.object) === 'Deleting') {
          setSeenDeleting({ projectId, name: event.object.name, service: event.object.service });
        }
        const read = ++instanceReadRef.current;
        if (event.type === 'DELETED') {
          // The list this page goes back to must not read it back from a cache.
          forgetDeletedInstance(projectId, event.object.name);
          landInstance(read, null);
          setLoading(false);
          return;
        }
        serviceApi
          .getService(projectId, serviceName, true)
          .then((inst) => {
            if (!active || !landInstance(read, inst)) return;
            setLoading(false);
            serviceApi
              .getPods(projectId, serviceName)
              .then((podList) => {
                if (active && read >= instanceLandedRef.current) setPods(podList);
              })
              .catch(() => {
                // Keep the loaded instance visible even if pod listing fails.
              });
          })
          .catch(() => {
            // The next event or Refresh reads it again.
          });
      },
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [projectId, serviceName, landInstance]);

  // Metrics: fetch immediately then every 10s.
  useEffect(() => {
    if (!projectId || !serviceName) return;
    let cancelled = false;
    const fetchMetrics = () => {
      serviceApi
        .getServiceMetrics(projectId, serviceName)
        .then((m) => {
          if (!cancelled) setMetrics(m);
        })
        .catch(() => {
          // Leave metrics as null; UI falls back to "—".
        });
    };
    fetchMetrics();
    const id = setInterval(fetchMetrics, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [projectId, serviceName]);

  // Navigation stays inside the instance's own console area (e.g. a Trino
  // instance edits/returns under /trino, not /services). When the instance
  // could not be loaded (null), derive the parent area from the current path
  // rather than falling back to the non-existent /projects/:projectId/services
  // route.
  const encodedProject = encodeURIComponent(projectId);
  const knownService = instance?.service ?? leavingHere?.service;
  const basePath = areaBasePath(knownService).map(encodeURIComponent).join('/');
  const projectPrefix = `/projects/${encodedProject}/`;
  const trimmedPath = location.pathname.replace(/\/+$/, '');
  const rawFallback = knownService
    ? `/projects/${encodedProject}/${basePath}`
    : trimmedPath.startsWith(projectPrefix)
      ? trimmedPath.slice(0, trimmedPath.lastIndexOf('/'))
      : `/projects/${encodedProject}`;
  const fallbackBackPath = safeReturnTo(rawFallback) ?? `/projects/${encodedProject}`;

  const goBack = useCallback(
    (notice?: RouteNotice) => {
      if (!projectId) return;
      const target = safeReturnTo(searchParams.get('returnTo')) ?? fallbackBackPath;
      navigate(target, notice ? { state: withNotice(notice) } : undefined);
    },
    [projectId, searchParams, fallbackBackPath, navigate],
  );

  // The stream reported gone an instance being deleted.
  const deletionLanded = !!leavingHere && !loading && !instance;
  useEffect(() => {
    if (!deletionLanded || !leavingHere) return;
    goBack({
      severity: 'success',
      summary: 'Instance deleted',
      detail: `"${leavingHere.name}" has been removed`,
    });
  }, [deletionLanded, leavingHere, goBack]);

  // Only an http(s) URL is opened or linked.
  const externalUrl = safeExternalUrl(instance?.url);
  const openExternal = () => {
    if (externalUrl) openInNewTab(externalUrl);
  };

  const editInstance = () => {
    if (projectId) {
      const returnTo = encodeURIComponent(location.pathname + location.search);
      navigate(
        `/projects/${encodedProject}/${basePath}/${encodeURIComponent(serviceName)}/edit?returnTo=${returnTo}`,
      );
    }
  };

  const confirmDelete = () => {
    if (instance) setDeleteVisible(true);
  };

  const deleteInstance = () => {
    setDeleteVisible(false);
    if (!instance) return;
    // Once the page moved, or came back here since, the answer touches
    // nothing on screen.
    const generation = navGenerationRef.current;
    const mark: DeletionMark = { projectId, name: instance.name, service: instance.service };
    setDeletingInFlight(mark);
    const settle = (outcome: DeleteOutcome) => {
      if (outcome.kind === 'deleted') forgetDeletedInstance(projectId, instance.name);
      if (navGenerationRef.current !== generation) return;
      switch (outcome.kind) {
        case 'deleted':
          // The notice travels with the navigation: this page's toast goes
          // with it.
          goBack({
            severity: 'success',
            summary: 'Instance deleted',
            detail: `"${instance.name}" has been removed`,
          });
          return;
        case 'accepted':
          // The live stream reports the deletion landing.
          setDeletingInFlight(null);
          setRequestedDeletion(mark);
          showSuccess(acceptedDeletionDetail(instance.name), 'Deletion requested');
          return;
        case 'conflict':
          setDeletingInFlight(null);
          showError(CONFLICT_DETAIL, 'Instance not deleted');
          loadAll();
          return;
        case 'unknown':
          setDeletingInFlight(null);
          showWarn(UNKNOWN_DELETE_DETAIL, 'Deletion not confirmed');
          loadAll();
          return;
        case 'rejected':
          setDeletingInFlight(null);
          showError(outcome.message, 'Deletion refused');
          return;
      }
    };
    serviceApi
      .deleteService(projectId, instance.name, instance.desiredRevision)
      .then((result) => settle(classifyDelete(result)))
      .catch((err) => {
        const outcome = classifyWriteError(err);
        if (outcome) {
          settle(outcome);
          return;
        }
        if (navGenerationRef.current !== generation) return;
        setDeletingInFlight(null);
        showError(apiErrorMessage(err, 'Failed to delete instance'));
      });
  };

  const onViewLogs = (pod: Pod) => {
    setSelectedPod(pod);
    setTab('logs');
  };

  const tabLabel = (t: Tab) => t.charAt(0).toUpperCase() + t.slice(1);

  return (
    <>
      <Toast ref={toast} />
      <DeleteConfirmDialog
        resourceName={deleteVisible ? (instance?.name ?? null) : null}
        resourceKind="instance"
        message={
          instance && (
            <>
              This will remove <strong>{instance.name}</strong>, its pods, and the volumes it
              created for its users, notebook home directories included. This cannot be undone.
            </>
          )
        }
        onHide={() => setDeleteVisible(false)}
        onConfirm={deleteInstance}
      />

      <div className="detail-page animate-in">
        <div className="page-header">
          <nav className="breadcrumb">
            <a
              className="breadcrumb-link"
              onClick={() => goBack()}
              onKeyDown={(e) => e.key === 'Enter' && goBack()}
              tabIndex={0}
            >
              <i className="pi pi-arrow-left text-[11px]"></i>
              {parentLabel(knownService)}
            </a>
            <i className="pi pi-angle-right text-[10px] text-fg-muted"></i>
            <span className="breadcrumb-current">{instance?.name || serviceName}</span>
          </nav>

          {instance && (
            <div className="header-row">
              <div className="header-badge">
                <i className="pi pi-server"></i>
              </div>
              <div className="header-text">
                <div className="header-title-row">
                  <h2>{instance.name}</h2>
                  {deletingHere ? (
                    <StatusTag
                      value="Deleting…"
                      tone="warning"
                      icon={<i className="pi pi-spin pi-spinner text-[0.7rem]" />}
                    />
                  ) : (
                    <StatusTag
                      value={instancePhase(instance)}
                      tone={statusTone(instancePhase(instance))}
                      pulse={isTransitioning(instancePhase(instance))}
                    />
                  )}
                </div>
                <p className="page-desc">
                  {instance.service} · <span className="mono">{instance.serviceTag}</span>
                </p>
              </div>
              <div className="header-actions">
                {externalUrl && (
                  <button
                    className="btn-secondary"
                    disabled={actionsLocked || instancePhase(instance) !== 'Ready'}
                    onClick={openExternal}
                  >
                    <i className="pi pi-external-link"></i>
                    Open
                  </button>
                )}
                <button className="btn-secondary" onClick={loadAll}>
                  <i className="pi pi-refresh"></i>
                  Refresh
                </button>
                <button className="btn-secondary" disabled={actionsLocked} onClick={editInstance}>
                  <i className="pi pi-pencil"></i>
                  Edit
                </button>
                <button
                  className="btn-secondary danger"
                  disabled={actionsLocked}
                  onClick={confirmDelete}
                >
                  <i className="pi pi-trash"></i>
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <EmptyState
            variant="panel"
            icon="pi pi-spin pi-spinner"
            title="Loading instance details…"
          />
        ) : instance ? (
          <>
            <div className="okdp-tabs">
              {TABS.map((t) => (
                <button
                  key={t}
                  className={`okdp-tab${tab === t ? ' active' : ''}`}
                  onClick={() => setTab(t)}
                >
                  {tabLabel(t)}
                  {t === 'pods' && <span className="tab-count">{pods.length}</span>}
                </button>
              ))}
            </div>

            {tab === 'overview' && (
              <div className="detail-content">
                <InstanceStatusAlert
                  status={deletingHere ? 'Deleting' : instancePhase(instance)}
                  message={instance.statusMessage}
                />

                <div className="info-card">
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Instance name</span>
                      <span className="info-value">{instance.name}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Release</span>
                      <span className="info-value mono">{instance.releaseName}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Namespace</span>
                      <span className="info-value mono">{instance.targetNamespace}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Service</span>
                      <span className="info-value">{instance.service}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Version</span>
                      <span className="info-value mono">{instance.serviceTag}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Created</span>
                      <span className="info-value">
                        {instance.createdAt ? formatMediumDateTime(instance.createdAt) : '—'}
                      </span>
                    </div>
                    {instance.url && (
                      <div className="info-item info-item-wide">
                        <span className="info-label">URL</span>
                        {externalUrl ? (
                          <a
                            className="info-link mono"
                            href={externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {externalUrl}
                            <i className="pi pi-external-link text-[11px]"></i>
                          </a>
                        ) : (
                          <span className="info-value mono">{instance.url}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="section-card">
                  <div className="section-header">
                    <div className="section-icon-badge chart">
                      <i className="pi pi-chart-bar"></i>
                    </div>
                    <h3 className="section-title">Resource usage</h3>
                    <span className="muted-text small">Last 5 min</span>
                  </div>
                  <div className="metric-grid">
                    <MetricCard label="CPU" usage={cpuUsage} unit="cores" />
                    <MetricCard label="Memory" usage={memUsage} />
                  </div>
                </div>

                {/* What the service actually runs against. The page showed the
                    parameters it was deployed with, never the connections the
                    controller resolved, so "which database is my Superset on"
                    had no answer here. An unresolved one is the case a reader
                    opens this page for, so it is listed too. */}
                {instance.connections && instance.connections.length > 0 && (
                  <div className="section-card">
                    <div className="section-header">
                      <div className="section-icon-badge">
                        <i className="pi pi-link"></i>
                      </div>
                      <h3 className="section-title">Connections</h3>
                    </div>
                    <ul className="reset-list">
                      {instance.connections.map((connection) => (
                        <li
                          key={`${connection.kind}/${connection.namespace ?? ''}/${connection.name}`}
                          className="flex items-center gap-2 py-1.5 text-[13px]"
                        >
                          <span className="mono flex-1 break-all">{connection.name}</span>
                          {connection.kind === 'ClusterConnection' && (
                            <span className="muted-text small">platform</span>
                          )}
                          <StatusTag
                            value={connectionStateTag(connection).label}
                            tone={connectionStateTag(connection).tone}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="section-card">
                  <div className="section-header">
                    <div className="section-icon-badge">
                      <i className="pi pi-box"></i>
                    </div>
                    <h3 className="section-title">Pods</h3>
                    <span className="muted-text small">
                      {runningPods} / {pods.length} running
                    </span>
                  </div>
                  <PodList pods={pods} onViewLogs={onViewLogs} />
                </div>
              </div>
            )}

            {tab === 'pods' && (
              <div className="section-card">
                <PodList pods={pods} onViewLogs={onViewLogs} />
              </div>
            )}

            {tab === 'logs' &&
              (pods.length > 0 ? (
                <PodLogViewer
                  projectId={projectId}
                  serviceName={serviceName}
                  pods={pods}
                  initialPodName={selectedPod?.name}
                />
              ) : (
                <div className="section-card">
                  <div className="section-header">
                    <div className="section-icon-badge">
                      <i className="pi pi-file"></i>
                    </div>
                    <h3 className="section-title">Logs</h3>
                  </div>
                  <p className="muted-text" style={{ padding: '12px 0 0' }}>
                    No pods available yet. Logs will appear here once the service is running.
                  </p>
                </div>
              ))}

            {tab === 'parameters' && (
              <div className="section-card">
                {paramEntries.length > 0 ? (
                  <div className="param-list">
                    {paramEntries.map((param) => (
                      <div key={param.key} className="param-row">
                        <span className="param-key mono">{param.key}</span>
                        <span className="param-value mono">{param.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted-text">No parameters set on this instance.</p>
                )}
              </div>
            )}
          </>
        ) : leavingHere ? (
          <EmptyState
            variant="panel"
            icon="pi pi-check-circle"
            title="Instance deleted"
            description="The instance has been removed."
            action={
              <button className="btn-secondary" onClick={() => goBack()}>
                <i className="pi pi-arrow-left"></i>
                Back to instances
              </button>
            }
          />
        ) : (
          <EmptyState
            variant="panel"
            icon="pi pi-exclamation-triangle"
            title="Instance not found"
            description="The service instance could not be loaded."
            action={
              <button className="btn-secondary" onClick={() => goBack()}>
                <i className="pi pi-arrow-left"></i>
                Back to instances
              </button>
            }
          />
        )}
      </div>
    </>
  );
}
