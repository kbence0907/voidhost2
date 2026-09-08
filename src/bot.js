import { Client, GatewayIntentBits, Events, ActivityType, EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { sseNotify } from './sse.js';
import { getAllWatchedRoleIds } from './discord.js';
import { getActiveBotCount } from './bot-runner.js';
import { db } from './db.js';
import { pushNotification } from './notify.js';
import { canApprove, approveUserAccount, rejectUserAccount } from './approvals.js';

const GUILD_ID = process.env.DISCORD_GUILD_ID ?? '';

let client = null;
let presenceTimer = null;

function startPresenceRotation(c) {
  const states = [
    () => ({ name: 'voidhost.hu', type: ActivityType.Watching }),
    () => ({ name: `Elérhető botok: ${getActiveBotCount()}`, type: ActivityType.Watching }),
  ];
  let i = 0;
  const apply = () => {
    try { c.user.setPresence({ activities: [states[i % states.length]()], status: 'online' }); } catch {}
    i++;
  };
  apply();
  clearInterval(presenceTimer);
  presenceTimer = setInterval(apply, 10000);
}

export function startBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.warn('DISCORD_BOT_TOKEN nincs beállítva, a bot nem indul el.');
    return;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
    ],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`Discord bot bejelentkezve: ${c.user.tag}`);
    startPresenceRotation(c);
  });

  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    if (GUILD_ID && newMember.guild.id !== GUILD_ID) return;

    const rankRoleIds = getAllWatchedRoleIds();
    if (!rankRoleIds.length) return;

    const oldSet = new Set(oldMember.roles.cache.keys());
    const newSet = new Set(newMember.roles.cache.keys());
    const gained  = rankRoleIds.filter(id => !oldSet.has(id) && newSet.has(id));
    const lost    = rankRoleIds.filter(id => oldSet.has(id) && !newSet.has(id));

    if (!gained.length && !lost.length) return;

    const stillHasRank = rankRoleIds.some(id => newSet.has(id));
    console.log(`Rang változás: ${newMember.user.tag} (${newMember.user.id}) · rang megmaradt: ${stillHasRank}`);
    if (stillHasRank) {
      sseNotify(newMember.user.id, 'role_update');
    } else {
      sseNotify(newMember.user.id, 'force_logout', {
        reason: 'A Discord rangod megváltozott és már nincs meg a szükséges rang a panel használatához.',
      });
    }

    try {
      const user = await db.getUserByDiscordId(newMember.user.id);
      if (!user) return;
      if (gained.length) {
        await pushNotification(user.id, {
          type: 'rank_gained',
          title: 'Új rangot kaptál',
          body: 'A Discord rangod megváltozott — a panel jogosultságaid frissültek.',
        });
      } else if (lost.length && stillHasRank) {
        await pushNotification(user.id, {
          type: 'rank_lost',
          title: 'Rang változás',
          body: 'Az egyik rangodat elvették — a panel jogosultságaid frissültek.',
        });
      }
    } catch (e) {
      console.warn('rang értesítés hiba:', e.message);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      const memberRoleIds = interaction.member?.roles?.cache
        ? [...interaction.member.roles.cache.keys()]
        : null;

      // Gombok: jóváhagyás / elutasítás
      if (interaction.isButton() && (interaction.customId.startsWith('vh_approve:') || interaction.customId.startsWith('vh_reject:'))) {
        const [action, userId] = interaction.customId.split(':');

        if (!(await canApprove(interaction.user.id, memberRoleIds))) {
          await interaction.reply({ content: '❌ Nincs jogosultságod fiókokat jóváhagyni.', ephemeral: true });
          return;
        }

        if (action === 'vh_approve') {
          await interaction.deferUpdate();
          const res = await approveUserAccount(userId, interaction.user.username, 'jóváhagyás (Discord)');
          if (!res.ok) {
            await interaction.followUp({ content: `❌ ${res.error}`, ephemeral: true });
            return;
          }
          const base = interaction.message.embeds[0];
          const embed = EmbedBuilder.from(base)
            .setTitle('✅ Fiók jóváhagyva')
            .setColor(0x57f287)
            .setFields([
              ...(base?.fields ?? []).filter(f => f.name !== 'Állapot'),
              { name: 'Állapot', value: `Jóváhagyta: <@${interaction.user.id}>`, inline: false },
            ]);
          await interaction.editReply({ embeds: [embed], components: [] });
          return;
        }

        // vh_reject → modál az indoknak
        const modal = new ModalBuilder().setCustomId(`vh_rejectmodal:${userId}`).setTitle('Regisztráció elutasítása');
        const reasonInput = new TextInputBuilder()
          .setCustomId('reason').setLabel('Indok (opcionális)')
          .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(300);
        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
        return;
      }

      // Modál beküldése: elutasítás
      if (interaction.isModalSubmit() && interaction.customId.startsWith('vh_rejectmodal:')) {
        await interaction.deferReply({ ephemeral: true });
        const userId = interaction.customId.split(':')[1];

        if (!(await canApprove(interaction.user.id, memberRoleIds))) {
          await interaction.editReply({ content: '❌ Nincs jogosultságod.' });
          return;
        }
        const reason = (interaction.fields.getTextInputValue('reason') || '').trim();
        const res = await rejectUserAccount(userId, reason, interaction.user.username, 'jóváhagyás (Discord)');
        if (!res.ok) {
          await interaction.editReply({ content: `❌ ${res.error}` });
          return;
        }
        const base = interaction.message?.embeds?.[0];
        if (base && interaction.message) {
          const embed = EmbedBuilder.from(base)
            .setTitle('⛔ Regisztráció elutasítva')
            .setColor(0xed4245)
            .setFields([
              ...(base.fields ?? []).filter(f => f.name !== 'Állapot'),
              { name: 'Állapot', value: `Elutasította: <@${interaction.user.id}>${reason ? `\nIndok: ${reason}` : ''}`, inline: false },
            ]);
          await interaction.message.edit({ embeds: [embed], components: [] }).catch(() => {});
        }
        await interaction.editReply({ content: `✅ ${res.user?.name ?? 'A felhasználó'} elutasítva, a fiók törölve.` });
        return;
      }
    } catch (e) {
      console.error('jóváhagyás interakció hiba:', e);
      try {
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Hiba történt a művelet során.', ephemeral: true });
        }
      } catch {}
    }
  });

  client.on(Events.Error, (err) => {
    console.error('Discord bot hiba:', err);
  });

  client.login(token).catch((err) => {
    console.error('Discord bot bejelentkezési hiba:', err);
  });
}

export function getBot() {
  return client;
}
