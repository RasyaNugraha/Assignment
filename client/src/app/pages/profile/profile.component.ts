import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/auth.service';

// WIREFRAME.md §7 "Profile Screen". Display name / password / preferences
// forms are wired up visually now; the PUT /api/users/me* endpoints they'll
// call are Week 5 work per TIMELINE.md — submits are TODO stubs until then.
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent {
  public auth = inject(AuthService);

  displayName = this.auth.currentUser()?.displayName ?? '';

  oldPassword = '';
  newPassword = '';
  confirmNewPassword = '';
  passwordMessage = signal<string | null>(null);

  theme = this.auth.currentUser()?.preferences.theme ?? 'light';
  fontSize = this.auth.currentUser()?.preferences.fontSize ?? 'medium';

  // TODO: PUT /api/users/me once implemented (Week 5).
  onSaveDisplayName() {}

  // TODO: PUT /api/users/me/password once implemented (Week 5).
  onChangePassword() {
    if (this.newPassword !== this.confirmNewPassword) {
      this.passwordMessage.set('New password and confirmation do not match.');
      return;
    }
    this.passwordMessage.set('Not wired up yet — lands with PUT /api/users/me/password (Week 5).');
  }

  // TODO: PUT /api/users/me/preferences once implemented (Week 5).
  onSavePreferences() {}
}
