import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { Pod } from '../../../core/models/service.model';

@Component({
    selector: 'app-pod-list',
    standalone: true,
    imports: [CommonModule, TableModule, TagModule, ButtonModule],
    template: `
        <p-table [value]="pods" [rowHover]="true" styleClass="minimal-table" dataKey="name">
            <ng-template pTemplate="header">
                <tr>
                    <th style="width: 35%">Pod</th>
                    <th style="width: 15%">Status</th>
                    <th style="width: 10%">Ready</th>
                    <th style="width: 10%">Restarts</th>
                    <th style="width: 10%">Age</th>
                    <th style="width: 20%"></th>
                </tr>
            </ng-template>
            <ng-template pTemplate="body" let-pod>
                <tr>
                    <td>
                        <span class="pod-name">{{ pod.name }}</span>
                    </td>
                    <td>
                        <p-tag [value]="pod.status" [severity]="getStatusSeverity(pod.status)"></p-tag>
                    </td>
                    <td>{{ pod.ready }}</td>
                    <td>{{ pod.restarts }}</td>
                    <td>{{ pod.age }}</td>
                    <td style="text-align: right">
                        <button pButton [text]="true" (click)="viewLogs.emit(pod)"
                            title="View pod logs" class="logs-btn">
                            <i class="pi pi-file"></i> Logs
                        </button>
                    </td>
                </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
                <tr>
                    <td colspan="6">
                        <div class="empty-state-inline">
                            <i class="pi pi-box"></i>
                            No pods found for this instance.
                        </div>
                    </td>
                </tr>
            </ng-template>
        </p-table>
    `,
    styles: [`
        .pod-name {
            font-weight: 500;
            font-family: monospace;
            font-size: 13px;
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
        .logs-btn {
            background: none;
            border: none;
            color: var(--db-primary);
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            font-family: inherit;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: var(--db-radius-md);
            transition: background var(--db-transition-base);
        }
        .logs-btn:hover {
            background: var(--db-primary-50);
        }
    `]
})
export class PodListComponent {
    @Input() pods: Pod[] = [];
    @Output() viewLogs = new EventEmitter<Pod>();

    getStatusSeverity(status: string): "success" | "info" | "warn" | "danger" | "secondary" | "contrast" | undefined {
        switch (status) {
            case 'Running': return 'success';
            case 'Succeeded': return 'info';
            case 'Pending': return 'warn';
            case 'Failed':
            case 'Error': return 'danger';
            default: return 'secondary';
        }
    }
}
