import { Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage {
  readonly auth = inject(AuthService);

  login() {
    return this.auth.login();
  }

  logout() {
    return this.auth.logout();
  }

  openAccount() {
    return this.auth.accountManagement();
  }
}

