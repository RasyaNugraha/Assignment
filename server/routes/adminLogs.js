// Admin log — Phase1.md §6.6, REQUIREMENTS.md §9.
// Every administrative action (users/groups/rooms created, removed, joined,
// banned, requests denied, etc.) is written via db.logAdminAction() at the
// point it happens (see routes/auth.js, routes/groups.js, routes/requests.js)
// — this route just reads that log back out, filtered, for the Super Admin.
// REQUIREMENTS.md §9 leaves Group Admin visibility unspecified, so this is
// treated as Super-Admin-only until clarified otherwise.

const express = require('express');
const db = require('../services/dbService');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// GET /api/admin/logs?action=&from=&to= — filtered administrative action log.
router.get('/admin/logs', requireAuth, (req, res) => {
  if (!req.currentUser.isSuperAdmin) {
    return res.status(403).json({ error: 'Only the Super Admin can view the admin log.' });
  }

  const { action, from, to } = req.query;
  let logs = db.getAll('adminLogs');

  if (action) logs = logs.filter((entry) => entry.action === action);
  if (from) {
    const fromTime = new Date(from).getTime();
    logs = logs.filter((entry) => new Date(entry.timestamp).getTime() >= fromTime);
  }
  if (to) {
    const toTime = new Date(to).getTime();
    logs = logs.filter((entry) => new Date(entry.timestamp).getTime() <= toTime);
  }

  // Newest first — most relevant to an admin checking "what just happened".
  logs = [...logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(logs);
});

module.exports = router;
