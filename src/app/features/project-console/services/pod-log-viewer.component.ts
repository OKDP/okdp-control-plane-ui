import {
    Component,
    Input,
    Output,
    EventEmitter,
    signal,
    computed,
    OnDestroy,
    OnChanges,
    SimpleChanges,
    ElementRef,
    ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { Subscription } from 'rxjs';
import { ServiceApiService } from '../../../core/api/service-api.service';
import { Pod } from '../../../core/models/service.model';

const MAX_LOG_LINES = 10000;
const AUTOSCROLL_THRESHOLD_PX = 40;

@Component({
    selector: 'app-pod-log-viewer',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, SelectModule, CheckboxModule],
    template: `
        <div class="log-viewer">
            <div class="log-toolbar">
                <div class="toolbar-left">
                    <i class="pi pi-file icon-file"></i>
                    <span class="toolbar-title">Logs</span>
                </div>
                <div class="toolbar-right">
                    @if (podOptions().length > 0) {
                        <p-select [(ngModel)]="selectedPodName"
                            [options]="podOptions()"
                            optionLabel="label" optionValue="value"
                            placeholder="Select pod"
                            appendTo="body"
                            styleClass="pod-select"
                            (ngModelChange)="onPodChange()">
                        </p-select>
                    }

                    @if (containerOptions().length > 1) {
                        <p-select [(ngModel)]="selectedContainer"
                            [options]="containerOptions()"
                            optionLabel="label" optionValue="value"
                            placeholder="Container"
                            appendTo="body"
                            styleClass="container-select"
                            (ngModelChange)="reload()">
                        </p-select>
                    }

                    <label class="follow-toggle">
                        <p-checkbox [(ngModel)]="followMode"
                            [binary]="true"
                            (ngModelChange)="onFollowChange()">
                        </p-checkbox>
                        <span class="follow-label">Follow</span>
                    </label>

                    <p-button icon="pi pi-download" [text]="true" [rounded]="true"
                        (onClick)="downloadLogs()" title="Download logs"></p-button>
                    @if (closable) {
                        <p-button icon="pi pi-times" [text]="true" [rounded]="true"
                            (onClick)="close.emit()" title="Close"></p-button>
                    }
                </div>
            </div>

            <div class="log-content" #logContainer (scroll)="onScroll()">
                @if (loading()) {
                    <div class="log-state">
                        <i class="pi pi-spin pi-spinner"></i>
                        Loading logs...
                    </div>
                } @else if (lines().length === 0) {
                    <div class="log-state muted">No logs available.</div>
                } @else {
                    <div class="log-lines">
                        @for (line of lines(); track $index; let i = $index) {
                            <div class="log-line">
                                <span class="line-no">{{ formatLineNo(i + 1) }}</span>
                                <span class="line-text">{{ line }}</span>
                            </div>
                        }
                        @if (followMode) {
                            <div class="streaming-row">
                                <span class="line-no"></span>
                                <span class="streaming-indicator">
                                    <span class="dot"></span>
                                    streaming
                                </span>
                            </div>
                        }
                    </div>
                }
            </div>
        </div>
    `,
    styles: [`
        .log-viewer {
            display: flex;
            flex-direction: column;
            border: 1px solid var(--db-border-light);
            border-radius: var(--db-radius-lg);
            overflow: hidden;
            background: var(--db-bg-primary);
        }
        .log-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: var(--db-bg-secondary);
            border-bottom: 1px solid var(--db-border-light);
            gap: 12px;
            flex-wrap: wrap;
        }
        .toolbar-left, .toolbar-right {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .toolbar-title {
            font-weight: 600;
            font-size: 14px;
            color: var(--db-text-primary);
        }
        .icon-file {
            color: var(--db-primary);
            font-size: 16px;
        }
        .follow-toggle {
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            user-select: none;
        }
        .follow-label {
            font-size: 13px;
            font-weight: 500;
            color: var(--db-text-secondary);
        }
        :host ::ng-deep .pod-select,
        :host ::ng-deep .container-select {
            min-width: 180px;
        }
        .log-content {
            background: #111827;
            color: #e5e7eb;
            min-height: 320px;
            max-height: 520px;
            overflow: auto;
            font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
            font-size: 12.5px;
            line-height: 1.7;
        }
        .log-lines {
            padding: 12px 0;
        }
        .log-line {
            display: flex;
            gap: 16px;
            padding: 0 16px;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .log-line:hover {
            background: rgba(255, 255, 255, 0.03);
        }
        .line-no {
            color: #6b7280;
            user-select: none;
            min-width: 32px;
            text-align: right;
            flex-shrink: 0;
        }
        .line-text {
            flex: 1;
            color: #e5e7eb;
        }
        .streaming-row {
            display: flex;
            gap: 16px;
            padding: 6px 16px 2px;
        }
        .streaming-indicator {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: #10b981;
            font-size: 12.5px;
            font-weight: 500;
        }
        .streaming-indicator .dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: #10b981;
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5);
            animation: pulse 1.4s ease-in-out infinite;
        }
        @keyframes pulse {
            0%   { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.55); }
            70%  { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);    }
            100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);      }
        }
        .log-state {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 56px;
            color: #9ca3af;
            font-size: 13px;
        }
        .log-state.muted { color: #6b7280; }
        .log-state i { font-size: 16px; }
    `]
})
export class PodLogViewerComponent implements OnChanges, OnDestroy {
    @Input() projectId!: string;
    @Input() serviceName!: string;
    @Input() pods: Pod[] = [];
    @Input() initialPodName?: string;
    @Input() closable = false;
    @Output() close = new EventEmitter<void>();

    @ViewChild('logContainer') logContainer!: ElementRef<HTMLElement>;

    private streamSub: Subscription | null = null;
    private stickToBottom = true;

    lines = signal<string[]>([]);
    loading = signal(true);

    selectedPodName = '';
    selectedContainer = '';
    followMode = true;

    podOptions = computed(() =>
        this.pods.map((p) => ({ label: p.name, value: p.name })),
    );

    containerOptions = signal<{ label: string; value: string }[]>([]);

    constructor(private apiService: ServiceApiService) {}

    ngOnChanges(changes: SimpleChanges) {
        if (changes['pods'] || changes['initialPodName']) {
            const requested = this.initialPodName && this.pods.find((p) => p.name === this.initialPodName)
                ? this.initialPodName
                : null;
            const current = this.pods.find((p) => p.name === this.selectedPodName);

            if (requested && requested !== this.selectedPodName) {
                this.selectedPodName = requested;
                this.refreshContainersAndReload();
            } else if (!current && this.pods.length > 0) {
                this.selectedPodName = this.pods[0].name;
                this.refreshContainersAndReload();
            } else if (current && this.containerOptions().length === 0) {
                this.refreshContainersAndReload();
            }
        }
    }

    ngOnDestroy() {
        this.streamSub?.unsubscribe();
    }

    onPodChange() {
        this.refreshContainersAndReload();
    }

    onFollowChange() {
        this.stickToBottom = true;
        this.reload();
    }

    onScroll() {
        const el = this.logContainer?.nativeElement;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        this.stickToBottom = distanceFromBottom <= AUTOSCROLL_THRESHOLD_PX;
    }

    formatLineNo(n: number): string {
        return String(n).padStart(3, '0');
    }

    private refreshContainersAndReload() {
        const pod = this.pods.find((p) => p.name === this.selectedPodName);
        const options = (pod?.containers ?? []).map((c) => ({ label: c.name, value: c.name }));
        this.containerOptions.set(options);
        this.selectedContainer = options[0]?.value ?? '';
        this.reload();
    }

    reload() {
        this.streamSub?.unsubscribe();
        this.streamSub = null;
        this.loading.set(true);
        this.lines.set([]);

        if (!this.selectedPodName) {
            this.loading.set(false);
            return;
        }

        if (this.followMode) {
            this.streamSub = this.apiService
                .streamPodLogs(
                    this.projectId,
                    this.serviceName,
                    this.selectedPodName,
                    this.selectedContainer,
                    200,
                )
                .subscribe({
                    next: (line) => {
                        const next = [...this.lines(), line];
                        if (next.length > MAX_LOG_LINES) {
                            next.splice(0, next.length - MAX_LOG_LINES);
                        }
                        this.lines.set(next);
                        this.loading.set(false);
                        this.scrollIfSticky();
                    },
                    error: () => this.loading.set(false),
                    complete: () => this.loading.set(false),
                });
        } else {
            this.apiService
                .getPodLogs(
                    this.projectId,
                    this.serviceName,
                    this.selectedPodName,
                    500,
                    this.selectedContainer,
                )
                .subscribe({
                    next: (text) => {
                        const split = text ? text.split('\n').filter((l) => l.length > 0) : [];
                        this.lines.set(split);
                        this.loading.set(false);
                        this.scrollIfSticky();
                    },
                    error: () => {
                        this.lines.set(['Failed to load logs.']);
                        this.loading.set(false);
                    },
                });
        }
    }

    downloadLogs() {
        const content = this.lines().join('\n');
        if (!content) return;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.selectedPodName || 'pod'}.log`;
        a.click();
        URL.revokeObjectURL(url);
    }

    private scrollIfSticky() {
        if (!this.stickToBottom) return;
        setTimeout(() => {
            const el = this.logContainer?.nativeElement;
            if (el) el.scrollTop = el.scrollHeight;
        }, 0);
    }
}
