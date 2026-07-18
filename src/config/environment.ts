// Environment configuration. Vite statically replaces import.meta.env.PROD,
// so the unused branch is dropped from production bundles.

interface OidcConfig {
  authority: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scope: string;
  responseType: string;
  silentRenew: boolean;
  logLevel: string;
}

interface Environment {
  production: boolean;
  apiBaseUrl: string;
  oidc: OidcConfig;
  githubUrl: string;
}

const development: Environment = {
  production: false,

  // API Configuration
  apiBaseUrl: 'http://localhost:8093',

  oidc: {
    // Keycloak is the default sandbox IdP instead of kubauth
    authority: 'https://keycloak.okdp.sandbox/realms/master',
    clientId: 'okdp-ui',
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    scope: 'openid profile email groups offline_access',
    responseType: 'code',
    silentRenew: true,
    logLevel: 'Debug',
  },

  // External Links
  githubUrl: 'https://github.com/okdp',
};

const production: Environment = {
  ...development,

  production: true,

  // API Configuration - relative URLs for same-origin deployment
  apiBaseUrl: '',

  oidc: {
    ...development.oidc,
    logLevel: 'None',
  },
};

export const environment: Environment = import.meta.env.PROD ? production : development;

/** Overrides the build-time OIDC config with the platform's runtime config. */
export function applyRuntimeOidc(oidc?: { authority: string; clientId: string; scope?: string }) {
  if (!oidc?.authority || !oidc.clientId) return;
  environment.oidc.authority = oidc.authority;
  environment.oidc.clientId = oidc.clientId;
  if (oidc.scope) environment.oidc.scope = oidc.scope;
}
