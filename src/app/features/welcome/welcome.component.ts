import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ProjectContextService } from '../../core/context/project-context.service';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent {
  private readonly auth = inject(AuthService);
  private readonly projectContext = inject(ProjectContextService);
  private readonly router = inject(Router);

  readonly userProfile = this.auth.profile;

  constructor() {
    effect(() => {
      const projects = this.projectContext.availableProjects();
      const isLoading = this.projectContext.isLoading();

      if (!isLoading && projects.length > 0) {
        const firstProject = projects[0];
        this.router.navigate(['/project', firstProject.name]);
      }
    });
  }

  isAdmin(): boolean {
    return this.auth.hasRole('admins');
  }

  logout(): void {
    this.auth.logout();
  }
}
