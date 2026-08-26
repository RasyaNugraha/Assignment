// Group routes — Phase1.md §6, REQUIREMENTS.md §5-§6.
// Groups are created only by Super Admin approving a General User's request
// (see routes/requests.js for the approve/deny step); the requester becomes
// that Group's Group Admin. All groups are public — no private groups.

const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../services/dbService');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

const TITLE_MAX = 30; // R13
const DESCRIPTION_MAX = 250; // R13
const ROOM_NAME_MAX = 30;

// Adds request-scoped flags for the current viewer — kept server-side so the
// client never has to cross-reference groups against a separate membership
// list itself.
function toPublicGroup(group, currentUser) {
  const isMember = currentUser ? group.memberIds.includes(currentUser.id) : false;
  const isAdmin = currentUser ? group.adminIds.includes(currentUser.id) : false;
  const hasPendingJoinRequest = currentUser
    ? db.findOne(
        'requests',
        (r) =>
          r.type === 'group_join' &&
          r.groupId === group.id &&
          r.requesterId === currentUser.id &&
          r.status === 'pending',
      ) !== null
    : false;
  return { ...group, isMember, isAdmin, hasPendingJoinRequest };
}

function currentUserOrNull(req) {
  return req.session.userId ? db.findById('users', req.session.userId) : null;
}

// Member display list for the admin-only "appoint co-admin" / "ban" / "request
// removal" UI (R8/R9) — only attached to the response when the viewer is
// already a Group Admin (see GET /groups/:id below), so regular
// members/visitors never see this.
function toMemberSummaries(group) {
  return group.memberIds
    .map((id) => db.findById('users', id))
    .filter(Boolean)
    .map((u) => ({ id: u.id, displayName: u.displayName, isAdmin: group.adminIds.includes(u.id) }));
}

// Same derivation as auth.js's computeAge() — duplicated locally rather than
// imported since neither route file currently shares helpers via a common
// module (each defines its own toPublicX()-style functions). Needed here so
// the Room age check below (R18) works off a live age, not a stored one that
// could go stale.
function computeAge(dateOfBirth) {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

// GET /api/groups — every group is visible to everyone, logged in or not.
router.get('/groups', (req, res) => {
  const currentUser = currentUserOrNull(req);
  const groups = db.getAll('groups').map((g) => toPublicGroup(g, currentUser));
  res.json(groups);
});

// GET /api/groups/:id — group detail plus its rooms. Group Admin viewers
// additionally get a `members` list (R8/R9), so the client can render the
// "appoint co-admin" / "ban" / "request removal" UI without a separate
// members endpoint.
router.get('/groups/:id', (req, res) => {
  const currentUser = currentUserOrNull(req);
  const group = db.findById('groups', req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  const rooms = db.findMany('rooms', (r) => r.groupId === group.id);
  const publicGroup = toPublicGroup(group, currentUser);
  const members = publicGroup.isAdmin ? toMemberSummaries(group) : undefined;
  res.json({ ...publicGroup, rooms, ...(members ? { members } : {}) });
});

// GET /api/groups/:groupId/rooms/:roomId — R18: server-side re-validation of
// a Room's age limit. roomAgeGuard (client/src/app/core/room.guard.ts) makes
// the same check up front for a fast redirect, but a guard only runs inside
// Angular's router — nothing stops a request straight to this URL (or a
// tampered client bundle) from skipping it. This endpoint is the real
// authority: RoomComponent calls it on entry and treats a 403 the same way
// the guard does (redirect to the Group View with the same ?ageBlocked=
// banner), so the check holds even if the client-side guard is bypassed.
router.get('/groups/:groupId/rooms/:roomId', requireAuth, (req, res) => {
  const group = db.findById('groups', req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found.' });

  const room = db.findOne('rooms', (r) => r.id === req.params.roomId && r.groupId === group.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  const age = computeAge(req.currentUser.dateOfBirth);
  if (age < room.minAge) {
    return res.status(403).json({
      error: `You must be at least ${room.minAge} to enter this room.`,
      minAge: room.minAge,
    });
  }

  res.json(room);
});

// POST /api/groups/requests — a General User asks the Super Admin for a new
// Group. Group creation itself is Super-Admin-only (§6); this just files the
// request for the queue in routes/requests.js.
router.post('/groups/requests', requireAuth, (req, res) => {
  const { title, description = '', minAge = 0 } = req.body || {};

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'A group title is required.' });
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
  db.insert('requests', request);
  res.status(201).json(request);
});

// POST /api/groups/:id/join — request to join; goes to that Group's admin(s).
router.post('/groups/:id/join', requireAuth, (req, res) => {
  const group = db.findById('groups', req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });

  if (group.memberIds.includes(req.currentUser.id)) {
    return res.status(409).json({ error: 'Already a member of this group.' });
  }
  // R8 — a banned user stays banned from this specific Group (they can still
  // join/use every other Group in the system, since the ban is scoped, not
  // system-wide).
  if ((group.bannedIds || []).includes(req.currentUser.id)) {
    return res.status(403).json({ error: 'You have been banned from this group.' });
  }
  const existingPending = db.findOne(
    'requests',
    (r) =>
      r.type === 'group_join' &&
      r.groupId === group.id &&
      r.requesterId === req.currentUser.id &&
      r.status === 'pending',
  );
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
  db.insert('requests', request);
  res.status(201).json(request);
});

// POST /api/groups/:id/rooms/requests — a member asks their Group Admin(s)
// for a new Room (R12). The Group Admin still performs the actual creation,
// via the approve step in routes/requests.js.
router.post('/groups/:id/rooms/requests', requireAuth, (req, res) => {
  const group = db.findById('groups', req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (!group.memberIds.includes(req.currentUser.id)) {
    return res.status(403).json({ error: 'Only members of this group can request a room.' });
  }

  const { name, minAge = 0 } = req.body || {};
  if (!name || !name.trim()) {
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
  db.insert('requests', request);
  res.status(201).json(request);
});

// POST /api/groups/:id/leave — immediate, no approval needed. Leaving a
// group removes the user from it entirely (§6) — but a group must always
// keep at least one admin (R9), so the sole admin can't leave until they've
// appointed a co-admin via POST /api/groups/:id/admins above.
router.post('/groups/:id/leave', requireAuth, (req, res) => {
  const group = db.findById('groups', req.params.id);
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

  const updatedGroup = db.update('groups', group.id, {
    memberIds: group.memberIds.filter((id) => id !== req.currentUser.id),
    adminIds: group.adminIds.filter((id) => id !== req.currentUser.id),
  });
  db.update('users', req.currentUser.id, {
    groupMemberships: req.currentUser.groupMemberships.filter((id) => id !== group.id),
    groupAdminOf: req.currentUser.groupAdminOf.filter((id) => id !== group.id),
  });
  db.logAdminAction({
    action: 'group_left',
    actorId: req.currentUser.id,
    targetId: group.id,
    details: `${req.currentUser.displayName} left "${group.title}".`,
  });

  res.json(toPublicGroup(updatedGroup, req.currentUser));
});

// POST /api/groups/:id/admins — an existing Group Admin appoints another
// member of this Group as a co-admin (R9). This has to exist before a sole
// admin is allowed to leave/step down — see the isSoleAdmin check in the
// leave route above, which this unblocks.
router.post('/groups/:id/admins', requireAuth, (req, res) => {
  const group = db.findById('groups', req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (!group.adminIds.includes(req.currentUser.id)) {
    return res.status(403).json({ error: 'Only a Group Admin of this group can appoint another admin.' });
  }

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'A member to appoint is required.' });

  const appointedUser = db.findById('users', userId);
  if (!appointedUser || !group.memberIds.includes(userId)) {
    return res.status(400).json({ error: 'Only existing members of this group can be appointed as admin.' });
  }
  if (group.adminIds.includes(userId)) {
    return res.status(409).json({ error: 'That member is already a Group Admin.' });
  }

  const updatedGroup = db.update('groups', group.id, { adminIds: [...group.adminIds, userId] });
  db.update('users', userId, { groupAdminOf: [...appointedUser.groupAdminOf, group.id] });
  db.logAdminAction({
    action: 'group_admin_appointed',
    actorId: req.currentUser.id,
    targetId: userId,
    details: `${req.currentUser.displayName} appointed ${appointedUser.displayName} as a Group Admin of "${group.title}".`,
  });

  const rooms = db.findMany('rooms', (r) => r.groupId === group.id);
  res.json({ ...toPublicGroup(updatedGroup, req.currentUser), rooms, members: toMemberSummaries(updatedGroup) });
});

// POST /api/groups/:id/ban — Group Admin bans a member from this Group only
// (R8: "the user remains in the system and other Groups" — this never
// touches the `users` collection, just this Group's membership + a
// `bannedIds` list so they can't just request to rejoin). No escalation
// needed: a Group Admin already has full authority over their own Group, so
// unlike account deletion (R4, below) this doesn't go through the Super
// Admin request queue.
router.post('/groups/:id/ban', requireAuth, (req, res) => {
  const group = db.findById('groups', req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (!group.adminIds.includes(req.currentUser.id)) {
    return res.status(403).json({ error: 'Only a Group Admin of this group can ban a member.' });
  }

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'A member to ban is required.' });
  if (userId === req.currentUser.id) {
    return res.status(400).json({ error: 'You cannot ban yourself.' });
  }

  const target = db.findById('users', userId);
  if (!target || !group.memberIds.includes(userId)) {
    return res.status(400).json({ error: 'Only existing members of this group can be banned.' });
  }
  if (group.adminIds.includes(userId)) {
    return res.status(409).json({ error: 'A Group Admin cannot be banned — remove their admin status first.' });
  }

  const updatedGroup = db.update('groups', group.id, {
    memberIds: group.memberIds.filter((id) => id !== userId),
    bannedIds: [...(group.bannedIds || []), userId],
  });
  db.update('users', userId, {
    groupMemberships: target.groupMemberships.filter((id) => id !== group.id),
  });
  db.logAdminAction({
    action: 'group_member_banned',
    actorId: req.currentUser.id,
    targetId: userId,
    details: `${req.currentUser.displayName} banned ${target.displayName} from "${group.title}".`,
  });

  const rooms = db.findMany('rooms', (r) => r.groupId === group.id);
  res.json({ ...toPublicGroup(updatedGroup, req.currentUser), rooms, members: toMemberSummaries(updatedGroup) });
});

// POST /api/groups/:groupId/members/:userId/deletion-requests — R4: a Group
// Admin escalates a member for full, system-wide account deletion. This is
// deliberately NOT a direct action (unlike the ban above) — R4 requires the
// Super Admin to have the final say, so this only files a
// `account_deletion` request into the same unified queue used for
// group/room requests; the actual deletion happens in the approve step in
// routes/requests.js.
router.post('/groups/:groupId/members/:userId/deletion-requests', requireAuth, (req, res) => {
  const group = db.findById('groups', req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (!group.adminIds.includes(req.currentUser.id)) {
    return res.status(403).json({ error: 'Only a Group Admin of this group can request a member be removed.' });
  }

  const target = db.findById('users', req.params.userId);
  if (!target || !group.memberIds.includes(target.id)) {
    return res.status(400).json({ error: 'Only existing members of this group can be reported for removal.' });
  }
  if (target.isSuperAdmin) {
    return res.status(400).json({ error: 'The Super Admin cannot be reported for removal.' });
  }

  const { reason = '' } = req.body || {};
  if (!reason.trim()) {
    return res.status(400).json({ error: 'A reason is required to escalate an account deletion request.' });
  }

  const existingPending = db.findOne(
    'requests',
    (r) => r.type === 'account_deletion' && r.targetUserId === target.id && r.status === 'pending',
  );
  if (existingPending) {
    return res.status(409).json({ error: 'There is already a pending deletion request for this user.' });
  }

  const request = {
    id: randomUUID(),
    type: 'account_deletion',
    requesterId: req.currentUser.id,
    targetUserId: target.id,
    groupId: group.id,
    reason: reason.trim(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
  };
  db.insert('requests', request);
  res.status(201).json(request);
});

// PATCH /api/groups/:id — Group Admin can edit description/minAge only
// (§6: "cannot rename the Group").
router.patch('/groups/:id', requireAuth, (req, res) => {
  const group = db.findById('groups', req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  if (!group.adminIds.includes(req.currentUser.id)) {
    return res.status(403).json({ error: 'Only a Group Admin of this group can edit it.' });
  }

  const updates = {};
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

  const updatedGroup = db.update('groups', group.id, updates);
  res.json(toPublicGroup(updatedGroup, req.currentUser));
});

module.exports = router;
