/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  /** Latest fetch outcome: set on failure, cleared by the next success. */
  loadError: boolean;
  /** Retry the initial fetch (and re-establish the SSE stream). */
  reload: () => void;
  selectProject: (projectId: string) => void;
  /** Sync the context from a route param without navigating (guard equivalent). */
  setProjectFromRoute: (projectId: string) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectContextProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() =>
    sessionStorage.getItem(STORAGE_KEY),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Flips once the list has genuinely loaded (REST success or first SSE
  // event) — a failed fetch must not be mistaken for "no projects exist".
  const [loaded, setLoaded] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  // Pathname mirrored in a ref so selectProject (and the memoized context
  // value) keeps a stable identity across navigations.
  const pathnameRef = useRef(location.pathname);
  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

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
          setLoaded(true);
          setLoadError(false);
        }
      })
      .catch((err) => {
        logger.error('Fatal error in projects stream', err);
        if (!cancelled) {
          setIsLoading(false);
          setLoadError(true);
        }
      });

    const unsubscribe = projectApi.subscribeProjects({
      next: (event) => {
        setLoaded(true);
        // Data is flowing — a stale REST failure must not keep gating the
        // consistency rescue (or the admin list) for the rest of the session.
        setLoadError(false);
        setAvailableProjects((list) => applyListEvent(list, event, (p) => p.name));
      },
      error: (err) => logger.error('SSE Stream error', err),
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isAuthenticated, reloadToken]);

  const reload = useCallback(() => {
    setIsLoading(true);
    setReloadToken((token) => token + 1);
  }, []);

  const selectProject = useCallback(
    (projectId: string) => {
      if (!projectId) return;

      setCurrentProjectId(projectId);
      sessionStorage.setItem(STORAGE_KEY, projectId);

      // Navigate — preserve the current sub-route (e.g. secret-stores)
      const projectPathMatch = pathnameRef.current.match(/^\/projects\/[^/]+(\/.*)?$/);
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

  // Enforce consistency: selected project disappeared from the list.
  // Skipped until at least one successful load and while the latest fetch
  // failed — a transient error must not destroy the persisted selection.
  useEffect(() => {
    if (isLoading || !loaded || loadError) return;

    if (currentProjectId && !availableProjects.find((p) => p.name === currentProjectId)) {
      logger.warn(`Selected project '${currentProjectId}' is no longer available.`);

      // Only project-scoped pages need rescuing — /admin, /settings, /views…
      // keep working without a URL project and must not be navigated away.
      const onProjectRoute = /^\/projects\/[^/]+/.test(location.pathname);
      if (availableProjects.length === 0) {
        clearContext();
        if (onProjectRoute) {
          navigate('/projects');
        }
      } else if (onProjectRoute) {
        selectProject(availableProjects[0].name);
      } else {
        setProjectFromRoute(availableProjects[0].name);
      }
    }
  }, [
    availableProjects,
    currentProjectId,
    isLoading,
    loaded,
    loadError,
    location.pathname,
    clearContext,
    selectProject,
    setProjectFromRoute,
    navigate,
  ]);

  const value = useMemo<ProjectContextValue>(
    () => ({
      availableProjects,
      currentProjectId,
      currentProject: availableProjects.find((p) => p.name === currentProjectId) || null,
      isLoading,
      loadError,
      reload,
      selectProject,
      setProjectFromRoute,
    }),
    [
      availableProjects,
      currentProjectId,
      isLoading,
      loadError,
      reload,
      selectProject,
      setProjectFromRoute,
    ],
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
