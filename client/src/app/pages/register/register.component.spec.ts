import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RegisterComponent } from './register.component';
import { AuthService } from '../../core/auth.service';
import { makeUser } from '../../../testing/fakes';

describe('RegisterComponent', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let component: RegisterComponent;
  let auth: { needsBootstrap: ReturnType<typeof vi.fn>; register: ReturnType<typeof vi.fn> };
  let nav: any;

  // Fill the form with valid data.
  function fillValid() {
    Object.assign(component, {
      firstName: 'New',
      lastName: 'User',
      email: 'boss@test.com',
      dateOfBirth: '1990-01-01',
      password: 'Password1',
      confirmPassword: 'Password1',
    });
  }

  beforeEach(async () => {
    auth = { needsBootstrap: vi.fn().mockResolvedValue(true), register: vi.fn() };
    TestBed.configureTestingModule({ imports: [RegisterComponent], providers: [{ provide: AuthService, useValue: auth }] });
    nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('is created with an empty form', () => {
    expect(component.email).toBe('');
    expect(component.errorMessage()).toBeNull();
  });

  it('does not submit when the passwords do not match', async () => {
    fillValid();
    component.confirmPassword = 'Password2';
    await component.onSubmit();
    expect(auth.register).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe('Passwords do not match.');
  });

  it('does not submit a date of birth in the future', async () => {
    fillValid();
    component.dateOfBirth = '2999-01-01';
    await component.onSubmit();
    expect(auth.register).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe('Date of birth cannot be in the future.');
  });

  it('does not submit a weak password', async () => {
    fillValid();
    component.password = component.confirmPassword = 'weak';
    await component.onSubmit();
    expect(auth.register).not.toHaveBeenCalled();
    expect(component.errorMessage()).toContain('at least 8 characters');
  });

  it('registers and goes to /groups', async () => {
    fillValid();
    auth.register.mockResolvedValue(makeUser());
    await component.onSubmit();
    expect(auth.register).toHaveBeenCalledWith(expect.objectContaining({ email: 'boss@test.com' }));
    expect(nav).toHaveBeenCalledWith('/groups');
  });

  it('shows the server errors in the page', async () => {
    fillValid();
    auth.register.mockRejectedValue({ error: { errors: ['A valid email is required.'] } });
    await component.onSubmit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.error')?.textContent).toContain('A valid email is required.');
  });
});
