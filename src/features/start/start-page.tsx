import { Navigate } from 'react-router-dom';
import { useProjectContext } from '../../core/context/project-context';

/**
 * Authenticated entry point (/home): routes to the default project when one
 * exists, otherwise to the project list, whose empty state walks the user
 * through getting started.
 */
export default function StartPage() {
  const { availableProjects, isLoading, currentProjectId } = useProjectContext();

  if (isLoading) {
    return null;
  }

  if (availableProjects.length > 0) {
    const target =
      availableProjects.find((p) => p.name === currentProjectId) ?? availableProjects[0];
    return <Navigate to={`/projects/${target.name}`} replace />;
  }

  return <Navigate to="/projects" replace />;
}
