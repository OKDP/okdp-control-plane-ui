import { Injectable, computed, signal, inject } from '@angular/core';
import { OidcSecurityService, LoginResponse } from 'angular-auth-oidc-client';
import { firstValueFrom, Observable } from 'rxjs';
import { LoggerService } from '../services/logger.service';

export interface UserProfile {
  sub: string;
  email?: string;
  variable_email?: string;
  email_verified?: boolean;
  name?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  groups?: string[];
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly oidcSecurityService = inject(OidcSecurityService);
  private readonly logger = inject(LoggerService);
  private readonly autoLoginRequested: boolean;
  private readonly appRedirectUri = `${window.location.origin}/index.html`;

  #ready = signal(false);
  #authenticated = signal(false);
  #profile = signal<UserProfile | null>(null);
  #roles = signal<string[]>([]);

  readonly ready = computed(() => this.#ready());
  readonly isAuthenticated = computed(() => this.#authenticated());
  readonly profile = computed(() => this.#profile());
  readonly roles = computed(() => this.#roles());

  constructor() {
    const currentUrl = new URL(window.location.href);

    // Save current URL for restoration after redirect, if it's a deep link
    // Logic adapted to exclude OIDC callback params if any
    if (currentUrl.pathname !== '/' && currentUrl.pathname !== '/index.html' && !currentUrl.pathname.includes('login')) {
      // Only save if we are not already in a callback?
      // OidcSecurityService handles this usually via 'state'.
      // For now, keeping legacy logic but might need adjustment.
      sessionStorage.setItem('auth_return_url', currentUrl.pathname + currentUrl.search);
    }

    this.autoLoginRequested = currentUrl.searchParams.has('autoLogin');
    if (this.autoLoginRequested) {
      currentUrl.searchParams.delete('autoLogin');
      const nextUrl = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
      window.history.replaceState({}, '', nextUrl);
    }
  }

  init(): Promise<void> {
    // Check auth and subscribe to changes
    return firstValueFrom(this.oidcSecurityService.checkAuth())
      .then((loginResponse: LoginResponse) => {
        this.updateState(loginResponse);

        // Also subscribe to further changes (silent renew, etc.)
        this.oidcSecurityService.checkAuth().subscribe((lr) => this.updateState(lr));

        this.#ready.set(true);

        if (this.autoLoginRequested && !loginResponse.isAuthenticated) {

          this.login();
        }
      })
      .catch((err) => {
        this.logger.error('OIDC Initialization failed', err);
        // Mark as ready anyway so the app can load
        this.#ready.set(true);
      });
  }

  private updateState(loginResponse: LoginResponse) {
    this.#authenticated.set(loginResponse.isAuthenticated);

    if (loginResponse.isAuthenticated) {
      const userData = loginResponse.userData;
      this.#profile.set({
        ...userData,
        username: userData?.preferred_username || userData?.username || userData?.sub,
        firstName: userData?.given_name || userData?.firstName || userData?.name,
        lastName: userData?.family_name || userData?.lastName
      } as UserProfile);

      // Extract roles/groups from userData or Payload
      // Kubauth/OIDC typical claim for groups: 'groups' or 'roles'
      const roles = userData?.groups || [];
      this.#roles.set(roles);
    } else {
      this.#profile.set(null);
      this.#roles.set([]);
    }
  }

  login(configId?: string) {
    this.oidcSecurityService.authorize(configId);
  }

  logout(configId?: string) {
    // Try OIDC logout, but ensure local cleanup happens regardless
    this.oidcSecurityService.logoff(configId).subscribe({
      next: () => {

        this.clearLocalState();
      },
      error: (err) => {
        this.logger.error('Logout error, forcing local cleanup', err);
        // Even if OIDC logout fails (network error, expired token),
        // we still clear local state and redirect
        this.forceLogout();
      }
    });
  }

  /**
   * Force local logout without calling the OIDC provider.
   * Use this when the token is already expired or network is unavailable.
   */
  forceLogout() {

    this.clearLocalState();
  }

  /**
   * Clear all local authentication state.
   */
  private clearLocalState() {
    this.#authenticated.set(false);
    this.#profile.set(null);
    this.#roles.set([]);
    sessionStorage.removeItem('auth_return_url');
    sessionStorage.removeItem('okdp-selected-projectId');
  }

  accountManagement() {
    // Not supported in standard OIDC, requires proprietary URL
    this.logger.warn('Account management not supported in generic OIDC mode');
  }

  openAccountManagement() {
    // Alias if used
    this.accountManagement();
  }

  async token(): Promise<string | undefined> {
    const token = this.oidcSecurityService.getAccessToken();
    // Check if it's an observable (depends on version, but error says Observable<string>)
    if (token instanceof Object && 'subscribe' in token) {
      return firstValueFrom(token as Observable<string>);
    }
    return token as string;
  }

  hasRole(role: string): boolean {
    return this.roles().includes(role);
  }
}

