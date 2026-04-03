import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Subscription } from 'rxjs';
import { SparkApiService } from '../../../core/api/spark-api.service';
import { ProjectContextService } from '../../../core/context/project-context.service';
import { SparkAppInstance, SparkUIInfo } from '../../../core/models/spark.model';

@Component({
    selector: 'app-spark-detail-page',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        TagModule,
        ToastModule,
        ToggleSwitchModule,
    ],
    providers: [MessageService],
    template: `
        <p-toast></p-toast>

        <div class="detail-page">
            <div class="page-header animate-in">
                <nav class="breadcrumb">
                    <a class="breadcrumb-link" (click)="goBack()" (keydown.enter)="goBack()" tabindex="0">
                        <i class="pi pi-arrow-left breadcrumb-back-icon"></i>
                        Spark Jobs
                    </a>
                    <i class="pi pi-angle-right breadcrumb-sep"></i>
                    <span class="breadcrumb-current">{{ app()?.name }}</span>
                </nav>
                <div class="header-row">
                    <div class="header-badge">
                        <i class="pi pi-bolt"></i>
                    </div>
                    <div class="header-text">
                        <div class="header-title-row">
                            <h2>{{ app()?.name }}</h2>
                            @if (app()) {
                                <p-tag [value]="app()!.status"
                                    [severity]="getStatusSeverity(app()!.status)">
                                </p-tag>
                            }
                        </div>
                        <p class="page-desc">{{ app()?.type }} &middot; {{ app()?.mode }}</p>
                    </div>
                    <div class="header-actions">
                        @if (isRunning(app()!)) {
                            <p-button icon="pi pi-external-link" label="Spark UI"
                                severity="info" [outlined]="true" size="small"
                                [loading]="sparkUILoading()"
                                (onClick)="openSparkUI()"></p-button>
                        } @else if (isTerminal(app()!)) {
                            <p-button icon="pi pi-history" label="History Server"
                                severity="secondary" [outlined]="true" size="small"
                                [loading]="sparkUILoading()"
                                (onClick)="openHistoryServer()"></p-button>
                        }
                    </div>
                </div>
            </div>

            @if (loading()) {
                <div class="loading-state animate-in">
                    <div class="loading-spinner-ring">
                        <i class="pi pi-spin pi-spinner"></i>
                    </div>
                    <p>Loading job details...</p>
                </div>
            } @else if (app()) {
                <div class="detail-content animate-in">
                    <div class="info-card">
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Name</span>
                                <span class="info-value">{{ app()!.name }}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Type</span>
                                <span class="info-value">{{ app()!.type }}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Image</span>
                                <span class="info-value mono">{{ app()!.image }}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Created</span>
                                <span class="info-value">{{ app()!.createdAt | date:'medium' }}</span>
                            </div>
                            @if (app()!.driverPodName) {
                                <div class="info-item">
                                    <span class="info-label">Driver Pod</span>
                                    <span class="info-value mono">{{ app()!.driverPodName }}</span>
                                </div>
                            }
                            @if (app()!.errorMessage) {
                                <div class="info-item full-width">
                                    <span class="info-label">Error</span>
                                    <span class="info-value error-text">{{ app()!.errorMessage }}</span>
                                </div>
                            }
                        </div>
                    </div>

                    @if (app()!.executors && objectKeys(app()!.executors!).length > 0) {
                        <div class="section-card">
                            <div class="section-header">
                                <div class="section-icon-badge executors">
                                    <i class="pi pi-objects-column"></i>
                                </div>
                                <h3 class="section-title">Executors</h3>
                            </div>
                            <div class="executor-list">
                                @for (key of objectKeys(app()!.executors!); track key) {
                                    <div class="executor-row">
                                        <span class="executor-name">{{ key }}</span>
                                        <p-tag [value]="app()!.executors![key]"
                                            [severity]="getExecutorSeverity(app()!.executors![key])"></p-tag>
                                    </div>
                                }
                            </div>
                        </div>
                    }

                    <div class="section-card">
                        <div class="section-header">
                            <div class="section-icon-badge logs">
                                <i class="pi pi-file-edit"></i>
                            </div>
                            <h3 class="section-title">Driver Logs</h3>
                            <div class="log-controls">
                                <label class="follow-label">
                                    <p-toggleSwitch [(ngModel)]="followMode"
                                        (ngModelChange)="onFollowChange()"></p-toggleSwitch>
                                    <span>Follow</span>
                                </label>
                                <p-button icon="pi pi-refresh" [text]="true" [rounded]="true"
                                    (onClick)="loadLogs()" title="Refresh logs"></p-button>
                            </div>
                        </div>
                        <div class="log-viewer" #logContainer>
                            <pre class="log-content">{{ logContent() || 'No logs available.' }}</pre>
                        </div>
                    </div>
                </div>
            } @else {
                <div class="empty-state animate-in">
                    <div class="empty-icon-wrapper">
                        <i class="pi pi-exclamation-triangle empty-icon"></i>
                    </div>
                    <h3>Job not found</h3>
                    <p>The Spark application could not be loaded.</p>
                    <p-button icon="pi pi-arrow-left" severity="secondary" [outlined]="true" label="Back to jobs" (onClick)="goBack()"></p-button>
                </div>
            }
        </div>
    `,
    styles: [`
        :host { display: block; }

        .detail-page {
            padding-top: var(--db-space-md);
            max-width: 960px;
            margin: 0 auto;
        }

        .page-header { margin-bottom: var(--db-space-xl); }
        .breadcrumb {
            display: flex; align-items: center; gap: 8px;
            margin-bottom: var(--db-space-lg); font-size: 13px;
        }
        .breadcrumb-link {
            display: flex; align-items: center; gap: 6px;
            color: var(--db-text-secondary); cursor: pointer;
            text-decoration: none; font-weight: 500;
            padding: 4px 10px 4px 8px; border-radius: var(--db-radius-full);
            transition: all var(--db-transition-base);
        }
        .breadcrumb-link:hover { background: var(--db-bg-tertiary); color: var(--db-text-primary); }
        .breadcrumb-back-icon { font-size: 11px; }
        .breadcrumb-sep { font-size: 10px; color: var(--db-text-muted); }
        .breadcrumb-current { color: var(--db-text-muted); font-size: 13px; font-weight: 500; }

        .header-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .header-actions {
            display: flex; gap: 8px; margin-left: auto;
        }
        .header-badge {
            width: 56px; height: 56px; border-radius: var(--db-radius-xl);
            background: linear-gradient(135deg, #f59e0b, #d97706);
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 6px 16px rgba(245, 158, 11, 0.25);
        }
        .header-badge i { color: white; font-size: 1.4rem; }
        .header-text h2 {
            margin: 0; font-size: 28px; font-weight: 800;
            color: var(--db-text-primary); letter-spacing: -0.03em; line-height: 1.2;
        }
        .header-title-row { display: flex; align-items: center; gap: 12px; }
        .page-desc { margin: 6px 0 0; font-size: 15px; color: var(--db-text-secondary); }

        .detail-content {
            display: flex; flex-direction: column; gap: var(--db-space-lg);
            animation: fadeInUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.08s backwards;
        }

        .info-card {
            background: var(--db-bg-primary);
            border: 1px solid var(--db-border-light);
            border-radius: var(--db-radius-xl);
            padding: var(--db-space-lg);
        }
        .info-grid {
            display: grid; grid-template-columns: 1fr 1fr;
            gap: var(--db-space-md) var(--db-space-xl);
        }
        .info-item { display: flex; flex-direction: column; gap: 4px; }
        .info-item.full-width { grid-column: 1 / -1; }
        .info-label { font-size: 12px; font-weight: 500; color: var(--db-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .info-value { font-size: 14px; font-weight: 500; color: var(--db-text-primary); }
        .info-value.mono { font-family: monospace; font-size: 13px; }
        .error-text { color: var(--db-accent-red, #ef4444); }

        .section-card {
            background: var(--db-bg-primary);
            border: 1px solid var(--db-border-light);
            border-radius: var(--db-radius-xl);
            padding: var(--db-space-lg);
        }
        .section-header {
            display: flex; align-items: center; gap: 12px;
            margin-bottom: var(--db-space-md);
        }
        .section-icon-badge {
            width: 36px; height: 36px; border-radius: var(--db-radius-md);
            display: flex; align-items: center; justify-content: center;
        }
        .section-icon-badge i { font-size: 1rem; }
        .section-icon-badge.executors { background: var(--db-accent-purple-light, #f3e8ff); }
        .section-icon-badge.executors i { color: var(--db-accent-purple, #a855f7); }
        .section-icon-badge.logs { background: var(--db-primary-50); }
        .section-icon-badge.logs i { color: var(--db-primary); }
        .section-title {
            margin: 0; font-size: 16px; font-weight: 700;
            color: var(--db-text-primary); flex: 1;
        }

        .executor-list { display: flex; flex-direction: column; }
        .executor-row {
            display: flex; justify-content: space-between; align-items: center;
            padding: 8px 0; border-bottom: 1px solid var(--db-border-light);
        }
        .executor-row:last-child { border-bottom: none; }
        .executor-name { font-size: 13px; font-weight: 500; font-family: monospace; color: var(--db-text-primary); }

        .log-controls {
            display: flex; align-items: center; gap: var(--db-space-sm);
        }
        .follow-label {
            display: flex; align-items: center; gap: 6px;
            font-size: 13px; color: var(--db-text-secondary);
        }

        .log-viewer {
            background: #1e1e1e; border-radius: var(--db-radius-md);
            padding: var(--db-space-md); max-height: 500px; overflow: auto;
        }
        .log-content {
            margin: 0; font-family: monospace; font-size: 12px;
            line-height: 1.6; color: #d4d4d4; white-space: pre-wrap; word-break: break-all;
        }

        .loading-state {
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; padding: 64px; gap: var(--db-space-md);
            color: var(--db-text-muted);
        }
        .loading-spinner-ring {
            width: 48px; height: 48px; border-radius: 50%;
            background: var(--db-primary-50);
            display: flex; align-items: center; justify-content: center;
        }
        .loading-spinner-ring i { font-size: 1.3rem; color: var(--db-primary); }
        .empty-state {
            display: flex; flex-direction: column; align-items: center;
            padding: 64px; gap: var(--db-space-md);
            background: var(--db-bg-primary);
            border-radius: var(--db-radius-xl); border: 1px solid var(--db-border-light);
        }
        .empty-state h3 { margin: 0; font-size: 16px; font-weight: 600; }
        .empty-state p { margin: 0; font-size: 14px; color: var(--db-text-secondary); }

        @media (max-width: 768px) {
            .info-grid { grid-template-columns: 1fr; }
        }
    `]
})
export class SparkDetailPageComponent implements OnInit {
    private readonly api = inject(SparkApiService);
    private readonly context = inject(ProjectContextService);
    private readonly messageService = inject(MessageService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly destroyRef = inject(DestroyRef);

    app = signal<SparkAppInstance | null>(null);
    loading = signal(true);
    logContent = signal('');
    followMode = false;
    sparkUILoading = signal(false);

    private projectId = '';
    private appName = '';
    private logSub: Subscription | null = null;

    objectKeys = Object.keys;

    ngOnInit() {
        const project = this.context.currentProject();
        this.appName = this.route.snapshot.paramMap.get('appName') || '';
        this.projectId = project?.name || '';

        if (!this.projectId || !this.appName) {
            this.loading.set(false);
            return;
        }

        this.api.getApp(this.projectId, this.appName).subscribe({
            next: (app) => {
                this.app.set(app);
                this.loading.set(false);
                this.loadLogs();
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load Spark job details' });
                this.loading.set(false);
            }
        });

        this.destroyRef.onDestroy(() => {
            this.logSub?.unsubscribe();
        });
    }

    loadLogs() {
        this.logSub?.unsubscribe();

        if (this.followMode) {
            this.logContent.set('');
            this.logSub = this.api.streamDriverLogs(this.projectId, this.appName).subscribe({
                next: (line) => {
                    this.logContent.update(current => current + line + '\n');
                },
            });
        } else {
            this.api.getDriverLogs(this.projectId, this.appName, 200).subscribe({
                next: (logs) => this.logContent.set(logs),
                error: () => this.logContent.set('Failed to load logs.'),
            });
        }
    }

    onFollowChange() {
        this.loadLogs();
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

    getExecutorSeverity(state: string): "success" | "info" | "warn" | "danger" | "secondary" | "contrast" | undefined {
        switch (state) {
            case 'COMPLETED': return 'success';
            case 'RUNNING': return 'info';
            case 'PENDING': return 'warn';
            case 'FAILED': return 'danger';
            default: return 'secondary';
        }
    }

    isRunning(app: SparkAppInstance): boolean {
        return app?.status === 'RUNNING';
    }

    isTerminal(app: SparkAppInstance): boolean {
        return ['COMPLETED', 'FAILED', 'FAILING'].includes(app?.status);
    }

    openSparkUI() {
        this.openSparkLink('uiAddress', 'Spark UI unavailable', 'The live driver UI is not available yet.');
    }

    openHistoryServer() {
        this.openSparkLink('historyServerUrl', 'History Server unavailable', 'The Spark History Server URL could not be resolved.');
    }

    private openSparkLink(field: 'uiAddress' | 'historyServerUrl', warnTitle: string, warnDetail: string) {
        const project = this.context.currentProject();
        if (!project) return;

        this.sparkUILoading.set(true);
        this.api.getSparkUI(project.name, this.appName).subscribe({
            next: (info: SparkUIInfo) => {
                this.sparkUILoading.set(false);
                const url = info[field];
                if (url) {
                    window.open(url, '_blank');
                } else {
                    this.messageService.add({ severity: 'warn', summary: warnTitle, detail: warnDetail });
                }
            },
            error: () => {
                this.sparkUILoading.set(false);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to retrieve Spark UI info' });
            }
        });
    }

    editApp() {
        const project = this.context.currentProject();
        if (project) {
            this.router.navigate(['/project', project.name, 'spark', 'applications', this.appName, 'edit']);
        }
    }

    goBack() {
        const project = this.context.currentProject();
        if (project) {
            this.router.navigate(['/project', project.name, 'spark', 'applications']);
        }
    }
}
