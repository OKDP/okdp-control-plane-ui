import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Toast } from 'primereact/toast';
import DeleteConfirmDialog from '../../../shared/components/delete-confirm-dialog';
import EmptyState from '../../../shared/components/empty-state';
import SearchFilter from '../../../shared/components/search-filter';
import { serviceApi } from '../../../core/api/service-api';
import { applyListEvent } from '../../../core/api/sse';
import { readUiCache, writeUiCache } from '../../../core/api/ui-cache';
import {
  createDeletionGuard,
  forgetDeletedInstance,
  type DeletionGuard,
  type GuardedRead,
} from '../../../core/api/service-deletions';
import type { ServiceInstance } from '../../../core/models/service.model';
import { useToastMessages } from '../../../shared/hooks/use-toast-messages';
import { useRouteNotice } from '../../../shared/hooks/use-route-notice';
import {
  apiErrorMessage,
  formatMediumDate,
  instancePhase,
  isInProgress,
  isTransitioning,
  needsAttention,
  openInNewTab,
  safeExternalUrl,
  statusTone,
} from './service-utils';
import { StatusTag } from '../../../shared/components/status-tag';
import {
  acceptedDeletionDetail,
  classifyDelete,
  classifyWriteError,
  CONFLICT_DETAIL,
  UNKNOWN_DELETE_DETAIL,
  type DeleteOutcome,
} from './write-outcome';

type StatusFilter = 'All' | 'Ready' | 'In progress' | 'Error';

const deletingKey = (scope: string, name: string) => `${scope}\n${name}`;

export interface ServiceListProps {
  serviceFilter?: string;
  emptyMessage?: string;
  emptyTitle?: string;
  /**
   * URL segments under /projects/:projectId for the parent "area" (e.g.
   * ['jupyterhub'], ['spark', 'history-server']). Used for detail/edit
   * navigation so the sidebar highlights the correct entry.
   */
  basePath?: string[];
  onDeploy: () => void;
}

export function ServiceList({
  serviceFilter,
  emptyMessage = 'No instances deployed yet.',
  emptyTitle = 'No instances yet',
  basePath = ['jupyterhub'],
  onDeploy,
}: ServiceListProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId: projectName } = useParams<{ projectId: string }>();
  const { toast, showSuccess, showError, showWarn } = useToastMessages();
  useRouteNotice(toast);

  const [services, setServices] = useState<ServiceInstance[]>([]);
  // Deletion runs until the backend confirms, or, for a deletion the engine
  // accepted asynchronously, until the stream reports the instance DELETED.
  // These rows render as "Deleting…" with their actions disabled. Keyed by
  // scope and name: a deletion in one project never marks a same-named
  // instance of another.
  const [deletingKeys, setDeletingKeys] = useState<Set<string>>(new Set());
  const scope = projectName ? `${projectName}|${serviceFilter ?? ''}` : '';
  // Instance pending the type-to-confirm deletion dialog.
  // Bound to the scope it was opened in: it never confirms a deletion in
  // another project.
  const [deleteTarget, setDeleteTarget] = useState<{
    scope: string;
    svc: ServiceInstance;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('All');

  // Project and filter the rows belong to. A read started for another scope
  // must not land on this one.
  // Bumped whenever the scope changes or the page goes: an answer to a read
  // or a deletion started under an older generation changes nothing, even
  // once the page is back on the same scope.
  const generationRef = useRef(0);
  // Instances the stream deleted, for the reads of the current scope.
  const deletionsRef = useRef<DeletionGuard | null>(null);
  // Reloads still in flight, released with the scope they belong to.
  const reloadsRef = useRef(new Set<GuardedRead>());

  useEffect(() => {
    if (!projectName) return;
    const effectScope = `${projectName}|${serviceFilter ?? ''}`;
    generationRef.current += 1;
    const deletions = createDeletionGuard(projectName);
    deletionsRef.current = deletions;
    const read = deletions.startRead();
    const reloads = reloadsRef.current;
    // Marks of another scope mean nothing here, and would outlive their
    // deletion.
    setDeletingKeys(new Set());
    setDeleteTarget(null);

    const matchesFilter = (instance: ServiceInstance) =>
      !serviceFilter || instance.service === serviceFilter;

    let cancelled = false;
    // Recent snapshot: skip the loading panel; the fetch below still runs.
    const cached = readUiCache<ServiceInstance[]>(`services:${projectName}`);
    setServices(cached ? cached.filter(matchesFilter) : []);
    setLoading(!cached);
    serviceApi
      .getServices(projectName)
      .then((data) => {
        if (cancelled) return;
        const current = read.reconcile(data);
        writeUiCache(`services:${projectName}`, current);
        setServices(current.filter(matchesFilter));
        setLoading(false);
      })
      .catch(() => {
        read.release();
        if (cancelled) return;
        showError('Failed to load services');
        setLoading(false);
      });

    const unsubscribe = serviceApi.subscribeServices(projectName, {
      next: (event) => {
        deletions.track(event);
        if (event.type === 'DELETED') {
          // A revisit must not read the instance back from a cache.
          forgetDeletedInstance(projectName, event.object.name);
        }
        if (!matchesFilter(event.object)) return;
        if (event.type === 'DELETED') {
          const key = deletingKey(effectScope, event.object.name);
          setDeletingKeys((keys) => {
            if (!keys.has(key)) return keys;
            const next = new Set(keys);
            next.delete(key);
            return next;
          });
        }
        setServices((current) => applyListEvent(current, event, (s) => s.name));
      },
    });

    return () => {
      cancelled = true;
      generationRef.current += 1;
      deletionsRef.current = null;
      read.release();
      for (const reload of reloads) reload.release();
      reloads.clear();
      unsubscribe();
    };
  }, [projectName, serviceFilter, showError]);

  const statChips = useMemo(
    () => [
      { key: 'All' as StatusFilter, count: services.length, tone: 'neutral' as const },
      {
        key: 'Ready' as StatusFilter,
        count: services.filter((s) => instancePhase(s) === 'Ready').length,
        tone: 'success' as const,
      },
      {
        key: 'In progress' as StatusFilter,
        count: services.filter((s) => isInProgress(instancePhase(s))).length,
        tone: 'warn' as const,
      },
      {
        key: 'Error' as StatusFilter,
        count: services.filter((s) => needsAttention(instancePhase(s))).length,
        tone: 'danger' as const,
      },
    ],
    [services],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s) => {
      if (filterStatus !== 'All') {
        const matches =
          filterStatus === 'In progress'
            ? isInProgress(instancePhase(s))
            : filterStatus === 'Error'
              ? needsAttention(instancePhase(s))
              : instancePhase(s) === filterStatus;
        if (!matches) return false;
      }
      if (!q) return true;
      const hay = `${s.name} ${s.service} ${s.serviceTag} ${s.targetNamespace ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [services, query, filterStatus]);

  const hasFilter = !!query.trim() || filterStatus !== 'All';
  const currentUrl = location.pathname + location.search;

  const viewDetail = (svc: ServiceInstance) => {
    if (projectName) {
      navigate(
        `/projects/${encodeURIComponent(projectName)}/${basePath.map(encodeURIComponent).join('/')}/${encodeURIComponent(svc.name)}?returnTo=${encodeURIComponent(currentUrl)}`,
      );
    }
  };

  const editService = (svc: ServiceInstance) => {
    if (projectName) {
      navigate(
        `/projects/${encodeURIComponent(projectName)}/${basePath.map(encodeURIComponent).join('/')}/${encodeURIComponent(svc.name)}/edit?returnTo=${encodeURIComponent(currentUrl)}`,
      );
    }
  };

  const openService = (svc: ServiceInstance) => {
    if (svc.url) {
      openInNewTab(svc.url);
    }
  };

  const confirmDelete = (svc: ServiceInstance) => setDeleteTarget({ scope, svc });
  const pendingDelete = deleteTarget?.scope === scope ? deleteTarget.svc : null;

  /** Reads the list again, for a retry to start from the current state. The
   *  deletion just cleared the GET cache. */
  const reloadServices = () => {
    if (!projectName || !deletionsRef.current) return;
    const generation = generationRef.current;
    const read = deletionsRef.current.startRead();
    const reloads = reloadsRef.current;
    reloads.add(read);
    serviceApi
      .getServices(projectName)
      .then((data) => {
        reloads.delete(read);
        if (generationRef.current !== generation) {
          read.release();
          return;
        }
        const current = read.reconcile(data);
        writeUiCache(`services:${projectName}`, current);
        setServices(current.filter((s) => !serviceFilter || s.service === serviceFilter));
      })
      .catch(() => {
        // The stream or the next visit reads it again.
        reloads.delete(read);
        read.release();
      });
  };

  const deleteInstance = (svc: ServiceInstance) => {
    setDeleteTarget(null);
    if (!projectName) return;
    const project = projectName;
    // Once the page shows another scope, or came back to this one since,
    // the answer touches nothing on screen.
    const generation = generationRef.current;
    const key = deletingKey(scope, svc.name);
    const clearDeleting = () =>
      setDeletingKeys((keys) => {
        if (!keys.has(key)) return keys;
        const next = new Set(keys);
        next.delete(key);
        return next;
      });
    setDeletingKeys((keys) => new Set(keys).add(key));
    const settle = (outcome: DeleteOutcome) => {
      if (outcome.kind === 'deleted') forgetDeletedInstance(project, svc.name);
      if (generationRef.current !== generation) return;
      switch (outcome.kind) {
        case 'deleted':
          showSuccess(`"${svc.name}" has been removed`, 'Instance deleted');
          clearDeleting();
          setServices((current) => current.filter((s) => s.name !== svc.name));
          return;
        case 'accepted':
          // The row stays until the stream reports the instance DELETED.
          showSuccess(acceptedDeletionDetail(svc.name), 'Deletion requested');
          return;
        case 'conflict':
          clearDeleting();
          showError(CONFLICT_DETAIL, 'Instance not deleted');
          reloadServices();
          return;
        case 'unknown':
          clearDeleting();
          showWarn(UNKNOWN_DELETE_DETAIL, 'Deletion not confirmed');
          reloadServices();
          return;
        case 'rejected':
          clearDeleting();
          showError(outcome.message, 'Deletion refused');
          return;
      }
    };
    serviceApi
      .deleteService(project, svc.name, svc.desiredRevision)
      .then((result) => settle(classifyDelete(result)))
      .catch((err) => {
        const outcome = classifyWriteError(err);
        if (outcome) {
          settle(outcome);
          return;
        }
        if (generationRef.current !== generation) return;
        clearDeleting();
        showError(apiErrorMessage(err, 'Failed to delete instance'));
      });
  };

  return (
    <>
      <Toast ref={toast} />
      <DeleteConfirmDialog
        resourceName={pendingDelete?.name ?? null}
        resourceKind="instance"
        message={
          pendingDelete && (
            <>
              This will remove <strong>{pendingDelete.name}</strong> and all its pods. This cannot
              be undone.
            </>
          )
        }
        onHide={() => setDeleteTarget(null)}
        onConfirm={() => pendingDelete && deleteInstance(pendingDelete)}
      />

      <div className="stat-strip">
        {statChips.map((chip) => (
          <button
            key={chip.key}
            className={[
              'stat-chip',
              filterStatus === chip.key ? 'active' : '',
              chip.tone === 'warn' ? 'chip-warn' : '',
              chip.tone === 'danger' ? 'chip-danger' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setFilterStatus(chip.key)}
          >
            <span className="sc-label">{chip.key}</span>
            <span className="sc-count">{chip.count}</span>
          </button>
        ))}
      </div>

      <SearchFilter
        value={query}
        onChange={setQuery}
        placeholder="Filter by name, version, namespace…"
        hint={`${filtered.length} of ${services.length}`}
      />

      {loading ? (
        <EmptyState variant="panel" icon="pi pi-spin pi-spinner" title="Loading instances…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          variant="panel"
          icon={hasFilter ? 'pi pi-search' : 'pi pi-server'}
          title={hasFilter ? 'No instances match' : emptyTitle}
          description={
            hasFilter ? 'Try clearing the filter or searching by a different term.' : emptyMessage
          }
          action={
            !hasFilter && (
              <button className="create-btn" onClick={onDeploy}>
                <i className="pi pi-plus"></i>
                <span>New instance</span>
              </button>
            )
          }
        />
      ) : (
        <div className="okdp-table-wrapper">
          <table className="okdp-table">
            <thead>
              <tr>
                <th style={{ width: '32%' }}>Instance</th>
                <th style={{ width: '16%' }}>Version</th>
                <th style={{ width: '12%' }}>Status</th>
                <th style={{ width: '14%' }}>Namespace</th>
                <th style={{ width: '12%' }}>Created</th>
                <th style={{ width: '14%' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((svc) => {
                const deleting = deletingKeys.has(deletingKey(scope, svc.name));
                // Edit and Delete make no sense on an instance on its way out.
                const locked = deleting || instancePhase(svc) === 'Deleting';
                return (
                  <tr
                    key={svc.name}
                    className={deleting ? 'clickable-row opacity-50' : 'clickable-row'}
                    onClick={() => viewDetail(svc)}
                  >
                    <td>
                      <div className="cell-instance">
                        <span className="cell-name">{svc.name}</span>
                        <span className="cell-ns mono">{svc.releaseName || svc.service}</span>
                      </div>
                    </td>
                    <td>
                      <span className="version-badge mono">{svc.serviceTag}</span>
                    </td>
                    <td>
                      {deleting ? (
                        <StatusTag
                          value="Deleting…"
                          tone="warning"
                          icon={<i className="pi pi-spin pi-spinner text-[0.7rem]" />}
                        />
                      ) : (
                        <StatusTag
                          value={instancePhase(svc)}
                          tone={statusTone(instancePhase(svc))}
                          pulse={isTransitioning(instancePhase(svc))}
                        />
                      )}
                    </td>
                    <td>
                      <span className="muted-text small mono">{svc.targetNamespace || '—'}</span>
                    </td>
                    <td>
                      <span className="muted-text">
                        {svc.createdAt ? formatMediumDate(svc.createdAt) : '—'}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="okdp-actions">
                        <button
                          className="icon-btn"
                          title="View details"
                          onClick={() => viewDetail(svc)}
                        >
                          <i className="pi pi-eye"></i>
                        </button>
                        <button
                          className="icon-btn"
                          title="Edit"
                          disabled={locked}
                          onClick={() => editService(svc)}
                        >
                          <i className="pi pi-pencil"></i>
                        </button>
                        {safeExternalUrl(svc.url) && (
                          <button
                            className="icon-btn primary"
                            title="Open in a new tab"
                            disabled={locked || instancePhase(svc) !== 'Ready'}
                            onClick={() => openService(svc)}
                          >
                            <i className="pi pi-external-link"></i>
                          </button>
                        )}
                        <button
                          className="icon-btn danger"
                          title="Delete"
                          disabled={locked}
                          onClick={() => confirmDelete(svc)}
                        >
                          <i className="pi pi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
