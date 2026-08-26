// R9: reads back the admin action log, Super Admin only.
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

  logs = [...logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(logs);
});

module.exports = router;
