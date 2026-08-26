import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Mirrors toPublicUser() in server/routes/auth.js — no passwordHash.
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  dateOfBirth: string; // ISO date
  age: number; // computed server-side from dateOfBirth
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
  dateOfBirth: string; // ISO date, from <input type="date">
}

const STORAGE_KEY = 'fabulari_currentUser';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  // Starts null; authGuard re-validates against the server session on load.
  currentUser = signal<User | null>(null);

  private setUser(user: User): void {
    this.currentUser.set(user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }

  private clearUser(): void {
    this.currentUser.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  // Wraps HttpClient's Observable in a Promise so components can await it.
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
      this.setUser(user);
      return user;
    });
  }

  register(fields: RegistrationFields): Promise<User> {
    return this.toPromise(this.http.post<User>('/api/auth/register', fields)).then((user) => {
      this.setUser(user);
      return user;
    });
  }

  login(email: string, password: string): Promise<User> {
    return this.toPromise(this.http.post<User>('/api/auth/login', { email, password })).then((user) => {
      this.setUser(user);
      return user;
    });
  }

  async logout(): Promise<void> {
    await this.toPromise(this.http.post('/api/auth/logout', {}));
    this.clearUser();
  }

  // Re-syncs currentUser from the server session — used on app load/refresh.
  me(): Promise<User> {
    return this.toPromise(this.http.get<User>('/api/auth/me')).then(
      (user) => {
        this.setUser(user);
        return user;
      },
      (err) => {
        this.clearUser(); // stale/expired session — don't leave old data behind
        throw err;
      },
    );
  }
}
