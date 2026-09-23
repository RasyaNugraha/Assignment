// Small helpers so REST routes can push real-time updates over Socket.IO.
// `io` is set on the Express app in server.js (it's missing in REST-only tests, so we use ?.).

// Tell every connected client the request queue changed (admins refresh their badge).
function notifyRequestsChanged(req) {
  req.app.get('io')?.emit('requests:changed');
}

// Send a popup message to one user (all their open tabs).
function notifyUser(req, userId, text) {
  req.app.get('io')?.to(`user:${userId}`).emit('notification', { text, at: new Date().toISOString() });
}

module.exports = { notifyRequestsChanged, notifyUser };
