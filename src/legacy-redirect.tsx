import { Navigate, useLocation } from 'react-router-dom';

/** Redirects to `to`, carrying over the query string and hash of the legacy link. */
export function LegacyRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}
