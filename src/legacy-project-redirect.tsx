import { Navigate, useLocation, useParams } from 'react-router-dom';

/** Service paths of the pre-rewrite console, paired with their current path. */
const LEGACY_SERVICE_SEGMENTS: readonly (readonly [string, string])[] = [
  ['services', 'jupyterhub'],
  ['lakehouse/polaris', 'polaris'],
  ['lakehouse/trino', 'trino'],
  ['data-engineering/airflow', 'airflow'],
  ['bi/superset', 'superset'],
  ['spark/applications', 'views/spark/applications'],
];

function rewriteLegacyTail(tail: string): string {
  // A trailing slash on the bookmarked link must not ride into the new path,
  // so the redirect target stays canonical (e.g. .../trino, not .../trino/).
  const segment = tail.replace(/\/+$/, '');
  for (const [from, to] of LEGACY_SERVICE_SEGMENTS) {
    if (segment === from) return to;
    if (segment.startsWith(`${from}/`)) return `${to}/${segment.slice(from.length + 1)}`;
  }
  return segment;
}

export function LegacyProjectRedirect() {
  const { projectId, '*': tail = '' } = useParams();
  const { search, hash } = useLocation();
  const base = projectId ? `/projects/${projectId}` : '/projects';
  const rewritten = rewriteLegacyTail(tail);
  const path = rewritten ? `${base}/${rewritten}` : base;
  return <Navigate to={`${path}${search}${hash}`} replace />;
}
