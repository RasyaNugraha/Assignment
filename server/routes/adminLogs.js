// Admin log route (Super Admin only).
const express = require('express');
const db = require('../services/dbService');
const requireAuth = require('../middleware/requireAuth');
const { parsePaging } = require('../services/paging');

const router = express.Router();

// Make the Mongo filter from the query (action, from, to).
function buildLogFilter({ action, from, to } = {}) {
  const filter = {};
  if (action) filter.action = String(action);
  const range = {};
  if (from && !Number.isNaN(new Date(from).getTime())) range.$gte = new Date(from).toISOString();
  if (to && !Number.isNaN(new Date(to).getTime())) range.$lte = new Date(to).toISOString();
  if (Object.keys(range).length) filter.timestamp = range;
  return filter;
}

// Only the Super Admin can read the log.
function requireSuperAdmin(req, res, next) {
  if (!req.currentUser.isSuperAdmin) {
    return res.status(403).json({ error: 'Only the Super Admin can view the admin log.' });
  }
  next();
}

// GET /api/admin/logs - logs newest first, can filter. Add ?page= for pages.
router.get('/admin/logs', requireAuth, requireSuperAdmin, async (req, res) => {
  const filter = buildLogFilter(req.query);
  const paging = parsePaging(req.query, 20);
  if (!paging) {
    return res.json(await db.findMany('adminLogs', filter, { sort: { timestamp: -1 } }));
  }
  res.json(await db.findPage('adminLogs', filter, { sort: { timestamp: -1 }, ...paging }));
});

// GET /api/admin/logs/actions - list of action types (for the filter dropdown).
router.get('/admin/logs/actions', requireAuth, requireSuperAdmin, async (req, res) => {
  const actions = await db.distinct('adminLogs', 'action');
  res.json(actions.sort());
});

module.exports = router;
module.exports.buildLogFilter = buildLogFilter;
