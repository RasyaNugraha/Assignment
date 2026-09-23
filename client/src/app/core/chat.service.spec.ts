import { TestBed } from '@angular/core/testing';
import { ChatService, SOCKET_FACTORY } from './chat.service';
import { ChatMessage } from './models';

// Fake socket for testing (no real connection).
class FakeSocket {
  handlers = new Map<string, (payload: unknown) => void>();
  emitted: { event: string; payload: any }[] = [];
  nextAck: any = { ok: true };
  connected = false;

  on(event: string, handler: (payload: unknown) => void) {
    this.handlers.set(event, handler);
    return this;
  }
  connect() {
    this.connected = true;
    return this;
  }
  disconnect() {
    this.connected = false;
    return this;
  }
  removeAllListeners() {
    this.handlers.clear();
    return this;
  }
  timeout() {
    return this;
  }
  emit(event: string, payload: any, ack: (err: Error | null, reply: unknown) => void) {
    this.emitted.push({ event, payload });
    ack(null, this.nextAck);
    return this;
  }
  // Pretend the server sent an event.
  serverPush(event: string, payload: unknown) {
    this.handlers.get(event)?.(payload);
  }
}

const sampleMessage: ChatMessage = {
  id: 'm1.sig',
  roomId: 'r1',
  groupId: 'g1',
  senderId: 'u1',
  senderDisplayName: 'Alice',
  senderHasAvatar: false,
  text: 'hello',
  imageUrl: null,
  sentAt: '2026-09-23T10:00:00.000Z',
  seq: 1,
};

describe('ChatService', () => {
  let service: ChatService;
  let socket: FakeSocket;
  let created: number;

  beforeEach(() => {
    socket = new FakeSocket();
    created = 0;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SOCKET_FACTORY,
          useValue: () => {
            created += 1;
            return socket;
          },
        },
      ],
    });
    service = TestBed.inject(ChatService);
  });

  it('does not open a connection until it is first needed', () => {
    expect(created).toBe(0);
  });

  it('joinRoom() connects once and emits room:join with the ids', async () => {
    socket.nextAck = { ok: true, messages: [sampleMessage] };
    const ack = await service.joinRoom('g1', 'r1');
    await service.joinRoom('g1', 'r1');
    expect(created).toBe(1);
    expect(socket.connected).toBe(true);
    expect(socket.emitted[0]).toEqual({ event: 'room:join', payload: { groupId: 'g1', roomId: 'r1' } });
    expect(ack.messages).toEqual([sampleMessage]);
  });

  it('sendMessage() includes the time "send" was pressed', async () => {
    await service.sendMessage('r1', 'hi there');
    const { event, payload } = socket.emitted[0];
    expect(event).toBe('message:send');
    expect(payload.text).toBe('hi there');
    expect(payload.imageUrl).toBeNull();
    expect(new Date(payload.clientSentAt).getTime()).not.toBeNaN();
  });

  it('deleteMessage() emits message:delete', async () => {
    await service.deleteMessage('r1', 'm1.sig');
    expect(socket.emitted[0]).toEqual({ event: 'message:delete', payload: { roomId: 'r1', messageId: 'm1.sig' } });
  });

  it('turns server pushes into Observable values', async () => {
    const received: ChatMessage[] = [];
    const joined: string[] = [];
    service.messages$.subscribe((m) => received.push(m));
    service.userJoined$.subscribe((n) => joined.push(n.user.displayName));
    await service.joinRoom('g1', 'r1');

    socket.serverPush('message:new', sampleMessage);
    socket.serverPush('room:user-joined', { roomId: 'r1', user: { id: 'u2', displayName: 'Bob' }, at: '' });

    expect(received).toEqual([sampleMessage]);
    expect(joined).toEqual(['Bob']);
  });

  it('leaveRoom() before connecting resolves without opening a socket', async () => {
    await expect(service.leaveRoom('r1')).resolves.toEqual({ ok: true });
    expect(created).toBe(0);
  });

  it('disconnect() closes the socket so the next use opens a fresh one', async () => {
    await service.joinRoom('g1', 'r1');
    service.disconnect();
    expect(socket.connected).toBe(false);
    await service.joinRoom('g1', 'r1');
    expect(created).toBe(2);
  });
});

describe('ChatService live updates', () => {
  let service: ChatService;
  let socket: FakeSocket;

  beforeEach(() => {
    socket = new FakeSocket();
    TestBed.configureTestingModule({ providers: [{ provide: SOCKET_FACTORY, useValue: () => socket }] });
    service = TestBed.inject(ChatService);
  });

  it('connect() opens the socket straight away', () => {
    service.connect();
    expect(socket.connected).toBe(true);
  });

  it('turns notification events into notifications$', () => {
    const texts: string[] = [];
    service.notifications$.subscribe((n) => texts.push(n.text));
    service.connect();
    socket.serverPush('notification', { text: 'Request approved', at: '' });
    expect(texts).toEqual(['Request approved']);
  });

  it('turns room:members into roomMembers$', () => {
    const counts: number[] = [];
    service.roomMembers$.subscribe((e) => counts.push(e.members.length));
    service.connect();
    socket.serverPush('room:members', { roomId: 'r1', members: [{ id: 'a', displayName: 'A' }] });
    expect(counts).toEqual([1]);
  });

  it('turns requests:changed into requestsChanged$', () => {
    let calls = 0;
    service.requestsChanged$.subscribe(() => calls++);
    service.connect();
    socket.serverPush('requests:changed', undefined);
    expect(calls).toBe(1);
  });

  it('returns a friendly error when the server does not answer', async () => {
    socket.emit = (event: string, payload: any, ack: (err: Error | null, reply: unknown) => void) => {
      ack(new Error('timeout'), undefined);
      return socket;
    };
    const ack = await service.joinRoom('g1', 'r1');
    expect(ack.ok).toBe(false);
    expect(ack.error).toContain('did not respond');
  });
});
