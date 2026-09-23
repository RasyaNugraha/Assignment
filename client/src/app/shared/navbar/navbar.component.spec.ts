import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NavbarComponent } from './navbar.component';
import { AuthService } from '../../core/auth.service';
import { ChatService } from '../../core/chat.service';
import { RequestService } from '../../core/request.service';
import { ChatServiceMock, makeUser, settle } from '../../../testing/fakes';
import { User } from '../../core/auth.service';

describe('NavbarComponent', () => {
  let fixture: ComponentFixture<NavbarComponent>;
  let chat: ChatServiceMock;
  let getPending: ReturnType<typeof vi.fn>;
  let el: HTMLElement;

  async function render(user: User) {
    TestBed.inject(AuthService).currentUser.set(user);
    fixture = TestBed.createComponent(NavbarComponent);
    el = fixture.nativeElement;
    await settle(fixture);
  }

  beforeEach(() => {
    chat = new ChatServiceMock();
    getPending = vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [
        { provide: ChatService, useValue: chat },
        { provide: RequestService, useValue: { getPending } },
      ],
    });
  });

  it('shows the admin links only to the Super Admin', async () => {
    await render(makeUser({ isSuperAdmin: true }));
    expect(el.textContent).toContain('Admin Queue');
    expect(el.textContent).toContain('Admin Log');
  });

  it('hides the admin links from normal users and skips the badge', async () => {
    await render(makeUser());
    expect(el.textContent).not.toContain('Admin Queue');
    expect(getPending).not.toHaveBeenCalled();
  });

  it('shows the pending request count for a Group Admin', async () => {
    await render(makeUser({ groupAdminOf: ['g1'] }));
    expect(el.querySelector('.badge-count')?.textContent?.trim()).toBe('2');
  });

  it('reloads the badge when the request queue changes', async () => {
    await render(makeUser({ isSuperAdmin: true }));
    getPending.mockResolvedValue([{ id: 'a' }]);
    chat.requestsChanged$.next();
    await settle(fixture);
    expect(el.querySelector('.badge-count')?.textContent?.trim()).toBe('1');
  });

  it('logs out, closes the socket and goes to /login', async () => {
    await render(makeUser());
    const auth = TestBed.inject(AuthService);
    const logout = vi.spyOn(auth, 'logout').mockResolvedValue();
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await fixture.componentInstance.onLogout();
    expect(logout).toHaveBeenCalled();
    expect(chat.disconnect).toHaveBeenCalled();
    expect(nav).toHaveBeenCalledWith('/login');
  });
});
