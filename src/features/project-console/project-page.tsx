import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Dropdown } from 'primereact/dropdown';
import { useAuth } from '../../core/auth/auth-context';
import { useProjectContext } from '../../core/context/project-context';
import { rememberSpace } from '../../core/context/space';
import { SIDEBAR_COLLAPSED_KEY } from '../../core/storage-keys';
import type { Project } from '../../core/api/project-api';
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

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const newState = !collapsed;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newState));
      return newState;
    });
  };

  const projectName = context.currentProject?.name;
  const futureTitle = 'Direction future, non engagé';

  const headerExtras = (
    <>
      {context.availableProjects.length > 0 && (
        /* project-switcher scopes the Dropdown overrides in primereact-overrides.css */
        <div className="project-switcher flex items-center">
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
              <span className="flex items-center gap-2 font-semibold">
                {project ? project.name : 'Select Project'}
              </span>
            )}
            itemTemplate={(project: Project) => (
              <div className="flex flex-col gap-px">
                <span className="font-medium">{project.name}</span>
                {project.description && (
                  <small className="text-xs text-fg-muted">{project.description}</small>
                )}
              </div>
            )}
          />
        </div>
      )}
      {auth.hasRole('admins') && (
        <Link
          to="/admin"
          className="flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-primary px-3 py-[5px] text-sm font-medium text-white no-underline transition-colors duration-250 ease-smooth hover:bg-primary-hover"
          aria-label="Go to Administration"
        >
          <span>Administration</span>
          <i className="pi pi-arrow-right text-sm"></i>
        </Link>
      )}
    </>
  );

  return (
    <ConsoleShell
      collapsed={sidebarCollapsed}
      onToggleCollapsed={toggleSidebar}
      headerExtras={headerExtras}
      navBottomAriaLabel="Project tools"
      nav={
        <>
          <SideNavLink
            to={`/project/${projectName}`}
            end
            icon="pi pi-home"
            label="Home"
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
              to={`/project/${projectName}/lakehouse/polaris`}
              icon="pi pi-table"
              label="Polaris"
              collapsed={sidebarCollapsed}
              sub
            />
            <SideNavLink
              to={`/project/${projectName}/lakehouse/trino`}
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
              to={`/project/${projectName}/data-engineering/airflow`}
              icon="pi pi-sitemap"
              label="Airflow"
              collapsed={sidebarCollapsed}
              sub
            />
            <SideNavLink
              to={`/project/${projectName}/spark/applications`}
              icon="pi pi-play"
              label="Spark Applications"
              collapsed={sidebarCollapsed}
              sub
            />
            <SideNavLink
              to={`/project/${projectName}/spark/history-server`}
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
              to={`/project/${projectName}/services`}
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
              to={`/project/${projectName}/bi/superset`}
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
      }
      navBottom={
        <SideNavLink
          to={`/project/${projectName}/secret-stores`}
          icon="pi pi-lock"
          label="Secrets"
          collapsed={sidebarCollapsed}
        />
      }
    >
      <Outlet />
    </ConsoleShell>
  );
}
