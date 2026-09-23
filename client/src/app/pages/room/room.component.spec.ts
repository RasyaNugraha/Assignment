import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { RoomComponent } from './room.component';
import { ChatService } from '../../core/chat.service';
import { AuthService } from '../../core/auth.service';
import { ChatMessage } from '../../core/models';
import { ChatServiceMock } from '../../../testing/fakes';

const msg = (over: Partial<ChatMessage>): ChatMessage => ({
  id: 'm1.sig',
  roomId: 'r1',
  groupId: 'g1',
  senderId: 'me',
  senderDisplayName: 'Me Myself',
  senderHasAvatar: false,
  text: 'hello',
  imageUrl: null,
  sentAt: '2026-09-23T10:00:00.000Z',
  seq: 1,
  ...over,
});

describe('RoomComponent', () => {
  let fixture: ComponentFixture<RoomComponent>;
  let component: RoomComponent;
  let chat: ChatServiceMock;
  let el: HTMLElement;
  const params = new BehaviorSubject(convertToParamMap({ groupId: 'g1', roomId: 'r1' }));

  async function render() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    chat = new ChatServiceMock();
    await TestBed.configureTestingModule({
      imports: [RoomComponent],
      providers: [
        { provide: ChatService, useValue: chat },
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    }).compileComponents();

    TestBed.inject(AuthService).currentUser.set({
      id: 'me',
      email: 'me@test.com',
      firstName: 'Me',
      lastName: 'Myself',
      displayName: 'Me Myself',
      dateOfBirth: '2000-01-01',
      age: 26,
      isSuperAdmin: false,
      groupAdminOf: [],
      groupMemberships: ['g1'],
      avatarUrl: null,
      preferences: { theme: 'light', fontSize: 'medium' },
    });

    fixture = TestBed.createComponent(RoomComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  it('joins the room from the route params and shows its name', async () => {
    await render();
    expect(chat.joinRoom).toHaveBeenCalledWith('g1', 'r1');
    expect(el.querySelector('.room__title')?.textContent).toContain('#general');
  });

  it('renders the stored history (last 5) returned on join', async () => {
    chat.joinAck = { ...chat.joinAck, messages: [msg({ id: 'a.1', text: 'first' }), msg({ id: 'b.2', text: 'second' })] };
    await render();
    const texts = Array.from(el.querySelectorAll('.message__text')).map((p) => p.textContent);
    expect(texts).toEqual(['first', 'second']);
  });

  it('adds messages pushed live by the server', async () => {
    await render();
    chat.messages$.next(msg({ id: 'live.1', senderId: 'other', senderDisplayName: 'Bob', text: 'live one' }));
    fixture.detectChanges();
    expect(el.textContent).toContain('live one');
  });

  it('ignores messages for a different room', async () => {
    await render();
    chat.messages$.next(msg({ id: 'x.1', roomId: 'other-room', text: 'not here' }));
    fixture.detectChanges();
    expect(el.textContent).not.toContain('not here');
  });

  it('shows a Delete button only on my own messages', async () => {
    chat.joinAck = {
      ...chat.joinAck,
      messages: [msg({ id: 'mine.1' }), msg({ id: 'theirs.1', senderId: 'other', senderDisplayName: 'Bob' })],
    };
    await render();
    const articles = el.querySelectorAll('article.message');
    expect(articles[0].querySelector('.message__delete')).not.toBeNull();
    expect(articles[1].querySelector('.message__delete')).toBeNull();
  });

  it('removes a message when the server broadcasts its deletion', async () => {
    chat.joinAck = { ...chat.joinAck, messages: [msg({ id: 'gone.1', text: 'bye' })] };
    await render();
    chat.messageDeleted$.next({ roomId: 'r1', messageId: 'gone.1' });
    fixture.detectChanges();
    expect(el.textContent).not.toContain('bye');
  });

  it('shows a popup when another user joins', async () => {
    await render();
    chat.userJoined$.next({ roomId: 'r1', user: { id: 'other', displayName: 'Bob' }, at: '' });
    fixture.detectChanges();
    expect(el.querySelector('.toast')?.textContent).toContain('Bob joined the room');
  });

  it('sends the typed text through the ChatService and clears the box', async () => {
    await render();
    component.draftText = 'typed message';
    await component.onSend();
    expect(chat.sendMessage).toHaveBeenCalledWith('r1', 'typed message', null);
    expect(component.draftText).toBe('');
  });

  it('disables Send while the message box is empty', async () => {
    await render();
    const send = el.querySelector<HTMLButtonElement>('button.room__send')!;
    expect(send.disabled).toBe(true);
    expect(component.canSend()).toBe(false);
  });

  it('redirects back to the group with the age banner when the server blocks entry', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    chat.joinAck = { ok: false, error: 'You must be at least 18 to enter this room.', minAge: 18 };
    await render();
    expect(navigate).toHaveBeenCalledWith(['/groups', 'g1'], { queryParams: { ageBlocked: 18 } });
  });

  it('shows who is online in the room', async () => {
    await render();
    chat.roomMembers$.next({ roomId: 'r1', members: [{ id: 'me', displayName: 'Me Myself' }, { id: 'b', displayName: 'Bob' }] });
    fixture.detectChanges();
    const online = el.querySelector('.room__online')?.textContent ?? '';
    expect(online).toContain('Online (2)');
    expect(online).toContain('You');
    expect(online).toContain('Bob');
  });

  it('shows the error from the server when a message is not sent', async () => {
    await render();
    chat.sendMessage.mockResolvedValueOnce({ ok: false, error: 'Images must be PNG, GIF or JPEG.' });
    component.draftText = 'x';
    await component.onSend();
    fixture.detectChanges();
    expect(el.querySelector('.room__error')?.textContent).toContain('Images must be PNG, GIF or JPEG.');
  });

  it('goes back to the group when the room is removed', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await render();
    chat.roomRemoved$.next({ roomId: 'r1', groupId: 'g1' });
    expect(navigate).toHaveBeenCalledWith(['/groups', 'g1'], { queryParams: { roomRemoved: 1 } });
  });

  it('leaves the room when the component is destroyed', async () => {
    await render();
    fixture.destroy();
    expect(chat.leaveRoom).toHaveBeenCalledWith('r1');
  });
});
