import { Events, PermissionFlagsBits } from 'discord.js';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { MOD_DEFAULT, MOD_RULE_KEYS, findModCommand, parseDuration, fmtDuration, resolveCmdPerm } from '../moderation-defs.js';

const MUTE_ROLE_NAME = 'Mute';
const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

let cfgCache = { at: 0, cfg: null, mods: null };

async function getConfig(botDbId) {
  if (Date.now() - cfgCache.at < 10000 && cfgCache.cfg) return cfgCache;
  const [raw, mods] = await Promise.all([
    db.getModerationConfig(botDbId).catch(() => null),
    db.getBotModules(botDbId).catch(() => ({})),
  ]);
  const cfg = { ...MOD_DEFAULT, ...(raw ?? {}) };
  cfg.global = { ...MOD_DEFAULT.global, ...(raw?.global ?? {}) };
  for (const k of MOD_RULE_KEYS) cfg[k] = { ...MOD_DEFAULT[k], ...(raw?.[k] ?? {}) };
  cfgCache = { at: Date.now(), cfg, mods };
  return cfgCache;
}

function isBypassed(member, rule, globalCfg) {
  if (!member) return false;
  const uid = member.id;
  if (globalCfg.bypassUserIds.includes(uid) || rule.bypassUserIds.includes(uid)) return true;
  const roles = member.roles?.cache;
  if (!roles) return false;
  for (const rid of globalCfg.bypassRoleIds) if (roles.has(rid)) return true;
  for (const rid of rule.bypassRoleIds)      if (roles.has(rid)) return true;
  if (globalCfg.appliedRoleIds.length && !globalCfg.appliedRoleIds.some(rid => roles.has(rid))) return true;
  return false;
}

async function punish(botDbId, message, rule, ruleName, ruleLabel) {
  if (rule.deleteMessage) await message.delete().catch(() => {});
  if (rule.replyMessage) {
    const warn = await message.channel.send({
      content: `<@${message.author.id}> ${rule.replyMessage}`,
      allowedMentions: { parse: [], users: [message.author.id] },
    }).catch(() => null);
    if (warn) setTimeout(() => warn.delete().catch(() => {}), 6000);
  }
  let timeoutInfo = null;
  if (rule.timeoutEnabled && message.member?.moderatable) {
    const ms = Math.min(rule.timeoutMinutes * 60000, MAX_TIMEOUT_MS);
    await message.member.timeout(ms, `AutoMod: ${ruleLabel}`).catch(() => {});
    timeoutInfo = `felfüggesztve ${fmtDuration(ms)} időre`;
  }
  const name = message.author?.username ?? 'Ismeretlen';
  db.addModLog(botDbId, {
    action: `automod:${ruleName}`,
    moderator: 'AutoMod',
    target: name,
    reason: timeoutInfo,
    detail: (message.content || '').slice(0, 200),
  }).catch(() => {});
  process.send?.({ type: 'log', msg: `[automod] ${ruleLabel}: ${name}${timeoutInfo ? ` (${timeoutInfo})` : ''}` });
}

function hasGif(message) {
  for (const a of message.attachments.values()) {
    if ((a.name ?? '').toLowerCase().endsWith('.gif') || (a.contentType ?? '').includes('gif')) return true;
  }
  const c = (message.content || '').toLowerCase();
  if (/tenor\.com|giphy\.com|\.gif(\?|\s|$)/.test(c)) return true;
  for (const e of message.embeds) {
    if (e.data?.type === 'gifv') return true;
  }
  return false;
}

function hasMedia(message) {
  for (const a of message.attachments.values()) {
    const ct = (a.contentType ?? '').toLowerCase();
    if (ct.startsWith('image/') && !ct.includes('gif')) return true;
    if (ct.startsWith('video/')) return true;
  }
  for (const e of message.embeds) {
    if (e.data?.type === 'image' || e.data?.type === 'video') return true;
  }
  return false;
}

function countEmojis(text) {
  if (!text) return 0;
  const custom  = (text.match(/<a?:\w+:\d+>/g) ?? []).length;
  const unicode = (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  return custom + unicode;
}

const repeatMap = new Map();

async function ensureMuteRole(guild) {
  let role = guild.roles.cache.find(r => r.name === MUTE_ROLE_NAME);
  if (!role) {
    role = await guild.roles.create({ name: MUTE_ROLE_NAME, permissions: [], reason: 'VoidHost moderáció: némítás rang' });
  }
  for (const channel of guild.channels.cache.values()) {
    if (!channel.permissionOverwrites?.edit) continue;
    const existing = channel.permissionOverwrites.cache.get(role.id);
    if (existing?.deny.has(PermissionFlagsBits.SendMessages)) continue;
    await channel.permissionOverwrites.edit(role, {
      SendMessages: false,
      SendMessagesInThreads: false,
      AddReactions: false,
      Speak: false,
      CreatePublicThreads: false,
      CreatePrivateThreads: false,
    }, { reason: 'VoidHost moderáció: Mute rang' }).catch(() => {});
  }
  return role;
}

const CMD_DISCORD_PERM = {
  ban: PermissionFlagsBits.BanMembers, unban: PermissionFlagsBits.BanMembers, unbanall: PermissionFlagsBits.BanMembers,
  kick: PermissionFlagsBits.KickMembers,
  timeout: PermissionFlagsBits.ModerateMembers, untimeout: PermissionFlagsBits.ModerateMembers,
  mute: PermissionFlagsBits.ModerateMembers, unmute: PermissionFlagsBits.ModerateMembers,
};

function canUseModCommand(interaction, def, cfg) {
  const p = resolveCmdPerm(cfg, def.action);
  const hasDiscord = () => !!interaction.memberPermissions?.has(CMD_DISCORD_PERM[def.action]);

  if (!p.useDiscord && !p.roleIds.length && !p.userIds.length) return hasDiscord();

  if (p.useDiscord && hasDiscord()) return true;
  const roles = interaction.member?.roles?.cache;
  if (p.roleIds.length && roles && p.roleIds.some(rid => roles.has(rid))) return true;
  if (p.userIds.length && p.userIds.includes(interaction.user.id)) return true;
  return false;
}

const optUser = (i) => i.options.getUser('felhasznalo') ?? i.options.getUser('user');
const optStr  = (i, hu, en) => i.options.getString(hu) ?? i.options.getString(en);

export function setup(client) {
  const botDbId = process.env.BOT_DB_ID;
  if (!botDbId) return;

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    const { cfg, mods } = await getConfig(botDbId).catch(() => ({ cfg: null }));
    if (!cfg || (mods && mods.automod === false)) return;

    const member = message.member;

    if (cfg.profanity.enabled && cfg.profanity.words.length && !isBypassed(member, cfg.profanity, cfg.global)) {
      const lower = (message.content || '').toLowerCase();
      if (lower && cfg.profanity.words.some(w => w && lower.includes(w))) {
        await punish(botDbId, message, cfg.profanity, 'profanity', 'káromkodás');
        return;
      }
    }

    if (cfg.gif.enabled && !isBypassed(member, cfg.gif, cfg.global)) {
      if (hasGif(message) && !cfg.gif.allowedChannelIds.includes(message.channel.id)) {
        await punish(botDbId, message, cfg.gif, 'gif', 'GIF');
        return;
      }
    }

    if (cfg.content.enabled && !isBypassed(member, cfg.content, cfg.global)) {
      if (hasMedia(message) && !cfg.content.allowedChannelIds.includes(message.channel.id)) {
        await punish(botDbId, message, cfg.content, 'content', 'kép/videó');
        return;
      }
    }

    if (cfg.mentions.enabled && !isBypassed(member, cfg.mentions, cfg.global)) {
      const count = message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? cfg.mentions.maxMentions : 0);
      if (count >= cfg.mentions.maxMentions) {
        await punish(botDbId, message, cfg.mentions, 'mentions', 'tömeges megemlítés');
        return;
      }
    }

    if (cfg.emoji.enabled && !isBypassed(member, cfg.emoji, cfg.global)) {
      if (countEmojis(message.content) >= cfg.emoji.maxEmojis) {
        await punish(botDbId, message, cfg.emoji, 'emoji', 'emoji spam');
        return;
      }
    }

    if (cfg.repeated.enabled && !isBypassed(member, cfg.repeated, cfg.global)) {
      const key = message.author.id;
      const now = Date.now();
      const norm = (message.content || '').trim().toLowerCase();
      if (norm) {
        const prev = repeatMap.get(key);
        if (prev && prev.content === norm && now - prev.last <= cfg.repeated.intervalSec * 1000) {
          prev.count++; prev.last = now;
          if (prev.count >= cfg.repeated.maxRepeats) {
            repeatMap.delete(key);
            await punish(botDbId, message, cfg.repeated, 'repeated', 'ismételt üzenet');
            return;
          }
        } else {
          repeatMap.set(key, { content: norm, count: 1, last: now });
        }
        if (repeatMap.size > 5000) repeatMap.clear();
      }
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    const def = findModCommand(interaction.commandName);
    if (!def) return;

    const { cfg, mods } = await getConfig(botDbId).catch(() => ({ cfg: null, mods: null }));
    if (mods && mods.modcommands === false) return;
    if (cfg?.disabledCommands?.includes(def.action)) return;

    if (!canUseModCommand(interaction, def, cfg)) {
      await interaction.reply({ content: 'Nincs jogosultságod ehhez a parancshoz.', ephemeral: true }).catch(() => {});
      return;
    }

    const guild = interaction.guild;
    const modName = interaction.user.username;
    const reply = (content) => interaction.editReply({ content }).catch(() => {});
    const modLog = (action, target, reason, detail) =>
      db.addModLog(botDbId, { action, moderator: modName, target, reason, detail }).catch(() => {});

    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    try {
      switch (def.action) {

        case 'ban': {
          const user = optUser(interaction);
          if (!user) { await reply('Nem található a felhasználó.'); return; }
          const reason = optStr(interaction, 'indok', 'reason') ?? null;
          const durMs  = parseDuration(optStr(interaction, 'idotartam', 'duration'));
          await user.send(`Ki lettél tiltva a(z) **${guild.name}** szerverről.${reason ? `\nIndok: ${reason}` : ''}${durMs ? `\nIdőtartam: ${fmtDuration(durMs)}` : ''}`).catch(() => {});
          await guild.members.ban(user.id, { reason: reason ?? undefined });
          if (durMs) {
            await db.addModAction({ id: randomUUID(), botId: botDbId, guildId: guild.id, userId: user.id, type: 'ban', expiresAt: Date.now() + durMs, reason }).catch(() => {});
          }
          modLog('ban', user.username, reason, durMs ? `időtartam: ${fmtDuration(durMs)}` : 'végleges');
          process.send?.({ type: 'log', msg: `[moderáció] ${modName} kitiltotta: ${user.username}` });
          await reply(`🔨 **${user.username}** kitiltva${durMs ? ` (${fmtDuration(durMs)} időre)` : ' véglegesen'}.${reason ? ` Indok: ${reason}` : ''}`);
          break;
        }

        case 'unban': {
          const rawId = (optStr(interaction, 'felhasznalo_id', 'user_id') ?? '').replace(/\D/g, '');
          if (!rawId) { await reply('Érvénytelen felhasználó ID.'); return; }
          await guild.bans.remove(rawId, `Feloldotta: ${modName}`);
          await db.deleteModActionsForUser(botDbId, rawId, 'ban').catch(() => {});
          modLog('unban', rawId, null, null);
          await reply(`✅ A(z) \`${rawId}\` felhasználó kitiltása feloldva.`);
          break;
        }

        case 'unbanall': {
          const bans = await guild.bans.fetch();
          let done = 0;
          for (const ban of bans.values()) {
            await guild.bans.remove(ban.user.id, `Összes kitiltás feloldása: ${modName}`).then(() => done++).catch(() => {});
          }
          modLog('unbanall', `${done} felhasználó`, null, null);
          await reply(`✅ ${done} kitiltott felhasználó lett feloldva.`);
          break;
        }

        case 'kick': {
          const user = optUser(interaction);
          if (!user) { await reply('Nem található a felhasználó.'); return; }
          const reason = optStr(interaction, 'indok', 'reason') ?? null;
          const member = await guild.members.fetch(user.id).catch(() => null);
          if (!member) { await reply('Ez a felhasználó nincs a szerveren.'); return; }
          await user.send(`Ki lettél rúgva a(z) **${guild.name}** szerverről.${reason ? `\nIndok: ${reason}` : ''}`).catch(() => {});
          await member.kick(reason ?? undefined);
          modLog('kick', user.username, reason, null);
          process.send?.({ type: 'log', msg: `[moderáció] ${modName} kirúgta: ${user.username}` });
          await reply(`👢 **${user.username}** kirúgva.${reason ? ` Indok: ${reason}` : ''}`);
          break;
        }

        case 'timeout': {
          const user = optUser(interaction);
          if (!user) { await reply('Nem található a felhasználó.'); return; }
          const durMs = parseDuration(optStr(interaction, 'idotartam', 'duration'));
          if (!durMs) { await reply('Érvénytelen időtartam. Példa: `10m`, `1h`, `1d`.'); return; }
          const reason = optStr(interaction, 'indok', 'reason') ?? null;
          const member = await guild.members.fetch(user.id).catch(() => null);
          if (!member) { await reply('Ez a felhasználó nincs a szerveren.'); return; }
          const ms = Math.min(durMs, MAX_TIMEOUT_MS);
          await member.timeout(ms, reason ?? undefined);
          modLog('timeout', user.username, reason, `időtartam: ${fmtDuration(ms)}`);
          await reply(`⏳ **${user.username}** felfüggesztve ${fmtDuration(ms)} időre.${reason ? ` Indok: ${reason}` : ''}`);
          break;
        }

        case 'untimeout': {
          const user = optUser(interaction);
          if (!user) { await reply('Nem található a felhasználó.'); return; }
          const member = await guild.members.fetch(user.id).catch(() => null);
          if (!member) { await reply('Ez a felhasználó nincs a szerveren.'); return; }
          await member.timeout(null);
          modLog('untimeout', user.username, null, null);
          await reply(`✅ **${user.username}** felfüggesztése feloldva.`);
          break;
        }

        case 'mute': {
          const user = optUser(interaction);
          if (!user) { await reply('Nem található a felhasználó.'); return; }
          const reason = optStr(interaction, 'indok', 'reason') ?? null;
          const durMs  = parseDuration(optStr(interaction, 'idotartam', 'duration'));
          const member = await guild.members.fetch(user.id).catch(() => null);
          if (!member) { await reply('Ez a felhasználó nincs a szerveren.'); return; }
          const role = await ensureMuteRole(guild);
          await member.roles.add(role, reason ?? `Némította: ${modName}`);
          if (durMs) {
            await db.addModAction({ id: randomUUID(), botId: botDbId, guildId: guild.id, userId: user.id, type: 'mute', expiresAt: Date.now() + durMs, reason }).catch(() => {});
          }
          modLog('mute', user.username, reason, durMs ? `időtartam: ${fmtDuration(durMs)}` : 'végleges');
          await reply(`🔇 **${user.username}** némítva${durMs ? ` ${fmtDuration(durMs)} időre` : ''}.${reason ? ` Indok: ${reason}` : ''}`);
          break;
        }

        case 'unmute': {
          const user = optUser(interaction);
          if (!user) { await reply('Nem található a felhasználó.'); return; }
          const member = await guild.members.fetch(user.id).catch(() => null);
          if (!member) { await reply('Ez a felhasználó nincs a szerveren.'); return; }
          const role = guild.roles.cache.find(r => r.name === MUTE_ROLE_NAME);
          if (role) await member.roles.remove(role, `Feloldotta: ${modName}`);
          await db.deleteModActionsForUser(botDbId, user.id, 'mute').catch(() => {});
          modLog('unmute', user.username, null, null);
          await reply(`🔊 **${user.username}** némítása feloldva.`);
          break;
        }
      }
    } catch (e) {
      await reply(`Hiba történt: ${e.message ?? 'ismeretlen hiba'}. Ellenőrizd, hogy a botnak megvan-e a szükséges jogosultsága és a rangja magasabb-e a célszemélyénél.`);
    }
  });

  setInterval(async () => {
    const rows = await db.getExpiredModActions(botDbId).catch(() => []);
    for (const row of rows) {
      const guild = client.guilds.cache.get(row.guild_id);
      if (guild) {
        try {
          if (row.type === 'ban') {
            await guild.bans.remove(row.user_id, 'Ideiglenes kitiltás lejárt').catch(() => {});
            db.addModLog(botDbId, { action: 'unban', moderator: 'Automatikus', target: row.user_id, reason: 'ideiglenes kitiltás lejárt' }).catch(() => {});
          } else if (row.type === 'mute') {
            const member = await guild.members.fetch(row.user_id).catch(() => null);
            const role = guild.roles.cache.find(r => r.name === MUTE_ROLE_NAME);
            if (member && role) await member.roles.remove(role, 'Ideiglenes némítás lejárt').catch(() => {});
            db.addModLog(botDbId, { action: 'unmute', moderator: 'Automatikus', target: member?.user?.username ?? row.user_id, reason: 'ideiglenes némítás lejárt' }).catch(() => {});
          }
        } catch {  }
      }
      await db.deleteModAction(row.id).catch(() => {});
    }
  }, 60000);
}
