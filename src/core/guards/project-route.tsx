import { useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useProjectContext } from '../context/project-context';

/**
 * Guard for /projects/:projectId routes: syncs the project context with the
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
