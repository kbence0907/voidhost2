import { Events, EmbedBuilder, ChannelType } from 'discord.js';
import { db } from '../db.js';
import { mergeServerlogConfig } from '../serverlog-defs.js';

let cache = { at: 0, cfg: null, mods: null };

async function getConfig(botDbId) {
  if (Date.now() - cache.at < 10000 && cache.cfg) return cache;
  const [raw, mods] = await Promise.all([
    db.getServerlogConfig(botDbId).catch(() => null),
    db.getBotModules(botDbId).catch(() => ({})),
  ]);
  cache = { at: Date.now(), cfg: mergeServerlogConfig(raw), mods };
  return cache;
}

function embedColor(cfg) {
  const hex = parseInt((cfg.embedColor ?? '#5865f2').replace('#', ''), 16);
  return isNaN(hex) ? 0x5865f2 : hex;
}

function cut(s, n = 1024) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function logChannelIds(cfg) {
  const ids = new Set();
  if (cfg.channelId) ids.add(cfg.channelId);
  for (const ev of Object.values(cfg.events)) if (ev.channelId) ids.add(ev.channelId);
  return ids;
}

export function setup(client) {
  const botDbId = process.env.BOT_DB_ID;
  if (!botDbId) return;

  async function log(guild, eventKey, build) {
    if (!guild) return;
    const { cfg, mods } = await getConfig(botDbId).catch(() => ({ cfg: null }));
    if (!cfg || (mods && mods.serverlog === false)) return null;
    const ev = cfg.events[eventKey];
    if (!ev?.enabled) return null;
    const channelId = ev.channelId || cfg.channelId;
    if (!channelId) return null;
    const channel = guild.channels.cache.get(channelId);
    if (!channel?.isTextBased()) return null;

    const embed = new EmbedBuilder().setColor(embedColor(cfg)).setTimestamp();
    build(embed, cfg);
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
    return cfg;
  }

  const userLine = (user) => user ? `<@${user.id}> (${user.username ?? user.tag ?? user.id})` : 'Ismeretlen';
  const setAuthor = (embed, user) => {
    if (!user) return;
    embed.setAuthor({ name: user.username ?? user.tag ?? 'Ismeretlen', iconURL: user.displayAvatarURL?.({ size: 64 }) ?? undefined });
  };

  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author?.bot) return;
    const { cfg } = await getConfig(botDbId).catch(() => ({ cfg: null }));
    if (cfg && logChannelIds(cfg).has(message.channel.id)) return;
    await log(message.guild, 'messageSend', (e) => {
      setAuthor(e, message.author);
      e.setTitle('Üzenet küldve')
       .setDescription(`${userLine(message.author)} üzenetet küldött itt: <#${message.channel.id}>`);
      if (message.content) e.addFields({ name: 'Üzenet', value: cut(message.content) });
      if (message.attachments.size) e.addFields({ name: 'Csatolmányok', value: String(message.attachments.size) });
    });
  });

  client.on(Events.MessageDelete, async (message) => {
    if (!message.guild || message.author?.bot) return;
    const { cfg } = await getConfig(botDbId).catch(() => ({ cfg: null }));
    if (cfg && logChannelIds(cfg).has(message.channel?.id)) return;
    await log(message.guild, 'messageDelete', (e) => {
      setAuthor(e, message.author);
      e.setTitle('Üzenet törölve')
       .setDescription(`${message.author ? userLine(message.author) : 'Ismeretlen felhasználó'} üzenete törölve lett itt: <#${message.channel.id}>`);
      if (message.content) e.addFields({ name: 'Üzenet', value: cut(message.content) });
      if (message.attachments?.size) e.addFields({ name: 'Csatolmányok', value: String(message.attachments.size) });
    });
  });

  client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
    if (!newMsg.guild || newMsg.author?.bot) return;
    if ((oldMsg.content ?? '') === (newMsg.content ?? '')) return;
    const { cfg } = await getConfig(botDbId).catch(() => ({ cfg: null }));
    if (cfg && logChannelIds(cfg).has(newMsg.channel.id)) return;
    await log(newMsg.guild, 'messageEdit', (e) => {
      setAuthor(e, newMsg.author);
      e.setTitle('Üzenet szerkesztve')
       .setDescription(`${userLine(newMsg.author)} szerkesztett egy üzenetet itt: <#${newMsg.channel.id}> — [ugrás](${newMsg.url})`)
       .addFields(
         { name: 'Előtte', value: cut(oldMsg.content || '*ismeretlen (nem volt gyorsítótárban)*') },
         { name: 'Utána',  value: cut(newMsg.content || '*üres*') },
       );
    });
  });

  client.on(Events.VoiceStateUpdate, async (oldS, newS) => {
    const guild = newS.guild ?? oldS.guild;
    const member = newS.member ?? oldS.member;
    if (!guild || !member || member.user?.bot) return;

    if (oldS.channelId !== newS.channelId) {
      await log(guild, 'voice', (e) => {
        setAuthor(e, member.user);
        if (!oldS.channelId) {
          e.setTitle('Belépett a hangcsatornába')
           .setDescription(`${userLine(member.user)} belépett ide: <#${newS.channelId}>`);
        } else if (!newS.channelId) {
          e.setTitle('Kilépett a hangcsatornából')
           .setDescription(`${userLine(member.user)} kilépett innen: <#${oldS.channelId}>`);
        } else {
          e.setTitle('Hangcsatornát váltott')
           .setDescription(`${userLine(member.user)} átment: <#${oldS.channelId}> → <#${newS.channelId}>`);
        }
      });
    }

    const changes = [];
    if (oldS.selfMute   !== newS.selfMute)   changes.push(newS.selfMute   ? 'lenémította magát 🔇' : 'feloldotta a saját némítását 🔊');
    if (oldS.selfDeaf   !== newS.selfDeaf)   changes.push(newS.selfDeaf   ? 'lesüketítette magát 🔕' : 'feloldotta a saját süketítését 🔔');
    if (oldS.serverMute !== newS.serverMute) changes.push(newS.serverMute ? 'le lett némítva (szerver) 🔇' : 'a szerver oldali némítása feloldva 🔊');
    if (oldS.serverDeaf !== newS.serverDeaf) changes.push(newS.serverDeaf ? 'le lett süketítve (szerver) 🔕' : 'a szerver oldali süketítése feloldva 🔔');
    if (changes.length) {
      await log(guild, 'voiceMute', (e) => {
        setAuthor(e, member.user);
        const ch = newS.channelId ?? oldS.channelId;
        e.setTitle('Némítás / süketítés')
         .setDescription(`${userLine(member.user)} ${changes.join(', ')}${ch ? ` — <#${ch}>` : ''}`);
      });
    }
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    await log(member.guild, 'member', (e) => {
      setAuthor(e, member.user);
      e.setTitle('Tag csatlakozott')
       .setDescription(`${userLine(member.user)} csatlakozott a szerverhez.`)
       .addFields({ name: 'Taglétszám', value: String(member.guild.memberCount ?? '?') });
    });
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    await log(member.guild, 'member', (e) => {
      setAuthor(e, member.user);
      e.setTitle('Tag távozott')
       .setDescription(`${userLine(member.user)} elhagyta a szervert.`)
       .addFields({ name: 'Taglétszám', value: String(member.guild.memberCount ?? '?') });
    });
  });

  client.on(Events.GuildBanAdd, async (ban) => {
    await log(ban.guild, 'member', (e) => {
      setAuthor(e, ban.user);
      e.setTitle('Tag kitiltva')
       .setDescription(`${userLine(ban.user)} ki lett tiltva a szerverről.${ban.reason ? `\nIndok: ${cut(ban.reason, 400)}` : ''}`);
    });
  });

  client.on(Events.GuildBanRemove, async (ban) => {
    await log(ban.guild, 'member', (e) => {
      setAuthor(e, ban.user);
      e.setTitle('Kitiltás feloldva')
       .setDescription(`${userLine(ban.user)} kitiltása fel lett oldva.`);
    });
  });

  client.on(Events.GuildMemberUpdate, async (oldM, newM) => {
    if (oldM.nickname !== newM.nickname) {
      await log(newM.guild, 'member', (e) => {
        setAuthor(e, newM.user);
        e.setTitle('Becenév változás')
         .setDescription(`${userLine(newM.user)} beceneve megváltozott.`)
         .addFields(
           { name: 'Előtte', value: cut(oldM.nickname || '*nincs*', 100), inline: true },
           { name: 'Utána',  value: cut(newM.nickname || '*nincs*', 100), inline: true },
         );
      });
    }

    const added   = newM.roles.cache.filter(r => !oldM.roles.cache.has(r.id));
    const removed = oldM.roles.cache.filter(r => !newM.roles.cache.has(r.id));
    if (added.size || removed.size) {
      await log(newM.guild, 'memberRoles', (e) => {
        setAuthor(e, newM.user);
        e.setTitle('Tag rangjai változtak')
         .setDescription(`${userLine(newM.user)} rangjai módosultak.`);
        if (added.size)   e.addFields({ name: 'Kapott rang',  value: cut(added.map(r => `<@&${r.id}>`).join(' ')) });
        if (removed.size) e.addFields({ name: 'Elvett rang', value: cut(removed.map(r => `<@&${r.id}>`).join(' ')) });
      });
    }
  });

  client.on(Events.GuildRoleCreate, async (role) => {
    await log(role.guild, 'roles', (e) => {
      e.setTitle('Rang létrehozva')
       .setDescription(`Új rang: <@&${role.id}> (\`${role.name}\`)`);
    });
  });

  client.on(Events.GuildRoleDelete, async (role) => {
    await log(role.guild, 'roles', (e) => {
      e.setTitle('Rang törölve')
       .setDescription(`Törölt rang: \`${role.name}\``);
    });
  });

  client.on(Events.GuildRoleUpdate, async (oldR, newR) => {
    const fields = [];
    if (oldR.name !== newR.name) {
      fields.push({ name: 'Név', value: `\`${cut(oldR.name, 100)}\` → \`${cut(newR.name, 100)}\`` });
    }
    if (oldR.hexColor !== newR.hexColor) {
      fields.push({ name: 'Szín', value: `${oldR.hexColor} → ${newR.hexColor}` });
    }
    if (!oldR.permissions.equals(newR.permissions)) {
      const before = oldR.permissions.toArray();
      const after  = newR.permissions.toArray();
      const granted = after.filter(p => !before.includes(p));
      const revoked = before.filter(p => !after.includes(p));
      if (granted.length) fields.push({ name: 'Új jogosultságok',    value: cut(granted.map(p => `\`${p}\``).join(', ')) });
      if (revoked.length) fields.push({ name: 'Elvett jogosultságok', value: cut(revoked.map(p => `\`${p}\``).join(', ')) });
    }
    if (!fields.length) return;
    await log(newR.guild, 'roles', (e) => {
      e.setTitle('Rang módosítva')
       .setDescription(`Módosult rang: <@&${newR.id}>`)
       .addFields(fields.slice(0, 25));
    });
  });

  const chTypeName = (t) => ({
    [ChannelType.GuildText]: 'szöveges',
    [ChannelType.GuildVoice]: 'hang',
    [ChannelType.GuildCategory]: 'kategória',
    [ChannelType.GuildAnnouncement]: 'hirdetmény',
    [ChannelType.GuildStageVoice]: 'színpad',
    [ChannelType.GuildForum]: 'fórum',
  }[t] ?? 'egyéb');

  client.on(Events.ChannelCreate, async (channel) => {
    if (!channel.guild) return;
    await log(channel.guild, 'channels', (e) => {
      e.setTitle('Csatorna létrehozva')
       .setDescription(`Új ${chTypeName(channel.type)} csatorna: <#${channel.id}> (\`${channel.name}\`)`);
    });
  });

  client.on(Events.ChannelDelete, async (channel) => {
    if (!channel.guild) return;
    await log(channel.guild, 'channels', (e) => {
      e.setTitle('Csatorna törölve')
       .setDescription(`Törölt ${chTypeName(channel.type)} csatorna: \`${channel.name}\``);
    });
  });

  client.on(Events.ChannelUpdate, async (oldCh, newCh) => {
    if (!newCh.guild) return;
    if (oldCh.name === newCh.name) return;
    await log(newCh.guild, 'channels', (e) => {
      e.setTitle('Csatorna átnevezve')
       .setDescription(`<#${newCh.id}>: \`${cut(oldCh.name, 100)}\` → \`${cut(newCh.name, 100)}\``);
    });
  });
}
