import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import type { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';
import { AuthService } from '../../core/auth/auth.service';
import { SpaceService } from '../../core/context/space.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [MenuModule, AvatarModule, RouterOutlet, RouterModule],
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
})
export class AdminPage {
  protected readonly auth = inject(AuthService);
  protected readonly sidebarCollapsed = signal(this.readStoredSidebarState());

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
    this.spaces.remember('admin');
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
