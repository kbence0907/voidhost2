import { Events, EmbedBuilder } from 'discord.js';
import { db } from '../db.js';

function fmtTime() {
  return new Date().toLocaleString('hu-HU', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

function sanitizeMentions(s) {
  return String(s ?? '').replace(/@(everyone|here)/g, '@​$1');
}

function fill(text, member, plainTime = false) {
  const username = sanitizeMentions(member.user?.username || member.user?.tag || 'Ismeretlen');
  const serverNm = sanitizeMentions(member.guild?.name ?? '');
  const mention  = `<@${member.id}>`;
  const time     = plainTime ? fmtTime() : `<t:${Math.floor(Date.now() / 1000)}:F>`;
  return sanitizeMentions(text || '')
    .replace(/{user}/g,   mention)
    .replace(/{nuser}/g,  username)
    .replace(/{server}/g, serverNm)
    .replace(/{all}/g,    String(member.guild?.memberCount ?? 0))
    .replace(/{time}/g,   time);
}

async function sendSection(channel, member, sec, isLeave = false) {
  if (!channel?.isTextBased()) return;

  const text    = fill(sec.message, member);
  const mention = `<@${member.id}>`;
  const ping    = !isLeave && sec.pingBefore;

  if (sec.type === 'embed') {
    const hex = parseInt((sec.embedColor ?? '#5865f2').replace('#', ''), 16);
    const embed = new EmbedBuilder()
      .setDescription(text || '​')
      .setColor(isNaN(hex) ? 0x5865f2 : hex);

    if (sec.embedTitle)  embed.setTitle(fill(String(sec.embedTitle), member, true));
    if (sec.embedFooter) embed.setFooter({ text: fill(String(sec.embedFooter), member, true) });

    if (sec.showAvatar) {
      const avatarUrl = member.user?.displayAvatarURL?.({ size: 128 });
      if (avatarUrl) embed.setThumbnail(avatarUrl);
    }

    await channel.send({
      content: ping ? mention : undefined,
      embeds: [embed],
      allowedMentions: { parse: [], users: [member.id] },
    }).catch(console.error);
  } else {
    const out = ping ? `${mention}\n${text}` : text;
    await channel.send({
      content: out || '​',
      allowedMentions: { parse: [], users: [member.id] },
    }).catch(console.error);
  }
}

export function setup(client) {
  const botDbId = process.env.BOT_DB_ID;
  if (!botDbId) return;

  client.on(Events.GuildMemberAdd, async (member) => {
    const mods = await db.getBotModules(botDbId).catch(() => null);
    if (mods && mods.invite === false) return;
    const cfg = await db.getWelcomeConfig(botDbId).catch(() => null);
    if (!cfg) return;

    if (cfg.welcome?.enabled && cfg.welcome.channelId) {
      const channel = member.guild.channels.cache.get(cfg.welcome.channelId);
      await sendSection(channel, member, cfg.welcome, false);
      const name = member.user?.username || member.user?.tag || 'Ismeretlen';
      process.send?.({ type: 'log', msg: `[meghívók] ${name} csatlakozott` });
    }

    if (cfg.dm?.enabled && cfg.dm.message) {
      await member.send({
        content: fill(cfg.dm.message, member),
        allowedMentions: { parse: [] },
      }).catch(() => {});
    }
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    const mods = await db.getBotModules(botDbId).catch(() => null);
    if (mods && mods.invite === false) return;
    const cfg = await db.getWelcomeConfig(botDbId).catch(() => null);
    if (!cfg?.leave?.enabled || !cfg.leave.channelId) return;
    const channel = member.guild.channels.cache.get(cfg.leave.channelId);
    await sendSection(channel, member, cfg.leave, true);
    const name = member.user?.username || member.user?.tag || 'Ismeretlen';
    process.send?.({ type: 'log', msg: `[meghívók] ${name} elhagyta a szervert` });
  });
}
