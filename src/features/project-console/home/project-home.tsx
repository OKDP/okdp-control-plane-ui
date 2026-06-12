import { useProjectContext } from '../../../core/context/project-context';
import DeployedServicesSummary from './deployed-services-summary';
import { useProjectServicesSummary } from './use-project-services-summary';
import ProjectKpis from './project-kpis';
import SectionHeading from '../../../shared/components/section-heading';
import { ActionCard, QuickActions } from '../../../shared/components/action-card';
import EmptyState from '../../../shared/components/empty-state';
import CtaButton from '../../../shared/components/cta-button';

export default function ProjectHome() {
  const context = useProjectContext();
  const project = context.currentProject;
  const summary = useProjectServicesSummary(project?.name);

  return (
    <section className="flex animate-[fadeInUp_0.4s_ease-out] flex-col gap-7">
      {project ? (
        <>
          <div>
            <h1>Platform Dashboard</h1>
            {project.description && <p className="page-sub mt-1">{project.description}</p>}
          </div>

          <ProjectKpis summary={summary} />

          <SectionHeading>Deployed services</SectionHeading>
          <DeployedServicesSummary projectId={project.name} summary={summary} />

          <SectionHeading>Quick Actions</SectionHeading>
          <QuickActions>
            <ActionCard
              to={`/projects/${project.name}/jupyterhub/deploy`}
              icon="pi pi-play"
              tone="primary"
              title="Deploy Notebook"
              description="Launch a new JupyterHub instance"
            />
            <ActionCard
              to={`/projects/${project.name}/jupyterhub`}
              icon="pi pi-server"
              tone="blue"
              title="View Instances"
              description="Monitor running notebooks"
            />
            <ActionCard
              to={`/projects/${project.name}/secret-stores`}
              icon="pi pi-lock"
              tone="purple"
              title="Manage Secrets"
              description="Configure secret stores"
            />
          </QuickActions>
        </>
      ) : context.availableProjects.length === 0 ? (
        <EmptyState
          icon="pi pi-folder-open"
          title="No Projects Available"
          description="Your workspace is empty. Create your first project to get started."
          action={
            <CtaButton to="/projects" icon="pi pi-plus">
              Create Project
            </CtaButton>
          }
        />
      ) : (
        <div className="flex items-center gap-2.5 py-7 text-fg-secondary">
          <i className="pi pi-spin pi-spinner text-primary"></i>
          <p>Loading project...</p>
        </div>
      )}
    </section>
  );
}
