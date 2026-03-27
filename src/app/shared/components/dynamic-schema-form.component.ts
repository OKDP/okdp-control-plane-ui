import {
    Component,
    Input,
    Output,
    EventEmitter,
    OnChanges,
    SimpleChanges,
    signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';

export interface SchemaField {
    name: string;
    type: string;
    default: any;
    description?: string;
    title?: string;
    enum?: any[];
    required?: boolean;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    multipleOf?: number;
    'x-ui-order'?: number;
    'x-ui-group'?: string;
    'x-ui-widget'?: string;
    'x-ui-condition'?: { field: string; value: any };
    'x-ui-advanced'?: boolean;
    'x-ui-columns'?: number;
    'x-ui-col-span'?: number;
    'x-ui-placeholder'?: string;
}

export interface FieldGroup {
    name: string;
    columns: number;
    fields: SchemaField[];
    advancedFields: SchemaField[];
}

@Component({
    selector: 'app-dynamic-schema-form',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        InputTextModule,
        InputNumberModule,
        TextareaModule,
        SelectModule,
        ToggleSwitchModule,
        PasswordModule,
        ButtonModule,
    ],
    template: `
        @if (groups().length === 0) {
            <div class="no-params">
                <div class="no-params-icon">
                    <i class="pi pi-info-circle"></i>
                </div>
                <span>This service has no configurable parameters.</span>
            </div>
        } @else {
            <div class="dynamic-form">
                @for (group of groups(); track group.name; let i = $index) {
                    <div class="form-section-card" [style.animation-delay]="(i * 0.06) + 's'">
                        @if (groups().length > 1 || group.name !== 'General') {
                            <div class="section-card-header">
                                <div class="section-icon-badge">
                                    <i [class]="'pi ' + getGroupIcon(group.name)"></i>
                                </div>
                                <h4 class="section-card-title">{{ group.name }}</h4>
                            </div>
                        }

                        <div class="section-card-body">
                            <ng-container
                                *ngTemplateOutlet="groupContent; context: { $implicit: group }">
                            </ng-container>
                        </div>
                    </div>
                }
            </div>
        }

        <ng-template #groupContent let-group>
            <div class="field-grid" [style.grid-template-columns]="group.columns === 2 ? '1fr 1fr' : '1fr'">
                @for (field of group.fields; track field.name) {
                    @if (isFieldVisible(field)) {
                        <div class="field" [style.grid-column]="(field['x-ui-col-span'] || 1) > 1 ? 'span ' + (field['x-ui-col-span'] || 1) : ''">
                            <label [for]="field.name">{{ field.title || formatLabel(field.name) }}</label>
                            <ng-container *ngTemplateOutlet="fieldWidget; context: { $implicit: field }">
                            </ng-container>
                            @if (field.description) {
                                <small class="field-help">{{ field.description }}</small>
                            }
                        </div>
                    }
                }
            </div>

            @if (group.advancedFields.length > 0) {
                <button class="advanced-toggle" (click)="toggleAdvanced(group.name)">
                    <span class="advanced-toggle-line"></span>
                    <span class="advanced-toggle-label">
                        <i [class]="'pi ' + (advancedOpen()[group.name] ? 'pi-chevron-up' : 'pi-chevron-down')"></i>
                        {{ advancedOpen()[group.name] ? 'Hide' : 'Show' }} advanced options
                    </span>
                    <span class="advanced-toggle-line"></span>
                </button>
                @if (advancedOpen()[group.name]) {
                    <div class="advanced-fields-container">
                        <div class="field-grid" [style.grid-template-columns]="group.columns === 2 ? '1fr 1fr' : '1fr'">
                            @for (field of group.advancedFields; track field.name) {
                                @if (isFieldVisible(field)) {
                                    <div class="field" [style.grid-column]="(field['x-ui-col-span'] || 1) > 1 ? 'span ' + (field['x-ui-col-span'] || 1) : ''">
                                        <label [for]="field.name">{{ field.title || formatLabel(field.name) }}</label>
                                        <ng-container *ngTemplateOutlet="fieldWidget; context: { $implicit: field }">
                                        </ng-container>
                                        @if (field.description) {
                                            <small class="field-help">{{ field.description }}</small>
                                        }
                                    </div>
                                }
                            }
                        </div>
                    </div>
                }
            }
        </ng-template>

        <ng-template #fieldWidget let-field>
            @switch (resolveWidget(field)) {
                @case ('password') {
                    <p-password [inputId]="field.name" [(ngModel)]="values[field.name]"
                        [placeholder]="field['x-ui-placeholder'] || ''"
                        [feedback]="false" [toggleMask]="true" styleClass="w-full"
                        (ngModelChange)="emitChange()"></p-password>
                }
                @case ('textarea') {
                    <textarea pTextarea [id]="field.name" [(ngModel)]="values[field.name]"
                        [placeholder]="field['x-ui-placeholder'] || ''"
                        [rows]="3" class="w-full"
                        (ngModelChange)="emitChange()"></textarea>
                }
                @case ('select') {
                    <p-select [inputId]="field.name" [(ngModel)]="values[field.name]"
                        [options]="toOptions(field.enum!)"
                        optionLabel="label" optionValue="value"
                        [placeholder]="field['x-ui-placeholder'] || 'Select...'"
                        styleClass="w-full"
                        (ngModelChange)="emitChange()"></p-select>
                }
                @case ('stepper') {
                    <p-inputNumber [inputId]="field.name" [(ngModel)]="values[field.name]"
                        [showButtons]="true" buttonLayout="horizontal"
                        [step]="field.multipleOf || 1"
                        [min]="field.minimum" [max]="field.maximum"
                        [minFractionDigits]="field.type === 'number' ? 1 : 0"
                        [maxFractionDigits]="field.type === 'number' ? 2 : 0"
                        incrementButtonIcon="pi pi-plus" decrementButtonIcon="pi pi-minus"
                        styleClass="w-full"
                        (ngModelChange)="emitChange()"></p-inputNumber>
                }
                @case ('number') {
                    <p-inputNumber [inputId]="field.name" [(ngModel)]="values[field.name]"
                        [min]="field.minimum" [max]="field.maximum"
                        [step]="field.multipleOf || 1"
                        [minFractionDigits]="field.type === 'number' ? 1 : 0"
                        [maxFractionDigits]="field.type === 'number' ? 2 : 0"
                        styleClass="w-full"
                        (ngModelChange)="emitChange()"></p-inputNumber>
                }
                @case ('toggle') {
                    <p-toggleSwitch [(ngModel)]="values[field.name]"
                        (ngModelChange)="emitChange()"></p-toggleSwitch>
                }
                @case ('url') {
                    <input [id]="field.name" type="url" pInputText [(ngModel)]="values[field.name]"
                        [placeholder]="field['x-ui-placeholder'] || ''"
                        class="w-full"
                        (ngModelChange)="emitChange()" />
                }
                @default {
                    <input [id]="field.name" type="text" pInputText [(ngModel)]="values[field.name]"
                        [placeholder]="field['x-ui-placeholder'] || ''"
                        class="w-full"
                        [class.field-invalid]="!!fieldErrors()[field.name]"
                        (ngModelChange)="emitChange()" />
                    @if (fieldErrors()[field.name]) {
                        <small class="field-error-msg">
                            <i class="pi pi-exclamation-triangle"></i>
                            {{ fieldErrors()[field.name] }}
                        </small>
                    }
                }
            }
        </ng-template>
    `,
    styles: [`
        .dynamic-form {
            display: flex;
            flex-direction: column;
            gap: 0;
        }
        .field-invalid {
            border-color: var(--db-danger, #dc2626) !important;
            background-color: rgba(220, 38, 38, 0.04);
        }
        .field-error-msg {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: 6px;
            color: var(--db-danger, #dc2626);
            font-size: 12px;
            font-weight: 500;
        }
        .field-error-msg i { font-size: 13px; }
        .form-section-card {
            animation: fadeInUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) backwards;
            padding-bottom: var(--db-space-xl);
        }
        .form-section-card:not(:last-child) {
            border-bottom: 1px solid var(--db-border-light);
            margin-bottom: var(--db-space-xl);
        }
        .section-card-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: var(--db-space-lg);
        }
        .section-icon-badge {
            width: 32px;
            height: 32px;
            border-radius: var(--db-radius-md);
            background: var(--db-primary-50);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        .section-icon-badge i {
            font-size: 0.85rem;
            color: var(--db-primary);
        }
        .section-card-title {
            margin: 0;
            font-size: 15px;
            font-weight: 600;
            color: var(--db-text-primary);
            letter-spacing: -0.01em;
        }
        .section-card-body {
            display: flex;
            flex-direction: column;
            gap: var(--db-space-md);
        }
        .field-grid {
            display: grid;
            gap: var(--db-space-lg) 20px;
        }
        .field {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .field label {
            font-weight: 500;
            font-size: 13px;
            color: var(--db-text-secondary);
            letter-spacing: -0.005em;
        }
        .advanced-toggle {
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
            margin: var(--db-space-lg) 0 var(--db-space-sm);
            padding: 0;
            background: none;
            border: none;
            cursor: pointer;
        }
        .advanced-toggle-line {
            flex: 1;
            height: 1px;
            background: var(--db-border-light);
        }
        .advanced-toggle-label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            font-weight: 500;
            color: var(--db-primary);
            white-space: nowrap;
            padding: 4px 12px;
            border-radius: var(--db-radius-full);
            background: var(--db-primary-50);
            transition: background var(--db-transition-base);
        }
        .advanced-toggle:hover .advanced-toggle-label {
            background: var(--db-primary-100);
        }
        .advanced-toggle-label i {
            font-size: 10px;
        }
        .advanced-fields-container {
            animation: fadeInUp 0.3s cubic-bezier(0.22, 1, 0.36, 1);
            padding-top: var(--db-space-sm);
        }
        .no-params {
            display: flex;
            align-items: center;
            gap: var(--db-space-md);
            padding: var(--db-space-lg);
            color: var(--db-text-secondary);
            font-size: 14px;
            background: var(--db-bg-secondary);
            border-radius: var(--db-radius-lg);
            border: 1px dashed var(--db-border-light);
        }
        .no-params-icon {
            width: 36px;
            height: 36px;
            border-radius: var(--db-radius-md);
            background: var(--db-accent-blue-light);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        .no-params-icon i {
            color: var(--db-accent-blue);
            font-size: 1rem;
        }
    `]
})
export class DynamicSchemaFormComponent implements OnChanges {
    @Input() schema: any = null;
    @Input() initialValues: Record<string, any> = {};
    @Output() parametersChange = new EventEmitter<Record<string, any>>();
    // Emits true when every field passes local validation (currently K8s
    // quantity format on CPU/memory fields). Parent components can wire this
    // to disable the Save/Deploy button.
    @Output() validityChange = new EventEmitter<boolean>();
    fieldErrors = signal<Record<string, string>>({});

    values: Record<string, any> = {};
    groups = signal<FieldGroup[]>([]);
    advancedOpen = signal<Record<string, boolean>>({});

    ngOnChanges(changes: SimpleChanges) {
        if ((changes['schema'] || changes['initialValues']) && this.schema) {
            this.buildForm();
        }
    }

    private buildForm() {
        const properties = this.schema?.properties || {};
        const required = new Set<string>(this.schema?.required || []);

        const fields: SchemaField[] = Object.entries(properties).map(
            ([name, def]: [string, any]) => ({
                name,
                type: def.type || 'string',
                default: def.default,
                description: def.description,
                title: def.title,
                enum: def.enum,
                required: required.has(name),
                minimum: def.minimum,
                maximum: def.maximum,
                minLength: def.minLength,
                maxLength: def.maxLength,
                pattern: def.pattern,
                multipleOf: def.multipleOf,
                'x-ui-order': def['x-ui-order'] ?? 999,
                'x-ui-group': def['x-ui-group'] || 'General',
                'x-ui-widget': def['x-ui-widget'],
                'x-ui-condition': def['x-ui-condition'],
                'x-ui-advanced': def['x-ui-advanced'] || false,
                'x-ui-columns': def['x-ui-columns'],
                'x-ui-col-span': def['x-ui-col-span'],
                'x-ui-placeholder': def['x-ui-placeholder'],
            })
        );

        const visibleFields = fields.filter(f => f['x-ui-widget'] !== 'profile-editor');
        visibleFields.sort((a, b) => (a['x-ui-order']! - b['x-ui-order']!));

        const newValues: Record<string, any> = {};
        for (const f of visibleFields) {
            if (this.initialValues[f.name] !== undefined) {
                newValues[f.name] = this.initialValues[f.name];
            } else if (f.type === 'array') {
                newValues[f.name] = Array.isArray(f.default) ? [...f.default] : [];
            } else {
                newValues[f.name] = f.default ?? (f.type === 'boolean' ? false : f.type === 'number' || f.type === 'integer' ? 0 : '');
            }
        }
        this.values = newValues;

        const groupMap = new Map<string, FieldGroup>();
        const groupOrder: string[] = [];

        for (const field of visibleFields) {
            const groupName = field['x-ui-group']!;
            if (!groupMap.has(groupName)) {
                groupMap.set(groupName, {
                    name: groupName,
                    columns: field['x-ui-columns'] || 1,
                    fields: [],
                    advancedFields: [],
                });
                groupOrder.push(groupName);
            }
            const group = groupMap.get(groupName)!;
            if (field['x-ui-columns'] && field['x-ui-columns'] > group.columns) {
                group.columns = field['x-ui-columns'];
            }
            if (field['x-ui-advanced']) {
                group.advancedFields.push(field);
            } else {
                group.fields.push(field);
            }
        }

        this.groups.set(groupOrder.map(name => groupMap.get(name)!));
        this.emitChange();
    }

    isFieldVisible(field: SchemaField): boolean {
        const cond = field['x-ui-condition'];
        if (!cond) return true;
        return this.values[cond.field] === cond.value;
    }

    resolveWidget(field: SchemaField): string {
        const widget = field['x-ui-widget'];
        if (widget) return widget;

        if (field.enum && field.enum.length > 0) return 'select';
        if (field.type === 'boolean') return 'toggle';
        if (field.type === 'integer' || field.type === 'number') return 'number';
        return 'text';
    }

    formatLabel(name: string): string {
        return name
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .replace(/^./, s => s.toUpperCase())
            .trim();
    }

    toOptions(enumValues: any[]): { label: string; value: any }[] {
        return enumValues.map(v => ({ label: String(v), value: v }));
    }

    private readonly groupIcons: Record<string, string> = {
        General: 'pi-sliders-h',
        Networking: 'pi-globe',
        Storage: 'pi-database',
        Security: 'pi-shield',
        Resources: 'pi-server',
        Authentication: 'pi-lock',
    };

    getGroupIcon(groupName: string): string {
        return this.groupIcons[groupName] || 'pi-cog';
    }

    toggleAdvanced(groupName: string) {
        const current = { ...this.advancedOpen() };
        current[groupName] = !current[groupName];
        this.advancedOpen.set(current);
    }

    emitChange() {
        // Revalidate every field so errors clear as soon as the user fixes them.
        const errors: Record<string, string> = {};
        for (const group of this.groups()) {
            for (const field of [...group.fields, ...group.advancedFields]) {
                const msg = this.validateField(field, this.values[field.name]);
                if (msg) errors[field.name] = msg;
            }
        }
        this.fieldErrors.set(errors);
        this.validityChange.emit(Object.keys(errors).length === 0);

        const filtered: Record<string, any> = {};
        for (const [key, val] of Object.entries(this.values)) {
            if (Array.isArray(val) || (val !== '' && val !== null && val !== undefined)) {
                filtered[key] = val;
            }
        }
        this.parametersChange.emit(filtered);
    }

    // A K8s resource.Quantity accepts:
    //   - a bare decimal: "1", "1.5"
    //   - decimal + binary SI suffix: "500Mi", "2Gi", "10Ki"
    //   - decimal + metric SI suffix: "500m" (milli for CPU), "1k", "1G"
    //   - scientific notation: "1.5e3"
    // Empty values are allowed — a missing optional parameter falls back to
    // the schema default server-side.
    private static readonly K8S_QUANTITY_RE =
        /^[0-9]+(\.[0-9]+)?(m|n|u|[kKMGTPE]i?|e[-+]?[0-9]+)?$/;

    private isQuantityField(field: SchemaField): boolean {
        if (field.type !== 'string') return false;
        const hay = `${field.name} ${field.description ?? ''} ${field.title ?? ''}`.toLowerCase();
        return /\b(cpu|memory|mem)\b/.test(hay) || /request|limit/.test(field.name.toLowerCase());
    }

    validateField(field: SchemaField, value: unknown): string {
        if (value === undefined || value === null || value === '') return '';
        if (!this.isQuantityField(field)) return '';
        const v = String(value).trim();
        if (!DynamicSchemaFormComponent.K8S_QUANTITY_RE.test(v)) {
            return `Invalid Kubernetes quantity. Use a number with an optional suffix (e.g. "500Mi", "2Gi", "500m", "1").`;
        }
        // A bare digit means BYTES for memory or CORES for CPU — almost never
        // what the user wants. "1" for memory = 1 byte, "1" for CPU = 1 core.
        // Catch the ambiguous case and nudge towards an explicit suffix.
        if (/^[0-9]+(\.[0-9]+)?$/.test(v)) {
            const lower = field.name.toLowerCase();
            if (lower.includes('memory') || lower.includes('mem')) {
                return `"${v}" would be interpreted as ${v} byte(s). Did you mean "${v}Mi" or "${v}Gi"?`;
            }
            if (lower.includes('cpu')) {
                return `"${v}" would be interpreted as ${v} core(s). Add an "m" suffix for milli-cores if that is not intended.`;
            }
        }
        return '';
    }
}
