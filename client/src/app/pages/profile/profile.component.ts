import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/auth.service';
import { UserService } from '../../core/user.service';

const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // matches server's PUT /users/me/avatar limit

// Profile page: name, password, preferences, avatar.
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

  // Save the display name.
  async onSaveDisplayName() {
    if (!this.displayName.trim()) {
      this.displayNameMessage.set('Display name is required.');
      return;
    }
    try {
      const updated = await this.userService.updateDisplayName(this.displayName);
      this.auth.currentUser.set(updated);
      this.displayNameMessage.set('Saved.');
    } catch (err: any) {
      this.displayNameMessage.set(err?.error?.error ?? 'Could not save. Try again.');
    }
  }

  // Change the password.
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

  // Save preferences.
  async onSavePreferences() {
    try {
      const updated = await this.userService.updatePreferences({ theme: this.theme as any, fontSize: this.fontSize as any });
      this.auth.currentUser.set(updated);
      this.preferencesMessage.set('Saved.');
    } catch (err: any) {
      this.preferencesMessage.set(err?.error?.error ?? 'Could not save. Try again.');
    }
  }

  // Read the image as base64 and upload it.
  async onAvatarSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
      this.avatarMessage.set('Avatar must be a PNG, JPEG, GIF or WebP image.');
      input.value = '';
      return;
    }
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

  // Read a file as base64.
  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
