import { Navigate, Route, useLocation } from 'react-router-dom';
import { LegacyProjectRedirect } from './legacy-project-redirect';

/** Carries the query string and hash of the legacy link over to the new path. */
function LegacyRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}

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
