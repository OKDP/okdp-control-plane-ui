import { useProjectContext } from '../../../core/context/project-context';
import WelcomeBanner from '../../../shared/components/welcome-banner';
import SectionHeading from '../../../shared/components/section-heading';
import { ActionCard, QuickActions } from '../../../shared/components/action-card';
import EmptyState from '../../../shared/components/empty-state';
import CtaButton from '../../../shared/components/cta-button';

export default function ProjectHome() {
  const context = useProjectContext();
  const project = context.currentProject;

  return (
    <section className="flex animate-[fadeInUp_0.4s_ease-out] flex-col gap-7">
      {project ? (
        <>
          <WelcomeBanner
            icon="pi pi-th-large"
            title={project.name}
            subtitle={project.description || 'Project Dashboard'}
          />

          <SectionHeading>Quick Actions</SectionHeading>
          <QuickActions>
            <ActionCard
              to={`/project/${project.name}/services/deploy`}
              icon="pi pi-play"
              tone="primary"
              title="Deploy Notebook"
              description="Launch a new Jupyter instance"
            />
            <ActionCard
              to={`/project/${project.name}/services`}
              icon="pi pi-server"
              tone="blue"
              title="View Instances"
              description="Monitor running notebooks"
            />
            <ActionCard
              to={`/project/${project.name}/secret-stores`}
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
            <CtaButton to="/admin/projects" icon="pi pi-plus">
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
