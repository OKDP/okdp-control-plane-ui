import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Avatar } from 'primereact/avatar';
import { Menu } from 'primereact/menu';
import type { MenuItem } from 'primereact/menuitem';
import { useAuth } from '../../core/auth/auth-context';
import { useTheme, type ThemeMode } from '../../core/theme/theme-context';
import { ENV_BAR_STORAGE_KEY } from '../../core/storage-keys';
import { environment } from '../../config/environment';
import { sideNavIconClass, sideNavLabelClass, sideNavLinkClass } from './console-nav-classes';

interface SideNavLinkProps {
  to: string;
  end?: boolean;
  icon: string;
  label: string;
  collapsed: boolean;
  sub?: boolean;
}

/** Sidebar navigation link with collapse-aware icon and label. */
export function SideNavLink({ to, end, icon, label, collapsed, sub }: SideNavLinkProps) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : ''}
      className={({ isActive }) => sideNavLinkClass({ active: isActive, collapsed, sub })}
    >
      {({ isActive }) => (
        <>
          <i className={`${icon} ${sideNavIconClass(isActive)}`}></i>
          <span className={sideNavLabelClass(collapsed)}>{label}</span>
        </>
      )}
    </NavLink>
  );
}

const TOPBAR_BTN_CLASS =
  'relative flex h-8 w-8 items-center justify-center rounded-sm border-none bg-transparent text-fg-muted no-underline transition-[color,background-color] duration-150 ease-smooth hover:bg-surface-tertiary hover:text-fg';

interface ConsoleShellProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Header widgets rendered right after the brand block (e.g. project switcher). */
  headerLeft?: ReactNode;
  /** Environment color painted as a strip across the top of the header. */
  accentColor?: string;
  nav: ReactNode;
  navBottom?: ReactNode;
  navBottomAriaLabel?: string;
  children: ReactNode;
}

/** Application chrome shared by the admin and project console: header with
 *  logo and user menu, collapsible sidebar, scrollable content area, footer. */
export function ConsoleShell({
  collapsed,
  onToggleCollapsed,
  headerLeft,
  accentColor,
  nav,
  navBottom,
  navBottomAriaLabel,
  children,
}: ConsoleShellProps) {
  const auth = useAuth();
  const { theme, setTheme } = useTheme();
  const menuRef = useRef<Menu>(null);
  const themeMenuRef = useRef<Menu>(null);
  const [envBarEnabled, setEnvBarEnabled] = useState(
    () => localStorage.getItem(ENV_BAR_STORAGE_KEY) !== 'false',
  );

  const toggleEnvBar = () => {
    setEnvBarEnabled((enabled) => {
      localStorage.setItem(ENV_BAR_STORAGE_KEY, String(!enabled));
      return !enabled;
    });
  };

  const displayName = auth.profile?.firstName ?? auth.profile?.username ?? 'User';
  const first = (auth.profile?.firstName ?? auth.profile?.username ?? '?').charAt(0).toUpperCase();
  const last = (auth.profile?.lastName ?? '').charAt(0).toUpperCase();
  const initials = `${first}${last || ''}`;

  const themeOption = (mode: ThemeMode, icon: string, label: string): MenuItem => ({
    label,
    icon,
    command: () => setTheme(mode),
    // Custom template to append the active-mode check mark. Templates replace
    // the .p-menuitem-content wrapper too, so it must be reproduced for the
    // theme's padding/hover rules to keep applying.
    template: (item, options) => (
      <div className="p-menuitem-content">
        <a className={options.className} onClick={options.onClick}>
          <span className={options.iconClassName}></span>
          <span className={options.labelClassName}>{item.label}</span>
          {theme === mode && <i className="pi pi-check ml-auto text-[0.7rem] text-primary"></i>}
        </a>
      </div>
    ),
  });

  const themeMenu: MenuItem[] = [
    themeOption('system', 'pi pi-desktop', 'System'),
    themeOption('light', 'pi pi-sun', 'Light'),
    themeOption('dark', 'pi pi-moon', 'Dark'),
  ];

  const themeIcon =
    theme === 'dark' ? 'pi pi-moon' : theme === 'light' ? 'pi pi-sun' : 'pi pi-desktop';

  const profileMenu: MenuItem[] = [
    {
      label: 'Preferences',
      items: [
        {
          label: 'Environment color bar',
          icon: 'pi pi-palette',
          command: toggleEnvBar,
          // Same template trick as the theme options: reproduce the
          // .p-menuitem-content wrapper and append the check mark.
          template: (item, options) => (
            <div className="p-menuitem-content">
              <a className={options.className} onClick={options.onClick}>
                <span className={options.iconClassName}></span>
                <span className={options.labelClassName}>{item.label}</span>
                {envBarEnabled && (
                  <i className="pi pi-check ml-auto text-[0.7rem] text-primary"></i>
                )}
              </a>
            </div>
          ),
        },
      ],
    },
    { separator: true },
    {
      label: 'Sign out',
      icon: 'pi pi-sign-out',
      command: () => auth.logout(),
    },
  ];

  return (
    <div
      className={`grid h-screen ${
        collapsed
          ? 'grid-cols-[var(--db-sidebar-collapsed-width)_1fr]'
          : 'grid-cols-[var(--db-sidebar-width)_1fr]'
      } grid-rows-[var(--db-header-height)_1fr] bg-surface transition-[grid-template-columns] duration-400 ease-smooth max-lg:grid-cols-[var(--db-sidebar-collapsed-width)_1fr] max-md:grid-cols-[1fr]`}
    >
      {/* Unified header */}
      <header className="relative z-20 col-span-2 row-start-1 flex h-(--db-header-height) items-center justify-between border-b border-border-light bg-surface px-3 transition-[background-color,border-color] duration-150 ease-smooth max-md:col-span-1">
        {accentColor && envBarEnabled && (
          <div
            className="absolute inset-x-0 top-0 h-[3px]"
            style={{ background: accentColor }}
            aria-hidden="true"
          ></div>
        )}
        <div
          className={`flex items-center gap-2 ${
            collapsed
              ? 'w-(--db-sidebar-collapsed-width) min-w-(--db-sidebar-collapsed-width)'
              : 'w-(--db-sidebar-width) min-w-(--db-sidebar-width)'
          } max-lg:w-(--db-sidebar-collapsed-width) max-lg:min-w-(--db-sidebar-collapsed-width) max-md:w-auto max-md:min-w-auto`}
        >
          <Link to="/home" title="Home" className="flex items-center justify-center no-underline">
            <img src="/images/okdp-notext.svg" alt="okdp" className="h-auto w-6" />
            <div
              className={`flex flex-row items-baseline gap-1 overflow-hidden leading-none whitespace-nowrap transition-[max-width,margin] duration-400 ease-smooth ${
                collapsed ? 'ml-0 max-w-0' : 'ml-2 max-w-[150px] max-lg:ml-0 max-lg:max-w-0'
              } max-md:ml-2 max-md:max-w-[150px]`}
            >
              <span className="text-[1.075rem] font-bold tracking-[-0.02em] text-fg">okdp</span>
              <span className="text-[1.075rem] font-normal text-fg-secondary">console</span>
            </div>
          </Link>
          <button
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-sm border-none bg-transparent p-0 text-fg-muted transition-[color,background-color] duration-150 ease-smooth hover:bg-surface-tertiary hover:text-fg"
            onClick={onToggleCollapsed}
            title={collapsed ? 'Expand' : 'Collapse'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <i
              className={`${collapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'} text-[1.1rem]`}
            ></i>
          </button>
        </div>

        <div className="flex flex-1 items-center justify-start gap-2 pl-3">{headerLeft}</div>

        <div className="flex items-center gap-2">
          <a
            href={environment.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={TOPBAR_BTN_CLASS}
            title="GitHub"
          >
            <i className="pi pi-github text-[1rem]"></i>
          </a>

          <button
            className={TOPBAR_BTN_CLASS}
            onClick={(e) => themeMenuRef.current?.toggle(e)}
            title="Theme"
            aria-label="Theme menu"
            aria-haspopup="menu"
          >
            <i className={`${themeIcon} text-[1rem]`}></i>
          </button>
          <Menu ref={themeMenuRef} model={themeMenu} popup />

          <div
            className="flex items-center gap-2 rounded-md border-none bg-transparent py-1 pr-2 pl-1 transition-[background-color] duration-150 ease-smooth hover:bg-surface-tertiary"
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
            <Avatar
              label={initials}
              shape="circle"
              size="normal"
              style={{
                backgroundColor: 'var(--db-primary)',
                color: '#ffffff',
                fontWeight: 600,
                width: '28px',
                height: '28px',
                fontSize: '0.75rem',
              }}
            />
            <div className="flex flex-col max-md:hidden">
              <span className="text-base leading-none font-medium text-fg">{displayName}</span>
            </div>
            <i className="pi pi-angle-down text-[0.7rem] text-fg-muted"></i>
          </div>
          <Menu ref={menuRef} model={profileMenu} popup />
        </div>
      </header>

      {/* Sidebar */}
      <aside className="z-[25] col-start-1 row-start-2 flex flex-col border-r border-border-light bg-surface transition-[width] duration-400 ease-smooth max-md:hidden">
        <nav
          className={`mt-0 flex-1 overflow-y-auto ${
            collapsed ? 'px-[0.4rem] py-3' : 'py-2 pr-1.5 pl-0 max-lg:px-[0.4rem] max-lg:py-3'
          }`}
        >
          {nav}
        </nav>
        {navBottom && (
          <nav
            className={`shrink-0 border-t border-border-light ${
              collapsed
                ? 'px-[0.4rem] pt-2 pb-3'
                : 'pt-1.5 pr-1.5 pb-2 pl-0 max-lg:px-[0.4rem] max-lg:pt-2 max-lg:pb-3'
            }`}
            aria-label={navBottomAriaLabel}
          >
            {navBottom}
          </nav>
        )}
      </aside>

      {/* Main layout */}
      <div className="col-start-2 row-start-2 m-0 flex h-full flex-col overflow-visible bg-surface-secondary transition-[background-color,border-color] duration-150 ease-smooth max-md:col-start-1">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-0">
          <div className="flex w-full min-w-0 flex-1 flex-col px-7 py-5 max-lg:px-5 max-lg:py-3 max-md:p-3">
            {children}
          </div>
        </main>

        <footer className="flex min-h-7 w-full shrink-0 items-center justify-between border-t border-border-light bg-transparent px-7 py-1.5">
          <div>
            <span className="text-xs font-normal text-fg-muted">
              © 2026 OKDP. All rights reserved.
            </span>
          </div>
          <div>
            <span className="text-xs font-normal text-fg-muted">v1.0.0</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
