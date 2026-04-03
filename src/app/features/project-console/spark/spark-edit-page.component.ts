import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import { SparkApiService } from '../../../core/api/spark-api.service';
import { ProjectContextService } from '../../../core/context/project-context.service';
import { SparkAppInstance, SparkAppUpdateRequest } from '../../../core/models/spark.model';
import { forkJoin, of, catchError } from 'rxjs';

interface SchemaProperty {
    key: string;
    type: string;
    description: string;
    enumValues?: string[];
    isObject: boolean;
    isArray: boolean;
}

interface SchemaSection {
    title: string;
    icon: string;
    iconClass: string;
    properties: SchemaProperty[];
}

@Component({
    selector: 'app-spark-edit-page',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        InputTextModule,
        InputNumberModule,
        SelectModule,
        ToastModule,
        TextareaModule,
        TooltipModule,
        ToggleSwitchModule,
    ],
    providers: [MessageService],
    template: `
        <p-toast></p-toast>

        <div class="edit-page">
            <div class="page-header animate-in">
                <nav class="breadcrumb">
                    <a class="breadcrumb-link" (click)="goBack()" (keydown.enter)="goBack()" tabindex="0">
                        <i class="pi pi-arrow-left breadcrumb-back-icon"></i>
                        Spark Applications
                    </a>
                    <i class="pi pi-angle-right breadcrumb-sep"></i>
                    <span class="breadcrumb-current">Edit {{ app()?.name }}</span>
                </nav>
                <div class="header-row">
                    <div class="header-badge">
                        <i class="pi pi-pencil"></i>
                    </div>
                    <div class="header-text">
                        <h2>Edit Spark Job</h2>
                        <p class="page-desc">Modify configuration for {{ app()?.name }}</p>
                    </div>
                </div>
            </div>

            @if (loading()) {
                <div class="loading-state animate-in">
                    <div class="loading-spinner-ring">
                        <i class="pi pi-spin pi-spinner"></i>
                    </div>
                    <p>Loading job configuration...</p>
                </div>
            } @else if (app()) {
                <div class="edit-form-container animate-in">
                    <div class="form-card">
                        <div class="card-section">
                            <div class="section-header">
                                <div class="section-icon-badge basics">
                                    <i class="pi pi-bookmark"></i>
                                </div>
                                <h3 class="section-title">Application</h3>
                            </div>
                            <div class="form-grid">
                                <div class="form-field">
                                    <label>Name</label>
                                    <div class="readonly-value">{{ app()!.name }}</div>
                                </div>
                                <div class="form-field">
                                    <label>Type</label>
                                    <div class="readonly-value">{{ app()!.type }}</div>
                                </div>
                            </div>
                        </div>

                        @for (section of schemaSections(); track section.title) {
                            <div class="card-section">
                                <div class="section-header">
                                    <div class="section-icon-badge" [ngClass]="section.iconClass">
                                        <i [class]="'pi ' + section.icon"></i>
                                    </div>
                                    <h3 class="section-title">{{ section.title }}</h3>
                                </div>
                                <div class="form-grid">
                                    @for (prop of section.properties; track prop.key) {
                                        <div class="form-field" [class.full-width]="prop.isObject || prop.isArray">
                                            <label [pTooltip]="prop.description" tooltipPosition="top">
                                                {{ prop.key }}
                                                @if (prop.description) {
                                                    <i class="pi pi-info-circle info-icon"></i>
                                                }
                                            </label>
                                            @if (prop.enumValues && prop.enumValues.length > 0) {
                                                <p-select [(ngModel)]="formValues[prop.key]"
                                                    [options]="toOptions(prop.enumValues)"
                                                    optionLabel="label" optionValue="value"
                                                    [placeholder]="'Select ' + prop.key"
                                                    appendTo="body" styleClass="w-full"></p-select>
                                            } @else if (prop.key === 'image' && imageOptions().length > 0) {
                                                <p-select [(ngModel)]="formValues[prop.key]"
                                                    [options]="imageOptions()" optionLabel="label" optionValue="value"
                                                    placeholder="Select image" appendTo="body" styleClass="w-full"
                                                    [editable]="true"></p-select>
                                            } @else if (prop.type === 'integer') {
                                                <p-inputNumber [(ngModel)]="formValues[prop.key]"
                                                    [showButtons]="true" [min]="0"
                                                    styleClass="w-full"></p-inputNumber>
                                            } @else if (prop.type === 'boolean') {
                                                <p-toggleSwitch [(ngModel)]="formValues[prop.key]"></p-toggleSwitch>
                                            } @else if (prop.isObject) {
                                                <textarea pTextarea [(ngModel)]="formValues[prop.key]"
                                                    [rows]="3" class="w-full mono-textarea"
                                                    [placeholder]="'key=value (one per line)'"></textarea>
                                            } @else if (prop.isArray) {
                                                <input pInputText [(ngModel)]="formValues[prop.key]" class="w-full"
                                                    [placeholder]="'Comma-separated values'" />
                                            } @else {
                                                <input pInputText [(ngModel)]="formValues[prop.key]" class="w-full" />
                                            }
                                        </div>
                                    }
                                </div>
                            </div>
                        }
                    </div>

                    <div class="form-actions">
                        <p-button severity="secondary" [outlined]="true" label="Cancel" (onClick)="goBack()"></p-button>
                        <p-button label="Save changes" icon="pi pi-check" severity="primary"
                            [loading]="saving()" (onClick)="save()"></p-button>
                    </div>
                </div>
            } @else {
                <div class="empty-state animate-in">
                    <div class="empty-icon-wrapper">
                        <i class="pi pi-exclamation-triangle empty-icon"></i>
                    </div>
                    <h3>Job not found</h3>
                    <p>The Spark application could not be loaded.</p>
                    <p-button icon="pi pi-arrow-left" severity="secondary" [outlined]="true"
                        label="Back to jobs" (onClick)="goBack()"></p-button>
                </div>
            }
        </div>
    `,
    styles: [`
        :host { display: block; }

        .edit-page {
            padding-top: var(--db-space-md);
            max-width: 860px;
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

        .header-row { display: flex; align-items: center; gap: 14px; }
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
        .page-desc { margin: 6px 0 0; font-size: 15px; color: var(--db-text-secondary); }

        .edit-form-container {
            animation: fadeInUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.08s backwards;
        }
        .form-card {
            background: var(--db-bg-primary);
            border: 1px solid var(--db-border-light);
            border-radius: var(--db-radius-xl);
            padding: var(--db-space-xl);
            box-shadow: 0 4px 12px rgba(0,0,0,0.03);
            display: flex; flex-direction: column;
        }

        .card-section { padding: var(--db-space-xl) 0; }
        .card-section:first-child { padding-top: 0; }
        .card-section:not(:last-child) { border-bottom: 1px solid var(--db-border-light); }
        .section-header {
            display: flex; align-items: center; gap: 12px;
            margin-bottom: var(--db-space-lg);
        }
        .section-icon-badge {
            width: 44px; height: 44px; border-radius: var(--db-radius-lg);
            display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .section-icon-badge i { font-size: 1.1rem; }
        .section-icon-badge.basics { background: var(--db-primary-50); }
        .section-icon-badge.basics i { color: var(--db-primary); }
        .section-icon-badge.core { background: #fef3c7; }
        .section-icon-badge.core i { color: #d97706; }
        .section-icon-badge.resources { background: var(--db-accent-purple-light, #f3e8ff); }
        .section-icon-badge.resources i { color: var(--db-accent-purple, #a855f7); }
        .section-icon-badge.config { background: var(--db-accent-blue-light, #e0f2fe); }
        .section-icon-badge.config i { color: var(--db-accent-blue, #3b82f6); }
        .section-icon-badge.advanced { background: #f1f5f9; }
        .section-icon-badge.advanced i { color: #64748b; }
        .section-title {
            margin: 0; font-size: 18px; font-weight: 700;
            color: var(--db-text-primary); letter-spacing: -0.02em;
        }

        .form-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: var(--db-space-md);
        }
        .form-field { display: flex; flex-direction: column; gap: 6px; }
        .form-field.full-width { grid-column: 1 / -1; }
        .form-field label {
            font-weight: 600; font-size: 14px;
            color: var(--db-text-secondary); letter-spacing: -0.01em;
            display: flex; align-items: center; gap: 4px;
        }
        .info-icon { font-size: 11px; opacity: 0.5; cursor: help; }
        .readonly-value {
            padding: 10px 12px; background: var(--db-bg-secondary);
            border: 1px solid var(--db-border-light); border-radius: var(--db-radius-md);
            font-size: 14px; color: var(--db-text-primary); font-weight: 500;
        }
        .mono-textarea { font-family: monospace; font-size: 13px; }

        .form-actions {
            display: flex; justify-content: flex-end; align-items: center;
            gap: var(--db-space-md); padding: var(--db-space-lg) 0 0;
            margin-top: var(--db-space-sm);
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
            padding: 64px; gap: var(--db-space-md); background: var(--db-bg-primary);
            border-radius: var(--db-radius-xl); border: 1px solid var(--db-border-light);
        }
        .empty-state h3 { margin: 0; font-size: 16px; font-weight: 600; }
        .empty-state p { margin: 0; font-size: 14px; color: var(--db-text-secondary); }

        @media (max-width: 768px) {
            .form-card { padding: var(--db-space-lg); }
            .form-grid { grid-template-columns: 1fr; }
        }
    `]
})
export class SparkEditPageComponent implements OnInit {
    private readonly api = inject(SparkApiService);
    private readonly context = inject(ProjectContextService);
    private readonly messageService = inject(MessageService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);

    app = signal<SparkAppInstance | null>(null);
    loading = signal(true);
    saving = signal(false);
    schemaSections = signal<SchemaSection[]>([]);
    imageOptions = signal<{ label: string; value: string }[]>([]);

    formValues: Record<string, any> = {};

    private coreKeys = ['mode', 'image', 'mainClass', 'mainApplicationFile', 'arguments', 'sparkVersion'];
    private resourceKeys = ['driver', 'executor', 'dynamicAllocation', 'memoryOverheadFactor'];
    private configKeys = ['sparkConf', 'hadoopConf', 'sparkConfigMap', 'hadoopConfigMap', 'deps', 'volumes'];

    ngOnInit() {
        const project = this.context.currentProject();
        const appName = this.route.snapshot.paramMap.get('appName') || '';
        if (!project || !appName) {
            this.loading.set(false);
            return;
        }

        forkJoin({
            app: this.api.getApp(project.name, appName),
            config: this.api.getSparkConfig(),
            schema: this.api.getAppSchema().pipe(catchError(() => of(null))),
        }).subscribe({
            next: ({ app, config, schema }) => {
                this.app.set(app);

                if (config?.spark?.images) {
                    this.imageOptions.set(config.spark.images.map(i => ({
                        label: i.label, value: i.image,
                    })));
                }

                this.formValues['image'] = app.image;
                this.formValues['mode'] = app.mode;

                if (schema) {
                    this.buildSections(schema);
                } else {
                    this.buildFallbackSections();
                }

                this.loading.set(false);
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load Spark job' });
                this.loading.set(false);
            }
        });
    }

    private buildSections(schema: Record<string, any>) {
        const toProps = (keys: string[]): SchemaProperty[] =>
            keys.filter(k => schema[k]).map(k => this.toSchemaProperty(k, schema[k]));

        const knownKeys = new Set(['type', ...this.coreKeys, ...this.resourceKeys, ...this.configKeys]);
        const advancedKeys = Object.keys(schema).filter(k => !knownKeys.has(k)).sort();

        const sections: SchemaSection[] = [
            { title: 'Core', icon: 'pi-cog', iconClass: 'core', properties: toProps(this.coreKeys) },
            { title: 'Resources', icon: 'pi-server', iconClass: 'resources', properties: toProps(this.resourceKeys) },
            { title: 'Configuration', icon: 'pi-sliders-h', iconClass: 'config', properties: toProps(this.configKeys) },
        ];

        if (advancedKeys.length > 0) {
            sections.push({
                title: 'Advanced', icon: 'pi-wrench', iconClass: 'advanced',
                properties: toProps(advancedKeys),
            });
        }

        this.schemaSections.set(sections.filter(s => s.properties.length > 0));
    }

    private buildFallbackSections() {
        this.schemaSections.set([
            {
                title: 'Core', icon: 'pi-cog', iconClass: 'core',
                properties: [
                    { key: 'image', type: 'string', description: 'Spark image', isObject: false, isArray: false },
                    { key: 'mainClass', type: 'string', description: 'Main class', isObject: false, isArray: false },
                    { key: 'mainApplicationFile', type: 'string', description: 'Main application file', isObject: false, isArray: false },
                    { key: 'arguments', type: 'array', description: 'Application arguments', isObject: false, isArray: true },
                ],
            },
            {
                title: 'Resources', icon: 'pi-server', iconClass: 'resources',
                properties: [
                    { key: 'driver', type: 'object', description: 'Driver pod resources', isObject: true, isArray: false },
                    { key: 'executor', type: 'object', description: 'Executor pod resources', isObject: true, isArray: false },
                ],
            },
            {
                title: 'Configuration', icon: 'pi-sliders-h', iconClass: 'config',
                properties: [
                    { key: 'sparkConf', type: 'object', description: 'Spark configuration (key=value)', isObject: true, isArray: false },
                ],
            },
        ]);
    }

    private toSchemaProperty(key: string, spec: any): SchemaProperty {
        const type = spec.type || 'string';
        return {
            key,
            type,
            description: spec.description || '',
            enumValues: spec.enum,
            isObject: type === 'object',
            isArray: type === 'array',
        };
    }

    toOptions(values: string[]) {
        return values.map(v => ({ label: v, value: v }));
    }

    save() {
        const project = this.context.currentProject();
        const currentApp = this.app();
        if (!project || !currentApp) return;

        this.saving.set(true);

        const req: SparkAppUpdateRequest = {};
        if (this.formValues['image'] && this.formValues['image'] !== currentApp.image) {
            req.image = this.formValues['image'];
        }
        if (this.formValues['mainClass']) req.mainClass = this.formValues['mainClass'];
        if (this.formValues['mainApplicationFile']) req.mainApplicationFile = this.formValues['mainApplicationFile'];

        const argsStr = this.formValues['arguments'];
        if (argsStr && typeof argsStr === 'string') {
            req.arguments = argsStr.split(',').map((s: string) => s.trim()).filter(Boolean);
        }

        const driverStr = this.formValues['driver'];
        if (driverStr && typeof driverStr === 'string') {
            const parsed = this.parseKeyValue(driverStr);
            if (parsed['cores']) req.driverCores = parseInt(parsed['cores'], 10) || undefined;
            if (parsed['memory']) req.driverMemory = parsed['memory'];
        }

        const executorStr = this.formValues['executor'];
        if (executorStr && typeof executorStr === 'string') {
            const parsed = this.parseKeyValue(executorStr);
            if (parsed['instances']) req.executorInstances = parseInt(parsed['instances'], 10) || undefined;
            if (parsed['cores']) req.executorCores = parseInt(parsed['cores'], 10) || undefined;
            if (parsed['memory']) req.executorMemory = parsed['memory'];
        }

        const sparkConfStr = this.formValues['sparkConf'];
        if (sparkConfStr && typeof sparkConfStr === 'string' && sparkConfStr.trim()) {
            req.sparkConf = this.parseKeyValue(sparkConfStr);
        }

        this.api.updateApp(project.name, currentApp.name, req).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Saved',
                    detail: `Spark job "${currentApp.name}" has been updated`
                });
                this.saving.set(false);
                this.router.navigate(['/project', project.name, 'spark', 'applications', currentApp.name]);
            },
            error: (err) => {
                const msg = err?.error?.error || 'Failed to save changes';
                this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
                this.saving.set(false);
            }
        });
    }

    goBack() {
        const project = this.context.currentProject();
        const currentApp = this.app();
        if (project && currentApp) {
            this.router.navigate(['/project', project.name, 'spark', 'applications', currentApp.name]);
        } else if (project) {
            this.router.navigate(['/project', project.name, 'spark', 'applications']);
        }
    }

    private parseKeyValue(text: string): Record<string, string> {
        const result: Record<string, string> = {};
        for (const line of text.split('\n')) {
            const [key, ...rest] = line.split('=');
            if (key?.trim() && rest.length > 0) {
                result[key.trim()] = rest.join('=').trim();
            }
        }
        return result;
    }
}
