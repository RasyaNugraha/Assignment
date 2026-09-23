import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { authGuard, superAdminGuard } from './auth.guard';
import { AuthService, User } from './auth.service';

const baseUser = { id: 'u', isSuperAdmin: false } as User;

describe('superAdminGuard', () => {
  const run = () =>
    TestBed.runInInjectionContext(() => superAdminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

  it('lets the Super Admin through', () => {
    TestBed.inject(AuthService).currentUser.set({ ...baseUser, isSuperAdmin: true });
    expect(run()).toBe(true);
  });

  it('sends everyone else back to /groups', () => {
    TestBed.inject(AuthService).currentUser.set(baseUser);
    const result = run() as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/groups');
  });
});

describe('authGuard', () => {

  let me: ReturnType<typeof vi.fn>;
  const run = () =>
    TestBed.runInInjectionContext(() => authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as Promise<boolean | UrlTree>;

  beforeEach(() => {
    me = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { currentUser: () => null, me } }] });
  });

  it('lets a logged-in user through straight away', async () => {
    TestBed.overrideProvider(AuthService, { useValue: { currentUser: () => baseUser, me } });
    expect(await run()).toBe(true);
    expect(me).not.toHaveBeenCalled();
  });

  it('checks the session with the server after a refresh', async () => {
    me.mockResolvedValue(baseUser);
    expect(await run()).toBe(true);
    expect(me).toHaveBeenCalled();
  });

  it('sends the user to /login when the session has expired', async () => {
    me.mockRejectedValue({ status: 401 });
    const result = (await run()) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login');
  });
});
