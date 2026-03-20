import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="admin-home">
      <!-- Welcome Banner -->
      <div class="welcome-banner">
        <div class="banner-content">
          <div class="banner-icon">
            <i class="pi pi-cog"></i>
          </div>
          <div class="banner-text">
            <h1>Administration</h1>
            <p class="subtitle">Manage your projects, users, and platform settings from here.</p>
          </div>
        </div>
        <div class="banner-decoration"></div>
      </div>

      <!-- Quick Actions -->
      <h2 class="section-heading">Manage</h2>
      <div class="quick-actions">
        <a class="action-card" routerLink="/admin/projects">
          <div class="card-icon projects">
            <i class="pi pi-th-large"></i>
          </div>
          <div class="action-text">
            <span class="action-title">Projects</span>
            <span class="action-desc">Create and manage data projects</span>
          </div>
          <i class="pi pi-arrow-right action-arrow"></i>
        </a>
        <a class="action-card" routerLink="/admin/identity">
          <div class="card-icon identity">
            <i class="pi pi-users"></i>
          </div>
          <div class="action-text">
            <span class="action-title">Identity</span>
            <span class="action-desc">Manage users and access control</span>
          </div>
          <i class="pi pi-arrow-right action-arrow"></i>
        </a>
      </div>
    </div>
  `,
  styles: [`
    /* Layout only — shared styles (welcome-banner, action-card, card-icon, etc.)
       are defined globally in base.css */
    .admin-home {
      display: flex;
      flex-direction: column;
      gap: 28px;
      animation: fadeInUp 0.4s ease-out;
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class AdminHomeComponent { }
