/** Random ids from the platform CSPRNG (never Math.random: ids must not collide or be guessable). */

const toBase64Url = (bytes: Uint8Array): string => {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** `bytes` random bytes as base64url: 16 bytes = 128 bits = 22 characters. */
export const randomId = (bytes = 16): string => {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  return toBase64Url(buf);
};

/**
 * Event id (a UUID v4).
 *
 * `crypto.randomUUID` exists only in a secure context (https, or localhost), so on a page served over plain http it
 * is built from `crypto.getRandomValues`, which every browser has in any context: 16 random bytes with the version
 * (4) and the variant (10xx) bits set, as RFC 9562 defines a version 4 UUID. The rest of reqraft takes it as
 * `randomUuid` from `src/helpers/secureContextApis.ts`; it lives here because the tracking module imports nothing
 * outside `src/tracking/`.
 */
export const eventId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
