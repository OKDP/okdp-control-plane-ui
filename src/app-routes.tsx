import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './core/auth/require-auth';
import { RequireAdmin } from './core/auth/require-admin';
import { ProjectRouteSync } from './core/guards/project-route';

const HomePage = lazy(() => import('./features/landing/home-page'));
const StartPage = lazy(() => import('./features/start/start-page'));
const ProjectList = lazy(() => import('./features/admin/projects/project-list'));
const IdentityPage = lazy(() => import('./features/admin/identity/identity-page'));
const ProjectPage = lazy(() => import('./features/project-console/project-page'));
const ProjectHome = lazy(() => import('./features/project-console/home/project-home'));
const SecretsPage = lazy(() => import('./features/project-console/secret-stores/secrets-page'));
const ServicesPage = lazy(() => import('./features/project-console/services/services-page'));
const ServiceDeployPage = lazy(
  () => import('./features/project-console/services/service-deploy-page'),
);
const ServiceEditPage = lazy(() => import('./features/project-console/services/service-edit-page'));
const ServiceDetailPage = lazy(
  () => import('./features/project-console/services/service-detail-page'),
);
const SparkAppsPage = lazy(() => import('./features/project-console/spark/spark-apps-page'));
const SparkSubmitPage = lazy(() => import('./features/project-console/spark/spark-submit-page'));
const SparkEditPage = lazy(() => import('./features/project-console/spark/spark-edit-page'));
const SparkDetailPage = lazy(() => import('./features/project-console/spark/spark-detail-page'));

/**
 * Service list pages share one component driven by per-route props
 * (the Angular `route.data` equivalent).
 */
interface ServiceRouteData {
  title: string;
  deployLabel: string;
  serviceFilter: string;
  emptyMessage: string;
}

/** Deploy / edit / detail / list route quadruple under a base path. */
function serviceRoutes(basePath: string, data: ServiceRouteData) {
  return (
    <>
      <Route path={`${basePath}/deploy`} element={<ServiceDeployPage />} />
      <Route path={`${basePath}/:serviceName/edit`} element={<ServiceEditPage />} />
      <Route path={`${basePath}/:serviceName`} element={<ServiceDetailPage />} />
      <Route path={basePath} element={<ServicesPage {...data} />} />
    </>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/login" element={<HomePage />} />
        {/* Authenticated entry point: default project, or getting started
            when the platform has no project yet. */}
        <Route
          path="/home"
          element={
            <RequireAuth>
              <StartPage />
            </RequireAuth>
          }
        />

        {/* Single console shell: the project pages, the shared project list
            and the admin-only identity page all render inside it. */}
        <Route
          element={
            <RequireAuth>
              <ProjectPage />
            </RequireAuth>
          }
        >
          <Route
            path="/identity"
            element={
              <RequireAdmin>
                <IdentityPage />
              </RequireAdmin>
            }
          />

          {/* REST-style: /projects is the collection, /projects/:projectId a member. */}
          <Route path="/projects">
            <Route index element={<ProjectList />} />
            <Route path=":projectId" element={<ProjectRouteSync />}>
              <Route index element={<ProjectHome />} />
              <Route path="secret-stores" element={<SecretsPage />} />

              {serviceRoutes('services', {
                title: 'Jupyter Instances',
                deployLabel: 'New instance',
                serviceFilter: 'jupyterhub',
                emptyMessage: 'No Jupyter instances deployed yet.',
              })}

              {serviceRoutes('spark/history-server', {
                title: 'Spark History Server',
                deployLabel: 'Deploy',
                serviceFilter: 'spark-history-server',
                emptyMessage: 'No Spark History Server instances deployed yet.',
              })}

              <Route path="spark/applications/submit" element={<SparkSubmitPage />} />
              <Route path="spark/applications/:appName/edit" element={<SparkEditPage />} />
              <Route path="spark/applications/:appName" element={<SparkDetailPage />} />
              <Route path="spark/applications" element={<SparkAppsPage />} />

              {/* Services on the OKDP roadmap but not yet packaged. */}
              {/* Polaris (Lakehouse / data-catalog) — kubocd Package: polaris@0.1.0 */}
              {serviceRoutes('lakehouse/polaris', {
                title: 'Polaris',
                deployLabel: 'Deploy',
                serviceFilter: 'polaris',
                emptyMessage: 'No Polaris instances deployed yet.',
              })}

              {/* Trino (Lakehouse / data-querying) — kubocd Package: trino@0.1.0 */}
              {serviceRoutes('lakehouse/trino', {
                title: 'Trino',
                deployLabel: 'Deploy',
                serviceFilter: 'trino',
                emptyMessage: 'No Trino instances deployed yet.',
              })}

              {/* Airflow (Data Engineering / orchestration) — kubocd Package: airflow@0.1.0 */}
              {serviceRoutes('data-engineering/airflow', {
                title: 'Airflow',
                deployLabel: 'Deploy',
                serviceFilter: 'airflow',
                emptyMessage: 'No Airflow instances deployed yet.',
              })}

              {/* Superset (SQL & BI / data-visualization) — kubocd Package: superset@0.1.0 */}
              {serviceRoutes('bi/superset', {
                title: 'Superset',
                deployLabel: 'Deploy',
                serviceFilter: 'superset',
                emptyMessage: 'No Superset instances deployed yet.',
              })}
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </Suspense>
  );
}
