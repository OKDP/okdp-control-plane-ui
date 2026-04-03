import { Component, inject, signal, effect, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule, Table } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService, ConfirmationService } from 'primeng/api';
import { Subscription } from 'rxjs';
import { SparkApiService } from '../../../core/api/spark-api.service';
import { ProjectContextService } from '../../../core/context/project-context.service';
import { SparkAppInstance, SparkUIInfo } from '../../../core/models/spark.model';

@Component({
    selector: 'app-spark-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TableModule,
        ButtonModule,
        TagModule,
        ToastModule,
        ConfirmDialogModule,
        TooltipModule,
        IconFieldModule,
        InputIconModule,
        InputTextModule,
    ],
    providers: [MessageService, ConfirmationService],
    template: `
        <p-toast></p-toast>
        <p-confirmDialog></p-confirmDialog>

        <div class="filter-bar">
            <p-iconfield>
                <p-inputicon styleClass="pi pi-search" />
                <input
                    type="text"
                    pInputText
                    placeholder="Filter jobs..."
                    (input)="onGlobalFilter(dt, $event)" />
            </p-iconfield>
        </div>

        <div class="table-wrapper">
            <p-table #dt [value]="apps()" [loading]="loading()" [rowHover]="true"
                [globalFilterFields]="['name', 'type', 'status', 'image']"
                styleClass="minimal-table" dataKey="name">
                <ng-template pTemplate="header">
                    <tr>
                        <th style="width: 25%">Name</th>
                        <th style="width: 12%">Type</th>
                        <th style="width: 15%">Image</th>
                        <th style="width: 12%">Status</th>
                        <th style="width: 15%">Created</th>
                        <th style="width: 21%"></th>
                    </tr>
                </ng-template>
                <ng-template pTemplate="body" let-app>
                    <tr>
                        <td>
                            <a class="app-name app-link" (click)="viewDetail(app)">{{ app.name }}</a>
                        </td>
                        <td>
                            <span class="type-badge">{{ app.type }}</span>
                        </td>
                        <td>
                            <span class="image-text" [pTooltip]="app.image">{{ shortenImage(app.image) }}</span>
                        </td>
                        <td>
                            <p-tag [value]="app.status"
                                [severity]="getStatusSeverity(app.status)">
                            </p-tag>
                        </td>
                        <td>
                            <span class="created-date">{{ app.createdAt | date:'mediumDate' }}</span>
                        </td>
                        <td style="text-align: right">
                            <div class="actions">
                                @if (app.status === 'RUNNING') {
                                    <p-button icon="pi pi-external-link" [text]="true" label="Spark UI"
                                        (onClick)="openSparkUI(app)" title="Open live Spark UI"></p-button>
                                } @else if (isTerminal(app.status)) {
                                    <p-button icon="pi pi-history" [text]="true" label="History"
                                        (onClick)="openHistoryServer(app)" title="Open Spark History Server"></p-button>
                                }
                                <p-button icon="pi pi-eye" [text]="true" label="Detail"
                                    (onClick)="viewDetail(app)" title="View details"></p-button>
                                <p-button icon="pi pi-trash" [text]="true" severity="danger" [rounded]="true"
                                    (onClick)="confirmDelete(app)" title="Delete job"></p-button>
                            </div>
                        </td>
                    </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                    <tr>
                        <td colspan="6">
                            <div class="empty-state-inline">
                                <i class="pi pi-bolt"></i>
                                No Spark jobs found. Click <strong>Submit job</strong> to run your first Spark application.
                            </div>
                        </td>
                    </tr>
                </ng-template>
            </p-table>
        </div>
    `,
    styles: [`
        :host { display: block; }
        .app-name { font-weight: 500; }
        .app-link {
            color: var(--db-primary);
            cursor: pointer;
            text-decoration: none;
            transition: color var(--db-transition-base);
        }
        .app-link:hover {
            color: var(--db-primary-700);
            text-decoration: underline;
        }
        .type-badge {
            display: inline-flex;
            align-items: center;
            background: var(--db-bg-secondary);
            color: var(--db-text-secondary);
            font-size: 12px;
            padding: 3px var(--db-space-sm);
            border-radius: var(--db-radius-sm);
            border: 1px solid var(--db-border-light);
            font-weight: 500;
        }
        .image-text {
            font-size: 12px;
            font-family: monospace;
            color: var(--db-text-secondary);
        }
        .created-date {
            font-size: 13px;
            color: var(--db-text-secondary);
        }
        .empty-state-inline {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--db-space-sm);
            padding: var(--db-space-xl);
            color: var(--db-text-secondary);
            font-size: 14px;
        }
        .empty-state-inline i {
            font-size: 1.2rem;
            opacity: 0.5;
        }
        .filter-bar {
            margin-bottom: var(--db-space-md);
        }
    `]
})
export class SparkListComponent {
    private readonly api = inject(SparkApiService);
    private readonly context = inject(ProjectContextService);
    private readonly messageService = inject(MessageService);
    private readonly confirmationService = inject(ConfirmationService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly router = inject(Router);

    apps = signal<SparkAppInstance[]>([]);
    loading = signal(true);

    private streamSub: Subscription | null = null;

    constructor() {
        effect(() => {
            const project = this.context.currentProject();
            if (project) {
                this.loadApps(project.name);
                this.subscribeStream(project.name);
            }
        });

        this.destroyRef.onDestroy(() => {
            this.streamSub?.unsubscribe();
        });
    }

    private loadApps(projectId: string) {
        this.loading.set(true);
        this.api.listApps(projectId).subscribe({
            next: (data) => {
                this.apps.set(data);
                this.loading.set(false);
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load Spark jobs' });
                this.loading.set(false);
            }
        });
    }

    private subscribeStream(projectId: string) {
        this.streamSub?.unsubscribe();
        this.streamSub = this.api.streamApps(projectId).subscribe({
            next: (event) => {
                const current = [...this.apps()];
                const idx = current.findIndex(a => a.name === event.object.name);

                if (event.type === 'DELETED') {
                    if (idx !== -1) current.splice(idx, 1);
                } else if (idx !== -1) {
                    current[idx] = event.object;
                } else {
                    current.push(event.object);
                }
                this.apps.set(current);
            }
        });
    }

    getStatusSeverity(status: string): "success" | "info" | "warn" | "danger" | "secondary" | "contrast" | undefined {
        switch (status) {
            case 'COMPLETED': return 'success';
            case 'RUNNING': return 'info';
            case 'SUBMITTED':
            case 'PENDING_RERUN': return 'warn';
            case 'FAILED':
            case 'FAILING': return 'danger';
            default: return 'secondary';
        }
    }

    shortenImage(image: string): string {
        if (!image) return '';
        const parts = image.split('/');
        return parts[parts.length - 1];
    }

    viewDetail(app: SparkAppInstance) {
        const project = this.context.currentProject();
        if (project) {
            this.router.navigate(['/project', project.name, 'spark', 'applications', app.name]);
        }
    }

    editApp(app: SparkAppInstance) {
        const project = this.context.currentProject();
        if (project) {
            this.router.navigate(['/project', project.name, 'spark', 'applications', app.name, 'edit']);
        }
    }

    confirmDelete(app: SparkAppInstance) {
        this.confirmationService.confirm({
            message: `Are you sure you want to delete Spark job "${app.name}"?`,
            header: 'Confirm Delete',
            icon: 'pi pi-exclamation-triangle',
            acceptButtonStyleClass: 'p-button-danger',
            accept: () => this.deleteApp(app)
        });
    }

    private deleteApp(app: SparkAppInstance) {
        const project = this.context.currentProject();
        if (!project) return;

        this.api.deleteApp(project.name, app.name).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Deleted',
                    detail: `Spark job "${app.name}" has been removed`
                });
                this.apps.set(this.apps().filter(a => a.name !== app.name));
            },
            error: (err) => {
                const msg = err?.error?.error || 'Failed to delete Spark job';
                this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
            }
        });
    }

    isTerminal(status: string): boolean {
        return ['COMPLETED', 'FAILED', 'FAILING'].includes(status);
    }

    openSparkUI(app: SparkAppInstance) {
        this.openSparkLink(app, 'uiAddress', 'Spark UI unavailable');
    }

    openHistoryServer(app: SparkAppInstance) {
        this.openSparkLink(app, 'historyServerUrl', 'History Server unavailable');
    }

    private openSparkLink(app: SparkAppInstance, field: keyof SparkUIInfo, warnTitle: string) {
        const project = this.context.currentProject();
        if (!project) return;

        this.api.getSparkUI(project.name, app.name).subscribe({
            next: (info: SparkUIInfo) => {
                const url = info[field] as string;
                if (url) {
                    window.open(url, '_blank');
                } else {
                    this.messageService.add({ severity: 'warn', summary: warnTitle, detail: 'URL not available.' });
                }
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to retrieve Spark UI info' });
            }
        });
    }

    onGlobalFilter(table: Table, event: Event) {
        table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
    }
}
