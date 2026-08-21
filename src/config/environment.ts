// Environment configuration. Vite statically replaces import.meta.env.PROD,
// so the unused branch is dropped from production bundles.
//
// The OIDC settings are read at STARTUP, not baked into the bundle: the same
// image must run against any cluster, whose issuer is not known when the
// bundle is built. The container entrypoint writes /config.js, which index.html
// loads before the bundle. The values below are the fallback for `npm run dev`.

declare global {
  interface Window {
    __OKDP_CONFIG__?: Partial<Pick<OidcConfig, 'authority' | 'clientId'>> &
      Partial<IdentityConfig>;
  }
}

const runtime = (typeof window !== 'undefined' && window.__OKDP_CONFIG__) || {};

// `npm run dev` serves no /config.js, so a source checkout reads the same
// settings from a git-ignored .env.local. Vite inlines these at build time and
// they are absent from a container image, where /config.js is authoritative.
const fromEnv = {
  authority: import.meta.env.VITE_OIDC_AUTHORITY as string | undefined,
  clientId: import.meta.env.VITE_OIDC_CLIENT_ID as string | undefined,
};

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

/** Read from the cluster at startup: the roles of one realm are the groups of
 *  another. rolesClaim must name an ID token claim, dots allowed for a nested
 *  one. */
interface IdentityConfig {
  rolesClaim: string;
  adminRole: string;
}

interface Environment {
  production: boolean;
  apiBaseUrl: string;
  oidc: OidcConfig;
  identity: IdentityConfig;
  githubUrl: string;
}

const development: Environment = {
  production: false,

  // API Configuration
  apiBaseUrl: 'http://localhost:8093',

  oidc: {
    // No hardcoded fallback: a deployment that leaves oidc.authority unset gets
    // a configuration screen, not somebody else's issuer.
    authority: runtime.authority || fromEnv.authority || '',
    clientId: runtime.clientId || fromEnv.clientId || 'okdp-ui',
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    scope: 'openid profile email groups offline_access',
    responseType: 'code',
    silentRenew: true,
    logLevel: 'Debug',
  },

  identity: {
    rolesClaim: runtime.rolesClaim || 'groups',
    adminRole: runtime.adminRole || 'platform_admin',
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
