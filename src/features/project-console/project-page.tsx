import { useRef, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Dropdown } from 'primereact/dropdown';
import { useAuth } from '../../core/auth/auth-context';
import { useProjectContext } from '../../core/context/project-context';
import { SIDEBAR_COLLAPSED_KEY } from '../../core/storage-keys';
import type { Project } from '../../core/api/project-api';
import { getProjectColor } from '../../core/services/project-colors';
import { ConsoleShell, SideNavLink } from '../../shared/components/console-shell';
import {
  sideNavIconClass,
  sideNavLabelClass,
  sideNavLinkClass,
} from '../../shared/components/console-nav-classes';

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
    <div className="mt-1">
      <button
        className={`group flex w-full cursor-pointer items-center border-0 bg-transparent text-base font-medium text-fg-secondary transition-[color,background-color] duration-150 ease-smooth hover:bg-surface-secondary hover:text-fg ${
          collapsed
            ? 'justify-center border-l-0 p-2'
            : 'rounded-r-md border-l-2 border-l-transparent px-2.5 py-1.5'
        }`}
        onClick={onToggle}
        title={collapsed ? label : ''}
        type="button"
      >
        <i
          className={`pi ${icon} w-[18px] text-center text-[1rem] text-fg-muted transition-colors duration-150 ease-smooth group-hover:text-fg-secondary`}
        ></i>
        <span className={sideNavLabelClass(collapsed)}>{label}</span>
        <i
          className={`pi ${expanded ? 'pi-chevron-down' : 'pi-chevron-right'} ml-auto text-[0.6rem] text-fg-muted transition-transform duration-250 ease-smooth ${
            collapsed ? 'hidden' : ''
          }`}
        ></i>
      </button>
      {/* Bumped from 200px — Data Engineering holds 4 sub-items and Machine
          Learning 3, all of which need to fit when expanded. */}
      <div
        className={`overflow-hidden [transition:max-height_0.25s_ease] ${
          expanded ? 'max-h-[320px]' : 'max-h-0'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

interface DisabledNavLinkProps {
  icon: string;
  label: string;
  collapsed: boolean;
  title: string;
  collapsedTitle: string;
}

/** "Exploration" placeholder rendered as <span> instead of <a>: visible in
 *  the menu but inert. Tooltip carries the rationale. */
function DisabledNavLink({ icon, label, collapsed, title, collapsedTitle }: DisabledNavLinkProps) {
  return (
    <span
      className={sideNavLinkClass({ collapsed, sub: true, disabled: true })}
      title={collapsed ? collapsedTitle : title}
    >
      <i className={`${icon} ${sideNavIconClass(false)}`}></i>
      <span className={sideNavLabelClass(collapsed)}>{label}</span>
    </span>
  );
}

export default function ProjectPage() {
  const auth = useAuth();
  const context = useProjectContext();
  const switcherRef = useRef<Dropdown>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
  );
  const [lakehouseExpanded, setLakehouseExpanded] = useState(true);
  const [dataEngExpanded, setDataEngExpanded] = useState(true);
  const [notebookExpanded, setNotebookExpanded] = useState(true);
  const [sqlBiExpanded, setSqlBiExpanded] = useState(true);
  const [mlExpanded, setMlExpanded] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const newState = !collapsed;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newState));
      return newState;
    });
  };

  const projectName = context.currentProject?.name;
  const envColor = projectName ? getProjectColor(projectName) : undefined;
  const futureTitle = 'Direction future, non engagé';

  const headerLeft = context.availableProjects.length > 0 && (
    /* project-switcher scopes the Dropdown overrides in the PrimeReact overrides section of styles.css */
    <div className="project-switcher flex items-center">
      <Dropdown
        ref={switcherRef}
        value={context.currentProject}
        options={context.availableProjects}
        optionLabel="name"
        dataKey="name"
        placeholder="Select Project"
        className="project-dropdown"
        panelClassName="project-dropdown-panel"
        appendTo={document.body}
        style={
          envColor
            ? {
                background: `color-mix(in srgb, ${envColor} 14%, transparent)`,
                border: `1px solid color-mix(in srgb, ${envColor} 50%, transparent)`,
              }
            : undefined
        }
        onChange={(e) => context.selectProject((e.value as Project).name)}
        valueTemplate={(project: Project | null) => (
          <span className="flex items-center gap-2 font-semibold">
            {project && (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: getProjectColor(project.name) }}
              ></span>
            )}
            {project ? project.name : 'Select Project'}
          </span>
        )}
        itemTemplate={(project: Project) => (
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: getProjectColor(project.name) }}
            ></span>
            <div className="flex flex-col gap-px">
              <span className="font-medium">{project.name}</span>
              {project.description && (
                <small className="text-xs text-fg-muted">{project.description}</small>
              )}
            </div>
          </div>
        )}
        panelFooterTemplate={() => (
          <Link
            to="/projects"
            className="flex items-center gap-2 border-t border-border-light px-4 py-2.5 text-sm font-medium text-fg-secondary no-underline transition-colors duration-150 ease-smooth hover:bg-surface-secondary hover:text-fg"
            onClick={() => switcherRef.current?.hide()}
          >
            <i className="pi pi-th-large text-[0.85rem]"></i>
            All projects
          </Link>
        )}
      />
    </div>
  );

  const isAdmin = auth.hasRole('admins');

  return (
    <ConsoleShell
      collapsed={sidebarCollapsed}
      onToggleCollapsed={toggleSidebar}
      headerLeft={headerLeft}
      accentColor={envColor}
      navBottomAriaLabel="Project tools"
      nav={
        <>
          {projectName && (
            <>
              <SideNavLink
                to={`/projects/${projectName}`}
                end
                icon="pi pi-objects-column"
                label="Overview"
                collapsed={sidebarCollapsed}
              />

              {/* Lakehouse */}
              <NavSection
                icon="pi-database"
                label="Lakehouse"
                expanded={lakehouseExpanded}
                collapsed={sidebarCollapsed}
                onToggle={() => setLakehouseExpanded((v) => !v)}
              >
                <SideNavLink
                  to={`/projects/${projectName}/lakehouse/polaris`}
                  icon="pi pi-table"
                  label="Polaris"
                  collapsed={sidebarCollapsed}
                  sub
                />
                <SideNavLink
                  to={`/projects/${projectName}/lakehouse/trino`}
                  icon="pi pi-bolt"
                  label="Trino"
                  collapsed={sidebarCollapsed}
                  sub
                />
              </NavSection>

              {/* Data Engineering */}
              <NavSection
                icon="pi-cog"
                label="Data Engineering"
                expanded={dataEngExpanded}
                collapsed={sidebarCollapsed}
                onToggle={() => setDataEngExpanded((v) => !v)}
              >
                <SideNavLink
                  to={`/projects/${projectName}/data-engineering/airflow`}
                  icon="pi pi-sitemap"
                  label="Airflow"
                  collapsed={sidebarCollapsed}
                  sub
                />
                <SideNavLink
                  to={`/projects/${projectName}/spark/applications`}
                  icon="pi pi-play"
                  label="Spark Applications"
                  collapsed={sidebarCollapsed}
                  sub
                />
                <SideNavLink
                  to={`/projects/${projectName}/spark/history-server`}
                  icon="pi pi-history"
                  label="Spark History"
                  collapsed={sidebarCollapsed}
                  sub
                />
                <DisabledNavLink
                  icon="pi pi-share-alt"
                  label="Kafka"
                  collapsed={sidebarCollapsed}
                  title={futureTitle}
                  collapsedTitle="Kafka — exploration"
                />
              </NavSection>

              {/* Notebooks */}
              <NavSection
                icon="pi-book"
                label="Notebooks"
                expanded={notebookExpanded}
                collapsed={sidebarCollapsed}
                onToggle={() => setNotebookExpanded((v) => !v)}
              >
                <SideNavLink
                  to={`/projects/${projectName}/services`}
                  icon="pi pi-desktop"
                  label="JupyterHub"
                  collapsed={sidebarCollapsed}
                  sub
                />
              </NavSection>

              {/* SQL & BI */}
              <NavSection
                icon="pi-chart-bar"
                label="SQL & BI"
                expanded={sqlBiExpanded}
                collapsed={sidebarCollapsed}
                onToggle={() => setSqlBiExpanded((v) => !v)}
              >
                <SideNavLink
                  to={`/projects/${projectName}/bi/superset`}
                  icon="pi pi-chart-line"
                  label="Superset"
                  collapsed={sidebarCollapsed}
                  sub
                />
                <DisabledNavLink
                  icon="pi pi-pencil"
                  label="SQL Editor"
                  collapsed={sidebarCollapsed}
                  title={futureTitle}
                  collapsedTitle="SQL Editor — exploration"
                />
              </NavSection>

              {/* Machine Learning */}
              <NavSection
                icon="pi-microchip"
                label="Machine Learning"
                expanded={mlExpanded}
                collapsed={sidebarCollapsed}
                onToggle={() => setMlExpanded((v) => !v)}
              >
                <DisabledNavLink
                  icon="pi pi-sitemap"
                  label="Kubeflow"
                  collapsed={sidebarCollapsed}
                  title={futureTitle}
                  collapsedTitle="Kubeflow — exploration"
                />
                <DisabledNavLink
                  icon="pi pi-flag"
                  label="MLflow"
                  collapsed={sidebarCollapsed}
                  title={futureTitle}
                  collapsedTitle="MLflow — exploration"
                />
                <DisabledNavLink
                  icon="pi pi-send"
                  label="KServe"
                  collapsed={sidebarCollapsed}
                  title={futureTitle}
                  collapsedTitle="KServe — exploration"
                />
              </NavSection>
            </>
          )}
        </>
      }
      navBottom={
        (projectName || isAdmin) && (
          <>
            {projectName && (
              <SideNavLink
                to={`/projects/${projectName}/secret-stores`}
                icon="pi pi-lock"
                label="Secrets"
                collapsed={sidebarCollapsed}
              />
            )}
            {isAdmin && (
              <>
                {sidebarCollapsed ? (
                  <div className="mx-1 my-2 border-t border-border-light"></div>
                ) : (
                  <div className="mt-3 mb-1 px-2.5 text-[0.65rem] font-bold tracking-[0.08em] text-fg-muted uppercase">
                    Admin
                  </div>
                )}
                <SideNavLink
                  to="/identity"
                  icon="pi pi-users"
                  label="Identity"
                  collapsed={sidebarCollapsed}
                />
              </>
            )}
          </>
        )
      }
    >
      <Outlet />
    </ConsoleShell>
  );
}
