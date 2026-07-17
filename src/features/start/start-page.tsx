import { Navigate } from 'react-router-dom';
import { useProjectContext } from '../../core/context/project-context';
import { useAuth } from '../../core/auth/auth-context';

/**
 * Authenticated entry point (/home): routes an admin to the admin area, else to
 * the default project when one exists, otherwise to the project list, whose
 * empty state walks the user through getting started.
 */
export default function StartPage() {
  const { availableProjects, isLoading, currentProjectId } = useProjectContext();
  const auth = useAuth();

  // Checked before isLoading so an admin lands without waiting for project data.
  if (auth.hasRole('admins')) {
    return <Navigate to="/admin" replace />;
  }

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
