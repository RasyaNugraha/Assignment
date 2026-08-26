import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from './auth.service';

export interface ChangePasswordFields {
  oldPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

// Self-service profile edits: display name, password, UI preferences, avatar.
@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);

  private toPromise<T>(request$: Observable<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request$.subscribe({
        next: (value) => resolve(value),
        error: (err) => reject(err),
      });
    });
  }

  updateDisplayName(displayName: string): Promise<User> {
    return this.toPromise(this.http.put<User>('/api/users/me', { displayName }));
  }

  changePassword(fields: ChangePasswordFields): Promise<void> {
    return this.toPromise(this.http.put<void>('/api/users/me/password', fields));
  }

  updatePreferences(preferences: { theme: 'light' | 'dark'; fontSize: 'small' | 'medium' | 'large' }): Promise<User> {
    return this.toPromise(this.http.put<User>('/api/users/me/preferences', preferences));
  }

  // avatarUrl is a base64 data: URL read client-side via FileReader.
  updateAvatar(avatarUrl: string): Promise<User> {
    return this.toPromise(this.http.put<User>('/api/users/me/avatar', { avatarUrl }));
  }
}
