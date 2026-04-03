import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';
import { SparkApiService } from '../../../core/api/spark-api.service';
import { ProjectContextService } from '../../../core/context/project-context.service';
import { SparkConfig, SparkImage, SparkAppRequest } from '../../../core/models/spark.model';

interface SchemaProperty {
    key: string;
    type: string;
    description: string;
    enumValues?: string[];
    isObject: boolean;
    isArray: boolean;
    itemType?: string;
}

interface SchemaSection {
    title: string;
    icon: string;
    iconClass: string;
    properties: SchemaProperty[];
}

@Component({
    selector: 'app-spark-submit-page',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        InputTextModule,
        InputNumberModule,
        SelectModule,
        TabsModule,
        TextareaModule,
        ToastModule,
        TooltipModule,
        ToggleSwitchModule,
    ],
    providers: [MessageService],
    template: `
        <p-toast></p-toast>

        <div class="submit-page">
            <div class="page-header">
                <nav class="breadcrumb">
                    <a class="breadcrumb-link" (click)="goBack()" (keydown.enter)="goBack()" tabindex="0">
                        <i class="pi pi-arrow-left breadcrumb-back-icon"></i>
                        Spark Applications
                    </a>
                    <i class="pi pi-angle-right breadcrumb-sep"></i>
                    <span class="breadcrumb-current">Submit Job</span>
                </nav>
                <div class="header-row">
                    <div class="header-badge">
                        <i class="pi pi-bolt"></i>
                    </div>
                    <div class="header-text">
                        <h2>Submit Spark Application</h2>
                        <p class="page-desc">Configure and submit a new Spark job or paste raw YAML</p>
                    </div>
                </div>
            </div>

            <p-tabs value="0">
                <p-tablist>
                    <p-tab value="0">Guided</p-tab>
                    <p-tab value="1">YAML</p-tab>
                </p-tablist>
                <p-tabpanels>
                    <p-tabpanel value="0">
                        @if (schemaLoading()) {
                            <div class="loading-state">
                                <i class="pi pi-spin pi-spinner"></i>
                                <span>Loading CRD schema...</span>
                            </div>
                        } @else {
                            <div class="form-card">
                                <div class="card-section">
                                    <div class="section-header">
                                        <div class="section-icon-badge basics">
                                            <i class="pi pi-bookmark"></i>
                                        </div>
                                        <h3 class="section-title">Application Name</h3>
                                    </div>
                                    <div class="form-grid">
                                        <div class="form-field full-width">
                                            <label>Name *</label>
                                            <input pInputText [(ngModel)]="appName" placeholder="e.g. spark-pi" />
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
                                                    } @else if (prop.key === 'image' && sparkImages().length > 0) {
                                                        <p-select [(ngModel)]="formValues[prop.key]"
                                                            [options]="sparkImages()" optionLabel="label" optionValue="image"
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
                                                        <input pInputText [(ngModel)]="formValues[prop.key]" class="w-full"
                                                            [placeholder]="prop.description ? (prop.description.length > 60 ? prop.description.substring(0, 60) + '...' : prop.description) : ''" />
                                                    }
                                                </div>
                                            }
                                        </div>
                                    </div>
                                }

                                <div class="form-actions">
                                    <p-button label="Cancel" severity="secondary" [outlined]="true"
                                        (onClick)="goBack()"></p-button>
                                    <p-button label="Submit" icon="pi pi-send" [loading]="submitting()"
                                        [disabled]="!appName || !formValues['type']"
                                        (onClick)="submitGuided()"></p-button>
                                </div>
                            </div>
                        }
                    </p-tabpanel>
                    <p-tabpanel value="1">
                        <div class="form-card">
                            <div class="form-field">
                                <label>SparkApplication YAML</label>
                                <textarea pTextarea [(ngModel)]="yamlContent"
                                    [rows]="20"
                                    placeholder="Paste your SparkApplication YAML here..."
                                    class="yaml-editor"></textarea>
                            </div>
                            <div class="form-actions">
                                <p-button label="Cancel" severity="secondary" [outlined]="true"
                                    (onClick)="goBack()"></p-button>
                                <p-button label="Submit YAML" icon="pi pi-send" [loading]="submitting()"
                                    [disabled]="!yamlContent.trim()"
                                    (onClick)="submitYAML()"></p-button>
                            </div>
                        </div>
                    </p-tabpanel>
                </p-tabpanels>
            </p-tabs>
        </div>
    `,
    styles: [`
        :host { display: block; }

        .submit-page {
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

        .form-card {
            background: var(--db-bg-primary);
            border: 1px solid var(--db-border-light);
            border-radius: var(--db-radius-xl);
            padding: var(--db-space-xl);
            margin-top: var(--db-space-md);
            box-shadow: 0 4px 12px rgba(0,0,0,0.03);
        }

        .card-section { padding: var(--db-space-lg) 0; }
        .card-section:first-child { padding-top: 0; }
        .card-section:not(:last-child) { border-bottom: 1px solid var(--db-border-light); }
        .section-header {
            display: flex; align-items: center; gap: 12px;
            margin-bottom: var(--db-space-lg);
        }
        .section-icon-badge {
            width: 40px; height: 40px; border-radius: var(--db-radius-md);
            display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .section-icon-badge i { font-size: 1rem; }
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
            margin: 0; font-size: 17px; font-weight: 700;
            color: var(--db-text-primary); letter-spacing: -0.02em;
        }

        .form-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: var(--db-space-md);
        }
        .form-field {
            display: flex; flex-direction: column; gap: 6px;
        }
        .form-field.full-width { grid-column: 1 / -1; }
        .form-field label {
            font-weight: 600; font-size: 13px;
            color: var(--db-text-secondary); letter-spacing: -0.01em;
            display: flex; align-items: center; gap: 4px;
        }
        .info-icon {
            font-size: 11px;
            opacity: 0.5;
            cursor: help;
        }
        .mono-textarea {
            font-family: monospace;
            font-size: 13px;
        }

        .form-actions {
            display: flex; justify-content: flex-end; gap: var(--db-space-sm);
            margin-top: var(--db-space-lg);
            padding-top: var(--db-space-md);
            border-top: 1px solid var(--db-border-light);
        }

        .yaml-editor {
            font-family: monospace;
            font-size: 13px;
            width: 100%;
            resize: vertical;
        }

        .loading-state {
            display: flex; align-items: center; justify-content: center;
            gap: var(--db-space-sm); padding: var(--db-space-xl);
            color: var(--db-text-secondary); font-size: 14px;
        }
        .loading-state i { font-size: 1.2rem; }

        @media (max-width: 768px) {
            .form-grid { grid-template-columns: 1fr; }
        }
    `]
})
export class SparkSubmitPageComponent implements OnInit {
    private readonly api = inject(SparkApiService);
    private readonly context = inject(ProjectContextService);
    private readonly messageService = inject(MessageService);
    private readonly router = inject(Router);

    sparkImages = signal<SparkImage[]>([]);
    schemaSections = signal<SchemaSection[]>([]);
    schemaLoading = signal(true);
    submitting = signal(false);

    appName = '';
    formValues: Record<string, any> = {};
    yamlContent = '';

    private coreKeys = ['type', 'mode', 'image', 'mainClass', 'mainApplicationFile', 'arguments', 'sparkVersion'];
    private resourceKeys = ['driver', 'executor', 'dynamicAllocation', 'memoryOverheadFactor'];
    private configKeys = ['sparkConf', 'hadoopConf', 'sparkConfigMap', 'hadoopConfigMap', 'deps', 'volumes'];

    ngOnInit() {
        forkJoin({
            schema: this.api.getAppSchema(),
            config: this.api.getSparkConfig(),
        }).subscribe({
            next: ({ schema, config }) => {
                this.buildSections(schema);
                this.sparkImages.set(config.spark?.images || []);
                if (config.spark?.defaults) {
                    const d = config.spark.defaults;
                    this.formValues['driver'] = `cores=${d.driver.cores}\nmemory=${d.driver.memory}`;
                    this.formValues['executor'] = `instances=${d.executor.instances}\ncores=${d.executor.cores}\nmemory=${d.executor.memory}`;
                }
                this.schemaLoading.set(false);
            },
            error: () => {
                this.buildFallbackSections();
                this.schemaLoading.set(false);
            }
        });
    }

    private buildSections(schema: Record<string, any>) {
        const toProps = (keys: string[]): SchemaProperty[] =>
            keys
                .filter(k => schema[k])
                .map(k => this.toSchemaProperty(k, schema[k]));

        const knownKeys = new Set([...this.coreKeys, ...this.resourceKeys, ...this.configKeys]);
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
        const fallback: SchemaSection[] = [
            {
                title: 'Core', icon: 'pi-cog', iconClass: 'core',
                properties: [
                    { key: 'type', type: 'string', description: 'Application language type', enumValues: ['Java', 'Scala', 'Python', 'R'], isObject: false, isArray: false },
                    { key: 'mode', type: 'string', description: 'Deploy mode', enumValues: ['cluster', 'client'], isObject: false, isArray: false },
                    { key: 'image', type: 'string', description: 'Spark image', isObject: false, isArray: false },
                    { key: 'mainClass', type: 'string', description: 'Main class', isObject: false, isArray: false },
                    { key: 'mainApplicationFile', type: 'string', description: 'Main application file', isObject: false, isArray: false },
                    { key: 'arguments', type: 'array', description: 'Application arguments', isObject: false, isArray: true, itemType: 'string' },
                ],
            },
        ];
        this.schemaSections.set(fallback);
    }

    private toSchemaProperty(key: string, spec: any): SchemaProperty {
        const type = spec.type || 'string';
        const isObject = type === 'object';
        const isArray = type === 'array';
        return {
            key,
            type,
            description: spec.description || '',
            enumValues: spec.enum,
            isObject,
            isArray,
            itemType: isArray ? spec.items?.type : undefined,
        };
    }

    toOptions(values: string[]) {
        return values.map(v => ({ label: v, value: v }));
    }

    submitGuided() {
        const project = this.context.currentProject();
        if (!project) return;

        this.submitting.set(true);

        const req: SparkAppRequest = {
            name: this.appName,
            type: (this.formValues['type'] || 'Java') as SparkAppRequest['type'],
            mode: this.formValues['mode'] || 'cluster',
            image: this.formValues['image'] || '',
            mainClass: this.formValues['mainClass'] || undefined,
            mainApplicationFile: this.formValues['mainApplicationFile'] || undefined,
            sparkVersion: this.formValues['sparkVersion'] || undefined,
        };

        const argsStr = this.formValues['arguments'];
        if (argsStr && typeof argsStr === 'string') {
            req.arguments = argsStr.split(',').map((s: string) => s.trim()).filter(Boolean);
        }

        const driverStr = this.formValues['driver'];
        if (driverStr && typeof driverStr === 'string') {
            const parsed = this.parseKeyValue(driverStr);
            if (parsed['cores']) req.driverCores = parseInt(parsed['cores'], 10) || 1;
            if (parsed['memory']) req.driverMemory = parsed['memory'];
        }

        const executorStr = this.formValues['executor'];
        if (executorStr && typeof executorStr === 'string') {
            const parsed = this.parseKeyValue(executorStr);
            if (parsed['instances']) req.executorInstances = parseInt(parsed['instances'], 10) || 2;
            if (parsed['cores']) req.executorCores = parseInt(parsed['cores'], 10) || 1;
            if (parsed['memory']) req.executorMemory = parsed['memory'];
        }

        const sparkConfStr = this.formValues['sparkConf'];
        if (sparkConfStr && typeof sparkConfStr === 'string') {
            req.sparkConf = this.parseKeyValue(sparkConfStr);
        }

        this.api.submitApp(project.name, req).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Submitted', detail: `Spark job "${req.name}" submitted` });
                this.router.navigate(['/project', project.name, 'spark', 'applications']);
            },
            error: (err) => {
                const msg = err?.error?.error || 'Failed to submit Spark job';
                this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
                this.submitting.set(false);
            }
        });
    }

    submitYAML() {
        const project = this.context.currentProject();
        if (!project) return;

        this.submitting.set(true);

        this.api.submitAppYAML(project.name, { yaml: this.yamlContent }).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Submitted', detail: 'Spark job submitted from YAML' });
                this.router.navigate(['/project', project.name, 'spark', 'applications']);
            },
            error: (err) => {
                const msg = err?.error?.error || 'Failed to submit Spark job';
                this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
                this.submitting.set(false);
            }
        });
    }

    goBack() {
        const project = this.context.currentProject();
        if (project) {
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
