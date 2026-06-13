import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Toast } from 'primereact/toast';
import DeleteConfirmDialog from '../../../shared/components/delete-confirm-dialog';
import EmptyState from '../../../shared/components/empty-state';
import SearchFilter from '../../../shared/components/search-filter';
import { serviceApi } from '../../../core/api/service-api';
import { applyListEvent } from '../../../core/api/sse';
import { readUiCache, writeUiCache } from '../../../core/api/ui-cache';
import type { ServiceInstance } from '../../../core/models/service.model';
import { useToastMessages } from '../../../shared/hooks/use-toast-messages';
import {
  apiErrorMessage,
  formatMediumDate,
  isTransitioning,
  openInNewTab,
  statusTone,
} from './service-utils';
import { StatusTag } from '../../../shared/components/status-tag';

type StatusFilter = 'All' | 'Ready' | 'Installing' | 'Updating' | 'Error';

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
  const { toast, showSuccess, showError } = useToastMessages();

  const [services, setServices] = useState<ServiceInstance[]>([]);
  // Deletion runs until the backend confirms (slow helm uninstall); these
  // names render as "Deleting…" with their row actions disabled.
  const [deletingNames, setDeletingNames] = useState<Set<string>>(new Set());
  // Instance pending the type-to-confirm deletion dialog.
  const [deleteTarget, setDeleteTarget] = useState<ServiceInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('All');

  useEffect(() => {
    if (!projectName) return;

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
        writeUiCache(`services:${projectName}`, data);
        setServices(data.filter(matchesFilter));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        showError('Failed to load services');
        setLoading(false);
      });

    const unsubscribe = serviceApi.subscribeServices(projectName, {
      next: (event) => {
        if (!matchesFilter(event.object)) return;
        if (event.type === 'DELETED') {
          setDeletingNames((names) => {
            if (!names.has(event.object.name)) return names;
            const next = new Set(names);
            next.delete(event.object.name);
            return next;
          });
        }
        setServices((current) => applyListEvent(current, event, (s) => s.name));
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [projectName, serviceFilter, showError]);

  const statChips = useMemo(
    () => [
      { key: 'All' as StatusFilter, count: services.length, tone: 'neutral' as const },
      {
        key: 'Ready' as StatusFilter,
        count: services.filter((s) => s.status === 'Ready').length,
        tone: 'success' as const,
      },
      {
        key: 'Installing' as StatusFilter,
        count: services.filter((s) => s.status === 'Installing' || s.status === 'Updating').length,
        tone: 'warn' as const,
      },
      {
        key: 'Error' as StatusFilter,
        count: services.filter((s) => s.status === 'Error').length,
        tone: 'danger' as const,
      },
    ],
    [services],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s) => {
      if (filterStatus !== 'All') {
        // "Installing" tab groups Installing + Updating (in-progress reconciliation)
        const matches =
          filterStatus === 'Installing'
            ? s.status === 'Installing' || s.status === 'Updating'
            : s.status === filterStatus;
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
        `/projects/${projectName}/${basePath.join('/')}/${svc.name}?returnTo=${encodeURIComponent(currentUrl)}`,
      );
    }
  };

  const editService = (svc: ServiceInstance) => {
    if (projectName) {
      navigate(
        `/projects/${projectName}/${basePath.join('/')}/${svc.name}/edit?returnTo=${encodeURIComponent(currentUrl)}`,
      );
    }
  };

  const openService = (svc: ServiceInstance) => {
    if (svc.url) {
      openInNewTab(svc.url);
    }
  };

  const confirmDelete = (svc: ServiceInstance) => setDeleteTarget(svc);

  const deleteInstance = (svc: ServiceInstance) => {
    setDeleteTarget(null);
    if (!projectName) return;
    const clearDeleting = () =>
      setDeletingNames((names) => {
        const next = new Set(names);
        next.delete(svc.name);
        return next;
      });
    setDeletingNames((names) => new Set(names).add(svc.name));
    serviceApi
      .deleteService(projectName, svc.name)
      .then(() => {
        showSuccess(`"${svc.name}" has been removed`, 'Instance deleted');
        clearDeleting();
        setServices((current) => current.filter((s) => s.name !== svc.name));
      })
      .catch((err) => {
        clearDeleting();
        showError(apiErrorMessage(err, 'Failed to delete instance'));
      });
  };

  return (
    <>
      <Toast ref={toast} />
      <DeleteConfirmDialog
        resourceName={deleteTarget?.name ?? null}
        resourceKind="instance"
        message={
          deleteTarget && (
            <>
              This will remove <strong>{deleteTarget.name}</strong> and all its pods. This cannot be
              undone.
            </>
          )
        }
        onHide={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteInstance(deleteTarget)}
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
                const deleting = deletingNames.has(svc.name);
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
                          value={svc.status}
                          tone={statusTone(svc.status)}
                          pulse={isTransitioning(svc.status)}
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
                          disabled={deleting}
                          onClick={() => editService(svc)}
                        >
                          <i className="pi pi-pencil"></i>
                        </button>
                        {svc.url && (
                          <button
                            className="icon-btn primary"
                            title="Open in a new tab"
                            disabled={svc.status !== 'Ready'}
                            onClick={() => openService(svc)}
                          >
                            <i className="pi pi-external-link"></i>
                          </button>
                        )}
                        <button
                          className="icon-btn danger"
                          title="Delete"
                          disabled={deleting}
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
