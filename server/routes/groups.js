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

// GET /api/groups — every group is visible to everyone, logged in or not.
router.get('/groups', (req, res) => {
  const currentUser = currentUserOrNull(req);
  const groups = db.getAll('groups').map((g) => toPublicGroup(g, currentUser));
  res.json(groups);
});

// GET /api/groups/:id — group detail plus its rooms.
router.get('/groups/:id', (req, res) => {
  const currentUser = currentUserOrNull(req);
  const group = db.findById('groups', req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  const rooms = db.findMany('rooms', (r) => r.groupId === group.id);
  res.json({ ...toPublicGroup(group, currentUser), rooms });
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

// POST /api/groups/:id/leave — immediate, no approval needed. Leaving a
// group removes the user from it entirely (§6) — but a group must always
// keep at least one admin (R32), so the sole admin can't leave.
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
