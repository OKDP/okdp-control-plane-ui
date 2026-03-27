import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { forkJoin } from 'rxjs';
import { ServiceApiService } from '../../../core/api/service-api.service';
import { ProjectContextService } from '../../../core/context/project-context.service';
import { ServiceInstance, Pod, ServiceMetrics } from '../../../core/models/service.model';
import { PodListComponent } from './pod-list.component';
import { PodLogViewerComponent } from './pod-log-viewer.component';

type Tab = 'overview' | 'pods' | 'logs' | 'parameters';

@Component({
    selector: 'app-service-detail-page',
    standalone: true,
    imports: [
        CommonModule,
        ToastModule,
        ConfirmDialogModule,
        PodListComponent,
        PodLogViewerComponent,
    ],
    providers: [MessageService, ConfirmationService],
    template: `
        <p-toast></p-toast>
        <p-confirmDialog></p-confirmDialog>

        <div class="detail-page animate-in">
            <div class="page-header">
                <nav class="breadcrumb">
                    <a
                        class="breadcrumb-link"
                        (click)="goBack()"
                        (keydown.enter)="goBack()"
                        tabindex="0">
                        <i class="pi pi-arrow-left" style="font-size: 11px"></i>
                        {{ parentLabel() }}
                    </a>
                    <i class="pi pi-angle-right" style="font-size: 10px; color: var(--db-text-muted)"></i>
                    <span class="breadcrumb-current">{{ instance()?.name || serviceName }}</span>
                </nav>

                @if (instance(); as inst) {
                    <div class="header-row">
                        <div class="header-badge">
                            <i class="pi pi-server"></i>
                        </div>
                        <div class="header-text">
                            <div class="header-title-row">
                                <h2>{{ inst.name }}</h2>
                                <span class="okdp-tag" [class]="tagClass(inst.status)">
                                    @if (inst.status === 'Installing' || inst.status === 'Updating') {
                                        <span class="okdp-tag-dot"></span>
                                    }
                                    {{ inst.status }}
                                </span>
                            </div>
                            <p class="page-desc">
                                {{ inst.service }} ·
                                <span class="mono">{{ inst.serviceTag }}</span>
                            </p>
                        </div>
                        <div class="header-actions">
                            @if (inst.url) {
                                <button
                                    class="btn-secondary"
                                    [disabled]="inst.status !== 'Ready'"
                                    (click)="openExternal()">
                                    <i class="pi pi-external-link"></i>
                                    Open
                                </button>
                            }
                            <button class="btn-secondary" (click)="refreshAll()">
                                <i class="pi pi-refresh"></i>
                                Refresh
                            </button>
                            <button class="btn-secondary" (click)="editInstance()">
                                <i class="pi pi-pencil"></i>
                                Edit
                            </button>
                            <button class="btn-secondary danger" (click)="confirmDelete()">
                                <i class="pi pi-trash"></i>
                                Delete
                            </button>
                        </div>
                    </div>
                }
            </div>

            @if (loading()) {
                <div class="empty-state-panel">
                    <div class="empty-icon-wrapper">
                        <i class="pi pi-spin pi-spinner"></i>
                    </div>
                    <h3>Loading instance details…</h3>
                </div>
            } @else if (instance(); as inst) {
                <div class="okdp-tabs">
                    @for (t of tabs; track t) {
                        <button
                            class="okdp-tab"
                            [class.active]="tab() === t"
                            (click)="tab.set(t)">
                            {{ tabLabel(t) }}
                            @if (t === 'pods') {
                                <span class="tab-count">{{ pods().length }}</span>
                            }
                        </button>
                    }
                </div>

                @if (tab() === 'overview') {
                    <div class="detail-content">
                        @if (inst.status === 'Error') {
                            <div class="alert alert-danger">
                                <i class="pi pi-exclamation-circle"></i>
                                <div>
                                    <strong>Instance failed to start</strong>
                                    @if (inst.statusMessage) {
                                        <p class="mono">{{ inst.statusMessage }}</p>
                                    } @else {
                                        <p class="mono">Check the pod logs for the underlying error.</p>
                                    }
                                </div>
                            </div>
                        }
                        @if (inst.status === 'Updating') {
                            <div class="alert alert-warn">
                                <i class="pi pi-spin pi-spinner"></i>
                                <div>
                                    <strong>Updating…</strong>
                                    @if (inst.statusMessage) {
                                        <p class="mono">{{ inst.statusMessage }}</p>
                                    } @else {
                                        <p>KuboCD is rolling out the new configuration.</p>
                                    }
                                </div>
                            </div>
                        }
                        @if (inst.status === 'Installing') {
                            <div class="alert alert-warn">
                                <i class="pi pi-spin pi-spinner"></i>
                                <div>
                                    <strong>Installing…</strong>
                                    @if (inst.statusMessage) {
                                        <p class="mono">{{ inst.statusMessage }}</p>
                                    } @else {
                                        <p>Pulling image and scheduling pod. This usually takes ~30s.</p>
                                    }
                                </div>
                            </div>
                        }

                        <div class="info-card">
                            <div class="info-grid">
                                <div class="info-item">
                                    <span class="info-label">Instance name</span>
                                    <span class="info-value">{{ inst.name }}</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Release</span>
                                    <span class="info-value mono">{{ inst.releaseName }}</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Namespace</span>
                                    <span class="info-value mono">{{ inst.targetNamespace }}</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Service</span>
                                    <span class="info-value">{{ inst.service }}</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Version</span>
                                    <span class="info-value mono">{{ inst.serviceTag }}</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Created</span>
                                    <span class="info-value">
                                        {{ inst.createdAt ? (inst.createdAt | date: 'medium') : '—' }}
                                    </span>
                                </div>
                                @if (inst.url) {
                                    <div class="info-item info-item-wide">
                                        <span class="info-label">URL</span>
                                        <a
                                            class="info-link mono"
                                            [href]="inst.url"
                                            target="_blank"
                                            rel="noopener">
                                            {{ inst.url }}
                                            <i class="pi pi-external-link" style="font-size: 11px"></i>
                                        </a>
                                    </div>
                                }
                            </div>
                        </div>

                        <div class="section-card">
                            <div class="section-header">
                                <div class="section-icon-badge chart">
                                    <i class="pi pi-chart-bar"></i>
                                </div>
                                <h3 class="section-title">Resource usage</h3>
                                <span class="muted-text small">Last 5 min</span>
                            </div>
                            <div class="metric-grid">
                                <div class="metric" [class.unbounded]="cpuUsage().unbounded">
                                    <div class="metric-top">
                                        <span class="metric-label">CPU</span>
                                        @if (!cpuUsage().unbounded) {
                                            <span class="metric-unit">
                                                <span class="metric-used">{{ cpuUsage().used }}</span>
                                                <span class="metric-sep">/</span>
                                                <span>{{ cpuUsage().limit }} cores</span>
                                            </span>
                                        }
                                    </div>
                                    @if (cpuUsage().unbounded) {
                                        <div class="metric-value">
                                            <span class="metric-value-big">{{ cpuUsage().used }}</span>
                                            <span class="muted-text small">cores</span>
                                            <span class="metric-hint" style="margin-left: auto">No limit set</span>
                                        </div>
                                    } @else {
                                        <div class="metric-bar">
                                            <div
                                                class="metric-fill"
                                                [class.tone-warn]="cpuUsage().pct > 0.6 && cpuUsage().pct <= 0.8"
                                                [class.tone-danger]="cpuUsage().pct > 0.8"
                                                [style.width.%]="cpuUsage().pct * 100">
                                            </div>
                                        </div>
                                        <div class="metric-pct">{{ cpuUsage().pctLabel }}</div>
                                    }
                                </div>
                                <div class="metric" [class.unbounded]="memUsage().unbounded">
                                    <div class="metric-top">
                                        <span class="metric-label">Memory</span>
                                        @if (!memUsage().unbounded) {
                                            <span class="metric-unit">
                                                <span class="metric-used">{{ memUsage().used }}</span>
                                                <span class="metric-sep">/</span>
                                                <span>{{ memUsage().limit }}</span>
                                            </span>
                                        }
                                    </div>
                                    @if (memUsage().unbounded) {
                                        <div class="metric-value">
                                            <span class="metric-value-big">{{ memUsage().used }}</span>
                                            <span class="metric-hint" style="margin-left: auto">No limit set</span>
                                        </div>
                                    } @else {
                                        <div class="metric-bar">
                                            <div
                                                class="metric-fill"
                                                [class.tone-warn]="memUsage().pct > 0.6 && memUsage().pct <= 0.8"
                                                [class.tone-danger]="memUsage().pct > 0.8"
                                                [style.width.%]="memUsage().pct * 100">
                                            </div>
                                        </div>
                                        <div class="metric-pct">{{ memUsage().pctLabel }}</div>
                                    }
                                </div>
                            </div>
                        </div>

                        <div class="section-card">
                            <div class="section-header">
                                <div class="section-icon-badge">
                                    <i class="pi pi-box"></i>
                                </div>
                                <h3 class="section-title">Pods</h3>
                                <span class="muted-text small">
                                    {{ runningPods() }} / {{ pods().length }} running
                                </span>
                            </div>
                            <app-pod-list
                                [pods]="pods()"
                                (viewLogs)="onViewLogs($event)">
                            </app-pod-list>
                        </div>
                    </div>
                }

                @if (tab() === 'pods') {
                    <div class="section-card">
                        <app-pod-list
                            [pods]="pods()"
                            (viewLogs)="onViewLogs($event)">
                        </app-pod-list>
                    </div>
                }

                @if (tab() === 'logs') {
                    @if (pods().length > 0) {
                        <app-pod-log-viewer
                            [projectId]="projectId"
                            [serviceName]="serviceName"
                            [pods]="pods()"
                            [initialPodName]="selectedPod()?.name">
                        </app-pod-log-viewer>
                    } @else {
                        <div class="section-card">
                            <div class="section-header">
                                <div class="section-icon-badge">
                                    <i class="pi pi-file"></i>
                                </div>
                                <h3 class="section-title">Logs</h3>
                            </div>
                            <p class="muted-text" style="padding: 12px 0 0">
                                No pods available yet. Logs will appear here once the service is running.
                            </p>
                        </div>
                    }
                }

                @if (tab() === 'parameters') {
                    <div class="section-card">
                        @if (paramEntries().length > 0) {
                            <div class="param-list">
                                @for (param of paramEntries(); track param.key) {
                                    <div class="param-row">
                                        <span class="param-key mono">{{ param.key }}</span>
                                        <span class="param-value mono">{{ param.value }}</span>
                                    </div>
                                }
                            </div>
                        } @else {
                            <p class="muted-text">No parameters set on this instance.</p>
                        }
                    </div>
                }
            } @else {
                <div class="empty-state-panel">
                    <div class="empty-icon-wrapper">
                        <i class="pi pi-exclamation-triangle"></i>
                    </div>
                    <h3>Instance not found</h3>
                    <p>The service instance could not be loaded.</p>
                    <button class="btn-secondary" (click)="goBack()">
                        <i class="pi pi-arrow-left"></i>
                        Back to instances
                    </button>
                </div>
            }
        </div>
    `,
})
export class ServiceDetailPageComponent implements OnInit, OnDestroy {
    private readonly api = inject(ServiceApiService);
    private readonly context = inject(ProjectContextService);
    private readonly messageService = inject(MessageService);
    private readonly confirmationService = inject(ConfirmationService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);

    instance = signal<ServiceInstance | null>(null);
    pods = signal<Pod[]>([]);
    loading = signal(true);
    selectedPod = signal<Pod | null>(null);
    paramEntries = signal<{ key: string; value: string }[]>([]);
    tab = signal<Tab>('overview');
    metrics = signal<ServiceMetrics | null>(null);
    private metricsPollId: ReturnType<typeof setInterval> | null = null;

    readonly tabs: Tab[] = ['overview', 'pods', 'logs', 'parameters'];

    runningPods = computed(
        () => this.pods().filter((p) => p.status === 'Running' || p.status === 'Ready').length,
    );

    cpuUsage = computed(() => this.resourceUsage('cpu'));
    memUsage = computed(() => this.resourceUsage('memory'));

    private resourceUsage(kind: 'cpu' | 'memory') {
        const m = this.metrics();
        if (!m) {
            return { used: '—', limit: '—', pct: 0, pctLabel: '—', unbounded: false };
        }
        const v = kind === 'cpu' ? m.cpu : m.memory;
        const hasLimit = v.limitRaw > 0;
        return {
            used: v.available ? v.used : '—',
            limit: hasLimit ? v.limit : '—',
            pct: v.pct,
            pctLabel: hasLimit ? `${Math.round(v.pct * 100)}%` : '',
            unbounded: v.available && !hasLimit,
        };
    }

    projectId = '';
    serviceName = '';

    ngOnInit() {
        const project = this.context.currentProject();
        this.serviceName = this.route.snapshot.paramMap.get('serviceName') || '';
        this.projectId = project?.name || '';

        if (!this.projectId || !this.serviceName) {
            this.loading.set(false);
            return;
        }

        this.loadAll();
        this.startMetricsPolling();
    }

    ngOnDestroy() {
        if (this.metricsPollId !== null) {
            clearInterval(this.metricsPollId);
            this.metricsPollId = null;
        }
    }

    private startMetricsPolling() {
        // Fetch immediately then every 10s.
        this.fetchMetrics();
        this.metricsPollId = setInterval(() => this.fetchMetrics(), 10_000);
    }

    private fetchMetrics() {
        if (!this.projectId || !this.serviceName) return;
        this.api.getServiceMetrics(this.projectId, this.serviceName).subscribe({
            next: (m) => this.metrics.set(m),
            error: () => {
                // Leave metrics as null; UI falls back to "—".
            },
        });
    }

    private loadAll() {
        this.loading.set(true);
        forkJoin({
            instance: this.api.getService(this.projectId, this.serviceName),
            pods: this.api.getPods(this.projectId, this.serviceName),
        }).subscribe({
            next: ({ instance, pods }) => {
                this.instance.set(instance);
                this.pods.set(pods);

                const params = instance.parameters || {};
                const entries: { key: string; value: string }[] = [];
                for (const [k, v] of Object.entries(params)) {
                    if (k === 'profiles') continue;
                    entries.push({
                        key: k,
                        value: typeof v === 'object' ? JSON.stringify(v) : String(v),
                    });
                }
                this.paramEntries.set(entries);
                this.loading.set(false);
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Failed to load instance details',
                });
                this.loading.set(false);
            },
        });
    }

    refreshAll() {
        this.loadAll();
    }

    onViewLogs(pod: Pod) {
        this.selectedPod.set(pod);
        this.tab.set('logs');
    }

    openExternal() {
        const url = this.instance()?.url;
        if (url) window.open(url, '_blank');
    }

    editInstance() {
        const project = this.context.currentProject();
        if (project) {
            this.router.navigate(
                ['/project', project.name, 'services', this.serviceName, 'edit'],
                { queryParams: { returnTo: this.router.url } },
            );
        }
    }

    confirmDelete() {
        const inst = this.instance();
        if (!inst) return;
        this.confirmationService.confirm({
            message: `This will remove "${inst.name}" and all its pods. This cannot be undone.`,
            header: 'Delete this instance?',
            icon: 'pi pi-exclamation-triangle',
            acceptButtonStyleClass: 'p-button-danger',
            accept: () => this.delete(),
        });
    }

    private delete() {
        const inst = this.instance();
        if (!inst) return;
        this.api.deleteService(this.projectId, inst.name).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Instance deleted',
                    detail: `"${inst.name}" has been removed`,
                });
                this.goBack();
            },
            error: (err) => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.error || 'Failed to delete instance',
                });
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

    tabLabel(t: Tab): string {
        return t.charAt(0).toUpperCase() + t.slice(1);
    }

    parentLabel(): string {
        const svc = this.instance()?.service;
        if (svc === 'jupyterhub') return 'Jupyter';
        if (svc === 'spark-history-server') return 'History Server';
        return svc || 'Services';
    }

    goBack() {
        const project = this.context.currentProject();
        if (!project) return;
        const returnTo = this.route.snapshot.queryParamMap.get('returnTo');
        if (returnTo) {
            this.router.navigateByUrl(returnTo);
        } else {
            this.router.navigate(['/project', project.name, 'services']);
        }
    }
}
