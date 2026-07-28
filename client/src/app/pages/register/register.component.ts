import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';

const PASSWORD_RULE = /^(?=.*[A-Z]).{8,}$/; // mirrors server-side rule, R23

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
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
      await this.auth.register({
        email: this.email,
        password: this.password,
        firstName: this.firstName,
        lastName: this.lastName,
        age: Number(this.age),
      });
      // TODO: navigate to /groups once GroupListComponent exists.
    } catch (err: any) {
      const apiErrors = err?.error?.errors as string[] | undefined;
      this.errorMessage.set(apiErrors?.join(' ') ?? err?.error?.error ?? 'Something went wrong. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
