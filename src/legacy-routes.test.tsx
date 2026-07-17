import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { legacyRedirectRoutes } from './legacy-routes';

let landedAt = '';
function LocationProbe() {
  const { pathname, search, hash } = useLocation();
  landedAt = `${pathname}${search}${hash}`;
  return null;
}

function resolve(path: string): string {
  landedAt = '';
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {legacyRedirectRoutes()}
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
  return landedAt;
}

describe('legacy URL redirects', () => {
  it('lifts the admin children to the top level', () => {
    expect(resolve('/admin/projects')).toBe('/projects');
    expect(resolve('/admin/identity')).toBe('/identity');
  });

  it('moves the project path from singular to plural', () => {
    expect(resolve('/project')).toBe('/projects');
    expect(resolve('/project/demo')).toBe('/projects/demo');
    expect(resolve('/project/demo/')).toBe('/projects/demo');
  });

  it('keeps unchanged project sub-paths', () => {
    expect(resolve('/project/demo/secret-stores')).toBe('/projects/demo/secret-stores');
    expect(resolve('/project/demo/spark/history-server')).toBe(
      '/projects/demo/spark/history-server',
    );
  });

  it('rewrites the renamed service segments', () => {
    expect(resolve('/project/demo/services')).toBe('/projects/demo/jupyterhub');
    expect(resolve('/project/demo/lakehouse/trino')).toBe('/projects/demo/trino');
    expect(resolve('/project/demo/lakehouse/polaris')).toBe('/projects/demo/polaris');
    expect(resolve('/project/demo/data-engineering/airflow')).toBe('/projects/demo/airflow');
    expect(resolve('/project/demo/bi/superset')).toBe('/projects/demo/superset');
    expect(resolve('/project/demo/spark/applications')).toBe(
      '/projects/demo/views/spark/applications',
    );
  });

  it('keeps the query string and hash of a bookmarked link', () => {
    expect(resolve('/admin/projects?tab=quotas#top')).toBe('/projects?tab=quotas#top');
    expect(resolve('/project?sort=name')).toBe('/projects?sort=name');
    expect(resolve('/project/demo/lakehouse/trino?tab=config#logs')).toBe(
      '/projects/demo/trino?tab=config#logs',
    );
  });

  it('preserves the deep tail after a renamed segment', () => {
    expect(resolve('/project/demo/lakehouse/trino/my-trino')).toBe('/projects/demo/trino/my-trino');
    expect(resolve('/project/demo/services/my-jh/edit')).toBe(
      '/projects/demo/jupyterhub/my-jh/edit',
    );
    expect(resolve('/project/demo/spark/applications/app-1/edit')).toBe(
      '/projects/demo/views/spark/applications/app-1/edit',
    );
  });
});
