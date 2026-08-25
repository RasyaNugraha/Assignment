import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/auth.service';
import { UserService } from '../../core/user.service';

// WIREFRAME.md §7 "Profile Screen". Display name / password / preferences
// all hit real PUT /api/users/me* endpoints now (server/routes/users.js).
// Avatar upload still needs a real file input) — not covered yet, so it
// stays a disabled placeholder per the template.
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent {
  public auth = inject(AuthService);
  private userService = inject(UserService);

  displayName = this.auth.currentUser()?.displayName ?? '';
  displayNameMessage = signal<string | null>(null);

  oldPassword = '';
  newPassword = '';
  confirmNewPassword = '';
  passwordMessage = signal<string | null>(null);

  theme = this.auth.currentUser()?.preferences.theme ?? 'light';
  fontSize = this.auth.currentUser()?.preferences.fontSize ?? 'medium';
  preferencesMessage = signal<string | null>(null);

  async onSaveDisplayName() {
    if (!this.displayName.trim()) return;
    try {
      const updated = await this.userService.updateDisplayName(this.displayName);
      this.auth.currentUser.set(updated);
      this.displayNameMessage.set('Saved.');
    } catch {
      this.displayNameMessage.set('Could not save. Try again.');
    }
  }

  async onChangePassword() {
    if (this.newPassword !== this.confirmNewPassword) {
      this.passwordMessage.set('New password and confirmation do not match.');
      return;
    }
    try {
      await this.userService.changePassword({
        oldPassword: this.oldPassword,
        newPassword: this.newPassword,
        confirmNewPassword: this.confirmNewPassword,
      });
      this.oldPassword = '';
      this.newPassword = '';
      this.confirmNewPassword = '';
      this.passwordMessage.set('Password updated.');
    } catch (err: any) {
      this.passwordMessage.set(err?.error?.error ?? 'Could not update password. Try again.');
    }
  }

  async onSavePreferences() {
    try {
      const updated = await this.userService.updatePreferences({ theme: this.theme as any, fontSize: this.fontSize as any });
      this.auth.currentUser.set(updated);
      this.preferencesMessage.set('Saved.');
    } catch {
      this.preferencesMessage.set('Could not save. Try again.');
    }
  }
}
