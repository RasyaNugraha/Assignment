
const db = require('../services/dbService');

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  const user = db.findById('users', req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  req.currentUser = user;
  next();
}

module.exports = requireAuth;
