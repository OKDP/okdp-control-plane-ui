import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Tag } from 'primereact/tag';
import { Menu } from 'primereact/menu';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import type { MenuItem } from 'primereact/menuitem';
import {
  externalSecretApi,
  type ExternalSecret,
  type ExternalSecretRequest,
  type ExternalSecretDataRef,
  type ExternalSecretStatusDetail,
} from '../../../core/api/external-secret-api';
import { secretStoreApi, type SecretStore } from '../../../core/api/secret-store-api';
import { apiErrorMessage, formatMediumDateTime } from '../services/service-utils';
import { getConditionClass, getConditionIcon, statusSeverity } from './secret-status';
import './external-secret-list.css';

const NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const POLL_INTERVAL_MS = 10_000;

const REFRESH_OPTIONS = [
  { label: '1 minute', value: '1m' },
  { label: '5 minutes', value: '5m' },
  { label: '15 minutes', value: '15m' },
  { label: '30 minutes', value: '30m' },
  { label: '1 hour', value: '1h' },
  { label: '6 hours', value: '6h' },
  { label: '24 hours', value: '24h' },
];

const EMPTY_MAPPING = (): ExternalSecretDataRef => ({
  secretKey: '',
  remoteRef: { key: '', property: '' },
});

const getStatusSeverity = (status: string) => statusSeverity(status, 'Synced');

export function ExternalSecretList() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const toast = useRef<Toast>(null);
  const menuRef = useRef<Menu>(null);
  const selectedSecretRef = useRef<ExternalSecret | null>(null);

  const [secrets, setSecrets] = useState<ExternalSecret[]>([]);
  const [loading, setLoading] = useState(true);
  const [readyStores, setReadyStores] = useState<SecretStore[]>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Dialog state
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [secretName, setSecretName] = useState('');
  const [selectedStoreRefName, setSelectedStoreRefName] = useState('');
  const [targetName, setTargetName] = useState('');
  const [refreshInterval, setRefreshInterval] = useState('1h');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dataMappings, setDataMappings] = useState<ExternalSecretDataRef[]>([EMPTY_MAPPING()]);

  // Status detail state
  const [statusDialogVisible, setStatusDialogVisible] = useState(false);
  const [statusDetail, setStatusDetail] = useState<ExternalSecretStatusDetail | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [selectedSecretName, setSelectedSecretName] = useState('');
  const statusLoadingRef = useRef(false);
  statusLoadingRef.current = statusLoading;

  const showSuccess = (detail: string) =>
    toast.current?.show({ severity: 'success', summary: 'Success', detail, life: 3000 });
  const showError = (detail: string) =>
    toast.current?.show({ severity: 'error', summary: 'Error', detail, life: 5000 });

  const mergeSecrets = useCallback((incoming: ExternalSecret[]) => {
    setSecrets((current) => {
      if (current.length !== incoming.length) {
        return incoming;
      }
      const changed = incoming.some((s, i) => {
        const c = current[i];
        return (
          s.name !== c.name ||
          s.status !== c.status ||
          s.lastSyncedAt !== c.lastSyncedAt ||
          s.lastError !== c.lastError
        );
      });
      return changed ? incoming : current;
    });
  }, []);

  const loadSecrets = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    externalSecretApi
      .list(projectId)
      .then((data) => {
        setSecrets(data);
        setLoading(false);
      })
      .catch(() => {
        showError('Failed to load external secrets');
        setLoading(false);
      });
  }, [projectId]);

  const loadReadyStores = useCallback(() => {
    if (!projectId) return;
    secretStoreApi
      .list(projectId)
      .then((stores) => setReadyStores(stores.filter((s) => s.status === 'Ready')))
      .catch(() => undefined);
  }, [projectId]);

  // Initial load + 10s polling while a project is selected
  useEffect(() => {
    if (!projectId) return;
    loadSecrets();
    loadReadyStores();
    const timer = setInterval(() => {
      externalSecretApi
        .list(projectId)
        .then(mergeSecrets)
        .catch(() => undefined);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [projectId, loadSecrets, loadReadyStores, mergeSecrets]);

  // --- Name validation ---
  const nameError = (() => {
    if (!secretName) return '';
    if (secretName.length > 63) return 'Maximum 63 characters';
    if (!NAME_PATTERN.test(secretName)) {
      return 'Lowercase letters, numbers and hyphens only (must start/end with alphanumeric)';
    }
    return '';
  })();

  const formValid = (() => {
    if (!secretName || !selectedStoreRefName) return false;
    if (nameError) return false;
    return dataMappings.some((m) => m.secretKey && m.remoteRef.key);
  })();

  // --- Dialog ---
  const resetForm = () => {
    setSecretName('');
    setSelectedStoreRefName('');
    setTargetName('');
    setRefreshInterval('1h');
    setShowAdvanced(false);
    setDataMappings([EMPTY_MAPPING()]);
  };

  const showCreateDialog = () => {
    loadReadyStores();
    resetForm();
    setEditMode(false);
    setDialogVisible(true);
  };

  const showEditDialog = (es: ExternalSecret) => {
    loadReadyStores();
    setEditMode(true);
    setSecretName(es.name);
    setSelectedStoreRefName(es.secretStoreRef);
    setTargetName(es.target?.name ?? '');
    setRefreshInterval(es.refreshInterval || '1h');
    setShowAdvanced(!!es.target?.name && es.target.name !== es.name);
    setDataMappings(
      es.data?.length
        ? es.data.map((d) => ({
            secretKey: d.secretKey,
            remoteRef: { key: d.remoteRef.key, property: d.remoteRef.property || '' },
          }))
        : [EMPTY_MAPPING()],
    );
    setDialogVisible(true);
  };

  const addMapping = () => setDataMappings((list) => [...list, EMPTY_MAPPING()]);

  const removeMapping = (index: number) =>
    setDataMappings((list) => {
      const next = list.filter((_, i) => i !== index);
      return next.length === 0 ? [EMPTY_MAPPING()] : next;
    });

  const patchMapping = (index: number, patch: Partial<ExternalSecretDataRef>) =>
    setDataMappings((list) =>
      list.map((m, i) =>
        i === index ? { ...m, ...patch, remoteRef: { ...m.remoteRef, ...patch.remoteRef } } : m,
      ),
    );

  const buildRequest = (): ExternalSecretRequest => ({
    name: secretName,
    secretStoreRef: selectedStoreRefName,
    target: { name: targetName || secretName },
    refreshInterval,
    data: dataMappings
      .filter((m) => m.secretKey && m.remoteRef.key)
      .map((m) => ({
        secretKey: m.secretKey,
        remoteRef: {
          key: m.remoteRef.key,
          property: m.remoteRef.property || undefined,
        },
      })),
  });

  const saveSecret = () => {
    setSaving(true);
    const request = buildRequest();
    const save = editMode
      ? externalSecretApi.update(projectId, secretName, request)
      : externalSecretApi.create(projectId, request);

    save
      .then(() => {
        setSaving(false);
        setDialogVisible(false);
        showSuccess(
          `External secret "${secretName}" ${editMode ? 'updated' : 'created'} successfully`,
        );
        loadSecrets();
      })
      .catch((err) => {
        setSaving(false);
        showError(
          apiErrorMessage(err, `Failed to ${editMode ? 'update' : 'create'} external secret`),
        );
      });
  };

  const confirmDelete = (es: ExternalSecret) => {
    confirmDialog({
      message: (
        <span>
          Are you sure you want to delete <strong>{es.name}</strong>? The associated Kubernetes
          secret will also be removed.
        </span>
      ),
      header: 'Delete external secret?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => {
        externalSecretApi
          .delete(projectId, es.name)
          .then(() => {
            showSuccess(`External secret "${es.name}" deleted successfully`);
            loadSecrets();
          })
          .catch((err) => {
            showError(apiErrorMessage(err, 'Failed to delete external secret'));
          });
      },
    });
  };

  // --- Status detail ---
  const fetchStatusDetail = useCallback(
    (name: string, fallback?: ExternalSecret) => {
      externalSecretApi
        .getStatus(projectId, name)
        .then((detail) => {
          setStatusDetail(detail);
          setStatusLoading(false);
        })
        .catch(() => {
          if (fallback) {
            setStatusDetail({
              status: fallback.status,
              conditions: [],
              lastSyncedAt: fallback.lastSyncedAt,
              lastError: fallback.lastError,
            });
          }
          setStatusLoading(false);
        });
    },
    [projectId],
  );

  const showStatusDetail = (es: ExternalSecret) => {
    setSelectedSecretName(es.name);
    setStatusLoading(true);
    setStatusDetail(null);
    setStatusDialogVisible(true);
    fetchStatusDetail(es.name, es);
  };

  // Poll the status detail while the dialog is open
  useEffect(() => {
    if (!statusDialogVisible || !selectedSecretName || !projectId) return;
    const timer = setInterval(() => {
      if (statusLoadingRef.current) return;
      fetchStatusDetail(selectedSecretName);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [statusDialogVisible, selectedSecretName, projectId, fetchStatusDetail]);

  const refreshStatus = () => {
    if (!selectedSecretName || !projectId) return;
    setStatusLoading(true);

    externalSecretApi
      .list(projectId)
      .then((data) => {
        mergeSecrets(data);
        const fresh = data.find((s) => s.name === selectedSecretName);
        if (fresh) {
          setStatusDetail({
            status: fresh.status,
            conditions: [],
            lastSyncedAt: fresh.lastSyncedAt,
            lastError: fresh.lastError,
          });
          fetchStatusDetail(fresh.name);
        } else {
          setStatusLoading(false);
        }
      })
      .catch(() => {
        showError('Failed to refresh status');
        setStatusLoading(false);
      });
  };

  const menuItems: MenuItem[] = [
    {
      label: 'View Status',
      icon: 'pi pi-info-circle',
      command: () => {
        if (selectedSecretRef.current) showStatusDetail(selectedSecretRef.current);
      },
    },
    {
      label: 'Edit',
      icon: 'pi pi-pencil',
      command: () => {
        if (selectedSecretRef.current) showEditDialog(selectedSecretRef.current);
      },
    },
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      command: () => {
        if (selectedSecretRef.current) confirmDelete(selectedSecretRef.current);
      },
    },
  ];

  const dialogFooter = (
    <div
      className="dialog-actions"
      style={{ display: 'flex', gap: 'var(--db-space-sm)', alignItems: 'center', width: '100%' }}
    >
      <div className="spacer" style={{ flex: 1 }}></div>
      <Button
        severity="secondary"
        outlined
        label="Cancel"
        onClick={() => setDialogVisible(false)}
        disabled={saving}
      />
      <Button
        icon={saving ? 'pi pi-spin pi-spinner' : undefined}
        label={editMode ? 'Save' : 'Create'}
        disabled={saving || !formValid}
        onClick={saveSecret}
      />
    </div>
  );

  const statusDialogFooter = (
    <div
      className="dialog-actions"
      style={{ display: 'flex', gap: 'var(--db-space-sm)', alignItems: 'center', width: '100%' }}
    >
      <Button
        severity="secondary"
        outlined
        icon="pi pi-refresh"
        label="Refresh"
        onClick={refreshStatus}
        disabled={statusLoading}
      />
      <div className="spacer" style={{ flex: 1 }}></div>
      <Button
        severity="secondary"
        outlined
        label="Close"
        onClick={() => setStatusDialogVisible(false)}
      />
    </div>
  );

  return (
    <div className="cluster-container">
      {/* Top Bar */}
      <div className="top-bar">
        <div className="left-group">
          <h1>External Secrets</h1>
          <IconField>
            <InputIcon className="pi pi-search" />
            <InputText
              type="text"
              placeholder="Filter secrets..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          </IconField>
        </div>

        <Button label="Add external secret" onClick={showCreateDialog} className="create-btn" />
      </div>

      {/* Data Table */}
      <div className="table-wrapper">
        <DataTable
          value={secrets}
          loading={loading}
          globalFilter={globalFilter}
          globalFilterFields={['name', 'secretStoreRef', 'target.name', 'status']}
          className="minimal-table"
          dataKey="name"
          rowClassName={() => 'cluster-row'}
          emptyMessage={
            <div className="empty-state-inline">
              <i className="pi pi-key"></i>
              <span>
                No external secrets configured. Click <strong>Add external secret</strong> to create
                one.
              </span>
            </div>
          }
        >
          <Column
            header="Name"
            field="name"
            style={{ width: '20%' }}
            body={(es: ExternalSecret) => <span className="es-name">{es.name}</span>}
          />
          <Column
            header="Secret Store"
            field="secretStoreRef"
            style={{ width: '16%' }}
            body={(es: ExternalSecret) => (
              <span className="store-ref-badge">
                <i className="pi pi-database"></i>
                {es.secretStoreRef}
              </span>
            )}
          />
          <Column
            header="Target Secret"
            style={{ width: '20%' }}
            body={(es: ExternalSecret) => (
              <span className="target-name">{es.target?.name || '-'}</span>
            )}
          />
          <Column
            header="Status"
            field="status"
            style={{ width: '10%' }}
            body={(es: ExternalSecret) => (
              <span title={es.lastError || ''}>
                <Tag value={es.status} severity={getStatusSeverity(es.status)} />
              </span>
            )}
          />
          <Column
            header="Last Synced"
            style={{ width: '22%' }}
            className="date-cell"
            body={(es: ExternalSecret) =>
              es.lastSyncedAt ? formatMediumDateTime(es.lastSyncedAt) : '-'
            }
          />
          <Column
            style={{ width: '12%', textAlign: 'right' }}
            body={(es: ExternalSecret) => (
              <div className="actions">
                <Button
                  icon="pi pi-info-circle"
                  text
                  rounded
                  onClick={() => showStatusDetail(es)}
                  title="View status"
                  aria-label={`View status for ${es.name}`}
                />
                <Button
                  icon="pi pi-ellipsis-v"
                  text
                  rounded
                  aria-label={`Actions for ${es.name}`}
                  onClick={(e) => {
                    selectedSecretRef.current = es;
                    menuRef.current?.toggle(e);
                  }}
                />
              </div>
            )}
          />
        </DataTable>
        <Menu ref={menuRef} model={menuItems} popup appendTo={document.body} />
      </div>

      {/* Create / Edit Dialog */}
      <Dialog
        header={editMode ? 'Edit external secret' : 'Add external secret'}
        visible={dialogVisible}
        modal
        draggable={false}
        resizable={false}
        style={{ width: '650px' }}
        className="db-dialog"
        closable
        onHide={() => setDialogVisible(false)}
        footer={dialogFooter}
      >
        <div className="dialog-content">
          {/* Name */}
          <div className="field">
            <label htmlFor="esName">Name</label>
            <InputText
              id="esName"
              value={secretName}
              onChange={(e) => setSecretName(e.target.value)}
              className={`w-full dialog-input${nameError ? ' input-error' : ''}`}
              placeholder="e.g., db-credentials"
              disabled={editMode}
            />
            {nameError && <small className="field-error">{nameError}</small>}
          </div>

          <hr className="divider" />
          <h4 className="section-title">Source</h4>

          {/* Secret Store */}
          <div className="field">
            <label htmlFor="storeRef">Secret Store</label>
            {readyStores.length === 0 ? (
              <div className="no-stores-hint">
                <i className="pi pi-info-circle"></i>
                <span>
                  No ready secret stores available. Create and connect a secret store first.
                </span>
              </div>
            ) : (
              <Dropdown
                id="storeRef"
                options={readyStores}
                value={selectedStoreRefName}
                onChange={(e) => setSelectedStoreRefName(e.value)}
                optionLabel="name"
                optionValue="name"
                placeholder="Select a secret store"
                className="w-full"
                appendTo={document.body}
                itemTemplate={(store: SecretStore) => (
                  <div className="store-option">
                    <span className="store-option-name">{store.name}</span>
                    <span className="store-option-provider">{store.provider}</span>
                  </div>
                )}
              />
            )}
          </div>

          {/* Refresh Interval */}
          <div className="field">
            <label htmlFor="refreshInterval">Refresh interval</label>
            <Dropdown
              id="refreshInterval"
              options={REFRESH_OPTIONS}
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(e.value)}
              optionLabel="label"
              optionValue="value"
              className="w-full"
              appendTo={document.body}
            />
          </div>

          <hr className="divider" />
          <h4 className="section-title">Data Mappings</h4>
          <p className="mapping-help">
            Map keys from the remote secret store to keys in the Kubernetes Secret.
          </p>

          <div className="mappings-list">
            {dataMappings.map((mapping, index) => (
              <div key={index} className="mapping-row">
                <div className="mapping-fields">
                  <div className="mapping-field">
                    <label>Secret Key</label>
                    <InputText
                      value={mapping.secretKey}
                      onChange={(e) => patchMapping(index, { secretKey: e.target.value })}
                      className="dialog-input"
                      placeholder="e.g., DB_PASSWORD"
                    />
                  </div>
                  <div className="mapping-field">
                    <label>Remote Key</label>
                    <InputText
                      value={mapping.remoteRef.key}
                      onChange={(e) =>
                        patchMapping(index, {
                          remoteRef: { ...mapping.remoteRef, key: e.target.value },
                        })
                      }
                      className="dialog-input"
                      placeholder="e.g., myapp/db"
                    />
                  </div>
                  <div className="mapping-field mapping-field-sm">
                    <label>
                      Property <span className="optional">(opt.)</span>
                    </label>
                    <InputText
                      value={mapping.remoteRef.property ?? ''}
                      onChange={(e) =>
                        patchMapping(index, {
                          remoteRef: { ...mapping.remoteRef, property: e.target.value },
                        })
                      }
                      className="dialog-input"
                      placeholder="e.g., password"
                    />
                  </div>
                  <Button
                    icon="pi pi-times"
                    text
                    severity="danger"
                    onClick={() => removeMapping(index)}
                    disabled={dataMappings.length <= 1}
                    aria-label="Remove mapping"
                  />
                </div>
              </div>
            ))}
          </div>
          <Button icon="pi pi-plus" text label="Add mapping" onClick={addMapping} />

          {/* Advanced */}
          <hr className="divider" />
          <button
            className="advanced-toggle"
            onClick={() => setShowAdvanced((v) => !v)}
            type="button"
          >
            <i className={showAdvanced ? 'pi pi-chevron-down' : 'pi pi-chevron-right'}></i>
            <span>Advanced</span>
            {!showAdvanced && targetName && targetName !== secretName && (
              <span className="advanced-hint">Target: {targetName}</span>
            )}
          </button>

          {showAdvanced && (
            <div className="advanced-section">
              <div className="field">
                <label htmlFor="targetName">Kubernetes Secret name</label>
                <InputText
                  id="targetName"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  className="w-full dialog-input"
                  placeholder={secretName || 'Same as name'}
                />
                <small className="field-hint">
                  Defaults to the external secret name. Override to use a different name for the
                  Kubernetes Secret.
                </small>
              </div>
            </div>
          )}
        </div>
      </Dialog>

      {/* Status Detail Dialog */}
      <Dialog
        header={`Status: ${selectedSecretName}`}
        visible={statusDialogVisible}
        modal
        draggable={false}
        resizable={false}
        style={{ width: '600px' }}
        className="db-dialog"
        closable
        onHide={() => setStatusDialogVisible(false)}
        footer={statusDialogFooter}
      >
        <div className="status-content">
          {statusLoading ? (
            <div className="status-loading">
              <i className="pi pi-spin pi-spinner"></i>
              <span>Loading status...</span>
            </div>
          ) : (
            statusDetail && (
              <>
                <div className="status-summary">
                  <div className="status-row">
                    <span className="status-label">Status</span>
                    <Tag
                      value={statusDetail.status}
                      severity={getStatusSeverity(statusDetail.status)}
                    />
                  </div>
                  {statusDetail.lastSyncedAt && (
                    <div className="status-row">
                      <span className="status-label">Last synced</span>
                      <span className="status-value">
                        {formatMediumDateTime(statusDetail.lastSyncedAt)}
                      </span>
                    </div>
                  )}
                </div>

                {statusDetail.lastError && (
                  <div className="error-block">
                    <div className="error-block-header">
                      <i className="pi pi-exclamation-triangle"></i>
                      <span>Error details</span>
                    </div>
                    <pre className="error-block-body">{statusDetail.lastError}</pre>
                  </div>
                )}

                {statusDetail.conditions.length > 0 && (
                  <>
                    <h4 className="section-title conditions-title">Conditions</h4>
                    <div className="conditions-list">
                      {statusDetail.conditions.map((cond) => (
                        <div
                          key={cond.type}
                          className={`condition-item ${getConditionClass(cond)}`}
                        >
                          <div className="condition-header">
                            <i className={getConditionIcon(cond)}></i>
                            <span className="condition-type">
                              {cond.type}: {cond.status === 'True' ? 'True' : 'False'}
                            </span>
                            {cond.reason && (
                              <span className="condition-reason-badge">{cond.reason}</span>
                            )}
                          </div>
                          {cond.message && <pre className="condition-message">{cond.message}</pre>}
                          {cond.lastTransitionTime && (
                            <span className="condition-time">
                              {formatMediumDateTime(cond.lastTransitionTime)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        className="db-confirm-dialog"
        style={{ width: '440px' }}
        acceptClassName="p-button-danger"
        rejectClassName="p-button-text"
      />

      <Toast ref={toast} position="bottom-right" />
    </div>
  );
}
