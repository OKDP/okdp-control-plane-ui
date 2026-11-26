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
  /** Deployment engine in use. Absent from servers that predate pluggable
   *  engines. Read through resolveEngineCapability, never directly. */
  engine?: EngineCapabilityWire;
}

/** Wire shape of `engine`: every field may be missing or mistyped. */
export interface EngineCapabilityWire {
  /** Display only: screens branch on capabilities, never on the name. */
  name?: unknown;
  renderedValues?: unknown;
  suspend?: unknown;
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
