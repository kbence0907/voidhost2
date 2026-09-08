import { createCipheriv, createDecipheriv, randomBytes, createHash, timingSafeEqual } from 'crypto';

const rawKey = process.env.ENCRYPTION_KEY;
if (!rawKey || rawKey.length < 32) {
  console.error('FATAL: ENCRYPTION_KEY környezeti változó kötelező, és legalább 32 karakter hosszú legyen.');
  process.exit(1);
}

const KEY = createHash('sha256').update(rawKey).digest();

export function encryptToken(plaintext) {
  const iv  = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptToken(stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 3) throw new Error('invalid ciphertext');
  const [ivHex, tagHex, encHex] = parts;
  const iv  = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  if (iv.length !== 12 || tag.length !== 16) throw new Error('invalid ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc, undefined, 'utf8') + decipher.final('utf8');
}

export { timingSafeEqual };
