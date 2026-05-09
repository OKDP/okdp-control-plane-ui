import { Routes } from '@angular/router';
import { projectContextGuard } from './core/guards/project-context.guard';
import { authGuard } from './core/auth/auth.guard';

export const appRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/landing/home.page').then((m) => m.HomePage),
  },
  {
    path: 'home',
    redirectTo: 'login',
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () => import('./features/admin/admin.page').then((m) => m.AdminPage),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/admin/home/admin-home.component').then(m => m.AdminHomeComponent),
        pathMatch: 'full'
      },
      {
        path: 'projects',
        loadComponent: () => import('./features/admin/projects/project-list.component').then(m => m.ProjectListComponent)
      },
      {
        path: 'identity',
        loadComponent: () => import('./features/admin/identity/identity.page').then(m => m.IdentityPage)
      }
    ]
  },
  {
    path: 'project',
    canActivate: [authGuard],
    loadComponent: () => import('./features/project-console/project.page').then((m) => m.ProjectPage),
    children: [
      {
        path: ':projectId',
        canActivate: [projectContextGuard],
        children: [
          {
            path: '',
            loadComponent: () => import('./features/project-console/home/project-home.component').then(m => m.ProjectHomeComponent),
            pathMatch: 'full'
          },
          {
            path: 'secret-stores',
            loadComponent: () => import('./features/project-console/secret-stores/secrets-page.component').then(m => m.SecretsPageComponent)
          },
          {
            path: 'services/deploy',
            loadComponent: () => import('./features/project-console/services/service-deploy-page.component').then(m => m.ServiceDeployPageComponent)
          },
          {
            path: 'services/:serviceName/edit',
            loadComponent: () => import('./features/project-console/services/service-edit-page.component').then(m => m.ServiceEditPageComponent)
          },
          {
            path: 'services/:serviceName',
            loadComponent: () => import('./features/project-console/services/service-detail-page.component').then(m => m.ServiceDetailPageComponent)
          },
          {
            path: 'services',
            loadComponent: () => import('./features/project-console/services/services-page.component').then(m => m.ServicesPageComponent),
            data: {
              title: 'Jupyter Instances',
              deployLabel: 'New instance',
              serviceFilter: 'jupyterhub',
              emptyMessage: 'No Jupyter instances deployed yet.'
            }
          },
          {
            path: 'spark/history-server/deploy',
            loadComponent: () => import('./features/project-console/services/service-deploy-page.component').then(m => m.ServiceDeployPageComponent)
          },
          {
            path: 'spark/history-server/:serviceName/edit',
            loadComponent: () => import('./features/project-console/services/service-edit-page.component').then(m => m.ServiceEditPageComponent)
          },
          {
            path: 'spark/history-server/:serviceName',
            loadComponent: () => import('./features/project-console/services/service-detail-page.component').then(m => m.ServiceDetailPageComponent)
          },
          {
            path: 'spark/history-server',
            loadComponent: () => import('./features/project-console/services/services-page.component').then(m => m.ServicesPageComponent),
            data: {
              title: 'Spark History Server',
              deployLabel: 'Deploy',
              serviceFilter: 'spark-history-server',
              emptyMessage: 'No Spark History Server instances deployed yet.'
            }
          },
          {
            path: 'spark/applications/submit',
            loadComponent: () => import('./features/project-console/spark/spark-submit-page.component').then(m => m.SparkSubmitPageComponent)
          },
          {
            path: 'spark/applications/:appName/edit',
            loadComponent: () => import('./features/project-console/spark/spark-edit-page.component').then(m => m.SparkEditPageComponent)
          },
          {
            path: 'spark/applications/:appName',
            loadComponent: () => import('./features/project-console/spark/spark-detail-page.component').then(m => m.SparkDetailPageComponent)
          },
          {
            path: 'spark/applications',
            loadComponent: () => import('./features/project-console/spark/spark-apps-page.component').then(m => m.SparkAppsPageComponent)
          },
          // Placeholder pages — services on the OKDP roadmap but not yet
          // packaged. They share a single component driven by route.data.
          // Polaris (Lakehouse / data-catalog) — kubocd Package: polaris@0.1.0
          {
            path: 'lakehouse/polaris/deploy',
            loadComponent: () => import('./features/project-console/services/service-deploy-page.component').then(m => m.ServiceDeployPageComponent)
          },
          {
            path: 'lakehouse/polaris/:serviceName/edit',
            loadComponent: () => import('./features/project-console/services/service-edit-page.component').then(m => m.ServiceEditPageComponent)
          },
          {
            path: 'lakehouse/polaris/:serviceName',
            loadComponent: () => import('./features/project-console/services/service-detail-page.component').then(m => m.ServiceDetailPageComponent)
          },
          {
            path: 'lakehouse/polaris',
            loadComponent: () => import('./features/project-console/services/services-page.component').then(m => m.ServicesPageComponent),
            data: {
              title: 'Polaris',
              deployLabel: 'Deploy',
              serviceFilter: 'polaris',
              emptyMessage: 'No Polaris instances deployed yet.'
            }
          },
          // Trino (Lakehouse / data-querying) — kubocd Package: trino@0.1.0
          {
            path: 'lakehouse/trino/deploy',
            loadComponent: () => import('./features/project-console/services/service-deploy-page.component').then(m => m.ServiceDeployPageComponent)
          },
          {
            path: 'lakehouse/trino/:serviceName/edit',
            loadComponent: () => import('./features/project-console/services/service-edit-page.component').then(m => m.ServiceEditPageComponent)
          },
          {
            path: 'lakehouse/trino/:serviceName',
            loadComponent: () => import('./features/project-console/services/service-detail-page.component').then(m => m.ServiceDetailPageComponent)
          },
          {
            path: 'lakehouse/trino',
            loadComponent: () => import('./features/project-console/services/services-page.component').then(m => m.ServicesPageComponent),
            data: {
              title: 'Trino',
              deployLabel: 'Deploy',
              serviceFilter: 'trino',
              emptyMessage: 'No Trino instances deployed yet.'
            }
          },
          // Airflow (Data Engineering / orchestration) — kubocd Package: airflow@0.1.0
          {
            path: 'data-engineering/airflow/deploy',
            loadComponent: () => import('./features/project-console/services/service-deploy-page.component').then(m => m.ServiceDeployPageComponent)
          },
          {
            path: 'data-engineering/airflow/:serviceName/edit',
            loadComponent: () => import('./features/project-console/services/service-edit-page.component').then(m => m.ServiceEditPageComponent)
          },
          {
            path: 'data-engineering/airflow/:serviceName',
            loadComponent: () => import('./features/project-console/services/service-detail-page.component').then(m => m.ServiceDetailPageComponent)
          },
          {
            path: 'data-engineering/airflow',
            loadComponent: () => import('./features/project-console/services/services-page.component').then(m => m.ServicesPageComponent),
            data: {
              title: 'Airflow',
              deployLabel: 'Deploy',
              serviceFilter: 'airflow',
              emptyMessage: 'No Airflow instances deployed yet.'
            }
          },
          // Superset (SQL & BI / data-visualization) — kubocd Package: superset@0.1.0
          {
            path: 'bi/superset/deploy',
            loadComponent: () => import('./features/project-console/services/service-deploy-page.component').then(m => m.ServiceDeployPageComponent)
          },
          {
            path: 'bi/superset/:serviceName/edit',
            loadComponent: () => import('./features/project-console/services/service-edit-page.component').then(m => m.ServiceEditPageComponent)
          },
          {
            path: 'bi/superset/:serviceName',
            loadComponent: () => import('./features/project-console/services/service-detail-page.component').then(m => m.ServiceDetailPageComponent)
          },
          {
            path: 'bi/superset',
            loadComponent: () => import('./features/project-console/services/services-page.component').then(m => m.ServicesPageComponent),
            data: {
              title: 'Superset',
              deployLabel: 'Deploy',
              serviceFilter: 'superset',
              emptyMessage: 'No Superset instances deployed yet.'
            }
          }
        ]
      },
      {
        path: '',
        canActivate: [projectContextGuard],
        loadComponent: () => import('./features/project-console/home/project-home.component').then(m => m.ProjectHomeComponent),
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];

