import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

import { AppNotification, ChatMessage, PresenceNotice, RoomMembersEvent, SocketAck } from './models';

// Handles all Socket.IO stuff for the chat.

// Creates the socket (tests swap this for a fake one).
export type SocketFactory = () => Socket;
export const SOCKET_FACTORY = new InjectionToken<SocketFactory>('SOCKET_FACTORY', {
  providedIn: 'root',
  // Same origin, the proxy sends it to the server.
  factory: () => () => io({ withCredentials: true, autoConnect: false }),
});

export interface RoomRemovedEvent {
  roomId: string;
  groupId: string;
}

export interface MessageDeletedEvent {
  roomId: string;
  messageId: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private createSocket = inject(SOCKET_FACTORY);
  private socket: Socket | null = null;

  private messageSubject = new Subject<ChatMessage>();
  private deletedSubject = new Subject<MessageDeletedEvent>();
  private joinedSubject = new Subject<PresenceNotice>();
  private leftSubject = new Subject<PresenceNotice>();
  private roomRemovedSubject = new Subject<RoomRemovedEvent>();
  private membersSubject = new Subject<RoomMembersEvent>();
  private notificationSubject = new Subject<AppNotification>();
  private requestsChangedSubject = new Subject<void>();

  readonly messages$: Observable<ChatMessage> = this.messageSubject.asObservable();
  readonly messageDeleted$: Observable<MessageDeletedEvent> = this.deletedSubject.asObservable();
  readonly userJoined$: Observable<PresenceNotice> = this.joinedSubject.asObservable();
  readonly userLeft$: Observable<PresenceNotice> = this.leftSubject.asObservable();
  readonly roomRemoved$: Observable<RoomRemovedEvent> = this.roomRemovedSubject.asObservable();
  readonly roomMembers$: Observable<RoomMembersEvent> = this.membersSubject.asObservable();
  readonly notifications$: Observable<AppNotification> = this.notificationSubject.asObservable();
  readonly requestsChanged$: Observable<void> = this.requestsChangedSubject.asObservable();

  // Connect on first use and listen for server events.
  private ensureConnected(): Socket {
    if (this.socket) return this.socket;
    const socket = this.createSocket();
    socket.on('message:new', (m: ChatMessage) => this.messageSubject.next(m));
    socket.on('message:deleted', (e: MessageDeletedEvent) => this.deletedSubject.next(e));
    socket.on('room:user-joined', (n: PresenceNotice) => this.joinedSubject.next(n));
    socket.on('room:user-left', (n: PresenceNotice) => this.leftSubject.next(n));
    socket.on('room:removed', (e: RoomRemovedEvent) => this.roomRemovedSubject.next(e));
    socket.on('room:members', (e: RoomMembersEvent) => this.membersSubject.next(e));
    socket.on('notification', (n: AppNotification) => this.notificationSubject.next(n));
    socket.on('requests:changed', () => this.requestsChangedSubject.next());
    socket.connect();
    this.socket = socket;
    return socket;
  }

  // Open the connection after login (for notifications).
  connect(): void {
    this.ensureConnected();
  }

  // Emit an event and return the server's reply as a Promise.
  private request(event: string, payload: object): Promise<SocketAck> {
    const socket = this.ensureConnected();
    return new Promise((resolve) => {
      socket.timeout(10000).emit(event, payload, (err: Error | null, ack: SocketAck) => {
        resolve(err ? { ok: false, error: 'The chat server did not respond. Check your connection.' } : ack);
      });
    });
  }

  // Join a room, gets back the room + last messages.
  joinRoom(groupId: string, roomId: string): Promise<SocketAck> {
    return this.request('room:join', { groupId, roomId });
  }

  // Leave a room.
  leaveRoom(roomId: string): Promise<SocketAck> {
    if (!this.socket) return Promise.resolve({ ok: true });
    return this.request('room:leave', { roomId });
  }

  // Send a message (with the time send was pressed).
  sendMessage(roomId: string, text: string, imageUrl: string | null = null): Promise<SocketAck> {
    return this.request('message:send', { roomId, text, imageUrl, clientSentAt: new Date().toISOString() });
  }

  // Delete one of my messages.
  deleteMessage(roomId: string, messageId: string): Promise<SocketAck> {
    return this.request('message:delete', { roomId, messageId });
  }

  // Close the socket (on logout).
  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }
}
