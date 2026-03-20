import { Injectable, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { AuthService } from '../auth/auth.service';
import { SpaceService } from './space.service';

@Injectable({ providedIn: 'root' })
export class AuthRedirectService {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly auth = inject(AuthService);
  private readonly spaces = inject(SpaceService);

  constructor() {
    effect(
      () => {
        if (!this.auth.ready()) {
          return;
        }
        if (!this.auth.isAuthenticated()) {
          return;
        }

        // Check for saved return URL
        const returnUrl = sessionStorage.getItem('auth_return_url');
        if (returnUrl) {
          sessionStorage.removeItem('auth_return_url');
          this.router.navigateByUrl(returnUrl);
          return;
        }

        const next = this.spaces.resolveInitialRoute({
          profile: this.auth.profile(),
          roles: this.auth.roles(),
        });
        if (this.shouldRedirect(next)) {
          this.router.navigateByUrl(next);
        }
      },

    );
  }

  private shouldRedirect(target: string): boolean {
    // Use window.location.pathname to get the absolute truth from the browser
    // Location.path() can be empty during initialization
    const current = window.location.pathname;

    if (current.startsWith('/admin') || current.startsWith('/workspace')) {
      return false;
    }
    return current !== target;
  }
}

