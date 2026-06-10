import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Avatar } from 'primereact/avatar';
import { Dropdown } from 'primereact/dropdown';
import { Menu } from 'primereact/menu';
import type { MenuItem } from 'primereact/menuitem';
import { useAuth } from '../../core/auth/auth-context';
import { useProjectContext } from '../../core/context/project-context';
import { rememberSpace } from '../../core/context/space';
import { environment } from '../../config/environment';
import { SIDEBAR_COLLAPSED_KEY } from '../../core/storage-keys';
import type { Project } from '../../core/api/project-api';
import './project-page.css';

interface NavSectionProps {
  icon: string;
  label: string;
  expanded: boolean;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function NavSection({ icon, label, expanded, collapsed, onToggle, children }: NavSectionProps) {
  return (
    <div className="nav-section">
      <button
        className="nav-section-header"
        onClick={onToggle}
        title={collapsed ? label : ''}
        type="button"
      >
        <i className={`pi ${icon}`}></i>
        <span>{label}</span>
        <i className={`chevron pi ${expanded ? 'pi-chevron-down' : 'pi-chevron-right'}`}></i>
      </button>
      <div className={`nav-section-items${expanded ? ' expanded' : ''}`}>{children}</div>
    </div>
  );
}

export default function ProjectPage() {
  const auth = useAuth();
  const context = useProjectContext();
  const menuRef = useRef<Menu>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
  );
  const [lakehouseExpanded, setLakehouseExpanded] = useState(true);
  const [dataEngExpanded, setDataEngExpanded] = useState(true);
  const [notebookExpanded, setNotebookExpanded] = useState(true);
  const [sqlBiExpanded, setSqlBiExpanded] = useState(true);
  const [mlExpanded, setMlExpanded] = useState(false);

  useEffect(() => {
    rememberSpace('project');
  }, []);

  const displayName = auth.profile?.firstName ?? auth.profile?.username ?? 'User';
  const first = (auth.profile?.firstName ?? auth.profile?.username ?? '?').charAt(0).toUpperCase();
  const last = (auth.profile?.lastName ?? '').charAt(0).toUpperCase();
  const initials = `${first}${last || ''}`;

  const profileMenu: MenuItem[] = [
    {
      label: 'Sign out',
      icon: 'pi pi-sign-out',
      command: () => auth.logout(),
    },
  ];

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const newState = !collapsed;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newState));
      return newState;
    });
  };

  const projectName = context.currentProject?.name;
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link${isActive ? ' active' : ''}`;
  const subLinkClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link sub-link${isActive ? ' active' : ''}`;
  const title = (label: string) => (sidebarCollapsed ? label : '');

  return (
    <div className="admin-shell">
      {/* Unified header */}
      <header className="main-header">
        <div className="header-left">
          <button
            className="toggle-btn"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <i className={sidebarCollapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'}></i>
          </button>
          <div className="logo-container">
            <img src="/images/okdp-notext.svg" alt="okdp" className="logo" />
            <div className="logo-text">
              <span className="logo-title">okdp</span>
              <span className="logo-subtitle">console</span>
            </div>
          </div>
        </div>

        <div className="header-center">{/* Reserved */}</div>

        <div className="header-right">
          {context.availableProjects.length > 0 && (
            <div className="project-switcher">
              <Dropdown
                value={context.currentProject}
                options={context.availableProjects}
                optionLabel="name"
                dataKey="name"
                placeholder="Select Project"
                className="project-dropdown"
                panelClassName="project-dropdown-panel"
                appendTo={document.body}
                onChange={(e) => context.selectProject((e.value as Project).name)}
                valueTemplate={(project: Project | null) => (
                  <span className="selected-project">
                    {project ? project.name : 'Select Project'}
                  </span>
                )}
                itemTemplate={(project: Project) => (
                  <div className="project-item">
                    <span className="project-name">{project.name}</span>
                    {project.description && (
                      <small className="project-desc">{project.description}</small>
                    )}
                  </div>
                )}
              />
            </div>
          )}
          {auth.hasRole('admins') && (
            <Link to="/admin" className="space-switcher-btn" aria-label="Go to Administration">
              <span>Administration</span>
              <i className="pi pi-arrow-right"></i>
            </Link>
          )}
          <a
            href={environment.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="topbar-btn"
            title="GitHub"
          >
            <i className="pi pi-github"></i>
          </a>

          <div
            className="user-card"
            onClick={(e) => menuRef.current?.toggle(e)}
            tabIndex={0}
            aria-label="User menu"
            role="button"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                menuRef.current?.toggle(e);
              }
            }}
          >
            <Avatar label={initials} shape="circle" size="normal" />
            <div className="user-info">
              <span className="user-name">{displayName}</span>
            </div>
            <i className="pi pi-angle-down"></i>
          </div>
          <Menu ref={menuRef} model={profileMenu} popup />
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
        <nav className="nav">
          <NavLink
            to={`/project/${projectName}`}
            end
            className={navLinkClass}
            title={title('Home')}
          >
            <i className="pi pi-home"></i>
            <span>Home</span>
          </NavLink>

          {/* Lakehouse */}
          <NavSection
            icon="pi-database"
            label="Lakehouse"
            expanded={lakehouseExpanded}
            collapsed={sidebarCollapsed}
            onToggle={() => setLakehouseExpanded((v) => !v)}
          >
            <NavLink
              to={`/project/${projectName}/lakehouse/polaris`}
              className={subLinkClass}
              title={title('Polaris')}
            >
              <i className="pi pi-table"></i>
              <span>Polaris</span>
            </NavLink>
            <NavLink
              to={`/project/${projectName}/lakehouse/trino`}
              className={subLinkClass}
              title={title('Trino')}
            >
              <i className="pi pi-bolt"></i>
              <span>Trino</span>
            </NavLink>
          </NavSection>

          {/* Data Engineering */}
          <NavSection
            icon="pi-cog"
            label="Data Engineering"
            expanded={dataEngExpanded}
            collapsed={sidebarCollapsed}
            onToggle={() => setDataEngExpanded((v) => !v)}
          >
            <NavLink
              to={`/project/${projectName}/data-engineering/airflow`}
              className={subLinkClass}
              title={title('Airflow')}
            >
              <i className="pi pi-sitemap"></i>
              <span>Airflow</span>
            </NavLink>
            <NavLink
              to={`/project/${projectName}/spark/applications`}
              className={subLinkClass}
              title={title('Spark Applications')}
            >
              <i className="pi pi-play"></i>
              <span>Spark Applications</span>
            </NavLink>
            <NavLink
              to={`/project/${projectName}/spark/history-server`}
              className={subLinkClass}
              title={title('Spark History')}
            >
              <i className="pi pi-history"></i>
              <span>Spark History</span>
            </NavLink>
            <span
              className="nav-link sub-link disabled"
              title={sidebarCollapsed ? 'Kafka — exploration' : 'Direction future, non engagé'}
            >
              <i className="pi pi-share-alt"></i>
              <span>Kafka</span>
            </span>
          </NavSection>

          {/* Notebooks */}
          <NavSection
            icon="pi-book"
            label="Notebooks"
            expanded={notebookExpanded}
            collapsed={sidebarCollapsed}
            onToggle={() => setNotebookExpanded((v) => !v)}
          >
            <NavLink
              to={`/project/${projectName}/services`}
              className={subLinkClass}
              title={title('JupyterHub')}
            >
              <i className="pi pi-desktop"></i>
              <span>JupyterHub</span>
            </NavLink>
          </NavSection>

          {/* SQL & BI */}
          <NavSection
            icon="pi-chart-bar"
            label="SQL & BI"
            expanded={sqlBiExpanded}
            collapsed={sidebarCollapsed}
            onToggle={() => setSqlBiExpanded((v) => !v)}
          >
            <NavLink
              to={`/project/${projectName}/bi/superset`}
              className={subLinkClass}
              title={title('Superset')}
            >
              <i className="pi pi-chart-line"></i>
              <span>Superset</span>
            </NavLink>
            <span
              className="nav-link sub-link disabled"
              title={sidebarCollapsed ? 'SQL Editor — exploration' : 'Direction future, non engagé'}
            >
              <i className="pi pi-pencil"></i>
              <span>SQL Editor</span>
            </span>
          </NavSection>

          {/* Machine Learning */}
          <NavSection
            icon="pi-microchip"
            label="Machine Learning"
            expanded={mlExpanded}
            collapsed={sidebarCollapsed}
            onToggle={() => setMlExpanded((v) => !v)}
          >
            <span
              className="nav-link sub-link disabled"
              title={sidebarCollapsed ? 'Kubeflow — exploration' : 'Direction future, non engagé'}
            >
              <i className="pi pi-sitemap"></i>
              <span>Kubeflow</span>
            </span>
            <span
              className="nav-link sub-link disabled"
              title={sidebarCollapsed ? 'MLflow — exploration' : 'Direction future, non engagé'}
            >
              <i className="pi pi-flag"></i>
              <span>MLflow</span>
            </span>
            <span
              className="nav-link sub-link disabled"
              title={sidebarCollapsed ? 'KServe — exploration' : 'Direction future, non engagé'}
            >
              <i className="pi pi-send"></i>
              <span>KServe</span>
            </span>
          </NavSection>
        </nav>

        <nav className="nav-bottom" aria-label="Project tools">
          <NavLink
            to={`/project/${projectName}/secret-stores`}
            className={navLinkClass}
            title={title('Secrets')}
          >
            <i className="pi pi-lock"></i>
            <span>Secrets</span>
          </NavLink>
        </nav>
      </aside>

      {/* Main layout */}
      <div className="main-layout">
        {/* Content */}
        <main className="main-content">
          <div className="content-wrapper">
            <Outlet />
          </div>
        </main>

        {/* Footer */}
        <footer className="main-footer">
          <div className="footer-left">
            <span>© 2026 OKDP. All rights reserved.</span>
          </div>
          <div className="footer-right">
            <span>v1.0.0</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
