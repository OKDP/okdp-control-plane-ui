import { useRef, useState } from 'react';
import { Link, Outlet, useMatch } from 'react-router-dom';
import { Dropdown } from 'primereact/dropdown';
import { useProjectContext } from '../../core/context/project-context';
import { useNavPrefs } from '../../core/preferences/nav-prefs-context';
import { useCustomViews, type CustomView } from '../../core/preferences/custom-views-context';
import { NAV_EXPANDED_KEY, SIDEBAR_COLLAPSED_KEY } from '../../core/storage-keys';
import type { Project } from '../../core/api/project-api';
import { getProjectColor, useProjectColorsVersion } from '../../core/services/project-colors';
import { ConsoleShell, SideNavLink } from '../../shared/components/console-shell';
import {
  sideNavIconClass,
  sideNavLabelClass,
  sideNavLinkClass,
} from '../../shared/components/console-nav-classes';
import { NAV_CATEGORIES, navItemIcon, type NavCategory } from './nav-config';
import {
  BUILT_IN_VIEWS,
  builtInViewIcon,
  launcherUrl,
  uiServiceLaunchers,
  uiServiceViewIcon,
} from '../custom-views/views-config';
import { useViewServices } from '../custom-views/use-view-services';

/** Per-category unfold overrides persisted across reloads; categories absent
 *  from the record keep their default. */
function storedExpanded(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NAV_EXPANDED_KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    // corrupt value — fall back to defaults
  }
  return {};
}

interface NavSectionProps {
  icon: string;
  label: string;
  expanded: boolean;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function NavSection({ icon, label, expanded, collapsed, onToggle, children }: NavSectionProps) {
  // Collapsed rail: no room for an unfoldable tree — the category reduces
  // to a separator and its services stay visible as icons.
  if (collapsed) {
    return (
      <div className="mt-1">
        <div
          className="mx-1 my-2 border-t border-border-light"
          title={label}
          aria-hidden="true"
        ></div>
        {children}
      </div>
    );
  }

  return (
    <div className="mt-1">
      <button
        className="group flex w-full cursor-pointer items-center rounded-r-md border-0 border-l-2 border-l-transparent bg-transparent px-2.5 py-[calc(0.375rem*var(--nav-item-scale,1))] text-[length:calc(var(--db-font-size-base)*var(--nav-item-scale,1))] font-medium text-fg-secondary transition-[color,background-color] duration-150 ease-smooth hover:bg-surface-secondary hover:text-fg"
        onClick={onToggle}
        type="button"
      >
        <i
          className={`pi ${icon} w-[calc(18px*var(--nav-item-scale,1))] text-center text-[length:calc(1rem*var(--nav-item-scale,1))] text-fg-muted transition-colors duration-150 ease-smooth group-hover:text-fg-secondary`}
        ></i>
        <span className={sideNavLabelClass(false)}>{label}</span>
        <i
          className={`pi ${expanded ? 'pi-chevron-down' : 'pi-chevron-right'} ml-auto text-[length:calc(0.6rem*var(--nav-item-scale,1))] text-fg-muted transition-transform duration-250 ease-smooth`}
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
  icon: React.ReactNode;
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
      {typeof icon === 'string' ? <i className={`${icon} ${sideNavIconClass(false)}`}></i> : icon}
      <span className={sideNavLabelClass(collapsed)}>{label}</span>
    </span>
  );
}

interface ExternalNavLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  title: string;
}

/** Views-sidebar launcher: opens a deployed service UI in a new tab — the
 *  sidebar twin of the page's "Open" tiles. */
function ExternalNavLink({ href, icon, label, collapsed, title }: ExternalNavLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={sideNavLinkClass({ collapsed, sub: true })}
      title={collapsed ? label : title}
    >
      {typeof icon === 'string' ? <i className={`${icon} ${sideNavIconClass(false)}`}></i> : icon}
      <span className={sideNavLabelClass(collapsed)}>{label}</span>
      {!collapsed && (
        <i className="pi pi-external-link ml-auto text-[length:calc(0.6rem*var(--nav-item-scale,1))] text-fg-muted max-lg:hidden"></i>
      )}
    </a>
  );
}

interface WorldSwitcherProps {
  projectName: string;
  world: 'platform' | 'views';
  collapsed: boolean;
}

/** Segmented platform ↔ views switcher at the head of the tree. It doubles
 *  as the world-root link (replacing separate dashboard / All views
 *  entries): the raised segment is the current world and clicks back to its
 *  root, the muted one switches worlds — both always visible, no
 *  flipping-label ambiguity, no icon duplicated elsewhere in the rail. On
 *  the collapsed rail it stacks vertically, icons only, so the raised
 *  segment keeps marking the current world instead of the rail showing the
 *  destination icon alone (which read as the wrong current world). */
function WorldSwitcher({ projectName, world, collapsed }: WorldSwitcherProps) {
  const segments = [
    {
      key: 'platform' as const,
      label: 'Platform',
      // Administrative management of the platform.
      icon: 'pi pi-sitemap',
      to: `/projects/${projectName}`,
      rootTitle: 'Platform dashboard',
    },
    {
      key: 'views' as const,
      label: 'Views',
      // User-facing portal of service UIs.
      icon: 'pi pi-window-maximize',
      to: `/projects/${projectName}/views`,
      rootTitle: 'All views',
    },
  ];

  // The collapsed-state classes also cover the max-lg viewport, where the
  // grid forces the collapsed rail while `collapsed` (the user toggle) may
  // still be false — same dual-state handling as sideNavLinkClass.
  return (
    <div
      className={`flex gap-0.5 rounded-md border border-border-light bg-surface-secondary p-0.5 ${
        collapsed ? 'flex-col' : 'mx-1.5 max-lg:mx-0 max-lg:flex-col'
      }`}
    >
      {segments.map((segment) => {
        const active = segment.key === world;
        return (
          <Link
            key={segment.key}
            to={segment.to}
            aria-current={active ? 'true' : undefined}
            title={active ? segment.rootTitle : `Switch to ${segment.label}`}
            className={[
              'flex items-center justify-center rounded-[7px] no-underline',
              collapsed
                ? 'p-[calc(0.5rem*var(--nav-item-scale,1))]'
                : 'flex-1 gap-1.5 px-2 py-[calc(0.375rem*var(--nav-item-scale,1))] text-[length:calc(var(--db-font-size-sm)*var(--nav-item-scale,1))] max-lg:flex-none max-lg:gap-0 max-lg:p-[calc(0.5rem*var(--nav-item-scale,1))]',
              active
                ? 'bg-surface font-semibold text-fg shadow-xs'
                : 'font-medium text-fg-muted transition-colors duration-150 ease-smooth hover:bg-surface hover:text-fg',
            ].join(' ')}
          >
            <i
              className={`${segment.icon} ${
                collapsed
                  ? 'text-[length:calc(1rem*var(--nav-item-scale,1))]'
                  : 'text-[length:calc(0.8rem*var(--nav-item-scale,1))] max-lg:text-[length:calc(1rem*var(--nav-item-scale,1))]'
              }`}
            ></i>
            <span className={collapsed ? 'hidden' : 'max-lg:hidden'}>{segment.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export default function ProjectPage() {
  const context = useProjectContext();
  const { isNavItemHidden } = useNavPrefs();
  const { viewsFor } = useCustomViews();
  const switcherRef = useRef<Dropdown>(null);

  // Entries hidden by default or from the user's settings drop out of the
  // menu (fixed categories are exempt); a category left empty disappears
  // entirely — no header, no collapsed-rail separator.
  const visibleCategories = NAV_CATEGORIES.map((category) =>
    category.fixed
      ? category
      : {
          ...category,
          items: category.items.filter((i) => !isNavItemHidden(i.label, i.defaultHidden)),
        },
  ).filter((category) => category.items.length > 0);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>(storedExpanded);

  const isExpanded = (category: NavCategory) => expanded[category.key] ?? category.defaultExpanded;

  const toggleCategory = (category: NavCategory) => {
    setExpanded((prev) => {
      const next = { ...prev, [category.key]: !(prev[category.key] ?? category.defaultExpanded) };
      localStorage.setItem(NAV_EXPANDED_KEY, JSON.stringify(next));
      return next;
    });
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const newState = !collapsed;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newState));
      return newState;
    });
  };

  // Two project-scoped worlds share the shell: the console (project tree
  // sidebar) and the views world under /projects/:projectId/views (views
  // tree sidebar). Every other page (/projects, /identity, …) gets an empty
  // sidebar even while a project is still selected in the context.
  const viewsMatch = useMatch('/projects/:projectId/views/*');
  const viewsIndexMatch = useMatch('/projects/:projectId/views');
  const projectMatch = useMatch('/projects/:projectId/*');
  const onViewsWorld = viewsMatch !== null || viewsIndexMatch !== null;
  const onProjectConsole = projectMatch !== null && !onViewsWorld;

  const projectName = context.currentProject?.name;

  // Deployed instances backing the views sidebar and, via outlet context,
  // the views pages themselves — one fetch + SSE stream for both.
  const viewServices = useViewServices(onViewsWorld ? projectName : undefined);
  // Header accent and switcher follow color edits made in Project Settings.
  useProjectColorsVersion();
  // The accent keys on the URL param when present: it's known on the first
  // frame, while `currentProject` waits for the projects list to load.
  const accentProject = projectMatch?.params.projectId ?? projectName;
  const envColor = accentProject ? getProjectColor(accentProject) : undefined;
  const futureTitle = 'Direction future, non engagé';

  // Views sidebar content: the lateral menu's categories, but holding the
  // /views tiles — external launchers for deployed UI services plus the
  // built-in views. Categories with nothing to show disappear.
  const allLaunchers = uiServiceLaunchers(viewServices.instances);
  // With several instances of one service, the instance name disambiguates
  // (counted per view label — a service may carry several views).
  const launcherCounts = new Map<string, number>();
  for (const { view } of allLaunchers) {
    launcherCounts.set(view.label, (launcherCounts.get(view.label) ?? 0) + 1);
  }
  // User-created views flagged for the menu, slotted by their (mandatory)
  // category: a lateral-menu category label merges them into that section,
  // any other name opens its own trailing section.
  const menuCustomViews = (projectName ? viewsFor(projectName) : []).filter((v) => v.inMenu);
  const matchesCategory = (viewCategory: string, label: string) =>
    viewCategory.trim().toLowerCase() === label.toLowerCase();

  const viewCategories = NAV_CATEGORIES.map((category) => ({
    category,
    launchers: allLaunchers.filter(({ view }) => view.categoryKey === category.key),
    builtInViews: BUILT_IN_VIEWS.filter((view) => view.categoryKey === category.key),
    customViews: menuCustomViews.filter((v) => matchesCategory(v.category, category.label)),
  })).filter(
    (entry) => entry.launchers.length + entry.builtInViews.length + entry.customViews.length > 0,
  );

  const extraViewCategories: { category: NavCategory; customViews: CustomView[] }[] = [];
  for (const view of menuCustomViews) {
    if (NAV_CATEGORIES.some((c) => matchesCategory(view.category, c.label))) continue;
    const label = view.category.trim();
    const entry = extraViewCategories.find((e) => matchesCategory(label, e.category.label));
    if (entry) {
      entry.customViews.push(view);
    } else {
      extraViewCategories.push({
        category: {
          key: `custom:${label.toLowerCase()}`,
          label,
          icon: 'pi-bookmark',
          defaultExpanded: true,
          items: [],
        },
        customViews: [view],
      });
    }
  }

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
            <i className="pi pi-folder-open text-[0.85rem]"></i>
            All projects
          </Link>
        )}
      />
    </div>
  );

  return (
    <ConsoleShell
      collapsed={sidebarCollapsed}
      onToggleCollapsed={toggleSidebar}
      headerLeft={headerLeft}
      accentColor={envColor}
      nav={
        projectName && onProjectConsole ? (
          <>
            <WorldSwitcher
              projectName={projectName}
              world="platform"
              collapsed={sidebarCollapsed}
            />

            {visibleCategories.map((category) => (
              <NavSection
                key={category.key}
                icon={category.icon}
                label={category.label}
                expanded={isExpanded(category)}
                collapsed={sidebarCollapsed}
                onToggle={() => toggleCategory(category)}
              >
                {category.items.map((item) =>
                  item.disabled ? (
                    <DisabledNavLink
                      key={item.label}
                      icon={navItemIcon(item)}
                      label={item.label}
                      collapsed={sidebarCollapsed}
                      title={futureTitle}
                      collapsedTitle={item.collapsedTitle ?? item.label}
                    />
                  ) : (
                    <SideNavLink
                      key={item.label}
                      to={`/projects/${projectName}/${item.segment}`}
                      icon={navItemIcon(item)}
                      label={item.label}
                      collapsed={sidebarCollapsed}
                      sub
                    />
                  ),
                )}
              </NavSection>
            ))}
          </>
        ) : projectName && onViewsWorld ? (
          <>
            <WorldSwitcher projectName={projectName} world="views" collapsed={sidebarCollapsed} />

            {viewCategories.map(({ category, launchers, builtInViews, customViews }) => (
              <NavSection
                key={category.key}
                icon={category.icon}
                label={category.label}
                expanded={isExpanded(category)}
                collapsed={sidebarCollapsed}
                onToggle={() => toggleCategory(category)}
              >
                {builtInViews.map((view) => (
                  <SideNavLink
                    key={view.label}
                    to={view.path(projectName)}
                    icon={builtInViewIcon(view)}
                    label={view.label}
                    collapsed={sidebarCollapsed}
                    sub
                  />
                ))}
                {launchers.map((launcher) => {
                  const { svc, view } = launcher;
                  const icon = uiServiceViewIcon(view);
                  const label =
                    (launcherCounts.get(view.label) ?? 0) > 1
                      ? `${view.label} · ${svc.name}`
                      : view.label;
                  return svc.status === 'Ready' ? (
                    <ExternalNavLink
                      key={`${svc.name}:${view.label}`}
                      href={launcherUrl(launcher)}
                      icon={icon}
                      label={label}
                      collapsed={sidebarCollapsed}
                      title={`Open ${svc.name} in a new tab`}
                    />
                  ) : (
                    <DisabledNavLink
                      key={`${svc.name}:${view.label}`}
                      icon={icon}
                      label={label}
                      collapsed={sidebarCollapsed}
                      title={`${svc.name} — ${svc.status}`}
                      collapsedTitle={`${label} — ${svc.status}`}
                    />
                  );
                })}
                {customViews.map((view) => (
                  <ExternalNavLink
                    key={view.id}
                    href={view.url}
                    icon={view.icon}
                    label={view.label}
                    collapsed={sidebarCollapsed}
                    title={`Open ${view.label} in a new tab`}
                  />
                ))}
              </NavSection>
            ))}

            {extraViewCategories.map(({ category, customViews }) => (
              <NavSection
                key={category.key}
                icon={category.icon}
                label={category.label}
                expanded={isExpanded(category)}
                collapsed={sidebarCollapsed}
                onToggle={() => toggleCategory(category)}
              >
                {customViews.map((view) => (
                  <ExternalNavLink
                    key={view.id}
                    href={view.url}
                    icon={view.icon}
                    label={view.label}
                    collapsed={sidebarCollapsed}
                    title={`Open ${view.label} in a new tab`}
                  />
                ))}
              </NavSection>
            ))}
          </>
        ) : null
      }
    >
      <Outlet context={viewServices} />
    </ConsoleShell>
  );
}
