import { Component } from '@angular/core';
import { TabsModule } from 'primeng/tabs';
import { SecretStoreListComponent } from './secret-store-list.component';
import { ExternalSecretListComponent } from './external-secret-list.component';

@Component({
    selector: 'app-secrets-page',
    standalone: true,
    imports: [TabsModule, SecretStoreListComponent, ExternalSecretListComponent],
    templateUrl: './secrets-page.component.html',
    styleUrls: ['./secrets-page.component.css']
})
export class SecretsPageComponent { }
