import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomInt, timingSafeEqual } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { rateLimit } from 'express-rate-limit';
import { db } from '../db.js';
import { signToken, signTempToken, verifyToken } from '../jwt.js';
import { buildOAuthUrl, exchangeCode, getDiscordUser, hasRequiredRole, fetchDiscordProfile, isGuildMember, addGuildMember } from '../discord.js';
import { sendVerificationEmail, sendTwoFAFailEmail } from '../mailer.js';
import { sseNotifyUser } from '../sse.js';
import { notifyApprovers } from '../notify.js';
import { verifyTotp } from '../totp.js';
import { guardBlocked, guardFail, guardClear } from '../guard.js';

function log(event, msg, opts = {}) {
  db.addLog({ id: uuidv4(), event, msg, ...opts }).catch(() => {});
}

function safeStrEq(a, b) {
  const ba = Buffer.from(String(a ?? ''), 'utf8');
  const bb = Buffer.from(String(b ?? ''), 'utf8');
  if (ba.length !== bb.length) return false;
  try {
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || null;
}

function refreshDiscordProfile(user) {
  if (!user?.discordId) return;
  fetchDiscordProfile(user.discordId).then(p => {
    if (!p) return;
    if (p.username !== user.discordUsername || p.avatar !== user.discordAvatar) {
      return db.updateUserDiscordProfile(user.id, p.username, p.avatar);
    }
  }).catch(() => {});
}

const router = Router();

const rlOpts = (windowMs, max, msg) => ({
  windowMs, max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: msg },
});

const loginLimiter    = rateLimit(rlOpts(15 * 60 * 1000, 10, 'Túl sok belépési kísérlet. Próbáld 15 perc múlva.'));
const registerLimiter = rateLimit(rlOpts(60 * 60 * 1000,  5, 'Túl sok regisztrációs kísérlet. Próbáld 1 óra múlva.'));
const verifyLimiter   = rateLimit(rlOpts(15 * 60 * 1000, 10, 'Túl sok kísérlet. Próbáld 15 perc múlva.'));
const twoFALimiter    = rateLimit(rlOpts( 5 * 60 * 1000,  6, 'Túl sok 2FA kísérlet. Próbáld 5 perc múlva.'));
const resetLimiter    = rateLimit(rlOpts(60 * 60 * 1000,  5, 'Túl sok visszaállítási kísérlet. Próbáld 1 óra múlva.'));
const oauthLimiter    = rateLimit(rlOpts(10 * 60 * 1000, 30, 'Túl sok OAuth kérés. Próbáld pár perc múlva.'));

function randomCode() {
  return String(randomInt(100000, 1000000));
}

const MAINTENANCE_MSG = 'Az oldalon jelenleg karbantartás van. Csak az arra engedélyezett felhasználók léphetnek be.';

async function allowedDuringMaintenance(user) {
  if (!user) return false;
  const list = await db.getMaintenanceAllowlist().catch(() => []);
  if (!list.length) return false;
  return list.includes(user.id) || (user.discordId && list.includes(user.discordId));
}

router.get('/status', async (_req, res) => {
  let maintenance = false;
  try { maintenance = await db.isMaintenance(); } catch { maintenance = false; }
  res.json({ maintenance });
});

function validEmail(email) {
  if (typeof email !== 'string') return false;
  if (email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validName(name) {
  return typeof name === 'string' && name.length >= 2 && name.length <= 100;
}

function validPassword(pw) {
  return (
    typeof pw === 'string' &&
    pw.length >= 8 &&
    pw.length <= 256 &&
    !/\s/.test(pw) &&
    /[0-9]/.test(pw) &&
    /[^a-zA-Z0-9]/.test(pw) &&
    /[a-zA-Z]/.test(pw)
  );
}

const POPUP_TARGET = process.env.FRONTEND_ORIGIN?.split(',')[0]?.trim() ?? null;
if (!POPUP_TARGET && process.env.NODE_ENV === 'production') {
  console.error('FATAL: FRONTEND_ORIGIN környezeti változó kötelező produkciós módban (postMessage target).');
  process.exit(1);
}

function safeJson(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\//g, '\\u002f')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function popupClose(res, payload) {
  const json = safeJson(payload);
  const target = POPUP_TARGET ? JSON.stringify(POPUP_TARGET) : 'window.location.origin';
  res.send(`<!doctype html><html><head><meta charset="utf-8"/><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'"/></head><body>
<script>
try { localStorage.setItem('_vh_oauth_cb', JSON.stringify(${json})); } catch(e) {}
try {
  if (window.opener) {
    window.opener.postMessage(${json}, ${target});
  }
} catch(e) {}
window.close();
</script>
<p style="font-family:sans-serif;color:#fff;background:#050818;margin:0;padding:40px;min-height:100vh;">
  Kész! Ez az ablak automatikusan bezárul...
</p>
</body></html>`);
}

router.get('/discord', oauthLimiter, async (req, res) => {
  const reqMode = req.query.mode;
  const mode    = (reqMode === 'register') ? 'register' : 'login';
  const state   = uuidv4();
  await db.setDiscordState(state, mode);
  res.json({ url: buildOAuthUrl(state) });
});

router.get('/discord/callback', oauthLimiter, async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    popupClose(res, { type: 'dc_error', error: 'oauth_error' });
    return;
  }

  if (typeof state !== 'string' || !state) {
    popupClose(res, { type: 'dc_error', error: 'invalid_state' });
    return;
  }
  if (typeof code !== 'string' || !code) {
    popupClose(res, { type: 'dc_error', error: 'invalid_code' });
    return;
  }

  const stateRow = await db.getDiscordState(state);
  if (!stateRow) {
    popupClose(res, { type: 'dc_error', error: 'invalid_state' });
    return;
  }
  await db.deleteDiscordState(state);

  let accessToken;
  try {
    accessToken = await exchangeCode(code);
  } catch {
    popupClose(res, { type: 'dc_error', error: 'discord_token' });
    return;
  }

  let dcUser;
  try {
    dcUser = await getDiscordUser(accessToken);
  } catch {
    popupClose(res, { type: 'dc_error', error: 'discord_user' });
    return;
  }

  const maintenance = await db.isMaintenance().catch(() => false);

  if (!maintenance && (process.env.DISCORD_AUTO_JOIN === '1' || process.env.DISCORD_AUTO_JOIN === 'true')) {
    try {
      const alreadyIn = await isGuildMember(dcUser.id);
      if (!alreadyIn) {
        const joinRoles = (process.env.DISCORD_AUTO_JOIN_ROLE_IDS ?? '')
          .split(',').map(s => s.trim()).filter(Boolean);
        const added = await addGuildMember(dcUser.id, accessToken, joinRoles);
        log('auto_join', `${dcUser.username} (${dcUser.id}) behívva a szerverre: ${added ? 'siker' : 'sikertelen'}`, { src: 'discord' });
      }
    } catch (err) {
      console.warn('auto-join hiba:', err);
    }
  }

  const roleOk = await hasRequiredRole(dcUser.id);
  if (!roleOk) {
    popupClose(res, { type: 'dc_error', error: 'no_rank' });
    return;
  }

  if (stateRow.mode === 'login') {
    const user = await db.getUserByDiscordId(dcUser.id);
    if (!user) {
      if (maintenance) {
        popupClose(res, { type: 'dc_error', error: 'maintenance' });
        return;
      }
      popupClose(res, {
        type: 'dc_prefill',
        dc_id: dcUser.id,
        dc_email: dcUser.email,
        dc_username: dcUser.username,
        dc_avatar: dcUser.avatar ?? '',
        error: 'no_account',
      });
      return;
    }
    if (user.discordUsername !== dcUser.username || user.discordAvatar !== (dcUser.avatar ?? null)) {
      db.updateUserDiscordProfile(user.id, dcUser.username, dcUser.avatar).catch(() => {});
    }
    if (!user.emailVerified) {
      popupClose(res, { type: 'dc_error', error: 'not_verified' });
      return;
    }
    if (user.banned) {
      popupClose(res, { type: 'dc_error', error: 'banned' });
      return;
    }
    const lockedUntil = await db.checkUserLockedUntil(user.id);
    if (lockedUntil && Date.now() < lockedUntil) {
      popupClose(res, { type: 'dc_error', error: 'locked' });
      return;
    }
    if (maintenance && !(await allowedDuringMaintenance(user))) {
      popupClose(res, { type: 'dc_error', error: 'maintenance' });
      return;
    }
    if (!user.approved) {
      popupClose(res, { type: 'dc_error', error: 'pending_approval' });
      return;
    }
    if (user.totpEnabled) {
      const tempToken = signTempToken({ sub: user.id, email: user.email });
      popupClose(res, { type: 'dc_login_2fa', temp_token: tempToken });
      return;
    }

    const sid = uuidv4();
    const ip  = getClientIp(req);
    const ua  = req.headers['user-agent'] || null;
    await db.createSession(sid, user.id, ip, ua);

    const token = signToken({ sub: user.id, email: user.email, sid });
    popupClose(res, { type: 'dc_login', token });
    return;
  }

  if (maintenance) {
    popupClose(res, { type: 'dc_error', error: 'maintenance' });
    return;
  }

  popupClose(res, {
    type: 'dc_prefill',
    dc_id: dcUser.id,
    dc_email: dcUser.email,
    dc_username: dcUser.username,
    dc_avatar: dcUser.avatar ?? '',
  });
});

router.post('/register', registerLimiter, async (req, res) => {
  if (await db.isMaintenance().catch(() => false)) {
    res.status(503).json({ error: MAINTENANCE_MSG });
    return;
  }

  const { email: rawEmail, name: rawName, password, discord_id, discord_username, discord_avatar } = req.body ?? {};

  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  const name  = typeof rawName  === 'string' ? rawName.trim() : '';

  if (!email || !name || !password) {
    res.status(400).json({ error: 'Az email, felhasználónév és jelszó kötelező.' });
    return;
  }
  if (!validEmail(email)) {
    res.status(400).json({ error: 'Érvénytelen email cím.' });
    return;
  }
  if (!validName(name)) {
    res.status(400).json({ error: 'A felhasználónév 2-100 karakter között legyen.' });
    return;
  }
  if (!validPassword(password)) {
    res.status(400).json({
      error: 'A jelszónak legalább 8 karakter, 1 betű, 1 szám és 1 speciális karakter kell, szóköz nélkül.',
    });
    return;
  }

  const existing = await db.getUserByEmail(email);
  if (existing) {
    res.json({ ok: true, message: 'Ha ez az email még nincs regisztrálva, küldtünk egy ellenőrző kódot.' });
    return;
  }

  const dcId = typeof discord_id === 'string' && /^[0-9]{1,30}$/.test(discord_id) ? discord_id : null;
  const dcUsername = typeof discord_username === 'string' ? discord_username.slice(0, 100) : null;
  const dcAvatar   = typeof discord_avatar   === 'string' ? discord_avatar.slice(0, 100)   : null;

  const rankRolesConfigured = !!(process.env.DISCORD_RANK_ROLE_IDS?.split(',').filter(Boolean).length);
  if (rankRolesConfigured && !dcId) {
    res.status(403).json({ error: 'A regisztrációhoz Discord fiók szükséges.' });
    return;
  }

  const roleOk = await hasRequiredRole(dcId);
  if (!roleOk) {
    res.status(403).json({
      error: 'Nincs meg a szükséges Discord rang. Csatlakozz a szerverhez és szerezz megfelelő rangot.',
    });
    return;
  }

  if (dcId) {
    const dupDc = await db.getUserByDiscordId(dcId);
    if (dupDc) { res.status(409).json({ error: 'Ehhez a Discord fiókhoz már létezik regisztráció.' }); return; }
  }

  const hash = await bcrypt.hash(password, 12);
  const id   = uuidv4();
  await db.createUser({
    id, email, name, password_hash: hash,
    discord_id:       dcId       || undefined,
    discord_username: dcUsername || undefined,
    discord_avatar:   dcAvatar   || undefined,
  });
  log('register', `${name} regisztrált (email megerősítés folyamatban)`, { userName: name, userId: id, src: 'auth' });
  db.incrementStat('total_registered').catch(() => {});

  const code = randomCode();
  await db.setVerifyCode(email, code, Date.now() + 15 * 60 * 1000);
  await sendVerificationEmail(email, code);

  res.json({ ok: true, message: 'Ha ez az email még nincs regisztrálva, küldtünk egy ellenőrző kódot.' });
});

router.post('/login', loginLimiter, async (req, res) => {
  const maintenance = await db.isMaintenance().catch(() => false);

  const { email: rawEmail, password } = req.body ?? {};
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!email || typeof password !== 'string' || !password) {
    res.status(400).json({ error: 'Töltsd ki az összes mezőt.' });
    return;
  }

  if (guardBlocked(`login:${email}`, 5)) {
    res.status(429).json({ error: 'Túl sok hibás próbálkozás ehhez a fiókhoz. Próbáld 15 perc múlva.' });
    return;
  }

  const user = await db.getUserByEmail(email);

  const hashToCheck = user?.passwordHash ?? '$2a$12$CwTycUXWue0Thq9StjUM0uJ8.x4FJ8YqfQ9TZ3p5g7QwYpD5xJ2nq';
  const match = await bcrypt.compare(password, hashToCheck);

  if (!user || !match) {
    guardFail(`login:${email}`, 5, 15 * 60 * 1000);
    res.status(401).json({ error: 'Hibás email vagy jelszó.' });
    return;
  }
  guardClear(`login:${email}`);
  if (!user.emailVerified) {
    res.status(403).json({ error: 'Az email nincs hitelesítve.' });
    return;
  }
  if (user.banned) {
    res.status(403).json({ error: 'Fiókod ki van tiltva a rendszerből.' });
    return;
  }

  const lockedUntil = await db.checkUserLockedUntil(user.id);
  if (lockedUntil && Date.now() < lockedUntil) {
    const dateStr = new Date(lockedUntil).toLocaleString('hu-HU', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    res.status(403).json({ error: `Fiókod zárolva van ${dateStr}-ig. Fellebbezéshez csatlakozz a Discord szerverhez.` });
    return;
  }

  const roleOk = await hasRequiredRole(user.discordId ?? null);
  if (!roleOk) {
    res.status(403).json({ error: 'Nincs meg a szükséges Discord rang a belépéshez.' });
    return;
  }

  if (maintenance && !(await allowedDuringMaintenance(user))) {
    res.status(503).json({ error: MAINTENANCE_MSG });
    return;
  }

  if (!user.approved) {
    res.status(403).json({ error: 'A fiókod jóváhagyásra vár. Egy adminisztrátor hamarosan átnézi, és emailben értesítünk.' });
    return;
  }

  refreshDiscordProfile(user);

  if (user.totpEnabled) {
    const tempToken = signTempToken({ sub: user.id, email: user.email });
    res.json({ requires_2fa: true, temp_token: tempToken });
    return;
  }

  const sid = uuidv4();
  const ip  = getClientIp(req);
  const ua  = req.headers['user-agent'] || null;
  await db.createSession(sid, user.id, ip, ua);

  const token = signToken({ sub: user.id, email: user.email, sid });
  log('login', `${user.name} belépett a panelre`, { userName: user.name, userId: user.id, src: 'auth' });
  res.json({ token });
});

router.post('/verify', verifyLimiter, async (req, res) => {
  const { email: rawEmail, code } = req.body ?? {};
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!email || typeof code !== 'string' || !code) {
    res.status(400).json({ error: 'Hiányos adatok.' });
    return;
  }

  const row = await db.getVerifyCode(email);
  if (!row) {
    res.status(400).json({ error: 'Nincs aktív hitelesítési kód.' });
    return;
  }
  if (Date.now() > row.expiresAt) {
    await db.deleteVerifyCode(email);
    res.status(400).json({ error: 'A kód lejárt. Regisztrálj újra.' });
    return;
  }
  if (!safeStrEq(row.code, code)) {
    if (guardFail(`verify:${email}`, 8, 15 * 60 * 1000)) {
      await db.deleteVerifyCode(email);
      res.status(429).json({ error: 'Túl sok hibás próbálkozás. A kód érvénytelenítve lett, regisztrálj újra.' });
      return;
    }
    res.status(400).json({ error: 'Hibás kód.' });
    return;
  }
  guardClear(`verify:${email}`);

  await db.verifyUserEmail(email);
  await db.deleteVerifyCode(email);

  const user = await db.getUserByEmail(email);
  if (!user) { res.status(500).json({ error: 'Szerver hiba.' }); return; }

  if (!user.approved) {
    log('verified', `${user.name} email hitelesítve, jóváhagyásra vár`, { userName: user.name, userId: user.id, src: 'auth' });
    notifyApprovers({
      id: user.id,
      name: user.name,
      email: user.email,
      discordId: user.discordId ?? null,
      discordUsername: user.discordUsername ?? null,
      discordAvatar: user.discordAvatar ?? null,
      createdAt: user.createdAt,
    }).catch(() => {});
    res.json({ pending_approval: true });
    return;
  }

  const sid = uuidv4();
  const ip  = getClientIp(req);
  const ua  = req.headers['user-agent'] || null;
  await db.createSession(sid, user.id, ip, ua);

  log('verified', `${user.name} email hitelesítve, fiók aktív`, { userName: user.name, userId: user.id, src: 'auth' });
  const token = signToken({ sub: user.id, email: user.email, sid });
  res.json({ token });
});

router.post('/reset', resetLimiter, async (req, res) => {
  const { email: rawEmail, code, password } = req.body ?? {};
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!email || typeof code !== 'string' || !code || typeof password !== 'string' || !password) {
    res.status(400).json({ error: 'Hiányos adatok.' }); return;
  }
  if (!validPassword(password)) {
    res.status(400).json({ error: 'A jelszónak legalább 8 karakter, 1 betű, 1 szám és 1 speciális karakter kell, szóköz nélkül.' }); return;
  }
  const row = await db.getPasswordResetForEmail(email);
  if (!row || !row.reset_code || !row.reset_expires) {
    res.status(400).json({ error: 'Érvénytelen kód vagy email.' }); return;
  }
  if (Date.now() > row.reset_expires) {
    await db.clearPasswordReset(row.id);
    res.status(400).json({ error: 'A kód lejárt.' }); return;
  }
  if (!safeStrEq(row.reset_code, code)) {
    if (guardFail(`pwreset:${email}`, 8, 60 * 60 * 1000)) {
      await db.clearPasswordReset(row.id);
      res.status(429).json({ error: 'Túl sok hibás próbálkozás. Kérj új visszaállító kódot.' });
      return;
    }
    res.status(400).json({ error: 'Érvénytelen kód vagy email.' }); return;
  }
  guardClear(`pwreset:${email}`);
  const hash = await bcrypt.hash(password, 12);
  await db.updateUserPassword(row.id, hash);
  await db.clearPasswordReset(row.id);
  await db.deleteUserSessions(row.id).catch(() => {});
  sseNotifyUser(row.id, 'force_logout', { reason: 'Jelszavad megváltozott. Kérjük, lépj be újra.' });
  res.json({ ok: true });
});

router.post('/2fa/verify', twoFALimiter, async (req, res) => {
  const { temp_token, code } = req.body ?? {};
  if (typeof temp_token !== 'string' || typeof code !== 'string' || !temp_token || !code) {
    res.status(400).json({ error: 'Hiányos adatok.' }); return;
  }

  const payload = verifyToken(temp_token);
  if (!payload || payload.type !== '2fa_pending') {
    res.status(401).json({ error: 'Érvénytelen vagy lejárt munkamenet. Lépj be újra.' });
    return;
  }

  const user = await db.getUserById(payload.sub);
  if (!user || !user.totpEnabled || !user.totpSecret) {
    res.status(400).json({ error: 'A kétlépéses hitelesítés nincs engedélyezve.' });
    return;
  }
  if (user.banned) {
    res.status(403).json({ error: 'Fiókod ki van tiltva a rendszerből.' });
    return;
  }
  if (!user.approved) {
    res.status(403).json({ error: 'A fiókod jóváhagyásra vár.' });
    return;
  }
  const lockedUntil = await db.checkUserLockedUntil(user.id);
  if (lockedUntil && Date.now() < lockedUntil) {
    const dateStr = new Date(lockedUntil).toLocaleString('hu-HU', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    res.status(403).json({ error: `Fiókod zárolva van ${dateStr}-ig. Fellebbezéshez csatlakozz a Discord szerverhez.` });
    return;
  }

  if (guardBlocked(`2fa:${user.id}`, 10)) {
    res.status(429).json({ error: 'Túl sok hibás 2FA kísérlet. Próbáld 15 perc múlva.' });
    return;
  }

  const valid = verifyTotp(code, user.totpSecret);
  if (!valid) {
    guardFail(`2fa:${user.id}`, 10, 15 * 60 * 1000);
    const fails = await db.incrementTotpFail(user.id);
    if (fails >= 2) {
      await db.resetTotpFail(user.id);
      const ip = getClientIp(req);
      sendTwoFAFailEmail(user.email, { name: user.name, ip });
    }
    res.status(401).json({ error: 'Hibás hitelesítő kód.' });
    return;
  }

  guardClear(`2fa:${user.id}`);
  await db.resetTotpFail(user.id);

  const sid = uuidv4();
  const ip  = getClientIp(req);
  const ua  = req.headers['user-agent'] || null;
  await db.createSession(sid, user.id, ip, ua);

  const token = signToken({ sub: user.id, email: user.email, sid });
  log('login_2fa', `${user.name} belépett 2FA-val`, { userName: user.name, userId: user.id, src: 'auth' });
  res.json({ token });
});

export default router;
