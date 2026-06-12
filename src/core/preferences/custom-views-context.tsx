/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CUSTOM_VIEWS_KEY } from '../storage-keys';

/** A user-created view launcher: an external URL presented as a tile on the
 *  views page and, optionally, as a lateral-menu entry. */
export interface CustomView {
  id: string;
  label: string;
  url: string;
  description?: string;
  /** primeicons class (e.g. "pi pi-chart-line"). */
  icon: string;
  /** Sidebar category (mandatory): an existing lateral-menu category label
   *  merges the view into that section; any other name opens its own. */
  category: string;
  /** Also listed in the views sidebar. */
  inMenu: boolean;
}

type CustomViewsByProject = Record<string, CustomView[]>;

export interface CustomViewsContextValue {
  viewsFor: (projectName: string) => CustomView[];
  addView: (projectName: string, view: Omit<CustomView, 'id'>) => void;
  updateView: (projectName: string, view: CustomView) => void;
  removeView: (projectName: string, id: string) => void;
}

const CustomViewsContext = createContext<CustomViewsContextValue | null>(null);

function storedViews(): CustomViewsByProject {
  try {
    const raw = localStorage.getItem(CUSTOM_VIEWS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CustomViewsByProject;
      // A pre-fix bug could store views under the empty project name.
      delete parsed[''];
      // Views saved before the category became mandatory get a fallback.
      for (const views of Object.values(parsed)) {
        for (const view of views) view.category ||= 'Custom views';
      }
      return parsed;
    }
  } catch {
    // corrupt value — fall back to empty
  }
  return {};
}

const NO_VIEWS: CustomView[] = [];

/** User-created views, keyed by project. Purely client-side for now (the
 *  API is not involved): definitions live in this browser's localStorage and
 *  are not visible to other users. */
export function CustomViewsProvider({ children }: { children: ReactNode }) {
  const [byProject, setByProject] = useState<CustomViewsByProject>(storedViews);

  const mutate = useCallback((projectName: string, fn: (views: CustomView[]) => CustomView[]) => {
    setByProject((prev) => {
      const next = { ...prev, [projectName]: fn(prev[projectName] ?? []) };
      if (next[projectName].length === 0) delete next[projectName];
      localStorage.setItem(CUSTOM_VIEWS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo<CustomViewsContextValue>(
    () => ({
      viewsFor: (projectName) => byProject[projectName] ?? NO_VIEWS,
      addView: (projectName, view) =>
        mutate(projectName, (views) => [...views, { ...view, id: crypto.randomUUID() }]),
      updateView: (projectName, view) =>
        mutate(projectName, (views) => views.map((v) => (v.id === view.id ? view : v))),
      removeView: (projectName, id) =>
        mutate(projectName, (views) => views.filter((v) => v.id !== id)),
    }),
    [byProject, mutate],
  );

  return <CustomViewsContext.Provider value={value}>{children}</CustomViewsContext.Provider>;
}

export function useCustomViews(): CustomViewsContextValue {
  const ctx = useContext(CustomViewsContext);
  if (!ctx) {
    throw new Error('useCustomViews must be used within a CustomViewsProvider');
  }
  return ctx;
}
