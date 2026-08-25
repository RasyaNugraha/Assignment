// User self-service routes — Phase1.md §6.2, REQUIREMENTS.md §5.
// Everything here operates on req.currentUser (the logged-in user) — nobody
// can edit another user's profile through these routes.

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../services/dbService');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

const PASSWORD_RULE = /^(?=.*[A-Z]).{8,}$/; // min 8 chars, at least 1 uppercase (R23)

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

// PUT /api/users/me — display name only (email/username is immutable, R21).
router.put('/users/me', requireAuth, (req, res) => {
  const { displayName } = req.body || {};
  if (!displayName || !displayName.trim()) {
    return res.status(400).json({ error: 'Display name is required.' });
  }
  const updated = db.update('users', req.currentUser.id, { displayName: displayName.trim() });
  res.json(toPublicUser(updated));
});

// PUT /api/users/me/password — old + new + confirm, all validated server-side (R22-R24).
router.put('/users/me/password', requireAuth, async (req, res) => {
  const { oldPassword, newPassword, confirmNewPassword } = req.body || {};
  if (!oldPassword || !newPassword || !confirmNewPassword) {
    return res.status(400).json({ error: 'Old password, new password, and confirmation are all required.' });
  }
  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ error: 'New password and confirmation do not match.' });
  }
  if (!PASSWORD_RULE.test(newPassword)) {
    return res.status(400).json({ error: 'New password must be at least 8 characters and include an uppercase letter.' });
  }

  const matches = await bcrypt.compare(oldPassword, req.currentUser.passwordHash);
  if (!matches) return res.status(401).json({ error: 'Current password is incorrect.' });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  db.update('users', req.currentUser.id, { passwordHash });
  res.status(204).end();
});

// PUT /api/users/me/preferences — optional personal UI prefs (theme/font size).
router.put('/users/me/preferences', requireAuth, (req, res) => {
  const { theme, fontSize } = req.body || {};
  const preferences = { ...req.currentUser.preferences };
  if (theme === 'light' || theme === 'dark') preferences.theme = theme;
  if (fontSize === 'small' || fontSize === 'medium' || fontSize === 'large') preferences.fontSize = fontSize;

  const updated = db.update('users', req.currentUser.id, { preferences });
  res.json(toPublicUser(updated));
});

module.exports = router;
