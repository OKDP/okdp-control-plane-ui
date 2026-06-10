import { Link } from 'react-router-dom';
import { useProjectContext } from '../../../core/context/project-context';
import './project-home.css';

export default function ProjectHome() {
  const context = useProjectContext();
  const project = context.currentProject;

  return (
    <section className="home">
      {project ? (
        <>
          {/* Welcome Banner */}
          <div className="welcome-banner">
            <div className="banner-content">
              <div className="banner-icon">
                <i className="pi pi-th-large"></i>
              </div>
              <div className="banner-text">
                <h1>{project.name}</h1>
                <p className="subtitle">{project.description || 'Project Dashboard'}</p>
              </div>
            </div>
            <div className="banner-decoration"></div>
          </div>

          {/* Quick Actions */}
          <h2 className="section-heading">Quick Actions</h2>
          <div className="quick-actions">
            <Link className="action-card" to={`/project/${project.name}/services/deploy`}>
              <div className="card-icon deploy">
                <i className="pi pi-play"></i>
              </div>
              <div className="action-text">
                <span className="action-title">Deploy Notebook</span>
                <span className="action-desc">Launch a new Jupyter instance</span>
              </div>
              <i className="pi pi-arrow-right action-arrow"></i>
            </Link>
            <Link className="action-card" to={`/project/${project.name}/services`}>
              <div className="card-icon instances">
                <i className="pi pi-server"></i>
              </div>
              <div className="action-text">
                <span className="action-title">View Instances</span>
                <span className="action-desc">Monitor running notebooks</span>
              </div>
              <i className="pi pi-arrow-right action-arrow"></i>
            </Link>
            <Link className="action-card" to={`/project/${project.name}/secret-stores`}>
              <div className="card-icon secrets">
                <i className="pi pi-lock"></i>
              </div>
              <div className="action-text">
                <span className="action-title">Manage Secrets</span>
                <span className="action-desc">Configure secret stores</span>
              </div>
              <i className="pi pi-arrow-right action-arrow"></i>
            </Link>
          </div>
        </>
      ) : context.availableProjects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-wrapper">
            <i className="pi pi-folder-open empty-icon"></i>
          </div>
          <h2>No Projects Available</h2>
          <p>Your workspace is empty. Create your first project to get started.</p>
          <Link to="/admin/projects" className="cta-button">
            <i className="pi pi-plus"></i>
            Create Project
          </Link>
        </div>
      ) : (
        <div className="loading-state">
          <i className="pi pi-spin pi-spinner"></i>
          <p>Loading project...</p>
        </div>
      )}
    </section>
  );
}
