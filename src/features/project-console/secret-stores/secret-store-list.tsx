import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Checkbox } from 'primereact/checkbox';
import { Menu } from 'primereact/menu';
import { Toast } from 'primereact/toast';
import type { MenuItem } from 'primereact/menuitem';
import {
  secretStoreApi,
  type SecretStore,
  type SecretStoreRequest,
  type SecretStoreStatusDetail,
  type VaultAuthType,
} from '../../../core/api/secret-store-api';
import { apiErrorMessage, formatMediumDateTime } from '../services/service-utils';
import { statusTone } from './secret-status';
import { StatusTag } from '../../../shared/components/status-tag';
import { StatusDetailContent } from './status-detail';
import SearchFilter from '../../../shared/components/search-filter';
import { PageHeader } from '../../../shared/components/page-header';
import { useToastMessages } from '../../../shared/hooks/use-toast-messages';
import { k8sNameError } from '../../../shared/utils/k8s-names';
import { DialogFooter } from '../../../shared/components/dialog-footer';
import DeleteConfirmDialog from '../../../shared/components/delete-confirm-dialog';

const SECTION_TITLE_CLASS = 'm-0 mb-3 text-[14px] font-semibold text-fg';
const DIVIDER_CLASS = 'my-4 border-0 border-t border-t-border';
const MODE_SWITCH_CLASS =
  'mb-4 flex rounded-sm border border-border-light bg-surface-secondary p-1';
const MODE_BTN_CLASS =
  'flex-1 cursor-pointer rounded-xs border-none p-2 transition-all duration-200';
const MODE_BTN_ACTIVE_CLASS = 'bg-surface font-semibold text-fg shadow-[0_1px_3px_rgba(0,0,0,0.1)]';
const MODE_BTN_IDLE_CLASS = 'bg-transparent font-medium text-fg-secondary';

const modeBtnClass = (active: boolean) =>
  `${MODE_BTN_CLASS} ${active ? MODE_BTN_ACTIVE_CLASS : MODE_BTN_IDLE_CLASS}`;

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

const getStatusTone = (status: string) => statusTone(status, 'Ready');

export function SecretStoreList() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { toast, showSuccess, showError } = useToastMessages();
  const menuRef = useRef<Menu>(null);
  const selectedStoreRef = useRef<SecretStore | null>(null);

  const [stores, setStores] = useState<SecretStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SecretStore | null>(null);

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
  }, [projectId, showError]);

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
  const nameError = k8sNameError(form.storeName);

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

  const confirmDelete = (store: SecretStore) => setDeleteTarget(store);

  const deleteStore = (store: SecretStore) => {
    secretStoreApi
      .delete(projectId, store.name)
      .then(() => {
        showSuccess(`Secret store "${store.name}" deleted successfully`);
        loadStores();
      })
      .catch((err) => {
        showError(apiErrorMessage(err, 'Failed to delete secret store'));
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
    <DialogFooter
      onCancel={() => setDialogVisible(false)}
      onConfirm={saveStore}
      confirmLabel={editMode ? 'Save' : 'Create'}
      confirmDisabled={testing || !formValid}
      cancelDisabled={testing}
      busy={saving}
      leading={
        <Button
          severity="secondary"
          outlined
          icon={testing ? 'pi pi-spin pi-spinner' : 'pi pi-check-circle'}
          label="Test Connection"
          onClick={testConnection}
          disabled={testing || saving || !form.vaultServer}
        />
      }
    />
  );

  const statusDialogFooter = (
    <div className="dialog-actions items-center">
      <Button
        severity="secondary"
        outlined
        icon="pi pi-refresh"
        label="Refresh"
        onClick={refreshStatus}
        disabled={statusLoading}
      />
      <div className="flex-1"></div>
      <Button
        severity="secondary"
        outlined
        label="Close"
        onClick={() => setStatusDialogVisible(false)}
      />
    </div>
  );

  return (
    <div>
      {/* Top Bar */}
      <PageHeader
        title="Secret Stores"
        actions={
          <button className="create-btn" onClick={showCreateDialog}>
            <i className="pi pi-plus"></i>
            <span>Add secret store</span>
          </button>
        }
      />

      <SearchFilter
        value={globalFilter}
        onChange={setGlobalFilter}
        placeholder="Filter stores..."
      />

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
            <div className="flex items-center justify-center gap-2 p-8 text-[14px] text-fg-secondary">
              <i className="pi pi-lock text-[1.2rem] opacity-50"></i>
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
                <span className="font-medium">{store.name}</span>
                {store.isDefault && <span className="okdp-tag okdp-tag-info ml-2">default</span>}
              </>
            )}
          />
          <Column
            header="Provider"
            field="provider"
            style={{ width: '12%' }}
            body={(store: SecretStore) => (
              <span className="inline-flex items-center gap-1.5 rounded-xs border border-border-light bg-surface-secondary px-2 py-[3px] text-[12px] font-medium text-fg-secondary capitalize">
                <i className="pi pi-shield text-[11px]"></i>
                {store.provider}
              </span>
            )}
          />
          <Column
            header="Server"
            style={{ width: '28%' }}
            className="max-w-0 overflow-hidden text-[13px] text-ellipsis whitespace-nowrap text-fg-secondary mono"
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
                <StatusTag
                  value={store.status}
                  tone={getStatusTone(store.status)}
                  pulse={store.status === 'Pending'}
                />
              </span>
            )}
          />
          <Column
            header="Last Checked"
            style={{ width: '18%' }}
            className="text-[13px] whitespace-nowrap text-fg-secondary"
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
              className={`w-full dialog-input${nameError ? ' border-danger!' : ''}`}
              placeholder="e.g., vault-main"
              disabled={editMode}
            />
            {nameError && <small className="mt-1 block text-[12px] text-danger">{nameError}</small>}
          </div>

          <hr className={DIVIDER_CLASS} />
          <h4 className={SECTION_TITLE_CLASS}>Vault Connection</h4>

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
            <div className={MODE_SWITCH_CLASS} role="radiogroup" aria-label="KV version">
              <button
                className={modeBtnClass(form.vaultVersion === 'v2')}
                onClick={() => patchForm({ vaultVersion: 'v2' })}
                role="radio"
                aria-checked={form.vaultVersion === 'v2'}
              >
                v2
              </button>
              <button
                className={modeBtnClass(form.vaultVersion === 'v1')}
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
              className="w-full dialog-input resize-y text-[12px]! mono"
              placeholder={'-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
              rows={3}
            />
          </div>

          <hr className={DIVIDER_CLASS} />
          <h4 className={SECTION_TITLE_CLASS}>
            Authentication{' '}
            {editMode && <span className="optional">(leave empty to keep existing)</span>}
          </h4>

          {/* Auth Type Switch */}
          <div className={MODE_SWITCH_CLASS} role="radiogroup" aria-label="Authentication type">
            {AUTH_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={modeBtnClass(form.authType === opt.value)}
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
          <hr className={DIVIDER_CLASS} />
          <div className="mb-5 flex items-center gap-2">
            <Checkbox
              checked={form.isDefault}
              onChange={(e) => patchForm({ isDefault: !!e.checked })}
              inputId="isDefault"
            />
            <label htmlFor="isDefault" className="m-0 cursor-pointer text-[14px] text-fg">
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
        <StatusDetailContent
          loading={statusLoading}
          detail={statusDetail}
          tone={statusDetail ? getStatusTone(statusDetail.status) : 'info'}
          checkedLabel="Last checked"
          checkedAt={statusDetail?.lastCheckedAt}
        />
      </Dialog>

      <DeleteConfirmDialog
        resourceName={deleteTarget?.name ?? null}
        resourceKind="secret store"
        message={
          deleteTarget && (
            <>
              This will remove <strong>{deleteTarget.name}</strong>. This action cannot be undone.
            </>
          )
        }
        onHide={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteStore(deleteTarget);
          setDeleteTarget(null);
        }}
      />

      <Toast ref={toast} position="bottom-right" />
    </div>
  );
}
