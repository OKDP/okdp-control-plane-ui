import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProjectContextService } from '../../../core/context/project-context.service';
import { SparkListComponent } from './spark-list.component';

@Component({
    selector: 'app-spark-apps-page',
    standalone: true,
    imports: [ButtonModule, SparkListComponent],
    template: `
        <div class="cluster-container">
            <div class="top-bar">
                <div class="left-group">
                    <h1>Spark Jobs</h1>
                </div>
                <p-button label="Submit job" icon="pi pi-plus" (onClick)="goToSubmit()"
                    styleClass="create-btn"></p-button>
            </div>
            <app-spark-list></app-spark-list>
        </div>
    `
})
export class SparkAppsPageComponent {
    private readonly router = inject(Router);
    private readonly context = inject(ProjectContextService);

    goToSubmit() {
        const project = this.context.currentProject();
        if (project) {
            this.router.navigate(['/project', project.name, 'spark', 'applications', 'submit']);
        }
    }
}
