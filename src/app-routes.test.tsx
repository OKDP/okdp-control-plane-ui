import { describe, it, expect } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { createRoutesFromElements, matchRoutes, type RouteObject } from 'react-router-dom';
import { AppRoutes } from './app-routes';
import { NAV_CATEGORIES } from './features/project-console/nav-config';

/** Route table declared by AppRoutes. Read from the element tree rather than
 *  rendered: the pages are lazy and the console expects its provider stack. */
function routeTable(): RouteObject[] {
  const suspense = AppRoutes() as ReactElement<{
    children: ReactElement<{ children: ReactNode }>;
  }>;
  return createRoutesFromElements(suspense.props.children.props.children);
}

const routes = routeTable();

/** The `*` catch-all forwards to /home, so a path reaching it is a dead link. */
function reachesAPage(path: string): boolean {
  const matches = matchRoutes(routes, path);
  return matches !== null && matches[matches.length - 1].route.path !== '*';
}

const sidebarSegments = NAV_CATEGORIES.flatMap((category) => category.items)
  .map((item) => item.segment)
  .filter((segment): segment is string => segment !== undefined);

describe('project console routes', () => {
  it.each(sidebarSegments)('serves the %s sidebar entry', (segment) => {
    expect(reachesAPage(`/projects/demo/${segment}`)).toBe(true);
  });

  it('serves the generic area of a catalog service without a bespoke page', () => {
    expect(reachesAPage('/projects/demo/services/seaweedfs')).toBe(true);
  });

  it('sends an unknown project path to the catch-all', () => {
    expect(reachesAPage('/projects/demo/not-a-service')).toBe(false);
  });
});
