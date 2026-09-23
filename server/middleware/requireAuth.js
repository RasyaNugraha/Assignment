// Blocks the route if not logged in, otherwise puts the user in req.currentUser.
const db = require('../services/dbService');

// Check login before the route runs.
async function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  const user = await db.findById('users', req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  req.currentUser = user;
  next();
}

module.exports = requireAuth;
