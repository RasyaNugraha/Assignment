// Bootstrap, register, login and logout routes.

const express = require('express');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const db = require('../services/dbService');

const router = express.Router();

// Helpers are in services/userUtils.js.
const { toPublicUser, validateRegistrationFields } = require('../services/userUtils');

// Mongo error code when the email already exists.
const DUPLICATE_KEY = 11000;

// Build a new user object.
function newUserRecord({ email, passwordHash, firstName, lastName, dateOfBirth, isSuperAdmin }) {
  return {
    id: randomUUID(),
    email,
    passwordHash,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    displayName: `${firstName.trim()} ${lastName.trim()}`,
    dateOfBirth,
    isSuperAdmin,
    groupAdminOf: [],
    groupMemberships: [],
    avatarUrl: null,
    preferences: { theme: 'light', fontSize: 'medium' },
    createdAt: new Date().toISOString(),
  };
}

// GET /api/bootstrap/status - true if there are no users yet.
router.get('/bootstrap/status', async (req, res) => {
  const userCount = await db.count('users');
  res.json({ needsBootstrap: userCount === 0 });
});

// POST /api/bootstrap - create the first user as Super Admin.
router.post('/bootstrap', async (req, res) => {
  if ((await db.count('users')) > 0) {
    return res.status(409).json({ error: 'Bootstrap has already been completed.' });
  }

  const { email, password, firstName, lastName, dateOfBirth } = req.body || {};
  const errors = validateRegistrationFields({ email, password, firstName, lastName, dateOfBirth });
  if (errors.length) return res.status(400).json({ errors });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = newUserRecord({
    email: email.toLowerCase(),
    passwordHash,
    firstName,
    lastName,
    dateOfBirth,
    isSuperAdmin: true,
  });
  await db.insert('users', user);
  await db.logAdminAction({
    action: 'user_created',
    actorId: user.id,
    targetId: user.id,
    details: `${user.displayName} bootstrapped as the initial Super Admin.`,
  });

  req.session.userId = user.id;
  res.status(201).json(toPublicUser(user));
});

// POST /api/auth/register - create a normal user.
router.post('/auth/register', async (req, res) => {
  if ((await db.count('users')) === 0) {
    return res.status(409).json({ error: 'System has not been bootstrapped yet.' });
  }

  const { email, password, firstName, lastName, dateOfBirth } = req.body || {};
  const errors = validateRegistrationFields({ email, password, firstName, lastName, dateOfBirth });
  if (errors.length) return res.status(400).json({ errors });

  const normalizedEmail = email.toLowerCase();
  if (await db.findOne('users', { email: normalizedEmail })) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = newUserRecord({
    email: normalizedEmail,
    passwordHash,
    firstName,
    lastName,
    dateOfBirth,
    isSuperAdmin: false,
  });
  try {
    await db.insert('users', user);
  } catch (err) {
    if (err.code === DUPLICATE_KEY) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    throw err;
  }
  await db.logAdminAction({
    action: 'user_created',
    actorId: user.id,
    targetId: user.id,
    details: `${user.displayName} registered an account.`,
  });

  req.session.userId = user.id;
  res.status(201).json(toPublicUser(user));
});

// POST /api/auth/login - check email + password.
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = await db.findOne('users', { email: String(email).toLowerCase() });
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) return res.status(401).json({ error: 'Invalid email or password.' });

  req.session.userId = user.id;
  res.json(toPublicUser(user));
});

// POST /api/auth/logout
router.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.status(204).end();
  });
});

// GET /api/auth/me - the logged-in user.
router.get('/auth/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const user = await db.findById('users', req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });
  res.json(toPublicUser(user));
});

module.exports = router;
