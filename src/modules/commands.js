import { Events, EmbedBuilder } from 'discord.js';
import { db } from '../db.js';

async function sendResponse(target, cmd, isSlash) {
  const text = (cmd.response || '​').replace(/@(everyone|here)/g, '@​$1');
  const allowedMentions = { parse: [] };

  if (cmd.responseType === 'embed') {
    const hex = parseInt((cmd.embedColor ?? '#5865f2').replace('#', ''), 16);
    const embed = new EmbedBuilder()
      .setDescription(text)
      .setColor(isNaN(hex) ? 0x5865f2 : hex);
    if (cmd.embedTitle)  embed.setTitle(String(cmd.embedTitle).replace(/@(everyone|here)/g, '@​$1'));
    if (cmd.embedFooter) embed.setFooter({ text: String(cmd.embedFooter).replace(/@(everyone|here)/g, '@​$1') });
    if (isSlash) await target.reply({ embeds: [embed], ephemeral: !!cmd.ephemeral, allowedMentions });
    else         await target.channel.send({ embeds: [embed], allowedMentions });
  } else {
    if (isSlash) await target.reply({ content: text, ephemeral: !!cmd.ephemeral, allowedMentions });
    else         await target.channel.send({ content: text, allowedMentions });
  }
}

export function setup(client) {
  const botDbId = process.env.BOT_DB_ID;
  if (!botDbId) return;

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const mods = await db.getBotModules(botDbId).catch(() => null);
    if (mods && mods.commands === false) return;
    const cmds = await db.getCommands(botDbId).catch(() => []);
    const cmd = cmds.find(c => c.type === 'slash' && c.name === interaction.commandName);
    if (!cmd) return;
    if (cmd.requiredRoleId && !interaction.member?.roles?.cache?.has(cmd.requiredRoleId)) {
      await interaction.reply({ content: 'Nincs jogosultságod ehhez a parancshoz.', ephemeral: true }).catch(() => {});
      return;
    }
    await sendResponse(interaction, cmd, true).catch(console.error);
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    const mods = await db.getBotModules(botDbId).catch(() => null);
    if (mods && mods.commands === false) return;
    const settings = await db.getBotSettings(botDbId).catch(() => ({ prefix: '!' }));
    const prefix = settings.prefix || '!';
    if (!message.content.startsWith(prefix)) return;
    const name = message.content.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase();
    if (!name) return;
    const cmds = await db.getCommands(botDbId).catch(() => []);
    const cmd = cmds.find(c => c.type === 'prefix' && c.name === name);
    if (!cmd) return;
    if (cmd.requiredRoleId && !message.member?.roles?.cache?.has(cmd.requiredRoleId)) {
      await message.reply('Nincs jogosultságod ehhez a parancshoz.').catch(() => {});
      return;
    }
    if (cmd.deleteTrigger) await message.delete().catch(() => {});
    await sendResponse(message, cmd, false).catch(console.error);
  });
}
