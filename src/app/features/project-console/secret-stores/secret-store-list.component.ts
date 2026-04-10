import { Component, inject, signal, effect, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { MenuModule } from 'primeng/menu';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { CheckboxModule } from 'primeng/checkbox';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';
import {
    SecretStore,
    SecretStoreApiService,
    SecretStoreRequest,
    SecretStoreStatusDetail,
    SecretStoreCondition,
    VaultAuthType
} from '../../../core/api/secret-store-api.service';
import { ProjectContextService } from '../../../core/context/project-context.service';

const NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

@Component({
    selector: 'app-secret-store-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TableModule,
        ButtonModule,
        DialogModule,
        InputTextModule,
        TextareaModule,
        ToastModule,
        ConfirmDialogModule,
        TooltipModule,
        MenuModule,
        SelectModule,
        TagModule,
        CheckboxModule,
        IconFieldModule,
        InputIconModule
    ],
    providers: [MessageService, ConfirmationService],
    templateUrl: './secret-store-list.component.html',
    styleUrls: ['./secret-store-list.component.css']
})
export class SecretStoreListComponent {
    private readonly api = inject(SecretStoreApiService);
    private readonly context = inject(ProjectContextService);
    private readonly messageService = inject(MessageService);
    private readonly confirmationService = inject(ConfirmationService);
    private readonly destroyRef = inject(DestroyRef);

    stores = signal<SecretStore[]>([]);
    loading = signal(true);

    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private readonly POLL_INTERVAL_MS = 10_000;
    private activeSub: Subscription | null = null;

    constructor() {
        effect(() => {
            const project = this.context.currentProject();
            if (project) {
                this.loadStores();
                this.startPolling();
            } else {
                this.stopPolling();
            }
        });

        this.destroyRef.onDestroy(() => this.stopPolling());
    }

    private startPolling() {
        this.stopPolling();
        this.pollTimer = setInterval(() => {
            if (!this.projectId) return;
            this.activeSub?.unsubscribe();
            this.activeSub = this.api.list(this.projectId).pipe(
                takeUntilDestroyed(this.destroyRef)
            ).subscribe({
                next: (data) => this.mergeStores(data),
                error: () => {}
            });
        }, this.POLL_INTERVAL_MS);
    }

    private stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.activeSub?.unsubscribe();
        this.activeSub = null;
    }

    private mergeStores(incoming: SecretStore[]) {
        const current = this.stores();
        if (current.length !== incoming.length) {
            this.stores.set(incoming);
            return;
        }
        const changed = incoming.some((s, i) => {
            const c = current[i];
            return s.name !== c.name
                || s.status !== c.status
                || s.lastCheckedAt !== c.lastCheckedAt
                || s.lastError !== c.lastError
                || s.isDefault !== c.isDefault;
        });
        if (changed) {
            this.stores.set(incoming);
        }
    }

    trackByName(_index: number, store: SecretStore): string {
        return store.name;
    }

    // --- Dialog state ---
    dialogVisible = false;
    editMode = false;
    testing = false;
    saving = false;

    // --- Status detail ---
    statusDialogVisible = false;
    statusDetail = signal<SecretStoreStatusDetail | null>(null);
    statusLoading = false;
    selectedStoreName = '';
    private statusPollTimer: ReturnType<typeof setInterval> | null = null;

    // --- Form fields ---
    storeName = '';
    vaultServer = '';
    vaultPath = '';
    vaultVersion: 'v1' | 'v2' = 'v2';
    caBundle = '';
    authType: VaultAuthType = 'token';
    authToken = '';
    authMountPath = '';
    authRole = '';
    isDefault = false;

    readonly versionOptions = [
        { label: 'v2', value: 'v2' },
        { label: 'v1', value: 'v1' }
    ];

    readonly authTypeOptions: { label: string; value: VaultAuthType }[] = [
        { label: 'Token', value: 'token' },
        { label: 'Kubernetes', value: 'kubernetes' }
    ];

    selectedStore: SecretStore | null = null;

    menuItems: MenuItem[] = [
        {
            label: 'View Status',
            icon: 'pi pi-info-circle',
            command: () => {
                if (this.selectedStore) this.showStatusDetail(this.selectedStore);
            }
        },
        {
            label: 'Edit',
            icon: 'pi pi-pencil',
            command: () => {
                if (this.selectedStore) this.showEditDialog(this.selectedStore);
            }
        },
        {
            label: 'Delete',
            icon: 'pi pi-trash',
            command: () => {
                if (this.selectedStore) this.confirmDelete(this.selectedStore);
            }
        }
    ];

    private get projectId(): string {
        return this.context.currentProject()?.name ?? '';
    }

    loadStores() {
        if (!this.projectId) return;
        this.loading.set(true);
        this.api.list(this.projectId).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (data) => {
                this.stores.set(data);
                this.loading.set(false);
            },
            error: () => {
                this.showError('Failed to load secret stores');
                this.loading.set(false);
            }
        });
    }

    // --- Name validation ---

    get nameError(): string {
        if (!this.storeName) return '';
        if (this.storeName.length > 63) return 'Maximum 63 characters';
        if (!NAME_PATTERN.test(this.storeName)) {
            return 'Lowercase letters, numbers and hyphens only (must start/end with alphanumeric)';
        }
        return '';
    }

    // --- Dialog ---

    showCreateDialog() {
        this.resetForm();
        this.editMode = false;
        this.dialogVisible = true;
    }

    showEditDialog(store: SecretStore) {
        this.editMode = true;
        this.storeName = store.name;
        this.vaultServer = store.vault?.server ?? '';
        this.vaultPath = store.vault?.path ?? '';
        this.vaultVersion = store.vault?.version ?? 'v2';
        this.caBundle = store.vault?.caBundle ?? '';
        this.authType = store.auth?.type ?? 'token';
        this.authToken = '';
        this.authMountPath = store.auth?.config?.mountPath ?? '';
        this.authRole = store.auth?.config?.role ?? '';
        this.isDefault = store.isDefault;
        this.dialogVisible = true;
    }

    private resetForm() {
        this.storeName = '';
        this.vaultServer = '';
        this.vaultPath = '';
        this.vaultVersion = 'v2';
        this.caBundle = '';
        this.authType = 'token';
        this.authToken = '';
        this.authMountPath = '';
        this.authRole = '';
        this.isDefault = false;
    }

    private buildRequest(): SecretStoreRequest {
        return {
            name: this.storeName,
            provider: 'vault',
            vault: {
                server: this.vaultServer,
                path: this.vaultPath,
                version: this.vaultVersion,
                caBundle: this.caBundle || undefined,
            },
            auth: {
                type: this.authType,
                config: {
                    token: this.authType === 'token' ? this.authToken || undefined : undefined,
                    mountPath: this.authType === 'kubernetes' ? this.authMountPath || undefined : undefined,
                    role: this.authType === 'kubernetes' ? this.authRole || undefined : undefined,
                }
            },
            isDefault: this.isDefault
        };
    }

    get formValid(): boolean {
        if (!this.storeName || !this.vaultServer || !this.vaultPath) return false;
        if (this.nameError) return false;
        if (this.authType === 'token' && !this.authToken && !this.editMode) return false;
        if (this.authType === 'kubernetes' && !this.authRole) return false;
        return true;
    }

    testConnection() {
        const request = this.buildRequest();
        this.testing = true;

        this.api.testConnection(this.projectId, request).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: () => {
                this.testing = false;
                this.showSuccess('Connection successful!');
            },
            error: (err) => {
                this.testing = false;
                const errorMsg = err?.error?.error || err?.error?.message || 'Connection failed';
                this.showError(`Connection test failed: ${errorMsg}`);
            }
        });
    }

    saveStore() {
        this.saving = true;
        this.performSave(this.buildRequest());
    }

    private performSave(request: SecretStoreRequest) {
        const obs = this.editMode
            ? this.api.update(this.projectId, this.storeName, request)
            : this.api.create(this.projectId, request);

        obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
                this.saving = false;
                this.dialogVisible = false;
                this.showSuccess(`Secret store "${this.storeName}" ${this.editMode ? 'updated' : 'created'} successfully`);
                this.loadStores();
            },
            error: (err) => {
                this.saving = false;
                const detail = err?.error?.error || err?.error?.message || `Failed to ${this.editMode ? 'update' : 'create'} secret store`;
                this.showError(detail);
            }
        });
    }

    confirmDelete(store: SecretStore) {
        this.confirmationService.confirm({
            message: `Are you sure you want to delete <strong>${store.name}</strong>? This action cannot be undone.`,
            header: 'Delete secret store?',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Delete',
            rejectLabel: 'Cancel',
            accept: () => {
                this.api.delete(this.projectId, store.name).pipe(
                    takeUntilDestroyed(this.destroyRef)
                ).subscribe({
                    next: () => {
                        this.showSuccess(`Secret store "${store.name}" deleted successfully`);
                        this.loadStores();
                    },
                    error: (err) => {
                        const detail = err?.error?.error || err?.error?.message || 'Failed to delete secret store';
                        this.showError(detail);
                    }
                });
            }
        });
    }

    // --- Status detail ---

    showStatusDetail(store: SecretStore) {
        this.selectedStoreName = store.name;
        this.statusLoading = true;
        this.statusDetail.set(null);
        this.statusDialogVisible = true;

        this.fetchStatusDetail(store.name, store);
        this.startStatusPolling();
    }

    onStatusDialogHide() {
        this.stopStatusPolling();
    }

    private startStatusPolling() {
        this.stopStatusPolling();
        this.statusPollTimer = setInterval(() => {
            if (!this.selectedStoreName || !this.projectId || this.statusLoading) return;
            this.fetchStatusDetail(this.selectedStoreName);
        }, this.POLL_INTERVAL_MS);
    }

    private stopStatusPolling() {
        if (this.statusPollTimer) {
            clearInterval(this.statusPollTimer);
            this.statusPollTimer = null;
        }
    }

    private fetchStatusDetail(storeName: string, fallback?: SecretStore) {
        this.api.getStatus(this.projectId, storeName).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (detail) => {
                this.statusDetail.set(detail);
                this.statusLoading = false;
            },
            error: () => {
                if (fallback) {
                    this.statusDetail.set({
                        status: fallback.status,
                        conditions: [],
                        lastCheckedAt: fallback.lastCheckedAt,
                        lastError: fallback.lastError
                    });
                }
                this.statusLoading = false;
            }
        });
    }

    refreshStatus() {
        if (!this.selectedStoreName || !this.projectId) return;
        this.statusLoading = true;

        this.api.list(this.projectId).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (data) => {
                this.mergeStores(data);
                const freshStore = data.find(s => s.name === this.selectedStoreName);
                if (freshStore) {
                    this.statusDetail.set({
                        status: freshStore.status,
                        conditions: [],
                        lastCheckedAt: freshStore.lastCheckedAt,
                        lastError: freshStore.lastError
                    });
                    this.fetchStatusDetail(freshStore.name);
                } else {
                    this.statusLoading = false;
                }
            },
            error: () => {
                this.showError('Failed to refresh status');
                this.statusLoading = false;
            }
        });
    }

    // --- Helpers ---

    getStatusSeverity(status: string): 'success' | 'danger' | 'warn' | 'info' {
        switch (status) {
            case 'Ready': return 'success';
            case 'Error': return 'danger';
            case 'Pending': return 'warn';
            default: return 'info';
        }
    }

    getConditionIcon(condition: SecretStoreCondition): string {
        return condition.status === 'True' ? 'pi pi-check-circle' : 'pi pi-times-circle';
    }

    getConditionClass(condition: SecretStoreCondition): string {
        return condition.status === 'True' ? 'condition-ok' : 'condition-error';
    }

    private showSuccess(detail: string) {
        this.messageService.add({ severity: 'success', summary: 'Success', detail, life: 3000 });
    }

    private showError(detail: string) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail, life: 5000 });
    }
}
