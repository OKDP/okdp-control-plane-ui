import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyRuntimeOidc } from './config/environment';
import { fetchCapabilities } from './core/capabilities/use-capabilities';
// The PrimeReact theme is imported by styles.css: it must load after the
// @layer order declared there, or preflight strips its component styles.
import './styles.css';

// Resolve the platform OIDC client before mounting, so AuthProvider builds the
// UserManager against the right IdP.
async function bootstrap() {
  const capabilities = await fetchCapabilities();
  applyRuntimeOidc(capabilities.identity.oidc);

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
