import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import type { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';
import { AuthService } from '../../core/auth/auth.service';
import { SpaceService } from '../../core/context/space.service';
import { ProjectContextService } from '../../core/context/project-context.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-project-page',
  standalone: true,
  imports: [CommonModule, MenuModule, AvatarModule, RouterOutlet, RouterModule, SelectModule, FormsModule],
  templateUrl: './project.page.html',
  styleUrls: ['./project.page.scss'],
})
export class ProjectPage {
  protected readonly auth = inject(AuthService);
  protected readonly context = inject(ProjectContextService);
  protected readonly sidebarCollapsed = signal(this.readStoredSidebarState());
  protected readonly lakehouseExpanded = signal(true);
  protected readonly dataEngExpanded = signal(true);
  protected readonly notebookExpanded = signal(true);
  protected readonly sqlBiExpanded = signal(true);
  protected readonly mlExpanded = signal(false);

  // Environment URLs for template
  readonly githubUrl = environment.githubUrl;

  readonly displayName = computed(
    () => this.auth.profile()?.firstName ?? this.auth.profile()?.username ?? 'User',
  );

  readonly initials = computed(() => {
    const profile = this.auth.profile();
    const first = (profile?.firstName ?? profile?.username ?? '?').charAt(0).toUpperCase();
    const last = (profile?.lastName ?? '').charAt(0).toUpperCase();
    return `${first}${last || ''}`;
  });

  protected readonly profileMenu: MenuItem[] = [
    {
      label: 'Sign out',
      icon: 'pi pi-sign-out',
      command: () => this.auth.logout(),
    },
  ];

  private readonly spaces = inject(SpaceService);

  constructor() {
    this.spaces.remember('project');
  }

  protected toggleLakehouse(): void {
    this.lakehouseExpanded.update(v => !v);
  }

  protected toggleDataEng(): void {
    this.dataEngExpanded.update(v => !v);
  }

  protected toggleNotebook(): void {
    this.notebookExpanded.update(v => !v);
  }

  protected toggleSqlBi(): void {
    this.sqlBiExpanded.update(v => !v);
  }

  protected toggleMl(): void {
    this.mlExpanded.update(v => !v);
  }

  protected toggleSidebar(): void {
    this.sidebarCollapsed.update(collapsed => {
      const newState = !collapsed;
      localStorage.setItem('okdp-sidebar-collapsed', String(newState));
      return newState;
    });
  }

  private readStoredSidebarState(): boolean {
    return localStorage.getItem('okdp-sidebar-collapsed') === 'true';
  }
}

