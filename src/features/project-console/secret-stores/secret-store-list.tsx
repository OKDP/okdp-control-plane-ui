import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Checkbox } from 'primereact/checkbox';
import { Tag } from 'primereact/tag';
import { Menu } from 'primereact/menu';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import type { MenuItem } from 'primereact/menuitem';
import {
  secretStoreApi,
  type SecretStore,
  type SecretStoreRequest,
  type SecretStoreStatusDetail,
  type VaultAuthType,
} from '../../../core/api/secret-store-api';
import { apiErrorMessage, formatMediumDateTime } from '../services/service-utils';
import { getConditionClass, getConditionIcon, statusSeverity } from './secret-status';
import './secret-store-list.css';

const NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const POLL_INTERVAL_MS = 10_000;

const AUTH_TYPE_OPTIONS: { label: string; value: VaultAuthType }[] = [
  { label: 'Token', value: 'token' },
  { label: 'Kubernetes', value: 'kubernetes' },
];

interface StoreForm {
  storeName: string;
  vaultServer: string;
  vaultPath: string;
  vaultVersion: 'v1' | 'v2';
  caBundle: string;
  authType: VaultAuthType;
  authToken: string;
  authMountPath: string;
  authRole: string;
  isDefault: boolean;
}

const EMPTY_FORM: StoreForm = {
  storeName: '',
  vaultServer: '',
  vaultPath: '',
  vaultVersion: 'v2',
  caBundle: '',
  authType: 'token',
  authToken: '',
  authMountPath: '',
  authRole: '',
  isDefault: false,
};

const getStatusSeverity = (status: string) => statusSeverity(status, 'Ready');

export function SecretStoreList() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const toast = useRef<Toast>(null);
  const menuRef = useRef<Menu>(null);
  const selectedStoreRef = useRef<SecretStore | null>(null);

  const [stores, setStores] = useState<SecretStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState('');

  // Dialog state
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<StoreForm>(EMPTY_FORM);

  // Status detail state
  const [statusDialogVisible, setStatusDialogVisible] = useState(false);
  const [statusDetail, setStatusDetail] = useState<SecretStoreStatusDetail | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [selectedStoreName, setSelectedStoreName] = useState('');
  const statusLoadingRef = useRef(false);
  statusLoadingRef.current = statusLoading;

  const patchForm = (patch: Partial<StoreForm>) => setForm((f) => ({ ...f, ...patch }));

  const showSuccess = (detail: string) =>
    toast.current?.show({ severity: 'success', summary: 'Success', detail, life: 3000 });
  const showError = (detail: string) =>
    toast.current?.show({ severity: 'error', summary: 'Error', detail, life: 5000 });

  const mergeStores = useCallback((incoming: SecretStore[]) => {
    setStores((current) => {
      if (current.length !== incoming.length) {
        return incoming;
      }
      const changed = incoming.some((s, i) => {
        const c = current[i];
        return (
          s.name !== c.name ||
          s.status !== c.status ||
          s.lastCheckedAt !== c.lastCheckedAt ||
          s.lastError !== c.lastError ||
          s.isDefault !== c.isDefault
        );
      });
      return changed ? incoming : current;
    });
  }, []);

  const loadStores = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    secretStoreApi
      .list(projectId)
      .then((data) => {
        setStores(data);
        setLoading(false);
      })
      .catch(() => {
        showError('Failed to load secret stores');
        setLoading(false);
      });
  }, [projectId]);

  // Initial load + 10s polling while a project is selected
  useEffect(() => {
    if (!projectId) return;
    loadStores();
    const timer = setInterval(() => {
      secretStoreApi
        .list(projectId)
        .then(mergeStores)
        .catch(() => undefined);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [projectId, loadStores, mergeStores]);

  // --- Name validation ---
  const nameError = (() => {
    if (!form.storeName) return '';
    if (form.storeName.length > 63) return 'Maximum 63 characters';
    if (!NAME_PATTERN.test(form.storeName)) {
      return 'Lowercase letters, numbers and hyphens only (must start/end with alphanumeric)';
    }
    return '';
  })();

  const formValid = (() => {
    if (!form.storeName || !form.vaultServer || !form.vaultPath) return false;
    if (nameError) return false;
    if (form.authType === 'token' && !form.authToken && !editMode) return false;
    if (form.authType === 'kubernetes' && !form.authRole) return false;
    return true;
  })();

  // --- Dialog ---
  const showCreateDialog = () => {
    setForm(EMPTY_FORM);
    setEditMode(false);
    setDialogVisible(true);
  };

  const showEditDialog = (store: SecretStore) => {
    setEditMode(true);
    setForm({
      storeName: store.name,
      vaultServer: store.vault?.server ?? '',
      vaultPath: store.vault?.path ?? '',
      vaultVersion: store.vault?.version ?? 'v2',
      caBundle: store.vault?.caBundle ?? '',
      authType: store.auth?.type ?? 'token',
      authToken: '',
      authMountPath: store.auth?.config?.mountPath ?? '',
      authRole: store.auth?.config?.role ?? '',
      isDefault: store.isDefault,
    });
    setDialogVisible(true);
  };

  const buildRequest = (): SecretStoreRequest => ({
    name: form.storeName,
    provider: 'vault',
    vault: {
      server: form.vaultServer,
      path: form.vaultPath,
      version: form.vaultVersion,
      caBundle: form.caBundle || undefined,
    },
    auth: {
      type: form.authType,
      config: {
        token: form.authType === 'token' ? form.authToken || undefined : undefined,
        mountPath: form.authType === 'kubernetes' ? form.authMountPath || undefined : undefined,
        role: form.authType === 'kubernetes' ? form.authRole || undefined : undefined,
      },
    },
    isDefault: form.isDefault,
  });

  const testConnection = () => {
    setTesting(true);
    secretStoreApi
      .testConnection(projectId, buildRequest())
      .then(() => {
        setTesting(false);
        showSuccess('Connection successful!');
      })
      .catch((err) => {
        setTesting(false);
        showError(`Connection test failed: ${apiErrorMessage(err, 'Connection failed')}`);
      });
  };

  const saveStore = () => {
    setSaving(true);
    const request = buildRequest();
    const save = editMode
      ? secretStoreApi.update(projectId, form.storeName, request)
      : secretStoreApi.create(projectId, request);

    save
      .then(() => {
        setSaving(false);
        setDialogVisible(false);
        showSuccess(
          `Secret store "${form.storeName}" ${editMode ? 'updated' : 'created'} successfully`,
        );
        loadStores();
      })
      .catch((err) => {
        setSaving(false);
        showError(apiErrorMessage(err, `Failed to ${editMode ? 'update' : 'create'} secret store`));
      });
  };

  const confirmDelete = (store: SecretStore) => {
    confirmDialog({
      message: (
        <span>
          Are you sure you want to delete <strong>{store.name}</strong>? This action cannot be
          undone.
        </span>
      ),
      header: 'Delete secret store?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => {
        secretStoreApi
          .delete(projectId, store.name)
          .then(() => {
            showSuccess(`Secret store "${store.name}" deleted successfully`);
            loadStores();
          })
          .catch((err) => {
            showError(apiErrorMessage(err, 'Failed to delete secret store'));
          });
      },
    });
  };

  // --- Status detail ---
  const fetchStatusDetail = useCallback(
    (storeName: string, fallback?: SecretStore) => {
      secretStoreApi
        .getStatus(projectId, storeName)
        .then((detail) => {
          setStatusDetail(detail);
          setStatusLoading(false);
        })
        .catch(() => {
          if (fallback) {
            setStatusDetail({
              status: fallback.status,
              conditions: [],
              lastCheckedAt: fallback.lastCheckedAt,
              lastError: fallback.lastError,
            });
          }
          setStatusLoading(false);
        });
    },
    [projectId],
  );

  const showStatusDetail = (store: SecretStore) => {
    setSelectedStoreName(store.name);
    setStatusLoading(true);
    setStatusDetail(null);
    setStatusDialogVisible(true);
    fetchStatusDetail(store.name, store);
  };

  // Poll the status detail while the dialog is open
  useEffect(() => {
    if (!statusDialogVisible || !selectedStoreName || !projectId) return;
    const timer = setInterval(() => {
      if (statusLoadingRef.current) return;
      fetchStatusDetail(selectedStoreName);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [statusDialogVisible, selectedStoreName, projectId, fetchStatusDetail]);

  const refreshStatus = () => {
    if (!selectedStoreName || !projectId) return;
    setStatusLoading(true);

    secretStoreApi
      .list(projectId)
      .then((data) => {
        mergeStores(data);
        const freshStore = data.find((s) => s.name === selectedStoreName);
        if (freshStore) {
          setStatusDetail({
            status: freshStore.status,
            conditions: [],
            lastCheckedAt: freshStore.lastCheckedAt,
            lastError: freshStore.lastError,
          });
          fetchStatusDetail(freshStore.name);
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
        if (selectedStoreRef.current) showStatusDetail(selectedStoreRef.current);
      },
    },
    {
      label: 'Edit',
      icon: 'pi pi-pencil',
      command: () => {
        if (selectedStoreRef.current) showEditDialog(selectedStoreRef.current);
      },
    },
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      command: () => {
        if (selectedStoreRef.current) confirmDelete(selectedStoreRef.current);
      },
    },
  ];

  const dialogFooter = (
    <div
      className="dialog-actions"
      style={{ display: 'flex', gap: 'var(--db-space-sm)', alignItems: 'center', width: '100%' }}
    >
      <Button
        severity="secondary"
        outlined
        icon={testing ? 'pi pi-spin pi-spinner' : 'pi pi-check-circle'}
        label="Test Connection"
        onClick={testConnection}
        disabled={testing || saving || !form.vaultServer}
      />
      <div className="spacer" style={{ flex: 1 }}></div>
      <Button
        severity="secondary"
        outlined
        label="Cancel"
        onClick={() => setDialogVisible(false)}
        disabled={testing || saving}
      />
      <Button
        icon={saving ? 'pi pi-spin pi-spinner' : undefined}
        label={editMode ? 'Save' : 'Create'}
        disabled={testing || saving || !formValid}
        onClick={saveStore}
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
          <h1>Secret Stores</h1>
          <IconField>
            <InputIcon className="pi pi-search" />
            <InputText
              type="text"
              placeholder="Filter stores..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          </IconField>
        </div>

        <Button label="Add secret store" onClick={showCreateDialog} className="create-btn" />
      </div>

      {/* Data Table */}
      <div className="table-wrapper">
        <DataTable
          value={stores}
          loading={loading}
          globalFilter={globalFilter}
          globalFilterFields={['name', 'provider', 'status', 'vault.server']}
          className="minimal-table"
          dataKey="name"
          rowClassName={() => 'cluster-row'}
          emptyMessage={
            <div className="empty-state-inline">
              <i className="pi pi-lock"></i>
              <span>
                No secret stores configured. Click <strong>Add secret store</strong> to connect one.
              </span>
            </div>
          }
        >
          <Column
            header="Name"
            field="name"
            style={{ width: '20%' }}
            body={(store: SecretStore) => (
              <>
                <span className="store-name">{store.name}</span>
                {store.isDefault && <span className="default-badge">default</span>}
              </>
            )}
          />
          <Column
            header="Provider"
            field="provider"
            style={{ width: '12%' }}
            body={(store: SecretStore) => (
              <span className="provider-badge">
                <i className="pi pi-shield"></i>
                {store.provider}
              </span>
            )}
          />
          <Column
            header="Server"
            style={{ width: '28%' }}
            className="endpoint-cell"
            body={(store: SecretStore) => (
              <span title={store.vault?.server || ''}>{store.vault?.server || '-'}</span>
            )}
          />
          <Column
            header="Status"
            field="status"
            style={{ width: '10%' }}
            body={(store: SecretStore) => (
              <span title={store.lastError || ''}>
                <Tag value={store.status} severity={getStatusSeverity(store.status)} />
              </span>
            )}
          />
          <Column
            header="Last Checked"
            style={{ width: '18%' }}
            className="date-cell"
            body={(store: SecretStore) =>
              store.lastCheckedAt ? formatMediumDateTime(store.lastCheckedAt) : '-'
            }
          />
          <Column
            style={{ width: '12%', textAlign: 'right' }}
            body={(store: SecretStore) => (
              <div className="actions">
                <Button
                  icon="pi pi-info-circle"
                  text
                  rounded
                  onClick={() => showStatusDetail(store)}
                  title="View status"
                  aria-label={`View status for ${store.name}`}
                />
                <Button
                  icon="pi pi-ellipsis-v"
                  text
                  rounded
                  aria-label={`Actions for ${store.name}`}
                  onClick={(e) => {
                    selectedStoreRef.current = store;
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
        header={editMode ? 'Edit secret store' : 'Add secret store'}
        visible={dialogVisible}
        modal
        draggable={false}
        resizable={false}
        style={{ width: '600px' }}
        className="db-dialog"
        closable
        onHide={() => setDialogVisible(false)}
        footer={dialogFooter}
      >
        <div className="dialog-content">
          {/* Store Name */}
          <div className="field">
            <label htmlFor="storeName">Store name</label>
            <InputText
              id="storeName"
              value={form.storeName}
              onChange={(e) => patchForm({ storeName: e.target.value })}
              className={`w-full dialog-input${nameError ? ' input-error' : ''}`}
              placeholder="e.g., vault-main"
              disabled={editMode}
            />
            {nameError && <small className="field-error">{nameError}</small>}
          </div>

          <hr className="divider" />
          <h4 className="section-title">Vault Connection</h4>

          {/* Server */}
          <div className="field">
            <label htmlFor="vaultServer">Server URL</label>
            <InputText
              id="vaultServer"
              value={form.vaultServer}
              onChange={(e) => patchForm({ vaultServer: e.target.value })}
              className="w-full dialog-input"
              placeholder="https://vault.example.com:8200"
            />
          </div>

          {/* Path */}
          <div className="field">
            <label htmlFor="vaultPath">Secret path</label>
            <InputText
              id="vaultPath"
              value={form.vaultPath}
              onChange={(e) => patchForm({ vaultPath: e.target.value })}
              className="w-full dialog-input"
              placeholder="e.g., secret"
            />
          </div>

          {/* Version */}
          <div className="field">
            <label htmlFor="vaultVersion">KV version</label>
            <div className="mode-switch" role="radiogroup" aria-label="KV version">
              <button
                className={`mode-btn${form.vaultVersion === 'v2' ? ' active' : ''}`}
                onClick={() => patchForm({ vaultVersion: 'v2' })}
                role="radio"
                aria-checked={form.vaultVersion === 'v2'}
              >
                v2
              </button>
              <button
                className={`mode-btn${form.vaultVersion === 'v1' ? ' active' : ''}`}
                onClick={() => patchForm({ vaultVersion: 'v1' })}
                role="radio"
                aria-checked={form.vaultVersion === 'v1'}
              >
                v1
              </button>
            </div>
          </div>

          {/* CA Bundle */}
          <div className="field">
            <label htmlFor="caBundle">
              CA Bundle <span className="optional">(optional)</span>
            </label>
            <InputTextarea
              id="caBundle"
              value={form.caBundle}
              onChange={(e) => patchForm({ caBundle: e.target.value })}
              className="w-full dialog-input credential-input"
              placeholder={'-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
              rows={3}
            />
          </div>

          <hr className="divider" />
          <h4 className="section-title">
            Authentication{' '}
            {editMode && <span className="optional">(leave empty to keep existing)</span>}
          </h4>

          {/* Auth Type Switch */}
          <div className="mode-switch" role="radiogroup" aria-label="Authentication type">
            {AUTH_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`mode-btn${form.authType === opt.value ? ' active' : ''}`}
                onClick={() => patchForm({ authType: opt.value })}
                role="radio"
                aria-checked={form.authType === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Token Auth */}
          {form.authType === 'token' && (
            <div className="field">
              <label htmlFor="authToken">Vault Token</label>
              <InputText
                id="authToken"
                value={form.authToken}
                onChange={(e) => patchForm({ authToken: e.target.value })}
                className="w-full dialog-input"
                type="password"
                placeholder={
                  editMode ? '(existing token preserved - leave empty to keep)' : 'hvs.XXXX...'
                }
              />
            </div>
          )}

          {/* Kubernetes Auth */}
          {form.authType === 'kubernetes' && (
            <>
              <div className="field">
                <label htmlFor="authMountPath">
                  Mount path <span className="optional">(optional)</span>
                </label>
                <InputText
                  id="authMountPath"
                  value={form.authMountPath}
                  onChange={(e) => patchForm({ authMountPath: e.target.value })}
                  className="w-full dialog-input"
                  placeholder="kubernetes"
                />
              </div>
              <div className="field">
                <label htmlFor="authRole">Role</label>
                <InputText
                  id="authRole"
                  value={form.authRole}
                  onChange={(e) => patchForm({ authRole: e.target.value })}
                  className="w-full dialog-input"
                  placeholder="e.g., my-app-role"
                />
              </div>
            </>
          )}

          {/* Options */}
          <hr className="divider" />
          <div className="field checkbox-field">
            <Checkbox
              checked={form.isDefault}
              onChange={(e) => patchForm({ isDefault: !!e.checked })}
              inputId="isDefault"
            />
            <label htmlFor="isDefault" className="checkbox-label">
              Set as default store for this project
            </label>
          </div>
        </div>
      </Dialog>

      {/* Status Detail Dialog */}
      <Dialog
        header={`Status: ${selectedStoreName}`}
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
                  {statusDetail.lastCheckedAt && (
                    <div className="status-row">
                      <span className="status-label">Last checked</span>
                      <span className="status-value">
                        {formatMediumDateTime(statusDetail.lastCheckedAt)}
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
