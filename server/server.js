const express = require('express');
const path = require('path');
const session = require('express-session');

const authRoutes = require('./routes/auth');
const groupRoutes = require('./routes/groups');
const requestRoutes = require('./routes/requests');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(
  session({
    secret: 'fabulari-dev-secret', // fine for local dev; would move to env var before any real deployment
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
  })
);
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
  res.json({ ok: true, app: 'fabulari-server', phase: 1 });
});

app.use('/api', authRoutes);
app.use('/api', groupRoutes);
app.use('/api', requestRoutes);

// Other route groups (rooms, messages, admin logs) land here as they're
// built out per Phase1.md section 6.

app.listen(PORT, () => {
  console.log(`Fabulari server listening on http://localhost:${PORT}`);
});
