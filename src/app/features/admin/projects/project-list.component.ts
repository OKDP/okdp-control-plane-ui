import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TableModule, Table } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { MenuModule } from 'primeng/menu';
import { TagModule } from 'primeng/tag';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';
import { Subscription } from 'rxjs';
import { Project, ProjectApiService, ProjectEvent } from '../../../core/api/project-api.service';
import { LoggerService } from '../../../core/services/logger.service';
@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    ToastModule,
    ConfirmDialogModule,
    TooltipModule,
    MenuModule,
    TagModule,
    IconFieldModule,
    InputIconModule
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <div class="workspace-container">
      <!-- Top Bar: Title + Search (Left) | Create Button (Right) -->
      <div class="top-bar">
        <div class="left-group">
          <h1>Projects</h1>
          <p-iconfield>
            <p-inputicon styleClass="pi pi-search" />
            <input
              type="text"
              pInputText
              placeholder="Filter projects..."
              (input)="onGlobalFilter(dt, $event)" />
          </p-iconfield>
        </div>

        <p-button
          label="Create project"
          (onClick)="showDialog()"
          styleClass="create-btn">
        </p-button>
      </div>

      <!-- Data Table -->
      <div class="table-wrapper">
        <p-table
          #dt
          [value]="projects()"
          [globalFilterFields]="['name', 'description']"
          styleClass="minimal-table">

          <ng-template pTemplate="header">
            <tr>
              <th style="width: 30%">Name</th>
              <th style="width: 60%">Description</th>
              <th style="width: 10%"></th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-project>
            <tr class="workspace-row">
              <td>
                <span class="project-name">{{ project.name }}</span>
              </td>
              <td class="description-cell">
                {{ project.description || '-' }}
              </td>
              <td style="text-align: right">
                <div class="actions">
                  <a [routerLink]="['/project', project.name]" class="action-link primary visible-btn" style="text-decoration: none;">
                    Open <i class="pi pi-external-link"></i>
                  </a>

                  <p-button icon="pi pi-ellipsis-v" [text]="true" [rounded]="true"
                    (onClick)="menu.toggle($event); selectedProject = project">
                  </p-button>
                  <p-menu #menu [model]="menuItems" [popup]="true" appendTo="body"></p-menu>
                </div>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="3" class="empty-message">
                No projects found.
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>

      <!-- Create Dialog -->
      <p-dialog
        header="Create new project"
        [(visible)]="visible"
        [modal]="true"
        [draggable]="false"
        [resizable]="false"
        [style]="{ width: '600px' }"
        styleClass="db-dialog"
        [closable]="true">

        <div class="dialog-content">
          <div class="field">
            <label for="name">Project name</label>
            <input
              pInputText
              id="name"
              [(ngModel)]="newProject.name"
              class="w-full dialog-input"
              placeholder="e.g., analytics-prod" />
          </div>

          <div class="field">
            <label for="description">Description <span class="optional">(optional)</span></label>
            <textarea
              pInputTextarea
              id="description"
              [(ngModel)]="newProject.description"
              rows="5"
              class="w-full dialog-input"
              placeholder="Briefly describe the purpose of this project...">
            </textarea>
          </div>
        </div>

        <ng-template pTemplate="footer">
          <div class="dialog-actions">
            <p-button severity="secondary" [outlined]="true" label="Cancel" (onClick)="visible = false"></p-button>
            <p-button severity="primary" [disabled]="!newProject.name" (onClick)="createProject()" label="Create"></p-button>
          </div>
        </ng-template>
      </p-dialog>

      <p-confirmDialog
        styleClass="db-confirm-dialog"
        [style]="{width: '400px'}"
        acceptButtonStyleClass="p-button-danger"
        rejectButtonStyleClass="p-button-text">
      </p-confirmDialog>

      <p-toast position="bottom-right"></p-toast>
    </div>
  `,
  styles: [`
    /* Search handled by global layout.css — only component-specific overrides here */
    .project-name {
      font-weight: 500;
      color: var(--db-text-primary);
    }
  `]
})
export class ProjectListComponent implements OnInit, OnDestroy {
  private readonly api = inject(ProjectApiService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly logger = inject(LoggerService);

  projects = signal<Project[]>([]);
  visible = false;
  private streamSub?: Subscription;

  newProject: Project = { name: '', description: '' };
  selectedProject: Project | null = null;

  menuItems: MenuItem[] = [
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      command: () => {
        if (this.selectedProject) {
          this.confirmDelete(this.selectedProject);
        }
      }
    }
  ];

  ngOnInit() {
    this.loadProjects();
  }

  ngOnDestroy() {
    this.streamSub?.unsubscribe();
  }

  loadProjects() {
    this.api.getProjects().subscribe({
      next: (data) => {
        this.projects.set(data);
        this.startStream();
      },
      error: () => this.showError('Failed to load projects')
    });
  }

  startStream() {
    if (this.streamSub) return;
    this.streamSub = this.api.getProjectsStream().subscribe({
      next: (event) => this.handleProjectEvent(event),
      error: (err) => this.logger.error('Stream error', err)
    });
  }

  handleProjectEvent(event: ProjectEvent) {
    const project = event.object;
    switch (event.type) {
      case 'ADDED':
        this.projects.update(list => {
          if (list.some(p => p.name === project.name)) return list;
          this.showSuccess(`Project ${project.name} created`);
          return [...list, project];
        });
        break;
      case 'MODIFIED':
        this.projects.update(list => list.map(p => p.name === project.name ? project : p));
        break;
      case 'DELETED':
        this.projects.update(list => {
          const exists = list.some(p => p.name === project.name);
          if (exists) {
            this.showSuccess(`Project ${project.name} deleted`);
            return list.filter(p => p.name !== project.name);
          }
          return list;
        });
        break;
    }
  }

  showDialog() {
    this.newProject = { name: '', description: '' };
    this.visible = true;
  }

  createProject() {
    this.api.createProject(this.newProject).subscribe({
      next: () => {
        this.visible = false;
      },
      error: (err) => {
        this.showError('Failed to create project');
        this.logger.error('Failed to create project', err);
      }
    });
  }

  confirmDelete(ws: Project) {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete <strong>${ws.name}</strong>? This action cannot be undone.`,
      header: 'Delete project?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => {
        this.deleteProject(ws);
      }
    });
  }

  deleteProject(ws: Project) {
    this.api.deleteProject(ws.name).subscribe({
      error: () => this.showError('Failed to delete project')
    });
  }

  private showSuccess(detail: string) {
    this.messageService.add({
      severity: 'success',
      summary: 'Success',
      detail,
      life: 3000
    });
  }

  private showError(detail: string) {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail,
      life: 5000
    });
  }

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }
}
