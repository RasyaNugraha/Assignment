// Bootstrap & auth routes (R1/R2, R20-R25). Age derives from dateOfBirth.

const express = require('express');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const db = require('../services/dbService');

const router = express.Router();

const PASSWORD_RULE = /^(?=.*[A-Z]).{8,}$/; // R23: min 8 chars + 1 uppercase

function computeAge(dateOfBirth) {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

function toPublicUser(user) {
  if (!user) return null;
  const { passwordHash, ...publicUser } = user;
  return { ...publicUser, age: computeAge(user.dateOfBirth) };
}

function validateRegistrationFields({ email, password, firstName, lastName, dateOfBirth }) {
  const errors = [];
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) errors.push('A valid email is required.');
  if (!firstName || !firstName.trim()) errors.push('First name is required.');
  if (!lastName || !lastName.trim()) errors.push('Last name is required.');

  const dob = dateOfBirth ? new Date(dateOfBirth) : null;
  if (!dateOfBirth || Number.isNaN(dob?.getTime())) {
    errors.push('A valid date of birth is required.');
  } else if (dob > new Date()) {
    errors.push('Date of birth cannot be in the future.');
  }

  if (!password || !PASSWORD_RULE.test(password)) {
    errors.push('Password must be at least 8 characters and include an uppercase letter.');
  }
  return errors;
}

// GET /api/bootstrap/status — whether the system has zero users (R2)
router.get('/bootstrap/status', (req, res) => {
  const userCount = db.getAll('users').length;
  res.json({ needsBootstrap: userCount === 0 });
});

// POST /api/bootstrap — create the first user as Super Admin (R1, R2)
router.post('/bootstrap', async (req, res) => {
  const existingUsers = db.getAll('users');
  if (existingUsers.length > 0) {
    return res.status(409).json({ error: 'Bootstrap has already been completed.' });
  }

  const { email, password, firstName, lastName, dateOfBirth } = req.body || {};
  const errors = validateRegistrationFields({ email, password, firstName, lastName, dateOfBirth });
  if (errors.length) return res.status(400).json({ errors });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: randomUUID(),
    email: email.toLowerCase(),
    passwordHash,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    dateOfBirth,
    isSuperAdmin: true,
    groupAdminOf: [],
    groupMemberships: [],
    avatarUrl: null,
    preferences: { theme: 'light', fontSize: 'medium' },
    createdAt: new Date().toISOString(),
  };
  db.insert('users', user);
  db.logAdminAction({
    action: 'user_created',
    actorId: user.id,
    targetId: user.id,
    details: `${user.displayName} bootstrapped as the initial Super Admin.`,
  });

  req.session.userId = user.id;
  res.status(201).json(toPublicUser(user));
});

// POST /api/auth/register — register a new General User (R25)
router.post('/auth/register', async (req, res) => {
  if (db.getAll('users').length === 0) {
    return res.status(409).json({ error: 'System has not been bootstrapped yet.' });
  }

  const { email, password, firstName, lastName, dateOfBirth } = req.body || {};
  const errors = validateRegistrationFields({ email, password, firstName, lastName, dateOfBirth });
  if (errors.length) return res.status(400).json({ errors });

  const normalizedEmail = email.toLowerCase();
  if (db.findOne('users', (u) => u.email === normalizedEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: randomUUID(),
    email: normalizedEmail,
    passwordHash,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    dateOfBirth,
    isSuperAdmin: false,
    groupAdminOf: [],
    groupMemberships: [],
    avatarUrl: null,
    preferences: { theme: 'light', fontSize: 'medium' },
    createdAt: new Date().toISOString(),
  };
  db.insert('users', user);
  db.logAdminAction({
    action: 'user_created',
    actorId: user.id,
    targetId: user.id,
    details: `${user.displayName} registered an account.`,
  });

  req.session.userId = user.id;
  res.status(201).json(toPublicUser(user));
});

// POST /api/auth/login
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.findOne('users', (u) => u.email === email.toLowerCase());
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

// GET /api/auth/me — current logged-in user + role info
router.get('/auth/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const user = db.findById('users', req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });
  res.json(toPublicUser(user));
});

module.exports = router;
