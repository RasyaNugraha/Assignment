// Builds the Express app without starting it (so tests can use it).

const express = require('express');
const path = require('path');
const session = require('express-session');
const config = require('./config');

const authRoutes = require('./routes/auth');
const groupRoutes = require('./routes/groups');
const requestRoutes = require('./routes/requests');
const userRoutes = require('./routes/users');
const adminLogRoutes = require('./routes/adminLogs');

// Session (login cookie) setup. Pass a store to keep sessions in MongoDB.
function createSessionMiddleware(store) {
  return session({
    store,
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24, httpOnly: true, sameSite: 'lax' }, // 1 day
  });
}

// Create the Express app with all routes.
function createApp({ sessionMiddleware = createSessionMiddleware() } = {}) {
  const app = express();

  app.use(express.json({ limit: '3mb' })); // room for base64 avatar uploads (R9 profile pic)
  app.use(sessionMiddleware);
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/status', (req, res) => {
    res.json({ ok: true, app: 'fabulari-server', phase: 2 });
  });

  app.use('/api', authRoutes);
  app.use('/api', groupRoutes);
  app.use('/api', requestRoutes);
  app.use('/api', userRoutes);
  app.use('/api', adminLogRoutes);

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  // Catches any error from the routes and sends back JSON.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });

  return app;
}

module.exports = { createApp, createSessionMiddleware };
