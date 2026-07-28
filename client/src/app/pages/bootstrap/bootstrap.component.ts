import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth.service';

const PASSWORD_RULE = /^(?=.*[A-Z]).{8,}$/; // R23

// Bootstrap creates the very first user (Super Admin) — only reachable while
// the system has zero users (R1/R2). See auth.js `/api/bootstrap`.
@Component({
  selector: 'app-bootstrap',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bootstrap.component.html',
  styleUrl: './bootstrap.component.css',
})
export class BootstrapComponent implements OnInit {
  firstName = '';
  lastName = '';
  email = '';
  age: number | null = null;
  password = '';
  confirmPassword = '';

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  async ngOnInit() {
    // If bootstrap has already happened, this screen shouldn't be reachable.
    const needsBootstrap = await this.auth.needsBootstrap().catch(() => true);
    if (!needsBootstrap) this.router.navigateByUrl('/login');
  }

  async onSubmit() {
    this.errorMessage.set(null);

    if (!PASSWORD_RULE.test(this.password)) {
      this.errorMessage.set('Password must be at least 8 characters and include an uppercase letter.');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    this.loading.set(true);
    try {
      await this.auth.bootstrap({
        email: this.email,
        password: this.password,
        firstName: this.firstName,
        lastName: this.lastName,
        age: Number(this.age),
      });
      // TODO: navigate to /groups (or an admin landing page) once it exists.
    } catch (err: any) {
      const apiErrors = err?.error?.errors as string[] | undefined;
      this.errorMessage.set(apiErrors?.join(' ') ?? err?.error?.error ?? 'Something went wrong. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
