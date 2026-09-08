import {
  Events, ChannelType, PermissionFlagsBits,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder,
} from 'discord.js';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { mergeTicketConfig, hexToInt, findPanel, findCategory } from '../ticket-defs.js';

let cache = { at: 0, cfg: null, mods: null };

async function getConfig(botDbId) {
  if (Date.now() - cache.at < 8000 && cache.cfg) return cache;
  const [raw, mods] = await Promise.all([
    db.getTicketConfig(botDbId).catch(() => null),
    db.getBotModules(botDbId).catch(() => ({})),
  ]);
  cache = { at: Date.now(), cfg: mergeTicketConfig(raw), mods };
  return cache;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const BTN_STYLE = { primary: ButtonStyle.Primary, secondary: ButtonStyle.Secondary, success: ButtonStyle.Success, danger: ButtonStyle.Danger };

function memberHasAnyRole(member, roleIds) {
  if (!roleIds?.length) return false;
  const roles = member?.roles?.cache;
  if (!roles) return false;
  return roleIds.some(id => roles.has(id));
}

function isStaff(member, category) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.ManageChannels)) return true;
  return memberHasAnyRole(member, category?.staffRoleIds ?? []);
}

function ticketButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('vht:claim').setLabel('Átvétel').setEmoji('🙋').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('vht:close').setLabel('Bezárás').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('vht:closeR').setLabel('Bezárás indokkal').setStyle(ButtonStyle.Secondary),
  );
}

async function buildTranscript(channel, ticket) {
  const all = [];
  let before;
  for (let i = 0; i < 6; i++) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) }).catch(() => null);
    if (!batch || batch.size === 0) break;
    const arr = [...batch.values()];
    all.push(...arr);
    before = arr[arr.length - 1].id;
    if (batch.size < 100) break;
  }
  all.reverse();

  const rows = all.map(m => {
    const time = new Date(m.createdTimestamp).toLocaleString('hu-HU');
    let content = esc(m.content || '');
    for (const a of m.attachments.values()) content += `<div class="att">📎 <a href="${esc(a.url)}">${esc(a.name || 'csatolmány')}</a></div>`;
    for (const e of m.embeds) if (e.description) content += `<div class="embed">${esc(e.title || '')}<br>${esc(e.description)}</div>`;
    return `<div class="msg"><span class="au">${esc(m.author?.tag || m.author?.username || 'Ismeretlen')}</span> <span class="ts">${esc(time)}</span><div class="ct">${content || '<i>—</i>'}</div></div>`;
  }).join('\n');

  const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Jegy #${ticket.number} átirat</title>
<style>body{background:#313338;color:#dbdee1;font-family:Arial,Helvetica,sans-serif;font-size:14px;margin:0;padding:24px}
h1{font-size:18px;color:#fff}.msg{padding:8px 0;border-bottom:1px solid #3f4147}.au{font-weight:700;color:#fff}
.ts{color:#949ba4;font-size:12px;margin-left:6px}.ct{margin-top:3px;white-space:pre-wrap;word-break:break-word}
.att{margin-top:4px}.embed{margin-top:4px;border-left:3px solid #5865f2;padding-left:8px;color:#b5bac1}
a{color:#00a8fc}.meta{color:#949ba4;font-size:12px;margin-bottom:16px}</style></head><body>
<h1>Jegy #${ticket.number} — átirat</h1>
<div class="meta">Csatorna: ${esc(channel.name)} · Nyitó: ${esc(ticket.opener_tag || ticket.opener_id)} · Üzenetek: ${all.length} · Készült: ${esc(new Date().toLocaleString('hu-HU'))}</div>
${rows}
</body></html>`;

  return new AttachmentBuilder(Buffer.from(html, 'utf-8'), { name: `jegy-${ticket.number}.html` });
}

async function openTicket({ interaction, botDbId, cfg, panel, category, answers }) {
  const guild = interaction.guild;
  const opener = interaction.user;

  // limitek
  if (panel.maxOpenPerUser > 0) {
    const n = await db.getOpenTicketCount(botDbId, opener.id, { panelId: panel.id }).catch(() => 0);
    if (n >= panel.maxOpenPerUser) {
      return interaction.reply({ content: `❌ Már ${n} nyitott jegyed van ezen a panelen (max ${panel.maxOpenPerUser}). Előbb zárd le a meglévőt.`, ephemeral: true });
    }
  }
  if (category.maxOpenPerUser > 0) {
    const n = await db.getOpenTicketCount(botDbId, opener.id, { panelId: panel.id, categoryId: category.id }).catch(() => 0);
    if (n >= category.maxOpenPerUser) {
      return interaction.reply({ content: `❌ Már ${n} nyitott jegyed van ebben a kategóriában (max ${category.maxOpenPerUser}).`, ephemeral: true });
    }
  }

  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  const number = await db.nextTicketNumber(botDbId).catch(() => Date.now() % 100000);

  const everyone = guild.roles.everyone.id;
  const overwrites = [
    { id: everyone, deny: [PermissionFlagsBits.ViewChannel] },
    { id: opener.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
  ];
  for (const rid of category.staffRoleIds) {
    if (guild.roles.cache.has(rid)) {
      overwrites.push({ id: rid, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageMessages] });
    }
  }

  let channel;
  const baseOpts = {
    name: `jegy-${number}`,
    type: ChannelType.GuildText,
    topic: `Jegy #${number} · ${category.label} · nyitó: ${opener.tag ?? opener.username} (${opener.id})`,
    permissionOverwrites: overwrites,
  };
  try {
    channel = await guild.channels.create(category.discordCategoryId
      ? { ...baseOpts, parent: category.discordCategoryId }
      : baseOpts);
  } catch {
    try { channel = await guild.channels.create(baseOpts); }
    catch (e) {
      return interaction.editReply({ content: `❌ Nem sikerült létrehozni a jegy csatornát. Ellenőrizd, hogy a botnak van **Csatornák kezelése** joga. (${e.message ?? 'ismeretlen hiba'})` }).catch(() => {});
    }
  }

  await db.createTicket({
    id: randomUUID(),
    botId: botDbId,
    guildId: guild.id,
    channelId: channel.id,
    panelId: panel.id,
    categoryId: category.id,
    number,
    openerId: opener.id,
    openerTag: opener.tag ?? opener.username,
  }).catch(() => {});

  const embed = new EmbedBuilder()
    .setColor(hexToInt(panel.embed?.color))
    .setTitle(`Jegy #${number} · ${category.label}`)
    .setDescription(category.openMessage || 'Köszönjük a jegyet! Hamarosan válaszolunk.')
    .addFields({ name: 'Nyitotta', value: `<@${opener.id}>`, inline: true });

  if (answers?.length) {
    for (const a of answers.slice(0, 5)) {
      embed.addFields({ name: a.label.slice(0, 256), value: (a.value || '—').slice(0, 1024) });
    }
  }

  const pings = ['<@' + opener.id + '>', ...category.pingRoleIds.map(r => `<@&${r}>`)].join(' ');

  await channel.send({
    content: pings,
    embeds: [embed],
    components: [ticketButtons()],
    allowedMentions: { users: [opener.id], roles: category.pingRoleIds },
  }).catch(() => {});

  process.send?.({ type: 'log', msg: `[hibajegy] #${number} nyitva – ${opener.username} (${category.label})` });

  await interaction.editReply({ content: `✅ A jegyed elkészült: <#${channel.id}>` }).catch(() => {});
}

async function resolveTicketCtx(interaction, botDbId) {
  const ticket = await db.getTicketByChannel(interaction.channel.id).catch(() => null);
  if (!ticket || ticket.bot_id !== botDbId) return null;
  const { cfg } = await getConfig(botDbId);
  const panel = findPanel(cfg, ticket.panel_id);
  const category = findCategory(panel, ticket.category_id) ?? { staffRoleIds: [], label: 'Jegy' };
  return { ticket, cfg, panel, category };
}

async function doClose({ interaction, botDbId, ticketCtx, reason }) {
  const { ticket, cfg, category } = ticketCtx;
  const channel = interaction.channel;

  if (ticket.status !== 'open') {
    return interaction.reply({ content: 'Ez a jegy már le van zárva.', ephemeral: true }).catch(() => {});
  }

  await interaction.reply({ content: `🔒 A jegyet lezárta <@${interaction.user.id}>${reason ? ` · Indok: ${reason}` : ''}. A csatorna hamarosan törlődik.` }).catch(() => {});

  await db.closeTicket(ticket.id, reason ?? null).catch(() => {});

  // átirat + log
  if (cfg.transcript?.enabled && cfg.logChannelId) {
    const logCh = interaction.guild.channels.cache.get(cfg.logChannelId);
    if (logCh?.isTextBased()) {
      const file = await buildTranscript(channel, ticket).catch(() => null);
      const sum = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(`Jegy #${ticket.number} lezárva`)
        .addFields(
          { name: 'Kategória', value: category.label || '—', inline: true },
          { name: 'Nyitó', value: `<@${ticket.opener_id}>`, inline: true },
          { name: 'Lezárta', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Átvette', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : '—', inline: true },
          { name: 'Nyitva volt', value: `<t:${Math.floor(ticket.created_at / 1000)}:R>`, inline: true },
          { name: 'Indok', value: reason || '—', inline: false },
        );
      await logCh.send({ embeds: [sum], files: file ? [file] : [], allowedMentions: { parse: [] } }).catch(() => {});
    }
  }

  // nyitó értesítése DM-ben
  interaction.guild.members.fetch(ticket.opener_id).then(m => {
    m.send({ content: `A(z) **${interaction.guild.name}** szerveren a #${ticket.number} jegyed lezárásra került.${reason ? `\nIndok: ${reason}` : ''}` }).catch(() => {});
  }).catch(() => {});

  process.send?.({ type: 'log', msg: `[hibajegy] #${ticket.number} lezárva – ${interaction.user.username}` });

  const delay = Math.max(0, (cfg.transcript?.deleteDelaySec ?? 5)) * 1000;
  setTimeout(() => { channel.delete(`Jegy #${ticket.number} lezárva`).catch(() => {}); }, delay || 1000);
}

export function setup(client) {
  const botDbId = process.env.BOT_DB_ID;
  if (!botDbId) return;

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      const cid = interaction.customId ?? '';
      if (!cid.startsWith('vht:')) return;
      if (!interaction.guild) return;

      const { cfg, mods } = await getConfig(botDbId);
      if (mods && mods.tickets === false) {
        if (interaction.isRepliable()) await interaction.reply({ content: 'A hibajegy modul jelenleg ki van kapcsolva.', ephemeral: true }).catch(() => {});
        return;
      }

      // ---- panel: gomb (1 kategória) ----
      if (interaction.isButton() && cid.startsWith('vht:o:')) {
        const panel = findPanel(cfg, cid.slice(6));
        if (!panel) return interaction.reply({ content: 'Ez a panel már nem elérhető.', ephemeral: true });
        return handlePanelPick(interaction, cfg, panel, panel.categories[0]);
      }

      // ---- panel: legördülő menü ----
      if (interaction.isStringSelectMenu() && cid.startsWith('vht:s:')) {
        const panel = findPanel(cfg, cid.slice(6));
        if (!panel) return interaction.reply({ content: 'Ez a panel már nem elérhető.', ephemeral: true });
        const category = findCategory(panel, interaction.values[0]);
        return handlePanelPick(interaction, cfg, panel, category);
      }

      // ---- modál beküldése: jegy létrehozása ----
      if (interaction.isModalSubmit() && cid.startsWith('vht:m:')) {
        const [, , panelId, categoryId] = cid.split(':');
        const panel = findPanel(cfg, panelId);
        const category = findCategory(panel, categoryId);
        if (!panel || !category) return interaction.reply({ content: 'Ez a kategória már nem elérhető.', ephemeral: true });
        const answers = category.questions.map((q, i) => ({
          label: q.label,
          value: (interaction.fields.getTextInputValue(`q${i}`) || '').trim(),
        }));
        return openTicket({ interaction, botDbId, cfg, panel, category, answers });
      }

      // ---- jegy csatorna gombjai ----
      if (interaction.isButton() && (cid === 'vht:claim' || cid === 'vht:close' || cid === 'vht:closeR' || cid === 'vht:cc')) {
        const ctx = await resolveTicketCtx(interaction, botDbId);
        if (!ctx) return interaction.reply({ content: 'Ez a csatorna nem egy aktív jegy.', ephemeral: true });
        const member = interaction.member;
        const staff = isStaff(member, ctx.category);
        const isOpener = interaction.user.id === ctx.ticket.opener_id;

        if (cid === 'vht:claim') {
          if (!staff) return interaction.reply({ content: '❌ Csak a support csapat veheti át a jegyet.', ephemeral: true });
          if (ctx.ticket.claimed_by) return interaction.reply({ content: `Ezt a jegyet már átvette <@${ctx.ticket.claimed_by}>.`, ephemeral: true });
          await db.setTicketClaim(ctx.ticket.id, interaction.user.id).catch(() => {});
          await interaction.reply({ content: `🙋 A jegyet átvette <@${interaction.user.id}>.` }).catch(() => {});
          return;
        }

        if (cid === 'vht:close') {
          if (!staff && !isOpener) return interaction.reply({ content: '❌ Nincs jogosultságod lezárni ezt a jegyet.', ephemeral: true });
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('vht:cc').setLabel('Igen, bezárom').setStyle(ButtonStyle.Danger),
          );
          return interaction.reply({ content: 'Biztosan lezárod ezt a jegyet?', components: [row], ephemeral: true });
        }

        if (cid === 'vht:cc') {
          if (!staff && !isOpener) return interaction.reply({ content: '❌ Nincs jogosultságod.', ephemeral: true });
          return doClose({ interaction, botDbId, ticketCtx: ctx, reason: null });
        }

        if (cid === 'vht:closeR') {
          if (!staff && !isOpener) return interaction.reply({ content: '❌ Nincs jogosultságod.', ephemeral: true });
          const modal = new ModalBuilder().setCustomId('vht:crm').setTitle('Jegy lezárása indokkal');
          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('reason').setLabel('Indok').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500),
          ));
          return interaction.showModal(modal);
        }
      }

      // ---- lezárás indokkal modál ----
      if (interaction.isModalSubmit() && cid === 'vht:crm') {
        const ctx = await resolveTicketCtx(interaction, botDbId);
        if (!ctx) return interaction.reply({ content: 'Ez a csatorna nem egy aktív jegy.', ephemeral: true });
        const staff = isStaff(interaction.member, ctx.category);
        const isOpener = interaction.user.id === ctx.ticket.opener_id;
        if (!staff && !isOpener) return interaction.reply({ content: '❌ Nincs jogosultságod.', ephemeral: true });
        const reason = (interaction.fields.getTextInputValue('reason') || '').trim().slice(0, 500);
        return doClose({ interaction, botDbId, ticketCtx: ctx, reason });
      }
    } catch (e) {
      console.error('hibajegy interakció hiba:', e);
      try {
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Hiba történt a művelet során.', ephemeral: true });
        }
      } catch {}
    }
  });
}

async function handlePanelPick(interaction, cfg, panel, category) {
  if (!category) {
    return interaction.reply({ content: 'Ehhez a panelhez nincs beállítva kategória. Szólj egy adminnak.', ephemeral: true });
  }

  const member = interaction.member;
  if (memberHasAnyRole(member, panel.access?.deniedRoleIds)) {
    return interaction.reply({ content: '❌ Nincs jogosultságod jegyet nyitni ezen a panelen.', ephemeral: true });
  }
  if ((panel.access?.allowedRoleIds ?? []).length && !memberHasAnyRole(member, panel.access.allowedRoleIds)) {
    return interaction.reply({ content: '❌ Ez a panel csak bizonyos rangoknak érhető el.', ephemeral: true });
  }

  // van kérdés → modál, különben azonnal
  if (category.questions?.length) {
    const modal = new ModalBuilder()
      .setCustomId(`vht:m:${panel.id}:${category.id}`)
      .setTitle(`Jegy · ${category.label}`.slice(0, 45));
    category.questions.slice(0, 5).forEach((q, i) => {
      const input = new TextInputBuilder()
        .setCustomId(`q${i}`)
        .setLabel((q.label || `Kérdés ${i + 1}`).slice(0, 45))
        .setStyle(q.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(q.required !== false)
        .setMaxLength(Math.min(1024, Math.max(1, q.maxLength || 300)));
      if (q.placeholder) input.setPlaceholder(String(q.placeholder).slice(0, 100));
      modal.addComponents(new ActionRowBuilder().addComponents(input));
    });
    return interaction.showModal(modal);
  }

  const botDbId = process.env.BOT_DB_ID;
  return openTicket({ interaction, botDbId, cfg, panel, category, answers: [] });
}
