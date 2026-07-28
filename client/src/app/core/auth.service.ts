import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  age: number;
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
  age: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser = signal<User | null>(null);

  constructor(private http: HttpClient) {}

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

  me(): Promise<User> {
    return firstValueFrom(this.http.get<User>('/api/auth/me')).then((user) => {
      this.currentUser.set(user);
      return user;
    });
  }
}
