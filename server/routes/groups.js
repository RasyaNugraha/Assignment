// Group and room routes.

const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../services/dbService');
const requireAuth = require('../middleware/requireAuth');
const { computeAge } = require('../services/userUtils');
const { checkRoomAccess } = require('../services/roomAccess');
const { MESSAGES_KEPT_PER_ROOM } = require('../services/messageUtils');
const { parsePaging, buildGroupFilter } = require('../services/paging');
const { notifyRequestsChanged } = require('../sockets/notify');

const router = express.Router();

const TITLE_MAX = 30; // R13
const DESCRIPTION_MAX = 250; // R13
const ROOM_NAME_MAX = 30;

// Add isMember / isAdmin / hasPendingJoinRequest for the current user.
function toPublicGroup(group, currentUser, pendingJoinGroupIds = new Set()) {
  const isMember = currentUser ? group.memberIds.includes(currentUser.id) : false;
  const isAdmin = currentUser ? group.adminIds.includes(currentUser.id) : false;
  const hasPendingJoinRequest = currentUser ? pendingJoinGroupIds.has(group.id) : false;
  return { ...group, isMember, isAdmin, hasPendingJoinRequest };
}

// Group ids this user has a pending join request for.
async function pendingJoinGroupIdsFor(currentUser) {
  if (!currentUser) return new Set();
  const pending = await db.findMany('requests', {
    type: 'group_join',
    requesterId: currentUser.id,
    status: 'pending',
  });
  return new Set(pending.map((r) => r.groupId));
}

// Logged-in user, or null.
async function currentUserOrNull(req) {
  return req.session.userId ? db.findById('users', req.session.userId) : null;
}

// List of members (id, name, isAdmin) in one query.
async function toMemberSummaries(group) {
  const users = await db.findMany('users', { id: { $in: group.memberIds } });
  return users.map((u) => ({ id: u.id, displayName: u.displayName, isAdmin: group.adminIds.includes(u.id) }));
}

// Group + rooms (+ members if admin).
async function groupDetailFor(group, currentUser) {
  const rooms = await db.findMany('rooms', { groupId: group.id }, { sort: { createdAt: 1 } });
  const publicGroup = toPublicGroup(group, currentUser, await pendingJoinGroupIdsFor(currentUser));
  const members = publicGroup.isAdmin ? await toMemberSummaries(group) : undefined;
  return { ...publicGroup, rooms, ...(members ? { members } : {}) };
}

// Send a socket event to everyone in a room.
function emitToRoom(req, roomId, event, payload) {
  req.app.get('io')?.to(`room:${roomId}`).emit(event, payload);
}

// GET /api/groups - all groups (public). Optional ?search=&maxAge=&mine=&page=&pageSize=
router.get('/groups', async (req, res) => {
  const currentUser = await currentUserOrNull(req);
  const pendingIds = await pendingJoinGroupIdsFor(currentUser);
  const filter = buildGroupFilter(req.query, currentUser);
  const paging = parsePaging(req.query);
  const toPublic = (g) => toPublicGroup(g, currentUser, pendingIds);

  // No page asked for = plain array (old behaviour).
  if (!paging) {
    const groups = await db.findMany('groups', filter, { sort: { createdAt: 1 } });
    return res.json(groups.map(toPublic));
  }
  const result = await db.findPage('groups', filter, { sort: { createdAt: 1 }, ...paging });
  res.json({ ...result, items: result.items.map(toPublic) });
});

// GET /api/groups/:id - group + rooms (+ members if you're admin).
router.get('/groups/:id', async (req, res) => {
  const currentUser = await currentUserOrNull(req);
  const group = await db.findById('groups', req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  res.json(await groupDetailFor(group, currentUser));
});

// GET /api/groups/:groupId/rooms/:roomId - check if you can enter the room.
router.get('/groups/:groupId/rooms/:roomId', requireAuth, async (req, res) => {
  const access = await checkRoomAccess(req.currentUser, req.params.groupId, req.params.roomId);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error, ...(access.minAge !== undefined ? { minAge: access.minAge } : {}) });
  }
  res.json(access.room);
});

// GET .../messages - last 5 messages of the room.
router.get('/groups/:groupId/rooms/:roomId/messages', requireAuth, async (req, res) => {
  const access = await checkRoomAccess(req.currentUser, req.params.groupId, req.params.roomId);
  if (!access.ok) return res.status(access.status).json({ error: access.error });
  const newestFirst = await db.findMany(
    'messages',
    { roomId: access.room.id },
    { sort: { seq: -1 }, limit: MESSAGES_KEPT_PER_ROOM },
  );
  res.json(newestFirst.reverse());
});

// DELETE /api/groups/:groupId/rooms/:roomId - group admin removes a room.
router.delete('/groups/:groupId/rooms/:roomId', requireAuth, async (req, res) => {
  const group = await db.findById('groups', req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (!group.adminIds.includes(req.currentUser.id)) {
    return res.status(403).json({ error: 'Only a Group Admin of this group can remove a room.' });
  }
  const room = await db.findOne('rooms', { id: req.params.roomId, groupId: group.id });
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  await db.remove('rooms', room.id);
  await db.removeMany('messages', { roomId: room.id });
  await db.logAdminAction({
    action: 'room_removed',
    actorId: req.currentUser.id,
    targetId: room.id,
    details: `${req.currentUser.displayName} removed room "#${room.name}" from "${group.title}".`,
  });
  emitToRoom(req, room.id, 'room:removed', { roomId: room.id, groupId: group.id });
  res.status(204).end();
});

// POST /api/groups/requests - ask the Super Admin for a new group.
router.post('/groups/requests', requireAuth, async (req, res) => {
  const { title, description = '', minAge = 0 } = req.body || {};

  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'A group title is required.' });
  }
  if (typeof description !== 'string') {
    return res.status(400).json({ error: 'Description must be text.' });
  }
  if (title.length > TITLE_MAX) {
    return res.status(400).json({ error: `Title must be ${TITLE_MAX} characters or fewer.` });
  }
  if (description.length > DESCRIPTION_MAX) {
    return res.status(400).json({ error: `Description must be ${DESCRIPTION_MAX} characters or fewer.` });
  }
  if (!Number.isInteger(minAge) || minAge < 0) {
    return res.status(400).json({ error: 'Minimum age must be a non-negative whole number.' });
  }

  const request = {
    id: randomUUID(),
    type: 'group_creation',
    requesterId: req.currentUser.id,
    status: 'pending',
    title: title.trim(),
    description,
    minAge,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
  };
  await db.insert('requests', request);
  notifyRequestsChanged(req);
  res.status(201).json(request);
});

// POST /api/groups/:id/join - ask to join a group.
router.post('/groups/:id/join', requireAuth, async (req, res) => {
  const group = await db.findById('groups', req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });

  if (group.memberIds.includes(req.currentUser.id)) {
    return res.status(409).json({ error: 'Already a member of this group.' });
  }
  // Banned users can't join again (R8).
  if ((group.bannedIds || []).includes(req.currentUser.id)) {
    return res.status(403).json({ error: 'You have been banned from this group.' });
  }
  // Too young for this group = rejected straight away.
  const requesterAge = computeAge(req.currentUser.dateOfBirth);
  if (requesterAge < group.minAge) {
    return res.status(403).json({
      error: `You must be at least ${group.minAge} to join this group.`,
      minAge: group.minAge,
    });
  }
  const existingPending = await db.findOne('requests', {
    type: 'group_join',
    groupId: group.id,
    requesterId: req.currentUser.id,
    status: 'pending',
  });
  if (existingPending) {
    return res.status(409).json({ error: 'You already have a pending request to join this group.' });
  }

  const request = {
    id: randomUUID(),
    type: 'group_join',
    requesterId: req.currentUser.id,
    groupId: group.id,
    status: 'pending',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
  };
  await db.insert('requests', request);
  notifyRequestsChanged(req);
  res.status(201).json(request);
});

// POST /api/groups/:id/rooms/requests - ask for a new room.
router.post('/groups/:id/rooms/requests', requireAuth, async (req, res) => {
  const group = await db.findById('groups', req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (!group.memberIds.includes(req.currentUser.id)) {
    return res.status(403).json({ error: 'Only members of this group can request a room.' });
  }

  const { name, minAge = 0 } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'A room name is required.' });
  }
  if (name.length > ROOM_NAME_MAX) {
    return res.status(400).json({ error: `Room name must be ${ROOM_NAME_MAX} characters or fewer.` });
  }
  if (!Number.isInteger(minAge) || minAge < 0) {
    return res.status(400).json({ error: 'Minimum age must be a non-negative whole number.' });
  }

  const request = {
    id: randomUUID(),
    type: 'room_creation',
    requesterId: req.currentUser.id,
    groupId: group.id,
    status: 'pending',
    name: name.trim(),
    minAge,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
  };
  await db.insert('requests', request);
  notifyRequestsChanged(req);
  res.status(201).json(request);
});

// POST /api/groups/:id/ban-requests - report a member to the group admin.
router.post('/groups/:id/ban-requests', requireAuth, async (req, res) => {
  const group = await db.findById('groups', req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (!group.memberIds.includes(req.currentUser.id)) {
    return res.status(403).json({ error: 'Only members of this group can report another member.' });
  }

  const { userId, reason = '' } = req.body || {};
  if (!userId || userId === req.currentUser.id) {
    return res.status(400).json({ error: 'Choose another member of this group to report.' });
  }
  if (!group.memberIds.includes(userId)) {
    return res.status(400).json({ error: 'Only existing members of this group can be reported.' });
  }
  if (group.adminIds.includes(userId)) {
    return res.status(400).json({ error: 'A Group Admin cannot be reported for a ban.' });
  }
  if (!String(reason).trim()) {
    return res.status(400).json({ error: 'A reason is required.' });
  }
  const duplicate = await db.findOne('requests', {
    type: 'ban_request',
    groupId: group.id,
    targetUserId: userId,
    requesterId: req.currentUser.id,
    status: 'pending',
  });
  if (duplicate) return res.status(409).json({ error: 'You have already reported this member.' });

  const request = {
    id: randomUUID(),
    type: 'ban_request',
    requesterId: req.currentUser.id,
    targetUserId: userId,
    groupId: group.id,
    reason: String(reason).trim(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
  };
  await db.insert('requests', request);
  notifyRequestsChanged(req);
  res.status(201).json(request);
});

// GET /api/groups/:id/members - member list (members only).
router.get('/groups/:id/members', requireAuth, async (req, res) => {
  const group = await db.findById('groups', req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (!group.memberIds.includes(req.currentUser.id)) {
    return res.status(403).json({ error: 'Only members of this group can see its members.' });
  }
  res.json(await toMemberSummaries(group));
});

// POST /api/groups/:id/leave - leave the group (last admin can't leave).
router.post('/groups/:id/leave', requireAuth, async (req, res) => {
  const group = await db.findById('groups', req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (!group.memberIds.includes(req.currentUser.id)) {
    return res.status(409).json({ error: 'Not a member of this group.' });
  }

  const isSoleAdmin = group.adminIds.includes(req.currentUser.id) && group.adminIds.length === 1;
  if (isSoleAdmin) {
    return res.status(409).json({
      error:
        'You are the only admin of this group. Appoint another admin before leaving — a group must always have at least one admin.',
    });
  }

  const updatedGroup = await db.updateWith('groups', group.id, {
    $pull: { memberIds: req.currentUser.id, adminIds: req.currentUser.id },
  });
  await db.updateWith('users', req.currentUser.id, {
    $pull: { groupMemberships: group.id, groupAdminOf: group.id },
  });
  await db.logAdminAction({
    action: 'group_left',
    actorId: req.currentUser.id,
    targetId: group.id,
    details: `${req.currentUser.displayName} left "${group.title}".`,
  });

  res.json(toPublicGroup(updatedGroup, req.currentUser));
});

// POST /api/groups/:id/admins - make a member a co-admin (R9).
router.post('/groups/:id/admins', requireAuth, async (req, res) => {
  const group = await db.findById('groups', req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (!group.adminIds.includes(req.currentUser.id)) {
    return res.status(403).json({ error: 'Only a Group Admin of this group can appoint another admin.' });
  }

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'A member to appoint is required.' });

  const appointedUser = await db.findById('users', userId);
  if (!appointedUser || !group.memberIds.includes(userId)) {
    return res.status(400).json({ error: 'Only existing members of this group can be appointed as admin.' });
  }
  if (group.adminIds.includes(userId)) {
    return res.status(409).json({ error: 'That member is already a Group Admin.' });
  }

  const updatedGroup = await db.updateWith('groups', group.id, { $addToSet: { adminIds: userId } });
  await db.updateWith('users', userId, { $addToSet: { groupAdminOf: group.id } });
  await db.logAdminAction({
    action: 'group_admin_appointed',
    actorId: req.currentUser.id,
    targetId: userId,
    details: `${req.currentUser.displayName} appointed ${appointedUser.displayName} as a Group Admin of "${group.title}".`,
  });

  res.json(await groupDetailFor(updatedGroup, req.currentUser));
});

// DELETE /api/groups/:id/admins/:userId - take away admin status (or step down yourself).
router.delete('/groups/:id/admins/:userId', requireAuth, async (req, res) => {
  const group = await db.findById('groups', req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (!group.adminIds.includes(req.currentUser.id)) {
    return res.status(403).json({ error: 'Only a Group Admin of this group can remove an admin.' });
  }

  const { userId } = req.params;
  const target = await db.findById('users', userId);
  if (!target || !group.adminIds.includes(userId)) {
    return res.status(400).json({ error: 'That member is not a Group Admin.' });
  }
  // The creator is the first admin; only they can step themselves down.
  if (userId === group.adminIds[0] && userId !== req.currentUser.id) {
    return res.status(403).json({ error: 'The group creator can only be removed as admin by themselves.' });
  }
  if (group.adminIds.length === 1) {
    return res.status(409).json({ error: 'A group must always have at least one admin. Appoint another admin first.' });
  }

  // Only pull if still an admin and not the last one (safe if two requests race).
  const updated = await db.updateWhereWith(
    'groups',
    { id: group.id, adminIds: userId, 'adminIds.1': { $exists: true } },
    { $pull: { adminIds: userId } },
  );
  if (!updated) {
    return res.status(409).json({ error: 'A group must always have at least one admin. Appoint another admin first.' });
  }
  await db.updateWith('users', userId, { $pull: { groupAdminOf: group.id } });
  const self = userId === req.currentUser.id;
  await db.logAdminAction({
    action: 'group_admin_removed',
    actorId: req.currentUser.id,
    targetId: userId,
    details: self
      ? `${target.displayName} stepped down as a Group Admin of "${group.title}".`
      : `${req.currentUser.displayName} removed ${target.displayName} as a Group Admin of "${group.title}".`,
  });

  res.json(await groupDetailFor(updated, req.currentUser));
});

// Remove a member from this group and add them to bannedIds.
async function banFromGroup(group, target) {
  const updatedGroup = await db.updateWith('groups', group.id, {
    $pull: { memberIds: target.id, adminIds: target.id },
    $addToSet: { bannedIds: target.id },
  });
  await db.updateWith('users', target.id, { $pull: { groupMemberships: group.id, groupAdminOf: group.id } });
  return updatedGroup;
}

// POST /api/groups/:id/ban - ban a member from this group.
router.post('/groups/:id/ban', requireAuth, async (req, res) => {
  const group = await db.findById('groups', req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (!group.adminIds.includes(req.currentUser.id)) {
    return res.status(403).json({ error: 'Only a Group Admin of this group can ban a member.' });
  }

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'A member to ban is required.' });
  if (userId === req.currentUser.id) {
    return res.status(400).json({ error: 'You cannot ban yourself.' });
  }

  const target = await db.findById('users', userId);
  if (!target || !group.memberIds.includes(userId)) {
    return res.status(400).json({ error: 'Only existing members of this group can be banned.' });
  }
  if (group.adminIds.includes(userId)) {
    return res.status(409).json({ error: 'A Group Admin cannot be banned — remove their admin status first.' });
  }

  const updatedGroup = await banFromGroup(group, target);
  await db.logAdminAction({
    action: 'group_member_banned',
    actorId: req.currentUser.id,
    targetId: userId,
    details: `${req.currentUser.displayName} banned ${target.displayName} from "${group.title}".`,
  });

  res.json(await groupDetailFor(updatedGroup, req.currentUser));
});

// POST .../deletion-requests - ask the Super Admin to delete a user (R4).
router.post('/groups/:groupId/members/:userId/deletion-requests', requireAuth, async (req, res) => {
  const group = await db.findById('groups', req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (!group.adminIds.includes(req.currentUser.id)) {
    return res.status(403).json({ error: 'Only a Group Admin of this group can request a member be removed.' });
  }

  const target = await db.findById('users', req.params.userId);
  if (!target || !group.memberIds.includes(target.id)) {
    return res.status(400).json({ error: 'Only existing members of this group can be reported for removal.' });
  }
  if (target.isSuperAdmin) {
    return res.status(400).json({ error: 'The Super Admin cannot be reported for removal.' });
  }

  const { reason = '' } = req.body || {};
  if (!String(reason).trim()) {
    return res.status(400).json({ error: 'A reason is required to escalate an account deletion request.' });
  }

  const existingPending = await db.findOne('requests', {
    type: 'account_deletion',
    targetUserId: target.id,
    status: 'pending',
  });
  if (existingPending) {
    return res.status(409).json({ error: 'There is already a pending deletion request for this user.' });
  }

  const request = {
    id: randomUUID(),
    type: 'account_deletion',
    requesterId: req.currentUser.id,
    targetUserId: target.id,
    groupId: group.id,
    reason: String(reason).trim(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
  };
  await db.insert('requests', request);
  notifyRequestsChanged(req);
  res.status(201).json(request);
});

// PATCH /api/groups/:id - edit description / min age (no renaming).
router.patch('/groups/:id', requireAuth, async (req, res) => {
  const group = await db.findById('groups', req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (!group.adminIds.includes(req.currentUser.id)) {
    return res.status(403).json({ error: 'Only a Group Admin of this group can edit it.' });
  }

  const updates = {};
  if (req.body?.description !== undefined && typeof req.body.description !== 'string') {
    return res.status(400).json({ error: 'Description must be text.' });
  }
  if (typeof req.body?.description === 'string') {
    if (req.body.description.length > DESCRIPTION_MAX) {
      return res.status(400).json({ error: `Description must be ${DESCRIPTION_MAX} characters or fewer.` });
    }
    updates.description = req.body.description;
  }
  if (req.body?.minAge !== undefined) {
    if (!Number.isInteger(req.body.minAge) || req.body.minAge < 0) {
      return res.status(400).json({ error: 'Minimum age must be a non-negative whole number.' });
    }
    updates.minAge = req.body.minAge;
  }
  if (req.body?.title !== undefined) {
    return res.status(400).json({ error: 'A group cannot be renamed.' });
  }

  const updatedGroup = Object.keys(updates).length ? await db.update('groups', group.id, updates) : group;
  if (Object.keys(updates).length) {
    await db.logAdminAction({
      action: 'group_updated',
      actorId: req.currentUser.id,
      targetId: group.id,
      details: `${req.currentUser.displayName} updated the details of "${group.title}".`,
    });
  }
  res.json(toPublicGroup(updatedGroup, req.currentUser));
});

module.exports = router;
module.exports.banFromGroup = banFromGroup;
