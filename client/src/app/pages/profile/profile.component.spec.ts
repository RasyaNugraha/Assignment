import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileComponent } from './profile.component';
import { AuthService } from '../../core/auth.service';
import { UserService } from '../../core/user.service';
import { makeUser } from '../../../testing/fakes';

describe('ProfileComponent', () => {
  let fixture: ComponentFixture<ProfileComponent>;
  let component: ProfileComponent;
  let users: Record<string, ReturnType<typeof vi.fn>>;

  // Fake <input type=file> change event.
  const fileEvent = (file: File) => ({ target: { files: [file], value: 'x' } }) as unknown as Event;

  beforeEach(() => {
    users = {
      updateDisplayName: vi.fn().mockResolvedValue(makeUser({ displayName: 'New Name' })),
      changePassword: vi.fn().mockResolvedValue(undefined),
      updatePreferences: vi.fn().mockResolvedValue(makeUser({ preferences: { theme: 'dark', fontSize: 'large' } })),
      updateAvatar: vi.fn(),
    };
    TestBed.configureTestingModule({ imports: [ProfileComponent], providers: [{ provide: UserService, useValue: users }] });
    TestBed.inject(AuthService).currentUser.set(makeUser());
    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('fills the form from the logged-in user, email is read-only', () => {
    expect(component.displayName).toBe('Me Myself');
    const email = fixture.nativeElement.querySelector('input[type="email"]') as HTMLInputElement;
    expect(email.readOnly).toBe(true);
  });

  it('saves the display name and updates the user', async () => {
    component.displayName = 'New Name';
    await component.onSaveDisplayName();
    expect(users['updateDisplayName']).toHaveBeenCalledWith('New Name');
    expect(TestBed.inject(AuthService).currentUser()?.displayName).toBe('New Name');
    expect(component.displayNameMessage()).toBe('Saved.');
  });

  it('does not save an empty display name', async () => {
    component.displayName = '   ';
    await component.onSaveDisplayName();
    expect(users['updateDisplayName']).not.toHaveBeenCalled();
    expect(component.displayNameMessage()).toBe('Display name is required.');
  });

  it('checks the new passwords match and shows server errors', async () => {
    component.newPassword = 'Password1';
    component.confirmNewPassword = 'Password2';
    await component.onChangePassword();
    expect(users['changePassword']).not.toHaveBeenCalled();

    component.confirmNewPassword = 'Password1';
    users['changePassword'].mockRejectedValue({ error: { error: 'Current password is incorrect.' } });
    await component.onChangePassword();
    expect(component.passwordMessage()).toBe('Current password is incorrect.');
  });

  it('saves preferences', async () => {
    component.theme = 'dark';
    component.fontSize = 'large';
    await component.onSavePreferences();
    expect(users['updatePreferences']).toHaveBeenCalledWith({ theme: 'dark', fontSize: 'large' });
    expect(component.preferencesMessage()).toBe('Saved.');
  });

  it('rejects a non-image or too-big avatar before uploading', async () => {
    await component.onAvatarSelected(fileEvent(new File(['x'], 'a.pdf', { type: 'application/pdf' })));
    expect(component.avatarMessage()).toContain('PNG, JPEG, GIF or WebP');
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });
    await component.onAvatarSelected(fileEvent(big));
    expect(component.avatarMessage()).toBe('Image must be 2MB or smaller.');
    expect(users['updateAvatar']).not.toHaveBeenCalled();
  });
});
