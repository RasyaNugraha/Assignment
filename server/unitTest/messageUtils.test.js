const assert = require('assert');
const {
  IMAGE_MAX_BYTES,
  dataUrlByteSize,
  validateMessagePayload,
  resolveSentAt,
  signMessageId,
  isMessageOwnedBy,
} = require('../services/messageUtils');

// Builds a base64 data URL whose decoded size is exactly `bytes`.
const fakeImage = (bytes, type = 'png') => `data:image/${type};base64,${Buffer.alloc(bytes).toString('base64')}`;

describe('messageUtils', () => {
  describe('#dataUrlByteSize()', () => {
    it('computes the decoded size of a base64 data URL', () => {
      assert.equal(dataUrlByteSize(fakeImage(10)), 10);
      assert.equal(dataUrlByteSize(fakeImage(1024)), 1024);
    });
  });

  describe('#validateMessagePayload()', () => {
    it('accepts a plain text message and trims it', () => {
      assert.deepStrictEqual(validateMessagePayload({ text: '  hello  ' }), { ok: true, text: 'hello', imageUrl: null });
    });
    it('accepts an image-only message (PNG/GIF/JPEG)', () => {
      for (const type of ['png', 'gif', 'jpeg']) {
        assert.equal(validateMessagePayload({ imageUrl: fakeImage(100, type) }).ok, true);
      }
    });
    it('rejects an empty message', () => {
      assert.equal(validateMessagePayload({ text: '   ' }).ok, false);
    });
    it('rejects image types other than PNG/GIF/JPEG', () => {
      const result = validateMessagePayload({ imageUrl: fakeImage(100, 'webp') });
      assert.equal(result.ok, false);
      assert.equal(result.error, 'Images must be PNG, GIF or JPEG.');
    });
    it('accepts an image of exactly 2MB but rejects anything bigger', () => {
      assert.equal(validateMessagePayload({ imageUrl: fakeImage(IMAGE_MAX_BYTES) }).ok, true);
      assert.equal(validateMessagePayload({ imageUrl: fakeImage(IMAGE_MAX_BYTES + 1) }).ok, false);
    });
  });

  describe('#resolveSentAt()', () => {
    const now = new Date('2026-09-23T10:00:00.000Z');
    it('keeps the client "send pressed" time when it is close to the server clock', () => {
      assert.equal(resolveSentAt('2026-09-23T09:59:58.000Z', now), '2026-09-23T09:59:58.000Z');
    });
    it('falls back to the server time when the client clock is far off', () => {
      assert.equal(resolveSentAt('2020-01-01T00:00:00.000Z', now), now.toISOString());
    });
    it('falls back to the server time when no time is given', () => {
      assert.equal(resolveSentAt(undefined, now), now.toISOString());
    });
  });

  describe('#signMessageId() / #isMessageOwnedBy()', () => {
    const secret = 'test-secret';
    it('recognises the sender as the owner of their message id', () => {
      const id = signMessageId('user-1', secret);
      assert.equal(isMessageOwnedBy(id, 'user-1', secret), true);
    });
    it('rejects anyone else as the owner', () => {
      const id = signMessageId('user-1', secret);
      assert.equal(isMessageOwnedBy(id, 'user-2', secret), false);
    });
    it('rejects a tampered or malformed id', () => {
      const id = signMessageId('user-1', secret);
      assert.equal(isMessageOwnedBy(`${id}x`, 'user-1', secret), false);
      assert.equal(isMessageOwnedBy('no-signature', 'user-1', secret), false);
      assert.equal(isMessageOwnedBy(undefined, 'user-1', secret), false);
    });
  });
});

describe('messageUtils #nextSequence()', () => {
  const { nextSequence } = require('../services/messageUtils');
  it('never returns the same number twice, even within one millisecond', () => {
    const a = nextSequence(1000);
    const b = nextSequence(1000);
    assert.ok(b > a);
  });
  it('follows the clock when time moves forward', () => {
    assert.equal(nextSequence(9e15), 9e15);
  });
});
