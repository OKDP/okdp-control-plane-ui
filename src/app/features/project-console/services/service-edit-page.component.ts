import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';
import { ServiceApiService } from '../../../core/api/service-api.service';
import { ProjectContextService } from '../../../core/context/project-context.service';
import { ServiceInstance } from '../../../core/models/service.model';
import { DynamicSchemaFormComponent } from '../../../shared/components/dynamic-schema-form.component';
import {
    ProfileListEditorComponent,
    Profile,
} from '../../../shared/components/profile-list-editor.component';

@Component({
    selector: 'app-service-edit-page',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        SelectModule,
        ToastModule,
        DynamicSchemaFormComponent,
        ProfileListEditorComponent,
    ],
    providers: [MessageService],
    template: `
        <p-toast></p-toast>

        <div class="deploy-page animate-in">
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
                    <a class="breadcrumb-link" (click)="goBack()" tabindex="0">
                        {{ instance()?.name }}
                    </a>
                    <i class="pi pi-angle-right" style="font-size: 10px; color: var(--db-text-muted)"></i>
                    <span class="breadcrumb-current">Edit</span>
                </nav>

                @if (instance(); as inst) {
                    <div class="header-row">
                        <div class="header-badge">
                            <i class="pi pi-pencil"></i>
                        </div>
                        <div class="header-text">
                            <div class="header-title-row">
                                <h2>
                                    Edit
                                    <span class="mono" style="font-weight: 600">{{ inst.name }}</span>
                                </h2>
                                <span class="okdp-tag" [class]="tagClass(inst.status)">
                                    @if (inst.status === 'Installing' || inst.status === 'Updating') {
                                        <span class="okdp-tag-dot"></span>
                                    }
                                    {{ inst.status }}
                                </span>
                            </div>
                            <p class="page-desc">
                                Change version, parameters or profiles. Saving will trigger a rolling restart.
                            </p>
                        </div>
                    </div>
                }
            </div>

            @if (loading()) {
                <div class="empty-state-panel">
                    <div class="empty-icon-wrapper">
                        <i class="pi pi-spin pi-spinner"></i>
                    </div>
                    <h3>Loading instance configuration…</h3>
                </div>
            } @else if (instance(); as inst) {
                @if (hasPendingChanges() && inst.status === 'Ready') {
                    <div class="edit-banner">
                        <i class="pi pi-info-circle"></i>
                        <div>
                            <strong>A restart will be required.</strong>
                            <span class="muted-text">
                                Running kernels will be interrupted. Unsaved notebook changes are preserved on the persistent volume.
                            </span>
                        </div>
                    </div>
                }

                <div class="form-card">
                    <div class="form-section">
                        <div class="form-field">
                            <label>Instance name</label>
                            <input
                                class="text-input mono"
                                [value]="inst.name"
                                disabled />
                            <small class="field-hint">Name cannot be changed after creation.</small>
                        </div>

                        <div class="form-field">
                            <div class="field-head">
                                <label style="margin: 0">Version</label>
                                <span class="muted-text small mono">{{ inst.service }}</span>
                            </div>
                            <small class="field-hint" style="margin-top: 0; margin-bottom: 10px">
                                Currently <span class="mono">{{ inst.serviceTag }}</span>. Changing the tag reloads the parameter schema.
                            </small>
                            @if (versionOptions().length > 0) {
                                <p-select
                                    [(ngModel)]="selectedTag"
                                    [options]="versionOptions()"
                                    optionLabel="label"
                                    optionValue="value"
                                    appendTo="body"
                                    styleClass="w-full"
                                    (ngModelChange)="onVersionChange($event)">
                                </p-select>
                            } @else {
                                <span class="version-badge mono">{{ inst.serviceTag }}</span>
                            }
                        </div>
                    </div>
                </div>

                <div class="form-card" style="margin-top: 14px">
                    @if (schemaLoading()) {
                        <div class="form-section">
                            <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0">
                                <i class="pi pi-spin pi-spinner" style="color: var(--db-primary); font-size: 18px"></i>
                                <div>
                                    <strong>Loading configuration schema…</strong>
                                    <div class="muted-text small">
                                        Fetching {{ inst.service }}:{{ selectedTag }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    } @else if (filteredSchema()) {
                        <div class="form-section">
                            <app-dynamic-schema-form
                                [schema]="filteredSchema()"
                                [initialValues]="parameterValues()"
                                (parametersChange)="onParametersChange($event)"
                                (validityChange)="paramsValid.set($event)">
                            </app-dynamic-schema-form>
                        </div>
                    }

                    @if (existingProfiles().length > 0 || needsProfileEditor()) {
                        <div class="form-section" style="margin-top: 20px">
                            <div class="field-head">
                                <label style="margin: 0">Profiles</label>
                                <span class="muted-text small">
                                    Notebook environments users can launch.
                                </span>
                            </div>
                            <app-profile-list-editor
                                [profileImages]="profileImages()"
                                [initialProfiles]="existingProfiles()"
                                (profilesChange)="onProfilesChange($event)">
                            </app-profile-list-editor>
                        </div>
                    }
                </div>

                <div class="wizard-actions">
                    <button class="btn-secondary" (click)="goBack()" [disabled]="saving()">
                        Cancel
                    </button>
                    <div class="wa-right">
                        <button
                            class="create-btn"
                            (click)="save()"
                            [disabled]="saving() || !paramsValid()">
                            @if (saving()) {
                                <i class="pi pi-spin pi-spinner"></i>
                                Saving…
                            } @else {
                                <i class="pi pi-check"></i>
                                Save changes
                            }
                        </button>
                    </div>
                </div>
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
export class ServiceEditPageComponent implements OnInit {
    private readonly api = inject(ServiceApiService);
    private readonly context = inject(ProjectContextService);
    private readonly messageService = inject(MessageService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);

    instance = signal<ServiceInstance | null>(null);
    loading = signal(true);
    saving = signal(false);
    // Mirrors the validity state of the dynamic schema form so Save can be
    // disabled when a CPU/memory quantity is malformed (e.g. "1" instead of
    // "1Gi"). Starts true so an untouched form with valid defaults is saveable.
    paramsValid = signal(true);
    schemaLoading = signal(false);
    filteredSchema = signal<any>(null);
    rawSchema = signal<any>(null);
    profileImages = signal<Record<string, { label: string; image: string }[]>>({});
    parameterValues = signal<Record<string, any>>({});
    existingProfiles = signal<Profile[]>([]);
    versionOptions = signal<{ label: string; value: string }[]>([]);

    selectedTag = '';
    private originalTag = '';
    private parameters: Record<string, any> = {};
    private profiles: Profile[] = [];

    hasPendingChanges = computed(() => this.selectedTag !== this.originalTag);

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

    parentLabel(): string {
        const svc = this.instance()?.service;
        if (svc === 'jupyterhub') return 'Jupyter';
        if (svc === 'spark-history-server') return 'History Server';
        if (svc === 'polaris') return 'Polaris';
        if (svc === 'trino') return 'Trino';
        if (svc === 'airflow') return 'Airflow';
        if (svc === 'superset') return 'Superset';
        return svc || 'Services';
    }

    needsProfileEditor(): boolean {
        const schema = this.rawSchema();
        if (!schema?.properties) return false;
        return Object.values<any>(schema.properties).some(
            (def) => def['x-ui-widget'] === 'profile-editor',
        );
    }

    ngOnInit() {
        const project = this.context.currentProject();
        const serviceName = this.route.snapshot.paramMap.get('serviceName');
        if (!project || !serviceName) {
            this.loading.set(false);
            return;
        }

        forkJoin({
            instance: this.api.getService(project.name, serviceName),
            profileImages: this.api.getProfileImages(),
            platformServices: this.api.getPlatformServices(),
        }).subscribe({
            next: ({ instance, profileImages, platformServices }) => {
                this.instance.set(instance);
                this.profileImages.set(profileImages);

                this.selectedTag = instance.serviceTag;
                this.originalTag = instance.serviceTag;

                const svc = platformServices.find((s) => s.name === instance.service);
                if (svc?.versions?.length) {
                    this.versionOptions.set(
                        svc.versions.map((v) => ({
                            label: v === svc.defaultVersion ? `${v} (recommended)` : v,
                            value: v,
                        })),
                    );
                }

                const { profiles, ...params } = instance.parameters || {};
                this.parameterValues.set(params);
                this.parameters = { ...params };

                if (Array.isArray(profiles) && profiles.length > 0) {
                    this.existingProfiles.set(profiles);
                    this.profiles = [...profiles];
                }

                this.loadSchema(instance.service, instance.serviceTag);
                this.loading.set(false);
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Failed to load instance',
                });
                this.loading.set(false);
            },
        });
    }

    private loadSchema(serviceName: string, tag: string) {
        this.schemaLoading.set(true);
        this.api.getServiceSchema(serviceName, tag).subscribe({
            next: (schema) => {
                this.rawSchema.set(schema);
                this.filteredSchema.set(this.stripProfileEditorFields(schema));
                this.schemaLoading.set(false);
            },
            error: () => {
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Schema unavailable',
                    detail: 'Could not load configuration schema.',
                });
                this.schemaLoading.set(false);
            },
        });
    }

    private stripProfileEditorFields(schema: any): any {
        if (!schema?.properties) return schema;
        const filtered = { ...schema, properties: { ...schema.properties } };
        for (const [key, def] of Object.entries<any>(filtered.properties)) {
            if (def['x-ui-widget'] === 'profile-editor') {
                delete filtered.properties[key];
            }
        }
        return filtered;
    }

    onVersionChange(tag: string) {
        const inst = this.instance();
        if (!inst || !tag) return;
        this.filteredSchema.set(null);
        this.loadSchema(inst.service, tag);
    }

    onParametersChange(params: Record<string, any>) {
        this.parameters = params;
    }

    onProfilesChange(profiles: Profile[]) {
        this.profiles = profiles;
    }

    save() {
        const project = this.context.currentProject();
        const svc = this.instance();
        if (!project || !svc) return;

        this.saving.set(true);
        // Only include `profiles` when the service schema actually expects it
        // (e.g. JupyterHub). Other services (Trino, Polaris, Superset, Airflow)
        // have `additionalProperties: false` and reject unknown keys.
        const mergedParams: Record<string, any> = { ...this.parameters };
        if (this.needsProfileEditor()) {
            mergedParams['profiles'] = this.profiles;
        }
        const body: { tag?: string; parameters: Record<string, any> } = { parameters: mergedParams };
        if (this.selectedTag && this.selectedTag !== this.originalTag) {
            body.tag = this.selectedTag;
        }
        this.api.updateServiceParameters(project.name, svc.name, body).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Changes saved',
                    detail: `${svc.name} has been updated.`,
                });
                this.saving.set(false);
                this.navigateBack(project.name);
            },
            error: (err) => {
                const msg = err?.error?.error || 'Failed to save changes';
                this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
                this.saving.set(false);
            },
        });
    }

    goBack() {
        const project = this.context.currentProject();
        if (project) {
            this.navigateBack(project.name);
        }
    }

    private navigateBack(projectName: string) {
        const returnTo = this.route.snapshot.queryParamMap.get('returnTo');
        if (returnTo) {
            this.router.navigateByUrl(returnTo);
        } else {
            this.router.navigate(['/project', projectName, 'services']);
        }
    }
}
