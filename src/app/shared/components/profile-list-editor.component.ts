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
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { PanelModule } from 'primeng/panel';
import { ButtonModule } from 'primeng/button';

export interface Profile {
    type: string;
    image: string;
    cpuRequest: number;
    cpuLimit: number;
    memoryRequestGi: number;
    memoryLimitGi: number;
    gpuEnabled: boolean;
    gpuCount: number;
}

const DEFAULT_PROFILE: Profile = {
    type: '',
    image: '',
    cpuRequest: 0.5,
    cpuLimit: 2.0,
    memoryRequestGi: 1,
    memoryLimitGi: 4,
    gpuEnabled: false,
    gpuCount: 1,
};

@Component({
    selector: 'app-profile-list-editor',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        SelectModule,
        InputNumberModule,
        ToggleSwitchModule,
        PanelModule,
        ButtonModule,
    ],
    template: `
        <div class="profile-list">
            @for (profile of profiles(); track $index) {
                <div class="profile-card">
                    <div class="profile-header">
                        <div class="profile-header-left">
                            <span class="profile-number">{{ $index + 1 }}</span>
                            <span class="profile-label">Profile {{ $index + 1 }}</span>
                        </div>
                        <p-button icon="pi pi-times" [text]="true" [rounded]="true" severity="danger" 
                            (onClick)="removeProfile($index)" title="Remove this profile">
                        </p-button>
                    </div>

                    <div class="profile-body">
                        <div class="field-row-2">
                            <div class="field">
                                <label>Type</label>
                                <p-select [(ngModel)]="profile.type"
                                    [options]="profileTypeOptions"
                                    optionLabel="label" optionValue="value"
                                    placeholder="Select type"
                                    appendTo="body"
                                    styleClass="w-full"
                                    (ngModelChange)="onTypeChange($index)"></p-select>
                            </div>
                            <div class="field">
                                <label>Image</label>
                                <p-select [(ngModel)]="profile.image"
                                    [options]="getImagesForType(profile.type)"
                                    optionLabel="label" optionValue="image"
                                    placeholder="Select image"
                                    [disabled]="!profile.type"
                                    appendTo="body"
                                    styleClass="w-full"
                                    (ngModelChange)="emitChange()"></p-select>
                            </div>
                        </div>

                        <p-panel header="Resources" [toggleable]="true" [collapsed]="true"
                            styleClass="resource-panel">
                            <div class="field-row-2">
                                <div class="field">
                                    <label>CPU Request (vCPU)</label>
                                    <p-inputNumber [(ngModel)]="profile.cpuRequest"
                                        [showButtons]="true" buttonLayout="horizontal"
                                        [step]="0.25" [min]="0.25" [max]="16"
                                        [minFractionDigits]="1" [maxFractionDigits]="2"
                                        incrementButtonIcon="pi pi-plus" decrementButtonIcon="pi pi-minus"
                                        styleClass="w-full"
                                        (ngModelChange)="emitChange()"></p-inputNumber>
                                </div>
                                <div class="field">
                                    <label>CPU Limit (vCPU)</label>
                                    <p-inputNumber [(ngModel)]="profile.cpuLimit"
                                        [showButtons]="true" buttonLayout="horizontal"
                                        [step]="0.25" [min]="0.25" [max]="64"
                                        [minFractionDigits]="1" [maxFractionDigits]="2"
                                        incrementButtonIcon="pi pi-plus" decrementButtonIcon="pi pi-minus"
                                        styleClass="w-full"
                                        (ngModelChange)="emitChange()"></p-inputNumber>
                                </div>
                            </div>
                            <div class="field-row-2">
                                <div class="field">
                                    <label>Memory Request (GiB)</label>
                                    <p-inputNumber [(ngModel)]="profile.memoryRequestGi"
                                        [showButtons]="true" buttonLayout="horizontal"
                                        [step]="0.25" [min]="0.25" [max]="64"
                                        [minFractionDigits]="1" [maxFractionDigits]="2"
                                        incrementButtonIcon="pi pi-plus" decrementButtonIcon="pi pi-minus"
                                        styleClass="w-full"
                                        (ngModelChange)="emitChange()"></p-inputNumber>
                                </div>
                                <div class="field">
                                    <label>Memory Limit (GiB)</label>
                                    <p-inputNumber [(ngModel)]="profile.memoryLimitGi"
                                        [showButtons]="true" buttonLayout="horizontal"
                                        [step]="0.25" [min]="0.25" [max]="256"
                                        [minFractionDigits]="1" [maxFractionDigits]="2"
                                        incrementButtonIcon="pi pi-plus" decrementButtonIcon="pi pi-minus"
                                        styleClass="w-full"
                                        (ngModelChange)="emitChange()"></p-inputNumber>
                                </div>
                            </div>
                            <div class="field">
                                <label>GPU</label>
                                <div class="gpu-row">
                                    <p-toggleSwitch [(ngModel)]="profile.gpuEnabled"
                                        (ngModelChange)="emitChange()"></p-toggleSwitch>
                                    @if (profile.gpuEnabled) {
                                        <p-inputNumber [(ngModel)]="profile.gpuCount"
                                            [showButtons]="true" [min]="1" [max]="8"
                                            styleClass="gpu-count"
                                            (ngModelChange)="emitChange()"></p-inputNumber>
                                    }
                                </div>
                            </div>
                        </p-panel>
                    </div>
                </div>
            }

            <p-button label="Add profile" icon="pi pi-plus" [outlined]="true" severity="secondary" styleClass="w-full" (onClick)="addProfile()"></p-button>
        </div>
    `,
    styles: [`
        .profile-list {
            display: flex;
            flex-direction: column;
            gap: var(--db-space-md);
        }
        .profile-card {
            border: 1px solid var(--db-border-light);
            border-radius: var(--db-radius-xl);
            overflow: hidden;
            background: var(--db-bg-primary);
            box-shadow: 0 2px 8px rgba(0,0,0,0.02);
            transition: box-shadow 0.3s ease, border-color 0.3s ease, transform var(--db-transition-spring);
            animation: fadeInUp var(--db-transition-spring) backwards;
        }
        .profile-card:hover {
            box-shadow: 0 8px 24px rgba(0,0,0,0.06);
            border-color: var(--db-primary-200);
            transform: translateY(-2px);
        }
        .profile-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: var(--db-bg-secondary);
            border-bottom: 1px solid var(--db-border-light);
        }
        .profile-header-left {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .profile-number {
            width: 24px;
            height: 24px;
            border-radius: var(--db-radius-sm);
            background: var(--db-primary);
            color: white;
            font-size: 12px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .profile-label {
            font-weight: 700;
            font-size: 15px;
            color: var(--db-text-primary);
            letter-spacing: -0.02em;
        }
        .remove-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border: 1px solid var(--db-border-light);
            background: var(--db-bg-primary);
            border-radius: var(--db-radius-md);
            cursor: pointer;
            color: var(--db-text-secondary);
            transition: all var(--db-transition-fast);
        }
        .remove-btn:hover {
            background: var(--db-accent-red-light);
            color: var(--db-accent-red);
        }
        .profile-body {
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .field-row-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
        }
        .field {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .field label {
            font-weight: 600;
            font-size: 14px;
            color: var(--db-text-secondary);
            letter-spacing: -0.01em;
        }
        .gpu-row {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .add-profile-btn {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 20px;
            background: var(--db-bg-secondary);
            border: 1px solid var(--db-border-light);
            border-radius: var(--db-radius-xl);
            cursor: pointer;
            color: var(--db-text-secondary);
            font-size: 15px;
            font-weight: 600;
            font-family: inherit;
            transition: all var(--db-transition-base);
        }
        .add-profile-btn:hover {
            border-color: var(--db-primary-300);
            color: var(--db-primary);
            background: var(--db-primary-50);
        }
        .add-icon-circle {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: var(--db-bg-tertiary);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background var(--db-transition-base);
        }
        .add-profile-btn:hover .add-icon-circle {
            background: var(--db-primary-100);
        }
        .add-icon-circle i {
            font-size: 11px;
        }
        :host ::ng-deep .gpu-count {
            width: 120px;
        }
        :host ::ng-deep .resource-panel .p-panel-header {
            padding: 10px 0;
            background: transparent;
            border: none;
            border-top: 1px solid var(--db-border-light);
        }
        :host ::ng-deep .resource-panel .p-panel-content {
            padding: 14px 0 0 0;
            border: none;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }
        :host ::ng-deep .resource-panel .p-panel-title {
            font-size: 13px;
            font-weight: 500;
            color: var(--db-text-secondary);
        }
    `]
})
export class ProfileListEditorComponent implements OnChanges {
    @Input() profileImages: Record<string, { label: string; image: string }[]> = {};
    @Input() initialProfiles: Profile[] = [];
    @Output() profilesChange = new EventEmitter<Profile[]>();

    profiles = signal<Profile[]>([]);

    ngOnChanges(changes: SimpleChanges) {
        if (changes['initialProfiles'] && this.initialProfiles.length > 0) {
            this.profiles.set(this.initialProfiles.map(p => ({ ...DEFAULT_PROFILE, ...p })));
            this.emitChange();
        }
    }

    profileTypeOptions = [
        { label: 'JupyterLab', value: 'jupyterlab' },
        { label: 'VSCode', value: 'vscode' },
        { label: 'RStudio', value: 'rstudio' },
    ];

    getImagesForType(type: string): { label: string; image: string }[] {
        return this.profileImages[type] || [];
    }

    addProfile() {
        this.profiles.update(list => [...list, { ...DEFAULT_PROFILE }]);
        this.emitChange();
    }

    removeProfile(index: number) {
        this.profiles.update(list => list.filter((_, i) => i !== index));
        this.emitChange();
    }

    onTypeChange(index: number) {
        this.profiles.update(list => {
            const updated = [...list];
            updated[index] = { ...updated[index], image: '' };
            return updated;
        });
        this.emitChange();
    }

    emitChange() {
        this.profilesChange.emit(this.profiles());
    }
}
