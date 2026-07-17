import { Route } from 'react-router-dom';
import { LegacyRedirect } from './legacy-redirect';
import { LegacyProjectRedirect } from './legacy-project-redirect';

export function legacyRedirectRoutes() {
  return (
    <>
      <Route path="/admin/projects" element={<LegacyRedirect to="/projects" />} />
      <Route path="/admin/identity" element={<LegacyRedirect to="/identity" />} />
      <Route path="/project" element={<LegacyRedirect to="/projects" />} />
      <Route path="/project/:projectId/*" element={<LegacyProjectRedirect />} />
    </>
  );
}
