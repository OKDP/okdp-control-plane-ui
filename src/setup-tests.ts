import '@testing-library/jest-dom/vitest';

// Stands in for the /config.js the container entrypoint writes. Without an
// authority, createUserManager throws.
window.__OKDP_CONFIG__ = {
  authority: 'https://keycloak.test.invalid/realms/test',
  clientId: 'okdp-ui-test',
};
