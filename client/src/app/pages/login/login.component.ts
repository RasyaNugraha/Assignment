import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  async ngOnInit() {
    // If nobody has bootstrapped the system yet, send everyone to /bootstrap
    // instead of /login (R2).
    const needsBootstrap = await this.auth.needsBootstrap().catch(() => false);
    if (needsBootstrap) this.router.navigateByUrl('/bootstrap');
  }

  async onSubmit() {
    this.errorMessage.set(null);
    this.loading.set(true);
    try {
      await this.auth.login(this.email, this.password);
      this.router.navigateByUrl('/groups');
    } catch (err: any) {
      this.errorMessage.set(err?.error?.error ?? 'Something went wrong. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
