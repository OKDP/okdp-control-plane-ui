import { APP_INITIALIZER, ApplicationConfig, inject, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { provideAuth, LogLevel } from 'angular-auth-oidc-client';
import { appRoutes } from './app.routes';
import Aura from '@primeuix/themes/aura';
import { AuthService } from './core/auth/auth.service';
import { authInterceptor } from './core/auth/auth.interceptor';
import { environment } from '../environments/environment';

function initializeAuth(): () => Promise<void> {
  const authService = inject(AuthService);
  return () => authService.init();
}

// Map string log level from environment to LogLevel enum
function getLogLevel(): LogLevel {
  if (environment.production) {
    return LogLevel.None;
  }
  const level = environment.oidc.logLevel?.toLowerCase();
  switch (level) {
    case 'debug': return LogLevel.Debug;
    case 'warn': return LogLevel.Warn;
    case 'error': return LogLevel.Error;
    default: return LogLevel.None;
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimations(),
    provideRouter(
      appRoutes,
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
    ),
    providePrimeNG({
      ripple: true,
      theme: {
        preset: Aura,
      },
    }),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAuth({
      config: {
        authority: environment.oidc.authority,
        redirectUrl: environment.oidc.redirectUri,
        postLogoutRedirectUri: environment.oidc.postLogoutRedirectUri,
        clientId: environment.oidc.clientId,
        scope: environment.oidc.scope,
        responseType: environment.oidc.responseType,
        silentRenew: environment.oidc.silentRenew,
        useRefreshToken: environment.oidc.useRefreshToken,
        logLevel: getLogLevel(),
        secureRoutes: ['/api/'],
        ignoreNonceAfterRefresh: true,
      }
    }),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      multi: true,
    },
  ]
};

