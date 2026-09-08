import { drizzle } from 'drizzle-orm/mysql2';
import { eq, lt, sql, and, desc, like, or } from 'drizzle-orm';
import mysql from 'mysql2/promise';
import { mysqlTable, varchar, text, int, bigint } from 'drizzle-orm/mysql-core';

export const vhBots = mysqlTable('vh_bots', {
  id:               varchar('id',               { length: 36  }).primaryKey(),
  ownerId:          varchar('owner_id',          { length: 36  }).notNull(),
  botId:            varchar('bot_id',            { length: 30  }).notNull(),
  botName:          varchar('bot_name',          { length: 100 }).notNull(),
  botAvatar:        varchar('bot_avatar',        { length: 200 }),
  botTokenEnc:      text('bot_token_enc').notNull(),
  guildId:          varchar('guild_id',          { length: 30  }).notNull(),
  guildName:        varchar('guild_name',        { length: 100 }).notNull().default(''),
  guildMemberCount: int('guild_member_count').notNull().default(0),
  cmdCount:         int('cmd_count').notNull().default(0),
  createdAt:        bigint('created_at', { mode: 'number' }).notNull(),
});

export const vhRankPermissions = mysqlTable('vh_rank_permissions', {
  roleId: varchar('role_id', { length: 30 }).primaryKey(),
  perms:  text('perms').notNull(),
});

export const vhUsers = mysqlTable('vh_users', {
  id:              varchar('id', { length: 36 }).primaryKey(),
  email:           varchar('email', { length: 255 }).unique().notNull(),
  name:            varchar('name', { length: 100 }).notNull(),
  passwordHash:    text('password_hash').notNull(),
  discordId:       varchar('discord_id', { length: 30 }).unique(),
  discordUsername: varchar('discord_username', { length: 100 }),
  discordAvatar:   varchar('discord_avatar', { length: 100 }),
  emailVerified:   int('email_verified').notNull().default(0),
  createdAt:       bigint('created_at', { mode: 'number' }).notNull(),
  lockedUntil:     bigint('locked_until', { mode: 'number' }),
  resetCode:       varchar('reset_code', { length: 10 }),
  resetExpires:    bigint('reset_expires', { mode: 'number' }),
  banned:          int('banned').notNull().default(0),
  banReason:       varchar('ban_reason', { length: 255 }),
  totpSecret:      varchar('totp_secret', { length: 64 }),
  totpEnabled:     int('totp_enabled').notNull().default(0),
  totpFailCount:   int('totp_fail_count').notNull().default(0),
  approved:        int('approved').notNull().default(1),
});

export const vhVerifyCodes = mysqlTable('vh_verify_codes', {
  email:     varchar('email', { length: 255 }).primaryKey(),
  code:      varchar('code', { length: 10 }).notNull(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
});

export const vhDiscordStates = mysqlTable('vh_discord_states', {
  state:     varchar('state', { length: 36 }).primaryKey(),
  mode:      varchar('mode', { length: 20 }).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

export const vhBotMembers = mysqlTable('vh_bot_members', {
  id:        varchar('id',      { length: 36 }).primaryKey(),
  botId:     varchar('bot_id',  { length: 36 }).notNull(),
  userId:    varchar('user_id', { length: 36 }).notNull(),
  perms:     text('perms').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

export const vhLogs = mysqlTable('vh_logs', {
  id:        varchar('id',       { length: 36 }).primaryKey(),
  ts:        bigint('ts',        { mode: 'number' }).notNull(),
  event:     varchar('event',    { length: 50  }).notNull(),
  msg:       text('msg').notNull(),
  userName:  varchar('user_name',{ length: 100 }),
  userId:    varchar('user_id',  { length: 36  }),
  src:       varchar('src',      { length: 50  }).notNull().default('panel'),
});

export const pool = mysql.createPool(process.env.DATABASE_URL);
const drizzleDb = drizzle(pool, { schema: { vhUsers, vhVerifyCodes, vhDiscordStates, vhRankPermissions, vhBots, vhBotMembers, vhLogs }, mode: 'default' });

pool.query(`CREATE TABLE IF NOT EXISTS vh_bots (
  id VARCHAR(36) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  bot_id VARCHAR(30) NOT NULL,
  bot_name VARCHAR(100) NOT NULL,
  bot_avatar VARCHAR(200),
  bot_token_enc TEXT NOT NULL,
  guild_id VARCHAR(30) NOT NULL,
  guild_name VARCHAR(100) NOT NULL DEFAULT '',
  guild_member_count INT NOT NULL DEFAULT 0,
  cmd_count INT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('vh_bots init:', e.message));

pool.query(`CREATE TABLE IF NOT EXISTS vh_rank_permissions (
  role_id VARCHAR(30) NOT NULL,
  perms TEXT NOT NULL,
  PRIMARY KEY (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('rank_perms init:', e.message));

pool.query(`CREATE TABLE IF NOT EXISTS vh_bot_members (
  id VARCHAR(36) NOT NULL,
  bot_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  perms TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_bot_user (bot_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('bot_members init:', e.message));

pool.query(`CREATE TABLE IF NOT EXISTS vh_logs (
  id VARCHAR(36) NOT NULL,
  ts BIGINT NOT NULL,
  event VARCHAR(50) NOT NULL,
  msg TEXT NOT NULL,
  user_name VARCHAR(100),
  user_id VARCHAR(36),
  src VARCHAR(50) NOT NULL DEFAULT 'panel',
  PRIMARY KEY (id),
  KEY idx_ts (ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('vh_logs init:', e.message));

pool.query(`CREATE TABLE IF NOT EXISTS vh_welcome_settings (
  bot_id VARCHAR(36) NOT NULL,
  config TEXT NOT NULL,
  PRIMARY KEY (bot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('vh_welcome init:', e.message));

pool.query(`CREATE TABLE IF NOT EXISTS vh_bot_modules (
  bot_id VARCHAR(36) NOT NULL,
  config TEXT NOT NULL,
  PRIMARY KEY (bot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('vh_bot_modules init:', e.message));

pool.query(`CREATE TABLE IF NOT EXISTS vh_commands (
  id VARCHAR(36) NOT NULL,
  bot_id VARCHAR(36) NOT NULL,
  name VARCHAR(32) NOT NULL,
  type VARCHAR(10) NOT NULL DEFAULT 'slash',
  description VARCHAR(100) NOT NULL DEFAULT '',
  response TEXT NOT NULL DEFAULT '',
  response_type VARCHAR(10) NOT NULL DEFAULT 'plain',
  embed_color VARCHAR(7) NOT NULL DEFAULT '#5865f2',
  embed_title VARCHAR(256) NOT NULL DEFAULT '',
  embed_footer VARCHAR(2048) NOT NULL DEFAULT '',
  ephemeral TINYINT NOT NULL DEFAULT 0,
  delete_trigger TINYINT NOT NULL DEFAULT 0,
  required_role_id VARCHAR(30) DEFAULT NULL,
  required_role_name VARCHAR(100) DEFAULT NULL,
  created_by VARCHAR(100) NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_cmd_bot (bot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('vh_commands init:', e.message));

pool.query(`CREATE TABLE IF NOT EXISTS vh_serverlog_settings (
  bot_id VARCHAR(36) NOT NULL,
  config TEXT NOT NULL,
  PRIMARY KEY (bot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('vh_serverlog init:', e.message));

pool.query(`CREATE TABLE IF NOT EXISTS vh_moderation_settings (
  bot_id VARCHAR(36) NOT NULL,
  config TEXT NOT NULL,
  PRIMARY KEY (bot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('vh_moderation init:', e.message));

pool.query(`CREATE TABLE IF NOT EXISTS vh_mod_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  bot_id VARCHAR(36) NOT NULL,
  ts BIGINT NOT NULL,
  action VARCHAR(40) NOT NULL,
  moderator VARCHAR(100) NOT NULL DEFAULT '',
  target VARCHAR(100) NOT NULL DEFAULT '',
  reason TEXT,
  detail TEXT,
  PRIMARY KEY (id),
  KEY idx_modlog_bot (bot_id, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('vh_mod_logs init:', e.message));

pool.query(`CREATE TABLE IF NOT EXISTS vh_mod_actions (
  id VARCHAR(36) NOT NULL,
  bot_id VARCHAR(36) NOT NULL,
  guild_id VARCHAR(30) NOT NULL,
  user_id VARCHAR(30) NOT NULL,
  type VARCHAR(20) NOT NULL,
  expires_at BIGINT NOT NULL,
  reason TEXT,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_modact_bot (bot_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('vh_mod_actions init:', e.message));

pool.query(`CREATE TABLE IF NOT EXISTS vh_bot_settings (
  bot_id VARCHAR(36) NOT NULL,
  max_commands INT NOT NULL DEFAULT 25,
  prefix VARCHAR(10) NOT NULL DEFAULT '!',
  auto_restart TINYINT NOT NULL DEFAULT 1,
  region VARCHAR(50) NOT NULL DEFAULT 'eu-bp-2',
  PRIMARY KEY (bot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('vh_bot_settings init:', e.message));
pool.query(`ALTER TABLE vh_bot_settings ADD COLUMN IF NOT EXISTS prefix VARCHAR(10) NOT NULL DEFAULT '!'`).catch(() => {});
pool.query(`ALTER TABLE vh_bot_settings ADD COLUMN IF NOT EXISTS auto_restart TINYINT NOT NULL DEFAULT 1`).catch(() => {});
pool.query(`ALTER TABLE vh_bot_settings ADD COLUMN IF NOT EXISTS region VARCHAR(50) NOT NULL DEFAULT 'eu-bp-2'`).catch(() => {});
pool.query(`ALTER TABLE vh_bot_settings ADD COLUMN IF NOT EXISTS branding_disabled TINYINT NOT NULL DEFAULT 0`).catch(() => {});
pool.query(`ALTER TABLE vh_users ADD COLUMN IF NOT EXISTS locked_until BIGINT DEFAULT NULL`).catch(() => {});
pool.query(`ALTER TABLE vh_users ADD COLUMN IF NOT EXISTS reset_code VARCHAR(10) DEFAULT NULL`).catch(() => {});
pool.query(`ALTER TABLE vh_users ADD COLUMN IF NOT EXISTS reset_expires BIGINT DEFAULT NULL`).catch(() => {});
pool.query(`ALTER TABLE vh_users ADD COLUMN IF NOT EXISTS banned TINYINT NOT NULL DEFAULT 0`).catch(() => {});
pool.query(`ALTER TABLE vh_users ADD COLUMN IF NOT EXISTS ban_reason VARCHAR(255) DEFAULT NULL`).catch(() => {});
pool.query(`ALTER TABLE vh_users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64) DEFAULT NULL`).catch(() => {});
pool.query(`ALTER TABLE vh_users ADD COLUMN IF NOT EXISTS totp_enabled TINYINT NOT NULL DEFAULT 0`).catch(() => {});
pool.query(`ALTER TABLE vh_users ADD COLUMN IF NOT EXISTS totp_fail_count TINYINT NOT NULL DEFAULT 0`).catch(() => {});

pool.query(`CREATE TABLE IF NOT EXISTS vh_sessions (
  id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  ip VARCHAR(64),
  user_agent VARCHAR(500),
  created_at BIGINT NOT NULL,
  last_seen_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('vh_sessions init:', e.message));

pool.query(`CREATE TABLE IF NOT EXISTS vh_email_change (
  user_id VARCHAR(36) NOT NULL,
  new_email VARCHAR(255) NOT NULL,
  code VARCHAR(10) NOT NULL,
  expires_at BIGINT NOT NULL,
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('vh_email_change init:', e.message));

pool.query(`CREATE TABLE IF NOT EXISTS vh_bot_autostart (
  bot_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (bot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('vh_autostart init:', e.message));

pool.query(`CREATE TABLE IF NOT EXISTS vh_stats (
  \`key\` VARCHAR(64) NOT NULL,
  value BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (\`key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('vh_stats init:', e.message));

pool.query(`CREATE TABLE IF NOT EXISTS vh_bot_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  bot_id VARCHAR(36) NOT NULL,
  ts VARCHAR(8) NOT NULL,
  user_name VARCHAR(100) DEFAULT NULL,
  msg TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_bot_created (bot_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('vh_bot_logs init:', e.message));

pool.query(`CREATE TABLE IF NOT EXISTS vh_system (
  \`key\` VARCHAR(64) NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (\`key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('vh_system init:', e.message));

pool.query(`CREATE TABLE IF NOT EXISTS vh_notifications (
  id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body VARCHAR(500) NOT NULL DEFAULT '',
  link VARCHAR(60) DEFAULT NULL,
  is_read TINYINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_notif_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('vh_notifications init:', e.message));

pool.query(`CREATE TABLE IF NOT EXISTS vh_ticket_config (
  bot_id VARCHAR(36) NOT NULL,
  config MEDIUMTEXT NOT NULL,
  PRIMARY KEY (bot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('vh_ticket_config init:', e.message));

pool.query(`CREATE TABLE IF NOT EXISTS vh_tickets (
  id VARCHAR(36) NOT NULL,
  bot_id VARCHAR(36) NOT NULL,
  guild_id VARCHAR(30) NOT NULL,
  channel_id VARCHAR(30) NOT NULL,
  panel_id VARCHAR(36) NOT NULL,
  category_id VARCHAR(36) NOT NULL,
  number INT NOT NULL,
  opener_id VARCHAR(30) NOT NULL,
  opener_tag VARCHAR(100) NOT NULL DEFAULT '',
  status VARCHAR(10) NOT NULL DEFAULT 'open',
  claimed_by VARCHAR(30) DEFAULT NULL,
  close_reason VARCHAR(500) DEFAULT NULL,
  created_at BIGINT NOT NULL,
  closed_at BIGINT DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_tk_bot (bot_id, status),
  KEY idx_tk_channel (channel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('vh_tickets init:', e.message));

pool.query(`CREATE TABLE IF NOT EXISTS vh_ticket_counter (
  bot_id VARCHAR(36) NOT NULL,
  n INT NOT NULL DEFAULT 0,
  PRIMARY KEY (bot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(e => console.warn('vh_ticket_counter init:', e.message));

// A meglévő fiókok automatikusan jóváhagyottak (DEFAULT 1); csak az új regisztrációk kapnak 0-t.
pool.query(`ALTER TABLE vh_users ADD COLUMN IF NOT EXISTS approved TINYINT NOT NULL DEFAULT 1`).catch(() => {});

let maintenanceCache   = { value: false, at: 0 };
let allowlistCache     = { value: [], at: 0 };
const MAINTENANCE_TTL = 5000;

export const db = {
  getUserByEmail: async (email) => {
    const rows = await drizzleDb.select().from(vhUsers).where(eq(vhUsers.email, email));
    return rows[0];
  },

  getUserById: async (id) => {
    const rows = await drizzleDb.select().from(vhUsers).where(eq(vhUsers.id, id));
    return rows[0];
  },

  getUserByDiscordId: async (discordId) => {
    const rows = await drizzleDb.select().from(vhUsers).where(eq(vhUsers.discordId, discordId));
    return rows[0];
  },

  updateUserDiscordProfile: async (id, username, avatar) => {
    await drizzleDb.update(vhUsers)
      .set({ discordUsername: username ?? null, discordAvatar: avatar ?? null })
      .where(eq(vhUsers.id, id));
  },

  createUser: async (user) => {
    await drizzleDb.insert(vhUsers).values({
      id:              user.id,
      email:           user.email,
      name:            user.name,
      passwordHash:    user.password_hash,
      discordId:       user.discord_id       ?? null,
      discordUsername: user.discord_username ?? null,
      discordAvatar:   user.discord_avatar   ?? null,
      emailVerified:   0,
      approved:        user.approved ?? 0,
      createdAt:       Date.now(),
    });
  },

  verifyUserEmail: async (email) => {
    await drizzleDb.update(vhUsers).set({ emailVerified: 1 }).where(eq(vhUsers.email, email));
  },

  setVerifyCode: async (email, code, expiresAt) => {
    await drizzleDb
      .insert(vhVerifyCodes)
      .values({ email, code, expiresAt })
      .onDuplicateKeyUpdate({ set: { code, expiresAt } });
  },

  getVerifyCode: async (email) => {
    const rows = await drizzleDb.select().from(vhVerifyCodes).where(eq(vhVerifyCodes.email, email));
    if (!rows[0]) return undefined;
    return { code: rows[0].code, expiresAt: rows[0].expiresAt };
  },

  deleteVerifyCode: async (email) => {
    await drizzleDb.delete(vhVerifyCodes).where(eq(vhVerifyCodes.email, email));
  },

  setDiscordState: async (state, mode) => {
    await drizzleDb.insert(vhDiscordStates).values({ state, mode, createdAt: Date.now() });
    const cutoff = Date.now() - 10 * 60 * 1000;
    await drizzleDb.delete(vhDiscordStates).where(lt(vhDiscordStates.createdAt, cutoff));
  },

  getDiscordState: async (state) => {
    const rows = await drizzleDb.select().from(vhDiscordStates).where(eq(vhDiscordStates.state, state));
    return rows[0];
  },

  deleteDiscordState: async (state) => {
    await drizzleDb.delete(vhDiscordStates).where(eq(vhDiscordStates.state, state));
  },

  getAllBots: async () => {
    return drizzleDb.select().from(vhBots);
  },

  getBotsByOwner: async (ownerId) => {
    return drizzleDb.select().from(vhBots).where(eq(vhBots.ownerId, ownerId));
  },

  getSharedBots: async (userId) => {
    const memberships = await drizzleDb.select().from(vhBotMembers).where(eq(vhBotMembers.userId, userId));
    const result = [];
    for (const m of memberships) {
      const bots = await drizzleDb.select().from(vhBots).where(eq(vhBots.id, m.botId));
      if (bots[0]) result.push({ ...bots[0], memberPerms: JSON.parse(m.perms) });
    }
    return result;
  },

  getBotById: async (id) => {
    const rows = await drizzleDb.select().from(vhBots).where(eq(vhBots.id, id));
    return rows[0];
  },

  createBot: async (bot) => {
    await drizzleDb.insert(vhBots).values(bot);
  },

  deleteBot: async (id) => {
    await drizzleDb.delete(vhBots).where(eq(vhBots.id, id));
  },

  getRankPerms: async (roleId) => {
    const rows = await drizzleDb.select().from(vhRankPermissions).where(eq(vhRankPermissions.roleId, roleId));
    return rows[0] ? JSON.parse(rows[0].perms) : null;
  },

  getAllRankPerms: async () => {
    const rows = await drizzleDb.select().from(vhRankPermissions);
    return rows.map(r => ({ roleId: r.roleId, ...JSON.parse(r.perms) }));
  },

  setRankPerms: async (roleId, perms) => {
    const json = JSON.stringify(perms);
    await drizzleDb
      .insert(vhRankPermissions)
      .values({ roleId, perms: json })
      .onDuplicateKeyUpdate({ set: { perms: json } });
  },

  searchVerifiedUsers: async (query) => {
    const q = `%${query}%`;
    return drizzleDb
      .select()
      .from(vhUsers)
      .where(sql`email_verified = 1 AND (name LIKE ${q} OR email LIKE ${q})`)
      .limit(10);
  },

  getBotMembers: async (botId) => {
    const members = await drizzleDb.select().from(vhBotMembers).where(eq(vhBotMembers.botId, botId));
    const result = [];
    for (const m of members) {
      const users = await drizzleDb.select().from(vhUsers).where(eq(vhUsers.id, m.userId));
      const u = users[0];
      if (!u) continue;
      const avatar = u.discordId && u.discordAvatar
        ? `https://cdn.discordapp.com/avatars/${u.discordId}/${u.discordAvatar}.png?size=64`
        : null;
      result.push({ id: m.id, userId: m.userId, name: u.name, email: u.email, avatar, perms: JSON.parse(m.perms), createdAt: m.createdAt });
    }
    return result;
  },

  getBotMember: async (botId, userId) => {
    const rows = await drizzleDb.select().from(vhBotMembers)
      .where(and(eq(vhBotMembers.botId, botId), eq(vhBotMembers.userId, userId)));
    return rows[0] ?? null;
  },

  getBotMemberCount: async (botId) => {
    const rows = await drizzleDb.select().from(vhBotMembers).where(eq(vhBotMembers.botId, botId));
    return rows.length;
  },

  addBotMember: async (id, botId, userId) => {
    const defaultPerms = { canStart: false, canStop: false, canRestart: false, canDelete: false, canManageUsers: false, canClearLogs: false, canEditSettings: false, canEditCommands: false };
    await drizzleDb.insert(vhBotMembers).values({ id, botId, userId, perms: JSON.stringify(defaultPerms), createdAt: Date.now() });
  },

  updateBotMemberPerms: async (botId, userId, perms) => {
    await drizzleDb.update(vhBotMembers)
      .set({ perms: JSON.stringify(perms) })
      .where(and(eq(vhBotMembers.botId, botId), eq(vhBotMembers.userId, userId)));
  },

  removeBotMember: async (botId, userId) => {
    await drizzleDb.delete(vhBotMembers)
      .where(and(eq(vhBotMembers.botId, botId), eq(vhBotMembers.userId, userId)));
  },

  addLog: async ({ id, event, msg, userName = null, userId = null, src = 'panel' }) => {
    await drizzleDb.insert(vhLogs).values({ id, ts: Date.now(), event, msg, userName, userId, src });
  },

  createNotification: async ({ id, userId, type, title, body = '', link = null }) => {
    await pool.query(
      'INSERT INTO vh_notifications (id, user_id, type, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, userId, type, String(title).slice(0, 200), String(body).slice(0, 500), link, Date.now()]
    );
  },

  getNotifications: async (userId, limit = 40) => {
    const [rows] = await pool.query(
      'SELECT id, type, title, body, link, is_read, created_at FROM vh_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );
    return rows.map(r => ({
      id: r.id, type: r.type, title: r.title, body: r.body,
      link: r.link, is_read: !!r.is_read, created_at: r.created_at,
    }));
  },

  getUnreadNotifCount: async (userId) => {
    const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM vh_notifications WHERE user_id = ? AND is_read = 0', [userId]);
    return rows[0]?.cnt ?? 0;
  },

  markNotifRead: async (userId, id) => {
    await pool.query('UPDATE vh_notifications SET is_read = 1 WHERE user_id = ? AND id = ?', [userId, id]);
  },

  markAllNotifRead: async (userId) => {
    await pool.query('UPDATE vh_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId]);
  },

  deleteOldNotifications: async (maxAgeMs) => {
    await pool.query('DELETE FROM vh_notifications WHERE created_at < ?', [Date.now() - maxAgeMs]);
  },

  getPendingUsers: async () => {
    const [rows] = await pool.query(
      `SELECT id, email, name, discord_id, discord_username, discord_avatar, created_at
         FROM vh_users
        WHERE approved = 0 AND email_verified = 1 AND banned = 0
        ORDER BY created_at ASC`
    );
    return rows;
  },

  getPendingUserCount: async () => {
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM vh_users WHERE approved = 0 AND email_verified = 1 AND banned = 0'
    );
    return rows[0]?.cnt ?? 0;
  },

  approveUser: async (id) => {
    await pool.query('UPDATE vh_users SET approved = 1 WHERE id = ?', [id]);
  },

  deleteUser: async (id) => {
    await pool.query('DELETE FROM vh_users WHERE id = ?', [id]);
  },

  getWelcomeConfig: async (botId) => {
    const [rows] = await pool.query('SELECT config FROM vh_welcome_settings WHERE bot_id = ?', [botId]);
    if (!rows[0]) return null;
    try { return JSON.parse(rows[0].config); } catch { return null; }
  },

  setWelcomeConfig: async (botId, config) => {
    const json = JSON.stringify(config);
    await pool.query(
      'INSERT INTO vh_welcome_settings (bot_id, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config = ?',
      [botId, json, json]
    );
  },

  getBotModules: async (botId) => {
    const [rows] = await pool.query('SELECT config FROM vh_bot_modules WHERE bot_id = ?', [botId]);
    let cfg = null;
    if (rows[0]) { try { cfg = JSON.parse(rows[0].config); } catch { cfg = null; } }
    return { invite: true, commands: true, automod: true, modcommands: true, serverlog: true, tickets: true, ...(cfg ?? {}) };
  },

  setBotModules: async (botId, config) => {
    const json = JSON.stringify(config);
    await pool.query(
      'INSERT INTO vh_bot_modules (bot_id, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config = ?',
      [botId, json, json]
    );
  },

  getTicketConfig: async (botId) => {
    const [rows] = await pool.query('SELECT config FROM vh_ticket_config WHERE bot_id = ?', [botId]);
    if (!rows[0]) return null;
    try { return JSON.parse(rows[0].config); } catch { return null; }
  },

  setTicketConfig: async (botId, config) => {
    const json = JSON.stringify(config);
    await pool.query(
      'INSERT INTO vh_ticket_config (bot_id, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config = ?',
      [botId, json, json]
    );
  },

  nextTicketNumber: async (botId) => {
    await pool.query(
      'INSERT INTO vh_ticket_counter (bot_id, n) VALUES (?, 1) ON DUPLICATE KEY UPDATE n = n + 1',
      [botId]
    );
    const [rows] = await pool.query('SELECT n FROM vh_ticket_counter WHERE bot_id = ?', [botId]);
    return rows[0]?.n ?? 1;
  },

  createTicket: async (t) => {
    await pool.query(
      `INSERT INTO vh_tickets (id, bot_id, guild_id, channel_id, panel_id, category_id, number, opener_id, opener_tag, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
      [t.id, t.botId, t.guildId, t.channelId, t.panelId, t.categoryId, t.number, t.openerId, String(t.openerTag ?? '').slice(0, 100), Date.now()]
    );
  },

  getTicketByChannel: async (channelId) => {
    const [rows] = await pool.query('SELECT * FROM vh_tickets WHERE channel_id = ? LIMIT 1', [channelId]);
    return rows[0] ?? null;
  },

  getOpenTicketCount: async (botId, openerId, { panelId = null, categoryId = null } = {}) => {
    let sql = "SELECT COUNT(*) AS cnt FROM vh_tickets WHERE bot_id = ? AND opener_id = ? AND status = 'open'";
    const args = [botId, openerId];
    if (panelId)    { sql += ' AND panel_id = ?';    args.push(panelId); }
    if (categoryId) { sql += ' AND category_id = ?'; args.push(categoryId); }
    const [rows] = await pool.query(sql, args);
    return rows[0]?.cnt ?? 0;
  },

  getOpenTickets: async (botId) => {
    const [rows] = await pool.query(
      "SELECT * FROM vh_tickets WHERE bot_id = ? AND status = 'open' ORDER BY number DESC",
      [botId]
    );
    return rows;
  },

  setTicketClaim: async (id, claimedBy) => {
    await pool.query('UPDATE vh_tickets SET claimed_by = ? WHERE id = ?', [claimedBy, id]);
  },

  closeTicket: async (id, reason = null) => {
    await pool.query(
      "UPDATE vh_tickets SET status = 'closed', closed_at = ?, close_reason = ? WHERE id = ?",
      [Date.now(), reason ? String(reason).slice(0, 500) : null, id]
    );
  },

  getServerlogConfig: async (botId) => {
    const [rows] = await pool.query('SELECT config FROM vh_serverlog_settings WHERE bot_id = ?', [botId]);
    if (!rows[0]) return null;
    try { return JSON.parse(rows[0].config); } catch { return null; }
  },

  setServerlogConfig: async (botId, config) => {
    const json = JSON.stringify(config);
    await pool.query(
      'INSERT INTO vh_serverlog_settings (bot_id, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config = ?',
      [botId, json, json]
    );
  },

  getModerationConfig: async (botId) => {
    const [rows] = await pool.query('SELECT config FROM vh_moderation_settings WHERE bot_id = ?', [botId]);
    if (!rows[0]) return null;
    try { return JSON.parse(rows[0].config); } catch { return null; }
  },

  setModerationConfig: async (botId, config) => {
    const json = JSON.stringify(config);
    await pool.query(
      'INSERT INTO vh_moderation_settings (bot_id, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config = ?',
      [botId, json, json]
    );
  },

  addModLog: async (botId, { action, moderator = '', target = '', reason = null, detail = null }) => {
    await pool.query(
      'INSERT INTO vh_mod_logs (bot_id, ts, action, moderator, target, reason, detail) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [botId, Date.now(), action, moderator, target, reason, detail]
    );
  },

  getModLogs: async (botId, limit = 200) => {
    const [rows] = await pool.query(
      'SELECT ts, action, moderator, target, reason, detail FROM vh_mod_logs WHERE bot_id = ? ORDER BY ts DESC LIMIT ?',
      [botId, limit]
    );
    return rows;
  },

  addModAction: async ({ id, botId, guildId, userId, type, expiresAt, reason = null }) => {
    await pool.query(
      'INSERT INTO vh_mod_actions (id, bot_id, guild_id, user_id, type, expires_at, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, botId, guildId, userId, type, expiresAt, reason, Date.now()]
    );
  },

  getExpiredModActions: async (botId) => {
    const [rows] = await pool.query(
      'SELECT * FROM vh_mod_actions WHERE bot_id = ? AND expires_at <= ?',
      [botId, Date.now()]
    );
    return rows;
  },

  deleteModAction: async (id) => {
    await pool.query('DELETE FROM vh_mod_actions WHERE id = ?', [id]);
  },

  deleteModActionsForUser: async (botId, userId, type) => {
    await pool.query('DELETE FROM vh_mod_actions WHERE bot_id = ? AND user_id = ? AND type = ?', [botId, userId, type]);
  },

  getCommands: async (botId) => {
    const [rows] = await pool.query('SELECT * FROM vh_commands WHERE bot_id = ? ORDER BY created_at ASC', [botId]);
    return rows.map(r => ({
      id: r.id, botId: r.bot_id, name: r.name, type: r.type, description: r.description,
      response: r.response, responseType: r.response_type, embedColor: r.embed_color,
      embedTitle: r.embed_title, embedFooter: r.embed_footer, ephemeral: !!r.ephemeral,
      deleteTrigger: !!r.delete_trigger, requiredRoleId: r.required_role_id,
      requiredRoleName: r.required_role_name, createdBy: r.created_by, createdAt: r.created_at,
    }));
  },

  createCommand: async (cmd) => {
    await pool.query(
      `INSERT INTO vh_commands (id,bot_id,name,type,description,response,response_type,embed_color,embed_title,embed_footer,ephemeral,delete_trigger,required_role_id,required_role_name,created_by,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [cmd.id, cmd.botId, cmd.name, cmd.type, cmd.description, cmd.response, cmd.responseType,
       cmd.embedColor, cmd.embedTitle, cmd.embedFooter, cmd.ephemeral?1:0, cmd.deleteTrigger?1:0,
       cmd.requiredRoleId||null, cmd.requiredRoleName||null, cmd.createdBy, cmd.createdAt]
    );
  },

  updateCommand: async (id, botId, cmd) => {
    await pool.query(
      `UPDATE vh_commands SET name=?,type=?,description=?,response=?,response_type=?,embed_color=?,embed_title=?,embed_footer=?,ephemeral=?,delete_trigger=?,required_role_id=?,required_role_name=? WHERE id=? AND bot_id=?`,
      [cmd.name, cmd.type, cmd.description, cmd.response, cmd.responseType, cmd.embedColor,
       cmd.embedTitle, cmd.embedFooter, cmd.ephemeral?1:0, cmd.deleteTrigger?1:0,
       cmd.requiredRoleId||null, cmd.requiredRoleName||null, id, botId]
    );
  },

  deleteCommand: async (id, botId) => {
    await pool.query('DELETE FROM vh_commands WHERE id=? AND bot_id=?', [id, botId]);
  },

  getCommandCount: async (botId) => {
    const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM vh_commands WHERE bot_id=?', [botId]);
    return rows[0]?.cnt ?? 0;
  },

  getMaxCommands: async (botId) => {
    const [rows] = await pool.query('SELECT max_commands FROM vh_bot_settings WHERE bot_id=?', [botId]);
    return rows[0]?.max_commands ?? 25;
  },

  setMaxCommands: async (botId, max) => {
    await pool.query(
      'INSERT INTO vh_bot_settings (bot_id,max_commands) VALUES (?,?) ON DUPLICATE KEY UPDATE max_commands=?',
      [botId, max, max]
    );
  },

  getBotSettings: async (botId) => {
    const [rows] = await pool.query('SELECT * FROM vh_bot_settings WHERE bot_id=?', [botId]);
    const r = rows[0];
    return { maxCommands: r?.max_commands ?? 25, prefix: r?.prefix ?? '!', autoRestart: !!(r?.auto_restart ?? 1), region: r?.region ?? 'eu-bp-2', brandingDisabled: !!(r?.branding_disabled) };
  },

  setBotSettings: async (botId, { prefix, autoRestart, region, brandingDisabled }) => {
    await pool.query(
      'INSERT INTO vh_bot_settings (bot_id,prefix,auto_restart,region,branding_disabled) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE prefix=?,auto_restart=?,region=?,branding_disabled=?',
      [botId, prefix, autoRestart?1:0, region, brandingDisabled?1:0, prefix, autoRestart?1:0, region, brandingDisabled?1:0]
    );
  },

  addBotLog: async (botId, { ts, user, msg }) => {
    await pool.query(
      'INSERT INTO vh_bot_logs (bot_id, ts, user_name, msg, created_at) VALUES (?, ?, ?, ?, ?)',
      [botId, ts, user ?? null, msg, Date.now()]
    );
  },

  getBotLogs: async (botId, limit = 300) => {
    const [rows] = await pool.query(
      'SELECT ts, user_name AS user, msg FROM vh_bot_logs WHERE bot_id = ? ORDER BY created_at DESC LIMIT ?',
      [botId, limit]
    );
    return rows.reverse();
  },

  setAutostart: async (botId, enabled) => {
    if (enabled) {
      await pool.query('INSERT IGNORE INTO vh_bot_autostart (bot_id) VALUES (?)', [botId]);
    } else {
      await pool.query('DELETE FROM vh_bot_autostart WHERE bot_id = ?', [botId]);
    }
  },

  getAutostartBots: async () => {
    const [rows] = await pool.query(
      'SELECT b.id, b.bot_token_enc FROM vh_bots b INNER JOIN vh_bot_autostart a ON a.bot_id = b.id'
    );
    return rows;
  },

  getAllUsers: async () => {
    const [rows] = await pool.query(
      'SELECT id, email, name, discord_id, discord_username, discord_avatar, email_verified, created_at, locked_until, banned, ban_reason FROM vh_users ORDER BY created_at DESC'
    );
    return rows;
  },

  checkUserLockedUntil: async (id) => {
    const [rows] = await pool.query('SELECT locked_until FROM vh_users WHERE id = ?', [id]);
    return rows[0]?.locked_until ?? null;
  },

  lockUser: async (id, until) => {
    await pool.query('UPDATE vh_users SET locked_until = ? WHERE id = ?', [until, id]);
  },

  unlockUser: async (id) => {
    await pool.query('UPDATE vh_users SET locked_until = NULL WHERE id = ?', [id]);
  },

  banUser: async (id, reason = null) => {
    await pool.query('UPDATE vh_users SET banned = 1, ban_reason = ? WHERE id = ?', [reason, id]);
  },

  unbanUser: async (id) => {
    await pool.query('UPDATE vh_users SET banned = 0, ban_reason = NULL WHERE id = ?', [id]);
  },

  createSession: async (id, userId, ip, userAgent) => {
    const now = Date.now();
    await pool.query(
      'INSERT INTO vh_sessions (id, user_id, ip, user_agent, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userId, ip || null, (userAgent || '').slice(0, 500) || null, now, now]
    );
  },

  getUserSessions: async (userId) => {
    const [rows] = await pool.query(
      'SELECT id, ip, user_agent, created_at, last_seen_at FROM vh_sessions WHERE user_id = ? ORDER BY last_seen_at DESC',
      [userId]
    );
    return rows;
  },

  touchSession: async (id) => {
    await pool.query('UPDATE vh_sessions SET last_seen_at = ? WHERE id = ?', [Date.now(), id]);
  },

  deleteSession: async (id) => {
    await pool.query('DELETE FROM vh_sessions WHERE id = ?', [id]);
  },

  deleteUserSessions: async (userId) => {
    await pool.query('DELETE FROM vh_sessions WHERE user_id = ?', [userId]);
  },

  deleteExpiredSessions: async (maxAgeMs) => {
    const cutoff = Date.now() - maxAgeMs;
    await pool.query('DELETE FROM vh_sessions WHERE last_seen_at < ?', [cutoff]);
  },

  getSessionById: async (id) => {
    const [rows] = await pool.query('SELECT * FROM vh_sessions WHERE id = ?', [id]);
    return rows[0] ?? null;
  },

  setEmailChange: async (userId, newEmail, code, expiresAt) => {
    await pool.query(
      'INSERT INTO vh_email_change (user_id, new_email, code, expires_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE new_email = ?, code = ?, expires_at = ?',
      [userId, newEmail, code, expiresAt, newEmail, code, expiresAt]
    );
  },

  getEmailChange: async (userId) => {
    const [rows] = await pool.query('SELECT * FROM vh_email_change WHERE user_id = ?', [userId]);
    return rows[0] ?? null;
  },

  deleteEmailChange: async (userId) => {
    await pool.query('DELETE FROM vh_email_change WHERE user_id = ?', [userId]);
  },

  setTotpSecret: async (userId, secret) => {
    await pool.query('UPDATE vh_users SET totp_secret = ? WHERE id = ?', [secret, userId]);
  },

  enableTotp: async (userId) => {
    await pool.query('UPDATE vh_users SET totp_enabled = 1, totp_fail_count = 0 WHERE id = ?', [userId]);
  },

  disableTotp: async (userId) => {
    await pool.query('UPDATE vh_users SET totp_enabled = 0, totp_secret = NULL, totp_fail_count = 0 WHERE id = ?', [userId]);
  },

  incrementTotpFail: async (userId) => {
    await pool.query('UPDATE vh_users SET totp_fail_count = totp_fail_count + 1 WHERE id = ?', [userId]);
    const [rows] = await pool.query('SELECT totp_fail_count FROM vh_users WHERE id = ?', [userId]);
    return rows[0]?.totp_fail_count ?? 0;
  },

  resetTotpFail: async (userId) => {
    await pool.query('UPDATE vh_users SET totp_fail_count = 0 WHERE id = ?', [userId]);
  },

  setPasswordReset: async (id, code, expiresAt) => {
    await pool.query('UPDATE vh_users SET reset_code = ?, reset_expires = ? WHERE id = ?', [code, expiresAt, id]);
  },

  getPasswordResetForEmail: async (email) => {
    const [rows] = await pool.query(
      'SELECT id, name, reset_code, reset_expires FROM vh_users WHERE email = ?',
      [email]
    );
    return rows[0] ?? null;
  },

  clearPasswordReset: async (id) => {
    await pool.query('UPDATE vh_users SET reset_code = NULL, reset_expires = NULL WHERE id = ?', [id]);
  },

  updateUserName: async (id, name) => {
    await pool.query('UPDATE vh_users SET name = ? WHERE id = ?', [name, id]);
  },

  updateUserEmail: async (id, email) => {
    await pool.query('UPDATE vh_users SET email = ? WHERE id = ?', [email, id]);
  },

  updateUserPassword: async (id, hash) => {
    await pool.query('UPDATE vh_users SET password_hash = ? WHERE id = ?', [hash, id]);
  },

  getSharedBotCount: async (userId) => {
    const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM vh_bot_members WHERE user_id = ?', [userId]);
    return rows[0]?.cnt ?? 0;
  },

  incrementStat: async (key) => {
    await pool.query(
      'INSERT INTO vh_stats (`key`, value) VALUES (?, 1) ON DUPLICATE KEY UPDATE value = value + 1',
      [key]
    );
  },

  incrementStatBy: async (key, delta) => {
    if (delta <= 0) return;
    await pool.query(
      'INSERT INTO vh_stats (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = value + ?',
      [key, delta, delta]
    );
  },

  setStatIfLower: async (key, value) => {
    await pool.query(
      'INSERT INTO vh_stats (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = GREATEST(value, ?)',
      [key, value, value]
    );
  },

  getStatValue: async (key) => {
    const [rows] = await pool.query('SELECT value FROM vh_stats WHERE `key` = ?', [key]);
    return rows[0]?.value ?? 0;
  },

  getSystemFlag: async (key) => {
    const [rows] = await pool.query('SELECT value FROM vh_system WHERE `key` = ?', [key]);
    return rows[0]?.value ?? null;
  },

  setSystemFlag: async (key, value) => {
    await pool.query(
      'INSERT INTO vh_system (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
      [key, value, value]
    );
  },

  isMaintenance: async () => {
    const now = Date.now();
    if (now - maintenanceCache.at < MAINTENANCE_TTL) return maintenanceCache.value;
    let value = false;
    try {
      const [rows] = await pool.query("SELECT value FROM vh_system WHERE `key` = 'maintenance'");
      value = rows[0]?.value === '1';
    } catch {  }
    maintenanceCache = { value, at: now };
    return value;
  },

  setMaintenance: async (on) => {
    const value = on ? '1' : '0';
    await pool.query(
      "INSERT INTO vh_system (`key`, value) VALUES ('maintenance', ?) ON DUPLICATE KEY UPDATE value = ?",
      [value, value]
    );
    maintenanceCache = { value: !!on, at: Date.now() };
  },

  getMaintenanceAllowlist: async () => {
    const now = Date.now();
    if (now - allowlistCache.at < MAINTENANCE_TTL) return allowlistCache.value;
    let value = [];
    try {
      const [rows] = await pool.query("SELECT value FROM vh_system WHERE `key` = 'maintenance_allowlist'");
      if (rows[0]?.value) { const p = JSON.parse(rows[0].value); if (Array.isArray(p)) value = p; }
    } catch {  }
    allowlistCache = { value, at: now };
    return value;
  },

  setMaintenanceAllowlist: async (list) => {
    const arr = Array.isArray(list) ? list : [];
    const json = JSON.stringify(arr);
    await pool.query(
      "INSERT INTO vh_system (`key`, value) VALUES ('maintenance_allowlist', ?) ON DUPLICATE KEY UPDATE value = ?",
      [json, json]
    );
    allowlistCache = { value: arr, at: Date.now() };
  },

  getHomeEvents: async (limit = 15) => {
    const [rows] = await pool.query(
      "SELECT event, ts FROM vh_logs WHERE event IN ('register', 'user_ban') ORDER BY ts DESC LIMIT ?",
      [limit]
    );
    return rows;
  },

  getLogs: async ({ search = '', limit = 500 } = {}) => {
    if (search) {
      const q = `%${search}%`;
      return drizzleDb.select().from(vhLogs)
        .where(or(like(vhLogs.msg, q), like(vhLogs.userName, q), like(vhLogs.event, q), like(vhLogs.src, q)))
        .orderBy(desc(vhLogs.ts))
        .limit(limit);
    }
    return drizzleDb.select().from(vhLogs).orderBy(desc(vhLogs.ts)).limit(limit);
  },
};
