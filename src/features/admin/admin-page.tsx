import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Avatar } from 'primereact/avatar';
import { Menu } from 'primereact/menu';
import type { MenuItem } from 'primereact/menuitem';
import { useAuth } from '../../core/auth/auth-context';
import { rememberSpace } from '../../core/context/space';
import { environment } from '../../config/environment';
import { SIDEBAR_COLLAPSED_KEY } from '../../core/storage-keys';
import './admin-page.css';

export default function AdminPage() {
  const auth = useAuth();
  const menuRef = useRef<Menu>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
  );

  useEffect(() => {
    rememberSpace('admin');
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

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link${isActive ? ' active' : ''}`;

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

        <div className="header-center"></div>

        <div className="header-right">
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
          <NavLink to="/admin" end className={navLinkClass} title={sidebarCollapsed ? 'Home' : ''}>
            <i className="pi pi-home"></i>
            <span>Home</span>
          </NavLink>

          <NavLink
            to="/admin/projects"
            className={navLinkClass}
            title={sidebarCollapsed ? 'Projects' : ''}
          >
            <i className="pi pi-th-large"></i>
            <span>Projects</span>
          </NavLink>

          <NavLink
            to="/admin/identity"
            className={navLinkClass}
            title={sidebarCollapsed ? 'Identity' : ''}
          >
            <i className="pi pi-users"></i>
            <span>Identity</span>
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
