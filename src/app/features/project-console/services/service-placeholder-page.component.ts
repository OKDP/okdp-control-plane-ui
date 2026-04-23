import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

/**
 * Placeholder page used for services that are part of the OKDP roadmap
 * but not yet packaged (Polaris, Trino, Airflow, Superset).
 *
 * Shape mirrors `services-page.component.ts` so the visual layout (header,
 * breadcrumb, action button) stays consistent with the real list pages.
 * The Deploy button is disabled and the body shows a "Coming soon" empty
 * state. Page metadata (title, breadcrumb parent, icon, description) is
 * driven entirely by `route.data` so adding more placeholders is a single
 * route entry — no new component per service.
 */
@Component({
    selector: 'app-service-placeholder-page',
    standalone: true,
    imports: [CommonModule, ToastModule],
    providers: [MessageService],
    template: `
        <p-toast></p-toast>

        <div class="services-list animate-in">
            <div class="page-heading">
                <div>
                    <div class="breadcrumb-thin">
                        <span>{{ section }}</span>
                        <i class="pi pi-angle-right" style="font-size: 10px"></i>
                        <span class="bc-current">{{ title }}</span>
                    </div>
                    <h1 class="page-title">
                        {{ title }}
                        <span class="poc-badge">POC · Coming soon</span>
                    </h1>
                    <p class="page-sub">{{ subtitle }}</p>
                </div>
                <button class="create-btn" disabled title="Not yet available">
                    <i class="pi pi-plus"></i>
                    <span>Deploy</span>
                </button>
            </div>

            <div class="empty-state-panel">
                <div class="empty-icon-wrapper">
                    <i [class]="icon"></i>
                </div>
                <h3>Coming soon</h3>
                <p>
                    {{ title }} integration is being packaged. Once shipped, platform
                    administrators will be able to deploy and manage instances from this
                    page; end-users will see them listed here for direct access.
                </p>
                <p class="muted-text small" style="margin-top: 6px">
                    Available to platform admins · the OKDP control plane is currently a POC.
                </p>
            </div>
        </div>
    `,
    styles: [`
        .poc-badge {
            display: inline-block;
            margin-left: 10px;
            padding: 2px 10px;
            font-size: 11px;
            font-weight: 600;
            border-radius: 999px;
            background: var(--db-bg-tertiary, #f3f4f6);
            color: var(--db-text-secondary, #6b7280);
            vertical-align: middle;
            letter-spacing: 0.02em;
        }
    `],
})
export class ServicePlaceholderPageComponent {
    private readonly route = inject(ActivatedRoute);

    readonly title: string;
    readonly subtitle: string;
    readonly section: string;
    readonly icon: string;

    constructor() {
        const data = this.route.snapshot.data;
        this.title = data['title'] || 'Service';
        this.subtitle = data['subtitle'] || '';
        this.section = data['section'] || '';
        this.icon = data['icon'] || 'pi pi-server';
    }
}
