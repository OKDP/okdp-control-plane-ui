import { useEffect, useState } from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useProjectContext } from '../context/project-context';
import { projectApi } from '../api/project-api';

/**
 * Guard for /project/:projectId routes: syncs the project context with the
 * route param before rendering children (projectContextGuard equivalent).
 */
export function ProjectRouteSync() {
  const { projectId } = useParams<{ projectId: string }>();
  const { currentProjectId, setProjectFromRoute } = useProjectContext();

  useEffect(() => {
    if (projectId) {
      setProjectFromRoute(projectId);
    }
  }, [projectId, setProjectFromRoute]);

  // Wait for the context to match the URL before rendering children
  if (projectId && currentProjectId !== projectId) {
    return null;
  }
  return <Outlet />;
}

/**
 * Guard for the bare /project route: redirect to the last selected project,
 * else the first available project, else the admin project list.
 */
export function ProjectIndexRedirect() {
  const { getLastSelectedProjectId } = useProjectContext();
  const [target, setTarget] = useState<string | null>(() => {
    const lastId = getLastSelectedProjectId();
    return lastId ? `/project/${lastId}` : null;
  });

  useEffect(() => {
    if (target) return;
    let cancelled = false;
    projectApi
      .getProjects()
      .then((projects) => {
        if (!cancelled) {
          setTarget(projects.length > 0 ? `/project/${projects[0].name}` : '/admin/projects');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTarget('/admin/projects');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [target]);

  if (!target) {
    return null;
  }
  return <Navigate to={target} replace />;
}
