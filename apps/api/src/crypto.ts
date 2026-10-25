import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (value: string) => createHash('sha256').update(value).digest('base64url');

/** Constant-time string comparison that also hides length differences. */
export function safeEqual(left: string, right: string) {
  const a = createHash('sha256').update(left).digest();
  const b = createHash('sha256').update(right).digest();
  return timingSafeEqual(a, b);
}

export const appSecretConfigured = () => (process.env.APP_SECRET ?? '').length >= 32;
const tokenKey = () => {
  if (!appSecretConfigured()) throw new Error('APP_SECRET must be set to at least 32 characters.');
  return createHash('sha256').update(`retro-play:tokens:${process.env.APP_SECRET}`).digest();
};

/** Encrypts a secret (a Spotify token) for storage with AES-256-GCM under a key derived from APP_SECRET. */
export function seal(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', tokenKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

export function unseal(sealed: string) {
  const [version, iv, tag, data] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unrecognized sealed value.');
  const decipher = createDecipheriv('aes-256-gcm', tokenKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
