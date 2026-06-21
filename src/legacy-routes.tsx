import { Navigate, Route } from 'react-router-dom';
import { LegacyProjectRedirect } from './legacy-project-redirect';

export function legacyRedirectRoutes() {
  return (
    <>
      <Route path="/admin/projects" element={<Navigate to="/projects" replace />} />
      <Route path="/admin/identity" element={<Navigate to="/identity" replace />} />
      <Route path="/project" element={<Navigate to="/projects" replace />} />
      <Route path="/project/:projectId/*" element={<LegacyProjectRedirect />} />
    </>
  );
}
