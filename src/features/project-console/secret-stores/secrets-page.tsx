import { TabPanel, TabView } from 'primereact/tabview';
import { SecretStoreList } from './secret-store-list';
import { ExternalSecretList } from './external-secret-list';
import './secrets-page.css';

export default function SecretsPage() {
  return (
    <div className="secrets-page">
      <TabView>
        <TabPanel header="Secret Stores" leftIcon="pi pi-lock mr-2">
          <SecretStoreList />
        </TabPanel>
        <TabPanel header="External Secrets" leftIcon="pi pi-key mr-2">
          <ExternalSecretList />
        </TabPanel>
      </TabView>
    </div>
  );
}
