import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Project, ProjectEvent } from '../api/project-api';

const mocks = vi.hoisted(() => ({
  getProjects: vi.fn(),
  subscribers: [] as { next: (event: unknown) => void }[],
}));

vi.mock('../api/project-api', () => ({
  projectApi: {
    getProjects: mocks.getProjects,
    subscribeProjects: (subscriber: { next: (event: unknown) => void }) => {
      mocks.subscribers.push(subscriber);
      return () => {
        const idx = mocks.subscribers.indexOf(subscriber);
        if (idx !== -1) mocks.subscribers.splice(idx, 1);
      };
    },
  },
}));

// The provider only fetches while authenticated
vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

import { ProjectContextProvider, useProjectContext } from './project-context';

const mockProjects: Project[] = [
  { name: 'proj-a', description: 'Project A' },
  { name: 'proj-b', description: 'Project B' },
];

let currentPath = '';

function LocationProbe() {
  currentPath = useLocation().pathname;
  return null;
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <ProjectContextProvider>
        <LocationProbe />
        {children}
      </ProjectContextProvider>
    </MemoryRouter>
  );
}

function emitSse(event: ProjectEvent) {
  act(() => {
    for (const subscriber of [...mocks.subscribers]) {
      subscriber.next(event);
    }
  });
}

describe('ProjectContextProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subscribers.length = 0;
    sessionStorage.clear();
    currentPath = '';
    mocks.getProjects.mockResolvedValue(mockProjects);
  });

  it('should load initial projects', async () => {
    const { result } = renderHook(() => useProjectContext(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.availableProjects).toEqual(mockProjects);
  });

  it('should initialize currentProjectId from storage', async () => {
    sessionStorage.setItem('okdp-selected-projectId', 'proj-b');

    const { result } = renderHook(() => useProjectContext(), { wrapper });

    expect(result.current.currentProjectId).toBe('proj-b');
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentProject?.name).toBe('proj-b');
  });

  it('should update state on SSE ADDED event', async () => {
    const { result } = renderHook(() => useProjectContext(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const newProject: Project = { name: 'proj-c', description: 'Project C' };
    emitSse({ type: 'ADDED', object: newProject });

    expect(result.current.availableProjects).toHaveLength(3);
    expect(result.current.availableProjects).toContainEqual(newProject);
  });

  it('should update state on SSE DELETED event', async () => {
    const { result } = renderHook(() => useProjectContext(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    emitSse({ type: 'DELETED', object: { name: 'proj-a' } as Project });

    expect(result.current.availableProjects).toHaveLength(1);
    expect(result.current.availableProjects.find((p) => p.name === 'proj-a')).toBeUndefined();
  });

  describe('Selection & Navigation', () => {
    it('should select project, update storage and navigate', async () => {
      const { result } = renderHook(() => useProjectContext(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.selectProject('proj-a'));

      expect(result.current.currentProjectId).toBe('proj-a');
      expect(sessionStorage.getItem('okdp-selected-projectId')).toBe('proj-a');
      await waitFor(() => expect(currentPath).toBe('/project/proj-a'));
    });
  });

  describe('Consistency effect', () => {
    it('should redirect to admin projects if selected project is deleted and list empty', async () => {
      const { result } = renderHook(() => useProjectContext(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.selectProject('proj-a'));

      emitSse({ type: 'DELETED', object: { name: 'proj-b' } as Project });
      emitSse({ type: 'DELETED', object: { name: 'proj-a' } as Project });

      await waitFor(() => expect(currentPath).toBe('/admin/projects'));
      expect(result.current.currentProjectId).toBeNull();
    });

    it('should switch to fallback project if selected is deleted but others exist', async () => {
      const { result } = renderHook(() => useProjectContext(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.selectProject('proj-a'));

      emitSse({ type: 'DELETED', object: { name: 'proj-a' } as Project });

      await waitFor(() => expect(result.current.currentProjectId).toBe('proj-b'));
      await waitFor(() => expect(currentPath).toBe('/project/proj-b'));
    });
  });
});
