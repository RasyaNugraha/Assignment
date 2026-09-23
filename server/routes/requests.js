// Request queue routes (approve / deny).

const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../services/dbService');
const requireAuth = require('../middleware/requireAuth');
const { banFromGroup } = require('./groups');
const { notifyRequestsChanged, notifyUser } = require('../sockets/notify');

const router = express.Router();

const SUPER_ADMIN_TYPES = ['group_creation', 'account_deletion'];
const GROUP_ADMIN_TYPES = ['group_join', 'room_creation', 'ban_request'];

// Can this user approve/deny this request?
async function canResolve(request, currentUser) {
  if (SUPER_ADMIN_TYPES.includes(request.type)) {
    return currentUser.isSuperAdmin === true;
  }
  if (GROUP_ADMIN_TYPES.includes(request.type)) {
    const group = await db.findById('groups', request.groupId);
    return group ? group.adminIds.includes(currentUser.id) : false;
  }
  return false;
}

// Add names to the request so the UI can show them.
async function toPublicRequest(request) {
  const [requester, group, target] = await Promise.all([
    db.findById('users', request.requesterId),
    request.groupId ? db.findById('groups', request.groupId) : null,
    request.targetUserId ? db.findById('users', request.targetUserId) : null,
  ]);
  return {
    ...request,
    requesterDisplayName: requester ? requester.displayName : 'Unknown user',
    groupTitle: group ? group.title : null,
    ...(request.targetUserId ? { targetDisplayName: target ? target.displayName : 'A former user' } : {}),
  };
}

// GET /api/requests - pending requests you're allowed to handle.
router.get('/requests', requireAuth, async (req, res) => {
  const pending = await db.findMany('requests', { status: 'pending' }, { sort: { createdAt: 1 } });
  const allowed = await Promise.all(pending.map((r) => canResolve(r, req.currentUser)));
  const visible = pending.filter((_, i) => allowed[i]);
  res.json(await Promise.all(visible.map(toPublicRequest)));
});

// --- What "approve" does for each request type -------------------------

// Create the group, requester becomes admin.
async function approveGroupCreation(request, actor) {
  const requester = await db.findById('users', request.requesterId);
  if (!requester) return;
  const group = {
    id: randomUUID(),
    title: request.title,
    description: request.description,
    minAge: request.minAge,
    backgroundColor: null,
    adminIds: [requester.id],
    memberIds: [requester.id],
    bannedIds: [], // R8 — members banned from this specific Group
    createdAt: new Date().toISOString(),
  };
  await db.insert('groups', group);
  await db.updateWith('users', requester.id, {
    $addToSet: { groupAdminOf: group.id, groupMemberships: group.id },
  });
  await db.logAdminAction({
    action: 'group_created',
    actorId: actor.id,
    targetId: group.id,
    details: `${actor.displayName} approved "${group.title}", appointing ${requester.displayName} as Group Admin.`,
  });
}

// Add the user to the group.
async function approveGroupJoin(request, actor) {
  const [group, requester] = await Promise.all([
    db.findById('groups', request.groupId),
    db.findById('users', request.requesterId),
  ]);
  if (group && requester && !group.memberIds.includes(requester.id)) {
    await db.updateWith('groups', group.id, { $addToSet: { memberIds: requester.id } });
    await db.updateWith('users', requester.id, { $addToSet: { groupMemberships: group.id } });
  }
  await db.logAdminAction({
    action: 'group_join_approved',
    actorId: actor.id,
    targetId: group ? group.id : null,
    details: `${actor.displayName} approved ${requester ? requester.displayName : 'a user'} joining "${group ? group.title : 'a group'}".`,
  });
}

// Create the room.
async function approveRoomCreation(request, actor) {
  const group = await db.findById('groups', request.groupId);
  const room = {
    id: randomUUID(),
    groupId: request.groupId,
    name: request.name,
    minAge: request.minAge,
    createdAt: new Date().toISOString(),
  };
  await db.insert('rooms', room);
  await db.logAdminAction({
    action: 'room_created',
    actorId: actor.id,
    targetId: room.id,
    details: `${actor.displayName} approved room "#${room.name}" in "${group ? group.title : 'a group'}".`,
  });
}

// Ban the reported member.
async function approveBanRequest(request, actor) {
  const [group, target] = await Promise.all([
    db.findById('groups', request.groupId),
    db.findById('users', request.targetUserId),
  ]);
  if (group && target && group.memberIds.includes(target.id)) {
    await banFromGroup(group, target);
  }
  await db.logAdminAction({
    action: 'group_member_banned',
    actorId: actor.id,
    targetId: request.targetUserId,
    details: `${actor.displayName} banned ${target ? target.displayName : 'a user'} from "${group ? group.title : 'a group'}" after a member's report.`,
  });
}

// Remove the user from every group, then delete the account (R4).
async function approveAccountDeletion(request, actor) {
  const target = await db.findById('users', request.targetUserId);
  if (target) {
    await db.updateManyWith(
      'groups',
      { $or: [{ memberIds: target.id }, { adminIds: target.id }, { bannedIds: target.id }] },
      { $pull: { memberIds: target.id, adminIds: target.id, bannedIds: target.id } },
    );
    await db.remove('users', target.id);
  }
  await db.logAdminAction({
    action: 'user_deleted',
    actorId: actor.id,
    targetId: request.targetUserId,
    details: `${actor.displayName} permanently deleted ${target ? target.displayName : 'a user'} from the system (escalated by a Group Admin).`,
  });
}

const APPROVERS = {
  group_creation: approveGroupCreation,
  group_join: approveGroupJoin,
  room_creation: approveRoomCreation,
  ban_request: approveBanRequest,
  account_deletion: approveAccountDeletion,
};

// Get the request and check this user can still resolve it.
async function loadResolvable(req) {
  const request = await db.findById('requests', req.params.id);
  if (!request) return { status: 404, error: 'Request not found.' };
  if (request.status !== 'pending') return { status: 409, error: 'Request has already been resolved.' };
  if (!(await canResolve(request, req.currentUser))) {
    return { status: 403, error: 'You are not authorised to resolve this request.' };
  }
  req.request = request;
  return null;
}

// Short text for the popup the requester gets.
function describeRequest(request, groupTitle) {
  switch (request.type) {
    case 'group_creation':
      return `your new group "${request.title}"`;
    case 'group_join':
      return `joining "${groupTitle}"`;
    case 'room_creation':
      return `the room "#${request.name}" in "${groupTitle}"`;
    case 'ban_request':
      return `your report in "${groupTitle}"`;
    default:
      return 'your request';
  }
}

// Mark the request resolved, but only if it's STILL pending (stops double approve).
async function claimRequest(request, status, userId) {
  return db.updateWhere(
    'requests',
    { id: request.id, status: 'pending' },
    { status, resolvedAt: new Date().toISOString(), resolvedBy: userId },
  );
}

// Tell the requester what happened + refresh everyone's badges.
async function afterResolve(req, request, status) {
  notifyRequestsChanged(req);
  if (request.type === 'account_deletion') return; // requester is the admin who asked
  const group = request.groupId ? await db.findById('groups', request.groupId) : null;
  notifyUser(req, request.requesterId, `Request ${status}: ${describeRequest(request, group?.title)}.`);
}

// POST /api/requests/:id/approve - do the action for that request type.
router.post('/requests/:id/approve', requireAuth, async (req, res) => {
  const problem = await loadResolvable(req);
  if (problem) return res.status(problem.status).json({ error: problem.error });

  const resolved = await claimRequest(req.request, 'approved', req.currentUser.id);
  if (!resolved) return res.status(409).json({ error: 'Request has already been resolved.' });

  await APPROVERS[req.request.type](req.request, req.currentUser);
  await afterResolve(req, req.request, 'approved');
  res.json(await toPublicRequest(resolved));
});

// POST /api/requests/:id/deny - mark as denied.
router.post('/requests/:id/deny', requireAuth, async (req, res) => {
  const problem = await loadResolvable(req);
  if (problem) return res.status(problem.status).json({ error: problem.error });

  const resolved = await claimRequest(req.request, 'denied', req.currentUser.id);
  if (!resolved) return res.status(409).json({ error: 'Request has already been resolved.' });

  await db.logAdminAction({
    action: `${req.request.type}_denied`,
    actorId: req.currentUser.id,
    targetId: req.request.id,
    details: `${req.currentUser.displayName} denied a ${req.request.type.replace('_', ' ')} request.`,
  });
  await afterResolve(req, req.request, 'denied');
  res.json(await toPublicRequest(resolved));
});

module.exports = router;
module.exports.canResolve = canResolve;
module.exports.describeRequest = describeRequest;
