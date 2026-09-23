import { CHAT_IMAGE_MAX_BYTES, readFileAsDataUrl, validateChatImage } from './image-file';

describe('image-file helpers', () => {
  describe('validateChatImage()', () => {
    it('accepts PNG, GIF and JPEG images', () => {
      for (const type of ['image/png', 'image/gif', 'image/jpeg']) {
        expect(validateChatImage({ type, size: 1000 })).toBeNull();
      }
    });

    it('rejects other file types', () => {
      expect(validateChatImage({ type: 'image/webp', size: 1000 })).toBe('Images must be PNG, GIF or JPEG.');
      expect(validateChatImage({ type: 'application/pdf', size: 1000 })).not.toBeNull();
    });

    it('accepts exactly 2MB and rejects anything larger', () => {
      expect(validateChatImage({ type: 'image/png', size: CHAT_IMAGE_MAX_BYTES })).toBeNull();
      expect(validateChatImage({ type: 'image/png', size: CHAT_IMAGE_MAX_BYTES + 1 })).toBe('Images must be 2MB or smaller.');
    });
  });

  describe('readFileAsDataUrl()', () => {
    it('reads a file into a base64 data URL', async () => {
      const blob = new Blob(['hi'], { type: 'image/png' });
      await expect(readFileAsDataUrl(blob)).resolves.toBe('data:image/png;base64,aGk=');
    });
  });

  it('rejects a GIF that is too big', () => {
    expect(validateChatImage({ type: 'image/gif', size: 3 * 1024 * 1024 })).toBe('Images must be 2MB or smaller.');
  });
});
