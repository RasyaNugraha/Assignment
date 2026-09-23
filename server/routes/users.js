// Routes for the logged-in user's own profile.

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../services/dbService');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

const { toPublicUser, isValidPassword } = require('../services/userUtils');

const AVATAR_DATA_URL_RULE = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/;
const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // ~2MB decoded

// PUT /api/users/me - change display name (email can't change).
router.put('/users/me', requireAuth, async (req, res) => {
  const { displayName } = req.body || {};
  if (typeof displayName !== 'string' || !displayName.trim()) {
    return res.status(400).json({ error: 'Display name is required.' });
  }
  const updated = await db.update('users', req.currentUser.id, { displayName: displayName.trim() });
  res.json(toPublicUser(updated));
});

// PUT /api/users/me/password - change password.
router.put('/users/me/password', requireAuth, async (req, res) => {
  const { oldPassword, newPassword, confirmNewPassword } = req.body || {};
  if (![oldPassword, newPassword, confirmNewPassword].every((v) => typeof v === 'string' && v)) {
    return res.status(400).json({ error: 'Old password, new password, and confirmation are all required.' });
  }
  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ error: 'New password and confirmation do not match.' });
  }
  if (!isValidPassword(newPassword)) {
    return res.status(400).json({ error: 'New password must be at least 8 characters and include an uppercase letter.' });
  }

  const matches = await bcrypt.compare(oldPassword, req.currentUser.passwordHash);
  if (!matches) return res.status(401).json({ error: 'Current password is incorrect.' });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update('users', req.currentUser.id, { passwordHash });
  res.status(204).end();
});

// PUT /api/users/me/preferences - theme and font size.
router.put('/users/me/preferences', requireAuth, async (req, res) => {
  const { theme, fontSize } = req.body || {};
  const preferences = { ...req.currentUser.preferences };
  if (theme === 'light' || theme === 'dark') preferences.theme = theme;
  if (fontSize === 'small' || fontSize === 'medium' || fontSize === 'large') preferences.fontSize = fontSize;

  const updated = await db.update('users', req.currentUser.id, { preferences });
  res.json(toPublicUser(updated));
});

// PUT /api/users/me/avatar - save profile picture (base64, max 2MB).
router.put('/users/me/avatar', requireAuth, async (req, res) => {
  const { avatarUrl } = req.body || {};
  if (!avatarUrl || typeof avatarUrl !== 'string' || !AVATAR_DATA_URL_RULE.test(avatarUrl)) {
    return res.status(400).json({ error: 'Avatar must be a PNG, JPEG, GIF, or WebP image.' });
  }
  const base64Length = avatarUrl.length - avatarUrl.indexOf(',') - 1;
  const approxBytes = base64Length * 0.75;
  if (approxBytes > AVATAR_MAX_BYTES) {
    return res.status(400).json({ error: 'Avatar image must be 2MB or smaller.' });
  }

  const updated = await db.update('users', req.currentUser.id, { avatarUrl });
  res.json(toPublicUser(updated));
});

// GET /api/users/:id/avatar - returns the profile picture as an image.
router.get('/users/:id/avatar', requireAuth, async (req, res) => {
  const user = await db.findById('users', req.params.id);
  if (!user || !user.avatarUrl) return res.status(404).json({ error: 'No avatar.' });

  const match = /^data:(image\/[a-z]+);base64,(.*)$/s.exec(user.avatarUrl);
  if (!match) return res.status(404).json({ error: 'No avatar.' });
  res.set('Cache-Control', 'private, no-cache'); // revalidate via ETag after a change
  res.type(match[1]).send(Buffer.from(match[2], 'base64'));
});

module.exports = router;
