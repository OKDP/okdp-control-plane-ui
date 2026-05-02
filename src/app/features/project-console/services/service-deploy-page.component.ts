import { Component, DestroyRef, inject, signal, OnDestroy, OnInit, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ServiceApiService } from '../../../core/api/service-api.service';
import { ProjectContextService } from '../../../core/context/project-context.service';
import { PlatformService } from '../../../core/models/service.model';
import { DynamicSchemaFormComponent } from '../../../shared/components/dynamic-schema-form.component';
import {
    ProfileListEditorComponent,
    Profile,
} from '../../../shared/components/profile-list-editor.component';

type StepKey = 'basics' | 'params' | 'profiles' | 'review';
interface WizardStep {
    key: StepKey;
    label: string;
}

@Component({
    selector: 'app-service-deploy-page',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        InputTextModule,
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
                    <span class="breadcrumb-current">New instance</span>
                </nav>
                <div class="header-row">
                    <div class="header-badge">
                        <i class="pi pi-play"></i>
                    </div>
                    <div class="header-text">
                        <h2>Deploy new instance</h2>
                        <p class="page-desc">
                            Configure and launch a new {{ service()?.name || 'service' }} instance in this project.
                        </p>
                    </div>
                </div>
            </div>

            @if (loading()) {
                <div class="empty-state-panel">
                    <div class="empty-icon-wrapper">
                        <i class="pi pi-spin pi-spinner"></i>
                    </div>
                    <h3>Loading service configuration…</h3>
                </div>
            } @else if (deploying()) {
                <div class="form-card deploy-progress">
                    @for (stage of progressStages; track stage.label; let i = $index) {
                        <div
                            class="progress-stage"
                            [class.done]="deployProgress() > i"
                            [class.active]="deployProgress() === i">
                            <span class="ps-dot">
                                @if (deployProgress() > i) {
                                    <i class="pi pi-check"></i>
                                } @else if (deployProgress() === i) {
                                    <i class="pi pi-spin pi-spinner"></i>
                                } @else {
                                    {{ i + 1 }}
                                }
                            </span>
                            <span class="ps-label">{{ stage.label }}</span>
                            @if (deployProgress() === i) {
                                <span class="ps-status muted-text">in progress</span>
                            } @else if (deployProgress() > i) {
                                <span class="ps-status ok">done</span>
                            }
                        </div>
                    }
                </div>
            } @else if (service()) {
                <div class="wizard-stepper">
                    @for (s of steps(); track s.key; let i = $index) {
                        <div
                            class="wstep"
                            [class.active]="currentStep() === i"
                            [class.done]="currentStep() > i">
                            <span class="wstep-num">
                                @if (currentStep() > i) {
                                    <i class="pi pi-check"></i>
                                } @else {
                                    {{ i + 1 }}
                                }
                            </span>
                            <span class="wstep-label">{{ s.label }}</span>
                            @if (i < steps().length - 1) {
                                <span class="wstep-line"></span>
                            }
                        </div>
                    }
                </div>

                <div class="form-card">
                    @if (currentStepKey() === 'basics') {
                        <div class="form-section">
                            <div class="form-field">
                                <label>Instance name</label>
                                <input
                                    class="text-input mono"
                                    placeholder="e.g. my-notebook"
                                    [(ngModel)]="instanceName"
                                    (ngModelChange)="onNameChange($event)" />
                                @if (nameError) {
                                    <small class="field-hint err">{{ nameError }}</small>
                                } @else {
                                    <small class="field-hint">
                                        Lowercase letters, digits and dashes. Must start and end with an alphanumeric character.
                                    </small>
                                }
                            </div>

                            <div class="form-field">
                                <div class="field-head">
                                    <label style="margin: 0">Version</label>
                                    <span class="muted-text small mono">{{ service()?.name }}</span>
                                </div>
                                <small class="field-hint" style="margin-top: 0; margin-bottom: 10px">
                                    Pick a version. Each version ships its own schema; the parameters step adapts.
                                </small>
                                <p-select
                                    [(ngModel)]="selectedTag"
                                    [options]="versionOptions()"
                                    optionLabel="label"
                                    optionValue="value"
                                    placeholder="Select a version"
                                    appendTo="body"
                                    styleClass="w-full"
                                    (ngModelChange)="onVersionChange($event)">
                                </p-select>
                            </div>
                        </div>
                    }

                    @if (currentStepKey() === 'params') {
                        @if (schemaLoading()) {
                            <div class="form-section">
                                <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0 20px">
                                    <i class="pi pi-spin pi-spinner" style="color: var(--db-primary); font-size: 18px"></i>
                                    <div>
                                        <strong>Loading parameter schema…</strong>
                                        <div class="muted-text small">
                                            Fetching {{ service()?.name }}:{{ selectedTag }} configuration.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        } @else if (filteredSchema()) {
                            <div class="form-section">
                                <app-dynamic-schema-form
                                    [schema]="filteredSchema()"
                                    (parametersChange)="onParametersChange($event)"
                                    (validityChange)="paramsValid.set($event)">
                                </app-dynamic-schema-form>
                            </div>
                        } @else {
                            <div class="form-section">
                                <p class="muted-text">No configurable parameters for this version.</p>
                            </div>
                        }
                    }

                    @if (currentStepKey() === 'profiles') {
                        <div class="form-section">
                            <div class="field-head">
                                <label style="margin: 0">Profiles</label>
                                <span class="muted-text small">
                                    Define notebook environments users can launch.
                                </span>
                            </div>
                            <app-profile-list-editor
                                [profileImages]="profileImages()"
                                (profilesChange)="onProfilesChange($event)">
                            </app-profile-list-editor>
                            @if (profiles.length === 0) {
                                <small class="field-hint err">
                                    At least one profile is required to deploy.
                                </small>
                            }
                        </div>
                    }

                    @if (currentStepKey() === 'review') {
                        <div class="form-section">
                            <div class="review-grid">
                                <div class="review-row">
                                    <span class="review-label">Instance name</span>
                                    <span class="review-value mono">{{ instanceName || '—' }}</span>
                                </div>
                                <div class="review-row">
                                    <span class="review-label">Service</span>
                                    <span class="review-value mono">{{ service()?.name }}</span>
                                </div>
                                <div class="review-row">
                                    <span class="review-label">Version</span>
                                    <span class="review-value mono">{{ selectedTag }}</span>
                                </div>
                                @if (hasProfileEditor()) {
                                    <div class="review-row">
                                        <span class="review-label">Profiles</span>
                                        <span class="review-value">{{ profiles.length }} configured</span>
                                    </div>
                                }
                                @for (entry of reviewParams(); track entry.key) {
                                    <div class="review-row">
                                        <span class="review-label">{{ entry.key }}</span>
                                        <span class="review-value mono">{{ entry.value }}</span>
                                    </div>
                                }
                            </div>
                        </div>
                    }
                </div>

                <div class="wizard-actions">
                    <button class="btn-secondary" (click)="goBack()">Cancel</button>
                    <div class="wa-right">
                        @if (currentStep() > 0) {
                            <button class="btn-secondary" (click)="prevStep()">Back</button>
                        }
                        @if (currentStep() < steps().length - 1) {
                            <button
                                class="create-btn"
                                [disabled]="!canAdvance()"
                                (click)="nextStep()">
                                Next
                                <i class="pi pi-angle-right"></i>
                            </button>
                        } @else {
                            <button
                                class="create-btn"
                                [disabled]="!isFormValid"
                                (click)="deploy()">
                                <i class="pi pi-play"></i>
                                Deploy instance
                            </button>
                        }
                    </div>
                </div>
            } @else {
                <div class="empty-state-panel">
                    <div class="empty-icon-wrapper">
                        <i class="pi pi-exclamation-triangle"></i>
                    </div>
                    <h3>Service unavailable</h3>
                    <p>No deployable service configuration was found.</p>
                    <button class="btn-secondary" (click)="goBack()">
                        <i class="pi pi-arrow-left"></i>
                        Back to instances
                    </button>
                </div>
            }
        </div>
    `,
})
export class ServiceDeployPageComponent implements OnInit, OnDestroy {
    private readonly destroyRef = inject(DestroyRef);
    private progressTick: ReturnType<typeof setInterval> | null = null;
    private readonly api = inject(ServiceApiService);
    private readonly context = inject(ProjectContextService);
    private readonly messageService = inject(MessageService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);

    service = signal<PlatformService | null>(null);
    loading = signal(true);
    deploying = signal(false);
    // Track the dynamic schema form validity so Next on the Parameters step
    // is blocked when a CPU/memory quantity field is malformed.
    paramsValid = signal(true);
    deployProgress = signal(0);
    schemaLoading = signal(false);
    serviceSchema = signal<any>(null);
    filteredSchema = signal<any>(null);
    profileImages = signal<Record<string, { label: string; image: string }[]>>({});
    versionOptions = signal<{ label: string; value: string }[]>([]);
    currentStep = signal<number>(0);

    selectedTag = '';
    instanceName = '';
    parameters: Record<string, any> = {};
    profiles: Profile[] = [];

    // Steps are computed from the loaded schema: the "Profiles" step is
    // only meaningful for services that declare a profile-editor widget
    // (currently just JupyterHub). Hiding it entirely for Spark History
    // Server / Trino / etc. gives a shorter, less confusing wizard.
    readonly steps = computed<WizardStep[]>(() => {
        const base: WizardStep[] = [
            { key: 'basics', label: 'Basics' },
            { key: 'params', label: 'Parameters' },
        ];
        if (this.hasProfileEditor()) {
            base.push({ key: 'profiles', label: 'Profiles' });
        }
        base.push({ key: 'review', label: 'Review' });
        return base;
    });

    readonly currentStepKey = computed<StepKey>(
        () => this.steps()[this.currentStep()]?.key ?? 'basics',
    );

    readonly progressStages = [
        { label: 'Validating parameters' },
        { label: 'Creating release' },
        { label: 'Scheduling pod' },
        { label: 'Waiting for readiness' },
    ];

    reviewParams = computed(() => {
        const out: { key: string; value: string }[] = [];
        for (const [k, v] of Object.entries(this.parameters)) {
            if (k === 'profiles') continue;
            out.push({
                key: k,
                value: typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—'),
            });
        }
        return out;
    });

    get nameError(): string {
        if (!this.instanceName) return '';
        const regex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
        if (!regex.test(this.instanceName.trim())) {
            return "Must be lowercase alphanumeric or '-', starting and ending with alphanumeric.";
        }
        return '';
    }

    get isFormValid(): boolean {
        const baseValid = !!this.selectedTag && !this.nameError && !!this.instanceName;
        if (this.hasProfileEditor()) {
            return baseValid && this.profiles.length > 0;
        }
        return baseValid;
    }

    canAdvance(): boolean {
        switch (this.currentStepKey()) {
            case 'basics':
                return !!this.instanceName && !this.nameError && !!this.selectedTag;
            case 'params':
                return !this.schemaLoading() && this.paramsValid();
            case 'profiles':
                // Only rendered when hasProfileEditor() is true — require
                // at least one profile defined before moving on.
                return this.profiles.length > 0;
            default:
                return true;
        }
    }

    nextStep() {
        const next = Math.min(this.currentStep() + 1, this.steps().length - 1);
        this.currentStep.set(next);
    }

    prevStep() {
        const prev = Math.max(this.currentStep() - 1, 0);
        this.currentStep.set(prev);
    }

    onNameChange(value: string) {
        this.instanceName = value;
    }

    hasProfileEditor(): boolean {
        const schema = this.serviceSchema();
        if (!schema?.properties) return false;
        return Object.values<any>(schema.properties).some(
            (def) => def['x-ui-widget'] === 'profile-editor',
        );
    }

    parentLabel(): string {
        const svc = this.service();
        if (svc?.name === 'jupyterhub') return 'Jupyter';
        if (svc?.name === 'spark-history-server') return 'History Server';
        if (svc?.name === 'polaris') return 'Polaris';
        if (svc?.name === 'trino') return 'Trino';
        if (svc?.name === 'airflow') return 'Airflow';
        if (svc?.name === 'superset') return 'Superset';
        return svc?.name || 'Services';
    }

    ngOnDestroy() {
        // Route change during an in-flight deploy must not leak the interval.
        // The HTTP subscription itself is tied to destroyRef via
        // takeUntilDestroyed, so it cancels cleanly on its own.
        this.clearProgressTick();
    }

    private clearProgressTick() {
        if (this.progressTick !== null) {
            clearInterval(this.progressTick);
            this.progressTick = null;
        }
    }

    ngOnInit() {
        this.api.getProfileImages().subscribe({
            next: (images) => this.profileImages.set(images),
        });

        this.api.getPlatformServices().subscribe({
            next: (services) => {
                const requestedService = this.route.snapshot.queryParamMap.get('service');
                const svc =
                    services.length === 1
                        ? services[0]
                        : (requestedService && services.find((s) => s.name === requestedService)) ||
                          services[0];
                if (svc) {
                    this.service.set(svc);
                    this.instanceName = svc.name;
                    const options = svc.versions.map((v) => ({
                        label: v === svc.defaultVersion ? `${v} (recommended)` : v,
                        value: v,
                    }));
                    this.versionOptions.set(options);
                    this.selectedTag = svc.defaultVersion;
                    this.loadSchema(svc.name, svc.defaultVersion);
                }
                this.loading.set(false);
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Failed to load service info',
                });
                this.loading.set(false);
            },
        });
    }

    onVersionChange(tag: string) {
        const svc = this.service();
        if (!svc || !tag) return;
        this.serviceSchema.set(null);
        this.parameters = {};
        this.loadSchema(svc.name, tag);
    }

    private loadSchema(serviceName: string, tag: string) {
        this.schemaLoading.set(true);
        this.api.getServiceSchema(serviceName, tag).subscribe({
            next: (schema) => {
                this.serviceSchema.set(schema);
                this.filteredSchema.set(this.stripProfileEditorFields(schema));
                this.schemaLoading.set(false);
            },
            error: () => {
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Schema unavailable',
                    detail:
                        'Could not load configuration schema. You can still deploy with default parameters.',
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

    onParametersChange(params: Record<string, any>) {
        this.parameters = params;
    }

    onProfilesChange(profiles: Profile[]) {
        this.profiles = profiles;
    }

    deploy() {
        const project = this.context.currentProject();
        const svc = this.service();
        if (!project || !svc) return;

        this.deploying.set(true);
        this.deployProgress.set(0);

        const mergedParams = this.hasProfileEditor()
            ? { ...this.parameters, profiles: this.profiles }
            : { ...this.parameters };

        // Animate progress stages while the request is in flight. Stored on
        // the instance so ngOnDestroy can clear it if the user navigates
        // away mid-deploy (otherwise the interval and the HTTP subscription
        // both leak until the tab is closed).
        this.progressTick = setInterval(() => {
            const current = this.deployProgress();
            if (current < this.progressStages.length - 1) {
                this.deployProgress.set(current + 1);
            }
        }, 700);

        this.api
            .deployService(project.name, {
                service: svc.name,
                tag: this.selectedTag,
                instanceName: this.instanceName,
                parameters: mergedParams,
            })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.clearProgressTick();
                    this.deployProgress.set(this.progressStages.length);
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Deploying instance',
                        detail: `${this.instanceName} is being provisioned.`,
                    });
                    setTimeout(() => {
                        this.deploying.set(false);
                        const returnTo = this.route.snapshot.queryParamMap.get('returnTo');
                        if (returnTo) {
                            this.router.navigateByUrl(returnTo);
                        } else {
                            this.router.navigate(['/project', project.name, 'services']);
                        }
                    }, 400);
                },
                error: (err) => {
                    this.clearProgressTick();
                    const msg = err?.error?.error || 'Deployment failed';
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: msg,
                    });
                    this.deploying.set(false);
                },
            });
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
