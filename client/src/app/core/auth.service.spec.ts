import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService, User } from './auth.service';

const user: User = {
  id: 'u1',
  email: 'a@b.com',
  firstName: 'A',
  lastName: 'B',
  displayName: 'A B',
  dateOfBirth: '2000-01-01',
  age: 26,
  isSuperAdmin: false,
  groupAdminOf: [],
  groupMemberships: [],
  avatarUrl: null,
  preferences: { theme: 'light', fontSize: 'medium' },
};

// AuthService tests with a fake HTTP backend.
describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClientTesting()] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify()); // no unexpected requests

  it('starts with no current user', () => {
    expect(service.currentUser()).toBeNull();
  });

  it('login() posts the credentials and stores the returned user', async () => {
    const promise = service.login('a@b.com', 'Password1');
    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.com', password: 'Password1' });
    req.flush(user);

    await expect(promise).resolves.toEqual(user);
    expect(service.currentUser()).toEqual(user);
    // No password in Local Storage.
    expect(localStorage.getItem('fabulari_currentUser')).not.toContain('Password1');
  });

  it('login() rejects on 401 and keeps currentUser empty', async () => {
    const promise = service.login('a@b.com', 'wrong');
    http.expectOne('/api/auth/login').flush({ error: 'Invalid email or password.' }, { status: 401, statusText: 'Unauthorized' });
    await expect(promise).rejects.toBeTruthy();
    expect(service.currentUser()).toBeNull();
  });

  it('needsBootstrap() unwraps the server flag', async () => {
    const promise = service.needsBootstrap();
    http.expectOne('/api/bootstrap/status').flush({ needsBootstrap: true });
    await expect(promise).resolves.toBe(true);
  });

  it('me() clears a stale user when the session has expired', async () => {
    service.currentUser.set(user);
    const promise = service.me();
    http.expectOne('/api/auth/me').flush({ error: 'Not logged in.' }, { status: 401, statusText: 'Unauthorized' });
    await expect(promise).rejects.toBeTruthy();
    expect(service.currentUser()).toBeNull();
  });

  it('logout() clears the current user', async () => {
    service.currentUser.set(user);
    const promise = service.logout();
    http.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await promise;
    expect(service.currentUser()).toBeNull();
  });
});

describe('AuthService register/bootstrap', () => {
  let service: AuthService;
  let http: HttpTestingController;
  const fields = { email: 'a@b.com', password: 'Password1', firstName: 'A', lastName: 'B', dateOfBirth: '2000-01-01' };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClientTesting()] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('register() posts the fields and stores the new user', async () => {
    const promise = service.register(fields);
    const req = http.expectOne({ method: 'POST', url: '/api/auth/register' });
    expect(req.request.body).toEqual(fields);
    req.flush(user);
    await promise;
    expect(service.currentUser()?.id).toBe('u1');
  });

  it('bootstrap() posts to /api/bootstrap', async () => {
    const promise = service.bootstrap(fields);
    http.expectOne({ method: 'POST', url: '/api/bootstrap' }).flush({ ...user, isSuperAdmin: true });
    expect((await promise).isSuperAdmin).toBe(true);
  });
});
