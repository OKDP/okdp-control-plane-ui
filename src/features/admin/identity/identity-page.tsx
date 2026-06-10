import { TabPanel, TabView } from 'primereact/tabview';
import { UserList } from './users/user-list';
import { GroupList } from './groups/group-list';

export default function IdentityPage() {
  return (
    /* identity-page scopes the TabView overrides in primereact-overrides.css */
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
