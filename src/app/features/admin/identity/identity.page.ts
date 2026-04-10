import { Component } from '@angular/core';

import { TabsModule } from 'primeng/tabs';
import { UserListComponent } from './users/user-list.component';
import { GroupListComponent } from './groups/group-list.component';

@Component({
  selector: 'app-identity-page',
  standalone: true,
  imports: [TabsModule, UserListComponent, GroupListComponent],
  templateUrl: './identity.page.html',
  styleUrls: ['./identity.page.css']
})
export class IdentityPage { }
