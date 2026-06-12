/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { projectApi, type Project } from '../api/project-api';
import { applyListEvent } from '../api/sse';
import { useAuth } from '../auth/auth-context';
import { PROJECT_STORAGE_KEY as STORAGE_KEY } from '../storage-keys';
import { logger } from '../services/logger';

export interface ProjectContextValue {
  availableProjects: Project[];
  currentProjectId: string | null;
  currentProject: Project | null;
  isLoading: boolean;
  selectProject: (projectId: string) => void;
  /** Sync the context from a route param without navigating (guard equivalent). */
  setProjectFromRoute: (projectId: string) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectContextProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() =>
    sessionStorage.getItem(STORAGE_KEY),
  );
  const [isLoading, setIsLoading] = useState(true);

  // Projects list: initial REST fetch merged with SSE updates. Only while
  // authenticated — the provider is mounted on every route (including the
  // anonymous /login page), and an unauthenticated fetch would 401 and
  // trigger the forced-logout handler.
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;

    projectApi
      .getProjects()
      .then((projects) => {
        if (!cancelled) {
          setAvailableProjects(projects);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        logger.error('Fatal error in projects stream', err);
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    const unsubscribe = projectApi.subscribeProjects({
      next: (event) => setAvailableProjects((list) => applyListEvent(list, event, (p) => p.name)),
      error: (err) => logger.error('SSE Stream error', err),
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isAuthenticated]);

  const selectProject = useCallback(
    (projectId: string) => {
      if (!projectId) return;

      setCurrentProjectId(projectId);
      sessionStorage.setItem(STORAGE_KEY, projectId);

      // Navigate — preserve the current sub-route (e.g. secret-stores)
      const currentUrl = window.location.pathname;
      const projectPathMatch = currentUrl.match(/^\/projects\/[^/]+(\/.*)?$/);
      const subPath = projectPathMatch?.[1] ?? '';
      navigate(`/projects/${projectId}${subPath}`);
    },
    [navigate],
  );

  const setProjectFromRoute = useCallback((projectId: string) => {
    setCurrentProjectId(projectId);
    sessionStorage.setItem(STORAGE_KEY, projectId);
  }, []);

  const clearContext = useCallback(() => {
    setCurrentProjectId(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  // Enforce consistency: selected project disappeared from the list
  useEffect(() => {
    // Do not intervene during initial load
    if (isLoading) return;

    if (currentProjectId && !availableProjects.find((p) => p.name === currentProjectId)) {
      logger.warn(`Selected project '${currentProjectId}' is no longer available.`);

      if (availableProjects.length === 0) {
        clearContext();
        const projectlessPaths = ['/projects', '/identity', '/home'];
        if (!projectlessPaths.some((p) => window.location.pathname.startsWith(p))) {
          navigate('/projects');
        }
      } else {
        selectProject(availableProjects[0].name);
      }
    }
  }, [availableProjects, currentProjectId, isLoading, clearContext, selectProject, navigate]);

  const value = useMemo<ProjectContextValue>(
    () => ({
      availableProjects,
      currentProjectId,
      currentProject: availableProjects.find((p) => p.name === currentProjectId) || null,
      isLoading,
      selectProject,
      setProjectFromRoute,
    }),
    [availableProjects, currentProjectId, isLoading, selectProject, setProjectFromRoute],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error('useProjectContext must be used within a ProjectContextProvider');
  }
  return ctx;
}
