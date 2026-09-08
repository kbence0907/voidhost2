import { createHmac, randomBytes } from 'crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function b32Encode(buf) {
  let bits = 0, val = 0, out = '';
  for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}

function b32Decode(str) {
  str = str.replace(/=+$/, '').toUpperCase();
  let bits = 0, val = 0; const out = [];
  for (const c of str) { const idx = B32.indexOf(c); if (idx < 0) continue; val = (val << 5) | idx; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}

function getCode(secret, window = 0) {
  const t = BigInt(Math.floor(Date.now() / 30000) + window);
  const buf = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) { buf[i] = Number(t >> BigInt(8 * (7 - i)) & 0xffn); }
  const key  = b32Decode(secret);
  const hmac = createHmac('sha1', key).update(buf).digest();
  const off  = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[off] & 0x7f) << 24) | ((hmac[off+1] & 0xff) << 16) | ((hmac[off+2] & 0xff) << 8) | (hmac[off+3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

export function generateSecret() {
  return b32Encode(randomBytes(20));
}

export function verifyTotp(code, secret) {
  const c = String(code).trim();
  for (let w = -1; w <= 1; w++) { if (getCode(secret, w) === c) return true; }
  return false;
}

export function keyUri(email, issuer, secret) {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
