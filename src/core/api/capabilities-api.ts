import { environment } from '../../config/environment';
import { http } from './http';

export interface IdentityOidcConfig {
  authority: string;
  clientId: string;
  scope?: string;
}

export interface Capabilities {
  identity: {
    provider: string; // "external" (default) or "kubauth"
    userManagement: boolean;
    oidc?: IdentityOidcConfig;
  };
  oidcProvisioning: {
    provider: string; // "none" (default), "kubauth" or "keycloak"
  };
}

export const capabilitiesApi = {
  get(): Promise<Capabilities> {
    // Bounded: this call gates the app bootstrap, so a dead server must
    // degrade to the build-time config rather than hang the UI.
    return http.get<Capabilities>(`${environment.apiBaseUrl}/api/capabilities`, {
      signal: AbortSignal.timeout(5000),
    });
  },
};
