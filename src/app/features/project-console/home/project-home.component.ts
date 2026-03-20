import { Component, inject } from '@angular/core';
import { ProjectContextService } from '../../../core/context/project-context.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-project-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <section class="home">
      @if (context.currentProject(); as project) {
        <!-- Welcome Banner -->
        <div class="welcome-banner">
          <div class="banner-content">
            <div class="banner-icon">
              <i class="pi pi-th-large"></i>
            </div>
            <div class="banner-text">
              <h1>{{ project.name }}</h1>
              <p class="subtitle">{{ project.description || 'Project Dashboard' }}</p>
            </div>
          </div>
          <div class="banner-decoration"></div>
        </div>

        <!-- Quick Actions -->
        <h2 class="section-heading">Quick Actions</h2>
        <div class="quick-actions">
          <a class="action-card" [routerLink]="['/project', project.name, 'services', 'deploy']">
            <div class="card-icon deploy">
              <i class="pi pi-play"></i>
            </div>
            <div class="action-text">
              <span class="action-title">Deploy Notebook</span>
              <span class="action-desc">Launch a new Jupyter instance</span>
            </div>
            <i class="pi pi-arrow-right action-arrow"></i>
          </a>
          <a class="action-card" [routerLink]="['/project', project.name, 'services']">
            <div class="card-icon instances">
              <i class="pi pi-server"></i>
            </div>
            <div class="action-text">
              <span class="action-title">View Instances</span>
              <span class="action-desc">Monitor running notebooks</span>
            </div>
            <i class="pi pi-arrow-right action-arrow"></i>
          </a>
          <a class="action-card" [routerLink]="['/project', project.name, 'secret-stores']">
            <div class="card-icon secrets">
              <i class="pi pi-lock"></i>
            </div>
            <div class="action-text">
              <span class="action-title">Manage Secrets</span>
              <span class="action-desc">Configure secret stores</span>
            </div>
            <i class="pi pi-arrow-right action-arrow"></i>
          </a>
        </div>
      } @else if (context.availableProjects().length === 0) {
        <div class="empty-state">
          <div class="empty-icon-wrapper">
            <i class="pi pi-folder-open empty-icon"></i>
          </div>
          <h2>No Projects Available</h2>
          <p>Your workspace is empty. Create your first project to get started.</p>
          <a routerLink="/admin/projects" class="cta-button">
            <i class="pi pi-plus"></i>
            Create Project
          </a>
        </div>
      } @else {
        <div class="loading-state">
          <i class="pi pi-spin pi-spinner"></i>
          <p>Loading project...</p>
        </div>
      }
    </section>
  `,
  styles: [`
    /* Layout only — shared styles (welcome-banner, action-card, card-icon,
       empty-state, cta-button, etc.) are defined globally in base.css */
    .home {
      display: flex;
      flex-direction: column;
      gap: 28px;
      animation: fadeInUp 0.4s ease-out;
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .loading-state {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--db-text-secondary);
      padding: var(--db-space-xl) 0;
    }

    .loading-state i {
      color: var(--db-primary);
    }
  `]
})
export class ProjectHomeComponent {
  protected readonly context = inject(ProjectContextService);
}
