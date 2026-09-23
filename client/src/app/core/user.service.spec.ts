import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UserService } from './user.service';
import { makeUser } from '../../testing/fakes';

describe('UserService', () => {
  let service: UserService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClientTesting()] });
    service = TestBed.inject(UserService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('updateDisplayName() PUTs the new name', async () => {
    const promise = service.updateDisplayName('New Name');
    const req = http.expectOne({ method: 'PUT', url: '/api/users/me' });
    expect(req.request.body).toEqual({ displayName: 'New Name' });
    req.flush(makeUser({ displayName: 'New Name' }));
    expect((await promise).displayName).toBe('New Name');
  });

  it('changePassword() sends old, new and confirm', async () => {
    const fields = { oldPassword: 'Old12345', newPassword: 'New12345', confirmNewPassword: 'New12345' };
    const promise = service.changePassword(fields);
    const req = http.expectOne({ method: 'PUT', url: '/api/users/me/password' });
    expect(req.request.body).toEqual(fields);
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promise;
  });

  it('changePassword() rejects when the old password is wrong', async () => {
    const promise = service.changePassword({ oldPassword: 'x', newPassword: 'New12345', confirmNewPassword: 'New12345' });
    http.expectOne('/api/users/me/password').flush({ error: 'Current password is incorrect.' }, { status: 401, statusText: 'Unauthorized' });
    await expect(promise).rejects.toMatchObject({ status: 401 });
  });

  it('updatePreferences() PUTs theme and font size', async () => {
    const promise = service.updatePreferences({ theme: 'dark', fontSize: 'large' });
    const req = http.expectOne({ method: 'PUT', url: '/api/users/me/preferences' });
    expect(req.request.body).toEqual({ theme: 'dark', fontSize: 'large' });
    req.flush(makeUser({ preferences: { theme: 'dark', fontSize: 'large' } }));
    expect((await promise).preferences.theme).toBe('dark');
  });

  it('updateAvatar() PUTs the base64 image', async () => {
    const promise = service.updateAvatar('data:image/png;base64,AAA');
    const req = http.expectOne({ method: 'PUT', url: '/api/users/me/avatar' });
    expect(req.request.body).toEqual({ avatarUrl: 'data:image/png;base64,AAA' });
    req.flush(makeUser({ avatarUrl: 'data:image/png;base64,AAA' }));
    expect((await promise).avatarUrl).toContain('base64');
  });
});
