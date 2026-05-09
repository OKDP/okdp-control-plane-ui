import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ProjectContextService } from '../../../core/context/project-context.service';
import { ServiceListComponent } from './service-list.component';

@Component({
    selector: 'app-services-page',
    standalone: true,
    imports: [CommonModule, ServiceListComponent],
    template: `
        <div class="services-list animate-in">
            <div class="page-heading">
                <div>
                    <div class="breadcrumb-thin">
                        <span>{{ breadcrumbParent }}</span>
                        <i class="pi pi-angle-right" style="font-size: 10px"></i>
                        <span class="bc-current">{{ breadcrumbCurrent }}</span>
                    </div>
                    <h1 class="page-title">{{ title }}</h1>
                    <p class="page-sub">{{ subtitle }}</p>
                </div>
                <button class="create-btn" (click)="goToDeploy()">
                    <i class="pi pi-plus"></i>
                    <span>{{ deployLabel }}</span>
                </button>
            </div>

            <app-service-list
                [serviceFilter]="serviceFilter"
                [emptyMessage]="emptyMessage"
                [emptyTitle]="emptyTitle"
                [basePath]="basePath"
                (deploy)="goToDeploy()">
            </app-service-list>
        </div>
    `,
})
export class ServicesPageComponent {
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly context = inject(ProjectContextService);

    readonly title: string;
    readonly subtitle: string;
    readonly deployLabel: string;
    readonly serviceFilter: string;
    readonly emptyMessage: string;
    readonly emptyTitle: string;
    readonly breadcrumbParent: string;
    readonly breadcrumbCurrent: string;
    // URL segments under /project/:projectId for this page's "service area".
    // Routes for deploy/edit/detail are mirrored under each area so the
    // sidebar's routerLinkActive highlights the correct entry (otherwise
    // anything under /services/* lights up the Jupyter link, even when the
    // user clicked Deploy from the Spark History Server page).
    readonly basePath: string[];

    constructor() {
        const data = this.route.snapshot.data;
        this.title = data['title'] || 'Service instances';
        this.deployLabel = data['deployLabel'] || 'New instance';
        this.serviceFilter = data['serviceFilter'] || '';
        this.emptyMessage = data['emptyMessage'] || 'No instances deployed yet.';
        // Each service may live under a section-specific URL prefix; the
        // breadcrumb back-link must follow that prefix (otherwise clicking
        // "Trino" from the detail page would land on /services).
        this.basePath =
            this.serviceFilter === 'spark-history-server' ? ['spark', 'history-server']
            : this.serviceFilter === 'polaris'            ? ['lakehouse', 'polaris']
            : this.serviceFilter === 'trino'              ? ['lakehouse', 'trino']
            : ['services'];

        // Derive breadcrumb + subtitle from the service filter when not provided.
        if (this.serviceFilter === 'jupyterhub') {
            this.breadcrumbParent = data['breadcrumbParent'] || 'Notebook';
            this.breadcrumbCurrent = data['breadcrumbCurrent'] || 'Jupyter';
            this.subtitle =
                data['subtitle'] ||
                "Launch and manage per-user JupyterLab environments running in this project's namespace.";
            this.emptyTitle = data['emptyTitle'] || 'Launch your first Jupyter instance';
        } else if (this.serviceFilter === 'spark-history-server') {
            this.breadcrumbParent = data['breadcrumbParent'] || 'Spark';
            this.breadcrumbCurrent = data['breadcrumbCurrent'] || 'History Server';
            this.subtitle =
                data['subtitle'] ||
                'Browse completed Spark applications and stream live job monitoring UIs.';
            this.emptyTitle = data['emptyTitle'] || 'Deploy a Spark History Server';
        } else if (this.serviceFilter === 'trino') {
            this.breadcrumbParent = data['breadcrumbParent'] || 'Lakehouse';
            this.breadcrumbCurrent = data['breadcrumbCurrent'] || 'Trino';
            this.subtitle =
                data['subtitle'] ||
                'Distributed SQL query engine. Query data across the lakehouse and federated sources.';
            this.emptyTitle = data['emptyTitle'] || 'Deploy Trino';
        } else if (this.serviceFilter === 'polaris') {
            this.breadcrumbParent = data['breadcrumbParent'] || 'Lakehouse';
            this.breadcrumbCurrent = data['breadcrumbCurrent'] || 'Polaris';
            this.subtitle =
                data['subtitle'] ||
                'Iceberg-native data catalog. Centralize table metadata across engines.';
            this.emptyTitle = data['emptyTitle'] || 'Deploy Polaris';
        } else {
            this.breadcrumbParent = data['breadcrumbParent'] || 'Services';
            this.breadcrumbCurrent = data['breadcrumbCurrent'] || 'Instances';
            this.subtitle = data['subtitle'] || '';
            this.emptyTitle = data['emptyTitle'] || 'No instances yet';
        }
    }

    goToDeploy() {
        const project = this.context.currentProject();
        if (!project) return;

        const currentPath = this.router.url;
        const queryParams: Record<string, string> = { returnTo: currentPath };
        if (this.serviceFilter) {
            queryParams['service'] = this.serviceFilter;
        }
        this.router.navigate(['/project', project.name, ...this.basePath, 'deploy'], { queryParams });
    }
}
