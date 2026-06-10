import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { serviceApi } from '../../../core/api/service-api';
import { applyListEvent } from '../../../core/api/sse';
import type { ServiceInstance } from '../../../core/models/service.model';
import { apiErrorMessage, formatMediumDate, tagClass } from './service-utils';

type StatusFilter = 'All' | 'Ready' | 'Installing' | 'Updating' | 'Error';

export interface ServiceListProps {
  serviceFilter?: string;
  emptyMessage?: string;
  emptyTitle?: string;
  /**
   * URL segments under /project/:projectId for the parent "area" (e.g.
   * ['services'] for Jupyter, ['spark', 'history-server'] for Spark
   * History Server). Used for detail/edit navigation so the sidebar
   * highlights the correct entry.
   */
  basePath?: string[];
  onDeploy: () => void;
}

export function ServiceList({
  serviceFilter,
  emptyMessage = 'No instances deployed yet.',
  emptyTitle = 'No instances yet',
  basePath = ['services'],
  onDeploy,
}: ServiceListProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId: projectName } = useParams<{ projectId: string }>();
  const toast = useRef<Toast>(null);

  const [services, setServices] = useState<ServiceInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('All');

  useEffect(() => {
    if (!projectName) return;

    const matchesFilter = (instance: ServiceInstance) =>
      !serviceFilter || instance.service === serviceFilter;

    let cancelled = false;
    setLoading(true);
    serviceApi
      .getServices(projectName)
      .then((data) => {
        if (cancelled) return;
        setServices(data.filter(matchesFilter));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load services',
        });
        setLoading(false);
      });

    const unsubscribe = serviceApi.subscribeServices(projectName, {
      next: (event) => {
        if (!matchesFilter(event.object)) return;
        setServices((current) => applyListEvent(current, event, (s) => s.name));
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [projectName, serviceFilter]);

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
        `/project/${projectName}/${basePath.join('/')}/${svc.name}?returnTo=${encodeURIComponent(currentUrl)}`,
      );
    }
  };

  const editService = (svc: ServiceInstance) => {
    if (projectName) {
      navigate(
        `/project/${projectName}/${basePath.join('/')}/${svc.name}/edit?returnTo=${encodeURIComponent(currentUrl)}`,
      );
    }
  };

  const openService = (svc: ServiceInstance) => {
    if (svc.url) {
      window.open(svc.url, '_blank');
    }
  };

  const confirmDelete = (svc: ServiceInstance) => {
    confirmDialog({
      message: `This will remove "${svc.name}" and all its pods. This cannot be undone.`,
      header: 'Delete this instance?',
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-danger',
      accept: () => {
        if (!projectName) return;
        serviceApi
          .deleteService(projectName, svc.name)
          .then(() => {
            toast.current?.show({
              severity: 'success',
              summary: 'Instance deleted',
              detail: `"${svc.name}" has been removed`,
            });
            setServices((current) => current.filter((s) => s.name !== svc.name));
          })
          .catch((err) => {
            toast.current?.show({
              severity: 'error',
              summary: 'Error',
              detail: apiErrorMessage(err, 'Failed to delete instance'),
            });
          });
      },
    });
  };

  return (
    <>
      <Toast ref={toast} />
      <ConfirmDialog />

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

      <div className="okdp-filter-bar">
        <div className="okdp-search-wrapper">
          <i className="pi pi-search search-icon"></i>
          <input
            className="okdp-search-input"
            placeholder="Filter by name, version, namespace…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="filter-hint">
          {filtered.length} of {services.length}
        </div>
      </div>

      {loading ? (
        <div className="empty-state-panel">
          <div className="empty-icon-wrapper">
            <i className="pi pi-spin pi-spinner"></i>
          </div>
          <h3>Loading instances…</h3>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state-panel">
          <div className="empty-icon-wrapper">
            <i className={hasFilter ? 'pi pi-search' : 'pi pi-server'}></i>
          </div>
          <h3>{hasFilter ? 'No instances match' : emptyTitle}</h3>
          <p>
            {hasFilter ? 'Try clearing the filter or searching by a different term.' : emptyMessage}
          </p>
          {!hasFilter && (
            <button className="create-btn" onClick={onDeploy}>
              <i className="pi pi-plus"></i>
              <span>New instance</span>
            </button>
          )}
        </div>
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
              {filtered.map((svc) => (
                <tr key={svc.name} className="clickable-row" onClick={() => viewDetail(svc)}>
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
                    <span className={`okdp-tag ${tagClass(svc.status)}`}>
                      {(svc.status === 'Installing' || svc.status === 'Updating') && (
                        <span className="okdp-tag-dot"></span>
                      )}
                      {svc.status}
                    </span>
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
                      <button className="icon-btn" title="Edit" onClick={() => editService(svc)}>
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
                        onClick={() => confirmDelete(svc)}
                      >
                        <i className="pi pi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
