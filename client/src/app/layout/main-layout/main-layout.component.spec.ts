import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MainLayoutComponent } from './main-layout.component';
import { ChatService } from '../../core/chat.service';
import { AuthService } from '../../core/auth.service';
import { RequestService } from '../../core/request.service';
import { ChatServiceMock, makeUser } from '../../../testing/fakes';

describe('MainLayoutComponent', () => {
  let fixture: ComponentFixture<MainLayoutComponent>;
  let chat: ChatServiceMock;
  let me: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    chat = new ChatServiceMock();
    me = vi.fn().mockResolvedValue(makeUser());
    TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        { provide: ChatService, useValue: chat },
        { provide: RequestService, useValue: { getPending: vi.fn().mockResolvedValue([]) } },
      ],
    });
    const auth = TestBed.inject(AuthService);
    auth.currentUser.set(makeUser());
    auth.me = me as any;
    fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  it('connects the socket when the layout opens', () => {
    expect(chat.connect).toHaveBeenCalled();
  });

  it('shows the navbar and a skip link', () => {
    expect(fixture.nativeElement.querySelector('app-navbar')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.skip-link')?.getAttribute('href')).toBe('#main');
  });

  it('shows a popup when a notification arrives and refreshes the user', () => {
    chat.notifications$.next({ text: 'Request approved: joining "Chess".', at: '' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notification')?.textContent).toContain('Request approved');
    expect(me).toHaveBeenCalled();
  });

  it('hides the popup after a few seconds', () => {
    chat.notifications$.next({ text: 'Hi', at: '' });
    vi.advanceTimersByTime(6000);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notification')).toBeNull();
  });

  it('closes a popup with the × button', () => {
    chat.notifications$.next({ text: 'Hi', at: '' });
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.notification__close').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.toasts()).toHaveLength(0);
  });
});
