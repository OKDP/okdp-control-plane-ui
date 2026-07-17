import { TabPanel, TabView } from 'primereact/tabview';
import { Navigate } from 'react-router-dom';
import { UserList } from './users/user-list';
import { GroupList } from './groups/group-list';
import { useUserManagementEnabled } from '../../../core/capabilities/use-capabilities';

export default function IdentityPage() {
  const userManagement = useUserManagementEnabled();
  if (userManagement === undefined) return null;
  if (!userManagement) return <Navigate to="/admin" replace />;

  return (
    /* identity-page scopes the TabView overrides in the PrimeReact overrides section of styles.css */
    <div className="identity-page">
      <TabView>
        <TabPanel header="Users" leftIcon="pi pi-user mr-2">
          <UserList />
        </TabPanel>
        <TabPanel header="Groups" leftIcon="pi pi-users mr-2">
          <GroupList />
        </TabPanel>
      </TabView>
    </div>
  );
}
