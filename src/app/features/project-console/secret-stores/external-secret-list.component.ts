import { Component, inject, signal, effect, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { MenuModule } from 'primeng/menu';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';
import {
    ExternalSecret,
    ExternalSecretApiService,
    ExternalSecretRequest,
    ExternalSecretDataRef,
    ExternalSecretStatusDetail,
    ExternalSecretCondition
} from '../../../core/api/external-secret-api.service';
import { SecretStoreApiService, SecretStore } from '../../../core/api/secret-store-api.service';
import { ProjectContextService } from '../../../core/context/project-context.service';

const NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

@Component({
    selector: 'app-external-secret-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TableModule,
        ButtonModule,
        DialogModule,
        InputTextModule,
        ToastModule,
        ConfirmDialogModule,
        TooltipModule,
        MenuModule,
        SelectModule,
        TagModule,
        IconFieldModule,
        InputIconModule
    ],
    providers: [MessageService, ConfirmationService],
    templateUrl: './external-secret-list.component.html',
    styleUrls: ['./external-secret-list.component.css']
})
export class ExternalSecretListComponent {
    private readonly api = inject(ExternalSecretApiService);
    private readonly storeApi = inject(SecretStoreApiService);
    private readonly context = inject(ProjectContextService);
    private readonly messageService = inject(MessageService);
    private readonly confirmationService = inject(ConfirmationService);
    private readonly destroyRef = inject(DestroyRef);

    secrets = signal<ExternalSecret[]>([]);
    loading = signal(true);
    readyStores = signal<SecretStore[]>([]);

    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private readonly POLL_INTERVAL_MS = 10_000;
    private activeSub: Subscription | null = null;

    constructor() {
        effect(() => {
            const project = this.context.currentProject();
            if (project) {
                this.loadSecrets();
                this.loadReadyStores();
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
                next: (data) => this.mergeSecrets(data),
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

    private mergeSecrets(incoming: ExternalSecret[]) {
        const current = this.secrets();
        if (current.length !== incoming.length) {
            this.secrets.set(incoming);
            return;
        }
        const changed = incoming.some((s, i) => {
            const c = current[i];
            return s.name !== c.name
                || s.status !== c.status
                || s.lastSyncedAt !== c.lastSyncedAt
                || s.lastError !== c.lastError;
        });
        if (changed) {
            this.secrets.set(incoming);
        }
    }

    trackByName(_index: number, es: ExternalSecret): string {
        return es.name;
    }

    // --- Dialog state ---
    dialogVisible = false;
    editMode = false;
    saving = false;

    // --- Status detail ---
    statusDialogVisible = false;
    statusDetail = signal<ExternalSecretStatusDetail | null>(null);
    statusLoading = false;
    selectedSecretName = '';
    private statusPollTimer: ReturnType<typeof setInterval> | null = null;

    // --- Form fields ---
    secretName = '';
    selectedStoreRef = '';
    targetName = '';
    refreshInterval = '1h';
    showAdvanced = false;
    dataMappings: ExternalSecretDataRef[] = [{ secretKey: '', remoteRef: { key: '', property: '' } }];

    readonly refreshOptions = [
        { label: '1 minute', value: '1m' },
        { label: '5 minutes', value: '5m' },
        { label: '15 minutes', value: '15m' },
        { label: '30 minutes', value: '30m' },
        { label: '1 hour', value: '1h' },
        { label: '6 hours', value: '6h' },
        { label: '24 hours', value: '24h' }
    ];

    selectedSecret: ExternalSecret | null = null;

    menuItems: MenuItem[] = [
        {
            label: 'View Status',
            icon: 'pi pi-info-circle',
            command: () => {
                if (this.selectedSecret) this.showStatusDetail(this.selectedSecret);
            }
        },
        {
            label: 'Edit',
            icon: 'pi pi-pencil',
            command: () => {
                if (this.selectedSecret) this.showEditDialog(this.selectedSecret);
            }
        },
        {
            label: 'Delete',
            icon: 'pi pi-trash',
            command: () => {
                if (this.selectedSecret) this.confirmDelete(this.selectedSecret);
            }
        }
    ];

    private get projectId(): string {
        return this.context.currentProject()?.name ?? '';
    }

    loadSecrets() {
        if (!this.projectId) return;
        this.loading.set(true);
        this.api.list(this.projectId).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (data) => {
                this.secrets.set(data);
                this.loading.set(false);
            },
            error: () => {
                this.showError('Failed to load external secrets');
                this.loading.set(false);
            }
        });
    }

    loadReadyStores() {
        if (!this.projectId) return;
        this.storeApi.list(this.projectId).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (stores) => {
                this.readyStores.set(stores.filter(s => s.status === 'Ready'));
            },
            error: () => {}
        });
    }

    // --- Name validation ---

    get nameError(): string {
        if (!this.secretName) return '';
        if (this.secretName.length > 63) return 'Maximum 63 characters';
        if (!NAME_PATTERN.test(this.secretName)) {
            return 'Lowercase letters, numbers and hyphens only (must start/end with alphanumeric)';
        }
        return '';
    }

    // --- Dialog ---

    showCreateDialog() {
        this.loadReadyStores();
        this.resetForm();
        this.editMode = false;
        this.dialogVisible = true;
    }

    showEditDialog(es: ExternalSecret) {
        this.loadReadyStores();
        this.editMode = true;
        this.secretName = es.name;
        this.selectedStoreRef = es.secretStoreRef;
        this.targetName = es.target?.name ?? '';
        this.refreshInterval = es.refreshInterval || '1h';
        this.showAdvanced = this.targetName !== '' && this.targetName !== es.name;
        this.dataMappings = es.data?.length
            ? es.data.map(d => ({
                secretKey: d.secretKey,
                remoteRef: { key: d.remoteRef.key, property: d.remoteRef.property || '' }
            }))
            : [{ secretKey: '', remoteRef: { key: '', property: '' } }];
        this.dialogVisible = true;
    }

    private resetForm() {
        this.secretName = '';
        this.selectedStoreRef = '';
        this.targetName = '';
        this.refreshInterval = '1h';
        this.showAdvanced = false;
        this.dataMappings = [{ secretKey: '', remoteRef: { key: '', property: '' } }];
    }

    addMapping() {
        this.dataMappings = [...this.dataMappings, { secretKey: '', remoteRef: { key: '', property: '' } }];
    }

    removeMapping(index: number) {
        this.dataMappings = this.dataMappings.filter((_, i) => i !== index);
        if (this.dataMappings.length === 0) {
            this.addMapping();
        }
    }

    private buildRequest(): ExternalSecretRequest {
        return {
            name: this.secretName,
            secretStoreRef: this.selectedStoreRef,
            target: { name: this.targetName || this.secretName },
            refreshInterval: this.refreshInterval,
            data: this.dataMappings
                .filter(m => m.secretKey && m.remoteRef.key)
                .map(m => ({
                    secretKey: m.secretKey,
                    remoteRef: {
                        key: m.remoteRef.key,
                        property: m.remoteRef.property || undefined
                    }
                }))
        };
    }

    get formValid(): boolean {
        if (!this.secretName || !this.selectedStoreRef) return false;
        if (this.nameError) return false;
        const validMappings = this.dataMappings.filter(m => m.secretKey && m.remoteRef.key);
        return validMappings.length > 0;
    }

    saveSecret() {
        this.saving = true;
        const request = this.buildRequest();
        const obs = this.editMode
            ? this.api.update(this.projectId, this.secretName, request)
            : this.api.create(this.projectId, request);

        obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
                this.saving = false;
                this.dialogVisible = false;
                this.showSuccess(`External secret "${this.secretName}" ${this.editMode ? 'updated' : 'created'} successfully`);
                this.loadSecrets();
            },
            error: (err) => {
                this.saving = false;
                const detail = err?.error?.error || err?.error?.message || `Failed to ${this.editMode ? 'update' : 'create'} external secret`;
                this.showError(detail);
            }
        });
    }

    confirmDelete(es: ExternalSecret) {
        this.confirmationService.confirm({
            message: `Are you sure you want to delete <strong>${es.name}</strong>? The associated Kubernetes secret will also be removed.`,
            header: 'Delete external secret?',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Delete',
            rejectLabel: 'Cancel',
            accept: () => {
                this.api.delete(this.projectId, es.name).pipe(
                    takeUntilDestroyed(this.destroyRef)
                ).subscribe({
                    next: () => {
                        this.showSuccess(`External secret "${es.name}" deleted successfully`);
                        this.loadSecrets();
                    },
                    error: (err) => {
                        const detail = err?.error?.error || err?.error?.message || 'Failed to delete external secret';
                        this.showError(detail);
                    }
                });
            }
        });
    }

    // --- Status detail ---

    showStatusDetail(es: ExternalSecret) {
        this.selectedSecretName = es.name;
        this.statusLoading = true;
        this.statusDetail.set(null);
        this.statusDialogVisible = true;

        this.fetchStatusDetail(es.name, es);
        this.startStatusPolling();
    }

    onStatusDialogHide() {
        this.stopStatusPolling();
    }

    private startStatusPolling() {
        this.stopStatusPolling();
        this.statusPollTimer = setInterval(() => {
            if (!this.selectedSecretName || !this.projectId || this.statusLoading) return;
            this.fetchStatusDetail(this.selectedSecretName);
        }, this.POLL_INTERVAL_MS);
    }

    private stopStatusPolling() {
        if (this.statusPollTimer) {
            clearInterval(this.statusPollTimer);
            this.statusPollTimer = null;
        }
    }

    private fetchStatusDetail(name: string, fallback?: ExternalSecret) {
        this.api.getStatus(this.projectId, name).pipe(
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
                        lastSyncedAt: fallback.lastSyncedAt,
                        lastError: fallback.lastError
                    });
                }
                this.statusLoading = false;
            }
        });
    }

    refreshStatus() {
        if (!this.selectedSecretName || !this.projectId) return;
        this.statusLoading = true;

        this.api.list(this.projectId).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (data) => {
                this.mergeSecrets(data);
                const fresh = data.find(s => s.name === this.selectedSecretName);
                if (fresh) {
                    this.statusDetail.set({
                        status: fresh.status,
                        conditions: [],
                        lastSyncedAt: fresh.lastSyncedAt,
                        lastError: fresh.lastError
                    });
                    this.fetchStatusDetail(fresh.name);
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
            case 'Synced': return 'success';
            case 'Error': return 'danger';
            case 'Pending': return 'warn';
            default: return 'info';
        }
    }

    getConditionIcon(condition: ExternalSecretCondition): string {
        return condition.status === 'True' ? 'pi pi-check-circle' : 'pi pi-times-circle';
    }

    getConditionClass(condition: ExternalSecretCondition): string {
        return condition.status === 'True' ? 'condition-ok' : 'condition-error';
    }

    private showSuccess(detail: string) {
        this.messageService.add({ severity: 'success', summary: 'Success', detail, life: 3000 });
    }

    private showError(detail: string) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail, life: 5000 });
    }
}
