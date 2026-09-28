// Socket.IO chat: join/leave rooms, send and delete messages.

const db = require('../services/dbService');
const { checkRoomAccess } = require('../services/roomAccess');
const {
  MESSAGES_KEPT_PER_ROOM,
  validateMessagePayload,
  resolveSentAt,
  nextSequence,
  signMessageId,
  isMessageOwnedBy,
} = require('../services/messageUtils');

const channel = (roomId) => `room:${roomId}`;

// Delete old messages so only the last 5 stay in the room.
async function trimRoomMessages(roomId, keep = MESSAGES_KEPT_PER_ROOM) {
  const newest = await db.findMany('messages', { roomId }, { sort: { seq: -1 }, limit: keep });
  const keepIds = newest.map((m) => m.id);
  return db.removeMany('messages', { roomId, id: { $nin: keepIds } });
}

// Last 5 messages, oldest first.
async function lastMessages(roomId) {
  const newestFirst = await db.findMany(
    'messages',
    { roomId },
    { sort: { seq: -1 }, limit: MESSAGES_KEPT_PER_ROOM },
  );
  return newestFirst.reverse(); // oldest → newest, the order a chat shows them
}

// Only id + name.
function publicUser(user) {
  return { id: user.id, displayName: user.displayName };
}

// Who is in a room right now (one entry per user, even with many tabs).
async function roomMembers(io, roomId) {
  const sockets = await io.in(channel(roomId)).fetchSockets();
  const byId = new Map();
  for (const s of sockets) if (s.data.user) byId.set(s.data.user.id, s.data.user);
  return [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

// Send the updated "who's online" list to everyone in the room.
async function broadcastMembers(io, roomId) {
  io.to(channel(roomId)).emit('room:members', { roomId, members: await roomMembers(io, roomId) });
}

// Set up all socket events.
function registerChatHandlers(io, { messageSecret }) {
  // Only logged-in users can connect.
  io.use((socket, next) => {
    if (socket.request.session?.userId) return next();
    next(new Error('Not logged in.'));
  });

  io.on('connection', (socket) => {
    // Personal channel for notifications (e.g. "your request was approved").
    socket.join(`user:${socket.request.session.userId}`);

    // Rooms this socket is in (roomId -> groupId).
    const joinedRooms = new Map();

    // Get the latest user from the db each time.
    const loadUser = () => db.findById('users', socket.request.session?.userId);

    // Wrapper so every event always replies and errors don't crash the server.
    const handle = (event, fn) => {
      socket.on(event, async (payload, ack) => {
        const reply = typeof ack === 'function' ? ack : () => {};
        try {
          const user = await loadUser();
          if (!user) return reply({ ok: false, error: 'Not logged in.' });
          reply(await fn(user, payload ?? {}));
        } catch (err) {
          console.error(`[socket] ${event} failed:`, err);
          reply({ ok: false, error: 'Something went wrong. Try again.' });
        }
      });
    };

    // Join a room.
    handle('room:join', async (user, { groupId, roomId }) => {
      const access = await checkRoomAccess(user, groupId, roomId);
      if (!access.ok) return { ok: false, error: access.error, minAge: access.minAge };

      const alreadyInside = joinedRooms.has(roomId);
      socket.data.user = publicUser(user);
      await socket.join(channel(roomId));
      joinedRooms.set(roomId, groupId);

      // Tell everyone else in the room that this user joined.
      if (!alreadyInside) {
        socket.to(channel(roomId)).emit('room:user-joined', {
          roomId,
          user: publicUser(user),
          at: new Date().toISOString(),
        });
      }
      await broadcastMembers(io, roomId);
      return { ok: true, room: access.room, messages: await lastMessages(roomId) };
    });

    // Leave a room.
    handle('room:leave', async (user, { roomId }) => {
      if (joinedRooms.has(roomId)) {
        joinedRooms.delete(roomId);
        await socket.leave(channel(roomId));
        socket.to(channel(roomId)).emit('room:user-left', {
          roomId,
          user: publicUser(user),
          at: new Date().toISOString(),
        });
        await broadcastMembers(io, roomId);
      }
      return { ok: true };
    });

    // Send a message.
    handle('message:send', async (user, { roomId, text, imageUrl, clientSentAt }) => {
      if (!joinedRooms.has(roomId)) return { ok: false, error: 'Join the room before sending messages.' };

      // Check again in case they got banned or the room was removed.
      const access = await checkRoomAccess(user, joinedRooms.get(roomId), roomId);
      if (!access.ok) return { ok: false, error: access.error };

      const payload = validateMessagePayload({ text, imageUrl });
      if (!payload.ok) return { ok: false, error: payload.error };

      const message = {
        id: signMessageId(user.id, messageSecret),
        roomId,
        groupId: access.group.id,
        senderId: user.id,
        senderDisplayName: user.displayName,
        senderHasAvatar: Boolean(user.avatarUrl), // client loads /api/users/:id/avatar
        text: payload.text,
        imageUrl: payload.imageUrl,
        sentAt: resolveSentAt(clientSentAt), // when "send" was pressed (§8)
        seq: nextSequence(), // strictly increasing server order, used for last-5
      };
      await db.insert('messages', message);
      await trimRoomMessages(roomId);

      io.to(channel(roomId)).emit('message:new', message);
      return { ok: true, message };
    });

    // Users can only delete their own messages (checked with the signed id).
    handle('message:delete', async (user, { roomId, messageId }) => {
      if (!joinedRooms.has(roomId)) return { ok: false, error: 'Join the room first.' };
      if (!isMessageOwnedBy(messageId, user.id, messageSecret)) {
        return { ok: false, error: 'You can only delete your own messages.' };
      }
      await db.removeMany('messages', { id: messageId, roomId });
      io.to(channel(roomId)).emit('message:deleted', { roomId, messageId });
      return { ok: true };
    });

    // "X is typing…": pass it on to the others in the room (no db, no reply).
    socket.on('room:typing', (payload) => {
      const roomId = payload?.roomId;
      if (!joinedRooms.has(roomId) || !socket.data.user) return;
      socket.to(channel(roomId)).emit('room:typing', {
        roomId,
        user: socket.data.user,
        typing: payload.typing === true,
      });
    });

    // Closing the tab = leaving all rooms.
    socket.on('disconnect', async () => {
      if (!joinedRooms.size) return;
      const user = await loadUser().catch(() => null);
      const who = user ? publicUser(user) : { id: socket.request.session?.userId, displayName: 'A user' };
      for (const roomId of joinedRooms.keys()) {
        socket.to(channel(roomId)).emit('room:user-left', { roomId, user: who, at: new Date().toISOString() });
        await broadcastMembers(io, roomId);
      }
      joinedRooms.clear();
    });
  });
}

module.exports = { registerChatHandlers, trimRoomMessages, lastMessages, roomMembers };
