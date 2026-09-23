import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { checkRegistration } from '../../core/form-checks';


// Creates the first user (Super Admin) while the system has zero users (R1/R2).
@Component({
  selector: 'app-bootstrap',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bootstrap.component.html',
  styleUrl: './bootstrap.component.css',
})
export class BootstrapComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  firstName = '';
  lastName = '';
  email = '';
  dateOfBirth = '';
  password = '';
  confirmPassword = '';

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  // Go to login if bootstrap is already done.
  async ngOnInit() {
    const needsBootstrap = await this.auth.needsBootstrap().catch(() => true);
    if (!needsBootstrap) this.router.navigateByUrl('/login');
  }

  // Create the Super Admin.
  async onSubmit() {
    this.errorMessage.set(null);

    const problem = checkRegistration(this);
    if (problem) {
      this.errorMessage.set(problem);
      return;
    }

    this.loading.set(true);
    try {
      await this.auth.bootstrap({
        email: this.email,
        password: this.password,
        firstName: this.firstName,
        lastName: this.lastName,
        dateOfBirth: this.dateOfBirth,
      });
      this.router.navigateByUrl('/groups');
    } catch (err: any) {
      const apiErrors = err?.error?.errors as string[] | undefined;
      this.errorMessage.set(apiErrors?.join(' ') ?? err?.error?.error ?? 'Something went wrong. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
