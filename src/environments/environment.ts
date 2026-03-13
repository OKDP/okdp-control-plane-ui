// Development environment configuration
export const environment = {
    production: false,

    // API Configuration
    apiBaseUrl: 'http://localhost:8093',

    // OIDC Configuration - values from original app.config.ts
    oidc: {
        authority: 'https://kubauth.okdp.dev-sandbox',
        clientId: 'okdp-app',
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
        scope: 'openid profile email groups offline_access',
        responseType: 'code',
        silentRenew: true,
        useRefreshToken: true,
        logLevel: 'Debug',
    },

    // External Links
    githubUrl: 'https://github.com/okdp',
};
