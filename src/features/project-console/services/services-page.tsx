import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { areaBasePath, parentLabel } from './service-utils';
import { ServiceList } from './service-list';
import { PageHeader } from '../../../shared/components/page-header';

export interface ServicesPageProps {
  title?: string;
  subtitle?: string;
  deployLabel?: string;
  serviceFilter?: string;
  emptyMessage?: string;
  emptyTitle?: string;
  breadcrumbParent?: string;
  breadcrumbCurrent?: string;
}

interface ServiceAreaCopy {
  breadcrumbParent: string;
  subtitle: string;
  emptyTitle: string;
}

// Page copy per service area. Labels and the area base path (used so the
// sidebar highlights the correct entry — otherwise anything under
// /jupyterhub/* lights up the JupyterHub link, even when the user clicked
// Deploy from the Spark History Server page) come from the SERVICE_AREAS
// registry in service-utils.
function areaCopy(serviceFilter: string): ServiceAreaCopy {
  switch (serviceFilter) {
    case 'jupyterhub':
      return {
        breadcrumbParent: 'Notebooks',
        subtitle:
          "Launch and manage per-user JupyterLab environments running in this project's namespace.",
        emptyTitle: 'Deploy JupyterHub',
      };
    case 'spark-history-server':
      return {
        breadcrumbParent: 'Spark',
        subtitle: 'Browse completed Spark applications and stream live job monitoring UIs.',
        emptyTitle: 'Deploy a Spark History Server',
      };
    case 'trino':
      return {
        breadcrumbParent: 'Lakehouse',
        subtitle:
          'Distributed SQL query engine. Query data across the lakehouse and federated sources.',
        emptyTitle: 'Deploy Trino',
      };
    case 'polaris':
      return {
        breadcrumbParent: 'Lakehouse',
        subtitle: 'Iceberg-native data catalog. Centralize table metadata across engines.',
        emptyTitle: 'Deploy Polaris',
      };
    case 'superset':
      return {
        breadcrumbParent: 'SQL & BI',
        subtitle: 'Open-source dashboarding and ad-hoc data exploration.',
        emptyTitle: 'Deploy Superset',
      };
    case 'airflow':
      return {
        breadcrumbParent: 'Data Engineering',
        subtitle: 'Workflow orchestrator. Schedule and monitor data pipelines as DAGs.',
        emptyTitle: 'Deploy Airflow',
      };
    default:
      return {
        breadcrumbParent: 'Services',
        subtitle: '',
        emptyTitle: 'No instances yet',
      };
  }
}

export default function ServicesPage(props: ServicesPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams<{ projectId: string }>();

  const serviceFilter = props.serviceFilter || '';
  const copy = areaCopy(serviceFilter);
  const basePath = areaBasePath(serviceFilter);

  const title = props.title || 'Service instances';
  const deployLabel = props.deployLabel || 'New instance';
  const emptyMessage = props.emptyMessage || 'No instances deployed yet.';
  const subtitle = props.subtitle || copy.subtitle;
  const emptyTitle = props.emptyTitle || copy.emptyTitle;
  const breadcrumbParent = props.breadcrumbParent || copy.breadcrumbParent;
  const breadcrumbCurrent =
    props.breadcrumbCurrent || (serviceFilter ? parentLabel(serviceFilter) : 'Instances');

  const goToDeploy = () => {
    if (!projectId) return;

    const params = new URLSearchParams({ returnTo: location.pathname + location.search });
    if (serviceFilter) {
      params.set('service', serviceFilter);
    }
    navigate(`/projects/${projectId}/${basePath.join('/')}/deploy?${params.toString()}`);
  };

  return (
    <div className="services-list animate-in">
      <PageHeader
        breadcrumb={{ parent: breadcrumbParent, current: breadcrumbCurrent }}
        title={title}
        subtitle={subtitle}
        actions={
          <button className="create-btn" onClick={goToDeploy}>
            <i className="pi pi-plus"></i>
            <span>{deployLabel}</span>
          </button>
        }
      />

      <ServiceList
        serviceFilter={serviceFilter}
        emptyMessage={emptyMessage}
        emptyTitle={emptyTitle}
        basePath={basePath}
        onDeploy={goToDeploy}
      />
    </div>
  );
}
