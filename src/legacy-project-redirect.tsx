import { Navigate, useParams } from 'react-router-dom';

const LEGACY_SERVICE_SEGMENTS: readonly (readonly [string, string])[] = [
  ['services', 'jupyterhub'],
  ['lakehouse/polaris', 'polaris'],
  ['lakehouse/trino', 'trino'],
  ['data-engineering/airflow', 'airflow'],
  ['bi/superset', 'superset'],
  ['spark/applications', 'views/spark/applications'],
];

function rewriteLegacyTail(tail: string): string {
  for (const [from, to] of LEGACY_SERVICE_SEGMENTS) {
    if (tail === from) return to;
    if (tail.startsWith(`${from}/`)) return `${to}/${tail.slice(from.length + 1)}`;
  }
  return tail;
}

export function LegacyProjectRedirect() {
  const { projectId, '*': tail = '' } = useParams();
  const base = projectId ? `/projects/${projectId}` : '/projects';
  const rewritten = rewriteLegacyTail(tail);
  return <Navigate to={rewritten ? `${base}/${rewritten}` : base} replace />;
}
