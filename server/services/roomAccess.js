// Checks if a user is allowed in a room (used by REST and sockets).

const db = require('./dbService');
const { computeAge } = require('./userUtils');

// Returns { ok, room } or { ok: false, status, error }.
async function checkRoomAccess(user, groupId, roomId) {
  if (!user) return { ok: false, status: 401, error: 'Not logged in.' };

  // Super Admin doesn't use chat.
  if (user.isSuperAdmin) {
    return { ok: false, status: 403, error: 'The Super Admin does not take part in chat.' };
  }

  const group = await db.findById('groups', groupId);
  if (!group) return { ok: false, status: 404, error: 'Group not found.' };

  const room = await db.findOne('rooms', { id: roomId, groupId: group.id });
  if (!room) return { ok: false, status: 404, error: 'Room not found.' };

  // Must be a member of the group.
  if (!group.memberIds.includes(user.id)) {
    return { ok: false, status: 403, error: 'Join this group before entering its rooms.' };
  }

  // Must be old enough for the room (R18).
  if (computeAge(user.dateOfBirth) < room.minAge) {
    return {
      ok: false,
      status: 403,
      error: `You must be at least ${room.minAge} to enter this room.`,
      minAge: room.minAge,
    };
  }

  return { ok: true, group, room };
}

module.exports = { checkRoomAccess };
