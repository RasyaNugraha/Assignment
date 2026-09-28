// Integration tests for the socket chat.
const { io: ioClient } = require('socket.io-client');
const { expect, clearDb, db, userFields } = require('./helpers');
const chai = require('chai');
const { createServer } = require('../server');

const tinyPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// Emit an event and wait for the reply.
const emit = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));
// Wait for the next event of this type.
const nextEvent = (socket, event) => new Promise((resolve) => socket.once(event, resolve));

describe('Real-time chat (Socket.IO)', function () {
  this.timeout(10000);
  let server;
  let baseUrl;
  let group;
  let room;
  const sockets = [];

  // Get the session cookie of a logged-in agent.
  async function cookieFor(agent) {
    const res = await agent.get('/api/auth/me');
    return res.request.cookies || res.request.header.Cookie;
  }

  function connect(cookie) {
    const socket = ioClient(baseUrl, { extraHeaders: { cookie }, transports: ['websocket'], forceNew: true });
    sockets.push(socket);
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  }

  let cookies;
  const users = {};

  before(async () => {
    await clearDb();
    ({ server } = createServer());
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://localhost:${server.address().port}`;

    const agents = {
      superAdmin: chai.request.agent(baseUrl),
      alice: chai.request.agent(baseUrl),
      bob: chai.request.agent(baseUrl),
      carol: chai.request.agent(baseUrl),
    };
    await agents.superAdmin.post('/api/bootstrap').send(userFields('super'));
    users.alice = (await agents.alice.post('/api/auth/register').send(userFields('alice'))).body;
    users.bob = (await agents.bob.post('/api/auth/register').send(userFields('bob'))).body;
    users.carol = (await agents.carol.post('/api/auth/register').send(userFields('carol'))).body;

    const gr = (await agents.alice.post('/api/groups/requests').send({ title: 'Chat Group' })).body;
    await agents.superAdmin.post(`/api/requests/${gr.id}/approve`);
    group = (await agents.alice.get('/api/groups')).body[0];
    const join = (await agents.bob.post(`/api/groups/${group.id}/join`)).body;
    await agents.alice.post(`/api/requests/${join.id}/approve`);
    const rr = (await agents.alice.post(`/api/groups/${group.id}/rooms/requests`).send({ name: 'general', minAge: 0 })).body;
    await agents.alice.post(`/api/requests/${rr.id}/approve`);
    room = (await agents.alice.get(`/api/groups/${group.id}`)).body.rooms[0];

    cookies = {};
    for (const [name, agent] of Object.entries(agents)) {
      cookies[name] = await cookieFor(agent);
      agent.close();
    }
  });

  after(async () => {
    sockets.forEach((s) => s.disconnect());
    await new Promise((resolve) => server.close(resolve));
  });

  describe('connecting', () => {
    it('refuses a socket without a logged-in session', async () => {
      const socket = ioClient(baseUrl, { transports: ['websocket'], forceNew: true });
      sockets.push(socket);
      const err = await new Promise((resolve) => socket.once('connect_error', resolve));
      expect(err.message).to.equal('Not logged in.');
    });

    it('accepts a socket with a valid session cookie', async () => {
      const socket = await connect(cookies.alice);
      expect(socket.connected).to.equal(true);
    });
  });

  describe('room:join', () => {
    it('lets a member join and returns the room history', async () => {
      const alice = await connect(cookies.alice);
      const res = await emit(alice, 'room:join', { groupId: group.id, roomId: room.id });
      expect(res.ok).to.equal(true);
      expect(res.messages).to.be.an('array');
    });

    it('refuses a user who is not a member of the group', async () => {
      const carol = await connect(cookies.carol);
      const res = await emit(carol, 'room:join', { groupId: group.id, roomId: room.id });
      expect(res.ok).to.equal(false);
    });

    it('refuses the Super Admin', async () => {
      const sa = await connect(cookies.superAdmin);
      const res = await emit(sa, 'room:join', { groupId: group.id, roomId: room.id });
      expect(res.ok).to.equal(false);
    });

    it('notifies people already in the room when someone joins and leaves', async () => {
      const alice = await connect(cookies.alice);
      await emit(alice, 'room:join', { groupId: group.id, roomId: room.id });
      const bob = await connect(cookies.bob);

      const joined = nextEvent(alice, 'room:user-joined');
      await emit(bob, 'room:join', { groupId: group.id, roomId: room.id });
      expect((await joined).user.displayName).to.equal('bob Tester');

      const left = nextEvent(alice, 'room:user-left');
      await emit(bob, 'room:leave', { roomId: room.id });
      expect((await left).user.id).to.equal(users.bob.id);
    });
  });

  describe('room:members (who is online)', () => {
    it('sends the online list to the room when someone joins and leaves', async () => {
      const alice = await connect(cookies.alice);
      await emit(alice, 'room:join', { groupId: group.id, roomId: room.id });
      const bob = await connect(cookies.bob);

      const withBob = new Promise((resolve) => {
        alice.on('room:members', (e) => e.members.some((m) => m.id === users.bob.id) && resolve(e));
      });
      await emit(bob, 'room:join', { groupId: group.id, roomId: room.id });
      expect((await withBob).members.map((m) => m.displayName)).to.include.members(['alice Tester', 'bob Tester']);

      const withoutBob = new Promise((resolve) => {
        alice.on('room:members', (e) => !e.members.some((m) => m.id === users.bob.id) && resolve(e));
      });
      await emit(bob, 'room:leave', { roomId: room.id });
      expect((await withoutBob).members.map((m) => m.id)).to.not.include(users.bob.id);
    });

    it('a user who left the room no longer gets its messages', async () => {
      const alice = await connect(cookies.alice);
      const bob = await connect(cookies.bob);
      await emit(alice, 'room:join', { groupId: group.id, roomId: room.id });
      await emit(bob, 'room:join', { groupId: group.id, roomId: room.id });
      await emit(bob, 'room:leave', { roomId: room.id });

      let bobGotIt = false;
      bob.on('message:new', () => { bobGotIt = true; });
      const aliceGotIt = nextEvent(alice, 'message:new');
      await emit(alice, 'message:send', { roomId: room.id, text: 'bob is gone' });
      await aliceGotIt;
      await new Promise((r) => setTimeout(r, 200));
      expect(bobGotIt).to.equal(false);
    });
  });

  describe('room:typing', () => {
    it('tells the others in the room who is typing, but not the typer', async () => {
      const alice = await connect(cookies.alice);
      const bob = await connect(cookies.bob);
      await emit(alice, 'room:join', { groupId: group.id, roomId: room.id });
      await emit(bob, 'room:join', { groupId: group.id, roomId: room.id });

      let aliceGotOwn = false;
      alice.on('room:typing', () => { aliceGotOwn = true; });
      const started = nextEvent(bob, 'room:typing');
      alice.emit('room:typing', { roomId: room.id, typing: true });
      const e = await started;
      expect(e).to.include({ roomId: room.id, typing: true });
      expect(e.user).to.deep.equal({ id: users.alice.id, displayName: 'alice Tester' });

      const stopped = nextEvent(bob, 'room:typing');
      alice.emit('room:typing', { roomId: room.id, typing: false });
      expect((await stopped).typing).to.equal(false);
      await new Promise((r) => setTimeout(r, 100));
      expect(aliceGotOwn).to.equal(false);
    });

    it('ignores typing from a socket that has not joined the room', async () => {
      const alice = await connect(cookies.alice);
      const bob = await connect(cookies.bob);
      await emit(bob, 'room:join', { groupId: group.id, roomId: room.id });

      let bobGotIt = false;
      bob.on('room:typing', () => { bobGotIt = true; });
      alice.emit('room:typing', { roomId: room.id, typing: true });
      await new Promise((r) => setTimeout(r, 200));
      expect(bobGotIt).to.equal(false);
    });
  });

  describe('notifications', () => {
    it('tells the requester when their join request is approved', async () => {
      const carol = await connect(cookies.carol);
      const aliceAgent = chai.request.agent(baseUrl);
      await aliceAgent.post('/api/auth/login').send({ email: 'alice@test.com', password: 'Password1' });
      const carolAgent = chai.request.agent(baseUrl);
      await carolAgent.post('/api/auth/login').send({ email: 'carol@test.com', password: 'Password1' });

      const join = (await carolAgent.post(`/api/groups/${group.id}/join`)).body;
      const note = nextEvent(carol, 'notification');
      await aliceAgent.post(`/api/requests/${join.id}/approve`);
      expect((await note).text).to.equal('Request approved: joining "Chat Group".');
      aliceAgent.close();
      carolAgent.close();
    });

    it('tells every client when the request queue changes', async () => {
      const alice = await connect(cookies.alice);
      const bobAgent = chai.request.agent(baseUrl);
      await bobAgent.post('/api/auth/login').send({ email: 'bob@test.com', password: 'Password1' });
      const changed = nextEvent(alice, 'requests:changed');
      await bobAgent.post(`/api/groups/${group.id}/rooms/requests`).send({ name: 'new-room' });
      await changed;
      bobAgent.close();
    });
  });

  describe('message:send', () => {
    let alice;
    let bob;
    before(async () => {
      alice = await connect(cookies.alice);
      bob = await connect(cookies.bob);
      await emit(alice, 'room:join', { groupId: group.id, roomId: room.id });
      await emit(bob, 'room:join', { groupId: group.id, roomId: room.id });
    });

    it('broadcasts a text message to everyone in the room, with sender + timestamp', async () => {
      const received = nextEvent(bob, 'message:new');
      const res = await emit(alice, 'message:send', { roomId: room.id, text: 'Hello Bob', clientSentAt: new Date().toISOString() });
      expect(res.ok).to.equal(true);
      const msg = await received;
      expect(msg.text).to.equal('Hello Bob');
      expect(msg.senderId).to.equal(users.alice.id);
      expect(msg.sentAt).to.be.a('string');
    });

    it('sends an image message', async () => {
      const res = await emit(bob, 'message:send', { roomId: room.id, imageUrl: tinyPng });
      expect(res.ok).to.equal(true);
      expect(res.message.imageUrl).to.equal(tinyPng);
    });

    it('rejects an empty message and an unsupported image type', async () => {
      expect((await emit(bob, 'message:send', { roomId: room.id, text: '  ' })).ok).to.equal(false);
      const webp = tinyPng.replace('image/png', 'image/webp');
      expect((await emit(bob, 'message:send', { roomId: room.id, imageUrl: webp })).ok).to.equal(false);
    });

    it('keeps only the last 5 messages of a room in MongoDB', async () => {
      for (let i = 1; i <= 7; i += 1) {
        await emit(alice, 'message:send', { roomId: room.id, text: `msg ${i}` });
      }
      const stored = await db.findMany('messages', { roomId: room.id }, { sort: { seq: 1 } });
      expect(stored.map((m) => m.text)).to.deep.equal(['msg 3', 'msg 4', 'msg 5', 'msg 6', 'msg 7']);

      const history = await emit(bob, 'room:join', { groupId: group.id, roomId: room.id });
      expect(history.messages).to.have.length(5);
    });
  });

  describe('message:delete', () => {
    let alice;
    let bob;
    before(async () => {
      alice = await connect(cookies.alice);
      bob = await connect(cookies.bob);
      await emit(alice, 'room:join', { groupId: group.id, roomId: room.id });
      await emit(bob, 'room:join', { groupId: group.id, roomId: room.id });
    });

    it('lets the sender delete their own message and tells everyone in the room', async () => {
      const sent = await emit(alice, 'message:send', { roomId: room.id, text: 'oops' });
      const deleted = nextEvent(bob, 'message:deleted');
      const res = await emit(alice, 'message:delete', { roomId: room.id, messageId: sent.message.id });
      expect(res.ok).to.equal(true);
      expect((await deleted).messageId).to.equal(sent.message.id);
      expect(await db.findById('messages', sent.message.id)).to.equal(null);
    });

    it("refuses to delete someone else's message", async () => {
      const sent = await emit(alice, 'message:send', { roomId: room.id, text: 'mine' });
      const res = await emit(bob, 'message:delete', { roomId: room.id, messageId: sent.message.id });
      expect(res.ok).to.equal(false);
      expect(await db.findById('messages', sent.message.id)).to.not.equal(null);
    });

    it('still lets the sender delete a message that is no longer stored on the server', async () => {
      const old = await emit(alice, 'message:send', { roomId: room.id, text: 'soon gone' });
      for (let i = 0; i < 5; i += 1) await emit(bob, 'message:send', { roomId: room.id, text: `push ${i}` });
      expect(await db.findById('messages', old.message.id)).to.equal(null); // fell out of last 5

      const deleted = nextEvent(bob, 'message:deleted');
      const res = await emit(alice, 'message:delete', { roomId: room.id, messageId: old.message.id });
      expect(res.ok).to.equal(true);
      expect((await deleted).messageId).to.equal(old.message.id);
    });
  });
});
