import {
    Component,
    inject,
    signal,
    effect,
    DestroyRef,
    input,
    output,
    computed,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { Subscription } from 'rxjs';
import { ServiceApiService } from '../../../core/api/service-api.service';
import { ProjectContextService } from '../../../core/context/project-context.service';
import { ServiceInstance } from '../../../core/models/service.model';

type StatusFilter = 'All' | 'Ready' | 'Installing' | 'Updating' | 'Error';

@Component({
    selector: 'app-service-list',
    standalone: true,
    imports: [CommonModule, FormsModule, DatePipe, ToastModule, ConfirmDialogModule],
    providers: [MessageService, ConfirmationService],
    template: `
        <p-toast></p-toast>
        <p-confirmDialog></p-confirmDialog>

        <div class="stat-strip">
            @for (chip of statChips(); track chip.key) {
                <button
                    class="stat-chip"
                    [class.active]="filterStatus() === chip.key"
                    [class.chip-warn]="chip.tone === 'warn'"
                    [class.chip-danger]="chip.tone === 'danger'"
                    (click)="setStatus(chip.key)">
                    <span class="sc-label">{{ chip.key }}</span>
                    <span class="sc-count">{{ chip.count }}</span>
                </button>
            }
        </div>

        <div class="okdp-filter-bar">
            <div class="okdp-search-wrapper">
                <i class="pi pi-search search-icon"></i>
                <input
                    class="okdp-search-input"
                    placeholder="Filter by name, version, namespace…"
                    [ngModel]="query()"
                    (ngModelChange)="query.set($event)" />
            </div>
            <div class="filter-hint">
                {{ filtered().length }} of {{ services().length }}
            </div>
        </div>

        @if (loading()) {
            <div class="empty-state-panel">
                <div class="empty-icon-wrapper">
                    <i class="pi pi-spin pi-spinner"></i>
                </div>
                <h3>Loading instances…</h3>
            </div>
        } @else if (filtered().length === 0) {
            <div class="empty-state-panel">
                <div class="empty-icon-wrapper">
                    <i [class]="hasFilter() ? 'pi pi-search' : 'pi pi-server'"></i>
                </div>
                <h3>{{ hasFilter() ? 'No instances match' : emptyTitle() }}</h3>
                <p>
                    {{
                        hasFilter()
                            ? 'Try clearing the filter or searching by a different term.'
                            : emptyMessage()
                    }}
                </p>
                @if (!hasFilter()) {
                    <button class="create-btn" (click)="deploy.emit()">
                        <i class="pi pi-plus"></i>
                        <span>New instance</span>
                    </button>
                }
            </div>
        } @else {
            <div class="okdp-table-wrapper">
                <table class="okdp-table">
                    <thead>
                        <tr>
                            <th style="width: 32%">Instance</th>
                            <th style="width: 16%">Version</th>
                            <th style="width: 12%">Status</th>
                            <th style="width: 14%">Namespace</th>
                            <th style="width: 12%">Created</th>
                            <th style="width: 14%"></th>
                        </tr>
                    </thead>
                    <tbody>
                        @for (svc of filtered(); track svc.name) {
                            <tr class="clickable-row" (click)="viewDetail(svc)">
                                <td>
                                    <div class="cell-instance">
                                        <span class="cell-name">{{ svc.name }}</span>
                                        <span class="cell-ns mono">{{
                                            svc.releaseName || svc.service
                                        }}</span>
                                    </div>
                                </td>
                                <td>
                                    <span class="version-badge mono">{{ svc.serviceTag }}</span>
                                </td>
                                <td>
                                    <span class="okdp-tag" [class]="tagClass(svc.status)">
                                        @if (svc.status === 'Installing' || svc.status === 'Updating') {
                                            <span class="okdp-tag-dot"></span>
                                        }
                                        {{ svc.status }}
                                    </span>
                                </td>
                                <td>
                                    <span class="muted-text small mono">
                                        {{ svc.targetNamespace || '—' }}
                                    </span>
                                </td>
                                <td>
                                    <span class="muted-text">
                                        {{
                                            svc.createdAt ? (svc.createdAt | date: 'mediumDate') : '—'
                                        }}
                                    </span>
                                </td>
                                <td (click)="$event.stopPropagation()">
                                    <div class="okdp-actions">
                                        <button
                                            class="icon-btn"
                                            title="View details"
                                            (click)="viewDetail(svc)">
                                            <i class="pi pi-eye"></i>
                                        </button>
                                        <button
                                            class="icon-btn"
                                            title="Edit"
                                            (click)="editService(svc)">
                                            <i class="pi pi-pencil"></i>
                                        </button>
                                        @if (svc.url) {
                                            <button
                                                class="icon-btn primary"
                                                title="Open in a new tab"
                                                [disabled]="svc.status !== 'Ready'"
                                                (click)="openService(svc)">
                                                <i class="pi pi-external-link"></i>
                                            </button>
                                        }
                                        <button
                                            class="icon-btn danger"
                                            title="Delete"
                                            (click)="confirmDelete(svc)">
                                            <i class="pi pi-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        }
                    </tbody>
                </table>
            </div>
        }
    `,
})
export class ServiceListComponent {
    private readonly api = inject(ServiceApiService);
    private readonly context = inject(ProjectContextService);
    private readonly messageService = inject(MessageService);
    private readonly confirmationService = inject(ConfirmationService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly router = inject(Router);

    serviceFilter = input<string>();
    emptyMessage = input('No instances deployed yet.');
    emptyTitle = input('No instances yet');
    // URL segments under /project/:projectId for the parent "area" (e.g.
    // ['services'] for Jupyter, ['spark', 'history-server'] for Spark
    // History Server). Used for detail/edit navigation so the sidebar
    // highlights the correct entry.
    basePath = input<string[]>(['services']);

    deploy = output<void>();

    services = signal<ServiceInstance[]>([]);
    loading = signal(true);
    query = signal('');
    filterStatus = signal<StatusFilter>('All');

    statChips = computed(() => {
        const list = this.services();
        return [
            { key: 'All' as StatusFilter, count: list.length, tone: 'neutral' as const },
            {
                key: 'Ready' as StatusFilter,
                count: list.filter((s) => s.status === 'Ready').length,
                tone: 'success' as const,
            },
            {
                key: 'Installing' as StatusFilter,
                count: list.filter((s) => s.status === 'Installing' || s.status === 'Updating').length,
                tone: 'warn' as const,
            },
            {
                key: 'Error' as StatusFilter,
                count: list.filter((s) => s.status === 'Error').length,
                tone: 'danger' as const,
            },
        ];
    });

    filtered = computed(() => {
        const q = this.query().trim().toLowerCase();
        const status = this.filterStatus();
        return this.services().filter((s) => {
            if (status !== 'All') {
                // "Installing" tab groups Installing + Updating (in-progress reconciliation)
                const matches = status === 'Installing'
                    ? (s.status === 'Installing' || s.status === 'Updating')
                    : s.status === status;
                if (!matches) return false;
            }
            if (!q) return true;
            const hay = `${s.name} ${s.service} ${s.serviceTag} ${s.targetNamespace ?? ''}`.toLowerCase();
            return hay.includes(q);
        });
    });

    hasFilter = computed(() => !!this.query().trim() || this.filterStatus() !== 'All');

    private streamSub: Subscription | null = null;

    constructor() {
        effect(() => {
            const project = this.context.currentProject();
            if (project) {
                this.loadServices(project.name);
                this.subscribeStream(project.name);
            }
        });

        this.destroyRef.onDestroy(() => {
            this.streamSub?.unsubscribe();
        });
    }

    setStatus(s: StatusFilter) {
        this.filterStatus.set(s);
    }

    private matchesFilter(instance: ServiceInstance): boolean {
        const filter = this.serviceFilter();
        return !filter || instance.service === filter;
    }

    private loadServices(projectId: string) {
        this.loading.set(true);
        this.api.getServices(projectId).subscribe({
            next: (data) => {
                this.services.set(data.filter((s) => this.matchesFilter(s)));
                this.loading.set(false);
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Failed to load services',
                });
                this.loading.set(false);
            },
        });
    }

    private subscribeStream(projectId: string) {
        this.streamSub?.unsubscribe();
        this.streamSub = this.api.getServicesStream(projectId).subscribe({
            next: (event) => {
                if (!this.matchesFilter(event.object)) return;

                const current = [...this.services()];
                const idx = current.findIndex((s) => s.name === event.object.name);

                if (event.type === 'DELETED') {
                    if (idx !== -1) current.splice(idx, 1);
                } else if (idx !== -1) {
                    current[idx] = event.object;
                } else {
                    current.push(event.object);
                }
                this.services.set(current);
            },
        });
    }

    tagClass(status: string): string {
        switch (status) {
            case 'Ready':
            case 'Running':
                return 'okdp-tag-success';
            case 'Installing':
            case 'Updating':
                return 'okdp-tag-warn';
            case 'Error':
            case 'CrashLoopBackOff':
            case 'Failed':
                return 'okdp-tag-danger';
            default:
                return 'okdp-tag-info';
        }
    }

    editService(svc: ServiceInstance) {
        const project = this.context.currentProject();
        if (project) {
            this.router.navigate(
                ['/project', project.name, ...this.basePath(), svc.name, 'edit'],
                { queryParams: { returnTo: this.router.url } },
            );
        }
    }

    viewDetail(svc: ServiceInstance) {
        const project = this.context.currentProject();
        if (project) {
            this.router.navigate(
                ['/project', project.name, ...this.basePath(), svc.name],
                { queryParams: { returnTo: this.router.url } },
            );
        }
    }

    openService(svc: ServiceInstance) {
        if (svc.url) {
            window.open(svc.url, '_blank');
        }
    }

    confirmDelete(svc: ServiceInstance) {
        this.confirmationService.confirm({
            message: `This will remove "${svc.name}" and all its pods. This cannot be undone.`,
            header: 'Delete this instance?',
            icon: 'pi pi-exclamation-triangle',
            acceptButtonStyleClass: 'p-button-danger',
            accept: () => this.deleteService(svc),
        });
    }

    private deleteService(svc: ServiceInstance) {
        const project = this.context.currentProject();
        if (!project) return;

        this.api.deleteService(project.name, svc.name).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Instance deleted',
                    detail: `"${svc.name}" has been removed`,
                });
                this.services.set(this.services().filter((s) => s.name !== svc.name));
            },
            error: (err) => {
                const msg = err?.error?.error || 'Failed to delete instance';
                this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
            },
        });
    }
}
