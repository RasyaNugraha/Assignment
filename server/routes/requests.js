// Request queue: approver depends on request type (Super Admin or Group Admin).

const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../services/dbService');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

function canResolve(request, currentUser) {
  if (request.type === 'group_creation') {
    return currentUser.isSuperAdmin;
  }
  if (request.type === 'group_join' || request.type === 'room_creation') {
    const group = db.findById('groups', request.groupId);
    return group ? group.adminIds.includes(currentUser.id) : false;
  }
  return false;
}

// Adds display-friendly requester/group names for the queue UI.
function toPublicRequest(request) {
  const requester = db.findById('users', request.requesterId);
  const group = request.groupId ? db.findById('groups', request.groupId) : null;
  return {
    ...request,
    requesterDisplayName: requester ? requester.displayName : 'Unknown user',
    groupTitle: group ? group.title : null,
  };
}

// GET /api/requests — role-scoped queue of pending requests.
router.get('/requests', requireAuth, (req, res) => {
  const pending = db.findMany('requests', (r) => r.status === 'pending');
  const visible = pending.filter((r) => canResolve(r, req.currentUser));
  res.json(visible.map(toPublicRequest));
});

router.post('/requests/:id/approve', requireAuth, (req, res) => {
  const request = db.findById('requests', req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found.' });
  if (request.status !== 'pending') {
    return res.status(409).json({ error: 'Request has already been resolved.' });
  }
  if (!canResolve(request, req.currentUser)) {
    return res.status(403).json({ error: 'You are not authorised to resolve this request.' });
  }

  if (request.type === 'group_creation') {
    const requester = db.findById('users', request.requesterId);
    const group = {
      id: randomUUID(),
      title: request.title,
      description: request.description,
      minAge: request.minAge,
      backgroundColor: null,
      adminIds: [requester.id],
      memberIds: [requester.id],
      createdAt: new Date().toISOString(),
    };
    db.insert('groups', group);
    db.update('users', requester.id, {
      groupAdminOf: [...requester.groupAdminOf, group.id],
      groupMemberships: [...requester.groupMemberships, group.id],
    });
    db.logAdminAction({
      action: 'group_created',
      actorId: req.currentUser.id,
      targetId: group.id,
      details: `${req.currentUser.displayName} approved "${group.title}", appointing ${requester.displayName} as Group Admin.`,
    });
  } else if (request.type === 'group_join') {
    const group = db.findById('groups', request.groupId);
    const requester = db.findById('users', request.requesterId);
    if (group && requester && !group.memberIds.includes(requester.id)) {
      db.update('groups', group.id, { memberIds: [...group.memberIds, requester.id] });
      db.update('users', requester.id, { groupMemberships: [...requester.groupMemberships, group.id] });
    }
    db.logAdminAction({
      action: 'group_join_approved',
      actorId: req.currentUser.id,
      targetId: group ? group.id : null,
      details: `${req.currentUser.displayName} approved ${requester ? requester.displayName : 'a user'} joining "${group ? group.title : 'a group'}".`,
    });
  } else if (request.type === 'room_creation') {
    const group = db.findById('groups', request.groupId);
    const room = {
      id: randomUUID(),
      groupId: request.groupId,
      name: request.name,
      minAge: request.minAge,
      createdAt: new Date().toISOString(),
    };
    db.insert('rooms', room);
    db.logAdminAction({
      action: 'room_created',
      actorId: req.currentUser.id,
      targetId: room.id,
      details: `${req.currentUser.displayName} approved room "#${room.name}" in "${group ? group.title : 'a group'}".`,
    });
  }

  const resolved = db.update('requests', request.id, {
    status: 'approved',
    resolvedAt: new Date().toISOString(),
    resolvedBy: req.currentUser.id,
  });
  res.json(toPublicRequest(resolved));
});

router.post('/requests/:id/deny', requireAuth, (req, res) => {
  const request = db.findById('requests', req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found.' });
  if (request.status !== 'pending') {
    return res.status(409).json({ error: 'Request has already been resolved.' });
  }
  if (!canResolve(request, req.currentUser)) {
    return res.status(403).json({ error: 'You are not authorised to resolve this request.' });
  }

  const resolved = db.update('requests', request.id, {
    status: 'denied',
    resolvedAt: new Date().toISOString(),
    resolvedBy: req.currentUser.id,
  });
  db.logAdminAction({
    action: `${request.type}_denied`,
    actorId: req.currentUser.id,
    targetId: request.id,
    details: `${req.currentUser.displayName} denied a ${request.type.replace('_', ' ')} request.`,
  });
  res.json(toPublicRequest(resolved));
});

module.exports = router;
