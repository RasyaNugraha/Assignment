import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BootstrapComponent } from './bootstrap.component';
import { AuthService } from '../../core/auth.service';
import { makeUser } from '../../../testing/fakes';

describe('BootstrapComponent', () => {
  let fixture: ComponentFixture<BootstrapComponent>;
  let component: BootstrapComponent;
  let auth: { needsBootstrap: ReturnType<typeof vi.fn>; bootstrap: ReturnType<typeof vi.fn> };
  let nav: any;

  // Fill the form with valid data.
  function fillValid() {
    Object.assign(component, {
      firstName: 'Super',
      lastName: 'Admin',
      email: 'boss@test.com',
      dateOfBirth: '1990-01-01',
      password: 'Password1',
      confirmPassword: 'Password1',
    });
  }

  beforeEach(async () => {
    auth = { needsBootstrap: vi.fn().mockResolvedValue(true), bootstrap: vi.fn() };
    TestBed.configureTestingModule({ imports: [BootstrapComponent], providers: [{ provide: AuthService, useValue: auth }] });
    nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(BootstrapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('stays on the page while the system has no users', () => {
    expect(nav).not.toHaveBeenCalledWith('/login');
  });

  it('goes to /login when bootstrap is already done', async () => {
    auth.needsBootstrap.mockResolvedValue(false);
    await component.ngOnInit();
    expect(nav).toHaveBeenCalledWith('/login');
  });

  it('does not submit a weak password', async () => {
    fillValid();
    component.password = component.confirmPassword = 'weak';
    await component.onSubmit();
    expect(auth.bootstrap).not.toHaveBeenCalled();
    expect(component.errorMessage()).toContain('at least 8 characters');
  });

  it('creates the Super Admin and goes to /groups', async () => {
    fillValid();
    auth.bootstrap.mockResolvedValue(makeUser({ isSuperAdmin: true }));
    await component.onSubmit();
    expect(auth.bootstrap).toHaveBeenCalledWith(expect.objectContaining({ email: 'boss@test.com' }));
    expect(nav).toHaveBeenCalledWith('/groups');
  });

  it('shows the server errors in the page', async () => {
    fillValid();
    auth.bootstrap.mockRejectedValue({ error: { errors: ['A valid email is required.'] } });
    await component.onSubmit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.error')?.textContent).toContain('A valid email is required.');
  });
});
