import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';

// Shown once logged in, hidden on /bootstrap, /login, /register
// (Phase1.md §5.1 component tree).
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent {
  public auth = inject(AuthService);
  private router = inject(Router);

  async onLogout() {
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
