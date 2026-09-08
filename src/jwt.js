import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  console.error('FATAL: JWT_SECRET környezeti változó kötelező, és legalább 32 karakter hosszú legyen.');
  process.exit(1);
}

const JWT_ALG = 'HS256';

export function signToken(payload) {
  return jwt.sign(payload, secret, { algorithm: JWT_ALG, expiresIn: '7d' });
}

export function signTempToken(payload) {
  return jwt.sign({ ...payload, type: '2fa_pending' }, secret, { algorithm: JWT_ALG, expiresIn: '5m' });
}

export function signSseToken(payload) {
  return jwt.sign({ ...payload, type: 'sse' }, secret, { algorithm: JWT_ALG, expiresIn: '30m' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, secret, { algorithms: [JWT_ALG] });
  } catch {
    return null;
  }
}
