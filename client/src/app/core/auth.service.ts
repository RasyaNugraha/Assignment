import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

// Mirrors what the server sends back (toPublicUser in auth.js) — no passwordHash.
// dateOfBirth is the stored source of truth (per client clarification: ask for
// birthday, not a raw age, since age alone goes stale); age is computed
// server-side from it and included for convenient display/age-gating.
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  dateOfBirth: string; // ISO date (yyyy-MM-dd)
  age: number; // computed from dateOfBirth
  isSuperAdmin: boolean;
  groupAdminOf: string[];
  groupMemberships: string[];
  avatarUrl: string | null;
  preferences: { theme: 'light' | 'dark'; fontSize: 'small' | 'medium' | 'large' };
}

export interface RegistrationFields {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO date (yyyy-MM-dd), from an <input type="date">
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // inject() instead of a constructor param — per Week 4 lecture, Angular's
  // moved away from constructor injection to this function-based form.
  private http = inject(HttpClient);

  // Whoever's logged in right now, shared across every component that injects this service.
  currentUser = signal<User | null>(null);

  needsBootstrap(): Promise<boolean> {
    return firstValueFrom(this.http.get<{ needsBootstrap: boolean }>('/api/bootstrap/status')).then(
      (res) => res.needsBootstrap,
    );
  }

  bootstrap(fields: RegistrationFields): Promise<User> {
    return firstValueFrom(this.http.post<User>('/api/bootstrap', fields)).then((user) => {
      this.currentUser.set(user);
      return user;
    });
  }

  register(fields: RegistrationFields): Promise<User> {
    return firstValueFrom(this.http.post<User>('/api/auth/register', fields)).then((user) => {
      this.currentUser.set(user);
      return user;
    });
  }

  login(email: string, password: string): Promise<User> {
    return firstValueFrom(this.http.post<User>('/api/auth/login', { email, password })).then((user) => {
      this.currentUser.set(user);
      return user;
    });
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/logout', {}));
    this.currentUser.set(null);
  }

  // Checks the current session on the server and syncs currentUser — used on
  // app load / refresh so a logged-in user doesn't get bounced to /login.
  me(): Promise<User> {
    return firstValueFrom(this.http.get<User>('/api/auth/me')).then((user) => {
      this.currentUser.set(user);
      return user;
    });
  }
}
