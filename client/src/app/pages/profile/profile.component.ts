import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/auth.service';
import { UserService } from '../../core/user.service';

const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // matches server's PUT /users/me/avatar limit

// Display name / password / preferences / avatar edits.
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

  avatarMessage = signal<string | null>(null);

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

  // Reads the picked file as a base64 data: URL (FileReader), then sends it
  // straight to the server — no separate file-storage service in Phase 1.
  async onAvatarSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > AVATAR_MAX_BYTES) {
      this.avatarMessage.set('Image must be 2MB or smaller.');
      input.value = '';
      return;
    }

    try {
      const dataUrl = await this.readFileAsDataUrl(file);
      const updated = await this.userService.updateAvatar(dataUrl);
      this.auth.currentUser.set(updated);
      this.avatarMessage.set('Avatar updated.');
    } catch (err: any) {
      this.avatarMessage.set(err?.error?.error ?? 'Could not update avatar. Try again.');
    } finally {
      input.value = '';
    }
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
