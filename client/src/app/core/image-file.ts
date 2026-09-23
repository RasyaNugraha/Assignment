// Image checks on the client (the server checks again).

export const CHAT_IMAGE_TYPES = ['image/png', 'image/gif', 'image/jpeg'];
export const CHAT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

// Returns an error message, or null if the image is ok.
export function validateChatImage(file: { type: string; size: number }): string | null {
  if (!CHAT_IMAGE_TYPES.includes(file.type)) return 'Images must be PNG, GIF or JPEG.';
  if (file.size > CHAT_IMAGE_MAX_BYTES) return 'Images must be 2MB or smaller.';
  return null;
}

// Turn a file into a base64 string.
export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
