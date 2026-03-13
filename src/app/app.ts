import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthRedirectService } from './core/context/auth-redirect.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
})
export class App {
  private readonly _authRedirect = inject(AuthRedirectService);
}
