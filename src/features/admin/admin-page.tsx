import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { rememberSpace } from '../../core/context/space';
import { SIDEBAR_COLLAPSED_KEY } from '../../core/storage-keys';
import { ConsoleShell, SideNavLink } from '../../shared/components/console-shell';

export default function AdminPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
  );

  useEffect(() => {
    rememberSpace('admin');
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const newState = !collapsed;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newState));
      return newState;
    });
  };

  return (
    <ConsoleShell
      collapsed={sidebarCollapsed}
      onToggleCollapsed={toggleSidebar}
      nav={
        <>
          <SideNavLink to="/admin" end icon="pi pi-home" label="Home" collapsed={sidebarCollapsed} />
          <SideNavLink
            to="/admin/projects"
            icon="pi pi-th-large"
            label="Projects"
            collapsed={sidebarCollapsed}
          />
          <SideNavLink
            to="/admin/identity"
            icon="pi pi-users"
            label="Identity"
            collapsed={sidebarCollapsed}
          />
        </>
      }
    >
      <Outlet />
    </ConsoleShell>
  );
}
