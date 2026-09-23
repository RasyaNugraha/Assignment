import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { By } from '@angular/platform-browser';

import { LoginComponent } from './login.component';
import { AuthService } from '../../core/auth.service';

// Login form tests with a mocked AuthService.
describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let auth: { needsBootstrap: ReturnType<typeof vi.fn>; login: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    auth = { needsBootstrap: vi.fn().mockResolvedValue(false), login: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginComponent);
  });

  async function submit(email: string, password: string) {
    fixture.detectChanges();
    await fixture.whenStable();
    const [emailInput, passwordInput] = fixture.debugElement.queryAll(By.css('input'));
    emailInput.nativeElement.value = email;
    emailInput.nativeElement.dispatchEvent(new Event('input'));
    passwordInput.nativeElement.value = password;
    passwordInput.nativeElement.dispatchEvent(new Event('input'));
    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('redirects to /bootstrap when the system has no users yet (R2)', async () => {
    auth.needsBootstrap.mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/bootstrap');
  });

  it('logs in with the typed credentials and goes to /groups', async () => {
    auth.login.mockResolvedValue({ id: 'u1' });
    await submit('me@test.com', 'Password1');
    expect(auth.login).toHaveBeenCalledWith('me@test.com', 'Password1');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/groups');
  });

  it("shows the server's error message when login fails", async () => {
    auth.login.mockRejectedValue({ error: { error: 'Invalid email or password.' } });
    await submit('me@test.com', 'wrong');
    expect(fixture.nativeElement.querySelector('.error')?.textContent).toContain('Invalid email or password.');
    expect(router.navigateByUrl).not.toHaveBeenCalledWith('/groups');
  });
});

describe('LoginComponent extra', () => {
  it('has a link to the register page', async () => {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [{ provide: AuthService, useValue: { needsBootstrap: vi.fn().mockResolvedValue(false), login: vi.fn() } }],
    });
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const link = fixture.nativeElement.querySelector('a[href="/register"]');
    expect(link).not.toBeNull();
  });

  it('shows a general message when the server gives no reason', async () => {
    const login = vi.fn().mockRejectedValue({});
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [{ provide: AuthService, useValue: { needsBootstrap: vi.fn().mockResolvedValue(false), login } }],
    });
    const fixture = TestBed.createComponent(LoginComponent);
    await fixture.componentInstance.onSubmit();
    expect(fixture.componentInstance.errorMessage()).toBe('Something went wrong. Please try again.');
    expect(fixture.componentInstance.loading()).toBe(false);
  });
});
