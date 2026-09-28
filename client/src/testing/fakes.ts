// Shared fake data and mock services for the Angular tests.
import { Subject } from 'rxjs';
import { User } from '../app/core/auth.service';
import { AppNotification, ChatMessage, Group, GroupDetail, PresenceNotice, RoomMembersEvent, SocketAck, TypingEvent } from '../app/core/models';

// A normal logged-in user.
export function makeUser(over: Partial<User> = {}): User {
  return {
    id: 'me',
    email: 'me@test.com',
    firstName: 'Me',
    lastName: 'Myself',
    displayName: 'Me Myself',
    dateOfBirth: '2000-01-01',
    age: 26,
    isSuperAdmin: false,
    groupAdminOf: [],
    groupMemberships: [],
    avatarUrl: null,
    preferences: { theme: 'light', fontSize: 'medium' },
    ...over,
  };
}

// A group.
export function makeGroup(over: Partial<Group> = {}): Group {
  return {
    id: 'g1',
    title: 'Chess Club',
    description: 'We play chess',
    minAge: 0,
    backgroundColor: null,
    adminIds: ['admin'],
    memberIds: ['admin'],
    createdAt: '2026-09-01T00:00:00.000Z',
    isMember: false,
    isAdmin: false,
    hasPendingJoinRequest: false,
    ...over,
  };
}

// A group with rooms.
export function makeGroupDetail(over: Partial<GroupDetail> = {}): GroupDetail {
  return { ...makeGroup(), rooms: [], ...over };
}

// A chat message.
export function makeMessage(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
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
  };
}

// Fake ChatService: tests push events through the Subjects, methods are vi.fn().
export class ChatServiceMock {
  messages$ = new Subject<ChatMessage>();
  messageDeleted$ = new Subject<{ roomId: string; messageId: string }>();
  userJoined$ = new Subject<PresenceNotice>();
  userLeft$ = new Subject<PresenceNotice>();
  roomRemoved$ = new Subject<{ roomId: string; groupId: string }>();
  roomMembers$ = new Subject<RoomMembersEvent>();
  notifications$ = new Subject<AppNotification>();
  requestsChanged$ = new Subject<void>();
  typing$ = new Subject<TypingEvent>();

  joinAck: SocketAck = { ok: true, room: { id: 'r1', groupId: 'g1', name: 'general', minAge: 0, createdAt: '' }, messages: [] };
  connect = vi.fn();
  disconnect = vi.fn();
  joinRoom = vi.fn(async () => this.joinAck);
  leaveRoom = vi.fn(async () => ({ ok: true }));
  sendMessage = vi.fn(async (): Promise<SocketAck> => ({ ok: true }));
  deleteMessage = vi.fn(async (): Promise<SocketAck> => ({ ok: true }));
  sendTyping = vi.fn();
}

// Render, wait for promises, render again.
export async function settle(fixture: { detectChanges(): void; whenStable(): Promise<unknown> }): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}
