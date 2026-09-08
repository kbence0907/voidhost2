import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomInt, timingSafeEqual } from 'crypto';
import { verifyToken, signSseToken } from '../jwt.js';
import { db } from '../db.js';
import { getGuildRoles, getUserTopRole, fetchDiscordProfile } from '../discord.js';
import { encryptToken, decryptToken } from '../crypto.js';
import { sseRegister, sseUnregister, sseNotify, sseNotifyUser } from '../sse.js';
import { guardBlocked, guardFail, guardClear } from '../guard.js';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

function log(event, msg, opts = {}) {
  db.addLog({ id: uuidv4(), event, msg, ...opts }).catch(() => {});
}

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || null;
}

function isValidId(id) {
  return typeof id === 'string' && uuidValidate(id);
}

function isValidDiscordId(id) {
  return typeof id === 'string' && /^[0-9]{1,30}$/.test(id);
}

function safeStrEq(a, b) {
  const sa = String(a ?? '');
  const sb = String(b ?? '');
  if (sa.length !== sb.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sa), Buffer.from(sb));
  } catch {
    return false;
  }
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

import { startBotProcess, stopBotProcess, restartBotProcess, getBotStatus, getActiveBotIds, getActiveBotCount, getAllBotStats } from '../bot-runner.js';
import { MOD_DEFAULT, MOD_RULE_KEYS, MOD_COMMANDS, buildModCommands } from '../moderation-defs.js';
import { SERVERLOG_EVENT_KEYS, mergeServerlogConfig } from '../serverlog-defs.js';
import { mergeTicketConfig, sanitizeTicketConfig, buildPanelPayload, findPanel } from '../ticket-defs.js';
import { sendBotAccessEmail, sendAccountLockedEmail, sendPasswordResetEmail, sendBannedEmail, sendUnbannedEmail, sendEmailChangeCode, sendApprovedEmail, sendRejectedEmail } from '../mailer.js';
import { pushNotification } from '../notify.js';
import { approveUserAccount, rejectUserAccount } from '../approvals.js';
import { generateSecret, verifyTotp, keyUri } from '../totp.js';
import QRCode from 'qrcode';
import { getOnlineUserIds } from '../sse.js';

const DEFAULT_PERMS = {
  maxBots:          1,
  maxBotMembers:    3,
  maxCommands:      25,
  manageOthersBots: false,
  createBots:       false,
  deleteOwnBots:    true,
  editBotSettings:  true,
  verifyUsers:      false,
  deleteUsers:      false,
  changeEmail:      false,
  resetPassword:    false,
  editRanks:        false,
  approveUsers:     false,
  approvalEmail:    false,
  viewLogs:         false,
  viewSysBots:      false,
  viewRanks:        false,
  disableBranding:   false,
  viewUsers:         false,
  deleteOthersBots:   false,
  manageBotAccess:    true,
  banUsers:           false,
  unbanUsers:         false,
  manageSystem:       false,
};

const router = Router();

router.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

router.use(async (req, res, next) => {
  if (req.path === '/healthz' || req.path === '/events') return next();
  const auth = req.headers['authorization'] ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ error: 'Invalid token' }); return; }
  if (payload.type === '2fa_pending') { res.status(401).json({ error: 'Befejezetlen bejelentkezés.' }); return; }
  if (!payload.sid) { res.status(401).json({ error: 'Érvénytelen munkamenet.' }); return; }
  const session = await db.getSessionById(payload.sid).catch(() => null);
  if (!session || session.user_id !== payload.sub) {
    res.status(401).json({ error: 'Session lejárt. Lépj be újra.' });
    return;
  }
  req.auth = payload;
  req.session = session;
  db.touchSession(payload.sid).catch(() => {});
  next();
});

router.post('/events/token', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;
  const sseToken = signSseToken({ sub: payload.sub, sid: payload.sid });
  res.json({ token: sseToken });
});

router.get('/events', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (!token) { res.status(401).end(); return; }

  const payload = verifyToken(token);
  if (!payload) { res.status(401).end(); return; }
  if (payload.type !== 'sse') { res.status(401).end(); return; }
  if (!payload.sid) { res.status(401).end(); return; }

  const session = await db.getSessionById(payload.sid).catch(() => null);
  if (!session || session.user_id !== payload.sub) { res.status(401).end(); return; }

  const user = await db.getUserById(payload.sub);
  if (!user) { res.status(401).end(); return; }

  if (!sseRegister(user.discordId ?? null, user.id, res)) {
    res.status(429).json({ error: 'Túl sok egyidejű kapcsolat.' });
    return;
  }

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(keepAlive); }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseUnregister(user.discordId ?? null, user.id, res);
  });
});

const avatarRefreshAt = new Map();
const AVATAR_REFRESH_MS = 60 * 60 * 1000;

async function maybeRefreshDiscordProfile(user) {
  if (!user.discordId) return user;
  const last = avatarRefreshAt.get(user.id) ?? 0;
  if (Date.now() - last < AVATAR_REFRESH_MS) return user;
  avatarRefreshAt.set(user.id, Date.now());
  const p = await fetchDiscordProfile(user.discordId);
  if (!p) return user;
  if (p.username !== user.discordUsername || p.avatar !== user.discordAvatar) {
    await db.updateUserDiscordProfile(user.id, p.username, p.avatar).catch(() => {});
    return { ...user, discordUsername: p.username, discordAvatar: p.avatar };
  }
  return user;
}

router.get('/me', async (req, res) => {
  const payload = req.auth;
  if (!payload) { res.status(401).json({ error: 'Unauthorized' }); return; }

  let user = await db.getUserById(payload.sub);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  user = await maybeRefreshDiscordProfile(user);

  const avatar = user.discordId && user.discordAvatar
    ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.discordAvatar}.png?size=128`
    : null;

  const topRole = await getUserTopRole(user.discordId);

  const rolePerms = topRole?.id
    ? (await db.getRankPerms(topRole.id) ?? await db.getRankPerms('default'))
    : await db.getRankPerms('default');
  const perms = { ...DEFAULT_PERMS, ...(rolePerms ?? {}) };

  const isAdminRole = topRole?.id && ADMIN_ROLE_IDS.has(topRole.id);
  const effectivePerms = isAdminRole ? { ...ALL_PERMS } : perms;
  const pendingApprovals = effectivePerms.approveUsers
    ? await db.getPendingUserCount().catch(() => 0)
    : 0;

  res.json({
    id:               user.id,
    name:             user.name,
    email:            user.email,
    avatar,
    discord_id:       user.discordId       ?? null,
    discord_username: user.discordUsername ?? null,
    role_name:        topRole?.name        ?? 'Tag',
    role_color:       topRole?.color       ?? null,
    max_bots:         perms.maxBots,
    max_bot_members:  perms.maxBotMembers,
    pending_approvals: pendingApprovals,
    perms: {
      viewLogs:          effectivePerms.viewLogs,
      viewSysBots:       effectivePerms.viewSysBots,
      viewRanks:         effectivePerms.viewRanks,
      editRanks:         effectivePerms.editRanks,
      approveUsers:      effectivePerms.approveUsers,
      disableBranding:   effectivePerms.disableBranding,
      viewUsers:         effectivePerms.viewUsers,
      verifyUsers:       effectivePerms.verifyUsers,
      deleteUsers:       effectivePerms.deleteUsers,
      changeEmail:       effectivePerms.changeEmail,
      resetPassword:     effectivePerms.resetPassword,
      manageOthersBots:  effectivePerms.manageOthersBots,
      deleteOwnBots:     effectivePerms.deleteOwnBots,
      deleteOthersBots:  effectivePerms.deleteOthersBots,
      editBotSettings:   effectivePerms.editBotSettings,
      manageBotAccess:   effectivePerms.manageBotAccess,
      banUsers:          effectivePerms.banUsers,
      unbanUsers:        effectivePerms.unbanUsers,
      manageSystem:      effectivePerms.manageSystem,
    },
  });
});

function authMiddleware(req, res) {
  if (!req.auth) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  return req.auth;
}

const ADMIN_ROLE_IDS = new Set(
  (process.env.ADMIN_ROLE_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)
);

const ALL_PERMS = Object.fromEntries(Object.keys(DEFAULT_PERMS).map(k => [k, typeof DEFAULT_PERMS[k] === 'boolean' ? true : DEFAULT_PERMS[k]]));

async function resolvePerms(req, res) {
  const payload = authMiddleware(req, res);
  if (!payload) return null;
  const user = await db.getUserById(payload.sub);
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  const topRole = await getUserTopRole(user.discordId);
  if (topRole?.id && ADMIN_ROLE_IDS.has(topRole.id)) {
    return { payload, user, perms: { ...ALL_PERMS } };
  }
  const rolePerms = topRole?.id
    ? (await db.getRankPerms(topRole.id) ?? await db.getRankPerms('default'))
    : await db.getRankPerms('default');
  return { payload, user, perms: { ...DEFAULT_PERMS, ...(rolePerms ?? {}) } };
}

function botPublic(b, extra = {}) {
  const avatarUrl = b.botAvatar
    ? `https://cdn.discordapp.com/avatars/${b.botId}/${b.botAvatar}.png?size=128`
    : null;
  return {
    id:               b.id,
    bot_id:           b.botId,
    bot_name:         b.botName,
    bot_avatar:       avatarUrl,
    guild_id:         b.guildId,
    guild_name:       b.guildName,
    guild_member_count: b.guildMemberCount,
    cmd_count:        b.cmdCount,
    created_at:       b.createdAt,
    owned:            true,
    ...extra,
  };
}

router.get('/bots', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;

  const bots = await db.getBotsByOwner(payload.sub);
  res.json(bots.map(botPublic));
});

router.get('/bots/shared', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;

  const bots = await db.getSharedBots(payload.sub);
  res.json(bots.map(b => ({ ...botPublic(b, { owned: false }), member_perms: b.memberPerms })));
});

// Rendszer nézet: minden bot valós adata (viewSysBots jog kell hozzá)
router.get('/sys/bots', async (req, res) => {
  const ctx = await resolvePerms(req, res);
  if (!ctx) return;
  if (!ctx.perms.viewSysBots) { res.status(403).json({ error: 'Nincs jogosultságod' }); return; }

  const bots = await db.getAllBots();
  const stats = getAllBotStats();
  const activeIds = new Set(getActiveBotIds());
  const onlineUserIds = getOnlineUserIds();

  const ownerIds = [...new Set(bots.map(b => b.ownerId))];
  const owners = {};
  await Promise.all(ownerIds.map(async (oid) => {
    const u = await db.getUserById(oid).catch(() => null);
    if (u) owners[oid] = { name: u.name, email: u.email };
  }));

  const list = bots.map(b => {
    const st = stats[b.id] || {};
    const active = activeIds.has(b.id);
    return {
      id:                 b.id,
      bot_id:             b.botId,
      bot_name:           b.botName,
      bot_avatar:         b.botAvatar ? `https://cdn.discordapp.com/avatars/${b.botId}/${b.botAvatar}.png?size=64` : null,
      guild_id:           b.guildId,
      guild_name:         b.guildName,
      guild_member_count: b.guildMemberCount,
      cmd_count:          b.cmdCount,
      created_at:         b.createdAt,
      owner_id:           b.ownerId,
      owner_name:         owners[b.ownerId]?.name  ?? '—',
      owner_email:        owners[b.ownerId]?.email ?? null,
      owner_online:       onlineUserIds.has(b.ownerId),
      is_active:          active,
      cpu:               active ? (st.cpu ?? 0) : 0,
      ram:               active ? (st.ram ?? 0) : 0,
      uptime:            active ? (st.uptime ?? 0) : 0,
    };
  }).sort((a, b) => (b.is_active - a.is_active) || a.bot_name.localeCompare(b.bot_name));

  const online = list.filter(b => b.is_active).length;
  res.json({
    summary: {
      total:         list.length,
      online,
      offline:       list.length - online,
      total_ram:     list.reduce((a, x) => a + x.ram, 0),
      total_members: list.reduce((a, x) => a + (x.guild_member_count || 0), 0),
      total_commands: list.reduce((a, x) => a + (x.cmd_count || 0), 0),
    },
    bots: list,
  });
});

router.post('/bots', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;

  const rawToken    = typeof req.body?.token    === 'string' ? req.body.token.trim()    : '';
  const rawGuildId  = typeof req.body?.guild_id === 'string' ? req.body.guild_id.trim() : '';
  if (!rawToken || !rawGuildId) {
    res.status(400).json({ error: 'token és guild_id kötelező' });
    return;
  }
  if (!/^[A-Za-z0-9._-]{20,200}$/.test(rawToken)) {
    res.status(400).json({ error: 'Érvénytelen bot token formátum' });
    return;
  }
  if (!isValidDiscordId(rawGuildId)) {
    res.status(400).json({ error: 'Érvénytelen guild_id' });
    return;
  }

  const owner = await db.getUserById(payload.sub);
  const ownerTopRole = await getUserTopRole(owner?.discordId);
  const ownerPerms = ownerTopRole?.id
    ? (await db.getRankPerms(ownerTopRole.id) ?? await db.getRankPerms('default'))
    : await db.getRankPerms('default');
  const effectivePerms = { ...DEFAULT_PERMS, ...(ownerPerms ?? {}) };
  if (!effectivePerms.createBots) {
    res.status(403).json({ error: 'Nincs jogosultságod botot létrehozni. Frissítsd a rangodat.' });
    return;
  }
  const maxBots = effectivePerms.maxBots;
  if (maxBots > 0) {
    const existing = await db.getBotsByOwner(payload.sub);
    if (existing.length >= maxBots) {
      res.status(403).json({ error: `Elérted a bot korlátot (${existing.length}/${maxBots}). Frissítsd a rangodat vagy töröld az egyik botot.` });
      return;
    }
  }

  const dcHeaders = { Authorization: `Bot ${rawToken}` };

  let botUser;
  try {
    const r = await fetch('https://discord.com/api/users/@me', { headers: dcHeaders });
    if (!r.ok) { res.status(400).json({ error: 'Érvénytelen bot token' }); return; }
    botUser = await r.json();
  } catch {
    res.status(400).json({ error: 'Nem sikerült elérni a Discord API-t' });
    return;
  }

  if (!botUser.bot) {
    res.status(400).json({ error: 'Ez a token nem egy bot fiókhoz tartozik' });
    return;
  }

  let app;
  try {
    const ar = await fetch('https://discord.com/api/applications/@me', { headers: dcHeaders });
    if (!ar.ok) throw new Error('HTTP ' + ar.status);
    app = await ar.json();
  } catch {
    res.status(400).json({ error: 'Nem sikerült ellenőrizni a bot Developer Portal beállításait. Próbáld újra.' });
    return;
  }

  const flags = app.flags ?? 0;
  const GUILD_MEMBERS   = (1 << 14) | (1 << 15);
  const MESSAGE_CONTENT = (1 << 18) | (1 << 19);

  const problems = [];
  if (app.bot_public !== false)          problems.push('public_bot');
  if (app.bot_require_code_grant === true) problems.push('code_grant');
  if (!(flags & GUILD_MEMBERS))          problems.push('members_intent');
  if (!(flags & MESSAGE_CONTENT))        problems.push('msg_content');

  if (problems.length) {
    res.status(400).json({
      error: 'A bot Discord Developer Portal beállításai nem megfelelőek.',
      code: 'portal_settings',
      problems,
    });
    return;
  }

  // Tulajdonjog-ellenőrzés: csak az adhatja hozzá a botot, aki a Discord applikáció
  // tulajdonosa (vagy elfogadott fejlesztői csapattag). Így nem lehet lopott/idegen
  // tokennel botot behozni.
  const adderDcId = owner?.discordId ?? null;
  if (!adderDcId) {
    res.status(403).json({ error: 'A bot hozzáadásához kösd össze a Discord fiókodat a beállításokban.' });
    return;
  }

  const ownerIds = new Set();
  if (app.team) {
    // Csapat-tulajdonú app: az app.owner egy ál-felhasználó (a csapat ID-ja), ne azt nézzük.
    if (app.team.owner_user_id) ownerIds.add(app.team.owner_user_id);
    if (Array.isArray(app.team.members)) {
      for (const m of app.team.members) {
        if (m?.user?.id && m.membership_state === 2) ownerIds.add(m.user.id);
      }
    }
  } else if (app.owner?.id) {
    ownerIds.add(app.owner.id);
  }

  if (ownerIds.size === 0) {
    res.status(400).json({ error: 'Nem sikerült ellenőrizni a bot tulajdonosát. Próbáld újra pár perc múlva.' });
    return;
  }

  if (!ownerIds.has(adderDcId)) {
    log('bot_create_denied', `${owner?.name ?? 'Ismeretlen'} idegen bot tokennel próbált botot hozzáadni (${botUser.username} / ${botUser.id})`, { userName: owner?.name, userId: payload.sub, src: 'botok' });
    res.status(403).json({
      error: 'Ezt a botot csak a Discord applikáció tulajdonosa adhatja hozzá. A bejelentkezett Discord fiókod nem tulajdonosa ennek a botnak.',
      code: 'not_bot_owner',
    });
    return;
  }

  let guildName = rawGuildId;
  let guildMemberCount = 0;
  try {
    const gr = await fetch(`https://discord.com/api/guilds/${rawGuildId}?with_counts=true`, { headers: dcHeaders });
    if (gr.ok) {
      const g = await gr.json();
      guildName        = g.name ?? rawGuildId;
      guildMemberCount = g.approximate_member_count ?? 0;
    }
  } catch {  }

  const botDbId = uuidv4();
  await db.createBot({
    id:               botDbId,
    ownerId:          payload.sub,
    botId:            botUser.id,
    botName:          botUser.username,
    botAvatar:        botUser.avatar ?? null,
    botTokenEnc:      encryptToken(rawToken),
    guildId:          rawGuildId,
    guildName,
    guildMemberCount,
    cmdCount:         0,
    createdAt:        Date.now(),
  });

  log('bot_create', `${owner?.name ?? 'Ismeretlen'} létrehozta a(z) ${botUser.username} botot (${guildName})`, { userName: owner?.name, userId: payload.sub, src: botUser.username });
  res.json({ ok: true });
});

async function resolveBotAccess(req, res, perm) {
  const payload = authMiddleware(req, res);
  if (!payload) return null;
  if (!isValidId(req.params.id)) { res.status(404).json({ error: 'Bot nem található' }); return null; }
  const bot = await db.getBotById(req.params.id);
  if (!bot) { res.status(404).json({ error: 'Bot nem található' }); return null; }
  if (bot.ownerId === payload.sub) return { bot, payload, isOwner: true };
  const member = await db.getBotMember(req.params.id, payload.sub);
  if (member) {
    if (perm) {
      const perms = JSON.parse(member.perms || '{}');
      if (!perms[perm]) { res.status(403).json({ error: 'Nincs jogosultságod' }); return null; }
    }
    return { bot, payload, isOwner: false };
  }
  const reqUser = await db.getUserById(payload.sub);
  const topRole = await getUserTopRole(reqUser?.discordId);
  const rolePerms = topRole?.id
    ? (await db.getRankPerms(topRole.id) ?? await db.getRankPerms('default'))
    : await db.getRankPerms('default');
  const adminPerms = { ...DEFAULT_PERMS, ...(rolePerms ?? {}) };
  if (adminPerms.manageOthersBots) return { bot, payload, isOwner: false, isAdmin: true };
  res.status(404).json({ error: 'Bot nem található' });
  return null;
}

router.get('/bots/:id/status', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, null);
  if (!ctx) return;
  res.json(await getBotStatus(req.params.id));
});

router.post('/bots/:id/start', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, 'canStart');
  if (!ctx) return;
  const user = await db.getUserById(ctx.payload.sub);
  const result = await startBotProcess(req.params.id, ctx.bot.botTokenEnc, user?.name ?? 'Ismeretlen');
  syncSlashCommands(ctx.bot);
  log('bot_start', `${user?.name ?? 'Ismeretlen'} elindította a(z) ${ctx.bot.botName} botot`, { userName: user?.name, userId: ctx.payload.sub, src: ctx.bot.botName });
  res.json(result);
});

router.post('/bots/:id/stop', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, 'canStop');
  if (!ctx) return;
  const user = await db.getUserById(ctx.payload.sub);
  const result = stopBotProcess(req.params.id, user?.name ?? 'Ismeretlen');
  log('bot_stop', `${user?.name ?? 'Ismeretlen'} leállította a(z) ${ctx.bot.botName} botot`, { userName: user?.name, userId: ctx.payload.sub, src: ctx.bot.botName });
  res.json(result);
});

router.post('/bots/:id/restart', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, 'canRestart');
  if (!ctx) return;
  const user = await db.getUserById(ctx.payload.sub);
  const result = restartBotProcess(req.params.id, ctx.bot.botTokenEnc, user?.name ?? 'Ismeretlen');
  log('bot_restart', `${user?.name ?? 'Ismeretlen'} újraindította a(z) ${ctx.bot.botName} botot`, { userName: user?.name, userId: ctx.payload.sub, src: ctx.bot.botName });
  res.json(result);
});

router.delete('/bots/:id', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;
  if (!isValidId(req.params.id)) { res.status(404).json({ error: 'Bot nem található' }); return; }

  const bot = await db.getBotById(req.params.id);
  if (!bot) { res.status(404).json({ error: 'Bot nem található' }); return; }

  const isOwner = bot.ownerId === payload.sub;
  if (!isOwner) {
    const reqUser = await db.getUserById(payload.sub);
    const topRole = await getUserTopRole(reqUser?.discordId);
    const rolePerms = topRole?.id
      ? (await db.getRankPerms(topRole.id) ?? await db.getRankPerms('default'))
      : await db.getRankPerms('default');
    const perms = { ...DEFAULT_PERMS, ...(rolePerms ?? {}) };
    if (!perms.deleteOthersBots) {
      res.status(403).json({ error: 'Nincs jogod törölni ezt a botot.' });
      return;
    }
  }

  const delUser = await db.getUserById(payload.sub);
  log('bot_delete', `${delUser?.name ?? 'Ismeretlen'} törölte a(z) ${bot.botName} botot`, { userName: delUser?.name, userId: payload.sub, src: bot.botName });
  await db.deleteBot(req.params.id);
  res.json({ ok: true });
});

const WELCOME_DEFAULT = {
  welcome: { enabled: false, channelId: '', type: 'plain', message: 'Üdvözlünk a szerveren, {user}! 🎮', embedColor: '#5865f2', embedTitle: '', embedFooter: '', pingBefore: false, showAvatar: true },
  dm:      { enabled: false, message: 'Szia {user}! Köszi, hogy csatlakoztál a {server} szerverhez.' },
  leave:   { enabled: false, channelId: '', type: 'plain', message: '{user} elhagyta a szerverünket. 👋', embedColor: '#ff6b81', embedTitle: '', embedFooter: '', pingBefore: false, showAvatar: false },
};

router.get('/bots/:id/welcome', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, null);
  if (!ctx) return;
  let config = null;
  try { config = await db.getWelcomeConfig(req.params.id); } catch { config = null; }
  if (config) {
    config = {
      welcome: { ...WELCOME_DEFAULT.welcome, ...config.welcome },
      dm:      { ...WELCOME_DEFAULT.dm,      ...config.dm      },
      leave:   { ...WELCOME_DEFAULT.leave,   ...config.leave   },
    };
  }
  res.json(config ?? WELCOME_DEFAULT);
});

router.put('/bots/:id/welcome', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, 'canEditSettings');
  if (!ctx) return;
  const { welcome, dm, leave } = req.body;
  if (!welcome || !dm || !leave) { res.status(400).json({ error: 'Hiányos adat' }); return; }
  const validColor = (c, def) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : def;
  const validChannelId = (c) => {
    const s = String(c ?? '');
    return /^[0-9]{1,30}$/.test(s) ? s : '';
  };
  const config = {
    welcome: {
      enabled:    !!welcome.enabled,
      channelId:  validChannelId(welcome.channelId),
      type:       welcome.type === 'embed' ? 'embed' : 'plain',
      message:    String(welcome.message ?? '').slice(0, 2000),
      embedColor: validColor(welcome.embedColor, '#5865f2'),
      embedTitle: String(welcome.embedTitle  ?? '').slice(0, 256),
      embedFooter:String(welcome.embedFooter ?? '').slice(0, 2048),
      pingBefore: !!welcome.pingBefore,
      showAvatar: !!welcome.showAvatar,
    },
    dm: {
      enabled: !!dm.enabled,
      message: String(dm.message ?? '').slice(0, 2000),
    },
    leave: {
      enabled:    !!leave.enabled,
      channelId:  validChannelId(leave.channelId),
      type:       leave.type === 'embed' ? 'embed' : 'plain',
      message:    String(leave.message ?? '').slice(0, 2000),
      embedColor: validColor(leave.embedColor, '#ff6b81'),
      embedTitle: String(leave.embedTitle  ?? '').slice(0, 256),
      embedFooter:String(leave.embedFooter ?? '').slice(0, 2048),
      pingBefore: !!leave.pingBefore,
      showAvatar: !!leave.showAvatar,
    },
  };
  try {
    await db.setWelcomeConfig(req.params.id, config);
  } catch (e) {
    console.error('welcome setWelcomeConfig error:', e);
    res.status(500).json({ error: 'Adatbázis hiba mentés közben' });
    return;
  }
  const user = await db.getUserById(ctx.payload.sub);
  log('welcome_save', `${user?.name ?? 'Ismeretlen'} mentette a welcome beállításokat a(z) ${ctx.bot.botName} bothoz`, { userName: user?.name, userId: ctx.payload.sub, src: ctx.bot.botName });
  res.json({ ok: true });
});

router.get('/bots/:id/serverlog', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, null);
  if (!ctx) return;
  let cfg = null;
  try { cfg = await db.getServerlogConfig(req.params.id); } catch {}
  res.json(mergeServerlogConfig(cfg));
});

router.put('/bots/:id/serverlog', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, 'canEditSettings');
  if (!ctx) return;
  const b = req.body ?? {};
  const validColor = (c, def) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : def;
  const validChannelId = (c) => {
    const s = String(c ?? '');
    return /^[0-9]{1,30}$/.test(s) ? s : '';
  };
  const config = {
    channelId:  validChannelId(b.channelId),
    embedColor: validColor(b.embedColor, '#5865f2'),
    events: Object.fromEntries(SERVERLOG_EVENT_KEYS.map(k => [k, {
      enabled:   !!b.events?.[k]?.enabled,
      channelId: validChannelId(b.events?.[k]?.channelId),
    }])),
  };
  try {
    await db.setServerlogConfig(req.params.id, config);
  } catch (e) {
    console.error('setServerlogConfig error:', e);
    res.status(500).json({ error: 'Adatbázis hiba mentés közben' });
    return;
  }
  const user = await db.getUserById(ctx.payload.sub);
  log('serverlog_save', `${user?.name ?? 'Ismeretlen'} mentette a szerver napló beállításokat a(z) ${ctx.bot.botName} botnál`, { userName: user?.name, userId: ctx.payload.sub, src: ctx.bot.botName });
  res.json({ ok: true });
});

router.get('/bots/:id/modules', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, null);
  if (!ctx) return;
  let modules = { invite: true, commands: true, tickets: true };
  try { modules = await db.getBotModules(req.params.id); } catch {}
  res.json(modules);
});

router.put('/bots/:id/modules', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, 'canEditSettings');
  if (!ctx) return;
  const prevModules = await db.getBotModules(req.params.id).catch(() => ({}));
  const modules = {
    invite:      req.body.invite      !== false,
    commands:    req.body.commands    !== false,
    automod:     req.body.automod     !== false,
    modcommands: req.body.modcommands !== false,
    serverlog:   req.body.serverlog   !== false,
    tickets:     req.body.tickets     !== false,
  };
  try {
    await db.setBotModules(req.params.id, modules);
  } catch (e) {
    console.error('setBotModules error:', e);
    res.status(500).json({ error: 'Adatbázis hiba mentés közben' });
    return;
  }
  if (prevModules.modcommands !== modules.modcommands) syncSlashCommands(ctx.bot);
  const user = await db.getUserById(ctx.payload.sub);
  log('module_toggle', `${user?.name ?? 'Ismeretlen'} módosította a modulokat a(z) ${ctx.bot.botName} botnál (meghívók: ${modules.invite ? 'be' : 'ki'}, parancsok: ${modules.commands ? 'be' : 'ki'}, automod: ${modules.automod ? 'be' : 'ki'}, mod parancsok: ${modules.modcommands ? 'be' : 'ki'}, szerver napló: ${modules.serverlog ? 'be' : 'ki'}, hibajegy: ${modules.tickets ? 'be' : 'ki'})`, { userName: user?.name, userId: ctx.payload.sub, src: ctx.bot.botName });
  res.json({ ok: true });
});

// ---- Hibajegy (ticket) modul ----

router.get('/bots/:id/tickets', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, null);
  if (!ctx) return;
  let raw = null;
  try { raw = await db.getTicketConfig(req.params.id); } catch {}
  res.json(mergeTicketConfig(raw));
});

// egy panel elkuldese / frissitese a Discordon; { ok, messageId, error }
async function pushTicketPanel(panel, token) {
  if (!/^[0-9]{1,30}$/.test(panel.channelId ?? '')) return { ok: false, error: 'nincs csatorna beállítva' };
  if (!panel.categories?.length) return { ok: false, error: 'nincs kategória' };

  const payload = buildPanelPayload(panel);
  const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };

  if (panel.messageId) {
    const r = await fetch(`https://discord.com/api/v10/channels/${panel.channelId}/messages/${panel.messageId}`, {
      method: 'PATCH', headers, body: JSON.stringify(payload),
    }).catch(() => null);
    if (r?.ok) return { ok: true, messageId: panel.messageId };
  }

  const r = await fetch(`https://discord.com/api/v10/channels/${panel.channelId}/messages`, {
    method: 'POST', headers, body: JSON.stringify(payload),
  }).catch(() => null);
  if (!r?.ok) {
    let detail = '';
    try { detail = (await r.json())?.message ?? ''; } catch {}
    return { ok: false, error: detail || 'a bot nem tud írni a csatornába' };
  }
  const msg = await r.json().catch(() => null);
  return msg?.id ? { ok: true, messageId: msg.id } : { ok: false, error: 'ismeretlen Discord válasz' };
}

router.put('/bots/:id/tickets', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, 'canEditSettings');
  if (!ctx) return;

  // a meglévő messageId-ket megőrizzük, hogy a közzétett panel frissíthető maradjon
  let prev = null;
  try { prev = mergeTicketConfig(await db.getTicketConfig(req.params.id)); } catch {}
  const prevById = Object.fromEntries((prev?.panels ?? []).map(p => [p.id, p]));

  const config = sanitizeTicketConfig(req.body, { genId: uuidv4 });
  for (const p of config.panels) {
    if (!p.messageId && prevById[p.id]?.messageId) p.messageId = prevById[p.id].messageId;
  }

  try {
    await db.setTicketConfig(req.params.id, config);
  } catch (e) {
    console.error('setTicketConfig error:', e);
    res.status(500).json({ error: 'Adatbázis hiba mentés közben' });
    return;
  }

  // a panelek mentéskor automatikusan kimennek / frissülnek a Discordon
  const token = decryptToken(ctx.bot.botTokenEnc);
  const panels = [];
  let msgIdChanged = false;
  for (const p of config.panels) {
    // a még hiányosan kitöltött panel nem hiba, csak nem megy ki
    if (!/^[0-9]{1,30}$/.test(p.channelId ?? '') || !p.categories.length) {
      panels.push({ id: p.id, name: p.name, ok: true, skipped: true });
      continue;
    }
    // ha a látható panel nem változott, nem terheljük feleslegesen a Discordot
    const before = prevById[p.id];
    if (before?.messageId && before.messageId === p.messageId
        && JSON.stringify(buildPanelPayload(before)) === JSON.stringify(buildPanelPayload(p))) {
      panels.push({ id: p.id, name: p.name, ok: true, skipped: true });
      continue;
    }
    const out = await pushTicketPanel(p, token);
    if (out.ok && out.messageId !== p.messageId) { p.messageId = out.messageId; msgIdChanged = true; }
    panels.push({ id: p.id, name: p.name, ok: out.ok, error: out.error });
  }
  if (msgIdChanged) await db.setTicketConfig(req.params.id, config).catch(() => {});

  const user = await db.getUserById(ctx.payload.sub);
  log('tickets_save', `${user?.name ?? 'Ismeretlen'} mentette a hibajegy beállításokat a(z) ${ctx.bot.botName} botnál`, { userName: user?.name, userId: ctx.payload.sub, src: ctx.bot.botName });
  const published = panels.filter(p => p.ok && !p.skipped).length;
  if (published) {
    log('tickets_publish', `${user?.name ?? 'Ismeretlen'} kiküldte a hibajegy paneleket (${published} db) a(z) ${ctx.bot.botName} botnál`, { userName: user?.name, userId: ctx.payload.sub, src: ctx.bot.botName });
  }
  res.json({ ok: true, config, panels });
});

// kézi újraküldés (a mentés amúgy automatikusan kiküldi a paneleket)
router.post('/bots/:id/tickets/panels/:panelId/publish', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, 'canEditSettings');
  if (!ctx) return;

  let config = null;
  try { config = mergeTicketConfig(await db.getTicketConfig(req.params.id)); } catch {}
  const panel = findPanel(config, req.params.panelId);
  if (!panel) { res.status(404).json({ error: 'A panel nem található. Előbb mentsd a beállításokat.' }); return; }

  const out = await pushTicketPanel(panel, decryptToken(ctx.bot.botTokenEnc));
  if (!out.ok) {
    res.status(400).json({ error: `Nem sikerült elküldeni a panelt: ${out.error}. Ellenőrizd, hogy a bot látja-e a csatornát és van-e üzenet küldése joga.` });
    return;
  }

  // messageId visszaírása a konfigba
  const stored = await db.getTicketConfig(req.params.id).catch(() => null);
  if (stored?.panels) {
    const p = stored.panels.find(x => x.id === panel.id);
    if (p) { p.messageId = out.messageId; await db.setTicketConfig(req.params.id, stored).catch(() => {}); }
  }

  const user = await db.getUserById(ctx.payload.sub);
  log('tickets_publish', `${user?.name ?? 'Ismeretlen'} közzétette a(z) "${panel.name}" hibajegy panelt (${ctx.bot.botName})`, { userName: user?.name, userId: ctx.payload.sub, src: ctx.bot.botName });
  res.json({ ok: true, messageId: out.messageId });
});

router.get('/bots/:id/tickets/open', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, null);
  if (!ctx) return;
  let rows = [];
  try { rows = await db.getOpenTickets(req.params.id); } catch {}
  res.json(rows.map(t => ({
    id: t.id, number: t.number, channel_id: t.channel_id,
    panel_id: t.panel_id, category_id: t.category_id,
    opener_id: t.opener_id, opener_tag: t.opener_tag,
    claimed_by: t.claimed_by, created_at: t.created_at,
  })));
});

function mergeModConfig(cfg) {
  const out = { ...MOD_DEFAULT, ...(cfg ?? {}) };
  out.global = { ...MOD_DEFAULT.global, ...(cfg?.global ?? {}) };
  for (const k of MOD_RULE_KEYS) out[k] = { ...MOD_DEFAULT[k], ...(cfg?.[k] ?? {}) };
  out.commandPerms = {
    global:    { ...MOD_DEFAULT.commandPerms.global, ...(cfg?.commandPerms?.global ?? {}) },
    overrides: (cfg?.commandPerms?.overrides && typeof cfg.commandPerms.overrides === 'object') ? cfg.commandPerms.overrides : {},
  };
  return out;
}

router.get('/bots/:id/moderation', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, null);
  if (!ctx) return;
  let cfg = null;
  try { cfg = await db.getModerationConfig(req.params.id); } catch {}
  res.json(mergeModConfig(cfg));
});

router.put('/bots/:id/moderation', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, 'canEditSettings');
  if (!ctx) return;
  const b = req.body ?? {};

  const idList  = (v) => Array.isArray(v) ? v.map(x => String(x ?? '')).filter(s => /^[0-9]{1,30}$/.test(s)).slice(0, 50) : [];
  const strList = (v, maxLen, maxItems) => Array.isArray(v) ? v.map(x => String(x ?? '').trim().toLowerCase().slice(0, maxLen)).filter(Boolean).slice(0, maxItems) : [];
  const num     = (v, def, min, max) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };

  const rule = (src, def, extra = {}) => ({
    enabled:        !!src?.enabled,
    deleteMessage:  src?.deleteMessage !== false,
    replyMessage:   String(src?.replyMessage ?? def.replyMessage).slice(0, 500),
    timeoutEnabled: !!src?.timeoutEnabled,
    timeoutMinutes: num(src?.timeoutMinutes, def.timeoutMinutes, 1, 40320),
    bypassRoleIds:  idList(src?.bypassRoleIds),
    bypassUserIds:  idList(src?.bypassUserIds),
    ...extra,
  });

  const validActions = new Set(MOD_COMMANDS.map(c => c.action));

  const cmdPerm = (src) => ({
    useDiscord: src?.useDiscord !== false,
    roleIds:    idList(src?.roleIds),
    userIds:    idList(src?.userIds),
  });
  const commandPerms = { global: cmdPerm(b.commandPerms?.global), overrides: {} };
  const rawOv = b.commandPerms?.overrides;
  if (rawOv && typeof rawOv === 'object') {
    for (const action of validActions) {
      const o = rawOv[action];
      if (o && o.inherit === false) commandPerms.overrides[action] = { inherit: false, ...cmdPerm(o) };
    }
  }

  const config = {
    language: b.language === 'en' ? 'en' : 'hu',
    disabledCommands: Array.isArray(b.disabledCommands)
      ? [...new Set(b.disabledCommands.map(x => String(x ?? '')).filter(a => validActions.has(a)))]
      : [],
    commandPerms,
    global: {
      bypassRoleIds:  idList(b.global?.bypassRoleIds),
      bypassUserIds:  idList(b.global?.bypassUserIds),
      appliedRoleIds: idList(b.global?.appliedRoleIds),
    },
    profanity: rule(b.profanity, MOD_DEFAULT.profanity, {
      words: strList(b.profanity?.words, 60, 200),
    }),
    gif: rule(b.gif, MOD_DEFAULT.gif, {
      allowedChannelIds: idList(b.gif?.allowedChannelIds),
    }),
    content: rule(b.content, MOD_DEFAULT.content, {
      allowedChannelIds: idList(b.content?.allowedChannelIds),
    }),
    mentions: rule(b.mentions, MOD_DEFAULT.mentions, {
      maxMentions: num(b.mentions?.maxMentions, 5, 2, 50),
    }),
    emoji: rule(b.emoji, MOD_DEFAULT.emoji, {
      maxEmojis: num(b.emoji?.maxEmojis, 10, 2, 100),
    }),
    repeated: rule(b.repeated, MOD_DEFAULT.repeated, {
      maxRepeats:  num(b.repeated?.maxRepeats, 3, 2, 20),
      intervalSec: num(b.repeated?.intervalSec, 15, 3, 600),
    }),
  };

  let prevLang = 'hu';
  let prevDisabled = [];
  let prevPerms = '';
  try {
    const prev = await db.getModerationConfig(req.params.id);
    prevLang = prev?.language === 'en' ? 'en' : 'hu';
    prevDisabled = Array.isArray(prev?.disabledCommands) ? prev.disabledCommands : [];
    prevPerms = JSON.stringify(prev?.commandPerms ?? {});
  } catch {}

  try {
    await db.setModerationConfig(req.params.id, config);
  } catch (e) {
    console.error('setModerationConfig error:', e);
    res.status(500).json({ error: 'Adatbázis hiba mentés közben' });
    return;
  }

  if (prevLang !== config.language
      || JSON.stringify([...prevDisabled].sort()) !== JSON.stringify([...config.disabledCommands].sort())
      || prevPerms !== JSON.stringify(config.commandPerms)) {
    syncSlashCommands(ctx.bot);
  }

  const user = await db.getUserById(ctx.payload.sub);
  log('moderation_save', `${user?.name ?? 'Ismeretlen'} mentette a moderációs beállításokat a(z) ${ctx.bot.botName} botnál`, { userName: user?.name, userId: ctx.payload.sub, src: ctx.bot.botName });
  res.json({ ok: true });
});

router.get('/bots/:id/modlogs', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, null);
  if (!ctx) return;
  let logs = [];
  try { logs = await db.getModLogs(req.params.id, 200); } catch {}
  res.json(logs);
});

router.get('/bots/:id/settings', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, null);
  if (!ctx) return;
  res.json(await db.getBotSettings(req.params.id));
});

router.put('/bots/:id/settings', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, 'canEditSettings');
  if (!ctx) return;
  const REGIONS = ['eu-bp-2','eu-fra-1','eu-ams-1'];
  const prefix = String(req.body.prefix ?? '!').slice(0,10) || '!';
  const autoRestart = !!req.body.autoRestart;
  const region = REGIONS.includes(req.body.region) ? req.body.region : 'eu-bp-2';

  const user = await db.getUserById(ctx.payload.sub);
  const topRole = await getUserTopRole(user?.discordId);
  const rolePerms = topRole?.id
    ? (await db.getRankPerms(topRole.id) ?? await db.getRankPerms('default'))
    : await db.getRankPerms('default');
  const perms = { ...DEFAULT_PERMS, ...(rolePerms ?? {}) };

  const currentSettings = await db.getBotSettings(req.params.id);
  const brandingDisabled = perms.disableBranding ? !!req.body.brandingDisabled : currentSettings.brandingDisabled;

  await db.setBotSettings(req.params.id, { prefix, autoRestart, region, brandingDisabled });
  res.json({ ok: true });
});

async function syncSlashCommands(bot) {
  try {
    const token = decryptToken(bot.botTokenEnc);
    const [cmds, mods, modCfg] = await Promise.all([
      db.getCommands(bot.id),
      db.getBotModules(bot.id).catch(() => ({})),
      db.getModerationConfig(bot.id).catch(() => null),
    ]);
    const body = cmds.filter(c => c.type === 'slash').map(c => ({
      name: c.name,
      description: c.description || 'Egyéni parancs',
      type: 1,
    }));
    if (mods.modcommands !== false) {
      const lang = modCfg?.language === 'en' ? 'en' : 'hu';
      const disabled = Array.isArray(modCfg?.disabledCommands) ? modCfg.disabledCommands : [];
      const taken = new Set(body.map(c => c.name));
      body.push(...buildModCommands(lang, disabled, modCfg).filter(c => !taken.has(c.name)));
    }
    await fetch(`https://discord.com/api/v10/applications/${bot.botId}/guilds/${bot.guildId}/commands`, {
      method: 'PUT',
      headers: { 'Authorization': `Bot ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.warn('syncSlashCommands:', e.message);
  }
}

router.get('/bots/:id/guild/roles', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, null);
  if (!ctx) return;
  try {
    const token = decryptToken(ctx.bot.botTokenEnc);
    const r = await fetch(`https://discord.com/api/v10/guilds/${ctx.bot.guildId}/roles`, {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!r.ok) { res.json([]); return; }
    const roles = await r.json();
    const colorHex = n => n ? '#' + n.toString(16).padStart(6, '0') : null;
    res.json(roles.filter(r => r.id !== ctx.bot.guildId).sort((a, b) => b.position - a.position).map(r => ({ id: r.id, name: r.name, color: colorHex(r.color) })));
  } catch { res.json([]); }
});

router.get('/bots/:id/guild/channels', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, null);
  if (!ctx) return;
  try {
    const token = decryptToken(ctx.bot.botTokenEnc);
    const r = await fetch(`https://discord.com/api/v10/guilds/${ctx.bot.guildId}/channels`, {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!r.ok) { res.json([]); return; }
    const channels = await r.json();
    res.json(
      channels
        .filter(c => c.type === 0 || c.type === 5)
        .sort((a, b) => a.position - b.position)
        .map(c => ({ id: c.id, name: c.name }))
    );
  } catch { res.json([]); }
});

router.get('/bots/:id/guild/categories', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, null);
  if (!ctx) return;
  try {
    const token = decryptToken(ctx.bot.botTokenEnc);
    const r = await fetch(`https://discord.com/api/v10/guilds/${ctx.bot.guildId}/channels`, {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!r.ok) { res.json([]); return; }
    const channels = await r.json();
    res.json(
      channels
        .filter(c => c.type === 4)
        .sort((a, b) => a.position - b.position)
        .map(c => ({ id: c.id, name: c.name }))
    );
  } catch { res.json([]); }
});

router.get('/bots/:id/commands/settings', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, null);
  if (!ctx) return;
  const owner = await db.getUserById(ctx.bot.ownerId);
  const ownerTopRole = await getUserTopRole(owner?.discordId);
  const ownerPerms = ownerTopRole?.id
    ? (await db.getRankPerms(ownerTopRole.id) ?? await db.getRankPerms('default'))
    : await db.getRankPerms('default');
  const maxCommands = { ...DEFAULT_PERMS, ...(ownerPerms ?? {}) }.maxCommands;
  res.json({ maxCommands });
});

router.get('/bots/:id/commands', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, null);
  if (!ctx) return;
  res.json(await db.getCommands(req.params.id));
});

router.post('/bots/:id/commands', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, 'canEditCommands');
  if (!ctx) return;
  const owner = await db.getUserById(ctx.bot.ownerId);
  const ownerTopRole = await getUserTopRole(owner?.discordId);
  const ownerRolePerms = ownerTopRole?.id
    ? (await db.getRankPerms(ownerTopRole.id) ?? await db.getRankPerms('default'))
    : await db.getRankPerms('default');
  const maxCmds = { ...DEFAULT_PERMS, ...(ownerRolePerms ?? {}) }.maxCommands;
  const count = await db.getCommandCount(req.params.id);
  if (count >= maxCmds) { res.status(400).json({ error: `Maximum ${maxCmds} parancs engedélyezett` }); return; }
  const { name, type, description, response, responseType, embedColor, embedTitle, embedFooter, ephemeral, deleteTrigger, requiredRoleId, requiredRoleName } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'Hiányzó parancs név' }); return; }
  const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
  const existing = await db.getCommands(req.params.id);
  if (existing.some(c => c.name === cleanName)) { res.status(400).json({ error: `Már létezik "${cleanName}" nevű parancs.` }); return; }
  const user = await db.getUserById(ctx.payload.sub);
  const validColor = c => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#5865f2';
  const validRoleId = id => (typeof id === 'string' && /^[0-9]{1,30}$/.test(id)) ? id : null;
  const cmd = {
    id: uuidv4(), botId: req.params.id,
    name: cleanName,
    type: type === 'prefix' ? 'prefix' : 'slash',
    description: String(description || '').slice(0, 100),
    response: String(response || '').slice(0, 2000),
    responseType: responseType === 'embed' ? 'embed' : 'plain',
    embedColor: validColor(embedColor), embedTitle: String(embedTitle || '').slice(0, 256),
    embedFooter: String(embedFooter || '').slice(0, 2048),
    ephemeral: !!ephemeral, deleteTrigger: !!deleteTrigger,
    requiredRoleId: validRoleId(requiredRoleId),
    requiredRoleName: requiredRoleName ? String(requiredRoleName).slice(0, 100) : null,
    createdBy: user?.name ?? 'Ismeretlen', createdAt: Date.now(),
  };
  await db.createCommand(cmd);
  syncSlashCommands(ctx.bot);
  res.json({ ok: true, id: cmd.id });
});

router.put('/bots/:id/commands/:cmdId', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, 'canEditCommands');
  if (!ctx) return;
  const { name, type, description, response, responseType, embedColor, embedTitle, embedFooter, ephemeral, deleteTrigger, requiredRoleId, requiredRoleName } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'Hiányzó parancs név' }); return; }
  const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
  const existing = await db.getCommands(req.params.id);
  if (existing.some(c => c.name === cleanName && c.id !== req.params.cmdId)) {
    res.status(400).json({ error: `Már létezik "${cleanName}" nevű parancs.` }); return;
  }
  const validColor = c => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#5865f2';
  const validRoleId = id => (typeof id === 'string' && /^[0-9]{1,30}$/.test(id)) ? id : null;
  await db.updateCommand(req.params.cmdId, req.params.id, {
    name: cleanName,
    type: type === 'prefix' ? 'prefix' : 'slash',
    description: String(description || '').slice(0, 100),
    response: String(response || '').slice(0, 2000),
    responseType: responseType === 'embed' ? 'embed' : 'plain',
    embedColor: validColor(embedColor), embedTitle: String(embedTitle || '').slice(0, 256),
    embedFooter: String(embedFooter || '').slice(0, 2048),
    ephemeral: !!ephemeral, deleteTrigger: !!deleteTrigger,
    requiredRoleId: validRoleId(requiredRoleId),
    requiredRoleName: requiredRoleName ? String(requiredRoleName).slice(0, 100) : null,
  });
  syncSlashCommands(ctx.bot);
  res.json({ ok: true });
});

router.delete('/bots/:id/commands/:cmdId', async (req, res) => {
  const ctx = await resolveBotAccess(req, res, 'canEditCommands');
  if (!ctx) return;
  await db.deleteCommand(req.params.cmdId, req.params.id);
  syncSlashCommands(ctx.bot);
  res.json({ ok: true });
});

function maskEmail(email) {
  const [local, domain] = String(email ?? '').split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

router.get('/users/search', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;
  const rawQ = typeof req.query.q === 'string' ? req.query.q : '';
  const q = rawQ.trim().slice(0, 100).replace(/[%_\\]/g, ch => '\\' + ch);
  if (q.length < 2) { res.json([]); return; }
  const users = await db.searchVerifiedUsers(q);
  res.json(users.map(u => ({
    id:     u.id,
    name:   u.name,
    email:  maskEmail(u.email),
    avatar: u.discordId && u.discordAvatar
      ? `https://cdn.discordapp.com/avatars/${u.discordId}/${u.discordAvatar}.png?size=64`
      : null,
  })));
});

router.get('/bots/:id/members', async (req, res) => {
  const ctx = await resolvePerms(req, res);
  if (!ctx) return;
  if (!isValidId(req.params.id)) { res.status(404).json({ error: 'Bot nem található' }); return; }
  const bot = await db.getBotById(req.params.id);
  if (!bot || bot.ownerId !== ctx.payload.sub) { res.status(404).json({ error: 'Bot nem található' }); return; }
  if (!ctx.perms.manageBotAccess) { res.status(403).json({ error: 'Nincs jogosultságod' }); return; }
  res.json(await db.getBotMembers(req.params.id));
});

router.post('/bots/:id/members', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;
  if (!isValidId(req.params.id)) { res.status(404).json({ error: 'Bot nem található' }); return; }
  const bot = await db.getBotById(req.params.id);
  if (!bot || bot.ownerId !== payload.sub) { res.status(404).json({ error: 'Bot nem található' }); return; }

  const { userId } = req.body ?? {};
  if (!isValidId(userId)) { res.status(400).json({ error: 'userId kötelező' }); return; }
  if (userId === payload.sub) { res.status(400).json({ error: 'Magadat nem adhatod hozzá' }); return; }

  const target = await db.getUserById(userId);
  if (!target || !target.emailVerified) { res.status(400).json({ error: 'A felhasználó nem található vagy nincs verifikálva' }); return; }

  const existing = await db.getBotMember(req.params.id, userId);
  if (existing) { res.status(400).json({ error: 'A felhasználó már tag' }); return; }

  const owner = await db.getUserById(payload.sub);
  const ownerTopRole = await (await import('../discord.js')).getUserTopRole(owner?.discordId);
  const ownerPerms = ownerTopRole?.id
    ? (await db.getRankPerms(ownerTopRole.id) ?? await db.getRankPerms('default'))
    : await db.getRankPerms('default');
  const maxMembers = ownerPerms?.maxBotMembers ?? 3;
  const currentCount = await db.getBotMemberCount(req.params.id);
  if (maxMembers > 0 && currentCount >= maxMembers) {
    res.status(403).json({ error: `Elérted a tag korlátot (${currentCount}/${maxMembers})` });
    return;
  }

  const { v4: uuidv4new } = await import('uuid');
  await db.addBotMember(uuidv4new(), req.params.id, userId);
  log('member_add', `${owner?.name ?? 'Ismeretlen'} hozzáadta ${target.name}-t a(z) ${bot.botName} bothoz`, { userName: owner?.name, userId: payload.sub, src: bot.botName });

  sendBotAccessEmail(target.email, { botName: bot.botName, ownerName: owner?.name ?? 'Valaki' }).catch(() => {});
  pushNotification(userId, {
    type: 'bot_member_added',
    title: 'Hozzáadtak egy bothoz',
    body: `${owner?.name ?? 'Valaki'} hozzáadott a(z) ${bot.botName} bothoz.`,
  }).catch(() => {});

  res.json({ ok: true });
});

router.patch('/bots/:id/members/:userId', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;
  if (!isValidId(req.params.id) || !isValidId(req.params.userId)) {
    res.status(404).json({ error: 'Bot nem található' }); return;
  }
  const bot = await db.getBotById(req.params.id);
  if (!bot || bot.ownerId !== payload.sub) { res.status(404).json({ error: 'Bot nem található' }); return; }

  const { canStart, canStop, canRestart, canDelete, canManageUsers, canClearLogs, canEditSettings, canEditCommands } = req.body ?? {};
  await db.updateBotMemberPerms(req.params.id, req.params.userId, {
    canStart:        !!canStart,
    canStop:         !!canStop,
    canRestart:      !!canRestart,
    canDelete:       !!canDelete,
    canManageUsers:  !!canManageUsers,
    canClearLogs:    !!canClearLogs,
    canEditSettings: !!canEditSettings,
    canEditCommands: !!canEditCommands,
  });
  const changer = await db.getUserById(payload.sub);
  const target2 = await db.getUserById(req.params.userId);
  log('perm_change', `${changer?.name ?? 'Ismeretlen'} módosította ${target2?.name ?? req.params.userId} jogait a(z) ${bot.botName} botban`, { userName: changer?.name, userId: payload.sub, src: bot.botName });
  sseNotifyUser(req.params.userId, 'perm_update', { botId: req.params.id });
  res.json({ ok: true });
});

router.delete('/bots/:id/members/:userId', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;
  if (!isValidId(req.params.id) || !isValidId(req.params.userId)) {
    res.status(404).json({ error: 'Bot nem található' }); return;
  }
  const bot = await db.getBotById(req.params.id);
  if (!bot || bot.ownerId !== payload.sub) { res.status(404).json({ error: 'Bot nem található' }); return; }
  const removed = await db.getUserById(req.params.userId);
  const remover = await db.getUserById(payload.sub);
  await db.removeBotMember(req.params.id, req.params.userId);
  log('member_remove', `${remover?.name ?? 'Ismeretlen'} eltávolította ${removed?.name ?? req.params.userId}-t a(z) ${bot.botName} botból`, { userName: remover?.name, userId: payload.sub, src: bot.botName });
  sseNotifyUser(req.params.userId, 'bot_access_revoked', { botId: req.params.id });
  pushNotification(req.params.userId, {
    type: 'bot_member_removed',
    title: 'Eltávolítottak egy botról',
    body: `Már nincs hozzáférésed a(z) ${bot.botName} bothoz.`,
  }).catch(() => {});
  res.json({ ok: true });
});

router.get('/ranks', async (req, res) => {
  const ctx = await resolvePerms(req, res);
  if (!ctx) return;
  if (!ctx.perms.viewRanks && !ctx.perms.editRanks) {
    res.status(403).json({ error: 'Nincs jogosultságod' }); return;
  }

  const [discordRoles, savedList] = await Promise.all([
    getGuildRoles(),
    db.getAllRankPerms(),
  ]);

  const permsMap = Object.fromEntries(savedList.map(p => {
    const { roleId, ...rest } = p;
    return [roleId, rest];
  }));

  const roles = discordRoles.map(r => ({
    id:    r.id,
    name:  r.name,
    color: r.color,
    ...DEFAULT_PERMS,
    ...(permsMap[r.id] ?? {}),
  }));

  res.json(roles);
});

router.post('/ranks/:roleId', async (req, res) => {
  const ctx = await resolvePerms(req, res);
  if (!ctx) return;
  if (!ctx.perms.editRanks) {
    res.status(403).json({ error: 'Nincs jogosultságod' }); return;
  }

  const { roleId } = req.params;
  const { maxBots, maxBotMembers, maxCommands, manageOthersBots, createBots, deleteOwnBots, editBotSettings,
          verifyUsers, deleteUsers, changeEmail, resetPassword, editRanks, approveUsers, approvalEmail,
          viewLogs, viewSysBots, viewRanks, disableBranding, viewUsers, deleteOthersBots,
          manageBotAccess, banUsers, unbanUsers, manageSystem } = req.body;

  await db.setRankPerms(roleId, {
    maxBots:           Math.max(0, parseInt(maxBots, 10)       || 0),
    maxBotMembers:     Math.max(0, parseInt(maxBotMembers, 10) || 0),
    maxCommands:       Math.max(1, parseInt(maxCommands, 10)   || 25),
    manageOthersBots:  !!manageOthersBots,
    createBots:        !!createBots,
    deleteOwnBots:     !!deleteOwnBots,
    editBotSettings:   !!editBotSettings,
    verifyUsers:       !!verifyUsers,
    deleteUsers:       !!deleteUsers,
    changeEmail:       !!changeEmail,
    resetPassword:     !!resetPassword,
    editRanks:         !!editRanks,
    approveUsers:      !!approveUsers,
    approvalEmail:     !!approvalEmail,
    viewLogs:          !!viewLogs,
    viewSysBots:       !!viewSysBots,
    viewRanks:         !!viewRanks,
    disableBranding:   !!disableBranding,
    viewUsers:         !!viewUsers,
    deleteOthersBots:  !!deleteOthersBots,
    manageBotAccess:   manageBotAccess === undefined ? true : !!manageBotAccess,
    banUsers:          !!banUsers,
    unbanUsers:        !!unbanUsers,
    manageSystem:      !!manageSystem,
  });
  log('rank_edit', `${ctx.user.name} módosította a(z) ${roleId} rang jogosultságait`, { userName: ctx.user.name, userId: ctx.payload.sub, src: 'rangok' });

  res.json({ ok: true });
});

// ---- Értesítések ----

router.get('/notifications', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;
  const [items, unread] = await Promise.all([
    db.getNotifications(payload.sub, 40).catch(() => []),
    db.getUnreadNotifCount(payload.sub).catch(() => 0),
  ]);
  res.json({ items, unread });
});

router.post('/notifications/read', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;
  await db.markAllNotifRead(payload.sub).catch(() => {});
  res.json({ ok: true });
});

router.post('/notifications/:id/read', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;
  await db.markNotifRead(payload.sub, req.params.id).catch(() => {});
  res.json({ ok: true });
});

// ---- Jóváhagyás ----

router.get('/approvals', async (req, res) => {
  const ctx = await resolvePerms(req, res);
  if (!ctx) return;
  if (!ctx.perms.approveUsers) { res.status(403).json({ error: 'Nincs jogosultságod' }); return; }

  const pending = await db.getPendingUsers();
  res.json(pending.map(u => ({
    id:               u.id,
    name:             u.name,
    email:            u.email,
    discord_username: u.discord_username,
    avatar: u.discord_id && u.discord_avatar
      ? `https://cdn.discordapp.com/avatars/${u.discord_id}/${u.discord_avatar}.png?size=64`
      : null,
    created_at:       u.created_at,
  })));
});

router.post('/approvals/:id/approve', async (req, res) => {
  const ctx = await resolvePerms(req, res);
  if (!ctx) return;
  if (!ctx.perms.approveUsers) { res.status(403).json({ error: 'Nincs jogosultságod' }); return; }
  if (!isValidId(req.params.id)) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }

  const result = await approveUserAccount(req.params.id, ctx.user.name, 'jóváhagyás (web)');
  if (!result.ok) { res.status(404).json({ error: result.error }); return; }
  res.json({ ok: true });
});

router.post('/approvals/:id/reject', async (req, res) => {
  const ctx = await resolvePerms(req, res);
  if (!ctx) return;
  if (!ctx.perms.approveUsers) { res.status(403).json({ error: 'Nincs jogosultságod' }); return; }
  if (!isValidId(req.params.id)) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }

  const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';
  const result = await rejectUserAccount(req.params.id, reason, ctx.user.name, 'jóváhagyás (web)');
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }
  res.json({ ok: true });
});

router.get('/account', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;
  const user = await db.getUserById(payload.sub);
  if (!user) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }

  const sessions = await db.getUserSessions(payload.sub);
  const sid = payload.sid ?? null;

  res.json({
    id:            user.id,
    name:          user.name,
    email:         user.email,
    totp_enabled:  !!user.totpEnabled,
    sessions:      sessions.map(s => ({
      id:           s.id,
      ip:           s.ip,
      user_agent:   s.user_agent,
      created_at:   s.created_at,
      last_seen_at: s.last_seen_at,
      current:      s.id === sid,
    })),
  });
});

router.put('/account/name', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;
  const name = String(req.body?.name ?? '').trim().slice(0, 100);
  if (name.length < 2) { res.status(400).json({ error: 'A név legalább 2 karakter.' }); return; }
  await db.updateUserName(payload.sub, name);
  res.json({ ok: true });
});

router.post('/account/email/change', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;
  const newEmail = String(req.body?.email ?? '').trim().toLowerCase().slice(0, 254);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { res.status(400).json({ error: 'Érvénytelen email cím.' }); return; }

  const user = await db.getUserById(payload.sub);
  if (!user) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }
  if (user.email === newEmail) { res.status(400).json({ error: 'Ez már a jelenlegi email cím.' }); return; }

  if (guardBlocked(`pw:${payload.sub}`, 5)) {
    res.status(429).json({ error: 'Túl sok hibás jelszó. Próbáld 15 perc múlva.' });
    return;
  }
  if (!password || !(await bcrypt.compare(password, user.passwordHash))) {
    guardFail(`pw:${payload.sub}`, 5, 15 * 60 * 1000);
    res.status(401).json({ error: 'Hibás jelszó.' });
    return;
  }
  guardClear(`pw:${payload.sub}`);

  const existing = await db.getUserByEmail(newEmail);
  if (existing && existing.id !== payload.sub) {
    res.status(409).json({ error: 'Ez az email már foglalt.' }); return;
  }

  if (guardBlocked(`emailsend:${payload.sub}`, 3)) {
    res.status(429).json({ error: 'Túl sok kódküldés. Próbáld később.' });
    return;
  }
  guardFail(`emailsend:${payload.sub}`, 3, 30 * 60 * 1000);

  const code      = String(randomInt(100000, 1000000));
  const expiresAt = Date.now() + 5 * 60 * 1000;
  await db.setEmailChange(payload.sub, newEmail, code, expiresAt);
  await sendEmailChangeCode(newEmail, { name: user.name, code });

  res.json({ ok: true });
});

router.post('/account/email/verify', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;
  const code = String(req.body?.code ?? '').trim();

  const row = await db.getEmailChange(payload.sub);
  if (!row) { res.status(400).json({ error: 'Nincs folyamatban lévő email csere.' }); return; }
  if (Date.now() > row.expires_at) {
    await db.deleteEmailChange(payload.sub);
    res.status(400).json({ error: 'A kód lejárt.' }); return;
  }
  if (!safeStrEq(row.code, code)) {
    if (guardFail(`emailcode:${payload.sub}`, 5, 15 * 60 * 1000)) {
      await db.deleteEmailChange(payload.sub);
      res.status(429).json({ error: 'Túl sok hibás próbálkozás. Kezdd újra az email cserét.' });
      return;
    }
    res.status(400).json({ error: 'Hibás kód.' });
    return;
  }
  guardClear(`emailcode:${payload.sub}`);

  const existing = await db.getUserByEmail(row.new_email);
  if (existing && existing.id !== payload.sub) {
    await db.deleteEmailChange(payload.sub);
    res.status(409).json({ error: 'Ez az email közben foglalt lett.' });
    return;
  }

  await db.updateUserEmail(payload.sub, row.new_email);
  await db.deleteEmailChange(payload.sub);
  log('email_change', `Felhasználó megváltoztatta az email címét`, { userId: payload.sub, src: 'fiók' });
  res.json({ ok: true });
});

router.post('/account/password', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;
  const current = typeof req.body?.current_password === 'string' ? req.body.current_password : '';
  const next    = typeof req.body?.new_password === 'string' ? req.body.new_password : '';

  if (!validPassword(next)) {
    res.status(400).json({ error: 'A jelszónak legalább 8 karakter, 1 betű, 1 szám és 1 speciális karakter kell, szóköz nélkül.' });
    return;
  }

  const user = await db.getUserById(payload.sub);
  if (!user) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }

  if (guardBlocked(`pw:${payload.sub}`, 5)) {
    res.status(429).json({ error: 'Túl sok hibás jelszó. Próbáld 15 perc múlva.' });
    return;
  }
  if (!current || !(await bcrypt.compare(current, user.passwordHash))) {
    guardFail(`pw:${payload.sub}`, 5, 15 * 60 * 1000);
    res.status(401).json({ error: 'Hibás jelszó.' });
    return;
  }
  guardClear(`pw:${payload.sub}`);

  if (current === next) {
    res.status(400).json({ error: 'Az új jelszó nem egyezhet a jelenlegivel.' });
    return;
  }

  const hash = await bcrypt.hash(next, 12);
  await db.updateUserPassword(payload.sub, hash);

  const sessions = await db.getUserSessions(payload.sub);
  for (const s of sessions) {
    if (s.id === payload.sid) continue;
    await db.deleteSession(s.id).catch(() => {});
    sseNotifyUser(payload.sub, 'force_logout_session', { sid: s.id });
  }

  log('password_change', `Felhasználó megváltoztatta a jelszavát`, { userId: payload.sub, src: 'fiók' });
  res.json({ ok: true });
});

router.get('/account/sessions', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;
  const sessions = await db.getUserSessions(payload.sub);
  const sid = payload.sid ?? null;
  res.json(sessions.map(s => ({
    id:           s.id,
    ip:           s.ip,
    user_agent:   s.user_agent,
    created_at:   s.created_at,
    last_seen_at: s.last_seen_at,
    current:      s.id === sid,
  })));
});

router.delete('/account/sessions/:id', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;
  if (!isValidId(req.params.id)) { res.status(404).json({ error: 'Munkamenet nem található' }); return; }
  const session = await db.getSessionById(req.params.id);
  if (!session || session.user_id !== payload.sub) {
    res.status(404).json({ error: 'Munkamenet nem található' }); return;
  }
  await db.deleteSession(session.id);
  if (session.id !== payload.sid) {
    sseNotifyUser(payload.sub, 'force_logout_session', { sid: session.id });
  }
  res.json({ ok: true });
});

router.post('/account/2fa/setup', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;
  const user = await db.getUserById(payload.sub);
  if (!user) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }
  if (user.totpEnabled) { res.status(400).json({ error: 'A 2FA már be van kapcsolva.' }); return; }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (guardBlocked(`pw:${payload.sub}`, 5)) {
    res.status(429).json({ error: 'Túl sok hibás jelszó. Próbáld 15 perc múlva.' });
    return;
  }
  if (!password || !(await bcrypt.compare(password, user.passwordHash))) {
    guardFail(`pw:${payload.sub}`, 5, 15 * 60 * 1000);
    res.status(401).json({ error: 'Hibás jelszó.' });
    return;
  }
  guardClear(`pw:${payload.sub}`);

  const secret = generateSecret();
  await db.setTotpSecret(payload.sub, secret);
  const otpauthUrl = keyUri(user.email, 'VoidHost', secret);
  let qr = null;
  try {
    qr = await QRCode.toDataURL(otpauthUrl, { width: 296, margin: 2 });
  } catch {}
  res.json({ secret, otpauth_url: otpauthUrl, qr });
});

router.post('/account/2fa/enable', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;
  const code = String(req.body.code ?? '').trim();

  const user = await db.getUserById(payload.sub);
  if (!user) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }
  if (!user.totpSecret) { res.status(400).json({ error: 'Nincs generált titkos kulcs. Indítsd el a beállítást.' }); return; }
  if (user.totpEnabled) { res.status(400).json({ error: 'A 2FA már be van kapcsolva.' }); return; }

  const valid = verifyTotp(code, user.totpSecret);
  if (!valid) { res.status(400).json({ error: 'Hibás hitelesítő kód.' }); return; }

  await db.enableTotp(payload.sub);
  log('2fa_enable', `Felhasználó bekapcsolta a 2FA-t`, { userId: payload.sub, src: 'fiók' });
  res.json({ ok: true });
});

router.post('/account/2fa/disable', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;
  const code     = String(req.body?.code ?? '').trim();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  const user = await db.getUserById(payload.sub);
  if (!user) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }
  if (!user.totpEnabled) { res.status(400).json({ error: 'A 2FA nincs bekapcsolva.' }); return; }

  if (guardBlocked(`pw:${payload.sub}`, 5)) {
    res.status(429).json({ error: 'Túl sok hibás jelszó. Próbáld 15 perc múlva.' });
    return;
  }
  if (!password || !(await bcrypt.compare(password, user.passwordHash))) {
    guardFail(`pw:${payload.sub}`, 5, 15 * 60 * 1000);
    res.status(401).json({ error: 'Hibás jelszó.' });
    return;
  }
  guardClear(`pw:${payload.sub}`);

  const valid = verifyTotp(code, user.totpSecret);
  if (!valid) { res.status(400).json({ error: 'Hibás hitelesítő kód.' }); return; }

  await db.disableTotp(payload.sub);
  log('2fa_disable', `Felhasználó kikapcsolta a 2FA-t`, { userId: payload.sub, src: 'fiók' });
  res.json({ ok: true });
});

router.get('/users', async (req, res) => {
  const ctx = await resolvePerms(req, res);
  if (!ctx) return;
  if (!ctx.perms.viewUsers) { res.status(403).json({ error: 'Nincs jogosultságod' }); return; }

  const [users, onlineIds] = await Promise.all([
    db.getAllUsers(),
    Promise.resolve(getOnlineUserIds()),
  ]);

  res.json(users.map(u => {
    const avatar = u.discord_id && u.discord_avatar
      ? `https://cdn.discordapp.com/avatars/${u.discord_id}/${u.discord_avatar}.png?size=64`
      : null;
    return {
      id:             u.id,
      name:           u.name,
      email:          u.email,
      avatar,
      discord_id:     u.discord_id,
      discord_username: u.discord_username,
      email_verified: !!u.email_verified,
      created_at:     u.created_at,
      locked_until:   u.locked_until ?? null,
      is_banned:      !!u.banned,
      is_online:      onlineIds.has(u.id),
    };
  }));
});

router.get('/users/:id', async (req, res) => {
  const ctx = await resolvePerms(req, res);
  if (!ctx) return;
  if (!ctx.perms.viewUsers) { res.status(403).json({ error: 'Nincs jogosultságod' }); return; }
  if (!isValidId(req.params.id)) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }

  const user = await db.getUserById(req.params.id);
  if (!user) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }

  const avatar = user.discordId && user.discordAvatar
    ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.discordAvatar}.png?size=128`
    : null;

  const [ownedBots, sharedBotsFull, lockedUntil, topRole] = await Promise.all([
    db.getBotsByOwner(user.id),
    db.getSharedBots(user.id),
    db.checkUserLockedUntil(user.id),
    getUserTopRole(user.discordId),
  ]);

  const activeIds = new Set(getActiveBotIds());

  function mapBot(b, owned) {
    const botAvatar = b.botAvatar
      ? `https://cdn.discordapp.com/avatars/${b.botId}/${b.botAvatar}.png?size=64`
      : null;
    return {
      id: b.id, bot_id: b.botId, bot_name: b.botName, bot_avatar: botAvatar,
      guild_name: b.guildName, guild_member_count: b.guildMemberCount,
      is_active: activeIds.has(b.id), owned,
      owner_id: b.ownerId,
    };
  }

  const bots = [
    ...ownedBots.map(b => mapBot(b, true)),
    ...sharedBotsFull.map(b => mapBot(b, false)),
  ];

  const onlineIds = getOnlineUserIds();

  res.json({
    id:               user.id,
    name:             user.name,
    email:            user.email,
    avatar,
    discord_id:       user.discordId       ?? null,
    discord_username: user.discordUsername ?? null,
    email_verified:   !!user.emailVerified,
    created_at:       user.createdAt,
    locked_until:     lockedUntil ?? null,
    is_banned:        !!user.banned,
    ban_reason:       user.banReason ?? null,
    is_online:        onlineIds.has(user.id),
    role_name:        topRole?.name  ?? 'Tag',
    role_color:       topRole?.color ?? null,
    stats: {
      total_bots:  ownedBots.length,
      active_bots: bots.filter(b => b.is_active && b.owned).length,
      shared_bots: sharedBotsFull.length,
    },
    bots,
  });
});

router.post('/users/:id/reset-password', async (req, res) => {
  const ctx = await resolvePerms(req, res);
  if (!ctx) return;
  if (!ctx.perms.resetPassword) { res.status(403).json({ error: 'Nincs jogosultságod' }); return; }
  if (!isValidId(req.params.id)) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }

  const user = await db.getUserById(req.params.id);
  if (!user) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }

  const code = String(randomInt(100000, 1000000));
  const expiresAt = Date.now() + 60 * 60 * 1000;
  await db.setPasswordReset(user.id, code, expiresAt);
  await sendPasswordResetEmail(user.email, { name: user.name, code });

  log('reset_password', `${ctx.user.name} jelszó visszaállítást küldött ${user.name} részére`, { userName: ctx.user.name, userId: ctx.payload.sub, src: 'felhasználók' });
  res.json({ ok: true });
});

router.post('/users/:id/lock', async (req, res) => {
  const ctx = await resolvePerms(req, res);
  if (!ctx) return;
  if (!ctx.perms.deleteUsers) { res.status(403).json({ error: 'Nincs jogosultságod' }); return; }
  if (!isValidId(req.params.id)) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }

  const user = await db.getUserById(req.params.id);
  if (!user) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }
  if (user.id === ctx.payload.sub) { res.status(400).json({ error: 'Saját fiókodat nem zárolhatod.' }); return; }

  const actorTop = await getUserTopRole(ctx.user.discordId);
  const targetTop = await getUserTopRole(user.discordId);
  const actorAdmin = actorTop?.id && ADMIN_ROLE_IDS.has(actorTop.id);
  if (!actorAdmin && (targetTop?.position ?? -1) >= (actorTop?.position ?? -1)) {
    res.status(403).json({ error: 'Nem zárolhatsz veled azonos vagy magasabb rangú felhasználót.' });
    return;
  }

  const unlockDate = Date.now() + 4 * 24 * 60 * 60 * 1000;
  await db.lockUser(user.id, unlockDate);
  await sendAccountLockedEmail(user.email, { name: user.name, unlockDate });
  sseNotifyUser(user.id, 'force_logout', { reason: 'Fiókodat az adminisztrátor zárolta. Fellebbezéshez csatlakozz a Discord szerverünkre.' });

  log('user_lock', `${ctx.user.name} zárolta ${user.name} fiókját (4 napra)`, { userName: ctx.user.name, userId: ctx.payload.sub, src: 'felhasználók' });
  res.json({ ok: true });
});

router.post('/users/:id/unlock', async (req, res) => {
  const ctx = await resolvePerms(req, res);
  if (!ctx) return;
  if (!ctx.perms.deleteUsers) { res.status(403).json({ error: 'Nincs jogosultságod' }); return; }
  if (!isValidId(req.params.id)) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }

  const user = await db.getUserById(req.params.id);
  if (!user) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }

  await db.unlockUser(user.id);
  log('user_unlock', `${ctx.user.name} feloldotta ${user.name} zárolását`, { userName: ctx.user.name, userId: ctx.payload.sub, src: 'felhasználók' });
  res.json({ ok: true });
});

router.post('/users/:id/ban', async (req, res) => {
  const ctx = await resolvePerms(req, res);
  if (!ctx) return;
  if (!ctx.perms.banUsers) { res.status(403).json({ error: 'Nincs jogosultságod' }); return; }
  if (!isValidId(req.params.id)) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }

  const user = await db.getUserById(req.params.id);
  if (!user) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }
  if (user.id === ctx.payload.sub) { res.status(400).json({ error: 'Saját fiókodat nem tilthatod ki.' }); return; }

  const actorTop = await getUserTopRole(ctx.user.discordId);
  const targetTop = await getUserTopRole(user.discordId);
  const actorAdmin = actorTop?.id && ADMIN_ROLE_IDS.has(actorTop.id);
  if (!actorAdmin && (targetTop?.position ?? -1) >= (actorTop?.position ?? -1)) {
    res.status(403).json({ error: 'Nem tilthatsz ki veled azonos vagy magasabb rangú felhasználót.' });
    return;
  }

  const reason = String(req.body?.reason ?? '').trim().slice(0, 255) || null;

  await db.banUser(user.id, reason);
  await db.deleteUserSessions(user.id).catch(() => {});
  sseNotifyUser(user.id, 'force_logout', { reason: 'Fiókod ki lett tiltva a rendszerből.' });
  sendBannedEmail(user.email, { name: user.name, reason });

  log('user_ban', `${ctx.user.name} kitiltotta ${user.name} fiókját${reason ? ` (${reason})` : ''}`, { userName: ctx.user.name, userId: ctx.payload.sub, src: 'felhasználók' });
  res.json({ ok: true });
});

router.post('/users/:id/unban', async (req, res) => {
  const ctx = await resolvePerms(req, res);
  if (!ctx) return;
  if (!ctx.perms.unbanUsers) { res.status(403).json({ error: 'Nincs jogosultságod' }); return; }
  if (!isValidId(req.params.id)) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }

  const user = await db.getUserById(req.params.id);
  if (!user) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }

  await db.unbanUser(user.id);
  sendUnbannedEmail(user.email, { name: user.name });

  log('user_unban', `${ctx.user.name} feloldotta ${user.name} kitiltását`, { userName: ctx.user.name, userId: ctx.payload.sub, src: 'felhasználók' });
  res.json({ ok: true });
});

router.patch('/users/:id/name', async (req, res) => {
  const ctx = await resolvePerms(req, res);
  if (!ctx) return;
  if (!ctx.perms.changeEmail) { res.status(403).json({ error: 'Nincs jogosultságod' }); return; }
  if (!isValidId(req.params.id)) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }

  const name = String(req.body?.name ?? '').trim().slice(0, 100);
  if (name.length < 2) { res.status(400).json({ error: 'A név legalább 2 karakter.' }); return; }

  const user = await db.getUserById(req.params.id);
  if (!user) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }

  await db.updateUserName(user.id, name);
  log('user_name_change', `${ctx.user.name} megváltoztatta ${user.name} → ${name} nevét`, { userName: ctx.user.name, userId: ctx.payload.sub, src: 'felhasználók' });
  res.json({ ok: true });
});

router.patch('/users/:id/email', async (req, res) => {
  const ctx = await resolvePerms(req, res);
  if (!ctx) return;
  if (!ctx.perms.changeEmail) { res.status(403).json({ error: 'Nincs jogosultságod' }); return; }
  if (!isValidId(req.params.id)) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }

  const email = String(req.body?.email ?? '').trim().toLowerCase().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: 'Érvénytelen email cím.' }); return; }

  const existing = await db.getUserByEmail(email);
  if (existing && existing.id !== req.params.id) { res.status(409).json({ error: 'Ez az email már foglalt.' }); return; }

  const user = await db.getUserById(req.params.id);
  if (!user) { res.status(404).json({ error: 'Felhasználó nem található' }); return; }

  await db.updateUserEmail(user.id, email);
  log('user_email_change', `${ctx.user.name} megváltoztatta ${user.name} email-jét`, { userName: ctx.user.name, userId: ctx.payload.sub, src: 'felhasználók' });
  res.json({ ok: true });
});

router.get('/home', async (req, res) => {
  const payload = authMiddleware(req, res);
  if (!payload) return;

  const [myBots, totalRegistered, totalMessages, events] = await Promise.all([
    db.getBotsByOwner(payload.sub),
    db.getStatValue('total_registered'),
    db.getStatValue('total_messages'),
    db.getHomeEvents(15),
  ]);

  res.json({
    my_bot_count:     myBots.length,
    active_bot_count: getActiveBotCount(),
    total_messages:   Number(totalMessages),
    total_registered: Number(totalRegistered),
    events,
  });
});

router.get('/logs', async (req, res) => {
  const ctx = await resolvePerms(req, res);
  if (!ctx) return;
  if (!ctx.perms.viewLogs) { res.status(403).json({ error: 'Nincs jogosultságod' }); return; }
  const rawSearch = typeof req.query.q === 'string' ? req.query.q : '';
  const search = rawSearch.trim().slice(0, 100).replace(/[%_\\]/g, ch => '\\' + ch);
  const logs = await db.getLogs({ search, limit: 500 });
  res.json(logs);
});

async function enrichAllowlistId(id) {
  let user = null;
  try {
    user = uuidValidate(id) ? await db.getUserById(id) : await db.getUserByDiscordId(id);
  } catch { user = null; }

  let name = null, avatar = null, discordId = null;
  const registered = !!user;

  if (user) {
    name = user.name;
    discordId = user.discordId ?? null;
    if (user.discordId && user.discordAvatar) {
      avatar = `https://cdn.discordapp.com/avatars/${user.discordId}/${user.discordAvatar}.png?size=64`;
    }
  } else if (/^[0-9]{5,30}$/.test(id)) {
    discordId = id;
    const p = await fetchDiscordProfile(id).catch(() => null);
    if (p) {
      name = p.username;
      if (p.avatar) avatar = `https://cdn.discordapp.com/avatars/${id}/${p.avatar}.png?size=64`;
    }
  }

  let role = null;
  if (discordId) role = await getUserTopRole(discordId).catch(() => null);

  return {
    id,
    name:       name || id,
    avatar,
    discord_id: discordId,
    role_name:  role?.name  ?? null,
    role_color: role?.color ?? null,
    registered,
  };
}

function enrichAllowlist(ids) {
  return Promise.all(ids.map(enrichAllowlistId));
}

router.get('/system/settings', async (req, res) => {
  const ctx = await resolvePerms(req, res);
  if (!ctx) return;
  if (!ctx.perms.manageSystem) { res.status(403).json({ error: 'Nincs jogosultságod' }); return; }
  const [maintenance, ids] = await Promise.all([
    db.isMaintenance().catch(() => false),
    db.getMaintenanceAllowlist().catch(() => []),
  ]);
  res.json({ maintenance, allowlist: await enrichAllowlist(ids) });
});

router.put('/system/settings', async (req, res) => {
  const ctx = await resolvePerms(req, res);
  if (!ctx) return;
  if (!ctx.perms.manageSystem) { res.status(403).json({ error: 'Nincs jogosultságod' }); return; }

  const maintenance = !!req.body?.maintenance;

  const rawList = Array.isArray(req.body?.allowlist) ? req.body.allowlist : [];
  const allowlist = [...new Set(
    rawList
      .map(x => String(x ?? '').trim())
      .filter(id => /^[0-9]{5,30}$/.test(id) || uuidValidate(id))
  )].slice(0, 500);

  await db.setMaintenance(maintenance);
  await db.setMaintenanceAllowlist(allowlist);
  log('system_settings', `${ctx.user.name} mentette a rendszer beállításokat (karbantartás: ${maintenance ? 'be' : 'ki'}, engedélyezett: ${allowlist.length})`, { userName: ctx.user.name, userId: ctx.payload.sub, src: 'rendszer' });
  res.json({ ok: true, maintenance, allowlist: await enrichAllowlist(allowlist) });
});

export default router;
