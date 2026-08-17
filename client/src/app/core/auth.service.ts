import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

  // Every HttpClient call (get/post/...) returns an Observable, not a value
  // straight away — same "subscribe to a newsletter" idea from the Week 4
  // lecture: you don't get the response the instant you call the method, you
  // subscribe and get notified when it arrives. This helper does exactly
  // that .subscribe() call, then resolves/rejects a Promise from it, so the
  // rest of this service (and every component using it) can just
  // `await this.auth.login(...)` instead of nesting a .subscribe() callback
  // inside every method. The underlying mechanism is identical to what was
  // demoed in class — this just avoids repeating the same subscribe
  // boilerplate five times below.
  private toPromise<T>(request$: Observable<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request$.subscribe({
        next: (value) => resolve(value),
        error: (err) => reject(err),
      });
    });
  }

  needsBootstrap(): Promise<boolean> {
    return this.toPromise(this.http.get<{ needsBootstrap: boolean }>('/api/bootstrap/status')).then(
      (res) => res.needsBootstrap,
    );
  }

  bootstrap(fields: RegistrationFields): Promise<User> {
    return this.toPromise(this.http.post<User>('/api/bootstrap', fields)).then((user) => {
      this.currentUser.set(user);
      return user;
    });
  }

  register(fields: RegistrationFields): Promise<User> {
    return this.toPromise(this.http.post<User>('/api/auth/register', fields)).then((user) => {
      this.currentUser.set(user);
      return user;
    });
  }

  login(email: string, password: string): Promise<User> {
    return this.toPromise(this.http.post<User>('/api/auth/login', { email, password })).then((user) => {
      this.currentUser.set(user);
      return user;
    });
  }

  async logout(): Promise<void> {
    await this.toPromise(this.http.post('/api/auth/logout', {}));
    this.currentUser.set(null);
  }

  // Checks the current session on the server and syncs currentUser — used on
  // app load / refresh so a logged-in user doesn't get bounced to /login.
  me(): Promise<User> {
    return this.toPromise(this.http.get<User>('/api/auth/me')).then((user) => {
      this.currentUser.set(user);
      return user;
    });
  }
}
