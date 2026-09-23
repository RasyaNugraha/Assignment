// Helper functions for chat messages.

const crypto = require('crypto');

// Images: PNG, GIF or JPEG, max 2MB.
const IMAGE_DATA_URL_RULE = /^data:image\/(png|gif|jpeg|jpg);base64,/;
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

// Server only keeps the last 5 messages per room.
const MESSAGES_KEPT_PER_ROOM = 5;

// Max difference allowed between client and server time.
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

// Size in bytes of a base64 image.
function dataUrlByteSize(dataUrl) {
  const commaIndex = dataUrl.indexOf(',');
  const base64 = dataUrl.slice(commaIndex + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

// Check a message has text or a valid image.
function validateMessagePayload(payload) {
  const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
  const imageUrl = payload?.imageUrl ?? null;

  if (imageUrl !== null) {
    if (typeof imageUrl !== 'string' || !IMAGE_DATA_URL_RULE.test(imageUrl)) {
      return { ok: false, error: 'Images must be PNG, GIF or JPEG.' };
    }
    if (dataUrlByteSize(imageUrl) > IMAGE_MAX_BYTES) {
      return { ok: false, error: 'Images must be 2MB or smaller.' };
    }
  }
  if (!text && !imageUrl) {
    return { ok: false, error: 'A message needs text or an image.' };
  }
  // No length limit on text.
  return { ok: true, text, imageUrl };
}

// Use the client's send time, unless it's way off from the server time.
function resolveSentAt(clientSentAt, now = new Date()) {
  const client = new Date(clientSentAt);
  if (!clientSentAt || Number.isNaN(client.getTime())) return now.toISOString();
  if (Math.abs(client.getTime() - now.getTime()) > MAX_CLOCK_SKEW_MS) return now.toISOString();
  return client.toISOString();
}

// Number that always goes up, used to order messages.
let lastSeq = 0;
// Next number (never repeats).
function nextSequence(now = Date.now()) {
  lastSeq = Math.max(now, lastSeq + 1);
  return lastSeq;
}

// Message id = uuid + signature of the sender, so we can check who owns it later.
function signMessageId(senderId, secret, uuid = crypto.randomUUID()) {
  const signature = crypto.createHmac('sha256', secret).update(`${uuid}:${senderId}`).digest('hex').slice(0, 32);
  return `${uuid}.${signature}`;
}

// True if this user sent the message.
function isMessageOwnedBy(messageId, userId, secret) {
  if (typeof messageId !== 'string' || !messageId.includes('.')) return false;
  const [uuid, signature] = messageId.split('.');
  const expected = signMessageId(userId, secret, uuid).split('.')[1];
  const a = Buffer.from(signature ?? '');
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  IMAGE_MAX_BYTES,
  MESSAGES_KEPT_PER_ROOM,
  dataUrlByteSize,
  validateMessagePayload,
  resolveSentAt,
  nextSequence,
  signMessageId,
  isMessageOwnedBy,
};
