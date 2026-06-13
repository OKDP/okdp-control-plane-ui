/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import pkg from './package.json';

// Dev server stays on the Angular CLI port (4200) so the OIDC redirect URIs
// registered with the identity provider keep working.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 4200,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setup-tests.ts'],
  },
});
